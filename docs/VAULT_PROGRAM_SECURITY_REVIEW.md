# Vault and bot program security review

**Review type:** focused internal source review for release blockers; not an independent audit.  
**Reviewed file:** `programs/vault/src/lib.rs` and the related build specification.  
**Release status:** funding, automated swaps, position settlement, and all fee movement are fail-closed in this branch. Do not deploy the scaffold or accept deposits.

## Immediate code-level blockers found

The following issues were identified in the pre-hardening instruction bodies. They are documented so the original implementation is not accidentally restored during the port.

| Severity | Area | Finding | Current mitigation |
|---|---|---|---|
| Critical | Swap execution | The prior `execute_swap` path used vault lamports as the spend check while operating on SPL token accounts; it did not bind source/destination token-account mints to the declared input/output mints, and did not enforce the stored bot position/slippage limits. | Instruction now returns `TradingDisabled`. |
| Critical | Creator fee claim | The prior claim path transferred lamports out of a vault without decrementing the vault's available accounting, and the account constraints did not prove that the fee-bearing user slot belonged to the same vault owner. | Claim instruction now returns `FeeSettlementDisabled`. |
| Critical | Creator fee accrual | The prior instruction accepted `realized_profit_lamports` as caller-supplied input and did not prove it came from a confirmed, reconciled position close. The authority signer was not constrained to an owner/executor policy. | Accrual instruction now returns `FeeSettlementDisabled`. |
| High | Exit settlement | The prior `settle_exit` context accepted any signer and changed vault available accounting without a verified position close or owner/executor authorization. | Settlement instruction now returns `TradingDisabled`. |
| High | Bot registry | `register_bot` stored max-position and max-slippage values without validating their ranges; `create_user_slot` did not require a corresponding registered bot account. The execution path also did not enforce the stored registry settings. | Trading is disabled. Registry validation and binding are prerequisites to re-enabling it. |
| High | Executor controls | Legacy `set_executor` and `revoke_executor` handlers are no-op compatibility stubs. They must not be treated as working authority controls. | No executor is configured or enabled. |
| High | Global configuration | `initialize_global_config` is a first-writer singleton initializer. The first transaction can set the authority and fee recipient unless deployment is initialized atomically and the authority is independently verified. | Fee collection is disabled; deploy-time authority design remains open. |
| High | Creation fee | The previous `charge_creation_fee` ignored its bot nonce and had no one-time-per-bot idempotency guard. The fee recipient/configuration also needs verified initialization and denomination handling. | Fee collection now returns `FeeSettlementDisabled`. |

## Fail-closed changes in this branch

The following Anchor instructions now return explicit errors without moving funds or invoking a route:

- `fund_vault` → `FundingDisabled`
- `execute_swap` → `TradingDisabled`
- `settle_exit` → `TradingDisabled`
- `settle_creator_fee` → `FeeSettlementDisabled`
- `claim_creator_fee` → `FeeSettlementDisabled`
- `charge_creation_fee` → `FeeSettlementDisabled`

Owner withdrawal/recovery instructions remain in the source, but their safety has not been independently audited. No user funds should be sent to this program. The placeholder program ID remains unlaunched and must not be used to derive a funding address.

A source-level regression test now checks that these instructions remain fail-closed. This test does not replace Anchor compilation, local-validator transaction tests, or an independent audit.

## Required work before any instruction is re-enabled

1. Define and implement a verified deployment-authority and emergency-pause model for the singleton configuration.
2. Bind every user slot to an existing, enabled bot registry and enforce immutable strategy hash/version, max position, max slippage, asset allowlist and owner consent.
3. Use monotonic or exact-next nonces with replay protection and explicit expiry/slot-version binding.
4. Bind token accounts to their declared mint and owner; validate all CPI account metas and program IDs; reconcile actual pre/post token balances.
5. Replace the mixed SOL-lamport/SPL-token accounting with an explicit, audited asset/share ledger. A lamport amount must never be used as a token-unit balance.
6. Derive realized P&L from confirmed transaction effects and tracked cost basis, including fees, slippage, decimals, partial exits and failed transactions. Do not accept arbitrary profit values from callers.
7. Make creator fee accrual and payout atomic, idempotent, owner/registry-bound and fully reconciled against vault available assets and liabilities.
8. Make the $0.10 activation fee idempotent per bot creation and settle 40/60 atomically only after the verified recipient, USDC denomination/rounding and treasury derivation are approved.
9. Implement meaningful executor set/rotate/revoke/pause instructions and test every authority transition, including compromised keeper recovery.
10. Reject unsupported token programs and extensions until Token-2022 and all transfer semantics are explicitly supported.
11. Run Anchor 0.30.1 build, generated IDL checks, local-validator integration tests, fuzz/property/invariant tests, adversarial tests and an independent audit against the exact release commit.
12. Verify deployed Mainnet-Beta program ID and bytecode, upgrade authority, configuration, indexer reconciliation and incident-response procedures before a release decision.

## Toolchain and validation note

The repository CI currently performs host Rust formatting, Clippy and crate checks. It does not perform an Anchor SBF build or transaction-level program tests. A passing host check is not evidence that this program compiles for Solana BPF/SBF or is safe to deploy.

Until every item above is completed and independently reviewed, keep the program unlaunched, keep vault funding and bot execution disabled, and do not publish a deposit address.
