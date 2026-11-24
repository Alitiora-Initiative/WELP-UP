from __future__ import annotations

import importlib.util
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen
import json
import math


class ProviderError(RuntimeError):
    pass


def _get_json(url: str, headers: dict[str, str] | None = None, timeout: int = 15) -> dict[str, Any]:
    request = Request(url, headers={"User-Agent": "WELP-UP-MarketTerminal/0.1 contact=local-user", **(headers or {})})
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ProviderError("Provider returned a non-object response")
        return value
    except Exception as exc:
        raise ProviderError(f"HTTP data request failed: {exc}") from exc


@dataclass(frozen=True)
class Quote:
    symbol: str
    asset_class: str
    price: float
    currency: str
    timestamp: float
    source: str
    bid: float | None = None
    ask: float | None = None
    volume: float | None = None
    is_real_market_data: bool = True
    quality: str = "provider_timestamp"

    @property
    def age_seconds(self) -> float:
        return max(0.0, time.time() - self.timestamp)

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["age_seconds"] = round(self.age_seconds, 1)
        return result


@dataclass(frozen=True)
class Bar:
    timestamp: float
    open: float
    high: float
    low: float
    close: float
    volume: float


class OKXProvider:
    BASE = "https://www.okx.com"

    def _instrument(self, symbol: str) -> str:
        normalized = symbol.upper().replace("/", "-")
        if "-" not in normalized:
            normalized = f"{normalized}-USDT"
        return normalized

    def quote(self, symbol: str) -> Quote:
        inst = self._instrument(symbol)
        payload = _get_json(f"{self.BASE}/api/v5/market/ticker?instId={quote(inst)}")
        rows = payload.get("data") or []
        if not rows:
            raise ProviderError(f"OKX returned no ticker for {inst}")
        row = rows[0]
        price = float(row.get("last") or 0)
        ts = float(row.get("ts") or 0) / 1000
        if not math.isfinite(price) or not math.isfinite(ts) or price <= 0 or ts <= 0:
            raise ProviderError(f"OKX ticker for {inst} had no usable price/time")
        return Quote(
            symbol=inst, asset_class="crypto", price=price, currency="USDT", timestamp=ts,
            source="OKX public market ticker", bid=float(row.get("bidPx") or 0) or None,
            ask=float(row.get("askPx") or 0) or None, volume=float(row.get("vol24h") or 0),
        )

    def bars(self, symbol: str, limit: int = 200, bar: str = "1H") -> list[Bar]:
        inst = self._instrument(symbol)
        payload = _get_json(f"{self.BASE}/api/v5/market/candles?instId={quote(inst)}&bar={quote(bar)}&limit={min(max(limit, 30), 300)}")
        rows = payload.get("data") or []
        parsed = []
        for row in reversed(rows):
            try:
                parsed.append(Bar(float(row[0]) / 1000, float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5])))
            except (TypeError, ValueError, IndexError):
                continue
        if not parsed:
            raise ProviderError(f"OKX returned no usable candles for {inst}")
        return parsed


class YahooProvider:
    """Research-only Yahoo Finance adapter using yfinance; feed can be delayed/unofficial."""

    def _ticker(self, symbol: str):
        if importlib.util.find_spec("yfinance") is None:
            raise ProviderError("Install yfinance to use Yahoo Finance: pip install yfinance")
        import yfinance as yf
        return yf.Ticker(symbol.upper())

    def quote(self, symbol: str) -> Quote:
        ticker = self._ticker(symbol)
        frame = ticker.history(period="1d", interval="1m", prepost=False, auto_adjust=False)
        if frame is None or frame.empty:
            frame = ticker.history(period="5d", interval="5m", prepost=False, auto_adjust=False)
        if frame is None or frame.empty:
            raise ProviderError(f"Yahoo Finance returned no recent price bars for {symbol}")
        latest = frame.iloc[-1]
        index = frame.index[-1]
        if getattr(index, "tzinfo", None) is None:
            index = index.tz_localize("UTC")
        ts = float(index.timestamp())
        price = float(latest.get("Close") or 0)
        volume = float(latest.get("Volume") or 0)
        if not math.isfinite(price) or not math.isfinite(ts) or price <= 0 or ts <= 0:
            raise ProviderError(f"Yahoo Finance returned an invalid price/timestamp for {symbol}")
        currency = "USD"
        try:
            fast = ticker.fast_info
            currency = str(fast.get("currency") or currency)
        except Exception:
            pass
        return Quote(
            symbol=symbol.upper(), asset_class="stock", price=price, currency=currency,
            timestamp=ts, source="Yahoo Finance via yfinance (research; may be delayed)",
            volume=volume, quality="timestamp_of_last_yahoo_bar",
        )

    def bars(self, symbol: str, period: str = "6mo", interval: str = "1d") -> list[Bar]:
        ticker = self._ticker(symbol)
        frame = ticker.history(period=period, interval=interval, auto_adjust=False)
        if frame is None or frame.empty:
            raise ProviderError(f"Yahoo Finance returned no historical bars for {symbol}")
        parsed = []
        for index, row in frame.iterrows():
            ts_index = index
            if getattr(ts_index, "tzinfo", None) is None:
                ts_index = ts_index.tz_localize("UTC")
            values = [row.get(k) for k in ("Open", "High", "Low", "Close", "Volume")]
            try:
                o, h, l, c, v = map(float, values)
                if c > 0:
                    parsed.append(Bar(float(ts_index.timestamp()), o, h, l, c, v))
            except (TypeError, ValueError):
                continue
        if not parsed:
            raise ProviderError(f"Yahoo Finance returned no usable historical bars for {symbol}")
        return parsed


class MarketDataRouter:
    def __init__(self) -> None:
        self.okx = OKXProvider()
        self.yahoo = YahooProvider()

    @staticmethod
    def is_crypto(symbol: str) -> bool:
        s = symbol.upper()
        return "-USDT" in s or s.endswith("/USDT") or s in {"BTC", "ETH", "SOL", "DOGE", "XRP", "ADA"}

    def quote(self, symbol: str) -> Quote:
        if self.is_crypto(symbol):
            return self.okx.quote(symbol)
        return self.yahoo.quote(symbol)

    def bars(self, symbol: str, limit: int = 200) -> list[Bar]:
        if self.is_crypto(symbol):
            return self.okx.bars(symbol, limit=limit, bar="1H")
        return self.yahoo.bars(symbol)

    def health(self) -> list[dict[str, str]]:
        return [
            {"provider": "OKX", "status": "public endpoints; no API key for market data", "purpose": "crypto spot prices/candles"},
            {"provider": "Yahoo Finance/yfinance", "status": "requires local yfinance package; may be delayed and unofficial", "purpose": "US stocks, historical bars, fundamentals and options research"},
            {"provider": "Alpaca", "status": "not connected: API credentials not configured", "purpose": "future paper broker/data adapter; not required for the local simulator"},
            {"provider": "OKX Demo Trading", "status": "not connected: demo API credentials not configured", "purpose": "future exchange demo adapter; not used by the local simulator"},
        ]
