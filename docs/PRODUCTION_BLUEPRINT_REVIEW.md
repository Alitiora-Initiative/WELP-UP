# Production blueprint review — WELP UP

Review date: 2026-11-07  
Repository baseline reviewed: `main`  
Disposition: **do not apply the supplied production rewrite verbatim; do not deploy or arm autonomous trading.**

This review maps the requested four modules to the actual repository and identifies the safe next implementation boundary. It intentionally distinguishes code that exists from systems that are deployed, audited or authorized to custody funds.

## Executive finding

The supplied snippets are not drop-in replacements. They conflict with the current codebase, use invalid service URLs and contain unsafe assumptions about PDA signing, CPI account forwarding, key loading, trade accounting and ROI. The existing repository has more mature controls than the proposed rewrite: an Anchor vault/share ledger, owner-controlled executor policy, a Jupiter Swap API v2 integration, wallet-mediated transaction signing, and a leaderboard that explicitly refuses to invent performance rows.

The production boundary should be strengthened, not bypassed.

## Findings by requested module

### 1. Anchor vault — `programs/vault/src/lib.rs`

**What exists now**
- The program ID is an explicitly marked undeployed placeholder.
- Vault PDAs use versioned seeds (`vault-v1`), with owner checks and share-based deposits/withdrawals.
- Executor policy is a separate PDA with per-trade limit, daily cap, slippage ceiling, policy version and owner revocation.
- `execute_swap` and `settle_exit` return `TradingDisabled`; global initialization and fee settlement are also deliberately gated.
- The test suite already exercises vault funding/redemption, executor configuration/revocation and user-slot strategy snapshots.

**Why the supplied replacement is unsafe**
- `WelpUpVault111...` is not a valid deployed program identity. Changing `declare_id!` without generating a keypair, rebuilding, deriving the IDL and verifying the deployed binary would break PDA derivation and client compatibility.
- It discards the current share-accounting and policy model, replacing it with an unbounded generic account-forwarding CPI.
- It marks every remaining account as signer if its key equals the vault PDA, rather than deriving signer/writable privileges from a validated route schema. It does not validate the exact instruction discriminator, account order, token program, token-account mint/authority, destination, or route allowlist.
- A caller-supplied Jupiter instruction byte vector is not proof that the instruction is a permitted swap. CPI privileges are inherited and cannot be safely treated as arbitrary dynamic authority. Solana's CPI model requires the caller to validate accounts and signer privileges before invoking the callee.
- The supplied code uses `unwrap()` on arithmetic, does not check the total cap, does not check the actual vault balance before execution, and increments a claimed SOL spend counter without reconciling actual token balances.
- A PDA can sign only for its own program-derived seeds. The off-chain Jupiter /order transaction is a fully assembled wallet transaction and is not automatically convertible into a vault CPI. Jupiter's current documentation separates the assembled transaction path (`/order` + `/execute`) from the raw instruction path (`/build`) used for custom transaction composition.

**Safe implementation boundary**
- Preserve current account layouts and versioned seeds unless a reviewed migration is designed.
- Keep `execute_swap` fail-closed until an allowlisted CPI adapter is built against the exact Jupiter Router instruction interface and audited.
- Before any CPI implementation, validate program ID, route discriminator, all account owners, signer/writable flags, input/output mints, token-account authorities, vault ownership, token program IDs, minimum output, slippage, nonce, policy version, daily spend and available balance. Update all accounting atomically using observed post-CPI token balances / return data, not caller-supplied claimed amounts.
- Use checked arithmetic and explicit error paths throughout.
- Do not equate a 1,000 SOL protocol maximum with an initial user limit. A higher ceiling should require owner-configured policy, verified liquidity/impact, a separate exposure limit, and independent audit evidence.
- Keep deployment on local validator until SBF, integration, invariant and adversarial tests pass; then use a controlled devnet/mainnet release process with a verified program ID and multisig/upgrade-authority policy.

### 2. Autonomous engine — `welp/`

**What exists now**
- The repository has modular Python code for Jupiter v2 order/execute, RPC reads, mint risk checks, portfolio risk, reconciliation, safety and bounded configuration.
- Configuration rejects operator-held `SOLANA_PRIVATE_KEY`; the documented execution path is user-wallet approved, not a private-key daemon.
- Mainnet RPC defaults to `https://api.mainnet-beta.solana.com` (shared public RPC; not recommended as production infrastructure).
- The default configured trade ceiling is 0.02 SOL and the arm phrase is an explicit operator gate. These are application policy, not chain-enforced guarantees.

**Why the supplied script is unsafe**
- `eval(f.read())` on a key file is arbitrary code execution. It must never be used to parse key material.
- `https://solana.com`, `https://jup.ag` and `https://jup.ag` are not the JSON-RPC and Jupiter API endpoints.
- It invents a confidence score and a signal every five seconds, so it is explicitly simulated despite claiming to listen to live pools.
- It asks Jupiter for a user transaction with the vault PDA as taker, then tries to decompile it and repackage instructions into an Anchor CPI. The /order transaction is not a CPI instruction bundle.
- It does not verify the returned route, mint decimals, token program, actual liquidity depth, quote expiry, wallet authority or execution result.
- It has no persistent deduplication, nonce coordination, circuit breaker, daily spend reconciliation or kill-switch enforcement.

**Safe implementation boundary**
- Continue to use the existing `welp.jupiter.Jupiter` and `welp.rpc` modules rather than duplicating endpoints.
- Keep any scanner read-only: consume an explicitly configured Geyser/indexer or provider WebSocket, validate event provenance, deduplicate signatures and persist cursor/checkpoint state. If the source is unavailable, stop and report degraded status; never manufacture candidate signals.
- Require a user-approved wallet signature for each transaction until a reviewed delegated-execution protocol is deployed. A daemon must not read seed phrases or private key files.
- If delegated execution is later introduced, isolate its narrowly scoped key in a signer service/HSM or managed signer, enforce per-vault allowlists, daily limits, rate limits, nonce/idempotency and revocation, and audit it independently.
- Do not call a confidence threshold "AI verified" unless the scoring model, inputs, calibration and provenance are defined and reproducible.

### 3. Trading workspace — `components/Dashboard.tsx`, `app/api/order/route.ts`, `app/api/execute/route.ts`, `lib/jupiter.ts`

**What exists now**
- The app uses `@solana/kit` and the connected wallet adapter, not the older `@solana/wallet-adapter-react` / `@solana/web3-sdk` imports in the proposed snippet.
- The app requests Jupiter Swap API v2 `GET /order`, asks the connected wallet to sign, then posts the signed transaction and `requestId` to `POST /execute`.
- API routes validate base58 addresses, SOL/token direction, integer raw units, slippage and an existing 0.001–0.02 SOL buy policy.
- Wallet-approved swaps continue when referral collection is unconfigured and are explicitly fee-free to WELP in that state.
- When configured, `/api/order` verifies the on-chain Jupiter referral account and exact fee-mint token account before returning a referral-fee order. If setup is unavailable, it requests a fresh quote without referral parameters and labels the quote as not collecting a WELP fee.
- Jupiter referral collection is not an atomic WELP treasury split. The referral partner wallet receives claims; the WELP treasury program remains undeployed.

**Change made in this branch**
- Corrected the workspace status banner so it states that wallet-approved swaps are currently gated, live market data remains available, and unattended trading is not active. This prevents the UI from advertising an execution capability that the API refuses.

**Why the supplied replacement is unsafe/incompatible**
- It calls obsolete/wrong Jupiter endpoints and uses `outputMintDecimals` as if it were a documented response field.
- It imports `VersionedTransaction` from `@solana/web3-sdk`, which is not the installed dependency.
- It bypasses the existing fee gate and current transaction review flow.
- A browser-side numeric limit is not a security boundary. Amounts must be checked in the API and, for vault operations, on-chain.
- A generic “approve” CTA cannot imply a trade will settle; order expiry, wallet changes, failed execution and actual settlement need distinct states.

**Safe implementation boundary**
- Keep the documented Swap API v2 order/execute path for wallet-approved swaps. Do not substitute a V6 CPI sample into this route.
- Keep fee collection disabled until the fee is added atomically, disclosed and verified from the signed transaction; then update the gate only through a reviewed release.
- Keep the current 0.02 SOL product limit until risk review explicitly approves a different ceiling. Never expose 1,000 SOL as a default or silently widen the existing limit.
- Display quote input/output amounts, fee mint/amount, route, price impact, slippage, quote timestamp/expiry and wallet identity before signing. Invalidate quotes on wallet or input changes.
- Treat Jupiter's `/execute` response status as authoritative; show a transaction link and actual result amounts, not just “broadcast” or a signature.
- Production RPC must be a dedicated provider with WebSocket support, quotas and failover, not a shared public endpoint.

### 4. Leaderboard — `app/api/leaderboard/route.ts`, `components/LeaderboardPage.tsx`

**What exists now**
- The API returns no rows and an explicit `pending_mainnet` status.
- The page explains that no verified on-chain agent settlement records are available and does not publish mock ROI, estimated P&L, demo rows or localStorage counts.

**Why the supplied component is not a valid performance index**
- The proposed program ID is a placeholder, so there is no deployed account to subscribe to.
- A program log subscription plus the latest 20 signatures is not a complete, durable indexer. It can miss older events, disconnect, hit RPC limits and fail to resume.
- A fixed account index does not identify an executor; transaction account ordering varies by instruction and version.
- Absolute SOL balance changes include fees, rent, transfers and unrelated instructions. They do not equal swap volume.
- ROI cannot be calculated from lamport deltas. It requires token-decimal-aware fills, actual input/output amounts, transfers, fees, realized/unrealized P&L methodology, price provenance and treatment of missing prices.
- Marking every wallet “Operational” is an unsupported health claim.

**Safe implementation boundary**
- Keep the empty state until a real program ID and settlement event schema exist.
- Build an indexer that consumes confirmed/finalized signatures, fetches full transaction metadata, decodes known program events, verifies the program ID and event discriminator, persists signatures with idempotent upserts and resumes from a durable cursor.
- Reconcile token-account pre/post balances and transaction fee data. Attribute an executor only from validated instruction accounts/events, never a positional guess.
- Publish ROI only after a documented accounting model is implemented and independently reconciled. Otherwise show verified counts/volume with precise labels and source links, not performance rankings.
- Label data freshness, slot range, source provider, indexing coverage and incomplete history.

## Correct network and routing references

- Solana's official RPC docs list cluster endpoints and warn that shared public RPC endpoints are rate-limited and not intended for production applications. Use a dedicated provider for production.
- Jupiter's current recommended Swap API is **v2** at `https://api.jup.ag/swap/v2`.
  - Managed wallet transaction flow: `GET /order` → wallet signs returned transaction → `POST /execute` with `signedTransaction` and `requestId`.
  - Custom transaction/CPI flow: `GET /build` returns raw instructions for a custom transaction. This is a different integration path and should not be confused with the managed /order transaction.
- Jupiter's API key belongs server-side; never expose it in a `NEXT_PUBLIC_*` variable.
- The user-provided `https://solana.com` and `https://jup.ag` values are website origins, not the required RPC / API endpoint values.

## Core parameters: how to interpret them safely

| Parameter | Requested | Safe interpretation |
|---|---:|---|
| Minimum order | 0.001 SOL | Existing app/API policy; keep exact raw-unit validation |
| Maximum order | 1,000 SOL | Absolute future policy ceiling only after audit; not current allowed size |
| Network | Mainnet-beta | Market reads may use mainnet; vault remains undeployed and real-fund execution gated |
| Routing | Jupiter V6 CPI | Not interchangeable with current Jupiter v2 managed order/execute; a CPI adapter requires raw instruction/build path and independent review |
| Autonomous execution | Enabled | Not approved; current system remains user-wallet approved / execution gated |

## Required gates before any real-fund autonomous execution

1. Pin and verify the program ID and deployed binary.
2. Complete Anchor SBF build, local-validator integration tests, property/invariant tests and adversarial CPI tests.
3. Implement and audit the exact Jupiter CPI adapter or a separately reviewed delegated execution protocol.
4. Wire executor policy, user-slot policy, nonce, slippage, per-trade and daily limits into atomic on-chain settlement.
5. Add durable indexer, replay-safe ledger, transaction reconciliation and transparent P&L methodology.
6. Complete independent Solana security audit and remediate every critical/high finding.
7. Configure dedicated mainnet RPC/indexer providers, monitoring, alerting, incident response and emergency pause/revoke drills.
8. Review fee terms and make fee collection atomic before unblocking the current web execution API.
9. Run controlled mainnet canary with minimal caps and explicit owner approval before considering higher limits.
10. Do not activate unattended execution or allow 1,000 SOL positions until the above evidence is published and independently reviewed.

## Sources

- Jupiter Swap API v2 overview: https://developers.jup.ag/docs/swap
- Jupiter Order endpoint: https://developers.jup.ag/docs/api-reference/swap/order
- Jupiter Execute endpoint: https://developers.jup.ag/docs/api-reference/swap/execute
- Solana RPC overview and cluster endpoints: https://solana.com/docs/rpc
- Solana CPI model, privilege propagation and re-entrancy: https://solana.com/docs/core/cpi

This review is not a security audit, deployment approval, or guarantee of trading performance.
