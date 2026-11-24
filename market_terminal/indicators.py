from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from .providers import Bar


def ema(values: list[float], length: int) -> list[float]:
    if not values or length <= 0:
        return []
    alpha = 2 / (length + 1)
    out = [values[0]]
    for value in values[1:]:
        out.append(alpha * value + (1 - alpha) * out[-1])
    return out


def rsi(values: list[float], length: int = 14) -> float | None:
    if len(values) <= length:
        return None
    gains = [max(values[i] - values[i - 1], 0.0) for i in range(1, len(values))]
    losses = [max(values[i - 1] - values[i], 0.0) for i in range(1, len(values))]
    avg_gain = sum(gains[:length]) / length
    avg_loss = sum(losses[:length]) / length
    for i in range(length, len(gains)):
        avg_gain = ((length - 1) * avg_gain + gains[i]) / length
        avg_loss = ((length - 1) * avg_loss + losses[i]) / length
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


@dataclass(frozen=True)
class Signal:
    symbol: str
    action: str
    score: float
    rsi14: float | None
    ema_fast: float
    ema_slow: float
    momentum_pct: float
    notes: tuple[str, ...]


def analyse(symbol: str, bars: list[Bar]) -> Signal:
    closes = [b.close for b in bars if b.close > 0 and isfinite(b.close)]
    if len(closes) < 35:
        return Signal(symbol, "INSUFFICIENT_DATA", 0.0, None, 0.0, 0.0, 0.0, ("Need at least 35 valid bars",))
    fast = ema(closes, 12)
    slow = ema(closes, 26)
    rsi_value = rsi(closes, 14)
    momentum = (closes[-1] / closes[-10] - 1) * 100 if closes[-10] else 0.0
    score = 50.0
    notes: list[str] = []
    if fast[-1] > slow[-1]:
        score += 18
        notes.append("EMA12 above EMA26")
    else:
        score -= 18
        notes.append("EMA12 below EMA26")
    if closes[-1] > fast[-1]:
        score += 8
        notes.append("price above EMA12")
    else:
        score -= 8
        notes.append("price below EMA12")
    if rsi_value is not None:
        if 48 <= rsi_value <= 68:
            score += 10
            notes.append("RSI in constructive range")
        elif rsi_value > 75:
            score -= 8
            notes.append("RSI overbought; entry penalty")
        elif rsi_value < 30:
            score -= 5
            notes.append("RSI oversold; wait for confirmation")
    if momentum > 1:
        score += 8
        notes.append("positive 9-bar momentum")
    elif momentum < -1:
        score -= 8
        notes.append("negative 9-bar momentum")
    score = max(0.0, min(100.0, score))
    if score >= 76:
        action = "BUY"
    elif score <= 24:
        action = "SHORT"
    else:
        action = "HOLD"
    return Signal(symbol, action, score, rsi_value, fast[-1], slow[-1], momentum, tuple(notes))
