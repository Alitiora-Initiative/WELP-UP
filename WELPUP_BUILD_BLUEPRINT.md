# WELP UP! build blueprint

**Status snapshot:** 2026-10-24

**Repository:** `Alitiora-Initiative/WELP-UP`

**Release rule:** keep autonomous real-fund trading disabled until every on-chain, integration, test, and release gate below is complete.

This is the staged implementation plan for user-created Solana trading bots, their vault accounting, creator fees, performance history, and supporting UI. It preserves the current app while replacing the vault only through a tested migration. A source-code checklist or successful web build is not a security audit or evidence that a program is safe to receive mainnet funds.

## Binding product requirements from the supplied specification

- The production target is Solana Mainnet-Beta. Production builds must not point at Devnet, Testnet, Localnet, test accounts, or simulated market data. Local fixtures and validator/simulator runs are validation tools only; they must never be presented as production data or used to move real funds.
- WELP must never request, accept, store, transmit, log, or require a user's private key, seed phrase, mnemonic, or wallet export. Users connect an external wallet and approve setup, funding, permission changes, and withdrawals there. The app and server receive public addresses and public configuration only.
- After setup, any automated instruction must be signed by a narrowly scoped, revocable program PDA through Solana's PDA signing flow. The user's wallet secret is never used by an AI agent, server, or bot. Users retain explicit on-chain pause, revoke, and withdrawal controls subject to open-position accounting.
- Do not integrate centralized-exchange trading, exchange credentials, or user-supplied API keys. Market-data sources are read-only; omit any provider path that requires a private user key or an unapproved service credential. On-chain program state remains authoritative for custody and accounting.
- Do not use a Web2 database as the source of truth for vault balances, user slots, bot parameters, fees, or settlement. A hosted indexer may serve read-only history only and must reconcile to program state/events.
- The supplied economics are a flat `$0.10 USD` creation/activation fee for each personal or public bot, split atomically as 40% to a verified, explicitly configured recipient and 60% to a Treasury PDA derived from `b"website-treasury"`. This setup fee is separate from a creator's 0–30% share of realized positive net profit; display both and prevent double charging.
- The payout address supplied in the prompt (`EDZjEbRAtqyC8z6ta6PYHX161Xynt13tWpd7orKERkbz`) is an unverified configuration candidate, not an on-chain constant. Validate that it is a valid Mainnet address and confirm the intended recipient/configuration before any fee can be routed to it.
- The exact production release target does not remove the validation gates below. Never enable mainnet fund movement until the replacement program, integrations, and release artifact pass the stated checks and review.

## 0. Repository and release baseline

### Verified on 2026-10-23

- [x] Repository default branch is `main`; inspected commit: `acbbc01d52e2a2e56c053a638de63b5cee23e9d8` (`Add paper AI bot studio`). The local checkout started clean on `main`.
- [x] The app is Next.js 16 / React 19 with Solana Kit 8; the Python market agent remains a separate service/CLI.
- [x] `/autonomous` is a browser-only paper bot studio. Prices are entered manually, state is local to the browser, and no AI provider or exchange executor is connected.
- [x] The existing `/swap` flow is separate and asks the connected wallet to approve each transaction. Preserve that route and its user approval flow.
- [x] The site connects through an external wallet provider; `WalletConnectionControl` reads the connected wallet address and never accepts a private key. `welp.wallet.load_keypair` and `sign_swap` fail closed, and `welp.config` rejects `SOLANA_PRIVATE_KEY`.
- [x] The `/vault` page currently uses a separate Devnet wallet client and labels itself Devnet. This is not the requested production configuration and must not be exposed as a Mainnet vault before a verified Mainnet program exists.
- [x] Current market data is split across GeckoTerminal pool/candle queries and Jupiter price/quote calls; the activity chart is based on local wallet snapshots. There is no unified, cross-checked multi-source market chart.
- [x] No global theme or text-scale preference, public bot marketplace, or on-chain performance leaderboard was found in the current app routes/components.
- [x] `programs/vault` is an Anchor 0.30.1 scaffold. It has per-wallet vault PDAs, owner controls, SOL funding/withdrawal, and limit helpers. `execute_swap` returns `TradingDisabled`; SPL position accounting and Jupiter/Raydium CPI are absent.
- [x] `programs/README.md`, `docs/vault/ARCHITECTURE.md`, and `docs/vault/THREAT_MODEL.md` describe the program ID as an undeployed placeholder and mainnet as disabled. Do not use that address for funding or treat executable-account presence as source verification.
- [x] The repository contains no Pyth integration. No new oracle feed, program address, or payout address is assumed by this plan.
- [x] `.github/workflows/ci.yml` runs Python unit tests, npm lint/typecheck/paper tests/build, and host `cargo check` for both Rust crates. It does not run `anchor build` or `anchor test` and has no dependency/secret scan job.
- [x] The repo branch listing reports `main` as unprotected. The connected GitHub app could not read branch-protection details (403), so required-check/ruleset enforcement is unverified. Its workflow-run lookup returned no run for the inspected `main` SHA.
- [x] Vercel project `welp-up` is linked to this repository, uses the Next.js framework and Node 24.x, and has a `READY` production deployment for the inspected `main` SHA. GitHub's current status for that SHA is Vercel `success`.
- [x] GitHub reports the connected account can push to the repository. A push or deployment still requires the relevant checks and target environment to be confirmed.
- [x] Rechecked GitHub on 2026-10-24: PR #1 is merged and there are no open issues. Issue #12, previously a stale consolidated tracker, was closed by its author on 2026-10-24 at 03:15 UTC. Codex did not change its status.

### Toolchain and validation baseline

- [x] Node.js `v24.19.0` and npm `11.17.0` are available.
- [x] Native Windows has no `cargo`, `rustc`, Solana CLI, or Anchor CLI. WSL Ubuntu has Rust/Cargo and Solana CLI `4.2.2`; Anchor CLI is absent. The installed Solana CLI does not match the repo's Anchor `0.30.1` toolchain recommendation, so do not deploy or run an Anchor build from this setup until versions are pinned and aligned.
- [x] Shell `python.exe`/`python3.exe` resolve to Windows app aliases, but the bundled Python runtime is available. The full Python suite passed 16/16 after setting Python's temporary directory to this workspace; its default Windows sandbox temp path denied writes on the first run.
- [x] Python wallet tests verify `load_keypair` and `sign_swap` refuse local signing and that `SOLANA_PRIVATE_KEY` is rejected. The app uses an external connected wallet; no user private key or seed phrase is needed.
- [x] On the source baseline, `npm ci`, lint, TypeScript typecheck, paper-bot tests (4/4), dependency audit (0 reported vulnerabilities), and production build passed. The default sandbox build first failed prerender with Windows `EPERM`; rerunning with local filesystem permissions passed. npm/Node emitted deprecation, install-script approval, and module-type warnings.
- [x] `cargo test --offline --manifest-path programs/vault-checks/Cargo.toml` passed 6/6 host-side tests in WSL after adding share math and fail-closed venue checks.
- [x] `cargo check --offline --manifest-path programs/vault/Cargo.toml` completed successfully in WSL; it emitted 17 `unexpected_cfgs` warnings from the Anchor 0.30.1 macros under Rust 1.99.0. This was a host Rust check, not an SBF build, generated IDL, or transaction test.
- [ ] Anchor program compilation and transaction-level tests remain unverified; the Anchor CLI/SBF build environment is not installed and the current Solana CLI is not aligned with Anchor `0.30.1`.
- [ ] Run the checks that are available after each relevant change; report missing toolchains and warnings plainly.

## 1. Milestone sequence

Complete each milestone in order. Do not advance a later milestone by skipping an unmet exit condition.

### V1 product scope decisions

These decisions translate the supplied requirements into a bounded first release. They are design targets; none means the current program is deployed or ready for funds.

| Area | V1 decision |
|---|---|
| Production cluster | Solana Mainnet-Beta is the only production target. Local fixtures are validation-only and never move real funds. Production stays disabled until the review and release gates pass. |
| Custody and signatures | No user private key, seed phrase, mnemonic, or export is requested, accepted, stored, or sent to a server. The connected wallet signs creation, funding, config changes, pause/revoke, and withdrawal. A keeper may submit execution transactions; only the program PDA authorizes constrained vault CPI. |
| Assets | Native SOL and explicitly allowlisted classic SPL Token mints only. Reject unknown mints and Token-2022/extensions in V1 until their account layouts and transfer semantics have dedicated tests. Never use wildcard mint IDs. |
| Trading | Fully collateralized spot swaps only, exact-input with on-chain minimum-output and slippage checks. No leverage, perpetuals, lending, borrowing, margin, arbitrary token transfer, or centralized-exchange execution. |
| Strategies | Structured grid, DCA, and rebalance configuration only. AI/keeper output is an untrusted proposed action; it cannot upload executable code or bypass on-chain constraints. Strategy parameters and risk caps are stored in the user's on-chain slot. |
| Risk and cadence | Set a 100 SOL default aggregate vault allocation cap, with 100 SOL as the hard maximum and the effective cap bounded by deposited principal and explicit wallet-approved limits. Keep the separate per-position ceiling at 0.02 SOL for now; manual swaps also remain at their existing 0.02 SOL maximum. V1 maximum slippage is 100 bps, minimum execution interval is 150 slots, and each slot permits one in-flight order nonce. Expired or replayed actions fail. |
| Withdrawals and stop | Owner pauses/stops a slot before withdrawing. Swaps are atomic and leave no external order open; after pause the owner may withdraw supported assets in kind, limited to recorded per-mint shares/balances. Close only when tracked assets and shares are zero. Pause blocks new entries but not valid exits or owner withdrawals. |
| State machine | `draft` is off-chain only; on-chain states are `funded`, `active`, `paused`, `stopping`, and `closed`. Failed transactions roll back and do not create an on-chain `error` state; UI attention-needed status is derived. Only the owner may activate, pause/resume, change limits, stop, withdraw, or close. |
| Fees | Charge one `$0.10 USD` creation/activation fee per bot, converted with a valid fresh/confident Pyth SOL/USD update. Round the total up to a multiple of five lamports, then split exactly 40% to the verified configured recipient and 60% to the `b"website-treasury"` PDA. Separately charge creator fees only on realized positive net profit, capped at 3000 bps. |
| Outages and data | If RPC, oracle, or required market data is unavailable/stale, submit no new trade. Swaps use an expiring nonce and bounded retries; idempotent settlement prevents duplicate charges or fills. Read-only indexer/chart data never authorizes custody or replaces on-chain balances. |
| Governance | No single operator/executor key may withdraw user assets or change a user's slot. Before mainnet funds, upgrade authority must be a verified multisig with at least two independent signers or be revoked after the reviewed final build. |

### Milestone 1 — Freeze product and threat-model requirements

- [x] Record Mainnet-Beta as the only production target; keep local/unit/simulator tooling validation-only. Production RPC/wallet network assertions remain an app and CI check.
- [x] Existing app copy, Python wallet code, and tests enforce wallet-provider-only signing: no user private key, seed phrase, or mnemonic is needed or accepted for signing. Existing wallet tests passed.
- [x] Specify the wallet consent lifecycle: connected wallet signs bot creation, funding, configuration changes, pause/revoke, and withdrawals; bot runtime uses only constrained PDA authority and never a user's key.
- [x] Record the specified setup fee as `$0.10 USD` per personal/public bot, with 40% to the configured recipient and 60% to the `b"website-treasury"` PDA. Oracle conversion, rounding, and fail-closed behavior still require implementation and tests.
- [x] Record the supplied payout address only as a pending public config candidate; it remains unusable until address and configuration validation is recorded.
- [x] Confirm that no centralized exchange trading endpoints or user-supplied exchange/API credentials are in scope; chart providers must be read-only and usable without private user credentials.
- [x] Keep the current user-approved `/swap` flow separate from autonomous bot execution.
- [x] Define V1 assets, token program support, spot order type, total/per-position caps, slippage ceiling, execution interval, stop behavior, and outage handling in the product scope table.
- [x] Define owner withdrawals in kind after pause; swaps are atomic and leave no external open order.
- [x] Define on-chain lifecycle states and owner/PDA authority transitions in the product scope table.
- [x] Document threats from malicious creators/keepers, stale prices, spoofed mint/pool, malicious CPI accounts, failed/partial swaps, RPC outage, upgrade authority compromise, and wallet disconnect.
- [x] Record fee basis, checked-integer rounding, slippage, expiry, retries, and idempotency policy in the product scope table.
- [x] Keep program ID, oracle feed IDs, venue IDs, and payout configuration unset until verified against authoritative sources and the intended cluster.
- [x] Set `Anchor.toml` to `localnet` for validation and removed its Devnet program entry; no unverified production ID is configured.
- [x] Verify the current Pyth Receiver SDK `PriceUpdateV2` schema and safe getter: its checked getter enforces full verification, requested feed ID, and maximum age; confidence bounds still need an explicit check. Mainnet receiver program/feed IDs and dependency version remain unset.

**Exit condition:** the V1 state machine, asset policy, limits, fee rules, and no-user-key custody boundary are written above and in `docs/vault/THREAT_MODEL.md`; exact feed/venue/mint addresses remain deferred to their verification milestones.

### Milestone 2 — Replace the Anchor vault with tested Solana accounting

- [ ] Implement the replacement behind the existing client boundary first; preserve the currently fail-closed program until the replacement compiles and its tests pass.
- [ ] Pin compatible Anchor, Solana, Rust, SPL Token, and Token-2022 versions in source and CI.
- [ ] Define a versioned global configuration PDA with a documented authority and pause policy.
- [ ] Define one vault PDA per owner and one user-slot PDA per `(owner, bot)` with deterministic, domain-separated seeds and stored bumps.
- [x] Select and client-test versioned PDA namespaces `b"global-config-v1"`, `b"vault-v1" + owner`, and `b"user-slot-v1" + owner + canonical bot-account address`; preserve the legacy Devnet `b"vault"` derivation until a tested replacement is integrated.
- [x] Choose the replacement user-slot seed namespace `b"user-slot-v1"`, followed by owner and canonical bot-account addresses. The browser derivation helper is host-tested; the Anchor account, bump persistence, and deployed address remain unimplemented.
- [ ] Store accounting in integer lamports/token base units; reject zero, unsupported decimals, invalid account owners, overflow, and underflow.
- [x] Add pure, host-testable integer share issuance/redemption calculations with checked wide intermediates, floor rounding, final-share dust return, and rejection of zero/unredeemable amounts. The helpers are not yet connected to an Anchor account or funds-transfer instruction.
- [x] Remove the old baked-in Jupiter ID and disable all host-check venue routes until the integration milestone verifies a program ID and account schema.
- [ ] Add explicit owner-authorized create, fund, pause, resume, revoke, close/withdraw, and migration instructions. Keep executor authority narrow and revocable by the owner.
- [ ] Do not create or store per-user trading keypairs. Use the vault/slot PDA as the only program-controlled signer for permitted token-account operations; document exactly which user-wallet signatures are required for consent and recovery.
- [ ] Derive the Treasury PDA with the exact `b"website-treasury"` seed under the deployed program ID; add seed/bump/account-owner tests and keep the recipient configurable rather than compiled as a hidden payout constant.
- [ ] Add share accounting: mint shares only for assets actually received; burn no more than the caller's recorded shares; calculate redemptions from verified vault assets and total shares with checked arithmetic and documented rounding.
- [ ] Separate principal, available balance, open exposure, realized profit/loss, pending creator fees, and accrued protocol fees. Never infer a fill from a quote.
- [ ] Make repeated/retried instructions idempotent or reject duplicate settlement using a position/order nonce.
- [ ] Add account constraints for PDA seeds, stored owner, token mint, token program, associated token account, signer roles, writable roles, and executable program accounts.
- [ ] Add explicit token withdrawal paths for supported SPL Token and Token-2022 cases; reject extensions that are not deliberately supported.
- [ ] Emit versioned events for deposits, withdrawals, share changes, bot state, fills, settlements, and fee claims.
- [ ] Do not enable live swaps in this milestone. Keep the swap instruction fail-closed until Milestone 3 is complete.

**Exit condition:** `cargo fmt --check`, `cargo clippy`, unit/property tests, account-layout tests, and local validator or LiteSVM/Mollusk tests pass for every authorization and accounting invariant.

### Milestone 3 — Add vetted Jupiter and Raydium execution

- [ ] Choose and document the supported Jupiter path. Current Jupiter documentation separates ready-to-sign `/order` transactions from raw `/build` instructions intended for custom transactions/CPI. Never pass an arbitrary serialized transaction into CPI.
- [ ] Verify every invoked program ID against the venue's current official documentation/source and the executable account on the target cluster immediately before pinning it in code. Keep mainnet and devnet IDs separate.
- [ ] Build an explicit venue/account allowlist; reject unknown program IDs, mints, token programs, pool accounts, token accounts, sysvars, signers, and account ordering.
- [ ] Validate input mint, output mint, source/destination token-account owner and mint, authority, exact input amount, minimum output, slippage ceiling, route length, and fee accounts before CPI.
- [ ] For Raydium direct routes, support only named pool families whose instruction/account layouts are tested; validate pool state and vault relationships. Do not accept a caller-supplied pool merely because it has a familiar symbol.
- [ ] Execute swaps only from the user's PDA-owned token accounts. Do not request, store, or use a user's seed phrase or private key.
- [ ] Never accept an AI-generated keypair or serialized user-signed transaction from an API as a substitute for wallet consent; bot execution must use the program's constrained PDA signer and validated CPI accounts.
- [ ] Measure token balance deltas around CPI and record actual received/spent amounts; roll back on invalid deltas, unsupported transfer-fee behavior, or cap violation.
- [ ] Enforce per-position and total allocation limits in the program before CPI, including priority/network fees where relevant.
- [ ] Add simulation and adversarial tests for substituted programs/accounts, wrong mint, wrong owner, stale quote, expired order, excessive slippage, partial fill, Token-2022 transfer fees, and CPI failure.
- [ ] Keep the user-visible quote review, action summary, and explicit wallet approval for vault funding, permissions, and withdrawals.

**Exit condition:** deterministic local integration tests and test-cluster transaction tests prove account validation, balance-delta accounting, limits, pause/revoke, and recovery. No mainnet toggle in the UI before review gates pass.

### Milestone 4 — Oracle policy and fee conversion

- [ ] Decide whether any fee is a percentage of realized trading profit or a fixed USD amount. Do not silently combine these policies.
- [ ] Implement the specified one-time `$0.10 USD` bot creation/activation fee for private and public bots using a valid Mainnet Pyth SOL/USD update; reject wrong-feed, stale, invalid-confidence, non-positive, or unavailable oracle data instead of guessing a SOL amount.
- [ ] Convert to lamports with checked integer arithmetic and documented rounding, then atomically split exactly 40% to the verified configured recipient and the remainder to the `b"website-treasury"` PDA; reject insufficient payer balance and test all rounding boundaries.
- [ ] Ensure this creation fee is charged once per bot activation nonce and is distinct from creator performance fees; retries must not charge it twice.
- [ ] Use the user-provided payout candidate only after validating its Mainnet address and recording it in explicit configuration; do not bake it into program code or route unrelated withdrawals to it.
- [ ] Current code has no Pyth consumer. If Pyth is selected, verify the current Solana account type/schema, program owner, feed ID, exponent, update timestamp, and confidence semantics from Pyth's current official documentation before implementation.
- [ ] Reject wrong-feed, wrong-owner, unverified, stale, non-positive, or over-wide-confidence updates. Use a documented maximum age and confidence-to-price ratio appropriate to the product.
- [ ] Use checked integer arithmetic for scaling, fee conversion, multiplication, division, and rounding. Test boundary values, negative prices, exponent changes, overflow, zero, and stale updates.
- [ ] Do not add a fixed `$0.10` fee unless product requirements explicitly keep it. If added, convert only from a valid fresh/confident oracle update; fail closed when oracle data is invalid.
- [ ] Make the fee recipient configurable through reviewed governance/user consent; do not embed a payout address in program code without verified existing configuration.

**Exit condition:** oracle and fee rules have source links, reviewed invariants, unit/property tests, and negative tests for every rejection case.

### Milestone 5 — Bot marketplace and creator fee enforcement

- [ ] Define a versioned bot registry PDA with creator, strategy/config hash, risk bounds, supported assets, fee basis points, and enabled/disabled state.
- [ ] Enforce creator fee `0..=3000` basis points on-chain; reject any configuration above 30%.
- [ ] Charge only on realized, positive net profit after actual settlement and agreed execution costs. Never charge on deposits, principal return, unrealized gains, or losing/zero-profit exits.
- [ ] Define net-vs-gross costs once and apply the same formula to user statements, fee transfer, bot performance, and leaderboard.
- [ ] Use checked multiply/divide and round down so the creator fee cannot exceed the configured percentage or the settled profit.
- [ ] Lock the fee terms for each user's active subscription/slot; changes require explicit user consent and take effect only for a new version or cycle.
- [ ] Add claim accounting that prevents double claims and cannot spend another user's balance.
- [ ] Show creator identity, fee rate, strategy version, risk limits, and performance sample size before subscription/funding.
- [ ] Test zero, minimum, maximum, and above-maximum fees; loss, breakeven, partial close, retry, double-settle, creator change, and withdrawal cases.

**Exit condition:** on-chain tests prove the 30% cap and user balance invariants across all settlement paths; the UI fee display matches program calculation byte-for-byte.

### Milestone 6 — On-chain performance and leaderboard

- [ ] Store or emit canonical fill/settlement records keyed by user slot, bot version, and position nonce.
- [ ] Provide 7-day, 30-day, and 100+-day performance views from canonical on-chain fills/settlements; separate fee-inclusive net ROI, TVL, and active copier count and state the sample size.
- [ ] Separate realized P&L, unrealized mark-to-market P&L, fees, deposits/withdrawals, and net asset value. Label estimates as estimates.
- [ ] Define the mark source, timestamp, staleness ceiling, confidence threshold, decimals, and valuation fallback before publishing USD returns.
- [ ] Do not let deposits, withdrawals, or share transfers appear as trading profit.
- [ ] Define leaderboard return math, time windows, minimum history, closed-position rules, drawdown, and treatment of migrations/strategy changes.
- [ ] Build `/leaderboard` with explicit sort/filter controls for verified ROI windows, TVL, and copier count; label indexer delay and keep rankings reconciled to on-chain records.
- [ ] Add a “Copy Bot” action that previews creator fee, strategy version, risk bounds, and required funding/approval before the connected wallet signs.
- [ ] Use an indexer for chart queries if needed, but reconstruct and reconcile results against program events/state; show indexing lag and source time.
- [ ] Add anti-manipulation tests for self-trades, rapid in/out cycles, new wallets, fee omissions, missing price updates, and reset/recreated bots.
- [ ] Let users hide a bot/profile without changing canonical on-chain settlement records.

**Exit condition:** independent fixtures reproduce all displayed balances and P&L from on-chain settlements; leaderboard ranking cannot be increased by deposits or stale marks.

### Milestone 7 — Settings, themes, and readable text scaling

- [ ] Add an account settings surface for theme (`system`, `light`, `dark`) and text scale with a clear reset action.
- [ ] Offer the requested `Compact`, `Normal`, and `Large` text scales alongside `system`, `light`, and `dark` theme choices.
- [ ] Persist non-financial preferences locally or in an authenticated profile; never make a UI preference an authorization input.
- [ ] Apply text scaling consistently to navigation, tables, forms, chart labels, dialogs, and wallet confirmations.
- [ ] Check keyboard navigation, visible focus, contrast, zoom/reflow, reduced motion, and screen-reader labels.
- [ ] Test settings on mobile and desktop and verify that scaling does not clip fee, slippage, network, or transaction summaries.

**Exit condition:** preference persistence and accessibility checks pass without changing wallet, bot, fee, or vault permissions.

### Milestone 7A — Notifications and public project updates

- [x] Add a Notifications navigation tab and page that works without connecting a wallet.
- [x] Poll the public repository's releases and recent commits on a bounded interval; cache upstream requests and validate/sanitize all returned fields before display.
- [x] Show an evergreen safety/update notice explaining that live automated fund movement remains gated until vault accounting, venue checks, and release reviews pass.
- [x] Store only read/unread notification IDs in versioned browser storage; do not store wallet keys, balances, or transaction permissions in notification state.
- [x] Show source, timestamp, loading/error state, last checked time, and manual refresh; render repository text as plain text and link only to validated GitHub URLs.
- [x] Add tests for malformed, missing, stale, and hostile upstream payloads, plus a CI step for those tests.
- [x] Do not claim push delivery or notifications while the app is closed; this milestone is an in-app feed refreshed while a page is open.

**Exit condition:** the tab displays validated public updates, refreshes at a bounded interval, and remains safe and useful when GitHub is unavailable.

### Milestone 8 — Multi-source charts and data provenance

- [ ] Define typed provider adapters for price, volume, liquidity, candles, and token metadata; keep provider-specific parsing outside UI components.
- [ ] Add read-only source selectors for Jupiter pool data, DexScreener, and Birdeye/Phantom price views only after each source's public endpoint, data rights, schema, and rate limits are confirmed; do not require a user's private/API key.
- [ ] Add an optional split-screen chart grid so users can compare the same mint/pair across selected sources; expose source, timestamp, liquidity, and disagreement state in each pane.
- [ ] Validate mint addresses, numeric ranges, timestamps, decimals, and response shape. Treat all provider and chain data as untrusted.
- [ ] Display source and last-update time; mark stale/missing data and never silently substitute zero or synthetic values.
- [ ] Define provider precedence, disagreement thresholds, cache age, rate limits, backoff, and fallback behavior.
- [ ] Require two-source or on-chain confirmation for critical valuation/exit decisions; charts alone never authorize trading.
- [ ] Add tests for malformed JSON, stale candles, duplicate timestamps, outliers, provider outage, conflicting prices, and unsupported mints.
- [ ] Keep the current local snapshot activity chart separate from new market candles until this milestone is complete.

**Exit condition:** chart output is reproducible from provider fixtures and exposes source/freshness state; missing providers cannot create a trade or performance claim.

### Milestone 9 — Full test and security review

- [ ] Add Rust unit and property tests for vault isolation, shares, spending caps, per-position caps, pause/revoke, withdrawals, fee bounds, and overflow/underflow.
- [ ] Add regression checks that every API route rejects private-key/seed-phrase fields and never persists, logs, or returns signing material.
- [ ] Add Anchor integration tests on a local validator or supported Solana simulator for PDA derivation, account ownership, token transfers, CPI validation, and recovery.
- [ ] Fuzz instruction data, account substitutions, token extensions, retries, settlement order, and oracle inputs.
- [ ] Run `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `anchor build`, and `anchor test` using pinned toolchain versions.
- [ ] Run Python unit tests, `npm ci`, lint, typecheck, paper-bot tests, production build, dependency audit, and secret scan.
- [ ] Add regression checks that private keys, seed phrases, mnemonics, wallet exports, and signing material are rejected and never persisted, logged, returned by APIs, or accepted through environment variables.
- [ ] Review program upgrade authority, IDL/source parity, event/indexer behavior, emergency pause, operational key custody, RPC failover, backups, and incident response.
- [ ] Obtain an independent smart-contract security review for the exact deployed bytecode, IDL, CPI set, oracle policy, token support, and fee flows; track and resolve findings.
- [ ] Rebuild from a clean checkout and compare verified build artifacts before any mainnet release.

**Exit condition:** all required checks pass, no unresolved high/critical findings remain, deployment artifact is reproducible, and reviewers sign off on the exact release candidate.

### Milestone 10 — GitHub CI and branch controls

- [ ] Pin and cache Rust, Solana, Anchor, Node, npm, and Python versions; fail on version drift.
- [ ] Keep current Python and Node jobs; add Anchor build/test and on-chain simulator jobs for pull requests.
- [ ] Add dependency vulnerability and secret scanning; redact credentials and fail if a real secret is introduced.
- [ ] Add checks for `declare_id!`, `Anchor.toml`, generated IDL, client program ID, and cluster configuration consistency.
- [ ] Require all relevant CI checks before merge to `main`; verify actual branch protection/ruleset state through a connection with the required GitHub permission.
- [ ] Keep deployment credentials in GitHub/Vercel secret stores; never commit `.env`, keypairs, service tokens, or wallet material.
- [ ] Keep any program deployment/upgrade authority material separate from user wallets; users never provide their key material to WELP, and deployments must not require a user's private key.
- [ ] Publish test artifacts, IDL, and build metadata without publishing private credentials.

**Exit condition:** a clean pull request triggers all required jobs, and repository protection prevents merge when one fails or is skipped.

### Milestone 11 — Vercel preview and production release

- [ ] Keep the existing Vercel project/repository link; verify project, team, Git ref, root directory, build command, Node version, and environment-variable scopes before each release.
- [ ] Use a preview deployment for each reviewed branch. Keep preview defaults non-custodial and unable to submit autonomous mainnet trades.
- [ ] Run `npm run lint`, `npm run typecheck`, paper-bot tests, and `npm run build` on the exact commit before deployment.
- [ ] Confirm Vercel build status and GitHub CI status for the same SHA; inspect logs for warnings and failures instead of inferring success from a URL.
- [ ] Promote to production only after all CI and security gates pass; check domains, SSO/protection, RPC/oracle configuration, and rollback target.
- [ ] After deployment, verify read-only pages and wallet network display. Do not trigger a funding, swap, or withdrawal transaction as a deployment smoke test.
- [ ] Record commit SHA, CI results, preview/production deployment ID, domains tested, and rollback plan.

**Exit condition:** production is serving the reviewed release candidate, and the post-deployment checks did not require or submit a real-fund transaction.

## 2. Current implementation decision

- [x] Keep the existing paper bot studio and explicit user-approved swap route intact.
- [x] Keep `execute_swap` fail-closed while the replacement program is designed, compiled, and tested.
- [ ] Replace the legacy vault implementation with the new versioned design after equivalent owner recovery and accounting tests pass. Preserve the baseline in Git for rollback; do not treat deleting source or changing a program ID as migrating or securing funds held by any deployed program.
- [ ] Do not flip an autonomous mainnet flag, publish a production vault address, or tell users that live bot trading is ready until the release gates above are met.
- [ ] Build the next milestone in an isolated change, review its exact diff, and keep every prior safe path available for rollback.

## 2.1 Implementation log

### 2026-10-24 — Blueprint progress and reference tooling

- [x] Record the user-key boundary: users connect an external wallet and approve transactions there; WELP must never ask for or handle their private keys, seed phrases, or wallet exports.
- [x] Remove the task-local XERJ executable, generated index data, and logs after its disk-space safety guard prevented indexing. No project source was indexed and no XERJ process or local service remains.
- [x] Keep reference coding based on source and documentation from official upstream repositories linked below. XERJ is not a prerequisite for implementation; avoid creating a large local clone/index while the host volume is under its configured safety threshold.
- [x] Add host-testable checked share issuance/redemption math and keep every venue route rejected until a specific CPI is reviewed. These helpers are not yet connected to Anchor account state or token transfers.
- [x] Keep the existing swap instruction fail-closed. A host-side approval check is not venue integration, and no bot can move funds through it.
- [x] Change record: `Anchor.toml` now selects `localnet` for validation and has no Devnet deployment mapping; `programs/vault/Cargo.toml` pins Anchor crates to `0.30.1` and records expected Anchor macro cfg names; `programs/vault-checks/src/lib.rs` removes the baked-in Jupiter ID, rejects all venue routes, and adds checked host share helpers/tests; the Anchor instruction logic remains fail-closed and was only formatted. `Cargo.lock` was generated for the Anchor workspace.
- [x] Change record: `docs/vault/ARCHITECTURE.md`, `docs/vault/THREAT_MODEL.md`, and `programs/README.md` now identify the old executor-key/Devnet design as historical, state the no-user-key rule, and describe the Mainnet-Beta target as gated. `WELPUP_BUILD_BLUEPRINT.md` contains the staged checklist and this dated progress log.
- [x] Record prior validation accurately: host share/risk tests passed 6/6; Anchor host `cargo check` passed but emitted 17 Anchor macro `unexpected_cfgs` warnings before the lint declaration was added; Rust formatting and `git diff --check` passed. A follow-up Clippy invocation could not start because WSL returned `Wsl/E_ACCESSDENIED`, so Clippy is unverified.
- [x] Re-run app checks: `npm run lint` and `npm run typecheck` passed; `npm run test:paper` passed 4/4 with Node's existing `MODULE_TYPELESS_PACKAGE_JSON` warning; Python `unittest discover -s tests -v` passed 16/16; `npm run build` passed after retrying with workspace write access. The default-sandbox build attempt failed at prerender with `.next` `EPERM`.
- [x] Parse the Cargo manifests and lockfile and verify the pinned Anchor versions and `Anchor.toml`/`declare_id!` localnet ID match. This static check does not replace compiling the current Rust source.
- [x] `git diff --check` passed; Git reported line-ending normalization warnings for the blueprint and Rust source files.
- [x] The latest Rust test retry could not start because WSL returned `Wsl/SERVICE/HCS_E_CONNECTION_TIMEOUT`; this is an environment failure, not a Rust test result. Anchor build/test and Clippy remain unverified for the current working tree.
- [x] Recheck GitHub: issue #12 is closed by its author, and no open repository issues remain. No issue was closed by Codex.
- [ ] Correct the legacy SOL withdrawal accounting before using it for deposits: current `withdraw` checks vault lamports and rent but has no recorded per-owner balance or share check. The current source is not suitable for real-fund release.
- [ ] Do not commit/push this combined Rust change or trigger a Vercel deployment until required Rust checks, repository CI/branch rules, and the exact release target are verifiable.
- [ ] Re-run Rust checks after the latest manifest and source changes when the configured Rust/WSL toolchain is available; then add on-chain account/transfer tests before marking vault accounting complete.
- [ ] Continue with versioned configuration, per-owner vault and per-bot user-slot PDAs, exact deposit receipt, recorded share issuance/burn, and owner-only redemption. Keep the replacement behind the current client boundary and keep production fund movement disabled until all release gates pass.
- [ ] Enforce the requested 100 SOL aggregate vault cap in both the host-checked helper and Anchor entrypoint; keep the default total cap at 100 SOL and the separate 0.02 SOL per-position/manual-swap limits unchanged until their own risk milestone.
- [ ] Implement the in-app Notifications tab and bounded public GitHub update polling described in Milestone 7A; no background push delivery is claimed.
- [ ] Do not increase the 100 SOL limit or enable live mainnet fund movement without recorded balance/share accounting, integration tests, independent security review, and verified release controls.

### 2026-10-24 — Aggregate vault cap and notification feed

- [x] Set the vault allocation field's default to 100 SOL and enforce a 100 SOL hard maximum in the host-side risk helper, Anchor initializer, and client-side validation.
- [x] Enforce the separate 0.02 SOL hard per-position maximum in the host helper and initializer even when the aggregate cap is 100 SOL; regression cases are added, but Rust execution remains pending.
- [x] Define and test deterministic client derivation for a replacement user slot using `(program, owner, canonical bot account)`; keep it disconnected from funding until the matching Anchor instruction/account exists.
- [x] Keep the separate 0.02 SOL per-position and manual-swap ceilings unchanged; the 100 SOL value is an aggregate vault cap, not a single-trade limit.
- [x] Add a public, wallet-independent Notifications page and navigation item. The API reads recent public GitHub releases and commits with a five-minute cache; payload fields are bounded and validated, links are restricted to this repository, and displayed commit titles are plain text.
- [x] Keep only read/unread notification IDs in versioned local storage. The feed is informational, refreshes while open, and does not claim push delivery or transact.
- [x] Add 4 notification parsing/safety tests and 3 client vault-limit tests; add both suites to GitHub CI. Extend Rust CI with formatting, host-helper tests, and Clippy.
- [x] Validation: `npm run lint`, `npm run typecheck`, `npm run test:paper` (4/4), `npm run test:notifications` (4/4), `npm run test:vault-client` (3/3), Python unittest (16/16), `npm run build`, and `git diff --check` passed. Build and diff check completed; Git printed LF-to-CRLF normalization notices for three edited files. Direct TypeScript test runs print Node's existing `MODULE_TYPELESS_PACKAGE_JSON` warning.
- [ ] Rust `cargo fmt`, host tests, and Clippy remain unverified in this environment: WSL returned `Wsl/E_ACCESSDENIED`; the named `Ubuntu` distribution was not available, and WSL distribution enumeration was also denied. This is an environment blocker, not a Rust test result.
- [ ] A local HTTP smoke test was attempted but loopback access was denied by the sandbox, including on retry; production build generated `/notifications` and `/api/notifications` successfully. Verify the deployed page and live API feed after the Rust gate is resolved.
- [ ] Do not merge or promote this combined change to production until Rust/Anchor checks, GitHub CI, branch/ruleset review, and exact-commit Vercel checks pass. Rust cannot run locally in this environment; use an isolated review branch to obtain remote CI evidence before any promotion.
- [ ] Preserve Mainnet-Beta fund movement disabled: the vault still lacks recorded per-owner balances/shares and reviewed venue CPIs, and no independent security review or exact production artifact exists.

## 3. Authoritative integration references

Use the latest official source at implementation time; re-check account schemas and program addresses against the intended cluster before pinning values.

- [Jupiter Swap API documentation](https://github.com/jup-ag/docs/blob/main/swap/index.mdx) — distinguishes `/order` ready-to-sign transactions from `/build` raw instructions for CPI/composable transactions.
- [Raydium program addresses](https://github.com/raydium-io/raydium-docs-v1/blob/main/reference/program-addresses.mdx) — official address reference; it instructs integrators to cross-check the live API before signing.
- [Pyth Solana price usage](https://docs.pyth.network/price-feeds/pro/use-prices-on-blockchain/solana) — current account type, owner validation, feed ID, freshness, price, and confidence fields.
- [Pyth Receiver SDK `PriceUpdateV2` source](https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/solana/pyth_solana_receiver_sdk/src/price_update.rs) — checked getter requires full verification and checks the requested feed ID and publish-time age; do not use `get_price_unchecked` for fees.
- [Solana Cross-Program Invocation](https://solana.com/docs/core/cpi) — account privileges and CPI execution model.
