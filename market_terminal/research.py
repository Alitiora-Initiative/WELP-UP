from __future__ import annotations

import base64
import json
import os
import re
import time
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .providers import ProviderError, _get_json


def _safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "to_json") and hasattr(value, "columns"):
        try:
            return json.loads(value.to_json(date_format="iso", orient="split"))
        except Exception:
            pass
    if hasattr(value, "to_dict"):
        try:
            return value.to_dict()
        except Exception:
            pass
    if hasattr(value, "to_json"):
        try:
            return json.loads(value.to_json())
        except Exception:
            pass
    if hasattr(value, "tolist"):
        try:
            return value.tolist()
        except Exception:
            pass
    return str(value)


class YahooResearch:
    def ticker(self, symbol: str):
        try:
            import yfinance as yf
        except ImportError as exc:
            raise ProviderError("Install yfinance to retrieve Yahoo Finance fundamentals/options") from exc
        return yf.Ticker(symbol.upper())

    def fundamentals(self, symbol: str) -> dict[str, Any]:
        ticker = self.ticker(symbol)
        sections: dict[str, Any] = {"symbol": symbol.upper(), "source": "Yahoo Finance via yfinance; research-only, unofficial adapter", "retrieved_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        try:
            info = ticker.info
            keys = [
                "longName", "shortName", "sector", "industry", "country", "website", "currency",
                "marketCap", "enterpriseValue", "trailingPE", "forwardPE", "pegRatio", "priceToBook",
                "profitMargins", "operatingMargins", "returnOnEquity", "returnOnAssets", "revenueGrowth",
                "earningsGrowth", "grossMargins", "debtToEquity", "currentRatio", "quickRatio",
                "totalRevenue", "grossProfits", "ebitda", "freeCashflow", "operatingCashflow",
                "totalCash", "totalDebt", "sharesOutstanding", "floatShares", "heldPercentInsiders",
                "heldPercentInstitutions", "shortRatio", "shortPercentOfFloat", "beta", "52WeekChange",
                "fiftyTwoWeekHigh", "fiftyTwoWeekLow", "dividendYield", "exDividendDate", "regularMarketPrice",
                "regularMarketTime", "averageVolume", "averageVolume10days", "recommendationKey", "numberOfAnalystOpinions",
            ]
            sections["profile_and_metrics"] = {k: _safe(info.get(k)) for k in keys if info.get(k) is not None}
        except Exception as exc:
            sections["profile_error"] = str(exc)
        for key, attr in (("income_statement_annual", "income_stmt"), ("income_statement_quarterly", "quarterly_income_stmt"), ("balance_sheet_annual", "balance_sheet"), ("balance_sheet_quarterly", "quarterly_balance_sheet"), ("cash_flow_annual", "cashflow"), ("cash_flow_quarterly", "quarterly_cashflow")):
            try:
                frame = getattr(ticker, attr)
                sections[key] = _safe(frame.to_dict()) if frame is not None and not frame.empty else {}
            except Exception as exc:
                sections[f"{key}_error"] = str(exc)
        for key, attr in (("dividends", "dividends"), ("splits", "splits"), ("recommendations", "recommendations"), ("recommendations_summary", "recommendations_summary"), ("analyst_price_targets", "analyst_price_targets"), ("institutional_holders", "institutional_holders"), ("major_holders", "major_holders"), ("mutualfund_holders", "mutualfund_holders"), ("insider_transactions", "insider_transactions"), ("insider_purchases", "insider_purchases"), ("calendar", "calendar"), ("earnings_dates", "earnings_dates"), ("sustainability", "sustainability"), ("shares", "shares")):
            try:
                series = getattr(ticker, attr)
                sections[key] = _safe(series.to_dict()) if series is not None else {}
            except Exception as exc:
                sections[f"{key}_error"] = str(exc)
        return sections

    def options(self, symbol: str, expirations: int = 2) -> dict[str, Any]:
        ticker = self.ticker(symbol)
        try:
            dates = list(ticker.options or ())[:max(1, min(expirations, 5))]
        except Exception as exc:
            raise ProviderError(f"Yahoo options expirations unavailable for {symbol}: {exc}") from exc
        chains = []
        for expiry in dates:
            try:
                chain = ticker.option_chain(expiry)
                chains.append({
                    "expiration": expiry,
                    "calls": _safe(chain.calls.head(25).to_dict(orient="records")),
                    "puts": _safe(chain.puts.head(25).to_dict(orient="records")),
                })
            except Exception as exc:
                chains.append({"expiration": expiry, "error": str(exc)})
        return {"symbol": symbol.upper(), "source": "Yahoo Finance via yfinance; indicative research data", "note": "Options quotes/greeks can be delayed or incomplete. Standard equity option contracts generally represent 100 shares; this system does not submit option orders.", "expirations": chains}

    def company_news(self, symbol: str, limit: int = 20) -> list[dict[str, Any]]:
        ticker = self.ticker(symbol)
        try:
            rows = ticker.news or []
        except Exception as exc:
            raise ProviderError(f"Yahoo Finance news unavailable for {symbol}: {exc}") from exc
        result = []
        for row in rows[:max(1, min(limit, 50))]:
            content = row.get("content") if isinstance(row, dict) else None
            item = content if isinstance(content, dict) else row
            title = item.get("title") if isinstance(item, dict) else None
            link = item.get("canonicalUrl", {}).get("url") if isinstance(item, dict) and isinstance(item.get("canonicalUrl"), dict) else None
            if not link and isinstance(item, dict):
                link = item.get("link")
            provider = item.get("provider", {}) if isinstance(item, dict) else {}
            source = provider.get("displayName") if isinstance(provider, dict) else None
            if title and link:
                result.append({"title": title, "url": link, "source": source or "Yahoo Finance news partner", "published": item.get("pubDate") or item.get("providerPublishTime"), "provider": "Yahoo Finance news"})
        return result


class NewsResearch:
    def gdelt(self, query: str, limit: int = 20) -> list[dict[str, Any]]:
        params = urlencode({"query": query, "mode": "ArtList", "format": "json", "maxrecords": min(max(limit, 1), 50), "sort": "HybridRel"})
        payload = _get_json(f"https://api.gdeltproject.org/api/v2/doc/doc?{params}", timeout=20)
        articles = payload.get("articles") or []
        return [{
            "title": row.get("title"), "url": row.get("url"), "source": row.get("domain") or row.get("sourceCountry"),
            "published": row.get("seendate"), "language": row.get("language"), "provider": "GDELT DOC 2.0",
        } for row in articles if row.get("url") and row.get("title")]

    def marketaux(self, query: str, limit: int = 20) -> list[dict[str, Any]]:
        token = os.getenv("MARKETAUX_API_TOKEN")
        if not token:
            raise ProviderError("MARKETAUX_API_TOKEN is not configured; using GDELT instead")
        params = urlencode({"api_token": token, "search": query, "limit": min(max(limit, 1), 50), "language": "en"})
        payload = _get_json(f"https://api.marketaux.com/v1/news/all?{params}", timeout=20)
        return [{
            "title": row.get("title"), "url": row.get("url"), "source": row.get("source"),
            "published": row.get("published_at"), "description": row.get("description"), "provider": "Marketaux",
        } for row in payload.get("data", []) if row.get("url") and row.get("title")]

    def reddit_oauth(self, subreddit: str = "stocks+investing+StockMarket+options+algotrading+Daytrading+CryptoCurrency+CryptoMarkets", limit: int = 20) -> list[dict[str, Any]]:
        """Read-only Reddit API path. Requires an approved Reddit API app and OAuth credentials."""
        client_id = os.getenv("REDDIT_CLIENT_ID")
        client_secret = os.getenv("REDDIT_CLIENT_SECRET")
        user_agent = os.getenv("REDDIT_USER_AGENT", "WELP-UP-market-terminal/0.1")
        if not client_id or not client_secret:
            raise ProviderError("Reddit is disabled: configure an approved Reddit API app and OAuth credentials; do not scrape Reddit HTML")
        auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        request = Request("https://www.reddit.com/api/v1/access_token", data=b"grant_type=client_credentials", headers={"Authorization": f"Basic {auth}", "User-Agent": user_agent, "Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urlopen(request, timeout=15) as response:
                token = json.loads(response.read().decode()).get("access_token")
        except Exception as exc:
            raise ProviderError(f"Reddit OAuth failed: {exc}") from exc
        payload = _get_json(f"https://oauth.reddit.com/r/{subreddit}/new?limit={min(max(limit,1),50)}", headers={"Authorization": f"Bearer {token}", "User-Agent": user_agent})
        children = ((payload.get("data") or {}).get("children") or [])
        return [{"title": row["data"].get("title"), "url": "https://www.reddit.com" + row["data"].get("permalink", ""), "source": "r/" + str(row["data"].get("subreddit")), "published": row["data"].get("created_utc"), "score": row["data"].get("score"), "comments": row["data"].get("num_comments"), "provider": "Reddit OAuth API"} for row in children]

    def fetch(self, query: str, limit: int = 20) -> list[dict[str, Any]]:
        try:
            return self.marketaux(query, limit)
        except ProviderError:
            return self.gdelt(query, limit)


def heuristic_sentiment(text: str) -> str:
    """Transparent keyword label for triage only, not a predictive model."""
    lower = re.sub(r"[^a-z ]", " ", text.lower())
    positive = {"beat", "growth", "upgrade", "profit", "surge", "bullish", "approval", "record", "strong", "buyback", "breakout"}
    negative = {"miss", "fraud", "lawsuit", "downgrade", "loss", "crash", "bearish", "recall", "hack", "liquidation", "bankruptcy"}
    words = set(lower.split())
    score = len(words & positive) - len(words & negative)
    return "positive" if score > 0 else "negative" if score < 0 else "neutral"
