from __future__ import annotations

from decimal import Decimal, ROUND_DOWN

LAMPORTS = Decimal(1_000_000_000)


def sol_to_lamports(amount: Decimal) -> int:
    if amount <= 0:
        return 0
    return int((amount * LAMPORTS).to_integral_value(rounding=ROUND_DOWN))


def size_entry(
    *,
    confidence: Decimal,
    equity_usd: Decimal,
    sol_balance: Decimal,
    sol_price_usd: Decimal,
    min_trade_sol: Decimal,
    min_account_usd: Decimal,
    max_trade_sol: Decimal,
    fee_reserve_sol: Decimal,
    floor: Decimal = Decimal("80"),
    ceiling: Decimal = Decimal("98"),
) -> tuple[Decimal, str]:
    """Return (size_sol, reason). Size is 0 when the entry is refused."""
    if sol_price_usd <= 0:
        return Decimal("0"), "SOL price missing"
    if equity_usd < min_account_usd:
        return Decimal("0"), f"equity ${equity_usd:.2f} is below ${min_account_usd}"
    if confidence < floor or confidence > ceiling:
        return Decimal("0"), f"confidence {confidence} is outside {floor}-{ceiling}"
    spendable = sol_balance - fee_reserve_sol
    if spendable < min_trade_sol:
        return Decimal("0"), (
            f"spendable {spendable:.6f} SOL is below the {min_trade_sol} SOL minimum "
            f"after the {fee_reserve_sol} SOL fee reserve"
        )
    high = min(max_trade_sol, spendable)
    if high < min_trade_sol:
        return Decimal("0"), "cap is below the minimum trade"
    span = ceiling - floor
    if span <= 0:
        return Decimal("0"), "confidence window is empty"
    t = (confidence - floor) / span
    size = min_trade_sol + t * (high - min_trade_sol)
    size = min(size, spendable, max_trade_sol)
    # Never round a sub-minimum up into a live order.
    if size < min_trade_sol:
        return Decimal("0"), "sized below the 0.001 SOL floor"
    return size.quantize(Decimal("0.000000001"), rounding=ROUND_DOWN), "sized"


def exit_reason(
    *,
    kind: str,
    pnl_pct: float,
    peak_pnl_pct: float,
    age_hours: float,
    rescore: float | None,
) -> str | None:
    stop = -5.0 if kind == "stock" else -8.0
    take = 8.0 if kind == "stock" else 15.0
    arm = 4.0 if kind == "stock" else 8.0
    giveback = 2.0 if kind == "stock" else 4.0
    max_hours = 48.0 if kind == "stock" else 6.0
    if pnl_pct <= stop:
        return f"stop {pnl_pct:.2f}%"
    if pnl_pct >= take:
        return f"take-profit {pnl_pct:.2f}%"
    if peak_pnl_pct >= arm and pnl_pct <= peak_pnl_pct - giveback:
        return f"trail {pnl_pct:.2f}% from peak {peak_pnl_pct:.2f}%"
    if age_hours >= max_hours:
        return f"max hold {age_hours:.2f}h"
    if rescore is not None and rescore < 40:
        return f"score collapsed to {rescore:.1f}"
    if rescore is not None and rescore < 55 and pnl_pct > 0:
        return f"score left the tape at {rescore:.1f} while green"
    return None
