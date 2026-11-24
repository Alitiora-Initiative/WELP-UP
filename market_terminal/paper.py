from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from .config import Settings
from .providers import MarketDataRouter, Quote
from .store import Store


class RiskRejected(RuntimeError):
    pass


def _fee_rate(asset_class: str) -> float:
    # Conservative modelling assumptions, not broker fee quotes.
    return 0.0025 if asset_class == "crypto" else 0.0010


def _slippage(asset_class: str) -> float:
    # Simulated adverse execution; never presented as an actual exchange fill.
    return 0.0015 if asset_class == "crypto" else 0.0010


def _utc_day_start() -> float:
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, now.day, tzinfo=timezone.utc).timestamp()


def _utc_week_start() -> float:
    now = datetime.now(timezone.utc)
    midnight = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    return midnight.timestamp() - now.weekday() * 86400


class PaperBroker:
    def __init__(self, settings: Settings, store: Store, data: MarketDataRouter) -> None:
        self.settings, self.store, self.data = settings, store, data

    def _fresh(self, quote: Quote) -> bool:
        max_age = self.settings.quote_max_age_crypto_seconds if quote.asset_class == "crypto" else self.settings.quote_max_age_stock_seconds
        return quote.age_seconds <= max_age

    def _quote(self, symbol: str) -> Quote:
        quote = self.data.quote(symbol)
        self.store.save_quote(quote.to_dict())
        if not quote.is_real_market_data:
            raise RiskRejected("Provider did not mark this as real market data; no paper fill allowed")
        if not self._fresh(quote):
            raise RiskRejected(f"Quote is stale ({quote.age_seconds/60:.1f} minutes old); refusing to simulate a fill")
        return quote

    def mark_equity(self, quotes: dict[str, Quote] | None = None) -> dict[str, float]:
        quotes = quotes or {}
        cash = self.store.cash()
        equity = cash
        exposure = 0.0
        for pos in self.store.open_positions():
            symbol = pos["symbol"]
            quote = quotes.get(symbol)
            fetched = quote is None
            if quote is None:
                try:
                    quote = self.data.quote(symbol)
                except Exception as exc:
                    self.store.log("MARK_UNAVAILABLE", f"No new price for {symbol}: {exc}", symbol)
                    quote = None
            if quote is not None and self._fresh(quote) and quote.is_real_market_data:
                mark = quote.price
                if fetched:
                    self.store.save_quote(quote.to_dict())
                self.store.update_mark(int(pos["id"]), mark)
            else:
                if quote is not None:
                    self.store.log(
                        "MARK_STALE",
                        f"Ignoring stale or unverified quote (age={quote.age_seconds:.1f}s, source={quote.source}); using last stored mark",
                        symbol,
                    )
                mark = float(pos["mark_price"])
            notional = float(pos["units"]) * mark
            exposure += notional
            if int(pos["side"]) == 1:
                equity += notional
            else:
                equity += float(pos["collateral"]) + (float(pos["entry_price"]) - mark) * float(pos["units"])
        initial = float(self.store.get_meta("initial_equity") or self.settings.initial_equity)
        high = max(float(self.store.get_meta("high_water_equity") or initial), equity)
        self.store.set_meta("high_water_equity", f"{high:.10f}")
        dd_initial = (initial - equity) / initial if initial else 0.0
        dd_high = (high - equity) / high if high else 0.0
        dd = max(0.0, dd_initial, dd_high)
        self.store.snapshot(cash, equity, exposure, dd * 100)
        return {"cash": cash, "equity": equity, "exposure": exposure, "drawdown_pct": dd * 100, "high_water": high, "initial": initial}

    def _check_kill_switch(self, state: dict[str, float]) -> bool:
        if self.store.get_meta("kill_switch") == "1":
            # Keep retrying any liquidation that was pending because a provider
            # had no fresh price during the initial kill-switch event.
            if self.store.open_positions():
                self.close_all(reason="persistent kill switch liquidation retry", allow_locked=True)
            return True
        threshold_initial = state["initial"] * (1 - self.settings.max_drawdown_pct)
        threshold_high = state["high_water"] * (1 - self.settings.max_drawdown_pct)
        if state["equity"] <= max(threshold_initial, threshold_high):
            reason = f"Account drawdown breached {self.settings.max_drawdown_pct:.0%} limit; equity=${state['equity']:.2f}"
            self.store.set_meta("kill_switch", "1")
            self.store.set_meta("kill_reason", reason)
            self.store.log("KILL_SWITCH", reason, data=state)
            self.close_all(reason="20% account drawdown kill switch", allow_locked=True)
            return True
        return False

    def open(self, symbol: str, notional: float, side: int = 1, note: str = "manual paper order") -> dict[str, Any]:
        symbol = symbol.upper()
        if side not in (1, -1):
            raise RiskRejected("Side must be +1 (long) or -1 (short)")
        if self.store.get_meta("kill_switch") == "1":
            raise RiskRejected("Kill switch is engaged; paper entries are locked")
        if notional < 1.0:
            raise RiskRejected("Minimum paper order is $1.00")
        quote = self._quote(symbol)
        state = self.mark_equity({symbol: quote})
        if self._check_kill_switch(state):
            raise RiskRejected("Kill switch engaged; no new positions")
        open_positions = self.store.open_positions()
        if len(open_positions) >= self.settings.max_positions:
            raise RiskRejected(f"Maximum {self.settings.max_positions} simultaneous positions")
        if any(p["symbol"] == symbol for p in open_positions):
            raise RiskRejected(f"A position in {symbol} is already open")
        if notional > self.settings.max_position_notional:
            raise RiskRejected(f"Per-position notional cap is ${self.settings.max_position_notional:.2f}")
        exposure = sum(float(p["units"]) * float(p["mark_price"]) for p in open_positions)
        if exposure + notional > self.settings.max_total_exposure:
            raise RiskRejected(f"Total exposure cap is ${self.settings.max_total_exposure:.2f}; already exposed ${exposure:.2f}")
        if notional * self.settings.stop_loss_pct > self.settings.risk_per_trade + 1e-9:
            raise RiskRejected(f"Planned stop risk exceeds ${self.settings.risk_per_trade:.2f} per trade")
        fee_rate, slip = _fee_rate(quote.asset_class), _slippage(quote.asset_class)
        fee = notional * fee_rate
        if self.store.cash() - notional - fee < self.settings.cash_reserve - 1e-8:
            raise RiskRejected(f"This order would breach the ${self.settings.cash_reserve:.2f} cash reserve")
        if self.store.trade_count_since(_utc_day_start()) >= self.settings.max_trades_day:
            raise RiskRejected(f"Daily entry limit ({self.settings.max_trades_day}) reached")
        if self.store.trade_count_since(_utc_week_start()) >= self.settings.max_trades_week:
            raise RiskRejected(f"Weekly entry limit ({self.settings.max_trades_week}) reached")
        fill = quote.price * (1 + slip if side == 1 else 1 - slip)
        units = notional / fill
        stop = fill * (1 - self.settings.stop_loss_pct if side == 1 else 1 + self.settings.stop_loss_pct)
        target = fill * (1 + self.settings.take_profit_pct if side == 1 else 1 - self.settings.take_profit_pct)
        collateral = notional if side == -1 else 0.0
        self.store.set_cash(self.store.cash() - notional - fee)
        pos_id = self.store.add_position({
            "symbol": symbol, "asset_class": quote.asset_class, "side": side, "units": units,
            "entry_price": fill, "mark_price": quote.price, "notional": notional,
            "collateral": collateral, "entry_fee": fee, "stop_price": stop,
            "take_profit_price": target, "opened_at": time.time(),
        })
        action = "BUY" if side == 1 else "SHORT"
        self.store.record_trade({"position_id": pos_id, "symbol": symbol, "action": action, "side": side, "units": units, "price": fill, "notional": notional, "fee": fee, "note": f"PAPER ONLY: {note}; reference quote {quote.price:.8g} from {quote.source}; simulated slippage={slip:.3%}"})
        self.store.log("PAPER_ENTRY", f"{action} {symbol} ${notional:.2f} at simulated ${fill:.6g}; data=${quote.price:.6g}", symbol, {"quote": quote.to_dict(), "simulated_fill": fill, "units": units, "fee": fee, "position_id": pos_id})
        return {"position_id": pos_id, "symbol": symbol, "action": action, "units": units, "reference_price": quote.price, "simulated_fill": fill, "fee": fee, "provider": quote.source}

    def close_position(self, position_id: int, reason: str = "manual paper close", allow_locked: bool = False) -> dict[str, Any]:
        pos = next((p for p in self.store.open_positions() if int(p["id"]) == position_id), None)
        if pos is None:
            raise RiskRejected(f"Open position {position_id} not found")
        if self.store.get_meta("kill_switch") == "1" and not allow_locked:
            raise RiskRejected("Kill switch is engaged; manual close needs --force-paper-close")
        quote = self._quote(pos["symbol"])
        side = int(pos["side"])
        slip = _slippage(pos["asset_class"])
        exit_fill = quote.price * (1 - slip if side == 1 else 1 + slip)
        units = float(pos["units"])
        exit_notional = units * exit_fill
        fee = exit_notional * _fee_rate(pos["asset_class"])
        if side == 1:
            pnl_before_fees = (exit_fill - float(pos["entry_price"])) * units
            cash_delta = exit_notional - fee
        else:
            pnl_before_fees = (float(pos["entry_price"]) - exit_fill) * units
            cash_delta = float(pos["collateral"]) + pnl_before_fees - fee
        total_pnl = pnl_before_fees - float(pos["entry_fee"]) - fee
        self.store.set_cash(self.store.cash() + cash_delta)
        self.store.close_position(position_id, exit_fill, total_pnl)
        action = "SELL" if side == 1 else "COVER"
        self.store.record_trade({"position_id": position_id, "symbol": pos["symbol"], "action": action, "side": side, "units": units, "price": exit_fill, "notional": exit_notional, "fee": fee, "pnl": total_pnl, "note": f"PAPER ONLY: {reason}; reference quote {quote.price:.8g} from {quote.source}; simulated slippage={slip:.3%}"})
        self.store.log("PAPER_EXIT", f"{action} {pos['symbol']} simulated ${exit_fill:.6g}; realised P&L ${total_pnl:.4f}", pos["symbol"], {"position_id": position_id, "quote": quote.to_dict(), "simulated_fill": exit_fill, "pnl": total_pnl, "reason": reason})
        return {"position_id": position_id, "symbol": pos["symbol"], "action": action, "simulated_fill": exit_fill, "pnl": total_pnl, "provider": quote.source}

    def close_all(self, reason: str, allow_locked: bool = False) -> list[dict[str, Any]]:
        results = []
        for pos in list(self.store.open_positions()):
            try:
                results.append(self.close_position(int(pos["id"]), reason=reason, allow_locked=allow_locked))
            except Exception as exc:
                self.store.log("LIQUIDATION_PENDING", f"Could not close {pos['symbol']}: {exc}; no synthetic price used", pos["symbol"])
        return results

    def manage(self) -> dict[str, Any]:
        checked: list[str] = []
        for pos in list(self.store.open_positions()):
            try:
                quote = self._quote(pos["symbol"])
            except Exception as exc:
                self.store.log("EXIT_CHECK_BLOCKED", f"{pos['symbol']}: {exc}", pos["symbol"])
                continue
            self.store.update_mark(int(pos["id"]), quote.price)
            side = int(pos["side"])
            stop_hit = quote.price <= float(pos["stop_price"]) if side == 1 else quote.price >= float(pos["stop_price"])
            target_hit = quote.price >= float(pos["take_profit_price"]) if side == 1 else quote.price <= float(pos["take_profit_price"])
            if stop_hit or target_hit:
                self.close_position(
                    int(pos["id"]),
                    "stop-loss" if stop_hit else "take-profit",
                    allow_locked=self.store.get_meta("kill_switch") == "1",
                )
            checked.append(pos["symbol"])
        state = self.mark_equity()
        locked = self._check_kill_switch(state)
        return {**state, "checked": checked, "kill_switch": locked}
