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

## Autonomous trading — not implemented on-chain

The requested product is an AI agent that analyzes the market, selects suitable tokens, trades within the funds the user allocates, manages positions, and attempts take-profit or other exits. The user's approved design requirements are:

- [ ] AI analysis discovers and ranks suitable tokens, with clear reasons and timestamps visible in the activity page.
- [ ] Before the agent can trade, the user chooses a SOL allocation and explicitly confirms a transaction that funds the isolated vault.
- [ ] The vault enforces the user's total allocation cap on-chain. The browser or a database value alone is not sufficient.
- [ ] Each new position is limited to at most 0.02 SOL, subject to the user choosing a smaller size.
- [ ] The trade executor can act only through the vault's narrowly scoped authority; it never receives or stores the user's Phantom private key or seed phrase.
- [ ] The agent monitors only the user's opted-in vault positions and attempts configured take-profit, loss-limit, or exit actions. The UI must show the policy and explain that execution and target prices are not guaranteed.
- [ ] The user can pause or revoke the agent's authority and withdraw available vault assets to their wallet at any time. Withdrawal behavior for open token positions must be explicit and verified.
- [ ] Every user has a separate vault and wallet-scoped history; one user's permissions, limits, and activity must never leak into another user's view.
- [ ] The user receives a separate, versioned consent flow before vault funding and before any material change to its permissions.
- [ ] The deployed program, upgrade authority, executor, Jupiter integration, cap enforcement, revocation, withdrawals, and emergency behavior receive independent review and adversarial testing before mainnet funds are enabled.

### Vault launch gates

1. [x] Write and review a threat model and exact on-chain authority diagram. (`docs/vault/THREAT_MODEL.md`)
2. [x] Choose the program or smart-account architecture and document how the agent is authorized without custody of the user's normal wallet key. (`docs/vault/ARCHITECTURE.md`, `programs/vault/`)
3. [ ] Implement and test on **devnet** with explicit total-cap, per-position, token/program allowlist, pause, revoke, and withdraw checks.
4. [ ] Publish verified source and program addresses; complete an independent audit and resolve critical/high findings.
5. [ ] Implement durable, wallet-scoped vault configuration and consent records without collecting private keys.
6. [ ] Complete Kenyan legal and privacy review, update the Terms, and obtain new user consent.
7. [ ] Launch only after the user-facing limits match the deployed enforcement and withdrawals have been verified.

**Mainnet autonomous vault remains disabled.** The browser `/autonomous` page is UI-only. The Python CLI agent remains a separate path that uses a local key when armed with `WELP_ARM=TRADE-LIVE`.

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
