from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any


class Store:
    def __init__(self, path: Path, initial_equity: float = 10.0) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path, timeout=20)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self._schema()
        if self.get_meta("cash") is None:
            self.set_meta("cash", str(initial_equity))
            self.set_meta("initial_equity", str(initial_equity))
            self.set_meta("high_water_equity", str(initial_equity))
            self.set_meta("kill_switch", "0")
            self.set_meta("kill_reason", "")

    def _schema(self) -> None:
        self.conn.executescript("""
        CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS quotes(
            id INTEGER PRIMARY KEY, symbol TEXT NOT NULL, asset_class TEXT NOT NULL,
            price REAL NOT NULL, currency TEXT NOT NULL, timestamp REAL NOT NULL,
            source TEXT NOT NULL, bid REAL, ask REAL, volume REAL, quality TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_quotes_symbol_time ON quotes(symbol, timestamp DESC);
        CREATE TABLE IF NOT EXISTS bars(
            id INTEGER PRIMARY KEY, symbol TEXT NOT NULL, timestamp REAL NOT NULL,
            open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL,
            volume REAL NOT NULL, source TEXT NOT NULL, UNIQUE(symbol, timestamp)
        );
        CREATE TABLE IF NOT EXISTS news_items(
            id INTEGER PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
            source TEXT, published TEXT, provider TEXT NOT NULL, sentiment TEXT NOT NULL,
            saved_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS signals(
            id INTEGER PRIMARY KEY, symbol TEXT NOT NULL, action TEXT NOT NULL,
            score REAL NOT NULL, rsi14 REAL, ema_fast REAL, ema_slow REAL,
            momentum_pct REAL, notes_json TEXT NOT NULL, created_at REAL NOT NULL,
            source TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS positions(
            id INTEGER PRIMARY KEY, symbol TEXT NOT NULL, asset_class TEXT NOT NULL,
            side INTEGER NOT NULL CHECK(side IN (-1,1)), units REAL NOT NULL,
            entry_price REAL NOT NULL, mark_price REAL NOT NULL, notional REAL NOT NULL,
            collateral REAL NOT NULL DEFAULT 0, entry_fee REAL NOT NULL,
            stop_price REAL NOT NULL, take_profit_price REAL NOT NULL,
            opened_at REAL NOT NULL, closed_at REAL, exit_price REAL,
            realized_pnl REAL, status TEXT NOT NULL DEFAULT 'OPEN'
        );
        CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status, symbol);
        CREATE TABLE IF NOT EXISTS trades(
            id INTEGER PRIMARY KEY, position_id INTEGER, symbol TEXT NOT NULL,
            action TEXT NOT NULL, side INTEGER NOT NULL, units REAL NOT NULL,
            price REAL NOT NULL, notional REAL NOT NULL, fee REAL NOT NULL,
            pnl REAL, note TEXT NOT NULL, created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS decisions(
            id INTEGER PRIMARY KEY, category TEXT NOT NULL, symbol TEXT,
            message TEXT NOT NULL, data_json TEXT NOT NULL, created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS equity_snapshots(
            id INTEGER PRIMARY KEY, cash REAL NOT NULL, equity REAL NOT NULL,
            exposure REAL NOT NULL, drawdown_pct REAL NOT NULL,
            created_at REAL NOT NULL
        );
        """)
        self.conn.commit()

    def get_meta(self, key: str) -> str | None:
        row = self.conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return str(row["value"]) if row else None

    def set_meta(self, key: str, value: str) -> None:
        self.conn.execute("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))
        self.conn.commit()

    def cash(self) -> float:
        return float(self.get_meta("cash") or 0)

    def set_cash(self, value: float) -> None:
        self.set_meta("cash", f"{value:.10f}")

    def log(self, category: str, message: str, symbol: str | None = None, data: dict[str, Any] | None = None) -> None:
        self.conn.execute("INSERT INTO decisions(category,symbol,message,data_json,created_at) VALUES(?,?,?,?,?)", (category, symbol, message, json.dumps(data or {}, sort_keys=True), time.time()))
        self.conn.commit()

    def save_quote(self, quote: dict[str, Any]) -> None:
        self.conn.execute("INSERT INTO quotes(symbol,asset_class,price,currency,timestamp,source,bid,ask,volume,quality) VALUES(?,?,?,?,?,?,?,?,?,?)", (
            quote["symbol"], quote["asset_class"], quote["price"], quote["currency"], quote["timestamp"], quote["source"], quote.get("bid"), quote.get("ask"), quote.get("volume"), quote.get("quality", "provider_timestamp"),
        ))
        self.conn.commit()

    def save_bars(self, symbol: str, bars: list, source: str) -> None:
        self.conn.executemany("INSERT OR REPLACE INTO bars(symbol,timestamp,open,high,low,close,volume,source) VALUES(?,?,?,?,?,?,?,?)", [
            (symbol, b.timestamp, b.open, b.high, b.low, b.close, b.volume, source) for b in bars
        ])
        self.conn.commit()

    def latest_bars(self, symbol: str, limit: int = 60) -> list[sqlite3.Row]:
        return list(self.conn.execute("SELECT * FROM bars WHERE symbol=? ORDER BY timestamp DESC LIMIT ?", (symbol.upper(), limit)))

    def save_news(self, items: list[dict[str, Any]]) -> int:
        added = 0
        for item in items:
            if not item.get("title") or not item.get("url"):
                continue
            cur = self.conn.execute("INSERT OR IGNORE INTO news_items(title,url,source,published,provider,sentiment,saved_at) VALUES(?,?,?,?,?,?,?)", (
                str(item["title"]), str(item["url"]), str(item.get("source") or "Unknown"), str(item.get("published") or ""), str(item.get("provider") or "unknown"), str(item.get("sentiment") or "neutral"), time.time(),
            ))
            added += cur.rowcount
        self.conn.commit()
        return added

    def record_signal(self, signal, source: str) -> None:
        self.conn.execute("INSERT INTO signals(symbol,action,score,rsi14,ema_fast,ema_slow,momentum_pct,notes_json,created_at,source) VALUES(?,?,?,?,?,?,?,?,?,?)", (
            signal.symbol, signal.action, signal.score, signal.rsi14, signal.ema_fast, signal.ema_slow, signal.momentum_pct, json.dumps(signal.notes), time.time(), source,
        ))
        self.conn.commit()

    def open_positions(self) -> list[sqlite3.Row]:
        return list(self.conn.execute("SELECT * FROM positions WHERE status='OPEN' ORDER BY opened_at"))

    def recent_trades(self, limit: int = 15) -> list[sqlite3.Row]:
        return list(self.conn.execute("SELECT * FROM trades ORDER BY created_at DESC LIMIT ?", (limit,)))

    def recent_decisions(self, limit: int = 15) -> list[sqlite3.Row]:
        return list(self.conn.execute("SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?", (limit,)))

    def add_position(self, row: dict[str, Any]) -> int:
        cur = self.conn.execute("""INSERT INTO positions(symbol,asset_class,side,units,entry_price,mark_price,notional,collateral,entry_fee,stop_price,take_profit_price,opened_at,status)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'OPEN')""", (
            row["symbol"], row["asset_class"], row["side"], row["units"], row["entry_price"], row["mark_price"], row["notional"], row["collateral"], row["entry_fee"], row["stop_price"], row["take_profit_price"], row["opened_at"],
        ))
        self.conn.commit()
        return int(cur.lastrowid)

    def update_mark(self, position_id: int, price: float) -> None:
        self.conn.execute("UPDATE positions SET mark_price=? WHERE id=? AND status='OPEN'", (price, position_id))
        self.conn.commit()

    def close_position(self, position_id: int, exit_price: float, pnl: float) -> None:
        self.conn.execute("UPDATE positions SET closed_at=?,exit_price=?,realized_pnl=?,status='CLOSED' WHERE id=? AND status='OPEN'", (time.time(), exit_price, pnl, position_id))
        self.conn.commit()

    def record_trade(self, row: dict[str, Any]) -> None:
        self.conn.execute("INSERT INTO trades(position_id,symbol,action,side,units,price,notional,fee,pnl,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", (
            row.get("position_id"), row["symbol"], row["action"], row["side"], row["units"], row["price"], row["notional"], row["fee"], row.get("pnl"), row["note"], time.time(),
        ))
        self.conn.commit()

    def trade_count_since(self, since: float) -> int:
        row = self.conn.execute("SELECT COUNT(*) AS n FROM trades WHERE action IN ('BUY','SHORT') AND created_at>=?", (since,)).fetchone()
        return int(row["n"] if row else 0)

    def snapshot(self, cash: float, equity: float, exposure: float, drawdown_pct: float) -> None:
        self.conn.execute("INSERT INTO equity_snapshots(cash,equity,exposure,drawdown_pct,created_at) VALUES(?,?,?,?,?)", (cash, equity, exposure, drawdown_pct, time.time()))
        self.conn.commit()

    def summary(self) -> dict[str, Any]:
        closed = self.conn.execute("SELECT COUNT(*) n, COALESCE(SUM(realized_pnl),0) pnl FROM positions WHERE status='CLOSED'").fetchone()
        return {"cash": self.cash(), "open_positions": self.open_positions(), "closed_count": int(closed["n"]), "realized_pnl": float(closed["pnl"]), "kill_switch": self.get_meta("kill_switch") == "1", "kill_reason": self.get_meta("kill_reason") or ""}

    def reset_paper(self, initial_equity: float) -> None:
        self.conn.executescript("DELETE FROM positions; DELETE FROM trades; DELETE FROM decisions; DELETE FROM equity_snapshots;")
        self.set_meta("cash", f"{initial_equity:.10f}")
        self.set_meta("initial_equity", f"{initial_equity:.10f}")
        self.set_meta("high_water_equity", f"{initial_equity:.10f}")
        self.set_meta("kill_switch", "0")
        self.set_meta("kill_reason", "")
        self.log("RESET", "Paper ledger reset by explicit local command", data={"initial_equity": initial_equity})

    def close(self) -> None:
        self.conn.close()
