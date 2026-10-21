"""LIMITS.md is the contract — parse money rules and assert they match config (issue #11 B2)."""
from __future__ import annotations

import re
import unittest
from decimal import Decimal
from pathlib import Path

from welp import config


class LimitsContractTests(unittest.TestCase):
    def test_limits_md_matches_config_constants(self):
        text = Path("LIMITS.md").read_text(encoding="utf-8")

        def cell(label: str) -> str:
            pattern = rf"\|\s*{re.escape(label)}\s*\|\s*([^|]+)\|"
            m = re.search(pattern, text, re.IGNORECASE)
            self.assertIsNotNone(m, f"missing LIMITS.md row for {label}")
            return m.group(1).strip()

        default_buy = cell("Buy input default")
        min_buy = cell("Minimum buy")
        max_buy = cell("Maximum buy")
        min_equity = cell("Minimum estimated wallet equity to quote")
        fee_reserve = cell("SOL fee reserve check")

        self.assertIn("0.001", default_buy)
        self.assertIn("0.001", min_buy)
        self.assertIn("0.02", max_buy)
        self.assertIn("0.50", min_equity.replace("$", ""))
        self.assertIn("0.003", fee_reserve)

        self.assertEqual(config.MIN_TRADE_SOL, Decimal("0.001"))
        self.assertEqual(config.MIN_ACCOUNT_USD, Decimal("0.50"))
        self.assertEqual(config.CONFIDENCE_FLOOR, Decimal("80"))
        self.assertEqual(config.CONFIDENCE_CEILING, Decimal("98"))


if __name__ == "__main__":
    unittest.main()
