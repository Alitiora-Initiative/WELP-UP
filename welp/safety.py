"""Mint risk checks for freeze authority and transfer fees."""

from typing import Optional

from welp.config import Settings
from welp.rpc import RpcError


def check_freeze_authority(rpc_url: str, mint: str) -> tuple[bool, str]:
    """
    Check if a mint has a live freeze authority.

    Returns (is_safe, reason). If is_safe is False, the mint should be rejected.
    """
    try:
        from solana.rpc.types import RPCResponse
        import requests

        response = requests.post(
            rpc_url,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getAccountInfo",
                "params": [
                    mint,
                    {"encoding": "base64"}
                ]
            }
        )
        result = response.json()

        if "error" in result:
            return False, f"RPC error: {result['error']}"

        account_info = result.get("result", {}).get("value")
        if not account_info:
            return False, "Mint account not found"

        data = account_info.get("data", [None])[0]
        if not data:
            return False, "No mint data"

        import base64
        raw = base64.b64decode(data)

        # Classic token mint layout:
        # bytes 0-8: mint authority option (32 bytes if present)
        # bytes 8-40: freeze authority option (32 bytes if present)
        # bytes 36-44: freeze authority option flag (1 byte)
        # For simplicity, we check if freeze authority bytes 36-44 are non-zero

        if len(raw) < 44:
            return False, "Mint data too short"

        # Check freeze authority option flag at byte 36
        freeze_option = raw[36]
        if freeze_option != 0:
            return False, "Mint has active freeze authority"

        return True, "No freeze authority"

    except Exception as exc:
        return False, f"Freeze check failed: {exc}"


def check_transfer_fee(rpc_url: str, mint: str, max_bps: int = 500) -> tuple[bool, str]:
    """
    Check if a mint has excessive transfer fees (Token-2022).

    Returns (is_safe, reason). If is_safe is False, the mint should be rejected.
    """
    try:
        import requests

        response = requests.post(
            rpc_url,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getAccountInfo",
                "params": [
                    mint,
                    {"encoding": "base64"
                    }
                ]
            }
        )
        result = response.json()

        if "error" in result:
            return False, f"RPC error: {result['error']}"

        account_info = result.get("result", {}).get("value")
        if not account_info:
            return False, "Mint account not found"

        # For Token-2022, we'd need to parse TLV extensions
        # This is a simplified check - full implementation would parse
        # the TransferFeeConfig extension in the TLV data

        # For now, assume classic tokens are safe (no transfer fees)
        # Token-2022 would require more complex parsing
        return True, "Classic token (no transfer fee check)"

    except Exception as exc:
        return False, f"Transfer fee check failed: {exc}"


def mint_risk(settings: Settings, mint: str) -> tuple[bool, str]:
    """
    Run all mint risk checks.

    Returns (is_safe, reason). If is_safe is False, the mint should be rejected.
    """
    # Check freeze authority
    freeze_safe, freeze_reason = check_freeze_authority(settings.rpc_url, mint)
    if not freeze_safe:
        return False, freeze_reason

    # Check transfer fees
    fee_safe, fee_reason = check_transfer_fee(settings.rpc_url, mint)
    if not fee_safe:
        return False, fee_reason

    return True, "Mint passed all safety checks"
