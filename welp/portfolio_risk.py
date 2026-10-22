"""Account-level risk backstops. Per-trade sizing lives in risk.py; this is the portfolio layer."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class PortfolioLimits:
    daily_loss_pct: Decimal = Decimal("6")
    consecutive_losses: int = 4
    max_drawdown_pct: Decimal = Decimal("20")


def _pct(numerator: Decimal, denominator: Decimal) -> Decimal:
    if denominator <= 0:
        return Decimal("0")
    return numerator / denominator * Decimal("100")


def consecutive_loss_streak(pnls_desc: list[Decimal]) -> int:
    """Most recent closes first."""
    streak = 0
    for pnl in pnls_desc:
        if pnl < 0:
            streak += 1
        else:
            break
    return streak


def check(
    limits: PortfolioLimits,
    *,
    realized_today_usd: Decimal,
    start_equity_usd: Decimal,
    recent_pnls_desc: list[Decimal],
    equity_usd: Decimal,
    watermark_usd: Decimal,
) -> str | None:
    """Return a halt reason, or None to keep trading. Fails closed."""
    if start_equity_usd > 0:
        day = _pct(realized_today_usd, start_equity_usd)
        if day <= -limits.daily_loss_pct:
            return f"daily loss {day:.2f}% breached -{limits.daily_loss_pct}%"
    streak = consecutive_loss_streak(recent_pnls_desc)
    if streak >= limits.consecutive_losses:
        return f"{streak} consecutive losses"
    if watermark_usd > 0:
        drawdown = _pct(watermark_usd - equity_usd, watermark_usd)
        if drawdown >= limits.max_drawdown_pct:
            return f"drawdown {drawdown:.2f}% from watermark"
    return None
