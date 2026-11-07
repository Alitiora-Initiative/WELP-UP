# WELP UP! vault architecture

**Status:** Anchor source implementation in progress. The source includes owner-controlled SOL share accounting and a per-vault executor policy PDA. It is not deployed to Devnet or Mainnet, has not received an independent audit, and does not execute swaps. The website must not accept vault deposits.

## Design

WELP uses an Anchor program with one vault PDA per owner. The owner keeps their primary wallet key and explicitly signs vault funding, share withdrawals, policy configuration and executor revocation. A separate public executor key is stored in a per-vault policy account; the program never stores the executor's private key.

## Program-derived accounts

| Account | Seeds | Purpose |
|---|---|---|
| `Vault` | `[b"vault-v1", owner]` | SOL accounting and share supply |
| `ExecutorPolicy` | `[b"executor-policy-v1", vault]` | Delegated executor key and limits |
| `UserSlot` | `[b"user-slot-v1", owner, bot_account]` | Owner-approved per-bot state and immutable strategy/risk snapshot |
| `BotRegistry` | `[b"bot-registry-v1", creator, bot_account]` | Bot metadata; registration does not authorize swaps |
| `GlobalConfig` | `[b"global-config-v1"]` | Reserved singleton; initialization is currently disabled |

## Vault accounting

The vault records:
- `owner`: the wallet that controls the vault.
- `available_lamports`: accounted SOL assets available to share holders.
- `total_shares`: outstanding share supply.
- `total_deposited_lamports`: lifetime deposit counter for reporting only.
- `state`: Funded, Active, Paused, Stopping or Closed.
- `bump` and `created_at`.

A deposit is an explicit owner-signed System Program transfer. Shares are priced against current accounted assets and outstanding shares, not lifetime deposits. Arithmetic uses checked operations; inconsistent zero/nonzero asset/share state is rejected. A withdrawal burns shares and returns their pro-rata share of accounted SOL while preserving the vault account's rent reserve. Direct SOL donations are not automatically counted as share-bearing assets.

## Executor policy

The `ExecutorPolicy` PDA stores:
- owner and vault public keys, both bound to the PDA.
- one executor public key.
- maximum SOL per trade.
- maximum aggregate SOL spend per UTC day.
- current daily spend and day index.
- maximum slippage in basis points.
- enabled flag, policy version and PDA bump.

The owner may configure or rotate the executor only when the vault is Active or Paused. The configured executor cannot equal the owner or the zero key. The maximum trade must be at least 0.001 SOL, cannot exceed the daily cap, and the daily cap cannot exceed currently accounted vault assets. Maximum slippage is capped at 1,000 bps (10%). Reconfiguration increments the policy version. The owner can revoke the executor immediately; revocation clears the executor and limits and increments the version.

A pure Rust authorization helper validates executor identity, enabled state, per-trade size, daily cap and UTC-day rollover. It deliberately refuses to reset spend when the observed clock moves backwards.

## Bot registry and user-slot consent

Bot registration rejects a zero strategy hash, zero or greater-than-100% position allocation, slippage above 10%, invalid fee basis points, and a bot identity equal to the creator. Creating a `UserSlot` requires an existing enabled `BotRegistry` PDA. The owner-signed creation snapshots the registry's strategy hash, version, maximum position allocation and slippage into the slot. A future swap instruction must compare and enforce that snapshot; current `execute_swap` remains disabled.

**Important:** The helper and policy account are not yet consumed by a swap instruction. No daily spend is currently recorded on-chain because `execute_swap` is deliberately fail-closed. The policy is configuration groundwork, not live trading authorization.

## Instruction status

| Instruction | Status |
|---|---|
| `create_vault` | Implemented in source |
| `fund_vault` | Owner-signed SOL deposit and proportional share minting implemented in source |
| `withdraw_vault` | Owner-only share redemption implemented in source |
| `pause_vault` / `resume_vault` | Owner-only state transitions implemented in source |
| `configure_executor_policy` | Owner-only per-vault executor and spending policy implemented in source |
| `revoke_executor_policy` | Owner-only immediate executor revocation implemented in source |
| `register_bot` | Validates strategy hash, allocation, slippage and fee metadata in source |
| `create_user_slot` | Requires an enabled bot registry and snapshots the owner's approved strategy/risk settings |
| `execute_swap` | Returns `TradingDisabled`; no CPI or token movement |
| `settle_exit` | Returns `TradingDisabled`; no caller-supplied P&L accepted |
| Creator-fee settlement/claim | Returns `FeeSettlementDisabled` |
| Bot-creation fee collection | Returns `FeeSettlementDisabled` |
| Legacy `withdraw` | Returns `LegacyWithdrawDisabled` to prevent bypassing share accounting |
| Legacy `set_executor` / `revoke_executor` | Return `ExecutorPolicyRequired`; use versioned policy instructions |
| `initialize_global_config` | Disabled until a deployment-specific bootstrap authority is pinned |
| Legacy `initialize` | Disabled because its cap arguments were never persisted or enforced |

## What remains before delegated trading

1. Pin a deployment-specific bootstrap authority and define upgrade/emergency authority.
2. Enforce the user-slot strategy hash/version snapshot and registry risk limits in the future swap path; creation-time binding is now implemented.
3. Implement a narrow Jupiter CPI path with strict program, account-meta, token-account owner/mint, mint allowlist, and pre/post balance checks.
4. Consume the executor policy atomically: exact-next nonce, per-trade cap, daily cap, current available balance, slippage ceiling and policy version.
5. Derive realized P&L from reconciled on-chain fills; never trust caller-supplied profit.
6. Add Anchor local-validator tests, fuzz/property/invariant tests and adversarial account-composition tests.
7. Complete an independent Solana/Anchor audit and remediate findings.

## Build and release

The checked-in `Anchor.toml` targets localnet. The program ID in source is a placeholder. No Devnet or Mainnet deployment is approved. Do not derive a fundable address or send SOL to this source build. The website's vault funding UI remains disabled.

Host-side pure checks:

```bash
cargo test --manifest-path programs/vault-checks/Cargo.toml
```

Anchor build and validator tests, once the local toolchain is installed:

```bash
anchor build -p welp-vault
anchor test
```
