from __future__ import annotations

from welp.rpc import account_data

TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"


class MintRiskError(RuntimeError):
    pass


def validate_mint_account(owner: str, raw: bytes) -> None:
    """Fail closed unless this is an initialized, classic SPL mint with no freeze authority."""
    if owner == TOKEN_2022_PROGRAM_ID:
        raise MintRiskError("Token-2022 mints are not supported until all transfer extensions are validated")
    if owner != TOKEN_PROGRAM_ID:
        raise MintRiskError("mint is not owned by the classic SPL Token Program")
    if len(raw) != 82:
        raise MintRiskError("classic SPL mint has an invalid account size")
    if raw[45] != 1:
        raise MintRiskError("mint is not initialized")

    freeze_authority_option = int.from_bytes(raw[46:50], "little")
    if freeze_authority_option == 1:
        raise MintRiskError("mint has a live freeze authority")
    if freeze_authority_option != 0:
        raise MintRiskError("mint has an invalid freeze-authority option")


def ensure_mint_safe(rpc_url: str, mint: str) -> None:
    owner, raw = account_data(rpc_url, mint)
    validate_mint_account(owner, raw)
