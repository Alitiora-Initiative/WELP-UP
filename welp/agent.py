from __future__ import annotations

import json
import time
from decimal import Decimal

from welp.analyze import Analysis, Snapshot, analyze, in_trade_band
from welp.brain import Brain
from welp.charts import PoolView, fetch_candles
from welp.config import SOL_MINT, Settings
from welp.jupiter import Jupiter, impact_percent, quote_edge_percent
from welp.ledger import Ledger
from welp.reconcile import adopt_orphan, find_orphans
from welp.risk import exit_reason, size_entry, sol_to_lamports
from welp.rpc import RpcError, confirm, dynamic_priority_fee, sol_lamports, stable_usd, token_raw
from welp.safety import mint_risk
from welp.wallet import sign_swap

COOLDOWN_LOSS_S = 2 * 3600
COOLDOWN_WIN_S = 30 * 60


def log(message: str) -> None:
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    print(f"{stamp} {message}", flush=True)


def _slippage(kind: str) -> int:
    return 40 if kind == "stock" else 150


def _hard_impact(kind: str) -> float:
    return 0.8 if kind == "stock" else 2.5


def _priority_fee(settings: Settings) -> int:
    if settings.priority_fee_lamports > 0:
        return settings.priority_fee_lamports
    return dynamic_priority_fee(settings.rpc_url)


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
        prices = jupiter.prices(mints)
        for row in positions:
            px = prices.get(row["mint"])
            if px is None or row["decimals"] <= 0:
                continue
            ui = Decimal(row["token_raw"]) / (Decimal(10) ** int(row["decimals"]))
            value = ui * Decimal(str(px))
            marked += value
            spent = Decimal(row["sol_spent_lamports"]) / Decimal(1_000_000_000)
            if spent > 0 and sol_px > 0:
                value_sol = value / sol_px
                marks[int(row["id"])] = float((value_sol - spent) / spent * 100)
    equity = sol * sol_px + stables + marked
    return {
        "sol": sol,
        "sol_raw": sol_raw,
        "sol_price": sol_px,
        "equity": equity,
        "marks": marks,
    }


def reconcile(settings: Settings, owner: str, ledger: Ledger, views: list[PoolView]) -> None:
    """Adopt on-chain balances with no ledger row so exits can manage them (issue #2)."""
    candidates = [
        {
            "mint": v.mint,
            "symbol": v.symbol,
            "kind": v.kind,
            "pool": v.pool,
            "decimals": v.decimals,
        }
        for v in views
    ]
    orphans = find_orphans(settings.rpc_url, owner, ledger, candidates)
    for item in orphans:
        pos_id = adopt_orphan(
            ledger,
            mint=item["mint"],
            symbol=item["symbol"],
            kind=item.get("kind") or "meme",
            pool=item.get("pool") or "",
            decimals=int(item.get("decimals") or 0),
            token_raw=int(item["token_raw"]),
        )
        ledger.decide(
            "adopt",
            f"orphan on-chain balance adopted id={pos_id}; not a trained entry",
            item["mint"],
            item["symbol"],
        )
        log(f"ADOPT {item['symbol']} mint={item['mint']} raw={item['token_raw']}")


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
        priority_fee_lamports=_priority_fee(settings),
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
        rescore = None
        try:
            candles = fetch_candles(row["pool"])
            view = PoolView(
                pool=row["pool"],
                mint=row["mint"],
                symbol=row["symbol"],
                name=row["symbol"],
                decimals=int(row["decimals"]),
                kind=row["kind"],
                liquidity_usd=0,
                volume_h24=0,
                change_m5=0,
                change_h1=0,
                age_hours=999,
                buy_ratio=None,
                quote_mint=SOL_MINT,
            )
            if len(candles) >= 30:
                view = PoolView(
                    pool=view.pool,
                    mint=view.mint,
                    symbol=view.symbol,
                    name=view.name,
                    decimals=view.decimals,
                    kind=view.kind,
                    liquidity_usd=250_000,
                    volume_h24=50_000,
                    change_m5=((candles[-1].close / candles[-2].close) - 1) * 100 if candles[-2].close else 0,
                    change_h1=((candles[-1].close / candles[max(0, len(candles) - 12)].close) - 1) * 100,
                    age_hours=48,
                    buy_ratio=None,
                    quote_mint=SOL_MINT,
                )
                rescore = analyze(_snapshot(view, candles, None, None)).rule_score
        except Exception as exc:
            log(f"EXIT-CHART {row['symbol']} skipped rescore: {exc}")
        if pnl is None and int(row["sol_spent_lamports"] or 0) == 0:
            pass
        elif pnl is None:
            ledger.decide("hold", "no mark yet", row["mint"], row["symbol"])
            continue
        reason = exit_reason(
            kind=row["kind"],
            pnl_pct=pnl if pnl is not None else 0.0,
            peak_pnl_pct=peak,
            age_hours=age_hours,
            rescore=rescore,
        )
        if reason is None and int(row["sol_spent_lamports"] or 0) == 0 and age_hours >= 48:
            reason = "max hold adopted orphan"
        if reason is None:
            if pnl is not None:
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
        if recorded <= 0 or abs(chain - recorded) / max(recorded, 1) > 0.02:
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
        features = json.loads(row["features_json"])
        if spent > 0:
            error = brain.learn(features, pnl_pct)
            brain.save(settings.data_dir / "brain.json")
        else:
            error = 0.0
        sol_px = float(state["sol_price"])
        ledger.close_position(
            int(row["id"]),
            status="closed",
            signature=result["signature"],
            sol_received_lamports=received,
            exit_usd=received / 1e9 * sol_px,
            pnl_pct=pnl_pct if spent else None,
            note=reason,
        )
        ledger.decide("exit", f"{reason} realized {pnl_pct:.2f}% learn_error {error:.3f}", row["mint"], row["symbol"], rescore)
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
        risk = mint_risk(settings.rpc_url, view.mint)
        if risk:
            ledger.decide("skip", risk, view.mint, view.symbol)
            log(f"SKIP {view.symbol} {risk}")
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
            probe = jupiter.order(SOL_MINT, view.mint, probe_raw, slippage_bps=_slippage(view.kind))
        except Exception as exc:
            ledger.decide("skip", f"jupiter probe failed: {exc}", view.mint, view.symbol)
            continue
        if int(probe.get("outAmount") or 0) <= 0:
            ledger.decide("skip", "jupiter returned an empty route", view.mint, view.symbol)
            continue
        impact = impact_percent(probe)
        edge = quote_edge_percent(probe)
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
                priority_fee_lamports=_priority_fee(settings),
            )
        except Exception as exc:
            ledger.decide("skip", f"live order failed: {exc}", view.mint, view.symbol, blended)
            continue
        live_impact = impact_percent(live)
        live_edge = quote_edge_percent(live)
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
            result = jupiter.execute(signed, live["requestId"])
        except Exception as exc:
            ledger.decide("entry-failed", str(exc), view.mint, view.symbol, final_score)
            log(f"ENTRY-FAILED {view.symbol} {exc}")
            continue
        if str(result.get("status") or "") != "Success" or not result.get("signature"):
            ledger.decide("entry-failed", f"execute {result.get('status')} {result.get('error')}", view.mint, view.symbol, final_score)
            log(f"ENTRY-FAILED {view.symbol} status={result.get('status')}")
            continue
        try:
            confirm(settings.rpc_url, result["signature"])
        except RpcError as exc:
            ledger.decide("unconfirmed", f"{exc}. Not opening a second order.", view.mint, view.symbol, final_score)
            log(f"UNCONFIRMED {view.symbol} {exc}")
            continue
        sol_after = sol_lamports(settings.rpc_url, owner)
        token_after = _poll_token(settings.rpc_url, owner, view.mint, token_before)
        got = token_after - token_before
        spent = sol_before - sol_after
        if got <= 0 or spent <= 0:
            ledger.decide(
                "unfilled",
                f"signature {result['signature']} confirmed but balance delta sol={spent} token={got}",
                view.mint,
                view.symbol,
                final_score,
            )
            log(f"UNFILLED {view.symbol} sig={result['signature']}")
            continue
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
    reconcile(settings, owner, ledger, views)
    state = account_state(settings, jupiter, owner, ledger)
    log(
        f"MARK pubkey={owner} sol={state['sol']:.6f} "
        f"px={state['sol_price']:.4f} equity=${state['equity']:.4f} "
        f"open={len(ledger.open_positions())} brain={brain.closed_trades}"
    )
    manage_exits(settings, jupiter, keypair, owner, ledger, brain, state)
    state = account_state(settings, jupiter, owner, ledger)
    consider_entries(settings, jupiter, keypair, owner, ledger, brain, state, views)
