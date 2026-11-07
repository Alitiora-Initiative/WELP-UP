# WELP UP!

**WELP UP! is a non-custodial Solana market and trading console.** The product direction is to combine live market intelligence, explainable signal analysis, wallet-approved swaps, and a user-controlled on-chain vault architecture for bots.

- **Website:** https://welpup.fun/
- **Repository:** https://github.com/Alitiora-Initiative/WELP-UP
- **Network target:** Solana Mainnet-Beta for production market reads and wallet-approved swaps
- **Source blueprint:** [`welp-original-source`](./welp-original-source) — the complete recovered Base44 application source supplied for this rebuild

> **Important — current production boundary:** WELP UP is not currently an autonomous real-funds trading platform, and its vault is not open for deposits. The recovered Base44 source defines the product blueprint and expected experience; it is not proof that every feature is implemented, deployed, audited, or safe to fund. No bot performance, TVL, ROI, user balances, vault activity, or AI execution should be fabricated or presented as live.

## Product direction

The recovered source is the primary reference for product requirements, page structure, workflows, design language, and intended mechanics. The rebuild should preserve its intent while replacing the Base44 runtime with the repository's maintainable Next.js, React, Solana, and server-side architecture.

The intended product areas are:

1. **Markets** — current Solana token and pool data, market discovery, watchlists, and transparent asset context.
2. **Signals** — deterministic, inspectable scoring and explicit eligibility blockers. A score is not a probability of profit or a prediction.
3. **Trade desk** — Jupiter-powered route preparation, visible transaction details, risk checks, and explicit wallet approval.
4. **Automation and agents** — user-configured strategies, monitoring, and AI-assisted market analysis. Agent commentary must be distinguished from deterministic rules; no agent may sign with a user's secret or silently submit a trade.
5. **Vault** — per-owner on-chain accounting and narrowly scoped, revocable execution authority, only after the program and all release gates are independently verified.
6. **Portfolio, history, and activity** — wallet-derived public data and clearly labelled local or indexed records, never invented P&L.
7. **Strategy marketplace** — bot discovery, owner consent, follower permissions, and profit-share settlement only after the required on-chain identity, accounting, and payout systems exist.
8. **Documentation and safety** — architecture, risk limits, operational status, whitepaper, terms, privacy, and release gates kept consistent with shipped behavior.

## What is currently available

The existing Next.js application currently provides the following documented capabilities. Availability still depends on configured providers, network connectivity, and wallet support.

- Connect an external Solana wallet and read its public address and balance.
- Retrieve public market/token information from configured data providers.
- Display transparent, rule-based signal scores and their blocking conditions.
- Prepare Jupiter Swap API v2 orders and require the connected wallet to review and sign before execution.
- Read public on-chain wallet and transaction information through Solana RPC.
- Store certain watch policies, appearance preferences, and activity snapshots locally in the browser.
- Show product, system, safety, and vault launch documentation.

Browser-local records are not a complete on-chain ledger, verified account history, or audited profit-and-loss statement. Market-data outages or missing fields must be shown as unavailable rather than replaced with sample values.

## Not enabled — do not represent as live

- Autonomous mainnet bot execution or an AI agent with transaction-signing authority.
- A production vault that accepts deposits, holds user funds, or executes swaps.
- Copy trading, follower allocation, public bot settlement, or creator profit-share payouts.
- Production user accounts, multi-device sync, or a secure hosted API-key manager.
- Governance execution, referral attribution, or referral reward payments.
- Production bot-creation fees, treasury routing, or fee distribution.
- Fiat on-ramps, perpetual futures, tokenized-stock execution, or centralized-exchange trading.

The current Anchor vault program is a scaffold and must be treated as unlaunched until its program ID, deployment, source verification, audit, integrations, and release evidence are confirmed. Never invite users to deposit based on a UI, a source file, a local validator, or a successful frontend build.

## Non-negotiable security and product rules

These rules come from the supplied source and build blueprint and govern all future implementation:

- **Never collect wallet secrets.** Do not request, accept, store, transmit, log, or require a seed phrase, mnemonic, private key, wallet export, or centralized-exchange API key.
- **External wallet approval stays explicit.** The connected wallet signs setup, funding, permission changes, withdrawals, and ordinary swaps. No hidden transaction, silent retry, or server-side use of a user's signing secret.
- **Fail closed.** Missing program IDs, unverified accounts, stale quotes, unavailable RPC/data, failed checks, or incomplete security gates must disable the affected action and explain why.
- **On-chain state is authoritative.** Vault balances, bot slots, spending limits, fees, and settlement must not be sourced from a Web2 database. An indexer may provide read-only history only and must reconcile against on-chain state/events.
- **Delegated authority must be narrow and revocable.** Any future automated instruction must use a constrained program-derived authority, with owner-controlled pause, revoke, and withdrawal paths. The AI/server must never possess the owner's wallet secret.
- **No centralized exchange execution.** Market-data integrations are read-only; do not add exchange credentials or user API-key trading.
- **No invented data or simulated production claims.** Fixtures and validator tests may be used in development only and must be unmistakably labelled. Never publish fabricated balances, TVL, volume, users, bot results, AI activity, or transaction history.
- **Fees require verified configuration and atomic settlement.** Do not collect the proposed bot setup fee or creator share until the recipient, treasury PDA, fee calculation, disclosures, reconciliation, and on-chain payment path are validated and tested.
- **No mainnet fund movement before release approval.** A UI implementation, unit test, host Rust check, or frontend build is not an Anchor security audit or authorization to accept deposits.

## Intended vault and bot model

The blueprint describes user-created personal or public bots backed by an owner-controlled vault. The intended model includes:

- A per-owner vault PDA and explicit owner identity.
- A bounded total allocation/spend cap and a per-position maximum.
- A paused-by-default execution path.
- Optional allowed-mint restrictions and explicit strategy parameters.
- Owner-controlled pause, revoke, and withdrawal instructions.
- Execution restricted to a narrowly scoped, revocable program authority.
- On-chain accounting for deposits, withdrawals, positions, realized results, fees, and settlement.
- A public strategy marketplace only after bot ownership, follower consent, allocation limits, and settlement are enforceable.
- A distinct, disclosed bot activation fee and creator share of realized positive net profit, with no double charging.

These are **target requirements**, not a statement that the functionality is deployed. The exact fee recipient and treasury configuration must be validated before any fee route is enabled. Do not hard-code an unverified address from a planning document.

## Architecture

The production repository is a Next.js App Router application using React and Solana tooling. The recovered source is a Vite/React application that depended on Base44 SDK services and browser routing. Its components and mechanics must be ported deliberately rather than reintroducing Base44 as a runtime dependency.

- **Web application:** Next.js App Router and React.
- **Wallet:** external Solana wallet connection; the application handles public addresses and wallet-approved transactions.
- **Swaps:** Jupiter Swap API v2, subject to quote freshness, risk checks, and wallet approval.
- **Chain reads:** Solana RPC for public account and transaction data.
- **On-chain program:** Anchor/Rust vault scaffold under `programs/vault`; not a production vault until verified and audited.
- **Research/agent code:** Python modules under `welp/`; their presence does not mean a hosted production agent is running.
- **Persistence:** distinguish browser-local preferences/activity from verified on-chain state. Do not treat local storage as custody or accounting.

The Base44 source archive is the reference for the intended product. The existing Next.js implementation and current runtime evidence determine what is actually shipped. When they disagree, document the gap and implement the blueprint safely; never copy an old claim into production documentation without verifying it.

## Repository guide

- `app/` — Next.js routes and layouts.
- `components/` — terminal, market, wallet, vault, and shared UI components.
- `lib/` — market, wallet, risk, and vault client logic.
- `programs/vault/` — Anchor/Rust vault program scaffold.
- `welp/` — Python research and agent modules.
- `docs/` — architecture, threat model, production-readiness, runbooks, and release documentation.
- `welp-original-source` — recovered full Base44 source archive used as the product blueprint.

## Local development

Requirements: Node.js and npm. From the repository root:

```bash
npm ci
npm run dev
```

Run the repository checks before submitting changes:

```bash
npm run lint
npm run typecheck
npm run build
```

Additional tests and Rust checks are defined by the repository scripts and CI workflow. Run the relevant tests for every changed subsystem. Anchor/SBF builds, validator tests, audits, and deployment verification must be reported separately; do not imply they passed if the required toolchain or environment was unavailable.

Keep provider credentials server-side and out of source control. Never commit wallet secrets, private keys, seed phrases, RPC credentials, or provider tokens.

## Release checklist

Before enabling any real-funds vault or automated execution:

1. Port and review the required workflows from the recovered source without carrying forward Base44-only runtime assumptions.
2. Finalize the vault account model, instruction constraints, token/position accounting, and migration strategy.
3. Build with a pinned, compatible Solana/Anchor toolchain and run local-validator integration tests.
4. Independently audit the program and remediate all findings.
5. Verify the deployed Mainnet-Beta program ID, source, upgrade authority, and configuration.
6. Test wallet setup, funding, execution limits, pause, revoke, withdrawal, failure recovery, and accounting reconciliation.
7. Verify fee recipients and atomic fee settlement; publish clear fee disclosures.
8. Verify data-provider behavior, monitoring, incident response, and user-facing status reporting.
9. Obtain explicit release approval before enabling deposits or automated mainnet fund movement.

See the detailed engineering and vault documents in `docs/`. A green web build is necessary but not sufficient.

## Risk disclosure

Solana transactions may be irreversible, swaps can execute at worse prices than quoted or fail while consuming network fees, market data can be delayed or unavailable, and users can lose some or all of the assets they trade. WELP UP does not promise profit, capital protection, liquidity, or uninterrupted execution. Nothing in the interface or documentation is investment advice.
