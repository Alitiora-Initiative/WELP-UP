from __future__ import annotations

from dataclasses import dataclass, field

from welp.indicators import Candle, ema, higher_structure, rsi, volume_ratio

FEATURE_NAMES = (
    "ema_stack",
    "rsi_quality",
    "structure",
    "volume",
    "liquidity",
    "momentum",
    "impact",
    "age",
    "turnover",
    "not_extended",
    "buy_pressure",
    "bias",
)


@dataclass
class Snapshot:
    kind: str
    candles: list[Candle]
    liquidity_usd: float
    volume_h24: float
    change_m5: float
    change_h1: float
    age_hours: float
    buy_ratio: float | None = None
    price_impact_pct: float | None = None
    quote_edge_pct: float | None = None


@dataclass
class Analysis:
    rule_score: float
    features: list[float]
    notes: list[str] = field(default_factory=list)
    ready: bool = True


def _clip(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def analyze(snapshot: Snapshot) -> Analysis:
    notes: list[str] = []
    closes = [c.close for c in snapshot.candles]
    if len(closes) < 30:
        return Analysis(0.0, [0.0] * len(FEATURE_NAMES), ["fewer than 30 candles"], ready=False)

    ema_fast = ema(closes, 9)[-1]
    ema_slow = ema(closes, 21)[-1]
    close = closes[-1]
    rsi_value = rsi(closes, 14)
    if rsi_value is None:
        return Analysis(0.0, [0.0] * len(FEATURE_NAMES), ["rsi unavailable"], ready=False)
    higher_highs, higher_lows = higher_structure(snapshot.candles)
    vol_ratio = volume_ratio(snapshot.candles) or 0.0

    score = 0.0
    ema_stack = close > ema_fast > ema_slow
    if ema_stack:
        score += 16
        notes.append("ema stack up")
    elif close > ema_slow:
        score += 6
        notes.append("above slow ema only")
    else:
        notes.append("no trend")

    if 52 <= rsi_value <= 66:
        score += 12
        rsi_quality = 1.0
        notes.append(f"rsi {rsi_value:.1f} in band")
    elif 45 <= rsi_value < 52 or 66 < rsi_value <= 70:
        score += 5
        rsi_quality = 0.45
    else:
        rsi_quality = 0.0
        notes.append(f"rsi {rsi_value:.1f} outside")

    if higher_highs and higher_lows:
        score += 10
        structure = 1.0
        notes.append("higher highs and higher lows")
    elif higher_lows:
        score += 4
        structure = 0.4
    else:
        structure = 0.0

    if vol_ratio >= 1.25:
        score += 8
        notes.append(f"volume x{vol_ratio:.2f}")
    elif vol_ratio >= 1.0:
        score += 3

    if snapshot.kind == "stock":
        if snapshot.liquidity_usd >= 250_000:
            score += 10
        elif snapshot.liquidity_usd >= 40_000:
            score += 6
        else:
            notes.append("stock book thinner than 40k")
    else:
        if snapshot.liquidity_usd >= 80_000:
            score += 10
        elif snapshot.liquidity_usd >= 12_000:
            score += 6
        else:
            notes.append("meme book thinner than 12k")

    h1 = snapshot.change_h1
    if snapshot.kind == "stock":
        if 0.15 <= h1 <= 3.5:
            score += 8
            momentum = 1.0
        elif -0.4 <= h1 < 0.15:
            score += 3
            momentum = 0.4
        else:
            momentum = 0.0
    else:
        if 1.0 <= h1 <= 8.0:
            score += 8
            momentum = 1.0
            notes.append(f"h1 {h1:.2f}%")
        elif 0.2 <= h1 < 1.0:
            score += 3
            momentum = 0.4
        else:
            momentum = 0.0

    extended = False
    if snapshot.change_m5 <= -6:
        score -= 18
        notes.append("5m dump")
        extended = True
    elif snapshot.change_m5 >= 12:
        score -= 14
        notes.append("5m blowoff")
        extended = True
    else:
        score += 6

    if snapshot.age_hours >= 24:
        score += 8
        age_f = 1.0
    elif snapshot.age_hours >= 6:
        score += 4
        age_f = 0.5
    elif snapshot.age_hours < 1:
        score -= 16
        age_f = 0.0
        notes.append("pool younger than 1h")
    else:
        age_f = snapshot.age_hours / 24.0

    turnover = 0.0
    if snapshot.liquidity_usd > 0:
        turnover = snapshot.volume_h24 / snapshot.liquidity_usd
        if turnover >= 0.15:
            score += 6
        elif turnover >= 0.05:
            score += 3

    impact_f = 0.5
    if snapshot.price_impact_pct is not None:
        limit = 0.8 if snapshot.kind == "stock" else 2.5
        if snapshot.price_impact_pct <= limit * 0.4:
            score += 10
            impact_f = 1.0
            notes.append(f"impact {snapshot.price_impact_pct:.3f}%")
        elif snapshot.price_impact_pct <= limit:
            score += 4
            impact_f = 0.45
        else:
            score -= 22
            impact_f = 0.0
            notes.append("jupiter impact too high")

    if snapshot.quote_edge_pct is not None:
        if -1.5 <= snapshot.quote_edge_pct <= 0.4:
            score += 6
        else:
            score -= 12
            notes.append("jupiter usd quote disagrees with the mark")

    buy_f = 0.5
    if snapshot.buy_ratio is not None:
        buy_f = _clip(snapshot.buy_ratio)
        if 0.52 <= snapshot.buy_ratio <= 0.72:
            score += 6
        elif snapshot.buy_ratio > 0.85:
            score -= 6
            notes.append("one-sided buys")

    if rsi_value >= 74:
        score -= 12
        notes.append("rsi overbought")
    if snapshot.kind == "meme" and snapshot.change_h1 >= 25:
        score -= 15
        extended = True
        notes.append("already extended")

    score = max(0.0, min(100.0, score))
    liq_f = _clip(snapshot.liquidity_usd / (250_000 if snapshot.kind == "stock" else 80_000))
    features = [
        1.0 if ema_stack else 0.0,
        rsi_quality,
        structure,
        _clip(vol_ratio / 2.0),
        liq_f,
        momentum,
        impact_f,
        _clip(age_f),
        _clip(turnover / 1.5),
        0.0 if extended else 1.0,
        buy_f,
        1.0,
    ]
    return Analysis(score, features, notes, ready=True)


def in_trade_band(score: float, floor: float = 80.0, ceiling: float = 98.0) -> tuple[bool, str]:
    if score < floor:
        return False, f"score {score:.2f} is below {floor:.0f}"
    if score > ceiling:
        return False, f"score {score:.2f} is above {ceiling:.0f}"
    return True, f"score {score:.2f} is inside {floor:.0f}-{ceiling:.0f}"
