# WELP UP! vault threat model

**Status:** Source implementation in progress; not deployed to Devnet or Mainnet and not independently audited. The source supports owner-signed SOL deposits, share-based withdrawals, and owner-managed executor policy configuration/revocation. Automated swaps remain disabled.

## Security goals

- Keep the user's primary wallet key outside the agent and vault program.
- Require an explicit owner signature for SOL deposits and withdrawals.
- Price shares against current accounted assets and outstanding shares.
- Preserve rent and prevent legacy amount-based withdrawals from bypassing share accounting.
- Let the owner configure or revoke one delegated executor without exposing private keys.
- Store per-trade, per-day and slippage limits on-chain before any trading instruction can be enabled.
- Keep all trading, settlement and fee movement fail-closed until verified CPI and accounting paths exist.

## Accounts and authority

| Actor/account | Authority |
|---|---|
| Owner wallet | Signs deposit, share redemption, pause/resume, executor configuration and revocation |
| Vault PDA | Holds SOL and records accounted assets/share supply |
| ExecutorPolicy PDA | Records executor public key and configured limits; contains no private key |
| Executor key | Intended future caller for narrow trade instruction; currently cannot trade |
| Bot registry / user slot | Metadata and per-bot state; neither grants swap authority by itself |
| Jupiter / token programs / RPCs | External dependencies; treated as untrusted until account and balance checks are implemented |

PDA derivations:
- Vault: `[b"vault-v1", owner]`
- Executor policy: `[b"executor-policy-v1", vault]`
- User slot: `[b"user-slot-v1", owner, bot_account]`
- Bot registry: `[b"bot-registry-v1", creator, bot_account]`

## Current mitigations in source

1. **Unauthorized withdrawal:** share redemption requires the vault owner signer and matching vault PDA. The legacy direct-amount withdrawal returns an explicit error.
2. **Share-price manipulation via lifetime deposits:** new shares are calculated using current accounted assets and outstanding shares, with checked arithmetic and a consistency invariant.
3. **Executor key misuse:** policy configuration is owner-signed, bound to the owner's vault PDA, and versioned. The owner can revoke it without executor cooperation.
4. **Excessive policy values:** max trade must be at least 0.001 SOL, no greater than the daily cap; daily cap cannot exceed current accounted assets; max slippage is at most 10%.
5. **Daily reset manipulation:** the pure Rust spend-check helper resets only when the UTC day index advances. A backwards clock does not reset spend.
6. **Premature global authority:** global configuration initialization is disabled until a deployment-specific bootstrap authority is pinned.
7. **Unreviewed trading:** `execute_swap` and `settle_exit` return `TradingDisabled`; no Jupiter CPI occurs and no position accounting is changed.
8. **Unverified fee movement:** creator-fee accrual/claims and bot-creation fee collection return `FeeSettlementDisabled`.

## Explicit gaps

- The executor policy is configuration groundwork only. The daily spend helper is not wired into a swap instruction and no daily spend is currently consumed.
- No Jupiter CPI, SPL-token custody/withdrawal, mint/account validation, exact-next order nonce, fill reconciliation or P&L settlement is active.
- The vault account's placeholder program ID is not a valid deployment address.
- Local-validator transaction tests, fuzzing, independent audit, secure upgrade authority, monitoring and incident response are outstanding.
- The web vault UI must not derive a fundable address or accept deposits.

## Launch rule

No Devnet or Mainnet deployment or real-fund acceptance until the program ID is finalized, SBF build and validator tests pass, an independent audit is completed, all findings are fixed, and upgrade/emergency authorities and recovery procedures are reviewed.
