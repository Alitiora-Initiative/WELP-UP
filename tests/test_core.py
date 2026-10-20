from __future__ import annotations

import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

from welp.analyze import Analysis, Snapshot, analyze, in_trade_band
from welp.brain import Brain
from welp.config import ConfigError, load_settings
from welp.indicators import Candle, ema, parse_ohlcv, rsi
from welp.jupiter import impact_percent
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

    def test_unverified_stock_tokens_are_excluded_from_meme_pools(self):
        from welp.charts import parse_pool_row
        from welp.config import SOL_MINT

        row = {
            "attributes": {"address": "pool"},
            "relationships": {
                "base_token": {"data": {"id": "base"}},
                "quote_token": {"data": {"id": "quote"}},
            },
        }
        included = {
            "base": {"attributes": {"address": "mint", "name": "Tesla", "symbol": "TSLAx", "decimals": 6}},
            "quote": {"attributes": {"address": SOL_MINT, "name": "Wrapped SOL", "symbol": "SOL", "decimals": 9}},
        }
        self.assertIsNone(parse_pool_row(row, included))


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
        blended, _ = brain.blend(80.0, [0.0] * 11 + [1.0])
        self.assertEqual(blended, 80.0)

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

    def test_rejects_a_keypair_that_is_not_a_required_signer(self):
        import base64

        from solders.hash import Hash
        from solders.keypair import Keypair
        from solders.message import MessageV0
        from solders.signature import Signature
        from solders.system_program import TransferParams, transfer
        from solders.transaction import VersionedTransaction

        from welp.wallet import WalletError, sign_swap

        payer = Keypair()
        stranger = Keypair()
        ix = transfer(TransferParams(from_pubkey=payer.pubkey(), to_pubkey=payer.pubkey(), lamports=1))
        message = MessageV0.try_compile(payer.pubkey(), [ix], [], Hash.default())
        unsigned = VersionedTransaction.populate(message, [Signature.default()])
        encoded = base64.b64encode(bytes(unsigned)).decode()
        with self.assertRaises(WalletError):
            sign_swap(encoded, stranger)

    def test_rejects_transactions_with_multiple_required_signers(self):
        import base64

        from solders.hash import Hash
        from solders.keypair import Keypair
        from solders.message import MessageV0
        from solders.signature import Signature
        from solders.system_program import TransferParams, transfer
        from solders.transaction import VersionedTransaction

        from welp.wallet import WalletError, sign_swap

        first = Keypair()
        second = Keypair()
        instructions = [
            transfer(TransferParams(from_pubkey=first.pubkey(), to_pubkey=second.pubkey(), lamports=1)),
            transfer(TransferParams(from_pubkey=second.pubkey(), to_pubkey=first.pubkey(), lamports=1)),
        ]
        message = MessageV0.try_compile(first.pubkey(), instructions, [], Hash.default())
        unsigned = VersionedTransaction.populate(message, [Signature.default(), Signature.default()])
        encoded = base64.b64encode(bytes(unsigned)).decode()
        with self.assertRaises(WalletError):
            sign_swap(encoded, first)


class SafetyTests(unittest.TestCase):
    def test_classic_mint_without_freeze_authority_is_accepted(self):
        from welp.safety import TOKEN_PROGRAM_ID, validate_mint_account

        raw = bytearray(82)
        raw[45] = 1
        validate_mint_account(TOKEN_PROGRAM_ID, bytes(raw))

    def test_live_freeze_authority_and_token_2022_are_rejected(self):
        from welp.safety import MintRiskError, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, validate_mint_account

        raw = bytearray(82)
        raw[45] = 1
        raw[46:50] = (1).to_bytes(4, "little")
        with self.assertRaises(MintRiskError):
            validate_mint_account(TOKEN_PROGRAM_ID, bytes(raw))
        with self.assertRaises(MintRiskError):
            validate_mint_account(TOKEN_2022_PROGRAM_ID, bytes(raw))


class JupiterImpactTests(unittest.TestCase):
    def test_impact_units_are_selected_by_field_name_not_magnitude(self):
        self.assertEqual(impact_percent({"priceImpact": "0.5"}), 0.5)
        self.assertEqual(impact_percent({"priceImpactPct": "0.005"}), 0.5)
        self.assertEqual(impact_percent({"priceImpactPct": "0.5"}), 50.0)
        self.assertIsNone(impact_percent({}))


class LimitContractTests(unittest.TestCase):
    def test_documented_trade_limits_match_runner_defaults(self):
        import re

        from welp.config import (
            CONFIDENCE_CEILING,
            CONFIDENCE_FLOOR,
            FEE_RESERVE_SOL,
            MAX_PRICE_IMPACT_PCT,
            MAX_TRADE_SOL,
            MIN_ACCOUNT_USD,
            MIN_TRADE_SOL,
        )

        rows = {}
        for line in Path("LIMITS.md").read_text(encoding="utf-8").splitlines():
            match = re.match(r"^\|\s*(.*?)\s*\|\s*(.*?)\s*\|$", line)
            if match:
                rows[match.group(1)] = match.group(2)
        self.assertEqual(rows["Buy input default"], f"{MIN_TRADE_SOL} SOL")
        self.assertEqual(rows["Minimum buy"], f"{MIN_TRADE_SOL} SOL")
        self.assertEqual(rows["Maximum buy"], f"{MAX_TRADE_SOL} SOL")
        self.assertEqual(rows["Minimum estimated wallet equity to quote"], f"${MIN_ACCOUNT_USD:.2f}")
        self.assertEqual(rows["SOL fee reserve check"], f"{FEE_RESERVE_SOL} SOL")
        self.assertEqual(rows["Maximum quoted buy price impact"], f"{MAX_PRICE_IMPACT_PCT}%")
        self.assertEqual(rows["Entry signal score"], f"{CONFIDENCE_FLOOR}–{CONFIDENCE_CEILING} inclusive")


class PriorityFeeTests(unittest.TestCase):
    def test_default_fee_is_nonzero_and_setting_is_bounded(self):
        import os
        from unittest.mock import patch

        from welp.config import DEFAULT_PRIORITY_FEE_LAMPORTS, MAX_PRIORITY_FEE_LAMPORTS

        with patch.dict(os.environ, {}, clear=True):
            settings = load_settings(require_arm=False, require_key=False)
        self.assertEqual(settings.priority_fee_lamports, DEFAULT_PRIORITY_FEE_LAMPORTS)
        self.assertGreater(settings.priority_fee_lamports, 0)
        with patch.dict(os.environ, {"WELP_PRIORITY_FEE_LAMPORTS": str(MAX_PRIORITY_FEE_LAMPORTS + 1)}, clear=True):
            with self.assertRaises(ConfigError):
                load_settings(require_arm=False, require_key=False)


class ReconcileTests(unittest.TestCase):
    class Prices:
        def price(self, mint):
            return 100.0

        def order(self, input_mint, output_mint, amount):
            return {"outAmount": "20000000"}

    def test_priced_orphan_is_adopted_without_an_entry_thesis(self):
        from unittest.mock import patch

        from welp.ledger import Ledger
        from welp.reconcile import reconcile_positions

        with tempfile.TemporaryDirectory() as tmp:
            ledger = Ledger(Path(tmp) / "ledger.db")
            with patch("welp.reconcile.token_balances", return_value={"orphan-mint": {"amount": 1_000_000, "decimals": 6}}), patch(
                "welp.reconcile.token_top_pool", return_value=None
            ):
                ok, reason = reconcile_positions("offline", self.Prices(), "owner", ledger, [])
            self.assertTrue(ok)
            self.assertIsNone(reason)
            row = ledger.open_positions()[0]
            self.assertEqual(row["mint"], "orphan-mint")
            self.assertEqual(row["adopted"], 1)
            self.assertEqual(row["entry_signature"], "reconciled")
            self.assertTrue(all(value == 0 for value in __import__("json").loads(row["features_json"])))
            ledger.close()

    def test_unpriced_orphan_halts_new_entries(self):
        from unittest.mock import patch

        from welp.ledger import Ledger
        from welp.reconcile import reconcile_positions

        class MissingPrices:
            def price(self, mint):
                return 100.0

            def order(self, input_mint, output_mint, amount):
                return {}

        with tempfile.TemporaryDirectory() as tmp:
            ledger = Ledger(Path(tmp) / "ledger.db")
            with patch("welp.reconcile.token_balances", return_value={"unpriced": {"amount": 1, "decimals": 6}}):
                ok, reason = reconcile_positions("offline", MissingPrices(), "owner", ledger, [])
            self.assertFalse(ok)
            self.assertIn("entries halted", reason or "")
            self.assertEqual(ledger.open_positions(), [])
            ledger.close()

    def test_unresolved_execute_without_signature_blocks_future_entries(self):
        from welp.ledger import Ledger
        from welp.reconcile import reconcile_pending_entries

        with tempfile.TemporaryDirectory() as tmp:
            ledger = Ledger(Path(tmp) / "ledger.db")
            ledger.add_pending_entry("execute-unknown:req-1", "mint", "TOKEN", 88.0)
            ok, note = reconcile_pending_entries("offline", self.Prices(), "owner", ledger, [])
            self.assertFalse(ok)
            self.assertIn("manual review", note or "")
            self.assertEqual(len(ledger.pending_entries()), 1)
            ledger.close()

    def test_confirmed_pending_signature_resolves_after_position_is_tracked(self):
        from unittest.mock import patch

        from welp.ledger import Ledger
        from welp.reconcile import reconcile_pending_entries

        with tempfile.TemporaryDirectory() as tmp:
            ledger = Ledger(Path(tmp) / "ledger.db")
            ledger.add_pending_entry("signature-1", "mint", "TOKEN", 88.0)
            ledger.open_position(
                mint="mint", symbol="TOKEN", kind="meme", pool="", decimals=6,
                token_raw=1, sol_spent_lamports=1, entry_usd=1.0, confidence=88.0,
                features=[0.0] * 12, signature="signature-1", adopted=True,
            )
            with patch("welp.reconcile.signature_status", return_value=("confirmed", None)), patch(
                "welp.reconcile.reconcile_positions", return_value=(True, None)
            ):
                ok, reason = reconcile_pending_entries("offline", self.Prices(), "owner", ledger, [])
            self.assertTrue(ok)
            self.assertIsNone(reason)
            self.assertEqual(ledger.pending_entries(), [])
            ledger.close()
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
