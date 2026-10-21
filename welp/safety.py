"""On-chain mint risk checks before buying (issue #3)."""
from __future__ import annotations

from typing import Any

from welp.http import HttpError, request_json


class MintRiskError(RuntimeError):
    pass


def _rpc(url: str, method: str, params: list[Any]) -> Any:
    payload = request_json(
        "POST",
        url,
        payload={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=30,
    )
    if not isinstance(payload, dict):
        raise MintRiskError("rpc response was not an object")
    if payload.get("error"):
        raise MintRiskError(str(payload["error"]))
    return payload.get("result")


def mint_risk(rpc_url: str, mint: str, max_transfer_fee_bps: int = 500) -> str | None:
    """
    Return a refusal reason or None if the mint looks tradeable.
    Rejects live freeze authority and Token-2022 transfer fees above max_transfer_fee_bps.
    """
    try:
        result = _rpc(
            rpc_url,
            "getAccountInfo",
            [mint, {"encoding": "jsonParsed", "commitment": "confirmed"}],
        )
    except (HttpError, MintRiskError) as exc:
        return f"mint lookup failed: {exc}"
    value = (result or {}).get("value")
    if not value:
        return "mint account missing"
    data = value.get("data")
    if not isinstance(data, dict):
        return None
    parsed = data.get("parsed") or {}
    info = parsed.get("info") or {}
    freeze = info.get("freezeAuthority")
    if freeze:
        return f"live freeze authority {freeze}"
    extensions = info.get("extensions") or []
    for ext in extensions:
        if not isinstance(ext, dict):
            continue
        if ext.get("extension") == "transferFeeConfig":
            state = ext.get("state") or {}
            newer = state.get("newerTransferFee") or state.get("olderTransferFee") or {}
            fee_bps = int(newer.get("transferFeeBasisPoints") or 0)
            if fee_bps > max_transfer_fee_bps:
                return f"transfer fee {fee_bps} bps exceeds {max_transfer_fee_bps}"
    return None
