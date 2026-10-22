from __future__ import annotations

import base64
import json

from solders.keypair import Keypair
from solders.transaction import VersionedTransaction


class WalletError(RuntimeError):
    pass


def load_keypair(secret: str) -> Keypair:
    text = secret.strip()
    if not text:
        raise WalletError("empty private key")
    if text.startswith("["):
        try:
            raw = bytes(json.loads(text))
        except (json.JSONDecodeError, ValueError) as exc:
            raise WalletError("private key JSON is invalid") from exc
        if len(raw) != 64:
            raise WalletError("JSON private key must be 64 bytes")
        return Keypair.from_bytes(raw)
    try:
        return Keypair.from_base58_string(text)
    except Exception as exc:
        raise WalletError("private key is not base58 or a 64-byte JSON array") from exc


def sign_swap(transaction_b64: str, keypair: Keypair) -> str:
    if not transaction_b64:
        raise WalletError("Jupiter returned no transaction")
    # Validate that the keypair is valid and not empty
    if not keypair.pubkey():
        raise WalletError("Invalid keypair: no public key")
    raw = base64.b64decode(transaction_b64)
    tx = VersionedTransaction.from_bytes(raw)
    try:
        signed = VersionedTransaction(tx.message, [keypair])
    except TypeError:
        from solders.message import to_bytes_versioned

        signature = keypair.sign_message(to_bytes_versioned(tx.message))
        signed = VersionedTransaction.populate(tx.message, [signature])
    return base64.b64encode(bytes(signed)).decode()
