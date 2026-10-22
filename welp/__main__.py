from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from welp import NAME, __version__
from welp.brain import Brain
from welp.config import ConfigError, load_settings
from welp.jupiter import Jupiter
from welp.ledger import Ledger
from welp.universe import load_universe


_IGNORED_ENV = {
    "SOLANA_PRIVATE_KEY",
    "PRIVATE_KEY",
    "SECRET_KEY",
    "WALLET_PRIVATE_KEY",
    "SEED_PHRASE",
    "MNEMONIC",
}


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        name = key.strip()
        if name in _IGNORED_ENV:
            continue
        os.environ.setdefault(name, value.strip().strip('"').strip("'"))


def _brain_and_ledger(data_dir: Path) -> tuple[Brain, Ledger]:
    data_dir.mkdir(parents=True, exist_ok=True)
    return Brain.load(data_dir / "brain.json"), Ledger(data_dir / "ledger.sqlite")


def cmd_status(settings) -> int:
    brain, ledger = _brain_and_ledger(settings.data_dir)
    summary = ledger.summary()
    print(f"{NAME} {__version__}")
    print(f"armed={settings.armed} closed={summary['closed_count']} brain_trades={brain.closed_trades}")
    print(f"avg_closed_pnl_pct={summary['avg_closed_pnl_pct']}")
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


def cmd_trade(settings, once: bool) -> int:
    del settings, once
    raise SystemExit("Trading from this process is disabled. Swaps run only after a wallet connects on the website.")


def main(argv: list[str] | None = None) -> int:
    load_env_file(Path(".env"))
    parser = argparse.ArgumentParser(prog="welp", description="WELP UP! live Jupiter agent")
    parser.add_argument("command", choices=("run", "once", "status", "universe"))
    args = parser.parse_args(argv)
    trading = args.command in ("run", "once")
    try:
        settings = load_settings(require_arm=trading)
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
