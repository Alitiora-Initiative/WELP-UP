from __future__ import annotations

import time
from typing import Any

from welp.config import SOL_MINT, USDC_MINT, USDT_MINT
from welp.http import HttpError, request_json


class RpcError(RuntimeError):
    pass


TOKEN_PROGRAMS = (
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
)


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


def account_data(url: str, address: str) -> tuple[str, bytes]:
    """Return the owning program and raw bytes for an on-chain account."""
    result = _rpc(
        url,
        "getAccountInfo",
        [address, {"encoding": "base64", "commitment": "confirmed"}],
    )
    value = (result or {}).get("value")
    if not isinstance(value, dict):
        raise RpcError(f"account {address} was not found")
    data = value.get("data")
    if not isinstance(data, list) or len(data) < 1:
        raise RpcError(f"account {address} returned no base64 data")
    import base64

    try:
        raw = base64.b64decode(data[0], validate=True)
    except (ValueError, TypeError) as exc:
        raise RpcError(f"account {address} returned invalid base64 data") from exc
    return str(value.get("owner") or ""), raw


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


def token_balances(url: str, owner: str) -> dict[str, dict[str, int]]:
    """List non-zero classic and Token-2022 balances owned by a wallet."""
    balances: dict[str, dict[str, int]] = {}
    for program_id in TOKEN_PROGRAMS:
        result = _rpc(
            url,
            "getTokenAccountsByOwner",
            [owner, {"programId": program_id}, {"encoding": "jsonParsed", "commitment": "confirmed"}],
        )
        for row in (result or {}).get("value") or []:
            info = (((row.get("account") or {}).get("data") or {}).get("parsed") or {}).get("info") or {}
            mint = str(info.get("mint") or "")
            token = info.get("tokenAmount") or {}
            try:
                raw = int(token.get("amount") or 0)
                decimals = int(token.get("decimals") or 0)
            except (TypeError, ValueError):
                continue
            if mint and raw > 0 and mint not in {SOL_MINT, USDC_MINT, USDT_MINT}:
                current = balances.setdefault(mint, {"amount": 0, "decimals": decimals})
                current["amount"] += raw
                current["decimals"] = decimals
    return balances


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


def signature_status(url: str, signature: str) -> tuple[str | None, str | None]:
    result = _rpc(
        url,
        "getSignatureStatuses",
        [[signature], {"searchTransactionHistory": True}],
    )
    value = ((result or {}).get("value") or [None])[0]
    if not value:
        return None, None
    if value.get("err"):
        return "failed", str(value["err"])
    status = str(value.get("confirmationStatus") or "seen")
    if status in ("confirmed", "finalized"):
        return status, None
    return status, None
