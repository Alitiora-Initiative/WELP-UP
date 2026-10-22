from __future__ import annotations

import json
import time
from pathlib import Path

from welp.charts import PoolView, token_top_pool, trending_memes
from welp.config import STOCK_QUERIES
from welp.jupiter import Jupiter


def _is_stock(token: dict) -> bool:
    name = str(token.get("name") or "")
    symbol = str(token.get("symbol") or "")
    text = f"{name} {symbol}".lower()
    return "xstock" in text or "tokenized stock" in text or "prestocks" in text


def resolve_stocks(jupiter: Jupiter, cache_path: Path) -> list[dict]:
    # Cache expires after 24 hours
    cache_max_age = 24 * 3600
    if cache_path.exists():
        try:
            file_age = time.time() - cache_path.stat().st_mtime
            if file_age < cache_max_age:
                cached = json.loads(cache_path.read_text())
                if isinstance(cached, list) and cached:
                    return cached
        except (json.JSONDecodeError, OSError):
            pass
    found: dict[str, dict] = {}
    for query in STOCK_QUERIES:
        try:
            rows = jupiter.search_token(query)
        except Exception:
            continue
        for row in rows:
            if not _is_stock(row):
                continue
            mint = row.get("id") or row.get("address")
            if not mint:
                continue
            found[mint] = {
                "mint": mint,
                "symbol": row.get("symbol") or query,
                "name": row.get("name") or query,
                "decimals": int(row.get("decimals") or 0),
            }
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    if found:
        cache_path.write_text(json.dumps(list(found.values()), indent=2))
    return list(found.values())


def load_universe(jupiter: Jupiter, data_dir: Path, meme_limit: int = 12) -> list[PoolView]:
    views: list[PoolView] = []
    seen: set[str] = set()
    try:
        memes = trending_memes(meme_limit)
    except Exception:
        memes = []
    for meme in memes:
        if meme.mint in seen:
            continue
        seen.add(meme.mint)
        views.append(meme)

    stocks = resolve_stocks(jupiter, data_dir / "stocks.json")
    for stock in stocks[:12]:
        mint = stock["mint"]
        if mint in seen:
            continue
        try:
            pool = token_top_pool(mint, "stock")
        except Exception:
            pool = None
        if pool is None or pool.liquidity_usd < 40_000:
            continue
        seen.add(mint)
        if stock.get("decimals"):
            pool = PoolView(
                pool=pool.pool,
                mint=pool.mint,
                symbol=stock.get("symbol") or pool.symbol,
                name=stock.get("name") or pool.name,
                decimals=int(stock["decimals"]),
                kind="stock",
                liquidity_usd=pool.liquidity_usd,
                volume_h24=pool.volume_h24,
                change_m5=pool.change_m5,
                change_h1=pool.change_h1,
                age_hours=pool.age_hours,
                buy_ratio=pool.buy_ratio,
                quote_mint=pool.quote_mint,
            )
        views.append(pool)
    return views
