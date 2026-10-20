from __future__ import annotations

from pathlib import Path

from welp.charts import PoolView, token_top_pool, trending_memes
from welp.jupiter import Jupiter


def resolve_stocks(jupiter: Jupiter, cache_path: Path) -> list[dict]:
    # No authoritative xStock issuer/mint list is configured. Ignore old cache
    # files and search results until entries can be checked against one.
    return []


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
