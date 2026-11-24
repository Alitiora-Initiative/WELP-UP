# Production readiness checklist

**Status as of 2026-11-24: not approved for real-money vault custody, public deposits, copy trading or autonomous trading.**

A read-only mainnet RPC check found no vault program configured or deployed. The custom launchpad source ID is not executable on mainnet. In the current development environment, no Jupiter referral account is configured, so WELP order/execute routes return 503. The manual Jupiter swap flow is therefore not verified end-to-end with real funds; do not describe it as live until the fee route is configured and a wallet-signed transaction is independently reconciled.

This checklist distinguishes working public-data and wallet-approved features from infrastructure that is only designed, scaffolded, or absent. Do not change a status to complete without reproducible evidence linked in this document.

## 24 November 2026 release-candidate findings

The separate branch `production-readiness-2026-11` contains a proposed data-integrity and AI-status upgrade. **It is not merged or in production yet.** Review its CI and Preview deployment before promotion.

- The market score now uses a 0–100 weighted average of observed score inputs, with a separate data-coverage percentage. Missing values are not assigned a neutral score. Missing core liquidity, 24-hour buy/sell volume, freeze-authority or top-holder data withholds eligibility.
- The market board optionally compares up to 30 top-ranked Solana mints against DexScreener. The second source is context only; it does not overwrite Jupiter values, change the score or establish token safety.
- GeckoTerminal trending-pool and candle calls now use one-minute Next.js revalidation to reduce pressure on the public endpoint. The signal response reports incomplete chart or quote coverage as partial.
- The AI status route distinguishes Gateway authentication from a successful generation response. Vercel AI Gateway OIDC is the preferred no-secret path for Vercel deployments; `WELP_AI_MODEL` is an optional model override, not an API key.
- System status identifies a shared public Solana RPC as non-production-ready when no dedicated `SOLANA_RPC_URL` is configured.

**Provider and account checks from 24 November 2026:**

- The reviewed Vercel custom-environment listing contained `WEBACY_API_KEY` but did not show `SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `JUPITER_API_KEY`, or `AI_GATEWAY_API_KEY`. Vercel's deployment OIDC token is automatically provided at runtime and may not appear as a custom project variable; use the AI status endpoint and a real Preview request to verify it.
- A live Solana RPC health check against the shared public endpoint is not adequate production RPC readiness. Configure a private server endpoint and a separately origin-restricted browser endpoint; test the latter with an actual wallet session.
- Jupiter Token API keyless access is useful for prototyping but is documented at 0.5 requests per second. Configure a production project API key and monitor the rate/usage limits.
- Prior live tests against Webacy returned HTTP 500 for Solana Trading Lite and HTTP 403 for URL screening. The key must be rotated, account permissions checked for both required endpoints, and both scans retested successfully before WELP claims Webacy protection is active.
- The referral-fee configuration remains disabled; swap order/execute routes remain fail-closed until the fee destination is configured and a returned fee-bearing order is verified.

The new market cross-check tests and score tests are part of the release branch CI. Passing unit tests does not prove provider availability, successful market responses, a successful AI generation, a fee-bearing Jupiter order, or an on-chain transaction.


## Currently implemented in the web application

- [x] Wallet connection and public wallet balance reads.
- [x] Live market/token data and deterministic signal evaluation.
- [x] Jupiter Swap API v2 order request and signed-order execution path; both routes fail closed until the referral account is configured, and end-to-end real-funds execution remains unverified.
- [x] Solana RPC transaction-signature history for a wallet address.
- [x] Browser-local activity snapshots and display preferences.
- [ ] Server-side account identity and durable per-user data.
 - [x] Added finalized-signature verification and a transaction-status reconciliation endpoint for Jupiter executions.
 - [ ] Durable idempotent transaction ledger and end-to-end reconciliation for every trade and vault event.

## Current Anchor program source status (executor-policy-foundation)

- [x] Added a server-side read-only market analyst route using the AI SDK and Vercel AI Gateway; it consumes the live Jupiter snapshot and has no wallet, transaction, or bot tools.
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
- [ ] Confirm Vercel AI Gateway authorization and test a real analyst response in Preview; local tests cannot establish provider availability.

See [AI_AGENT_RUNTIME.md](AI_AGENT_RUNTIME.md) and [VAULT_PROGRAM_SECURITY_REVIEW.md](VAULT_PROGRAM_SECURITY_REVIEW.md). These checkboxes describe code added in this branch, not production deployment or a release approval.

## Mainnet vault launch gates

- [ ] Final program ID generated from the reviewed source and keypair. The current source placeholder returned no account from mainnet RPC.
- [ ] Mainnet deployment completed and source verified against deployed bytecode.
- [ ] Independent audit by a qualified Solana/Anchor security firm, with findings remediated.
- [ ] Property, fuzz, invariant, and adversarial tests for share accounting, rounding, rent, token accounts, CPI account validation, re-entrancy-like composition risks, and emergency paths.
- [ ] SPL-token deposits and withdrawals implemented and tested, not just SOL.
- [ ] Jupiter CPI route validation and token accounting implemented. The current scaffold intentionally disables swap execution.
- [ ] Wire executor policy and each user-slot strategy/risk snapshot into an audited swap instruction so per-trade, daily spend, slippage, policy version, nonce, and available-balance limits are enforced atomically. UI limits alone are not security controls.
- [ ] Verify owner pause, implemented executor-policy revocation, and share-withdrawal recovery under local-validator failure conditions.
- [ ] Upgrade authority policy selected, documented, and secured (prefer a reviewed multisig or immutable deployment after upgrade window).
 - [x] Added server-side execution policy rails for max slippage, per-swap SOL allocation, daily drawdown, allocation caps, RPC readiness, signer readiness, and autonomous-execution gates.
 - [x] Added `/api/monitoring` with RPC health, fee-route alerts, execution blockers, and heartbeat metadata.
 - [ ] Jito/private-bundle routing, dynamic priority-fee calculation, incident response, pause authority, recovery runbook, and independent RPC/indexer redundancy.
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

**Proposed on-chain protocol fee (not collected):** WELP's design target is 0.50% (50 bps) of gross input for each WELP-controlled swap. The proposed 100% treasury credit and 60/40 14-day epoch distribution are not implemented. A separate Jupiter referral fee may be configured for the browser swap route; the current development environment has no referral account, and that off-chain referral does not settle into the WELP treasury or follow the 60/40 model. There are no additional fixed USDC trade, transfer or launch-creation charges, and the creator-configurable 0–3% fee model has been removed.

The canonical server policy is in `lib/server/fee-policy.ts`. Its 50 bps default is a requested Jupiter referral fee, not an on-chain WELP treasury fee. When configured, `/api/order` passes the server-owned referral account and fee to Jupiter and rejects orders unless Jupiter returns the configured `feeBps`; `/api/execute` remains gated by the same configuration. The current development environment has no referral account, so both routes fail closed. A configured referral account is not by itself proof of account ownership, fee settlement, or WELP treasury revenue.

The separate 0.50% protocol treasury policy and 60/40 epoch model are not implemented. The launchpad crate is not deployed to mainnet and does not implement a buy/sell instruction or generic SPL input-token fee vault. Before describing referral fees as live, configure the correct Jupiter referral account, inspect a fee-bearing order, and reconcile a wallet-signed execution and finalized on-chain result. Before claiming WELP treasury collection, implement and verify the actual mainnet swap instruction, atomically credit 100% of the fee to a treasury vault for the exact input mint, wire its 14-day epoch release, add replay protection and event receipts, run SBF-backed adversarial tests, verify deployed bytecode/IDL/upgrade authority, and complete an independent Solana/Anchor security review. Do not treat a frontend build or fee-calculation test as proof of collection.

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
