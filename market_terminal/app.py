from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import NAME, __version__
from .config import Settings, load_dotenv
from .indicators import analyse
from .paper import PaperBroker, RiskRejected
from .providers import MarketDataRouter, ProviderError
from .research import NewsResearch, YahooResearch, heuristic_sentiment
from .store import Store


def _money(value: float) -> str:
    return f"${value:,.2f}"


def _time(value: float) -> str:
    return datetime.fromtimestamp(value, timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def _store(settings: Settings) -> Store:
    return Store(settings.database, settings.initial_equity)


def _render_table(headers: list[str], rows: list[list[Any]]) -> None:
    try:
        from rich.console import Console
        from rich.table import Table
        table = Table(show_header=True, header_style="bold cyan")
        for header in headers:
            table.add_column(header, overflow="fold")
        for row in rows:
            table.add_row(*[str(item) for item in row])
        Console().print(table)
    except ImportError:
        print(" | ".join(headers))
        for row in rows:
            print(" | ".join(str(item) for item in row))


def cmd_status(settings: Settings) -> int:
    store = _store(settings)
    data = MarketDataRouter()
    paper = PaperBroker(settings, store, data)
    state = paper.mark_equity()
    print(f"\n{NAME} v{__version__}")
    print("MODE: INTERNAL PAPER ONLY | LIVE BROKER ORDERS: DISABLED")
    print("MARKET PRICES: REAL PROVIDER DATA WHEN AVAILABLE | PAPER FILLS: SIMULATED")
    print(f"Cash: {_money(state['cash'])} | Equity: {_money(state['equity'])} | Exposure: {_money(state['exposure'])}")
    print(f"Drawdown: {state['drawdown_pct']:.2f}% | High-water: {_money(state['high_water'])}")
    if store.get_meta("kill_switch") == "1":
        print(f"KILL SWITCH: LOCKED — {store.get_meta('kill_reason')}")
    else:
        print("KILL SWITCH: ARMED / NOT TRIGGERED")
    positions = store.open_positions()
    _render_table(["ID", "Symbol", "Side", "Units", "Entry", "Mark", "Stop", "Target"], [[p["id"], p["symbol"], "LONG" if p["side"] == 1 else "SHORT", f"{p['units']:.6g}", f"{p['entry_price']:.6g}", f"{p['mark_price']:.6g}", f"{p['stop_price']:.6g}", f"{p['take_profit_price']:.6g}"] for p in positions])
    print("\nData providers:")
    for item in data.health():
        print(f"- {item['provider']}: {item['status']}")
    print(f"SQLite ledger: {settings.database}")
    store.close()
    return 0


def scan_once(settings: Settings, store: Store, data: MarketDataRouter, auto_paper: bool = False) -> list[dict[str, Any]]:
    broker = PaperBroker(settings, store, data)
    results: list[dict[str, Any]] = []
    for symbol in settings.watchlist:
        try:
            quote = data.quote(symbol)
            bars = data.bars(symbol, 200)
            store.save_quote(quote.to_dict())
            store.save_bars(symbol, bars, quote.source)
            signal = analyse(symbol, bars)
            store.record_signal(signal, quote.source)
            result = {"symbol": symbol, "price": quote.price, "currency": quote.currency, "age": quote.age_seconds, "source": quote.source, "action": signal.action, "score": signal.score, "rsi": signal.rsi14, "momentum": signal.momentum_pct, "notes": signal.notes}
            results.append(result)
            print(f"{symbol:12} {quote.price:>14.6g} {quote.currency:4} age={quote.age_seconds/60:5.1f}m {signal.action:17} score={signal.score:5.1f} RSI={signal.rsi14 if signal.rsi14 is not None else 'n/a'}")
            if auto_paper and signal.action in {"BUY", "SHORT"} and signal.score >= 82:
                try:
                    opened = broker.open(symbol, settings.max_position_notional, side=1 if signal.action == "BUY" else -1, note=f"rule score {signal.score:.1f}; {'; '.join(signal.notes)}")
                    print(f"  -> PAPER {opened['action']} ${settings.max_position_notional:.2f}; simulated fill {opened['simulated_fill']:.6g} (not a broker execution)")
                except (RiskRejected, ProviderError) as exc:
                    store.log("AUTO_PAPER_REJECTED", str(exc), symbol)
                    print(f"  -> no paper entry: {exc}")
        except Exception as exc:
            store.log("FEED_ERROR", str(exc), symbol)
            print(f"{symbol:12} DATA UNAVAILABLE — {exc}")
    return results


def cmd_scan(settings: Settings, auto_paper: bool = False) -> int:
    store, data = _store(settings), MarketDataRouter()
    print("No generated sample prices are used. Each row requires a live provider response.")
    scan_once(settings, store, data, auto_paper=auto_paper)
    PaperBroker(settings, store, data).manage()
    store.close()
    return 0


def cmd_quote(settings: Settings, symbol: str) -> int:
    store, data = _store(settings), MarketDataRouter()
    try:
        quote = data.quote(symbol)
        store.save_quote(quote.to_dict())
        print(json.dumps(quote.to_dict(), indent=2))
        print(f"TradingView chart: https://www.tradingview.com/chart/?symbol={symbol.replace('-', '')}")
        return 0
    except Exception as exc:
        print(f"QUOTE UNAVAILABLE — {exc}", file=sys.stderr)
        return 1
    finally:
        store.close()


def cmd_chart(settings: Settings, symbol: str, limit: int = 60) -> int:
    store, data = _store(settings), MarketDataRouter()
    try:
        bars = data.bars(symbol, max(35, min(limit, 300)))
        quote = data.quote(symbol)
        store.save_quote(quote.to_dict())
        store.save_bars(symbol.upper(), bars, quote.source)
        selected = bars[-max(10, min(limit, len(bars))):]
        closes = [bar.close for bar in selected]
        glyphs = "▁▂▃▄▅▆▇█"
        low, high = min(closes), max(closes)
        span = high - low
        line = "".join(glyphs[min(7, int((v-low)/span*7))] if span else glyphs[3] for v in closes)
        change = ((closes[-1] / closes[0]) - 1) * 100 if closes[0] else 0
        print(f"\n{symbol.upper()} — {quote.source}")
        print(f"Last provider quote: {quote.price:,.8g} {quote.currency} at {_time(quote.timestamp)} (age {quote.age_seconds/60:.1f}m)")
        print(line)
        print(f"{len(selected)} bars | low {low:,.6g} | high {high:,.6g} | period change {change:+.2f}%")
        _render_table(["UTC time", "Open", "High", "Low", "Close", "Volume"], [[_time(b.timestamp), f"{b.open:.6g}", f"{b.high:.6g}", f"{b.low:.6g}", f"{b.close:.6g}", f"{b.volume:.6g}"] for b in selected[-12:]])
        print(f"TradingView: https://www.tradingview.com/chart/?symbol={symbol.upper().replace('-', '')}")
        return 0
    except Exception as exc:
        print(f"CHART DATA UNAVAILABLE — {exc}", file=sys.stderr)
        return 1
    finally:
        store.close()


def cmd_research(settings: Settings, symbol: str) -> int:
    store = _store(settings)
    try:
        research = YahooResearch()
        data = research.fundamentals(symbol)
        try:
            headlines = research.company_news(symbol)
            for item in headlines:
                item["sentiment"] = heuristic_sentiment(item.get("title", ""))
            data["yahoo_news_headlines"] = headlines
            store.save_news(headlines)
        except Exception as news_error:
            data["yahoo_news_error"] = str(news_error)
        target = settings.data_dir / "research" / f"{symbol.upper()}-fundamentals.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        print(f"Yahoo Finance research saved to {target}")
        metrics = data.get("profile_and_metrics", {})
        _render_table(["Field", "Yahoo value"], [[k, v] for k, v in metrics.items()])
        for key, value in data.items():
            if key.endswith("_error"):
                print(f"{key}: {value}")
        return 0
    except Exception as exc:
        print(f"RESEARCH UNAVAILABLE — {exc}", file=sys.stderr)
        return 1
    finally:
        store.close()


def cmd_options(settings: Settings, symbol: str) -> int:
    try:
        data = YahooResearch().options(symbol)
        target = settings.data_dir / "research" / f"{symbol.upper()}-options.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        print(f"Options data saved to {target}")
        print(data["note"])
        rows = []
        for chain in data.get("expirations", []):
            for kind in ("calls", "puts"):
                for option in chain.get(kind, [])[:10]:
                    rows.append([chain["expiration"], kind[:-1].upper(), option.get("strike"), option.get("bid"), option.get("ask"), option.get("lastPrice"), option.get("impliedVolatility"), option.get("openInterest")])
        _render_table(["Expiry", "Type", "Strike", "Bid", "Ask", "Last", "IV", "Open int."], rows)
        print("Options are research-only here. No option order can be submitted. Fractional option contracts are not supported by this simulator.")
        return 0
    except Exception as exc:
        print(f"OPTIONS UNAVAILABLE — {exc}", file=sys.stderr)
        return 1


def cmd_news(settings: Settings, query: str, reddit: bool = False) -> int:
    store = _store(settings)
    research = NewsResearch()
    try:
        items = research.reddit_oauth() if reddit else research.fetch(query)
        for item in items:
            item["sentiment"] = heuristic_sentiment(item.get("title", "") + " " + item.get("description", ""))
        added = store.save_news(items)
        rows = [[item.get("published", ""), item.get("source", ""), item.get("sentiment", "neutral"), item.get("title", ""), item.get("url", "")] for item in items]
        _render_table(["Published", "Source", "Tone*", "Headline", "Article"], rows)
        print(f"\nFetched {len(items)} article/post references; {added} new links stored. *Tone is a simple keyword triage label, not predictive sentiment.")
        return 0
    except Exception as exc:
        print(f"NEWS UNAVAILABLE — {exc}", file=sys.stderr)
        return 1
    finally:
        store.close()


def cmd_open(settings: Settings, symbol: str, amount: float, side: int) -> int:
    store, data = _store(settings), MarketDataRouter()
    try:
        result = PaperBroker(settings, store, data).open(symbol, amount, side=side)
        print(json.dumps(result, indent=2))
        print("Recorded in the local simulated ledger only. No broker or exchange order was sent.")
        return 0
    except Exception as exc:
        print(f"ORDER REJECTED — {exc}", file=sys.stderr)
        store.log("ORDER_REJECTED", str(exc), symbol)
        return 2
    finally:
        store.close()


def cmd_close(settings: Settings, symbol: str, force: bool = False) -> int:
    store, data = _store(settings), MarketDataRouter()
    broker = PaperBroker(settings, store, data)
    try:
        positions = [p for p in store.open_positions() if p["symbol"].upper() == symbol.upper()]
        if not positions:
            print(f"No open paper position for {symbol}")
            return 1
        for pos in positions:
            print(json.dumps(broker.close_position(int(pos["id"]), "manual paper close", allow_locked=force), indent=2))
        return 0
    except Exception as exc:
        print(f"CLOSE BLOCKED — {exc}", file=sys.stderr)
        return 2
    finally:
        store.close()


def cmd_watch(settings: Settings, interval: int, auto_paper: bool) -> int:
    store, data = _store(settings), MarketDataRouter()
    broker = PaperBroker(settings, store, data)
    enabled = auto_paper and settings.auto_paper_enabled
    if auto_paper and not settings.auto_paper_enabled:
        print("Auto-paper was requested, but WELP_AUTO_PAPER is not true. Set it in .env and restart to arm autonomous PAPER entries.")
    print(f"Watch loop running every {interval}s | auto-paper={'ON' if enabled else 'OFF'} | live orders=DISABLED | Ctrl+C to stop")
    try:
        while True:
            print(f"\n[{_time(time.time())}] Market scan")
            scan_once(settings, store, data, auto_paper=enabled)
            state = broker.manage()
            print(f"Paper equity {_money(state['equity'])}; cash {_money(state['cash'])}; exposure {_money(state['exposure'])}; drawdown {state['drawdown_pct']:.2f}%")
            if state.get("kill_switch"):
                print(f"KILL SWITCH LOCKED: {store.get_meta('kill_reason')}")
                print("New entries are disabled. Any positions without a fresh real quote remain open and are marked LIQUIDATION PENDING.")
            time.sleep(max(10, interval))
    except KeyboardInterrupt:
        print("\nWatch loop stopped. The local ledger remains saved.")
    finally:
        store.close()
    return 0


def cmd_dashboard(settings: Settings, interval: int) -> int:
    try:
        from rich.live import Live
        from rich.table import Table
        from rich.panel import Panel
        from rich.console import Group
        from rich.console import Console
    except ImportError:
        print("Install optional dashboard dependency with: pip install rich")
        return 2
    store, data = _store(settings), MarketDataRouter()
    broker = PaperBroker(settings, store, data)
    console = Console()
    try:
        with Live(console=console, refresh_per_second=1, screen=True) as live:
            while True:
                table = Table(title="WELP UP — GLOBAL MARKETS / REAL FEEDS / PAPER EXECUTION")
                for col in ("Symbol", "Price", "CCY", "Age", "Signal", "Score", "Source"):
                    table.add_column(col)
                for symbol in settings.watchlist:
                    try:
                        quote = data.quote(symbol)
                        store.save_quote(quote.to_dict())
                        bars = data.bars(symbol, 200)
                        store.save_bars(symbol, bars, quote.source)
                        signal = analyse(symbol, bars)
                        store.record_signal(signal, quote.source)
                        table.add_row(symbol, f"{quote.price:,.6g}", quote.currency, f"{quote.age_seconds/60:.1f}m", signal.action, f"{signal.score:.1f}", quote.source)
                    except Exception as exc:
                        table.add_row(symbol, "UNAVAILABLE", "", "", "NO SIGNAL", "—", str(exc)[:44])
                state = broker.manage()
                status = f"cash {_money(state['cash'])} | equity {_money(state['equity'])} | exposure {_money(state['exposure'])} | drawdown {state['drawdown_pct']:.2f}% | kill={'LOCKED' if store.get_meta('kill_switch')=='1' else 'clear'}"
                live.update(Group(Panel.fit("REAL PROVIDER DATA ONLY • PAPER FILLS ARE SIMULATED • LIVE TRADING DISABLED"), table, Panel(status)))
                time.sleep(max(10, interval))
    except KeyboardInterrupt:
        pass
    finally:
        store.close()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="welp-market", description="WELP UP global stocks + crypto market research and paper trading terminal")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="show paper account, positions and provider configuration")
    sub.add_parser("scan", help="fetch real watchlist market data and calculate rule signals")
    q = sub.add_parser("quote", help="fetch a real provider quote")
    q.add_argument("symbol")
    ch = sub.add_parser("chart", help="fetch real OHLCV history and draw a terminal sparkline")
    ch.add_argument("symbol")
    ch.add_argument("--limit", type=int, default=60)
    r = sub.add_parser("research", help="download Yahoo Finance company profile and statement data")
    r.add_argument("symbol")
    o = sub.add_parser("options", help="research Yahoo Finance calls and puts; no orders")
    o.add_argument("symbol")
    n = sub.add_parser("news", help="fetch article links from Marketaux (if configured) or GDELT")
    n.add_argument("query", nargs="?", default="stocks OR cryptocurrency OR bitcoin markets")
    n.add_argument("--reddit", action="store_true", help="use Reddit OAuth; requires approved API credentials")
    b = sub.add_parser("buy", help="open a long paper position")
    b.add_argument("symbol")
    b.add_argument("usd", type=float)
    s = sub.add_parser("short", help="open a short paper simulation; no broker borrow/locate")
    s.add_argument("symbol")
    s.add_argument("usd", type=float)
    c = sub.add_parser("close", help="close a paper position at a fresh provider quote")
    c.add_argument("symbol")
    c.add_argument("--force-paper-close", action="store_true")
    w = sub.add_parser("watch", help="run a persistent research/position-monitoring loop")
    w.add_argument("--interval", type=int, default=60)
    w.add_argument("--auto-paper", action="store_true", help="allow automatic PAPER entries only; also requires WELP_AUTO_PAPER=true")
    d = sub.add_parser("dashboard", help="live terminal dashboard (requires rich)")
    d.add_argument("--interval", type=int, default=30)
    reset = sub.add_parser("reset-paper", help="reset only the local paper ledger")
    reset.add_argument("--confirm", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    try:
        settings = Settings.from_env()
    except ValueError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 2
    args = build_parser().parse_args(argv)
    if args.command == "status":
        return cmd_status(settings)
    if args.command == "scan":
        return cmd_scan(settings)
    if args.command == "quote":
        return cmd_quote(settings, args.symbol)
    if args.command == "chart":
        return cmd_chart(settings, args.symbol, args.limit)
    if args.command == "research":
        return cmd_research(settings, args.symbol)
    if args.command == "options":
        return cmd_options(settings, args.symbol)
    if args.command == "news":
        return cmd_news(settings, args.query, args.reddit)
    if args.command == "buy":
        return cmd_open(settings, args.symbol, args.usd, 1)
    if args.command == "short":
        return cmd_open(settings, args.symbol, args.usd, -1)
    if args.command == "close":
        return cmd_close(settings, args.symbol, args.force_paper_close)
    if args.command == "watch":
        return cmd_watch(settings, args.interval, args.auto_paper)
    if args.command == "dashboard":
        return cmd_dashboard(settings, args.interval)
    if args.command == "reset-paper":
        if not args.confirm:
            print("No changes made. Rerun with --confirm to reset the local paper ledger.")
            return 2
        store = _store(settings)
        store.reset_paper(settings.initial_equity)
        store.close()
        print(f"Local paper ledger reset to {_money(settings.initial_equity)}. Market data and research history were retained.")
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
