# Vault and bot program security review

**Review type:** Focused internal source review; not an independent audit.  
**Reviewed files:** `programs/vault/src/lib.rs`, `programs/vault-checks/src/lib.rs`, and related tests.  
**Release status:** Source now includes owner-signed SOL deposits/share redemption and an owner-managed executor policy. Automated swaps, position settlement and all fee movement remain fail-closed. The program is not deployed; do not send funds to it.

## Findings and current treatment

| Severity | Area | Finding | Current mitigation / remaining work |
|---|---|---|---|
| Critical | Swap execution | The previous path did not bind SPL token accounts to declared mints or enforce stored position/slippage limits. | `execute_swap` returns `TradingDisabled`; no CPI occurs. |
| Critical | Legacy withdrawal | The legacy direct-amount `withdraw` changed lamports without burning shares or decrementing accounted assets, allowing share-accounting bypass. | Legacy instruction now returns `LegacyWithdrawDisabled`; use owner-only `withdraw_vault` share redemption. |
| Critical | Creator fee claim | Previous claim could transfer vault lamports without decrementing available accounting and did not prove slot/vault owner consistency. | Claim returns `FeeSettlementDisabled`. |
| Critical | Creator fee accrual | Previous instruction trusted caller-supplied realized profit without proving a confirmed, reconciled position close. | Accrual returns `FeeSettlementDisabled`. |
| High | Exit settlement | Previous `settle_exit` accepted an arbitrary signer and changed accounting without verified position close. | `settle_exit` returns `TradingDisabled`. |
| High | Executor controls | Legacy `set_executor` / `revoke_executor` were no-op stubs. | Legacy entry points now return `ExecutorPolicyRequired`. New owner-only `ExecutorPolicy` PDA supports configuration, rotation and immediate revocation. |
| High | Spending limits | Stored executor policy must enforce trade size, daily allowance, current vault assets and slippage. | Policy validates max trade >= 0.001 SOL, max trade <= daily cap <= current accounted assets, and slippage <= 1,000 bps. Pure Rust daily-spend helper is tested but is not yet wired into swap execution. |
| High | Global configuration | First caller could initialize the singleton authority and fee recipients. | `initialize_global_config` returns `GlobalConfigInitDisabled` until a deployment-specific bootstrap authority is pinned. |
| High | Bot registry and user-slot consent | Earlier registry stored unvalidated position/slippage values; slots were not bound to an enabled registry. | Registration now validates strategy hash, allocation, slippage and fee ranges. User-slot creation requires an enabled registry and snapshots strategy hash/version and risk limits. The future swap path must still enforce that snapshot. |
| High | Creation fee | Previous fee instruction did not enforce idempotent bot nonce handling and recipient verification. | Fee collection returns `FeeSettlementDisabled`. |

## Implemented source controls

- Owner-signed SOL deposit through the System Program transfer CPI.
- Proportional share minting against current accounted assets and share supply, with checked arithmetic and an accounting invariant.
- Owner-only share redemption with rent-exemption protection.
- Owner pause/resume.
- Per-vault executor policy PDA with owner/vault binding, versioned rotation, trade/day/slippage limits, and immediate owner revocation.
- Bot registry validation and owner-signed user-slot creation with immutable strategy hash/version and risk-limit snapshots.
- Pure Rust daily-spend authorization helper with per-trade ceiling, daily cap and monotonic UTC-day rollover tests.
- Fail-closed legacy direct withdrawal, legacy executor setters, global config initialization, swap, settlement and fee movement.

## Important limitations

The executor policy is not an active trading permission. The `execute_swap` instruction still returns `TradingDisabled`, and the daily-spend helper is not wired to any fund-moving instruction. No Jupiter CPI or SPL-token transfer path is enabled. The program ID is an undeployed placeholder. Anchor SBF build, local-validator transaction tests, property/fuzz/invariant tests and independent audit remain outstanding.

## Required before any instruction is re-enabled

1. Pin deployment-specific bootstrap authority and upgrade/emergency policy.
2. Enforce the stored user-slot strategy hash/version and risk snapshot in every future swap instruction.
3. Implement strict Jupiter CPI account validation and token-account/mint/owner checks.
4. Consume executor policy atomically with exact-next nonce, max trade, daily cap, slippage, available-balance and policy-version checks.
5. Reconcile actual pre/post token balances and derive realized P&L only from verified fills.
6. Add local-validator, adversarial, property, fuzz and invariant tests.
7. Complete an independent Solana/Anchor audit and remediate every finding.
