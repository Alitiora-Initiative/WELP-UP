from __future__ import annotations

import argparse
import fcntl
import os
import sys
import time
from pathlib import Path

from welp import NAME, __version__
from welp.agent import account_state, cycle, log
from welp.brain import Brain
from welp.config import ConfigError, load_settings
from welp.jupiter import Jupiter
from welp.ledger import Ledger
from welp.universe import load_universe
from welp.wallet import WalletError, load_keypair


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _brain_and_ledger(data_dir: Path) -> tuple[Brain, Ledger]:
    data_dir.mkdir(parents=True, exist_ok=True)
    return Brain.load(data_dir / "brain.json"), Ledger(data_dir / "ledger.sqlite")


def cmd_status(settings) -> int:
    brain, ledger = _brain_and_ledger(settings.data_dir)
    summary = ledger.summary()
    print(f"{NAME} {__version__}")
    print(f"armed={settings.armed} closed={summary['closed_count']} brain_trades={brain.closed_trades}")
    print(f"avg_closed_pnl_pct={summary['avg_closed_pnl_pct']}")
    if settings.private_key:
        try:
            owner = str(load_keypair(settings.private_key).pubkey())
            state = account_state(settings, Jupiter(settings.jupiter_api_key), owner, ledger)
            print(f"pubkey={owner}")
            print(f"sol={state['sol']:.6f} equity_usd={state['equity']:.4f} sol_usd={state['sol_price']:.4f}")
        except Exception as exc:
            print(f"balance unavailable: {exc}")
    for row in summary["open"]:
        print(
            f"OPEN {row['symbol']} {row['kind']} mint={row['mint']} "
            f"sol_in={row['sol_spent_lamports'] / 1e9:.6f} sig={row['entry_signature']}"
        )
    for row in ledger.recent_decisions(12):
        score = "" if row["score"] is None else f" score={row['score']:.2f}"
        print(f"DECIDE {row['action']}{score} {row['symbol'] or ''} {row['note']}")
    ledger.close()
    return 0


def cmd_universe(settings) -> int:
    jupiter = Jupiter(settings.jupiter_api_key)
    views = load_universe(jupiter, settings.data_dir)
    if not views:
        print("no pools returned")
        return 1
    for view in views:
        print(
            f"{view.kind:5} {view.symbol:12} liq=${view.liquidity_usd:,.0f} "
            f"h1={view.change_h1:.2f}% age={view.age_hours:.1f}h {view.mint}"
        )
    return 0


def _lock(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    handle = open(settings.data_dir / "welp.lock", "w")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit("another WELP UP! process holds data/welp.lock")
    return handle


def cmd_trade(settings, once: bool) -> int:
    if not settings.armed:
        raise SystemExit("refusing to trade: WELP_ARM is not TRADE-LIVE")
    try:
        keypair = load_keypair(settings.private_key)
    except WalletError as exc:
        raise SystemExit(str(exc))
    lock = _lock(settings)
    jupiter = Jupiter(settings.jupiter_api_key)
    brain, ledger = _brain_and_ledger(settings.data_dir)
    log(f"{NAME} {__version__} pubkey={keypair.pubkey()} min={settings.min_trade_sol} SOL floor=${settings.min_account_usd}")
    try:
        while True:
            try:
                views = load_universe(jupiter, settings.data_dir)
                cycle(settings, jupiter, keypair, ledger, brain, views)
            except KeyboardInterrupt:
                log("stopped")
                return 0
            except Exception as exc:
                log(f"CYCLE-ERROR {exc}")
                ledger.decide("cycle-error", str(exc))
            if once:
                return 0
            time.sleep(settings.loop_seconds)
    finally:
        ledger.close()
        fcntl.flock(lock, fcntl.LOCK_UN)
        lock.close()


def main(argv: list[str] | None = None) -> int:
    load_env_file(Path(".env"))
    parser = argparse.ArgumentParser(prog="welp", description="WELP UP! live Jupiter agent")
    parser.add_argument("command", choices=("run", "once", "status", "universe"))
    args = parser.parse_args(argv)
    trading = args.command in ("run", "once")
    try:
        settings = load_settings(require_arm=trading, require_key=trading or args.command == "status" and bool(os.environ.get("SOLANA_PRIVATE_KEY")))
    except ConfigError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    if args.command == "status":
        return cmd_status(settings)
    if args.command == "universe":
        return cmd_universe(settings)
    return cmd_trade(settings, once=args.command == "once")


if __name__ == "__main__":
    raise SystemExit(main())
