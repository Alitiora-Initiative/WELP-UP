from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "SPY", "BTC-USDT", "ETH-USDT", "SOL-USDT"]


def load_dotenv(path: Path = Path(".env")) -> None:
    """Small .env reader; never overrides values already present in the process."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        value = float(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number") from exc
    if value < 0:
        raise ValueError(f"{name} cannot be negative")
    return value


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    database: Path
    initial_equity: float = 10.0
    cash_reserve: float = 6.0
    max_total_exposure: float = 4.0
    max_position_notional: float = 2.0
    max_positions: int = 2
    risk_per_trade: float = 0.05
    stop_loss_pct: float = 0.025
    take_profit_pct: float = 0.05
    max_drawdown_pct: float = 0.20
    max_trades_day: int = 2
    max_trades_week: int = 6
    quote_max_age_stock_seconds: int = 20 * 60
    quote_max_age_crypto_seconds: int = 3 * 60
    watchlist: tuple[str, ...] = tuple(DEFAULT_WATCHLIST)
    auto_paper_enabled: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        data_dir = Path(os.getenv("WELP_MARKET_DATA_DIR", str(Path.home() / ".welp-market-terminal"))).expanduser()
        watchlist = tuple(x.strip().upper() for x in os.getenv("WELP_MARKET_WATCHLIST", ",".join(DEFAULT_WATCHLIST)).split(",") if x.strip())
        initial = _float("WELP_PAPER_EQUITY", 10.0)
        reserve = _float("WELP_PAPER_RESERVE", 6.0)
        exposure = _float("WELP_PAPER_MAX_EXPOSURE", 4.0)
        if initial <= 0 or reserve >= initial or exposure > initial - reserve:
            raise ValueError("Paper limits invalid: reserve must be below initial equity and max exposure <= equity - reserve")
        max_positions = int(os.getenv("WELP_PAPER_MAX_POSITIONS", "2"))
        if max_positions < 1 or max_positions > 2:
            raise ValueError("WELP_PAPER_MAX_POSITIONS must be 1 or 2 for the $10 paper portfolio")
        return cls(
            data_dir=data_dir,
            database=data_dir / "market_terminal.sqlite3",
            initial_equity=initial,
            cash_reserve=reserve,
            max_total_exposure=exposure,
            max_position_notional=_float("WELP_PAPER_MAX_POSITION", 2.0),
            max_positions=max_positions,
            risk_per_trade=_float("WELP_PAPER_RISK_PER_TRADE", 0.05),
            stop_loss_pct=_float("WELP_PAPER_STOP_PCT", 0.025),
            take_profit_pct=_float("WELP_PAPER_TAKE_PROFIT_PCT", 0.05),
            max_drawdown_pct=_float("WELP_PAPER_MAX_DRAWDOWN", 0.20),
            max_trades_day=int(os.getenv("WELP_PAPER_MAX_TRADES_DAY", "2")),
            max_trades_week=int(os.getenv("WELP_PAPER_MAX_TRADES_WEEK", "6")),
            quote_max_age_stock_seconds=int(os.getenv("WELP_STOCK_MAX_QUOTE_AGE", "1200")),
            quote_max_age_crypto_seconds=int(os.getenv("WELP_CRYPTO_MAX_QUOTE_AGE", "180")),
            watchlist=watchlist,
            auto_paper_enabled=os.getenv("WELP_AUTO_PAPER", "false").lower() in {"1", "true", "yes"},
        )
