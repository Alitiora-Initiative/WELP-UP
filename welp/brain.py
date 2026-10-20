from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

from welp.analyze import FEATURE_NAMES


def _sigmoid(value: float) -> float:
    if value > 40:
        return 1.0
    if value < -40:
        return 0.0
    return 1.0 / (1.0 + math.exp(-value))


@dataclass
class Brain:
    weights: list[float]
    closed_trades: int = 0
    learning_rate: float = 0.12
    l2: float = 0.002

    @classmethod
    def fresh(cls) -> Brain:
        # Bias only. Features start at zero so an untrained brain is 50%.
        weights = [0.0] * len(FEATURE_NAMES)
        return cls(weights=weights, closed_trades=0)

    def probability(self, features: list[float]) -> float:
        if len(features) != len(self.weights):
            raise ValueError("feature length does not match the brain")
        total = sum(w * x for w, x in zip(self.weights, features))
        return _sigmoid(total)

    def blend(self, rule_score: float, features: list[float]) -> tuple[float, float]:
        p = self.probability(features)
        learned = p * 100.0
        if self.closed_trades < 8:
            alpha = 0.12
        else:
            alpha = min(0.45, 0.12 + (self.closed_trades - 8) * 0.01)
        blended = (1.0 - alpha) * rule_score + alpha * learned
        return max(0.0, min(100.0, blended)), p

    def learn(self, features: list[float], pnl_pct: float) -> float:
        """Update from a confirmed close. Returns the probability error."""
        if len(features) != len(self.weights):
            raise ValueError("feature length does not match the brain")
        y = 1.0 if pnl_pct > 0.5 else 0.0
        p = self.probability(features)
        error = y - p
        for i, x in enumerate(features):
            grad = error * x - self.l2 * self.weights[i]
            self.weights[i] += self.learning_rate * grad
            self.weights[i] = max(-4.0, min(4.0, self.weights[i]))
        self.closed_trades += 1
        return error

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(
                {
                    "weights": self.weights,
                    "closed_trades": self.closed_trades,
                    "names": list(FEATURE_NAMES),
                },
                indent=2,
            )
        )

    @classmethod
    def load(cls, path: Path) -> Brain:
        if not path.exists():
            return cls.fresh()
        raw = json.loads(path.read_text())
        weights = [float(w) for w in raw["weights"]]
        if len(weights) != len(FEATURE_NAMES):
            return cls.fresh()
        brain = cls.fresh()
        brain.weights = weights
        brain.closed_trades = int(raw.get("closed_trades") or 0)
        return brain
