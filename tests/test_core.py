from __future__ import annotations

import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

from welp.analyze import Analysis, Snapshot, analyze, in_trade_band
from welp.brain import Brain
from welp.config import ConfigError, load_settings
from welp.indicators import Candle, ema, parse_ohlcv, rsi
from welp.risk import exit_reason, size_entry, sol_to_lamports


def _trend_candles(n: int = 40) -> list[Candle]:
    return _trend_candles_mult(1.004, n)


def _trend_candles_mult(mult: float, n: int = 40) -> list[Candle]:
    candles = []
    price = 1.0
    for i in range(n):
        if i % 5 == 4:
            price *= 0.997
        else:
            price *= mult
        candles.append(
            Candle(
                ts=1_700_000_000 + i * 300,
                open=price * 0.999,
                high=price * 1.002,
                low=price * 0.997,
                close=price,
                volume=100 + i * 2,
            )
        )
    return candles


class BandTests(unittest.TestCase):
    def test_window_is_closed_at_both_ends(self):
        self.assertFalse(in_trade_band(79.99)[0])
        self.assertTrue(in_trade_band(80)[0])
        self.assertTrue(in_trade_band(98)[0])
        self.assertFalse(in_trade_band(98.01)[0])
        self.assertFalse(in_trade_band(100)[0])


class SizeTests(unittest.TestCase):
    def test_floors(self):
        size, _ = size_entry(
            confidence=Decimal("80"),
            equity_usd=Decimal("0.50"),
            sol_balance=Decimal("0.01"),
            sol_price_usd=Decimal("100"),
            min_trade_sol=Decimal("0.001"),
            min_account_usd=Decimal("0.50"),
            max_trade_sol=Decimal("0.02"),
            fee_reserve_sol=Decimal("0.003"),
        )
        self.assertEqual(size, Decimal("0.001000000"))

        size, note = size_entry(
            confidence=Decimal("90"),
            equity_usd=Decimal("0.49"),
            sol_balance=Decimal("1"),
            sol_price_usd=Decimal("100"),
            min_trade_sol=Decimal("0.001"),
            min_account_usd=Decimal("0.50"),
            max_trade_sol=Decimal("0.02"),
            fee_reserve_sol=Decimal("0.003"),
        )
        self.assertEqual(size, Decimal("0"))
        self.assertIn("0.50", note)

        size, note = size_entry(
            confidence=Decimal("98"),
            equity_usd=Decimal("10"),
            sol_balance=Decimal("0.0035"),
            sol_price_usd=Decimal("100"),
            min_trade_sol=Decimal("0.001"),
            min_account_usd=Decimal("0.50"),
            max_trade_sol=Decimal("0.02"),
            fee_reserve_sol=Decimal("0.003"),
        )
        self.assertEqual(size, Decimal("0"))
        self.assertIn("0.001", note)

    def test_lamports_do_not_round_up_into_a_trade(self):
        self.assertEqual(sol_to_lamports(Decimal("0.001")), 1_000_000)
        self.assertLess(sol_to_lamports(Decimal("0.000999999")), 1_000_000)

    def test_high_confidence_can_size_up_but_not_past_the_cap(self):
        size, _ = size_entry(
            confidence=Decimal("98"),
            equity_usd=Decimal("100"),
            sol_balance=Decimal("1"),
            sol_price_usd=Decimal("100"),
            min_trade_sol=Decimal("0.001"),
            min_account_usd=Decimal("0.50"),
            max_trade_sol=Decimal("0.02"),
            fee_reserve_sol=Decimal("0.003"),
        )
        self.assertEqual(size, Decimal("0.020000000"))


class IndicatorTests(unittest.TestCase):
    def test_ohlcv_sorts_newest_first_payloads(self):
        candles = parse_ohlcv(
            [
                [300, 1, 2, 0.5, 1.5, 10],
                [100, 1, 1, 1, 1, 4],
                [200, 1, 1.2, 0.8, 1.1, 5],
            ]
        )
        self.assertEqual([c.ts for c in candles], [100, 200, 300])

    def test_rsi_rising_market_is_not_oversold(self):
        closes = [float(i) for i in range(1, 30)]
        value = rsi(closes, 14)
        self.assertIsNotNone(value)
        assert value is not None
        self.assertGreater(value, 70)

    def test_ema_tracks_the_series(self):
        values = ema([1, 2, 3, 4, 5], 3)
        self.assertEqual(len(values), 5)
        self.assertGreater(values[-1], values[0])


class AnalysisTests(unittest.TestCase):
    def test_short_history_cannot_trade(self):
        snap = Snapshot(
            kind="meme",
            candles=_trend_candles(10),
            liquidity_usd=100_000,
            volume_h24=50_000,
            change_m5=1,
            change_h1=3,
            age_hours=48,
        )
        result = analyze(snap)
        self.assertFalse(result.ready)
        self.assertEqual(result.rule_score, 0)

    def test_feature_vector_length_and_band(self):
        candles = _trend_candles_mult(1.002)
        snap = Snapshot(
            kind="meme",
            candles=candles,
            liquidity_usd=100_000,
            volume_h24=40_000,
            change_m5=1.2,
            change_h1=4,
            age_hours=30,
            buy_ratio=0.6,
            price_impact_pct=0.2,
            quote_edge_pct=-0.2,
        )
        result = analyze(snap)
        self.assertEqual(len(result.features), 12)
        self.assertTrue(result.ready)
        self.assertTrue(in_trade_band(result.rule_score)[0])
        perfect = analyze(
            Snapshot(
                kind="meme",
                candles=_trend_candles_mult(1.0015),
                liquidity_usd=100_000,
                volume_h24=40_000,
                change_m5=1.2,
                change_h1=4,
                age_hours=30,
                buy_ratio=0.6,
                price_impact_pct=0.2,
                quote_edge_pct=-0.2,
            )
        )
        self.assertFalse(in_trade_band(perfect.rule_score)[0])


class BrainTests(unittest.TestCase):
    def test_learning_only_moves_after_a_real_label(self):
        brain = Brain.fresh()
        features = [1.0] * 12
        before = brain.probability(features)
        brain.learn(features, pnl_pct=3.0)
        after_win = brain.probability(features)
        self.assertGreater(after_win, before)
        self.assertEqual(brain.closed_trades, 1)
        brain.learn(features, pnl_pct=-4.0)
        self.assertLess(brain.probability(features), after_win)

    def test_untrained_blend_stays_near_the_rule(self):
        brain = Brain.fresh()
        blended, _ = brain.blend(90.0, [0.0] * 11 + [1.0])
        self.assertGreater(blended, 80)
        self.assertLess(blended, 98)

    def test_round_trip_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "brain.json"
            brain = Brain.fresh()
            brain.learn([0.2] * 12, 2.0)
            brain.save(path)
            loaded = Brain.load(path)
            self.assertEqual(loaded.closed_trades, 1)
            self.assertEqual(loaded.weights, brain.weights)


class ExitTests(unittest.TestCase):
    def test_stops_and_trails(self):
        self.assertIsNone(exit_reason(kind="meme", pnl_pct=1, peak_pnl_pct=1, age_hours=0.2, rescore=70))
        self.assertIn("stop", exit_reason(kind="meme", pnl_pct=-8, peak_pnl_pct=0, age_hours=0.1, rescore=80) or "")
        self.assertIn("trail", exit_reason(kind="meme", pnl_pct=3, peak_pnl_pct=9, age_hours=0.4, rescore=80) or "")
        self.assertIn("max hold", exit_reason(kind="stock", pnl_pct=1, peak_pnl_pct=1, age_hours=49, rescore=80) or "")


class WalletTests(unittest.TestCase):
    def test_signs_a_versioned_transaction_locally(self):
        import base64
        import json

        from solders.hash import Hash
        from solders.keypair import Keypair
        from solders.message import MessageV0
        from solders.signature import Signature
        from solders.system_program import TransferParams, transfer
        from solders.transaction import VersionedTransaction

        from welp.wallet import load_keypair, sign_swap

        kp = Keypair()
        self.assertEqual(str(load_keypair(str(kp)).pubkey()), str(kp.pubkey()))
        self.assertEqual(str(load_keypair(json.dumps(list(bytes(kp)))).pubkey()), str(kp.pubkey()))
        ix = transfer(TransferParams(from_pubkey=kp.pubkey(), to_pubkey=kp.pubkey(), lamports=1))
        msg = MessageV0.try_compile(kp.pubkey(), [ix], [], Hash.default())
        unsigned = VersionedTransaction.populate(msg, [Signature.default()])
        signed = VersionedTransaction.from_bytes(
            base64.b64decode(sign_swap(base64.b64encode(bytes(unsigned)).decode(), kp))
        )
        self.assertNotEqual(bytes(signed.signatures[0]), bytes(Signature.default()))
    def test_floors_cannot_be_lowered(self):
        import os

        os.environ["WELP_MIN_TRADE_SOL"] = "0.0001"
        os.environ["WELP_ARM"] = "TRADE-LIVE"
        os.environ["SOLANA_PRIVATE_KEY"] = "not-used"
        with self.assertRaises(ConfigError):
            load_settings(require_arm=True, require_key=True)
        os.environ["WELP_MIN_TRADE_SOL"] = "0.001"
        os.environ["WELP_MIN_ACCOUNT_USD"] = "0.10"
        with self.assertRaises(ConfigError):
            load_settings(require_arm=True, require_key=True)
        os.environ["WELP_MIN_ACCOUNT_USD"] = "0.50"
        os.environ["WELP_SIMULATE"] = "1"
        with self.assertRaises(ConfigError):
            load_settings(require_arm=True, require_key=True)
        os.environ.pop("WELP_SIMULATE", None)
        os.environ.pop("WELP_MIN_TRADE_SOL", None)
        os.environ.pop("WELP_MIN_ACCOUNT_USD", None)
        os.environ.pop("WELP_ARM", None)
        os.environ.pop("SOLANA_PRIVATE_KEY", None)


if __name__ == "__main__":
    unittest.main()
