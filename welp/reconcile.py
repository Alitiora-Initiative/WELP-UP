from __future__ import annotations

from decimal import Decimal

from welp.analyze import FEATURE_NAMES
from welp.charts import PoolView, token_top_pool
from welp.config import SOL_MINT
from welp.jupiter import Jupiter
from welp.ledger import Ledger
from welp.rpc import signature_status, token_balances


def reconcile_positions(
    rpc_url: str,
    jupiter: Jupiter,
    owner: str,
    ledger: Ledger,
    views: list[PoolView],
) -> tuple[bool, str | None]:
    """Adopt priced on-chain orphans and halt entries when balances are ambiguous."""
    balances = token_balances(rpc_url, owner)
    open_rows = ledger.open_positions()
    open_by_mint = {str(row["mint"]): row for row in open_rows}
    reasons: list[str] = []

    for mint, row in open_by_mint.items():
        chain_amount = int((balances.get(mint) or {}).get("amount", 0))
        recorded = int(row["token_raw"])
        if chain_amount == 0:
            note = "reconciliation found no on-chain tokens; no training label recorded"
            ledger.close_position(
                int(row["id"]),
                status="missing",
                signature=None,
                sol_received_lamports=None,
                exit_usd=None,
                pnl_pct=None,
                note=note,
            )
            ledger.decide("missing", note, mint, str(row["symbol"]))
        elif recorded <= 0 or abs(chain_amount - recorded) / recorded > 0.02:
            note = f"balance mismatch chain={chain_amount} ledger={recorded}; entries halted"
            ledger.decide("halt-reconcile", note, mint, str(row["symbol"]))
            reasons.append(note)

    active_mints = {str(row["mint"]) for row in ledger.open_positions()}
    orphan_mints = [mint for mint in balances if mint not in active_mints]
    if not orphan_mints:
        return not reasons, "; ".join(reasons) if reasons else None

    try:
        sol_price = float(jupiter.price(SOL_MINT))
    except Exception as exc:
        return False, f"could not value untracked token balances: {exc}"
    if not Decimal(str(sol_price)).is_finite() or sol_price <= 0:
        return False, "SOL price is unavailable while reconciling token balances"

    view_by_mint = {view.mint: view for view in views}
    for mint in orphan_mints:
        info = balances[mint]
        amount = int(info["amount"])
        decimals = int(info["decimals"])
        if decimals <= 0:
            note = f"untracked token {mint} has invalid decimals; entries halted"
            ledger.decide("halt-reconcile", note, mint, mint[:8])
            reasons.append(note)
            continue

        try:
            sell_quote = jupiter.order(mint, SOL_MINT, amount)
            sell_out_lamports = int(sell_quote.get("outAmount") or 0)
        except Exception as exc:
            note = f"untracked token {mint} has no sell quote ({exc}); entries halted"
            ledger.decide("halt-reconcile", note, mint, mint[:8])
            reasons.append(note)
            continue
        if sell_out_lamports <= 0:
            note = f"untracked token {mint} has no executable sell quote; entries halted"
            ledger.decide("halt-reconcile", note, mint, mint[:8])
            reasons.append(note)
            continue

        view = view_by_mint.get(mint)
        if view is None:
            try:
                view = token_top_pool(mint, "meme")
            except Exception:
                view = None
        basis_lamports = sell_out_lamports
        marked_usd = Decimal(sell_out_lamports) / Decimal(1_000_000_000) * Decimal(str(sol_price))
        if basis_lamports <= 0:
            note = f"untracked token {mint} has no usable SOL mark; entries halted"
            ledger.decide("halt-reconcile", note, mint, mint[:8])
            reasons.append(note)
            continue

        ledger.open_position(
            mint=mint,
            symbol=view.symbol if view else mint[:8],
            kind=view.kind if view else "meme",
            pool=view.pool if view else "",
            decimals=decimals,
            token_raw=amount,
            sol_spent_lamports=basis_lamports,
            entry_usd=float(marked_usd),
            confidence=0.0,
            features=[0.0] * len(FEATURE_NAMES),
            signature="reconciled",
            adopted=True,
        )
        note = "adopted on-chain balance at current mark; excluded from brain training"
        ledger.decide("adopted", note, mint, view.symbol if view else mint[:8])

    return not reasons, "; ".join(reasons) if reasons else None


def reconcile_pending_entries(
    rpc_url: str,
    jupiter: Jupiter,
    owner: str,
    ledger: Ledger,
    views: list[PoolView],
) -> tuple[bool, str | None]:
    """Keep new buys disabled until ambiguous swap outcomes are resolved."""
    for pending in ledger.pending_entries():
        request_id = str(pending["request_id"])
        if request_id.startswith("execute-unknown:"):
            return False, f"Jupiter execute outcome for {pending['symbol']} is unknown; manual review is required"
        try:
            status, error = signature_status(rpc_url, request_id)
        except Exception as exc:
            return False, f"could not resolve pending entry {pending['symbol']}: {exc}"
        if status == "failed":
            ledger.resolve_pending_entry(request_id)
            ledger.decide("entry-failed", f"pending transaction failed on-chain: {error}", str(pending["mint"]), str(pending["symbol"]))
            continue
        if status not in ("confirmed", "finalized"):
            return False, f"entry transaction for {pending['symbol']} is still {status or 'unknown'}"

        try:
            ok, note = reconcile_positions(rpc_url, jupiter, owner, ledger, views)
        except Exception as exc:
            return False, f"could not reconcile confirmed entry for {pending['symbol']}: {exc}"
        if not ok:
            return False, note or f"could not reconcile confirmed entry for {pending['symbol']}"
        if not ledger.holding(str(pending["mint"])):
            return False, f"confirmed entry for {pending['symbol']} has no reconciled token balance"
        ledger.resolve_pending_entry(request_id)
    return True, None
