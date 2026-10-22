"""LP lock / burn checks. Freeze authority stops a mint freeze; this stops a liquidity pull."""
from __future__ import annotations

from decimal import Decimal

BURN_ADDRESSES = frozenset({
    "1nc1nerator11111111111111111111111111111111",
})


def lp_safe_share(call, lp_mint: str, initial_lp: int, lockers: frozenset[str] = frozenset()) -> float:
    """Fraction of LP burned or held by a known locker. Fungible-LP pools only.

    CLMM/DLMM pools have no LP mint: treat those as unlocked unless the position
    NFT is held by a locker.
    """
    if initial_lp <= 0:
        return 0.0
    supply = int(call("getTokenSupply", [lp_mint])["value"]["amount"])
    safe = max(0, initial_lp - supply)  # a real Burn lowers supply
    for account in call("getTokenLargestAccounts", [lp_mint])["value"]:
        info = call("getAccountInfo", [account["address"], {"encoding": "jsonParsed"}])["value"]
        try:
            owner = info["data"]["parsed"]["info"]["owner"]
        except (KeyError, TypeError):
            continue
        if owner in BURN_ADDRESSES or owner in lockers:
            safe += int(account["amount"])
    return min(1.0, safe / initial_lp)


def size_multiplier(safe_share: float, age_hours: float) -> Decimal:
    """Scale size by LP safety. Never reject outright - partial locks are common."""
    if safe_share >= 0.90:
        return Decimal("1.00")
    if safe_share >= 0.50:
        return Decimal("0.60")
    if safe_share >= 0.20:
        return Decimal("0.35")
    if safe_share < 0.05 and age_hours < 24:
        return Decimal("0.15")
    return Decimal("0.25")
