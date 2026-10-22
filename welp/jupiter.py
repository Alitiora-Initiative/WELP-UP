from __future__ import annotations

from typing import Any

from welp.config import SOL_MINT
from welp.http import HttpError, request_json

SWAP_BASE = "https://api.jup.ag/swap/v2"
PRICE_URL = "https://lite-api.jup.ag/price/v3"
TOKEN_SEARCH = "https://lite-api.jup.ag/tokens/v2/search"


class JupiterError(RuntimeError):
    pass


class Jupiter:
    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        return headers

    def prices(self, mints: list[str]) -> dict[str, float]:
        if not mints:
            return {}
        out: dict[str, float] = {}
        for i in range(0, len(mints), 50):
            chunk = mints[i : i + 50]
            payload = request_json(
                "GET",
                PRICE_URL,
                query={"ids": ",".join(chunk)},
                headers=self._headers(),
            )
            if not isinstance(payload, dict):
                raise JupiterError("price response was not an object")
            for mint, row in payload.items():
                if isinstance(row, dict) and row.get("usdPrice") is not None:
                    out[mint] = float(row["usdPrice"])
        return out

    def price(self, mint: str) -> float:
        found = self.prices([mint])
        if mint not in found:
            raise JupiterError(f"no Jupiter price for {mint}")
        return found[mint]

    def search_token(self, query: str) -> list[dict[str, Any]]:
        payload = request_json(
            "GET",
            TOKEN_SEARCH,
            query={"query": query},
            timeout=20,
        )
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict) and isinstance(payload.get("tokens"), list):
            return payload["tokens"]
        return []

    def order(
        self,
        input_mint: str,
        output_mint: str,
        amount_raw: int,
        *,
        taker: str | None = None,
        slippage_bps: int | None = None,
        priority_fee_lamports: int = 0,
    ) -> dict[str, Any]:
        if amount_raw <= 0:
            raise JupiterError("order amount must be positive")
        query: dict[str, str] = {
            "inputMint": input_mint,
            "outputMint": output_mint,
            "amount": str(amount_raw),
        }
        if taker:
            query["taker"] = taker
        if slippage_bps is not None:
            query["slippageBps"] = str(int(slippage_bps))
        if priority_fee_lamports > 0:
            query["priorityFeeLamports"] = str(int(priority_fee_lamports))
        try:
            payload = request_json(
                "GET",
                f"{SWAP_BASE}/order",
                query=query,
                headers=self._headers(),
                timeout=30,
            )
        except HttpError as exc:
            raise JupiterError(f"order failed: {exc} {exc.body}") from exc
        if not isinstance(payload, dict):
            raise JupiterError("order response was not an object")
        if payload.get("error") or payload.get("errorCode") or payload.get("errorMessage"):
            raise JupiterError(
                f"order refused: {payload.get('errorMessage') or payload.get('error') or payload.get('errorCode')}"
            )
        return payload

    def execute(self, signed_transaction: str, request_id: str) -> dict[str, Any]:
        if not signed_transaction or not request_id:
            raise JupiterError("execute needs a signed transaction and requestId")
        try:
            payload = request_json(
                "POST",
                f"{SWAP_BASE}/execute",
                payload={
                    "signedTransaction": signed_transaction,
                    "requestId": request_id,
                },
                headers=self._headers(),
                timeout=45,
                retries=1,
            )
        except HttpError as exc:
            raise JupiterError(f"execute failed: {exc} {exc.body}") from exc
        if not isinstance(payload, dict):
            raise JupiterError("execute response was not an object")
        return payload


def impact_percent(order: dict[str, Any]) -> float:
    """Return price impact as a percent number (0.5 means 0.5%).

    Issue #10 A6: detect unit by field name, not magnitude.
    - priceImpact / priceImpactPct from Jupiter v2 are already percent.
    - Only scale when the key is an explicit fraction field.
    """
    if order.get("priceImpact") is not None:
        return abs(float(order["priceImpact"]))
    if order.get("priceImpactPct") is not None:
        return abs(float(order["priceImpactPct"]))
    raw = order.get("priceImpactFraction")
    if raw is not None:
        return abs(float(raw)) * 100.0
    return 0.0


def quote_edge_percent(order: dict[str, Any]) -> float | None:
    in_usd = order.get("inUsdValue")
    out_usd = order.get("outUsdValue")
    if in_usd is None or out_usd is None:
        return None
    in_usd = float(in_usd)
    out_usd = float(out_usd)
    if in_usd <= 0:
        return None
    return (out_usd / in_usd - 1.0) * 100.0


def sol_mint() -> str:
    return SOL_MINT
