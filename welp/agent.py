from __future__ import annotations

import json
import time
from decimal import Decimal

from welp.analyze import Analysis, Snapshot, analyze, in_trade_band
from welp.brain import Brain
from welp.charts import PoolView, fetch_candles
from welp.config import MAX_PRICE_IMPACT_PCT, SOL_MINT, Settings
from welp.jupiter import Jupiter, impact_percent, quote_edge_percent
from welp.ledger import Ledger
from welp.risk import exit_reason, size_entry, sol_to_lamports
from welp.rpc import RpcError, confirm, sol_lamports, stable_usd, token_raw
from welp.reconcile import reconcile_pending_entries, reconcile_positions
from welp.safety import ensure_mint_safe
from welp.wallet import sign_swap

COOLDOWN_LOSS_S = 2 * 3600
COOLDOWN_WIN_S = 30 * 60


def log(message: str) -> None:
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    print(f"{stamp} {message}", flush=True)


def _slippage(kind: str) -> int:
    return 40 if kind == "stock" else 150


def _hard_impact(kind: str) -> float:
    return 0.8 if kind == "stock" else float(MAX_PRICE_IMPACT_PCT)


def _poll_token(url: str, owner: str, mint: str, before: int, timeout: float = 25.0) -> int:
    deadline = time.time() + timeout
    latest = before
    while time.time() < deadline:
        latest = token_raw(url, owner, mint)
        if latest != before:
            return latest
        time.sleep(1.5)
    return latest


def _snapshot(view: PoolView, candles, impact: float | None, edge: float | None) -> Snapshot:
    return Snapshot(
        kind=view.kind,
        candles=candles,
        liquidity_usd=view.liquidity_usd,
        volume_h24=view.volume_h24,
        change_m5=view.change_m5,
        change_h1=view.change_h1,
        age_hours=view.age_hours,
        buy_ratio=view.buy_ratio,
        price_impact_pct=impact,
        quote_edge_pct=edge,
    )


def _reconcile_now(settings: Settings, jupiter: Jupiter, owner: str, ledger: Ledger, views: list[PoolView]) -> tuple[bool, str | None]:
    try:
        return reconcile_positions(settings.rpc_url, jupiter, owner, ledger, views)
    except Exception as exc:
        return False, f"reconciliation failed: {exc}"


def _cooled(ledger: Ledger, mint: str) -> str | None:
    row = ledger.conn.execute(
        """
        SELECT pnl_pct, closed_at FROM positions
        WHERE mint = ? AND closed_at IS NOT NULL
        ORDER BY closed_at DESC LIMIT 1
        """,
        (mint,),
    ).fetchone()
    if not row or row["closed_at"] is None:
        return None
    age = time.time() - float(row["closed_at"])
    pnl = row["pnl_pct"]
    if pnl is not None and float(pnl) <= 0 and age < COOLDOWN_LOSS_S:
        return "cooldown after a losing close"
    if age < COOLDOWN_WIN_S:
        return "cooldown after a close"
    return None


def account_state(settings: Settings, jupiter: Jupiter, owner: str, ledger: Ledger) -> dict:
    sol_raw = sol_lamports(settings.rpc_url, owner)
    sol = Decimal(sol_raw) / Decimal(1_000_000_000)
    sol_px = Decimal(str(jupiter.price(SOL_MINT)))
    stables = Decimal(str(stable_usd(settings.rpc_url, owner)))
    positions = ledger.open_positions()
    marked = Decimal("0")
    marks: dict[int, float] = {}
    if positions:
        mints = [row["mint"] for row in positions]
        try:
            prices = jupiter.prices(mints)
        except Exception:
            prices = {}
        for row in positions:
            px = prices.get(row["mint"])
            if row["decimals"] <= 0:
                continue
            spent = Decimal(row["sol_spent_lamports"]) / Decimal(1_000_000_000)
            if px is not None:
                ui = Decimal(row["token_raw"]) / (Decimal(10) ** int(row["decimals"]))
                value = ui * Decimal(str(px))
                marked += value
                if spent > 0 and sol_px > 0:
                    value_sol = value / sol_px
                    marks[int(row["id"])] = float((value_sol - spent) / spent * 100)
                continue
            # Fall back to a current sell quote when the price API has no mark.
            try:
                order = jupiter.order(
                    row["mint"],
                    SOL_MINT,
                    int(row["token_raw"]),
                    slippage_bps=_slippage(str(row["kind"])),
                )
                value_sol = Decimal(int(order.get("outAmount") or 0)) / Decimal(1_000_000_000)
            except Exception:
                continue
            if value_sol > 0 and sol_px > 0:
                marked += value_sol * sol_px
                if spent > 0:
                    marks[int(row["id"])] = float((value_sol - spent) / spent * 100)
    equity = sol * sol_px + stables + marked
    return {
        "sol": sol,
        "sol_raw": sol_raw,
        "sol_price": sol_px,
        "equity": equity,
        "marks": marks,
    }


def _swap(
    settings: Settings,
    jupiter: Jupiter,
    keypair,
    owner: str,
    input_mint: str,
    output_mint: str,
    amount_raw: int,
    slippage_bps: int,
) -> dict:
    order = jupiter.order(
        input_mint,
        output_mint,
        amount_raw,
        taker=owner,
        slippage_bps=slippage_bps,
        priority_fee_lamports=settings.priority_fee_lamports,
    )
    if not order.get("transaction") or not order.get("requestId"):
        raise RuntimeError(f"Jupiter did not return a signable order: {order.get('errorMessage') or 'no transaction'}")
    signed = sign_swap(order["transaction"], keypair)
    result = jupiter.execute(signed, order["requestId"])
    status = str(result.get("status") or "")
    if status != "Success":
        raise RuntimeError(f"Jupiter execute {status or 'failed'}: {result.get('error') or result.get('code')}")
    signature = result.get("signature")
    if not signature:
        raise RuntimeError("Jupiter execute returned no signature")
    confirm(settings.rpc_url, signature)
    result["order"] = order
    return result


def manage_exits(settings: Settings, jupiter: Jupiter, keypair, owner: str, ledger: Ledger, brain: Brain, state: dict) -> None:
    for row in ledger.open_positions():
        pnl = state["marks"].get(int(row["id"]))
        peak = float(row["peak_pnl_pct"] or 0)
        if pnl is not None:
            peak = max(peak, pnl)
            ledger.mark_peak(int(row["id"]), peak)
        age_hours = (time.time() - float(row["opened_at"])) / 3600.0
        # Exit scores need a fresh, complete market snapshot. The legacy runner
        # only has stale entry data here, so score-based exits are disabled until
        # the same inputs can be fetched reliably; price and time exits remain.
        rescore = None
        if pnl is None:
            ledger.decide("hold", "no mark yet", row["mint"], row["symbol"])
            continue
        reason = exit_reason(
            kind=row["kind"],
            pnl_pct=pnl,
            peak_pnl_pct=peak,
            age_hours=age_hours,
            rescore=rescore,
        )
        if reason is None:
            ledger.decide("hold", f"mark {pnl:.2f}% peak {peak:.2f}%", row["mint"], row["symbol"], rescore)
            continue
        chain = token_raw(settings.rpc_url, owner, row["mint"])
        recorded = int(row["token_raw"])
        if chain == 0:
            ledger.close_position(
                int(row["id"]),
                status="missing",
                signature=None,
                sol_received_lamports=None,
                exit_usd=None,
                pnl_pct=None,
                note="on-chain balance is zero; not a learned close",
            )
            ledger.decide("missing", reason, row["mint"], row["symbol"], rescore)
            log(f"MISSING {row['symbol']} balance is zero. Not teaching the brain.")
            continue
        if recorded <= 0 or abs(chain - recorded) / recorded > 0.02:
            ledger.decide(
                "halt-exit",
                f"balance mismatch chain={chain} ledger={recorded}. Dedicated wallet required.",
                row["mint"],
                row["symbol"],
                rescore,
            )
            log(f"HALT {row['symbol']} balance mismatch. No sell sent.")
            continue
        sol_before = sol_lamports(settings.rpc_url, owner)
        try:
            result = _swap(
                settings,
                jupiter,
                keypair,
                owner,
                row["mint"],
                SOL_MINT,
                chain,
                _slippage(row["kind"]),
            )
        except Exception as exc:
            ledger.decide("exit-failed", f"{reason}: {exc}", row["mint"], row["symbol"], rescore)
            log(f"EXIT-FAILED {row['symbol']} {exc}")
            continue
        sol_after = sol_lamports(settings.rpc_url, owner)
        received = max(0, sol_after - sol_before)
        spent = int(row["sol_spent_lamports"])
        pnl_pct = ((received - spent) / spent * 100.0) if spent else 0.0
        adopted = bool(row["adopted"])
        if adopted:
            error_note = "adopted position; brain not trained"
        else:
            features = json.loads(row["features_json"])
            error = brain.learn(features, pnl_pct)
            brain.save(settings.data_dir / "brain.json")
            error_note = f"learn_error {error:.3f}"
        sol_px = float(state["sol_price"])
        ledger.close_position(
            int(row["id"]),
            status="closed",
            signature=result["signature"],
            sol_received_lamports=received,
            exit_usd=received / 1e9 * sol_px,
            pnl_pct=pnl_pct,
            note=reason,
        )
        ledger.decide("exit", f"{reason} realized {pnl_pct:.2f}% {error_note}", row["mint"], row["symbol"], rescore)
        log(f"EXIT {row['symbol']} {reason} pnl={pnl_pct:.2f}% sig={result['signature']}")


def consider_entries(
    settings: Settings,
    jupiter: Jupiter,
    keypair,
    owner: str,
    ledger: Ledger,
    brain: Brain,
    state: dict,
    views: list[PoolView],
) -> None:
    open_count = len(ledger.open_positions())
    if open_count >= settings.max_positions:
        ledger.decide("idle", f"{open_count} positions already open")
        return
    if state["equity"] < settings.min_account_usd:
        ledger.decide("idle", f"equity ${state['equity']:.2f} is below ${settings.min_account_usd}")
        log(f"IDLE equity ${float(state['equity']):.2f} below minimum")
        return
    screened: list[tuple[PoolView, Analysis, list]] = []
    for view in views:
        if ledger.holding(view.mint):
            continue
        if view.decimals <= 0:
            ledger.decide("skip", "missing decimals", view.mint, view.symbol)
            continue
        cooled = _cooled(ledger, view.mint)
        if cooled:
            ledger.decide("skip", cooled, view.mint, view.symbol)
            continue
        floor_liq = 40_000 if view.kind == "stock" else 12_000
        if view.liquidity_usd < floor_liq:
            ledger.decide("skip", f"liquidity ${view.liquidity_usd:.0f}", view.mint, view.symbol)
            continue
        try:
            candles = fetch_candles(view.pool)
        except Exception as exc:
            ledger.decide("skip", f"chart failed: {exc}", view.mint, view.symbol)
            continue
        first = analyze(_snapshot(view, candles, None, None))
        if not first.ready or first.rule_score < 74:
            ledger.decide("skip", "; ".join(first.notes) or "chart below screen", view.mint, view.symbol, first.rule_score)
            continue
        screened.append((view, first, candles))
        if len(screened) >= 3:
            break
    if not screened:
        ledger.decide("idle", "no chart cleared the pre-screen")
        log("IDLE no chart inside the pre-screen")
        return

    probe_raw = sol_to_lamports(settings.min_trade_sol)
    for view, _first, candles in screened:
        if len(ledger.open_positions()) >= settings.max_positions:
            return
        try:
            ensure_mint_safe(settings.rpc_url, view.mint)
        except Exception as exc:
            ledger.decide("skip", f"mint safety refused: {exc}", view.mint, view.symbol)
            continue
        try:
            probe = jupiter.order(SOL_MINT, view.mint, probe_raw, slippage_bps=_slippage(view.kind))
        except Exception as exc:
            ledger.decide("skip", f"jupiter probe failed: {exc}", view.mint, view.symbol)
            continue
        if int(probe.get("outAmount") or 0) <= 0:
            ledger.decide("skip", "jupiter returned an empty route", view.mint, view.symbol)
            continue
        impact = impact_percent(probe)
        edge = quote_edge_percent(probe)
        if impact is None:
            ledger.decide("skip", "Jupiter impact was unavailable", view.mint, view.symbol)
            continue
        if impact > _hard_impact(view.kind):
            ledger.decide("skip", f"impact {impact:.3f}% over the hard cap", view.mint, view.symbol)
            continue
        analysis = analyze(_snapshot(view, candles, impact, edge))
        blended, prob = brain.blend(analysis.rule_score, analysis.features)
        allowed, why = in_trade_band(blended, float(settings.confidence_floor), float(settings.confidence_ceiling))
        note = f"{why}; rule {analysis.rule_score:.1f}; p {prob:.2f}; " + "; ".join(analysis.notes)
        if not allowed:
            ledger.decide("skip", note, view.mint, view.symbol, blended)
            log(f"SKIP {view.symbol} {why}")
            continue
        confidence = Decimal(f"{blended:.4f}")
        size, size_note = size_entry(
            confidence=confidence,
            equity_usd=state["equity"],
            sol_balance=state["sol"],
            sol_price_usd=state["sol_price"],
            min_trade_sol=settings.min_trade_sol,
            min_account_usd=settings.min_account_usd,
            max_trade_sol=settings.max_trade_sol,
            fee_reserve_sol=settings.fee_reserve_sol,
            floor=settings.confidence_floor,
            ceiling=settings.confidence_ceiling,
        )
        if size < settings.min_trade_sol:
            ledger.decide("skip", size_note, view.mint, view.symbol, blended)
            log(f"SKIP {view.symbol} {size_note}")
            continue
        raw = sol_to_lamports(size)
        if raw < 1_000_000:
            ledger.decide("skip", "lamports fell below 0.001 SOL", view.mint, view.symbol, blended)
            continue
        sol_before = sol_lamports(settings.rpc_url, owner)
        token_before = token_raw(settings.rpc_url, owner, view.mint)
        try:
            live = jupiter.order(
                SOL_MINT,
                view.mint,
                raw,
                taker=owner,
                slippage_bps=_slippage(view.kind),
                priority_fee_lamports=settings.priority_fee_lamports,
            )
        except Exception as exc:
            ledger.decide("skip", f"live order failed: {exc}", view.mint, view.symbol, blended)
            continue
        live_impact = impact_percent(live)
        live_edge = quote_edge_percent(live)
        if live_impact is None:
            ledger.decide("skip", "live Jupiter impact was unavailable", view.mint, view.symbol)
            continue
        final = analyze(_snapshot(view, candles, live_impact, live_edge))
        final_score, final_p = brain.blend(final.rule_score, final.features)
        ok, final_why = in_trade_band(final_score, float(settings.confidence_floor), float(settings.confidence_ceiling))
        if not ok or live_impact > _hard_impact(view.kind):
            ledger.decide("skip", f"recheck refused: {final_why}; impact {live_impact:.3f}%", view.mint, view.symbol, final_score)
            log(f"SKIP {view.symbol} recheck {final_why}")
            continue
        if not live.get("transaction"):
            ledger.decide("skip", "order had no transaction", view.mint, view.symbol, final_score)
            continue
        try:
            signed = sign_swap(live["transaction"], keypair)
        except Exception as exc:
            ledger.decide("entry-failed", str(exc), view.mint, view.symbol, final_score)
            log(f"ENTRY-FAILED {view.symbol} {exc}")
            continue
        try:
            result = jupiter.execute(signed, live["requestId"])
        except Exception as exc:
            request_id = str(live.get("requestId") or f"{view.mint}:{time.time_ns()}")
            pending_key = f"execute-unknown:{request_id}"
            ledger.add_pending_entry(pending_key, view.mint, view.symbol, final_score)
            ledger.decide("entry-uncertain", f"execute response was ambiguous: {exc}", view.mint, view.symbol, final_score)
            ok, note = _reconcile_now(settings, jupiter, owner, ledger, views)
            log(f"ENTRY-UNCERTAIN {view.symbol}; reconciliation={'ok' if ok else note}")
            return
        if str(result.get("status") or "") != "Success" or not result.get("signature"):
            ledger.decide("entry-failed", f"execute {result.get('status')} {result.get('error')}", view.mint, view.symbol, final_score)
            log(f"ENTRY-FAILED {view.symbol} status={result.get('status')}")
            if result.get("signature") or str(result.get("status") or "") == "Success":
                signature = result.get("signature")
                if signature:
                    pending_key = str(signature)
                else:
                    request_id = live.get("requestId") or f"{view.mint}:{time.time_ns()}"
                    pending_key = f"execute-unknown:{request_id}"
                ledger.add_pending_entry(pending_key, view.mint, view.symbol, final_score)
                _reconcile_now(settings, jupiter, owner, ledger, views)
                return
            continue
        try:
            confirm(settings.rpc_url, result["signature"])
        except RpcError as exc:
            ledger.add_pending_entry(str(result["signature"]), view.mint, view.symbol, final_score)
            ledger.decide("unconfirmed", f"{exc}. Not opening a second order.", view.mint, view.symbol, final_score)
            log(f"UNCONFIRMED {view.symbol} {exc}")
            ok, note = _reconcile_now(settings, jupiter, owner, ledger, views)
            log(f"RECONCILE after unconfirmed: {'ok' if ok else note}")
            return
        try:
            sol_after = sol_lamports(settings.rpc_url, owner)
            token_after = _poll_token(settings.rpc_url, owner, view.mint, token_before)
        except Exception as exc:
            ledger.add_pending_entry(str(result["signature"]), view.mint, view.symbol, final_score)
            ledger.decide("unconfirmed-balance", f"could not read post-swap balances: {exc}", view.mint, view.symbol, final_score)
            ok, note = _reconcile_now(settings, jupiter, owner, ledger, views)
            log(f"RECONCILE after balance error: {'ok' if ok else note}")
            return
        got = token_after - token_before
        spent = sol_before - sol_after
        if got <= 0 or spent <= 0:
            ledger.add_pending_entry(str(result["signature"]), view.mint, view.symbol, final_score)
            ledger.decide(
                "unfilled",
                f"signature {result['signature']} confirmed but balance delta sol={spent} token={got}",
                view.mint,
                view.symbol,
                final_score,
            )
            log(f"UNFILLED {view.symbol} sig={result['signature']}")
            ok, note = _reconcile_now(settings, jupiter, owner, ledger, views)
            log(f"RECONCILE after unfilled: {'ok' if ok else note}")
            return
        entry_usd = float(spent) / 1e9 * float(state["sol_price"])
        ledger.open_position(
            mint=view.mint,
            symbol=view.symbol,
            kind=view.kind,
            pool=view.pool,
            decimals=view.decimals,
            token_raw=got,
            sol_spent_lamports=spent,
            entry_usd=entry_usd,
            confidence=float(final_score),
            features=final.features,
            signature=result["signature"],
        )
        ledger.decide("enter", f"{final_why}; size {size} SOL; p {final_p:.2f}", view.mint, view.symbol, final_score)
        log(
            f"ENTER {view.symbol} kind={view.kind} score={final_score:.2f} "
            f"size={size} SOL sig={result['signature']}"
        )
        state["sol"] = Decimal(sol_after) / Decimal(1_000_000_000)
        return


def cycle(settings: Settings, jupiter: Jupiter, keypair, ledger: Ledger, brain: Brain, views: list[PoolView]) -> None:
    owner = str(keypair.pubkey())
    try:
        reconciled, reconcile_note = reconcile_positions(settings.rpc_url, jupiter, owner, ledger, views)
    except Exception as exc:
        reconciled, reconcile_note = False, f"reconciliation failed: {exc}"
    pending_ok, pending_note = reconcile_pending_entries(settings.rpc_url, jupiter, owner, ledger, views)
    if not pending_ok:
        reconciled = False
        reconcile_note = "; ".join(filter(None, (reconcile_note, pending_note)))
    state = account_state(settings, jupiter, owner, ledger)
    log(
        f"MARK pubkey={owner} sol={state['sol']:.6f} "
        f"px={state['sol_price']:.4f} equity=${state['equity']:.4f} "
        f"open={len(ledger.open_positions())} brain={brain.closed_trades}"
    )
    manage_exits(settings, jupiter, keypair, owner, ledger, brain, state)
    # Refresh spendable SOL after any exit.
    state = account_state(settings, jupiter, owner, ledger)
    if not reconciled:
        note = reconcile_note or "on-chain balances could not be reconciled"
        ledger.decide("halt-reconcile", note)
        log(f"HALT reconciliation: {note}")
        return
    consider_entries(settings, jupiter, keypair, owner, ledger, brain, state, views)
