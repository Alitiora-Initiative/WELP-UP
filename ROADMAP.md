# WELP UP! project roadmap

This roadmap distinguishes the product the user wants from features currently available in the browser app. A checked item describes implemented UI, agent hardening, or documentation, not a security audit of an on-chain vault.

## Current release

- [x] Open new buys at 0.001 SOL while leaving the input adjustable.
- [x] Keep the browser buy range between 0.001 and 0.02 SOL per buy.
- [x] Add separate Home, Overview, Live signals, Swap, Safety, Portfolio activity, Profile, Terms, and Privacy routes.
- [x] Present the current flow on Home: connect wallet, analyze candidates, review a quote, and sign a swap.
- [x] Keep each current swap under the connected user's wallet signature.
- [x] Add profile transaction history from Solana RPC, with 10, 25, 50, or 100 rows per page.
- [x] Key local activity data by public wallet address and make its local-only scope explicit.
- [x] Add a portfolio-style chart for wallet snapshots and distinguish scans from signed transactions.
- [x] Add a paper-only AI Bot Studio with editable strategies, grid/risk settings, bot lifecycle controls, manual paper price ticks, and simulated P&L.
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

### Paper trading — implemented in the browser

- [x] Create, pause, stop, and remove up to 12 bot configurations in local browser storage.
- [x] Configure strategy preset, symbol, direction, paper investment, price range, grid count, TP/SL, start/stop rules, and runtime.
- [x] Apply manual paper price ticks and display estimated grid fills, cycles, grid profit, unpaired P&L, runtime, and status.
- [x] Keep the shared wallet connection control visible in the page header without making a wallet necessary for paper runs.
- [x] Label paper calculations as illustrative; do not present them as exchange data or actual returns.
- [x] Add automated tests for bot validation, price-grid crossings, TP/SL, stop conditions, and numeric boundaries.

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
- [ ] Validate all calculations and order rules against a deterministic replay/backtest harness before any on-chain execution.

### Vault launch gates

1. [x] Write and review a threat model and exact on-chain authority diagram. (`docs/vault/THREAT_MODEL.md`)
2. [x] Choose the program or smart-account architecture and document how the agent is authorized without custody of the user's normal wallet key. (`docs/vault/ARCHITECTURE.md`, `programs/vault/`)
3. [ ] Implement and test on **devnet** with explicit total-cap, per-position, token/program allowlist, pause, revoke, and withdraw checks.
   - [x] Add a Devnet-only website console for owner PDA setup, SOL fund/withdraw, pause, and executor revoke; fail closed when the program isn't configured and executable.
   - [ ] Deploy matching source and verify all actions on Devnet. `execute_swap` and SPL-token withdrawals remain disabled/unimplemented.
4. [ ] Publish verified source and program addresses; complete an independent audit and resolve critical/high findings.
5. [ ] Implement durable, wallet-scoped vault configuration and consent records tied to the website wallet session.
6. [ ] Complete Kenyan legal and privacy review, update the Terms, and obtain new user consent.
7. [ ] Launch only after the user-facing limits match the deployed enforcement and withdrawals have been verified.

**Mainnet autonomous vault remains disabled.** The `/autonomous` page now supports local paper-bot configuration and manual simulated ticks. This does not change the on-chain status above: no executor is connected, no live order is placed, and the page does not use current exchange prices. The Python CLI cannot sign; existing swaps run only after a wallet connects on the website.

## Requested trading product expansion — planning checklist

This is a staged plan, not a promise that a provider, market, or trading product is already connected. Every release must update this file and README to match deployed behavior.

| Priority | Work item | Acceptance gate | Status |
| --- | --- | --- | --- |
| P0 | Paper bot studio | Local config CRUD, validation, transparent manual ticks and simulated metrics; unit tests pass. | Implemented; 4 unit tests pass |
| P0 | Wallet connect clarity | Keep a clear connect control on the bot page; improve wallet choice and visible network guidance before live trading. Require a user click for wallet prompts; connection alone never starts a bot. | Shared control reused; further clarity pending |
| P1 | Market catalog and price feed | Add curated Solana markets first; verify mint, pool, source, timestamp, quote asset, and stale-data behavior. Expand chain coverage only with maintained, deduplicated listings; do not claim “all crypto” without it. | Not started |
| P1 | TradingView charts | Confirm library access and usage terms; implement a datafeed with symbol search, OHLC history, live updates, market hours/time zone, and stale/error states. The chart library itself does not provide market data; see the [Datafeed API](https://www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/). | Not started |
| P1 | Vault Devnet gate 3 | Deploy matching source, run transaction-level and property tests for caps, executor permissions, pause/revoke, and owner recovery; implement and verify SPL-token withdrawals. | Partial scaffold only |
| P1 | User-controlled funding and recovery | Map deposits, token ownership, open positions, failed swaps, emergency pause, and withdrawal flows. Retain owner control; never treat losses or liquidations as protocol revenue. | Not started |
| P2 | Fonbnk fiat on/off-ramp | Obtain a merchant account; confirm Kenya/KES and Solana/asset availability for this merchant; integrate the provider widget or signed server API, webhook verification, reconciliation, limits, KYC/AML, refunds, support, and disclosures. Keep provider credentials server-side. See [Fonbnk Widget docs](https://docs.fonbnk.com/widget-integration/getting-started) and [Server API docs](https://docs.fonbnk.com/server-to-server/getting-started). | Not started |
| P2 | Perpetual futures | Separate product and risk review; define funding, margin, liquidation, mark price, outage handling, and explicit user consent. No leverage or live perpetual order is available in the current app. | Not started |
| P2 | Affiliate program | Define transparent, opt-in referral attribution and a payout ledger funded from a separately disclosed operator budget or approved fees. Never pay affiliates from a user's losses, collateral, or liquidation proceeds. | Not started |
| P2 | Legal, operations, and mainnet readiness | Kenyan counsel review, fee/custody and licensing analysis, updated terms/privacy, incident response, monitoring, audited immutable or governed program, and independent security assessment. | Not started |

**Treasury constraint:** Do not add code that redirects user funds, losses, liquidation proceeds, or collateral to an operator-controlled wallet. No treasury address is embedded in the app. Any future protocol fee requires a documented purpose, separate accounting, clear disclosure, and explicit user authorization before the transaction.

## Legal and publishing follow-up

- [ ] Have Kenyan counsel review the Terms, privacy disclosure, operator/contact details, dispute language, regulatory treatment, and acceptance mechanism.
- [x] Publish operator identity (Joseph Mushelle Nyingeh / Alitiora Initiative) and contact emails.
- [ ] Implement a durable record of the exact Terms version and affirmative user acceptance before relying on it as a contract.
- [x] Publish a separate privacy notice.
- [ ] Keep this documentation aligned with the code actually running on Vercel.

## History and reporting improvements

- [ ] Add decoded SOL/token amounts and transaction type to Profile history, with pagination that remains reliable under RPC rate limits.
- [ ] Add explicit export and retention controls for locally recorded activity.
- [ ] Add position-level history only after data can be verified from on-chain transactions; never infer P&L from a wallet balance line.
- [ ] Consider authenticated cross-device history only with a published privacy model and clear consent.
