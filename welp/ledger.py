from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any


SCHEMA = """
CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mint TEXT NOT NULL,
    symbol TEXT NOT NULL,
    kind TEXT NOT NULL,
    pool TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    token_raw INTEGER NOT NULL,
    sol_spent_lamports INTEGER NOT NULL,
    entry_usd REAL NOT NULL,
    confidence REAL NOT NULL,
    features_json TEXT NOT NULL,
    entry_signature TEXT NOT NULL,
    opened_at REAL NOT NULL,
    peak_pnl_pct REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    exit_signature TEXT,
    sol_received_lamports INTEGER,
    exit_usd REAL,
    pnl_pct REAL,
    closed_at REAL,
    close_note TEXT
);
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    mint TEXT,
    symbol TEXT,
    score REAL,
    action TEXT NOT NULL,
    note TEXT NOT NULL
);
"""


class Ledger:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)

    def close(self) -> None:
        self.conn.close()

    def decide(self, action: str, note: str, mint: str = "", symbol: str = "", score: float | None = None) -> None:
        self.conn.execute(
            "INSERT INTO decisions (ts, mint, symbol, score, action, note) VALUES (?, ?, ?, ?, ?, ?)",
            (time.time(), mint, symbol, score, action, note),
        )
        self.conn.commit()

    def open_position(
        self,
        *,
        mint: str,
        symbol: str,
        kind: str,
        pool: str,
        decimals: int,
        token_raw: int,
        sol_spent_lamports: int,
        entry_usd: float,
        confidence: float,
        features: list[float],
        signature: str,
    ) -> int:
        cur = self.conn.execute(
            """
            INSERT INTO positions (
                mint, symbol, kind, pool, decimals, token_raw, sol_spent_lamports,
                entry_usd, confidence, features_json, entry_signature, opened_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
            """,
            (
                mint,
                symbol,
                kind,
                pool,
                decimals,
                token_raw,
                sol_spent_lamports,
                entry_usd,
                confidence,
                json.dumps(features),
                signature,
                time.time(),
            ),
        )
        self.conn.commit()
        return int(cur.lastrowid)

    def open_positions(self) -> list[sqlite3.Row]:
        return list(self.conn.execute("SELECT * FROM positions WHERE status = 'open' ORDER BY id"))

    def holding(self, mint: str) -> bool:
        row = self.conn.execute(
            "SELECT 1 FROM positions WHERE mint = ? AND status = 'open' LIMIT 1",
            (mint,),
        ).fetchone()
        return row is not None

    def last_close_ts(self, mint: str) -> float | None:
        row = self.conn.execute(
            "SELECT closed_at FROM positions WHERE mint = ? AND closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT 1",
            (mint,),
        ).fetchone()
        if not row or row["closed_at"] is None:
            return None
        return float(row["closed_at"])

    def mark_peak(self, position_id: int, peak_pnl_pct: float) -> None:
        self.conn.execute(
            "UPDATE positions SET peak_pnl_pct = ? WHERE id = ?",
            (peak_pnl_pct, position_id),
        )
        self.conn.commit()

    def close_position(
        self,
        position_id: int,
        *,
        status: str,
        signature: str | None,
        sol_received_lamports: int | None,
        exit_usd: float | None,
        pnl_pct: float | None,
        note: str,
    ) -> None:
        self.conn.execute(
            """
            UPDATE positions
            SET status = ?, exit_signature = ?, sol_received_lamports = ?, exit_usd = ?,
                pnl_pct = ?, closed_at = ?, close_note = ?
            WHERE id = ?
            """,
            (status, signature, sol_received_lamports, exit_usd, pnl_pct, time.time(), note, position_id),
        )
        self.conn.commit()

    def recent_decisions(self, limit: int = 20) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM decisions ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]

    def summary(self) -> dict[str, Any]:
        open_rows = self.open_positions()
        closed = self.conn.execute(
            "SELECT COUNT(*) AS n, AVG(pnl_pct) AS avg_pnl FROM positions WHERE status = 'closed'"
        ).fetchone()
        return {
            "open": [dict(row) for row in open_rows],
            "closed_count": int(closed["n"] or 0),
            "avg_closed_pnl_pct": closed["avg_pnl"],
        }
