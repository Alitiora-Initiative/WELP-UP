# WELP UP! project roadmap

This roadmap distinguishes the product the user wants from features currently available in the browser app. A checked item describes implemented UI, agent hardening, or documentation, not a security audit of an on-chain vault.

## Next planned milestone: launchpad and platform hardening

The launchpad and protocol-security milestone is in progress but not production-ready. The current launchpad route is a configuration/status page; no production token mint, bonding curve, buy/sell, escrow, refund or graduation transaction is available. The complete task list, account model, acceptance gates, fee requirements, and security checklist are in [docs/LAUNCHPAD_AND_SECURITY_BACKLOG.md](docs/LAUNCHPAD_AND_SECURITY_BACKLOG.md).

- [ ] Build the Anchor launch program for creator-selected supply from 1 to 1,000,000,000 whole tokens, with launch escrow, Active/Graduated/Refundable state, checked purchase math and owner/account validation.
- [ ] Add the early-slot per-wallet 5% allocation cap (10,000,000 tokens at the specified supply) and refund protection.
- [ ] Integrate an audited Raydium pool-creation CPI for graduation; verify and burn LP tokens only after independent validation.
- [ ] Add a wallet-approved launchpad purchase/creator flow using the repository's current Solana Kit wallet stack and the existing `app/launchpad/page.tsx` route.
- [ ] Keep Helius credentials and privileged RPC operations on the backend; add bounded priority-fee estimates, RPC fallback, retry, and connection cleanup.
- [ ] Enforce the 0.50% gross-input protocol fee on WELP-controlled swaps by atomically crediting 100% to the correct treasury vault; after 14 days, release 60% of eligible new SOL inflows and retain 40% as reserve. The current SOL-only vault does not support SPL-token input fees.
- [ ] Harden API boundaries, secrets handling, idempotency, replay protection, monitoring, dependency scanning, adversarial tests, and privacy controls.
- [ ] Keep all deployments and user-facing transaction paths mainnet-only. Before mainnet use, complete source review, reproducible SBF builds, host/SBF-backed checks, independent audit, production key management, program verification and a separate release review. Do not deploy or test on Devnet.

## Current release

- [x] Open new buys at 0.001 SOL while leaving the input adjustable.
- [x] Keep the browser buy range between 0.001 and 0.02 SOL per buy.
- [x] Add separate Home, Overview, Live signals, Swap, Safety, Portfolio activity, Profile, Terms, and Privacy routes.
- [x] Present the current flow on Home: connect wallet, analyze candidates, review a quote, and sign a swap.
- [x] Keep each current swap under the connected user's wallet signature.
- [x] Add profile transaction history from Solana RPC, with 10, 25, 50, or 100 rows per page.
- [x] Key local activity data by public wallet address and make its local-only scope explicit.
- [x] Add a portfolio-style chart for wallet snapshots and distinguish scans from signed transactions.
- [x] Replace the previous dashboard shell with the WELP UP terminal, live Jupiter market board, rule-based signals, wallet-approved swap desk, and responsive navigation.
- [x] Add optional 60-second browser-local watch-policy monitoring with permission-based desktop alerts and 24-hour per-policy/token deduplication; monitoring never places trades.
- [x] Publish Terms v1.0 and Privacy Policy for the web application.
- [x] Python agent: untrained brain no longer drags scores out of the 80–98 band.
- [x] Python agent: dynamic priority fee when env fee is 0.
- [x] Python agent: validate signer membership before signing swaps.
- [x] Python agent: adopt orphan on-chain balances into the ledger each cycle.
- [x] Python agent: reject mints with live freeze authority or high transfer fees.
- [x] CI workflow runs unit tests and Next.js lint/typecheck/build.
- [x] LIMITS.md contract test against config constants.
- [x] Vault Phase 1 threat model document (`docs/vault/THREAT_MODEL.md`).
- [x] Vault architecture chosen and documented (`docs/vault/ARCHITECTURE.md`).
- [x] Vault program scaffold (Anchor) under `programs/vault/` — mainnet still disabled.

## Trading automation status

### Automation and agent interfaces — status only

- [x] Publish automation policy, agent status, and autonomous-monitor pages in the terminal.
- [x] Keep the pages explicit that no production agent runtime, delegated signing authority, or unattended trade execution is configured.
- [x] Remove the former browser paper-bot simulator rather than presenting simulated performance as live trading capability.
- [ ] Build and independently review a real agent runtime only after the vault, consent, executor isolation, and recovery gates below are satisfied.

### Live trading — not implemented

The requested product is an AI agent that analyzes the market, selects suitable tokens, trades within the funds the user allocates, manages positions, and attempts take-profit or other exits. The user's approved design requirements are:

- [ ] Connect a real market-data feed and strategy service; clearly separate generated signals from deterministic paper rules.
- [ ] Before the agent can trade, the user chooses a SOL allocation and explicitly confirms a transaction that funds the isolated vault.
- [ ] The vault enforces the user's total allocation cap on-chain. The browser or a database value alone is not sufficient.
- [ ] Each new position is limited to at most 0.02 SOL, subject to the user choosing a smaller size.
- [ ] The trade executor can act only through the vault's narrowly scoped authority, and only after the website wallet session approves that authority.
- [ ] The agent monitors only the user's opted-in vault positions and attempts configured take-profit, loss-limit, or exit actions. The UI must show the policy and explain that execution and target prices are not guaranteed.
- [ ] The user can pause or revoke the agent's authority and withdraw available vault assets to their wallet at any time. Withdrawal behavior for open token positions must be explicit and verified.
- [ ] Every user has a separate vault and wallet-scoped history; one user's permissions, limits, and activity must never leak into another user's view.
- [ ] The user receives a separate, versioned consent flow before vault funding and before any material change to its permissions.
- [ ] The deployed program, upgrade authority, executor, Jupiter integration, cap enforcement, revocation, withdrawals, and emergency behavior receive independent review and adversarial testing before mainnet funds are enabled.
- [ ] Validate calculations with checked arithmetic/unit/property tests and verify the final live transaction using a wallet-signed mainnet transaction only after deployment and audit. Do not present simulations or replay data as live trading.

### Vault launch gates

1. [x] Write and review a threat model and exact on-chain authority diagram. (`docs/vault/THREAT_MODEL.md`)
2. [x] Choose the program or smart-account architecture and document how the agent is authorized without custody of the user's normal wallet key. (`docs/vault/ARCHITECTURE.md`, `programs/vault/`)
3. [ ] Complete mainnet release prerequisites for total-cap, per-position, token/program allowlist, pause, revoke and withdrawal enforcement. No user funds are accepted until deployed source and program identity are verified and independently audited.
   - [x] Keep the vault interface separated from the mainnet app wallet. No deployed production vault ID or fund-moving route is currently configured; the interface must stay fail-closed.
   - [ ] Deploy the reviewed program to Solana Mainnet only after all audit/release gates pass; verify source, IDL, program account, upgrade authority and all enabled instructions. Current `execute_swap` and SPL-token withdrawals remain disabled/unimplemented.
4. [ ] Publish verified source and program addresses; complete an independent audit and resolve critical/high findings.
5. [ ] Implement durable, wallet-scoped vault configuration and consent records tied to the website wallet session.
6. [ ] Complete jurisdiction-appropriate legal and privacy review, update the Terms, and obtain any required user consent.
7. [ ] Launch only after the user-facing limits match the deployed enforcement and withdrawals have been verified.

**Mainnet autonomous vault remains disabled.** The `/automation`, `/agent`, and `/autonomous` pages are status and policy interfaces; they do not run bots, place orders, or simulate P&L. No executor is connected. Existing swaps run only after a wallet connects and explicitly signs the transaction.

## Requested trading product expansion — planning checklist

This is a staged plan, not a promise that a provider, market, or trading product is already connected. Every release must update this file and README to match deployed behavior.

| Priority | Work item | Acceptance gate | Status |
| --- | --- | --- | --- |
| P0 | Paper bot studio | Local config CRUD, validation, transparent manual ticks and simulated metrics; unit tests pass. | Removed from production UI; no paper performance is presented |
| P0 | Wallet connect clarity | Keep a clear connect control in the terminal; improve wallet choice and visible network guidance before live trading. Require a user click for wallet prompts; connection alone never starts a bot. | Shared control reused; further clarity pending |
| P1 | Market catalog and price feed | Add curated Solana markets first; verify mint, pool, source, timestamp, quote asset, and stale-data behavior. Expand chain coverage only with maintained, deduplicated listings; do not claim “all crypto” without it. | Not started |
| P1 | TradingView charts | Confirm library access and usage terms; implement a datafeed with symbol search, OHLC history, live updates, market hours/time zone, and stale/error states. The chart library itself does not provide market data; see the [Datafeed API](https://www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/). | Not started |
| P1 | Mainnet vault release gate | Deploy only the reviewed source to Solana Mainnet after audit; verify caps, executor permissions, pause/revoke, owner recovery and SPL-token withdrawals with explicit wallet-signed mainnet checks. | Partial scaffold only |
| P1 | User-controlled funding and recovery | Map deposits, token ownership, open positions, failed swaps, emergency pause, and withdrawal flows. Retain owner control; never treat losses or liquidations as protocol revenue. | Not started |
| P2 | Fonbnk fiat on/off-ramp | Obtain a merchant account; confirm supported fiat currencies and Solana asset availability for this merchant; integrate the provider widget or signed server API, webhook verification, reconciliation, limits, KYC/AML, refunds, support, and disclosures. Keep provider credentials server-side. See [Fonbnk Widget docs](https://docs.fonbnk.com/widget-integration/getting-started) and [Server API docs](https://docs.fonbnk.com/server-to-server/getting-started). | Not started |
| P2 | Perpetual futures | Separate product and risk review; define funding, margin, liquidation, mark price, outage handling, and explicit user consent. No leverage or live perpetual order is available in the current app. | Not started |
| P2 | Affiliate program | Define transparent, opt-in referral attribution and a payout ledger funded from a separately disclosed operator budget or approved fees. Never pay affiliates from a user's losses, collateral, or liquidation proceeds. | Not started |
| P2 | Legal, operations, and mainnet readiness | Qualified legal review, fee/custody and licensing analysis, updated terms/privacy, incident response, monitoring, audited immutable or governed program, and independent security assessment. | Not started |

**Treasury constraint:** Do not add code that redirects user funds, losses, liquidation proceeds, or collateral to an operator-controlled wallet. No treasury address is embedded in the app. Any future protocol fee requires a documented purpose, separate accounting, clear disclosure, and explicit user authorization before the transaction.

## Legal and publishing follow-up

- [ ] Have qualified counsel review the Terms, privacy disclosure, contact details, dispute language, regulatory treatment, and acceptance mechanism.
- [ ] Publish any legally required operator disclosures after jurisdiction-specific legal review.
- [ ] Implement a durable record of the exact Terms version and affirmative user acceptance before relying on it as a contract.
- [x] Publish a separate privacy notice.
- [ ] Keep this documentation aligned with the code actually running on Vercel.

## History and reporting improvements

- [ ] Add decoded SOL/token amounts and transaction type to Profile history, with pagination that remains reliable under RPC rate limits.
- [ ] Add explicit export and retention controls for locally recorded activity.
- [ ] Add position-level history only after data can be verified from on-chain transactions; never infer P&L from a wallet balance line.
- [ ] Consider authenticated cross-device history only with a published privacy model and clear consent.
