from __future__ import annotations


class WalletError(RuntimeError):
    pass


def load_keypair(*_args, **_kwargs):
    raise WalletError("Wallet secrets are not accepted. Actions run only after a wallet connects on the website.")


def sign_swap(*_args, **_kwargs):
    raise WalletError("Signing is refused in this process. A swap runs only after a wallet connects on the website.")
