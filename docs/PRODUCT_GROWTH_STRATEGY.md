# WELP UP! — Product growth and technical strategy

**Purpose:** turn WELP UP from a live-data terminal with wallet-approved tools into a trusted, measurable research, execution and launch workstation.

**Status:** strategy and implementation contract. Planned features in this document are not claims that they are deployed.

## 1. Product thesis

WELP UP should win by making every important claim inspectable:

- A market score must explain the fields that moved it.
- A signal must have a timestamp, source snapshot, model version and later outcome.
- A trade must be tied to a user-approved instruction and a confirmed transaction.
- A strategy's performance must include losses and execution costs, not only screenshots of winners.
- Automation must operate within explicit, revocable, independently enforced limits.
- A launch must show the evidence behind its risk assessment instead of presenting an AI score as a safety guarantee.

Build around four connected workspaces:

1. **Discover:** live market board, token/market risk review, charts and signals.
2. **Decide:** AI analyst, strategy studio, signal journal and evidence-backed performance.
3. **Execute:** wallet-approved swap desk first; delegated automation only after the audited vault and executor are ready.
4. **Launch:** creator workflow, launch-risk checks, token metadata and post-launch monitoring.

The main moat is not an LLM response or a single RPC vendor. It is the combination of a versioned signal history, verified execution outcomes, user-controlled risk policies, launch intelligence and transparent operating behavior.

## 2. Current baseline and hard boundaries

The repository currently documents live market reads, deterministic scoring, a read-only AI analyst, a Jupiter order/execute path that remains fee-configuration-gated, and a PumpPortal launch flow that requires the connected wallet to sign. It explicitly keeps autonomous execution and production vault funding disabled pending deployment, verification and independent review.

The following are **not** treated as shipped just because a page, scaffold or design exists:

- Durable per-user accounts or a shared cross-device activity database.
- An audited production vault, delegated signer or unattended execution runtime.
- Verified agent P&L, a live strategy leaderboard or copy-trading settlement.
- A Jito/private bundle route or guaranteed MEV protection.
- Geyser/gRPC market streaming or a sub-second end-to-end signal guarantee.
- A reinforcement-learning model trained and validated on real outcomes.
- WELP-owned bonding-curve trading, Raydium graduation or LP locking.
- Live cross-market brokerage execution or tokenized-equity custody.

Keep these boundaries visible in the product and release notes.

## 3. Trust and security architecture

### 3.1 Separate research, authorization and execution

Keep three isolated services:

- **Research service:** reads public market data, scores assets and produces explanations. It has no signing capability.
- **Policy service:** validates a user-approved strategy, allocation, slippage, token restrictions, daily loss cap, per-position cap and permission expiry.
- **Execution service:** accepts only a narrowly scoped, authenticated instruction that passes policy checks. It cannot export or use the user's normal wallet private key.

The AI model may propose or explain. It must never be the authority that decides whether a transaction is permitted. Deterministic policy code and on-chain enforcement own that decision.

### 3.2 Vault release gate

Before delegated automation can be offered:

1. Deploy only reviewed source to Solana Mainnet and verify the program ID, executable account, IDL, deployed binary and upgrade authority.
2. Complete independent Anchor/Solana security review and close critical/high findings.
3. Enforce owner, per-trade, aggregate allocation and daily loss limits atomically on-chain.
4. Verify pause, revoke, owner recovery, SOL and SPL-asset withdrawals, nonce/replay protection and failure recovery.
5. Isolate executor authority, rotate keys, monitor its use and provide a user kill switch.
6. Publish exact permissions and collect versioned user consent before funding and before material permission changes.

A connected wallet or front-end slider is not an authorization boundary. Until these gates are complete, the existing wallet-signed manual flow remains separate and autonomous trading remains off.

### 3.3 Operational security

Use server-side secrets only. Validate every request, rate-limit shared endpoints, set bounded timeouts, avoid logging wallet secrets or full provider payloads, keep dependencies pinned, run secret/dependency scans, and maintain an incident/rollback runbook. Provider outage must lead to a visible unavailable state, not fabricated fallback prices or successful-looking UI.

## 4. Scoring, signals and verifiable performance

### 4.1 Market quality score

The market board now uses a versioned 0–100 weighted heuristic:

| Input | Weight |
| --- | ---: |
| Organic activity | 32% |
| Liquidity depth | 20% |
| Turnover | 15% |
| Holder spread | 13% |
| Buy pressure | 12% |
| Short-term calm | 8% |
| **Total** | **100%** |

The score is a relative market-quality heuristic. It is not a probability of profit, a forecast, or proof that a token is safe. An asset must score at least 80 and pass all hard blockers to be marked eligible. Missing data must not receive invented positive points; it should reduce the score where relevant and remain visible as a warning. Hard-blocked assets and low-score Watch assets must be counted separately.

The score model ID and thresholds must be returned by the API and saved into each future signal record. Changing weights requires a new model version, regression tests and a documented release note.

### 4.2 Signal journal: next critical data system

Every published signal should append one immutable record containing:

- Unique signal ID, strategy ID/version and scoring-model ID.
- Mint, pool, chain, token decimals and quote asset.
- Signal timestamp, provider/source timestamps and freshness limits.
- The input snapshot used at decision time, including liquidity, volume, price, holder/audit fields and missing-field markers.
- Raw score, eligibility state, blockers, warnings and human-readable rationale.
- A defined evaluation horizon and the reference price/route used for later evaluation.
- Any subsequent status changes as new events; never overwrite the original decision.

Use durable storage with wallet/account isolation where personal data is involved. Keep public signal records free of private wallet addresses. Make provider/source and model versions queryable. Add tamper-evident event hashes or signed batch roots, but do not call a database log “on-chain verified” unless a corresponding on-chain proof exists.

### 4.3 Evaluate signals separately from executions

Publish two separate ledgers.

**Signal outcomes** answer: “What happened after the alert?” Measure fixed horizons such as 5m, 1h, 6h and 24h against a consistently defined reference price. Include delisted tokens, missing-price outcomes and adverse moves; do not drop losers or use only currently listed tokens.

**Execution performance** answers: “What did a real user/agent actually receive?” Reconcile confirmed transactions and fills from chain data. Calculate realized P&L using actual token quantity and decimals, SOL/USD reference methodology, route output, fees, priority tips, network fees, price impact and failed transactions. Mark transfers, deposits and withdrawals separately from trade P&L. Explain how unrealized positions and stale prices are treated.

Do not merge signal hit rates with trading win rates. Do not treat a theoretical quote, backtest, paper trade, chart screenshot or manually entered price as a live fill.

### 4.4 Public performance and leaderboard policy

A strategy leaderboard should publish sample size, observation period, realized net P&L, win rate, profit factor, max drawdown, average holding time, largest loss, fees and data coverage. Show the calculation method and link to verifiable transaction evidence where disclosure is safe. Pseudonymous identity should be the default; never expose a user's public wallet without consent.

Do not rank a strategy on ROI alone. Require a minimum live sample and observation period, disclose incomplete histories, and label new or low-sample strategies as unranked. The leaderboard API should return an empty/pending state until records can be reconciled; do not seed it with demo rows.

## 5. Strategy studio and adaptive intelligence

### 5.1 Strategy configuration

Allow users to create versioned strategy profiles with validated controls such as:

- Minimum quality score and minimum liquidity/volume.
- Maximum price impact and slippage.
- Maximum SOL per position and aggregate allocation.
- Token-age, authority, concentration and suspicious-token filters.
- Take-profit, stop-loss, time-based exit and daily loss thresholds.
- Allowed venues/routes, operating hours and alert preferences.

Show the exact rules in plain language before save. Store a strategy hash/version in every signal and execution record. A template is a research preset, not a verified strategy. Importing a preset must never silently grant trading permissions.

### 5.2 A learning loop that can be trusted

Do not make an online reinforcement-learning loop directly change live trading behavior. Build it in stages:

1. Store time-stamped feature snapshots and later observed outcomes.
2. Build leakage-safe labels with consistent horizons, survivorship handling and execution-cost assumptions.
3. Train candidate models offline with walk-forward and out-of-sample tests.
4. Compare candidates against the fixed baseline on net returns, drawdown, turnover, failed trades and regime stability.
5. Run candidates in shadow mode on current feeds without sending transactions.
6. Publish model version, evaluation window and limitations; require explicit release approval and rollback before promotion.
7. Monitor drift and disable a model automatically when inputs are stale, missing or outside validated bounds.

The reward function must penalize drawdown, execution costs, illiquidity, failed exits and concentration. A model must not learn from its own unverified generated claims, manipulated social metrics or only the winners that survived token delisting.

## 6. Execution speed and MEV-aware routing

Execution quality should be improved only after the existing signed-swap path is verified end-to-end.

### Near-term reliability work

- Simulate each transaction before presenting it for signature where the route supports simulation.
- Validate mint/owner/amount, quote age, price impact, minimum output, token program and slippage bounds.
- Use bounded priority-fee estimates and refresh expired blockhashes.
- Make submission idempotent; do not retry a trade in a way that can create a duplicate fill.
- Reconcile success/failure from confirmed transaction status and show the signature.
- Preserve an explicit public/private routing choice where it changes execution behavior.

### Private routes and Jito

Evaluate a maintained private-RPC/Jito bundle integration with current provider documentation and an operational cost model. Bundle submission is not a guarantee against sandwich attacks, inclusion, price movement or failed execution. Explain the tip, bundle status and fallback behavior. Never silently fall back from a private route to public mempool submission if that changes the user's risk assumptions.

### Data latency

A Geyser/gRPC stream can reduce ingestion latency, but it adds provider dependency, parsing, backpressure, reconnect, slot-ordering and data-integrity work. Build a measured pipeline with source timestamp, slot, observed timestamp and end-to-end latency metrics before marketing “sub-second” signals. The fallback path must be explicit and must not blend stale stream events with current snapshots without labeling them.

## 7. Launch Studio and launch intelligence

Develop a launch-risk workspace, not a promise that every new token is safe. For every candidate, surface what is actually available:

- Mint and freeze authority state; supply and decimals.
- Creator and deployer identity/history where verifiable.
- Pool address, liquidity, volume, age and quote asset.
- Holder concentration and known cluster signals with source and confidence.
- Liquidity lock/burn status only when the exact position and transaction can be verified.
- Metadata completeness and change history.
- Risk flags, unknown fields and source timestamps.

Missing information must display as unknown, not as “passed.” Do not describe AI scoring as an audit or guarantee. A curated launch list should disclose its inclusion criteria, reviewer conflicts and paid promotion policy. PumpPortal creation is a user-signed third-party launch path; it is not a WELP-owned bonding curve or a guarantee of graduation/listing.

## 8. Telegram companion and viral distribution

The Telegram bot/mini-app should be a secure remote control, not a second wallet.

- Link Telegram identity to a WELP account through a one-time challenge signed by the connected wallet.
- Use short-lived, single-use approval tokens bound to wallet, strategy version, action, size, expiry and nonce.
- Send an alert with token, source timestamp, score/model version, risk warnings and an inspectable link.
- For approval-required actions, show exact asset, amount, maximum slippage, fee, expiry and expected route before the user confirms.
- Recheck current risk policy at approval time; reject stale alerts and replayed callbacks.
- Telegram approval is not a substitute for required wallet/vault authorization. Never collect seed phrases or private keys in chat.
- Add pause/revoke commands, delivery receipts and a clear outage state.

Shareable signal cards must be generated from journal records, carry the original timestamp and model version, and update to show the later outcome—including losses. Never render a predicted return as a realized return.

## 9. Strategy marketplace and copy-vaults

Start with read-only strategy templates and transparent configuration export. Before paid subscriptions or copy execution, require:

- A verified creator identity or clearly disclosed pseudonym.
- A complete, immutable and reproducible performance history.
- Strategy version, risk profile, eligible markets, sample size and drawdown.
- Explicit follower consent, per-follower limits, revocation and stop semantics.
- Audited execution permissions and separate accounting for subscriptions or performance fees.
- Disclosures for conflicts, paid promotion, outages and incomplete data.

Followers must set their own maximum allocation, position size, allowed tokens and loss limits. A strategy creator must never be able to raise a follower's limits or withdraw follower funds.

## 10. Monetization without damaging trust

Keep basic public research and manual inspection accessible. Consider paid access for higher-frequency alerts, advanced strategy controls, multi-workspace analytics, longer history and developer APIs only after service levels and costs are understood.

Any execution fee must be displayed before the user signs, included in net-performance calculations and tied to a clearly identified recipient. Avoid hidden spread markups. Do not charge for a trade that did not execute unless the fee is clearly a separate disclosed service charge. Subscription billing needs cancellation, refund and support procedures.

Do not introduce staking or token incentives as a substitute for product-market fit. Never route user losses, collateral or liquidation proceeds to the operator.

## 11. Cross-market expansion

Solana should remain the first-class execution environment until the research, signal and execution records are reliable. Expand by adding one market adapter at a time with its own data rights, identifiers, hours, fees, liquidity, custody and compliance review.

Tokenized equities are blockchain instruments with issuer, transfer, jurisdiction and liquidity constraints; they are not equivalent to direct brokerage shares. Do not advertise cross-market arbitrage until both venues permit it, withdrawals/settlement are understood, and fees, spreads, funding and transfer delays are included. FX, perpetuals and traditional equities each need a separate risk model and execution partner.

## 12. Release sequence and acceptance gates

| Phase | Ship only when | User-visible result |
| --- | --- | --- |
| **P0 — Trust baseline** | Versioned 0–100 scoring, distinct Watch/Blocked states, tests and honest disclosures | Users can tell why an asset qualifies, needs review or is blocked |
| **P1 — Evidence layer** | Durable signal journal, immutable model snapshots, outcome evaluator and data-quality reporting | Signals gain a dated, reproducible history |
| **P2 — Strategy studio** | Versioned settings, risk validation, historical data licensing and out-of-sample tests | Users can customize rules without silently granting execution permission |
| **P3 — Execution safety** | End-to-end signed swap verification, idempotency, transaction reconciliation, MEV routing review and audited vault gates | Users get reliable, observable execution; automation remains opt-in |
| **P4 — Distribution** | Telegram identity challenge, replay-safe approval flow, verifiable signal cards and incident controls | Users can follow and approve safely away from desktop |
| **P5 — Network and revenue** | Complete creator/follower disclosures, reproducible performance, billing/accounting controls | Strategy discovery and paid tiers are based on real value |
| **P6 — Expansion** | Maintained market adapters, permitted assets, supported settlement and separate risk review | New markets are added without pretending they behave like Solana tokens |

### Definition of done for a feature

A feature is done only when its code path is implemented, unit/integration tests pass, source and error states are documented, secrets are externalized, abuse and outage behavior are covered, the deployed environment is verified, and the README/roadmap accurately describe its status. A page, mockup, scaffold, green build or successful quote alone is not sufficient evidence.
