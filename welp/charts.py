from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from welp.config import QUOTE_MINTS, SOL_MINT, STOCK_QUERIES
from welp.http import request_json
from welp.indicators import Candle, parse_ohlcv

GECKO = "https://api.geckoterminal.com/api/v2"


@dataclass(frozen=True)
class PoolView:
    pool: str
    mint: str
    symbol: str
    name: str
    decimals: int
    kind: str
    liquidity_usd: float
    volume_h24: float
    change_m5: float
    change_h1: float
    age_hours: float
    buy_ratio: float | None
    quote_mint: str


def _f(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _hours_since(iso: str | None) -> float:
    if not iso:
        return 0.0
    try:
        text = iso.replace("Z", "+00:00")
        created = datetime.fromisoformat(text)
    except ValueError:
        return 0.0
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - created
    return max(0.0, delta.total_seconds() / 3600.0)


def _buy_ratio(attributes: dict[str, Any]) -> float | None:
    tx = attributes.get("transactions") or {}
    window = tx.get("h1") or tx.get("m5") or {}
    if not isinstance(window, dict):
        return None
    buys = _f(window.get("buys"), -1)
    sells = _f(window.get("sells"), -1)
    if buys < 0 or sells < 0 or buys + sells == 0:
        return None
    return buys / (buys + sells)


def _included_map(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    found: dict[str, dict[str, Any]] = {}
    for row in payload.get("included") or []:
        if isinstance(row, dict) and row.get("id"):
            found[row["id"]] = row
    return found


def parse_pool_row(
    row: dict[str, Any],
    included: dict[str, dict[str, Any]],
    *,
    kind_hint: str | None = None,
) -> PoolView | None:
    attr = row.get("attributes") or {}
    rel = row.get("relationships") or {}
    base_ref = ((rel.get("base_token") or {}).get("data") or {}).get("id")
    quote_ref = ((rel.get("quote_token") or {}).get("data") or {}).get("id")
    base = included.get(base_ref or "", {})
    quote = included.get(quote_ref or "", {})
    base_attr = base.get("attributes") or {}
    quote_attr = quote.get("attributes") or {}
    base_mint = base_attr.get("address") or ""
    quote_mint = quote_attr.get("address") or ""
    if not base_mint or not quote_mint:
        return None
    # Trade the non-quote side. Skip pools that are not against SOL or a stable.
    if quote_mint in QUOTE_MINTS and base_mint not in QUOTE_MINTS:
        mint, meta = base_mint, base_attr
        other = quote_mint
    elif base_mint in QUOTE_MINTS and quote_mint not in QUOTE_MINTS:
        mint, meta = quote_mint, quote_attr
        other = base_mint
    else:
        return None
    if mint == SOL_MINT:
        return None
    name = str(meta.get("name") or "")
    symbol = str(meta.get("symbol") or "")
    # There is no trusted issuer/mint registry for tokenized stocks. Do not
    # classify them as ordinary memes or grant them stock-specific risk limits.
    stock_like_name = any(term in name.lower() for term in ("xstock", "tokenized stock", "prestocks"))
    stock_like_symbol = symbol.lower() in {query.lower() for query in STOCK_QUERIES}
    if kind_hint == "stock" or stock_like_name or stock_like_symbol:
        return None
    kind = "meme"
    pool = attr.get("address") or ""
    if not pool:
        return None
    return PoolView(
        pool=pool,
        mint=mint,
        symbol=symbol,
        name=name,
        decimals=int(meta.get("decimals") or 0),
        kind=kind,
        liquidity_usd=_f(attr.get("reserve_in_usd")),
        volume_h24=_f((attr.get("volume_usd") or {}).get("h24")),
        change_m5=_f((attr.get("price_change_percentage") or {}).get("m5")),
        change_h1=_f((attr.get("price_change_percentage") or {}).get("h1")),
        age_hours=_hours_since(attr.get("pool_created_at")),
        buy_ratio=_buy_ratio(attr),
        quote_mint=other,
    )


def fetch_pools(path: str) -> list[PoolView]:
    payload = request_json("GET", f"{GECKO}{path}", timeout=25)
    if not isinstance(payload, dict):
        return []
    included = _included_map(payload)
    views: list[PoolView] = []
    for row in payload.get("data") or []:
        if isinstance(row, dict):
            view = parse_pool_row(row, included)
            if view is not None:
                views.append(view)
    return views


def trending_memes(limit: int = 20) -> list[PoolView]:
    rows = fetch_pools("/networks/solana/trending_pools?page=1&include=base_token,quote_token")
    memes = [row for row in rows if row.kind == "meme" and row.liquidity_usd >= 12_000]
    return memes[:limit]


def token_top_pool(mint: str, kind: str) -> PoolView | None:
    payload = request_json(
        "GET",
        f"{GECKO}/networks/solana/tokens/{mint}/pools",
        query={"page": "1", "include": "base_token,quote_token"},
        timeout=25,
    )
    if not isinstance(payload, dict):
        return None
    included = _included_map(payload)
    best: PoolView | None = None
    for row in payload.get("data") or []:
        if not isinstance(row, dict):
            continue
        view = parse_pool_row(row, included, kind_hint=kind)
        if view is None or view.mint != mint:
            continue
        if best is None or view.liquidity_usd > best.liquidity_usd:
            best = view
    return best


def fetch_candles(pool: str, limit: int = 60) -> list[Candle]:
    payload = request_json(
        "GET",
        f"{GECKO}/networks/solana/pools/{pool}/ohlcv/minute",
        query={"aggregate": "5", "limit": str(limit), "currency": "usd"},
        timeout=25,
    )
    rows = (((payload or {}).get("data") or {}).get("attributes") or {}).get("ohlcv_list") or []
    return parse_ohlcv(rows)
