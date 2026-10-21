"""Adopt on-chain token balances that have no open ledger row (issue #2)."""
from __future__ import annotations

import time
from typing import Any

from welp.rpc import token_raw


def find_orphans(rpc_url: str, owner: str, ledger, candidate_mints: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return mints with positive on-chain balance and no open ledger position."""
    orphans: list[dict[str, Any]] = []
    for item in candidate_mints:
        mint = item["mint"]
        if ledger.holding(mint):
            continue
        try:
            balance = token_raw(rpc_url, owner, mint)
        except Exception:
            continue
        if balance <= 0:
            continue
        orphans.append({**item, "token_raw": balance})
    return orphans


def adopt_orphan(ledger, *, mint: str, symbol: str, kind: str, pool: str, decimals: int, token_raw: int) -> int:
    """Open a ledger row marked adopted so manage_exits can sell it. No brain training label."""
    return ledger.open_position(
        mint=mint,
        symbol=symbol,
        kind=kind or "meme",
        pool=pool or "",
        decimals=decimals,
        token_raw=token_raw,
        sol_spent_lamports=0,
        entry_usd=0.0,
        confidence=0.0,
        features=[0.0] * 12,
        signature=f"adopted-{mint[:8]}-{int(time.time())}",
    )
