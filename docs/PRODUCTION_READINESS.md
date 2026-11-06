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

## Mainnet vault launch gates

- [ ] Final program ID generated from the reviewed source and keypair.
- [ ] Mainnet deployment completed and source verified against deployed bytecode.
- [ ] Independent audit by a qualified Solana/Anchor security firm, with findings remediated.
- [ ] Property, fuzz, invariant, and adversarial tests for share accounting, rounding, rent, token accounts, CPI account validation, re-entrancy-like composition risks, and emergency paths.
- [ ] SPL-token deposits and withdrawals implemented and tested, not just SOL.
- [ ] Jupiter CPI route validation and token accounting implemented. The current scaffold intentionally disables swap execution.
- [ ] User-authorized caps and per-position limits enforced on-chain. UI limits alone are not security controls.
- [ ] Owner pause, executor revocation, and withdrawal recovery verified under failure conditions.
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

The requested commercial policy is a flat **US$0.10 per successful trade, vault deposit, and vault withdrawal**, with collected fees allocated 60% to the operator wallet and 40% to a platform treasury. The operator address supplied for planning is:

`6uyKhdb2iT8kWhk6SKyJjudWthYLESrVj3G7WHHydoEQ`

The treasury address has not been supplied. The fee flow is **not implemented or enabled**. Before enabling it:

- Publish the treasury address and fee policy in the UI and terms.
- Specify the USDC mint, pricing/oracle source, rounding, payer, and transaction atomicity.
- Collect the fee in the same user-reviewed transaction where possible; do not silently swap user assets or charge a separate wallet transaction.
- Define whether a fee is due only after a confirmed successful action; failed, expired, or reverted operations must not be charged.
- Ensure the 60/40 split is enforced by verifiable program logic or an independently auditable settlement service.
- Add reconciliation, duplicate prevention, refund handling, and fee receipts.
- Do not impose arbitrary UI-only deposit/withdrawal ceilings. Any required safety cap must be an explicit, user-visible, audited on-chain risk control.

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
