from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Candle:
    ts: int
    open: float
    high: float
    low: float
    close: float
    volume: float


def parse_ohlcv(rows: list[list[float]]) -> list[Candle]:
    candles = [
        Candle(
            ts=int(row[0]),
            open=float(row[1]),
            high=float(row[2]),
            low=float(row[3]),
            close=float(row[4]),
            volume=float(row[5]),
        )
        for row in rows
        if len(row) >= 6 and float(row[4]) > 0
    ]
    candles.sort(key=lambda c: c.ts)
    # Drop duplicate timestamps, keep the last print.
    dedup: dict[int, Candle] = {}
    for candle in candles:
        dedup[candle.ts] = candle
    return [dedup[k] for k in sorted(dedup)]


def ema(values: list[float], length: int) -> list[float]:
    if not values:
        return []
    k = 2.0 / (length + 1)
    out: list[float] = []
    acc = values[0]
    for value in values:
        acc = value * k + acc * (1 - k)
        out.append(acc)
    return out


def rsi(closes: list[float], length: int = 14) -> float | None:
    if len(closes) < length + 1:
        return None
    gains: list[float] = []
    losses: list[float] = []
    for i in range(1, len(closes)):
        delta = closes[i] - closes[i - 1]
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))
    avg_gain = sum(gains[:length]) / length
    avg_loss = sum(losses[:length]) / length
    for i in range(length, len(gains)):
        avg_gain = (avg_gain * (length - 1) + gains[i]) / length
        avg_loss = (avg_loss * (length - 1) + losses[i]) / length
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def higher_structure(candles: list[Candle]) -> tuple[bool, bool]:
    if len(candles) < 8:
        return False, False
    left = candles[-8:-4]
    right = candles[-4:]
    higher_lows = min(c.low for c in right) > min(c.low for c in left)
    higher_highs = max(c.high for c in right) > max(c.high for c in left)
    return higher_highs, higher_lows


def volume_ratio(candles: list[Candle], window: int = 6) -> float | None:
    if len(candles) < window * 2:
        return None
    recent = sum(c.volume for c in candles[-window:])
    prior = sum(c.volume for c in candles[-window * 2 : -window])
    if prior <= 0:
        return None
    return recent / prior
