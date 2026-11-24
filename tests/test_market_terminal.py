from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from market_terminal.config import Settings
from market_terminal.indicators import analyse, ema, rsi
from market_terminal.paper import PaperBroker, RiskRejected
from market_terminal.providers import Bar, Quote
from market_terminal.store import Store


class FakeData:
    """Test-only fixture; never registered as a production market-data provider."""
    def __init__(self):
        self.price = 100.0
        self.asset_class = "stock"

    def quote(self, symbol):
        import time
        return Quote(symbol, self.asset_class, self.price, "USD", time.time(), "test fixture", quality="unit_test_only")

    def bars(self, symbol, limit=200):
        import time
        rows = []
        price = 10.0
        for i in range(60):
            price *= 1.002
            rows.append(Bar(time.time() - (60-i)*3600, price*.999, price*1.002, price*.998, price, 1000+i))
        return rows


class MarketTerminalTests(unittest.TestCase):
    def settings(self, path: Path) -> Settings:
        return Settings(data_dir=path, database=path/"paper.sqlite3")

    def test_indicators_and_signal_with_fixture_only(self):
        prices = [float(i) for i in range(1, 40)]
        self.assertGreater(ema(prices, 12)[-1], ema(prices, 26)[-1])
        self.assertGreater(rsi(prices, 14), 70)
        signal = analyse("TEST", FakeData().bars("TEST"))
        self.assertIn(signal.action, {"BUY", "HOLD", "SHORT", "INSUFFICIENT_DATA"})

    def test_paper_buy_obeys_reserve_and_short_uses_collateral(self):
        with tempfile.TemporaryDirectory() as folder:
            settings = self.settings(Path(folder))
            store = Store(settings.database, settings.initial_equity)
            data = FakeData()
            broker = PaperBroker(settings, store, data)
            opened = broker.open("TEST", 2.0, side=1)
            self.assertEqual(opened["action"], "BUY")
            self.assertGreaterEqual(store.cash(), settings.cash_reserve - 1e-8)
            self.assertEqual(len(store.open_positions()), 1)
            broker.close_position(opened["position_id"])
            self.assertEqual(len(store.open_positions()), 0)
            store.close()

    def test_cash_reserve_prevents_overspend(self):
        with tempfile.TemporaryDirectory() as folder:
            settings = self.settings(Path(folder))
            store = Store(settings.database, settings.initial_equity)
            broker = PaperBroker(settings, store, FakeData())
            with self.assertRaises(RiskRejected):
                broker.open("TEST", 4.0)
            self.assertAlmostEqual(store.cash(), 10.0)
            store.close()

    def test_position_and_trade_limits(self):
        with tempfile.TemporaryDirectory() as folder:
            settings = self.settings(Path(folder))
            store = Store(settings.database, settings.initial_equity)
            broker = PaperBroker(settings, store, FakeData())
            broker.open("AAA", 2.0)
            with self.assertRaises(RiskRejected):
                broker.open("BBB", 2.0)
            with self.assertRaises(RiskRejected):
                broker.open("AAA", 1.0)
            store.close()

    def test_high_water_drawdown_triggers_at_20_percent_even_above_initial(self):
        with tempfile.TemporaryDirectory() as folder:
            settings = self.settings(Path(folder))
            store = Store(settings.database, settings.initial_equity)
            store.set_meta("high_water_equity", "12")
            store.set_meta("cash", "9.5")
            broker = PaperBroker(settings, store, FakeData())
            state = broker.mark_equity()
            self.assertTrue(broker._check_kill_switch(state))
            self.assertEqual(store.get_meta("kill_switch"), "1")
            store.close()

    def test_kill_switch_is_persistent_and_blocks_entries(self):
        with tempfile.TemporaryDirectory() as folder:
            settings = self.settings(Path(folder))
            store = Store(settings.database, settings.initial_equity)
            store.set_meta("high_water_equity", "10")
            store.set_meta("cash", "7.9")
            broker = PaperBroker(settings, store, FakeData())
            state = broker.mark_equity()
            self.assertTrue(broker._check_kill_switch(state))
            self.assertEqual(store.get_meta("kill_switch"), "1")
            with self.assertRaises(RiskRejected):
                broker.open("AAA", 1.0)
            store.close()


if __name__ == "__main__":
    unittest.main()
