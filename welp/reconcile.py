"""Reconcile on-chain positions with ledger to catch orphans."""

from typing import Iterator

from welp.config import Settings
from welp.ledger import Ledger
from welp.rpc import sol_lamports, token_raw


def find_orphans(settings: Settings, owner: str, ledger: Ledger) -> Iterator[dict]:
    """
    Find positions that exist on-chain but not in the ledger.

    Returns iterator of dicts with mint, symbol, token_raw, and context.
    """
    # Get all ledger position mints
    ledger_mints = set()
    for row in ledger.conn.execute("SELECT mint FROM positions WHERE closed_at IS NULL").fetchall():
        ledger_mints.add(row["mint"])

    # Get on-chain token balances
    # This would need to fetch all token accounts for the owner
    # For now, we'll query known mints from the ledger and universe
    # In a full implementation, you'd get all token accounts via RPC

    # Check if any ledger-minted tokens have different on-chain balances
    for row in ledger.conn.execute("SELECT mint, symbol FROM positions").fetchall():
        mint = row["mint"]
        symbol = row["symbol"]
        chain_balance = token_raw(settings.rpc_url, owner, mint)

        # If on-chain has tokens but ledger says closed or doesn't have it
        if chain_balance > 0 and mint not in ledger_mints:
            yield {
                "mint": mint,
                "symbol": symbol,
                "token_raw": chain_balance,
                "context": "on-chain balance exists but ledger has no open position",
            }


def adopt_orphan(settings: Settings, owner: str, ledger: Ledger, orphan: dict) -> None:
    """
    Adopt an orphan position into the ledger.

    This adds the position with adopted=1 so the brain doesn't train on it.
    """
    mint = orphan["mint"]
    symbol = orphan["symbol"]
    token_raw = orphan["token_raw"]

    # Get current SOL price to estimate entry USD
    from welp.jupiter import Jupiter
    jupiter = Jupiter(settings.jupiter_api_key)
    sol_px = float(jupiter.price("So11111111111111111111111111111111111111112"))
    
    # Estimate SOL spent based on current price (not ideal but necessary for adoption)
    # In production, you'd want to reconstruct from transaction history
    sol_spent_estimate = int(token_raw)  # Rough estimate, will be refined
    
    # Estimate entry USD
    entry_usd_estimate = (sol_spent_estimate / 1e9) * sol_px

    ledger.conn.execute(
        """
        INSERT INTO positions (
            mint, symbol, kind, pool, decimals, token_raw,
            sol_spent_lamports, entry_usd, confidence, features,
            signature, adopted, opened_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            mint,
            symbol,
            "unknown",  # Kind unknown for adopted positions
            "unknown",  # Pool unknown
            9,  # Default decimals (will be corrected if we can fetch it)
            token_raw,
            sol_spent_estimate,
            entry_usd_estimate,
            0.0,  # Confidence unknown
            "{}",  # Empty features
            "adopted",  # Signature marker
            1,  # adopted flag
            None,  # opened_at unknown
        ),
    )
    ledger.conn.commit()


def reconcile(settings: Settings, owner: str, ledger: Ledger) -> int:
    """
    Run reconciliation and adopt any orphan positions.

    Returns the number of orphans adopted.
    """
    adopted_count = 0
    for orphan in find_orphans(settings, owner, ledger):
        print(f"ADOPTING orphan position: {orphan['symbol']} ({orphan['mint']})")
        adopt_orphan(settings, owner, ledger, orphan)
        adopted_count += 1

    if adopted_count > 0:
        print(f"RECONCILE: Adopted {adopted_count} orphan position(s)")
    else:
        print("RECONCILE: No orphan positions found")

    return adopted_count
