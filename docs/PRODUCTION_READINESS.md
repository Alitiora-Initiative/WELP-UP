# Production readiness checklist

**Status as of 2026-11-06: not approved for real-money vault custody or autonomous trading.**

This checklist distinguishes working public-data and wallet-approved features from infrastructure that is only designed, scaffolded, or absent. Do not change a status to complete without reproducible evidence linked in this document.

## Currently implemented in the web application

- [x] Wallet connection and public wallet balance reads.
- [x] Live market/token data and deterministic signal evaluation.
- [x] Jupiter Swap API v2 order request and signed-order execution path.
- [x] Solana RPC transaction-signature history for a wallet address.
- [x] Browser-local activity snapshots and display preferences.
- [ ] Server-side account identity and durable per-user data.
- [ ] Verified end-to-end transaction reconciliation for every trade and vault event.

## Current Anchor program source status (executor-policy-foundation)

- [x] Added a server-side read-only market analyst route. It consumes the live Jupiter snapshot and requires a server-only OpenAI API key; it has no wallet, transaction, or bot tools.
- [x] Added bounded snapshot sanitization and response parsing tests for the analyst.
- [x] Implemented owner-signed SOL deposits through the System Program CPI, proportional share minting, and overflow-safe accounting in the Anchor source.
- [x] Implemented owner-only share redemption, including rent-exemption checks; owner pause/resume remains available.
- [x] Added source-level regression tests for deposits, owner-controlled executor policy, legacy withdrawal protection, and fail-closed instructions.
- [x] Added a per-vault ExecutorPolicy PDA with owner-only configure/rotate/revoke instructions, max trade, daily cap, slippage ceiling, and policy versioning.
- [x] Added pure Rust daily-spend authorization checks and UTC-day rollover tests. These checks are not yet wired into a swap instruction; no executor can trade.
- [x] Disabled the unsafe legacy amount-based withdrawal, no-op executor setters, and first-caller global configuration initializer.
- [x] Validated bot registry strategy hash, position allocation, slippage and fee parameters.
- [x] Bound user-slot creation to an enabled bot registry and snapshot the owner-approved strategy hash, registry version and risk limits.
- [ ] Add Anchor local-validator integration tests for deposit, partial/full withdrawal, paused-vault recovery, repeated deposits after withdrawals, direct SOL donations, and rent preservation.
- [ ] Run all GitHub CI checks for the latest branch commit and resolve any failures.
- [ ] Run Anchor 0.30.1 SBF build, IDL validation, local-validator transaction tests for deposit/withdraw/policy configure/revoke, and independent security audit. These remain outstanding.
- [ ] Add a durable shared rate limiter and provider spend controls before enabling the public AI endpoint broadly.
- [ ] Configure `OPENAI_API_KEY` and `WELP_AI_MODEL` in Vercel Preview and test a real response. No provider credential was available during implementation.

See [AI_AGENT_RUNTIME.md](AI_AGENT_RUNTIME.md) and [VAULT_PROGRAM_SECURITY_REVIEW.md](VAULT_PROGRAM_SECURITY_REVIEW.md). These checkboxes describe code added in this branch, not production deployment or a release approval.

## Mainnet vault launch gates

- [ ] Final program ID generated from the reviewed source and keypair.
- [ ] Mainnet deployment completed and source verified against deployed bytecode.
- [ ] Independent audit by a qualified Solana/Anchor security firm, with findings remediated.
- [ ] Property, fuzz, invariant, and adversarial tests for share accounting, rounding, rent, token accounts, CPI account validation, re-entrancy-like composition risks, and emergency paths.
- [ ] SPL-token deposits and withdrawals implemented and tested, not just SOL.
- [ ] Jupiter CPI route validation and token accounting implemented. The current scaffold intentionally disables swap execution.
- [ ] Wire executor policy and each user-slot strategy/risk snapshot into an audited swap instruction so per-trade, daily spend, slippage, policy version, nonce, and available-balance limits are enforced atomically. UI limits alone are not security controls.
- [ ] Verify owner pause, implemented executor-policy revocation, and share-withdrawal recovery under local-validator failure conditions.
- [ ] Upgrade authority policy selected, documented, and secured (prefer a reviewed multisig or immutable deployment after upgrade window).
- [ ] Monitoring, incident response, pause authority, recovery runbook, and independent RPC/indexer redundancy.
- [ ] Mainnet integration tests and independent transaction-level verification.
- [ ] Legal, consumer-protection, tax, sanctions, and operating-jurisdiction review before accepting public deposits.

**Until every gate above is complete, the app must not derive or advertise a fundable mainnet vault address and must not accept deposits.** Do not point the app at the placeholder program ID.

## Agent and copy-trading launch gates

- [ ] Defined strategy runtime with explicit user consent, per-vault scope, kill switch, and deterministic execution policy.
- [ ] No user seed phrases or wallet private keys stored by the operator.
- [ ] Delegated executor key isolation, rotation, monitoring, and emergency revocation.
- [ ] Signed strategy version and immutable configuration snapshot for every run.
- [ ] Real transaction/event indexer; reconcile every fill against confirmed mainnet signatures.
- [ ] Performance calculations include fees, failed transactions, slippage, token decimals, transfers, realized/unrealized P&L methodology, and missing-price treatment.
- [ ] Public performance claims independently reproducible from on-chain records.
- [ ] Copy-trading follower consent, exposure limits, unsubscribe/stop semantics, and settlement tests.
- [ ] Profit-share accounting and owner-configurable 0–30% share enforced by trusted settlement logic, not client-side arithmetic.
- [ ] Dispute, refund, outage, and failed execution handling.

No live bot performance, ROI, TVL, active-agent count, or copier count may be shown unless it is computed from verified execution records. Do not substitute backtests, paper fills, or manually entered prices.

## Fees and treasury

**Current fee policy (not collected):** WELP's target protocol fee is 0.50% (50 bps) of gross input for each WELP-controlled swap. 100% is credited to treasury at collection; after a 14-day epoch, 60% of eligible new inflows is released to the published developer/operator receiving address and 40% is added to the protected reserve. The split is applied once, not twice. There are no additional fixed USDC trade, transfer or launch-creation charges, and the creator-configurable 0–3% fee model has been removed.

The canonical server policy is in lib/server/fee-policy.ts. The TypeScript and Rust helpers perform integer fee calculations only; they do not collect funds. The launchpad crate is not deployed to mainnet, has no production deployment keypair, and does not implement a buy/sell instruction or a generic SPL input-token fee vault. The Jupiter order/execute route cannot currently append the on-chain fee legs, so both routes remain fail-closed.

Before enabling collection, implement and verify the actual mainnet swap instruction, atomically credit 100% of the fee to a treasury vault for the exact input mint, and wire its 14-day epoch release. Add replay protection and event receipts, run SBF-backed adversarial tests, verify the deployed bytecode/IDL/upgrade authority, and complete an independent Solana/Anchor security review. The current SOL-only vault cannot collect arbitrary SPL-token input fees. Do not treat a frontend build or fee calculation test as proof of collection.

## Production operations

- [ ] Rate limits, request validation, abuse controls, and provider outage handling.
- [ ] Error reporting without secrets or sensitive wallet data.
- [ ] Monitoring and status checks for RPC, Jupiter, market data, indexer, and deployed programs.
- [ ] Backups and recovery for durable user data.
- [ ] Dependency and supply-chain scanning; pinned reproducible builds.
- [ ] CI runs lint, typecheck, unit tests, integration tests, and program tests.
- [ ] Deployment preview and rollback procedure.
- [ ] Privacy review for wallet addresses, analytics, logs, and support requests.

## Release rule

A production build can be deployed while vault/agent features remain disabled. A successful build, green CI run, or working wallet connection is not evidence that a vault is audited, that an agent is executing, or that a strategy is profitable.
