from __future__ import annotations

import time
from typing import Any

from welp.config import USDC_MINT, USDT_MINT
from welp.http import HttpError, request_json


class RpcError(RuntimeError):
    pass


def _rpc(url: str, method: str, params: list[Any]) -> Any:
    try:
        payload = request_json(
            "POST",
            url,
            payload={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
            timeout=30,
        )
    except HttpError as exc:
        raise RpcError(str(exc)) from exc
    if not isinstance(payload, dict):
        raise RpcError("rpc response was not an object")
    if payload.get("error"):
        raise RpcError(str(payload["error"]))
    return payload.get("result")


def sol_lamports(url: str, owner: str) -> int:
    result = _rpc(url, "getBalance", [owner, {"commitment": "confirmed"}])
    return int((result or {}).get("value") or 0)


def token_raw(url: str, owner: str, mint: str) -> int:
    total = 0
    rows = _accounts(url, owner, mint)
    for row in rows:
        info = (((row.get("account") or {}).get("data") or {}).get("parsed") or {}).get("info") or {}
        if info.get("mint") != mint:
            continue
        amount = ((info.get("tokenAmount") or {}).get("amount")) or "0"
        total += int(amount)
    return total


def _accounts(url: str, owner: str, mint: str) -> list[dict[str, Any]]:
    result = _rpc(
        url,
        "getTokenAccountsByOwner",
        [owner, {"mint": mint}, {"encoding": "jsonParsed", "commitment": "confirmed"}],
    )
    return list((result or {}).get("value") or [])


def stable_usd(url: str, owner: str) -> float:
    usd = 0.0
    for mint, decimals in ((USDC_MINT, 6), (USDT_MINT, 6)):
        raw = token_raw(url, owner, mint)
        usd += raw / (10**decimals)
    return usd


def confirm(url: str, signature: str, timeout: float = 50.0) -> str:
    deadline = time.time() + timeout
    last = "pending"
    while time.time() < deadline:
        result = _rpc(
            url,
            "getSignatureStatuses",
            [[signature], {"searchTransactionHistory": True}],
        )
        value = ((result or {}).get("value") or [None])[0]
        if value:
            if value.get("err"):
                raise RpcError(f"transaction {signature} failed on-chain: {value['err']}")
            status = value.get("confirmationStatus") or ""
            last = status or "seen"
            if status in ("confirmed", "finalized"):
                return status
        time.sleep(1.2)
    raise RpcError(f"transaction {signature} not confirmed ({last})")


def dynamic_priority_fee(url: str, floor: int = 1_000, ceiling: int = 200_000) -> int:
    """p75 of recent prioritization fees, floored and capped (issue #5)."""
    try:
        result = _rpc(url, "getRecentPrioritizationFees", [[]])
    except Exception:
        return floor
    fees: list[int] = []
    for row in result or []:
        try:
            fees.append(int(row.get("prioritizationFee") or 0))
        except (TypeError, ValueError):
            continue
    if not fees:
        return floor
    fees.sort()
    idx = max(0, min(len(fees) - 1, int(len(fees) * 0.75) - 1))
    value = fees[idx]
    return max(floor, min(ceiling, value if value > 0 else floor))
