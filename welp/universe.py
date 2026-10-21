from __future__ import annotations

import json
import time
from pathlib import Path

from welp.charts import PoolView, token_top_pool, trending_memes
from welp.config import STOCK_QUERIES
from welp.jupiter import Jupiter

# Cache TTL for resolved stock candidates (issue #4).
STOCKS_CACHE_TTL_S = 24 * 3600


def _is_stock(token: dict) -> bool:
    """Strict markers only — generic "Tesla" / "stock" substrings are not enough."""
    name = str(token.get("name") or "").lower()
    symbol = str(token.get("symbol") or "").lower()
    text = f"{name} {symbol}"
    if "xstock" in text or "prestocks" in text:
        return True
    if "tokenized stock" in name:
        return True
    return False


def resolve_stocks(jupiter: Jupiter, cache_path: Path) -> list[dict]:
    if cache_path.exists():
        try:
            cached = json.loads(cache_path.read_text())
            if isinstance(cached, dict) and isinstance(cached.get("items"), list):
                age = time.time() - float(cached.get("saved_at") or 0)
                if age < STOCKS_CACHE_TTL_S and cached["items"]:
                    return cached["items"]
            # Legacy list format: treat as expired so we re-verify.
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    found: dict[str, dict] = {}
    for query in STOCK_QUERIES:
        try:
            rows = jupiter.search_token(query)
        except Exception:
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            if not _is_stock(row):
                continue
            mint = str(row.get("id") or row.get("address") or "")
            if not mint or mint in found:
                continue
            found[mint] = {
                "mint": mint,
                "symbol": str(row.get("symbol") or query),
                "name": str(row.get("name") or ""),
                "decimals": int(row.get("decimals") or 6),
                "kind": "stock",
            }
    items = list(found.values())
    try:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps({"saved_at": time.time(), "items": items}, indent=2)
        )
    except OSError:
        pass
    return items


def load_universe(jupiter: Jupiter, data_dir: Path) -> list[PoolView]:
    views: list[PoolView] = []
    seen: set[str] = set()
    for view in trending_memes(limit=12):
        if view.mint in seen:
            continue
        seen.add(view.mint)
        views.append(view)
    stocks = resolve_stocks(jupiter, data_dir / "stocks.json")
    for item in stocks:
        mint = item["mint"]
        if mint in seen:
            continue
        try:
            view = token_top_pool(mint, "stock")
        except Exception:
            continue
        if view is None:
            continue
        seen.add(mint)
        views.append(view)
    return views
