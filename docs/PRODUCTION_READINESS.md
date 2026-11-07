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

## Current branch hardening (source-driven-product-port)

- [x] Added a server-side read-only market analyst route. It consumes the live Jupiter snapshot and requires a server-only OpenAI API key; it has no wallet, transaction, or bot tools.
- [x] Added bounded snapshot sanitization and response parsing tests for the analyst.
- [x] Added explicit fail-closed errors to vault funding, swap execution, position settlement, creator-fee accrual/claim, and bot-creation fee collection in the Anchor source.
- [x] Added source-level regression tests for those disabled instructions.
- [ ] Run all GitHub CI checks for the branch and resolve any failures.
- [ ] Run Anchor 0.30.1 SBF build, IDL validation, local-validator transaction tests, and independent security audit. These remain unavailable/unverified in the current CI baseline.
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

**Fee policy from the staged build specification (not enabled):**

- Bot creation/activation fee: **US$0.10 per personal or public bot**, once per successful creation/activation.
- Allocation: **40% to a verified, explicitly configured recipient and 60% to the platform Treasury PDA** derived from `b"website-treasury"`.
- Creator performance share: separately configurable from **0–30% of realized positive net profit**, only after trusted on-chain accounting and settlement exist.
- The setup fee and creator share are separate; prevent double charging.
- The payout address in the planning specification (`EDZjEbRAtqyC8z6ta6PYHX161Xynt13tWpd7orKERkbz`) is an **unverified candidate**, not an approved recipient or on-chain constant. Validate it and confirm configuration before use.
- Fee collection, treasury routing, and creator payouts are **disabled**. No fee may be collected until the USDC mint/denomination, conversion/rounding, recipient, treasury PDA, atomic settlement, receipts, reconciliation, duplicate prevention, and refund behavior are reviewed and tested.
- Do not implement a per-trade, per-deposit, or per-withdrawal charge unless the product specification is explicitly revised and approved. Existing documents previously described a conflicting fee model; this section supersedes that obsolete wording.

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
