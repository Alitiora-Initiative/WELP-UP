# Next-phase implementation backlog: Launchpad and platform hardening

**Status: planned only.** This document is the implementation checklist for the next launchpad milestone. The current Launchpad route is a locked discovery/status page; no launch program, purchase flow, graduation CPI, or launch fee settlement is being represented as live.

This work is separate from the existing vault and trading work. Do not activate unattended trading, enable vault deposits, deploy a new program to Mainnet-Beta, or change unrelated trade-size policy while completing this backlog.

## 1. Launchpad product and UI

- [ ] Upgrade the existing `app/launchpad/page.tsx` route in the current Next.js App Router; do not create a parallel `src/pages` application.
- [ ] Build a responsive creator studio and launch discovery view with clear launch states: Active, Graduated, and Refundable.
- [ ] Show verified mint, creator, supply, funding cap, SOL raised, progress, start/end slot or time, token allocation, fee, liquidity/pool address, and transaction links only when backed by confirmed on-chain data.
- [ ] Keep creation, purchase, refund, and graduation actions disabled until the matching program is deployed, verified, and enabled by a reviewed release.
- [ ] Use empty and unavailable states when no verified launch data exists. No fabricated launches, volumes, prices, pool addresses, holders, progress, or transactions.
- [ ] Show exact purchase allocation, slippage/minimum received, network fee estimate, protocol fee, destination split, and irreversible actions before the wallet is asked to sign.

## 2. Anchor launch program

**Target file:** `programs/launchpad/src/lib.rs`  
**Workspace integration:** add `programs/launchpad` to `Anchor.toml` only after the new crate and its tests are ready.

- [ ] Create a deployment-specific Anchor program with a verified program ID; never reuse the undeployed vault placeholder ID.
- [ ] Define `TokenLaunchAccount` as an owner- and seed-constrained PDA. It must persist at minimum: `total_sol_raised`, `funding_cap`, `max_supply` (200,000,000 tokens in clearly defined base units), `creator_pubkey`, launch state, mint, start/end slot or timestamp, and bump.
- [ ] Define launch states `Active`, `Graduated`, and `Refundable`, with explicit, tested state transitions. A launch must not be able to graduate twice or accept purchases/refunds in an incompatible state.
- [ ] Define the launch escrow PDA separately from the state account. Validate seeds, bump, account owner, creator, mint, token program, system program, and every writable/signer account for every instruction.
- [ ] Implement `buy_tokens`: transfer SOL from the signing buyer into the launch escrow with the System Program; calculate the token allocation with checked integer arithmetic (use a sufficiently wide intermediate such as `u128`, checked operations, and an explicit rounding policy); enforce a caller-supplied minimum output; and transfer tokens from the program-controlled token vault to the buyer ATA through the correct SPL Token or Token-2022 CPI.
- [ ] Specify token decimals and raw-unit conversion before implementing the price formula. Enforce total minted/distributed supply never exceeds 200,000,000 tokens.
- [ ] Create buyer ATAs idempotently where appropriate, validate the canonical mint and token-program owner, and reject substituted accounts or unexpected transfer-fee/hook behavior unless explicitly supported and tested.
- [ ] Implement per-wallet purchase accounting in a launch-scoped PDA. During a configurable, on-chain early-slot window, reject a wallet whose cumulative allocation would exceed **5% of max supply** (10,000,000 tokens when max supply is 200,000,000). Emit a dedicated anti-sniper custom error. Test boundary slots, split purchases, multiple ATAs, and attempted account substitution.
- [ ] Implement the refund path for launches that expire without meeting their funding cap. A refund must be claimable only by the original buyer for their recorded contribution, protected against duplicate claims, and backed by available escrow SOL.
- [ ] Implement `graduate_launch` with a one-time state transition and an on-chain `total_sol_raised >= funding_cap` check. Do not treat a Jupiter swap router as an AMM pool-initialization program: select and pin the exact AMM program and supported pool type (Raydium CPMM/CLMM or another reviewed adapter), validate every CPI account, token mint, pool, vault, and returned LP-token amount, and test the CPI under ProgramTest before integration.
- [ ] Route the LP tokens to the explicitly specified burn address only after the pool and LP mint are verified. LP burning is irreversible; document it, make the destination a fixed reviewed constant, and test that no substituted mint or token account can redirect the LP tokens.
- [ ] Use checked arithmetic, replay-protected nonces/receipts, explicit rent handling, transaction rollback assumptions, and bounded account arrays. Reject arbitrary remaining-account forwarding and arbitrary program IDs.
- [ ] Add event records for launch creation, purchase, refund, graduation, and fee settlement so the UI/indexer can reconcile state from confirmed signatures.

## 3. TypeScript connector and transaction assembly

**Current architecture:** Next.js App Router, `@solana/kit`, `@solana/react`, and `@solana/kit-plugin-wallet`. The repository does not currently depend on `@solana/wallet-adapter-react`; use the existing wallet client pattern (or plan and test a deliberate wallet-stack migration) rather than mixing incompatible wallet-adapter hooks into the current app.

- [ ] Add a typed launchpad service in the existing source layout (for example, `lib/launchpad-service.ts`) and integrate it with `app/launchpad/page.tsx`.
- [ ] Derive launch, escrow, buyer-accounting, mint-authority, and token-vault PDAs deterministically from the verified program ID and documented seeds.
- [ ] Build purchase transactions with the required ATA creation instruction when the buyer ATA does not exist, followed by the launch program's `buy_tokens` instruction.
- [ ] Add Compute Budget instructions with a bounded compute-unit limit and a priority fee derived from recent Helius estimates. Clamp estimates to an application-defined ceiling; do not blindly trust external fee recommendations.
- [ ] Keep Helius credentials and any authenticated RPC URL on the server. If transaction composition needs privileged RPC methods, expose a narrow, validated backend endpoint rather than placing an API key in a `NEXT_PUBLIC_*` variable or browser bundle.
- [ ] Use the connected wallet only for user signatures. Verify transaction message contents, recipient accounts, mint, amount, fee split, program ID, and blockhash before prompting the signer.
- [ ] Return typed outcomes for validation errors, rejected signatures, expired blockhashes, RPC errors, program errors, pending confirmations, confirmed transactions, and finalized transactions.
- [ ] Verify transaction status against the configured Mainnet-Beta RPC and show the signature only as submitted until its confirmed/finalized status is actually observed.

## 4. Helius RPC, backend boundary, and resilience

- [ ] Confirm the existing Helius Mainnet-Beta RPC configuration and document the exact server-side environment variable names. Do not invent or commit an RPC URL containing credentials.
- [ ] Use server-only environment variables for Helius API credentials, Jupiter keys, monitoring credentials, signing/deployment infrastructure credentials, and any other provider secrets. No provider key may use a `NEXT_PUBLIC_` prefix.
- [ ] Keep user wallet signing in Phantom or another connected wallet. Never accept, store, log, transmit, or proxy users' seed phrases, exported wallet JSON, or private keys to the backend.
- [ ] Create narrow server-side routes for privileged Helius calls, priority-fee estimates, launch state/indexer reads, and transaction status checks. Validate input schema and restrict allowed RPC methods and destination hosts.
- [ ] Add provider timeouts, bounded retries with jitter for transient 429/5xx errors, circuit breakers, health checks, and a configured fallback RPC list. Never silently fall back to an unverified endpoint or report stale data as live.
- [ ] Close HTTP sessions and WebSocket subscriptions on shutdown; prevent duplicate indexer/worker loops and bound concurrent RPC requests.

## 5. Fixed protocol fee enforcement

The existing policy in `docs/FEES_AND_TREASURY.md` is the source of truth and must be enforced by reviewed on-chain instructions, not by a browser-only check or mutable server setting.

| Operation | Fixed fee | Developer/operator share (60%) | Protocol treasury share (40%) |
| --- | ---: | ---: | ---: |
| Each supported trade | $0.10 USDC | $0.06 USDC | $0.04 USDC |
| Each supported transfer | $0.10 USDC | $0.06 USDC | $0.04 USDC |
| Token launch creation | $0.50 USDC | $0.30 USDC | $0.20 USDC |

- [ ] Define and hardcode the fee amounts and 60/40 split in the relevant reviewed on-chain instruction logic. The backend may prepare the transaction; it may not override the amount or redirect either recipient.
- [ ] Charge once for each supported trade and each supported transfer. Define operation types so the same underlying action cannot be charged twice through overlapping instruction paths.
- [ ] Charge the launch creation fee exactly once for a successful launch-creation operation. Failed/rolled-back creation must not leave a detached fee payment.
- [ ] Validate canonical USDC mint, token program, developer recipient ATA, treasury PDA/ATA, and token account ownership on-chain.
- [ ] Collect both fee portions atomically with the operation being charged; add operation-specific nonces/receipts and replay protection. If either fee transfer fails, the whole operation must fail atomically.
- [ ] Keep the existing public receiving wallet in `docs/FEES_AND_TREASURY.md` as a public destination only; it is not a signing credential. Do not expose any private key or deployment secret.
- [ ] Disclose the fee amount and split before wallet approval. Fees remain **not collected** until SBF-backed tests, deployed-source verification, and independent security review pass.

## 6. Security hardening and privacy

- [ ] Keep provider secrets, Helius credentials, API keys, privileged configuration, deployment credentials, and sensitive operational data server-side. Use the hosting platform's encrypted secret store and rotate any credential suspected of exposure.
- [ ] Keep the public wallet address only where operationally required. Do not publish personal names, email addresses, phone numbers, physical location, age, school, personal background, or private account details in app content, docs, metadata, analytics, logs, or examples.
- [ ] Never log request authorization headers, RPC keys, wallet exports, signed transaction bytes, or private data. Redact wallet-linked data from error reporting unless it is essential and disclosed.
- [ ] Apply strict request schemas, size limits, rate limits and abuse controls to every API route. Bind permissions to the connected wallet and verify all ownership/creator relationships on-chain.
- [ ] Add CSRF/origin protections where cookie-authenticated routes exist, secure headers/CSP, strict CORS, SSRF-safe outbound host allowlists, content-type validation, and safe error responses.
- [ ] Use idempotency keys and on-chain nonces for launch creation, buys, refunds, graduation, transfer, and fee receipts. Prevent replay, duplicate execution, race conditions, and cross-wallet data access.
- [ ] Add dependency and supply-chain scanning, lockfile enforcement, static analysis, secret scanning, SBF build checks, adversarial account-composition tests, fuzz/property tests, and independent Solana security review.
- [ ] Add structured security events, monitoring, alerting, incident response, rollback, RPC/provider outage runbooks, and documented program upgrade-authority controls.
- [ ] Ensure AI components are read-only unless separately authorized. Model output must never become an on-chain authorization or bypass deterministic risk and ownership checks.

## 7. Test and release gates

- [ ] Rust unit tests for token math, supply caps, 5% early-slot wallet cap, all launch state transitions, refunds, checked arithmetic, and fee amounts/splits.
- [ ] Anchor/SBF ProgramTest for create, buy, ATA creation, escrow balance, refund, graduation CPI, LP burn, fee settlement, pause/revoke where applicable, and transaction rollback.
- [ ] Adversarial tests for wrong creator, wrong PDA/bump, fake mint, wrong token program, wrong ATA, substituted CPI program, writable/signer escalation, duplicate nonce, re-entrancy-like instruction composition, and account substitution.
- [ ] TypeScript tests for PDA derivation, transaction instruction ordering, ATA idempotency, compute budget bounds, Helius response parsing, and typed error handling.
- [ ] End-to-end devnet verification with a dedicated test wallet and no production secrets.
- [ ] Verify program source/binary, program ID, mint authority, upgrade authority, fee recipients, treasury ATA, and AMM/LP burn destination independently.
- [ ] Complete an independent audit and remediate all critical/high findings before any mainnet launch or public deposits.
- [ ] Promote to Mainnet-Beta only through a separately reviewed release process. Closing a GitHub issue must never be a deployment or trading-enable switch.

## Current facts and boundaries

- The existing public route is `app/launchpad/page.tsx`; it is currently a locked discovery/status page with no verified listings.
- The Anchor workspace currently includes `programs/vault`; the new launchpad crate does not exist yet.
- The current frontend uses Solana Kit and the Solana React client, not `@solana/wallet-adapter-react`.
- The existing fee schedule is documented but fee collection is not enabled.
- No launchpad smart contract, buyer escrow, pool-creation CPI, LP burn, Helius-backed launch connector, or autonomous launch execution is complete.
- The public wallet address in the fee policy may be retained as a receiving destination. It must never be treated as a secret key.
