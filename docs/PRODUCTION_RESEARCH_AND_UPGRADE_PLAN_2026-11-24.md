# WELP UP production research and upgrade plan

**Research date:** 24 November 2026  
**Scope:** Production-readiness review of the live WELP UP repository and current Solana/AI infrastructure. This is an engineering plan, not a claim that listed integrations are already connected or working.

## Executive decision

AI is a good fit for WELP UP as a **read-only market research copilot**. It is not a good fit as an autonomous trader today. Keep wallet signing in the user's wallet, preserve deterministic server-side trade/risk gates, and give the model no signing key, transaction submission tool, vault access or execution permission.

The product should become a live Solana market terminal with four clearly separated layers:

1. **Market data:** upstream provider facts, explicit retrieval times, freshness and source labels.
2. **Deterministic controls:** validation, risk blocks, liquidity limits, quote review and transaction-state reconciliation.
3. **AI interpretation:** explain evidence already collected by the first two layers; never invent missing fields or override a block.
4. **User authorization:** wallet reviews and signs; the app verifies the signature and final on-chain result.

Do not market WELP as an audited exchange, autonomous hedge fund, custody product or independent token auditor.

## Repository findings

The live codebase already includes:
- Jupiter Token API v2 market discovery and token search.
- A deterministic weighted token-quality score and hard eligibility checks.
- DexScreener pair lookup for token charts.
- GeckoTerminal OHLCV inputs for signal analysis.
- Jupiter Swap API v2 order/execute plumbing, gated by WELP referral-fee configuration.
- Wallet connection and client-side signing.
- A read-only, server-side AI analyst using the Vercel AI SDK and AI Gateway.
- Webacy fail-closed checks in swap-order and launch-link preparation routes.

Important limitations found in the repository and deployment:
- Market discovery primarily reads Jupiter's 24-hour top-organic list; it does not yet present distinct new, trending and most-traded universes.
- The app's Jupiter API key is optional in code, but keyless Token API requests are documented as limited to 0.5 requests/second. A production API key is needed before raising polling or discovery volume.
- The Solana RPC path can fall back to the shared public mainnet endpoint. Solana explicitly describes public RPC as development/shared infrastructure, not a production service.
- No dedicated WELP database is attached to the Vercel project. The team's existing Supabase installation is not assigned to this project; do not reuse another product's database.
- The AI endpoint has a per-process in-memory request counter. That is not a shared rate limiter across serverless instances.
- There is no AI Gateway budget configured for the team/project. A public AI endpoint should not be expanded until a spend ceiling and usage monitoring exist.
- The current Webacy key/plan has not passed live provider smoke tests: the deployed URL-check operation returned 403 and Solana Trading Lite returned 500. Keep the server-side fail-closed behavior; do not treat the integration as operational until both checks pass with a rotated, correctly permissioned key.
- WELP's Jupiter referral fee route is not configured, so swap order/execute routes remain disabled. Do not imply swaps are currently enabled.
- The custom WELP launchpad/vault programs are not verified as deployed and audited mainnet programs. No custody or autonomous trading should be enabled.

## Changes in this branch

The previous market score filled missing trade counts with a neutral 50% buy-pressure value while its explanatory text said missing trade counts were not scored. It also kept the original score denominator when some other inputs were absent. This created a mismatch between the displayed number and available evidence.

This branch corrects that behavior:
- Missing input fields are excluded from the quality score; the weights are normalized over observed fields.
- `scoreCoveragePct` reports the percentage of the original weighted inputs actually present.
- Missing buy/sell trade counts produce `buyPressure: null`, not a fabricated 50%.
- Missing liquidity or incomplete 24-hour buy/sell volume blocks eligibility rather than silently treating it as a genuine zero measurement.
- Low score coverage is surfaced as a Watch warning.
- The market board shows the score's data coverage and explains that the score is not a safety rating or profit probability.

The score remains a quality-ranking aid only. It does not establish that a token is safe, liquid enough to exit, or likely to rise. The Webacy pre-swap gate remains a separate check and must remain fail-closed until live provider access is verified.

## Recommended live-data architecture

### 1. Expand discovery without mixing unlike data

Keep Jupiter Token API v2 as the primary metadata/market source. Add separate server-side views for:
- `toptrending` over 5m/1h/6h/24h;
- `toptraded` over the same supported periods;
- `toporganicscore` over 1h/6h/24h;
- `recent` for first-pool-created discovery.

Do not blend these lists into one unexplained “best token” ranking. Display each feed's query, time window, fetched time and provider. Deduplicate by mint, then enrich each candidate with pool-level price/liquidity data. Treat paid boosts, ads, profiles and community-takeover lists as **promotional/community discovery**, never as proof of organic demand or token quality.

Add a user-visible data state per tile: Live, Delayed, Partial or Unavailable. If a field is missing, show “—” or “Not reported”; never display a fabricated zero or neutral value.

### 2. Build a verifiable transaction and event ledger

Use a dedicated WELP-owned Postgres project for durable, idempotent event storage. Suggested initial entities:
- `chain_events`: signature, slot, block time, commitment, program IDs, account keys, event type, source, parse status and raw payload hash;
- `wallet_activity`: wallet, signature, token/SOL deltas, fee, classification confidence and parser version;
- `market_snapshots`: mint, pair, provider, observed fields, fetched time and source metadata;
- `provider_health`: provider, endpoint family, checked time, latency, last good response, error class and freshness;
- `analysis_runs`: model, prompt/version, input snapshot IDs, answer metadata, usage and citations.

Enable row-level security on exposed tables. Keep raw event storage and service-role credentials server-side. Never expose database service keys in browser bundles. Store only the minimum wallet-address data needed; do not store private keys or seed phrases.

For a Solana indexer, evaluate Helius Parsed Events for history/backfill and Parsed Streams for live decoded transactions. Helius announced these products in September 2026; they are in open beta and available on paid plans. Keep the standard Solana RPC transaction/signature as the final evidence and reconcile missed stream messages by backfill. Deduplicate on signature plus instruction/event identity. Treat the indexer as a derived read model, not the chain's source of truth.

### 3.1. Benchmark a second Solana risk provider and pre-sign simulation

Because the current Webacy live checks are failing, evaluate GoPlus as an independent security adapter:
- GoPlus documents a Solana Token Security API (Beta) for SPL/SPL-2022 mints.
- It separately documents a Solana pre-execution endpoint that accepts an encoded transaction. This is a better match for pre-sign protection of a prepared Jupiter swap than relying only on token-level honeypot flags.
- The endpoints require the documented authorization token. Confirm the account's current quota, latency, retention and terms directly in its developer dashboard; do not assume a general free-tier limit applies to every Solana endpoint.

Do not combine vendor scores into a synthetic “safe” badge. Normalize provider output into explicit evidence (e.g. mint/freeze authority, holder concentration, liquidity lock, transfer restrictions, simulation outcome, token/asset deltas, warnings and unknown fields). Preserve each vendor's source, observation time and raw response hash. Maintain fixed benign/risky token fixtures and transaction simulations to compare detection, false positives, timeouts and schema drift. If vendors conflict, show the conflict and keep the affected action blocked until a deterministic policy resolves it. A provider's green result is not an audit or guarantee.

### 3. Replace shared public RPC as production infrastructure

Provision a primary private RPC endpoint and a separately operated fallback. Measure:
- mainnet method and WebSocket support;
- response latency and slot lag;
- transaction history depth;
- rate limits, request weights and bandwidth;
- transaction send/landing features;
- provider uptime and incident support;
- key scoping and rotation;
- cost under realistic traffic.

Health checks must verify both `getHealth` and slot freshness. Do not switch endpoints halfway through a blockhash-sensitive send/confirm cycle without an explicit policy. When a send times out, reuse and monitor the same signed transaction while its blockhash is valid; do not immediately generate a new transaction that could double-submit the user's intent.

### 4. Upgrade AI as a constrained research copilot

The current market analyst is read-only, single-request and has no tools. Retain that security boundary. A useful next version can use AI SDK 7 tool calling and streaming, with the following strictly read-only tools:
- `get_live_market_snapshot`: current provider data and source timestamps;
- `search_token`: exact mint/name lookup and validated metadata;
- `get_pool_market_data`: pool liquidity, volume, price changes and pair address;
- `get_security_assessment`: latest provider results, with Unknown when unavailable;
- `get_wallet_public_activity`: only after an explicit user request and only for the connected public address;
- `compare_assets`: deterministic side-by-side calculations with missing-data coverage.

Each answer should separate:
- observed facts (provider, fetched time, source identifiers);
- rule-engine outputs (named rule version and threshold);
- AI interpretation (clearly labelled opinion/hypothesis);
- unavailable or conflicting facts;
- links to the underlying mint, pair or transaction explorer.

Do not give the model tools for wallet signing, order creation, order execution, vault deposits, launch transactions or changing risk limits. The model may prepare an unsigned research summary for a user, but it must never authorize or submit a transaction.

Before scaling public AI usage:
- replace the in-memory Map counter with a shared atomic limiter and per-user/IP quotas;
- set an AI Gateway project budget with alerts and an explicit monthly ceiling;
- cap question size, token output and request duration;
- log model, token usage, latency, status and snapshot IDs without private user data or credentials;
- add adversarial prompt-injection tests for token names, metadata, socials and all upstream fields;
- evaluate answers against a fixed dataset and reject responses that invent missing metrics or sources.

AI SDK 7 supports streaming, tool loops, approvals and telemetry. WELP's configured default, `anthropic/claude-sonnet-5.5`, is a current AI Gateway model; the Gateway listing currently shows pricing from $2 per million input tokens and $10 per million output tokens. That makes an explicit usage cap important before exposing it broadly. Use the existing model for evidence-heavy analysis only after a live generation smoke test; a cheaper model can be benchmarked for routine summaries. These SDK features are enablers, not a reason to add an autonomous execution loop. Tool approval should apply to read-only or reversible actions first; trading remains a separate explicit wallet-signature flow.

## Production gate order

### P0 — unblock trustworthy live operations
- Rotate the Webacy credential because it was shared in chat; verify account permissions for Solana Trading Lite and URL checking, then retest live against a known public mint and a benign URL.
- Add a real Jupiter API key to Vercel as a server-only sensitive variable; verify 1h/6h/24h trending, traded, organic and recent endpoints.
- Select a primary private RPC and a separate fallback; load-test rate, history, slot freshness and websocket reconnection.
- Add AI health to `/api/status`. The current AI GET response describes intended configuration but is not a proof that a model generation succeeded.
- Keep swap routes blocked until the referral destination and fee terms are deliberately configured and verified.
- Expose clear health and data freshness on the application, not only in logs.

### P1 — durable product data
- Provision a separate WELP Supabase project and apply reviewed migrations with RLS.
- Add Helius Parsed Events/Streams (or benchmark an alternative) with replay, backfill, deduplication and reconciliation.
- Persist transaction lifecycle states and wallet activity; use finalized signatures and decoded balance deltas.
- Make market snapshots and provider health queryable, so the UI can distinguish stale from freshly fetched values.

### P2 — constrained AI
- Move the analyst to streamed, structured, evidence-cited responses.
- Add only the read-only tools described above.
- Configure shared rate limits and AI spend budget before broad public exposure.
- Add evaluation suites for unsupported claims, stale data, prompt injection, model/provider outages and cost abuse.

### P3 — money-moving features
- Complete Jupiter referral routing and real wallet-signed end-to-end swaps with on-chain fee reconciliation.
- Do not enable vault custody, user deposits, delegated signing, automated execution or copy trading until the program is deployed from the reviewed source, SBF/local-validator/fuzz tests pass, an independent Solana/Anchor audit is complete, upgrade authority and treasury are verified, and emergency pause/recovery paths are tested.
- Publish performance only from a complete, reconciled transaction ledger. No mocked ROI, TVL, holders, bot counts or backtested “live” performance.

## Acceptance criteria

WELP UP is not ready to call production-grade for real-money trading until:
- All user-visible market facts have a real provider, retrieval time and missing-data representation.
- Every enabled provider has a live smoke test, rate-limit plan and outage behavior.
- Public RPC is no longer the only server-side production path.
- Webacy checks pass live and unknown provider results still block the protected action.
- AI status is proven by a real provider generation, and spend/rate limits are enforceable across instances.
- Signed transactions are idempotently tracked through finalized chain evidence.
- The wallet remains the sole signing authority for normal user trades.
- No un-deployed or unaudited WELP program can accept user funds.

## Current-source research

- Jupiter Token API v2: https://developers.jup.ag/docs/tokens/index
- DEX Screener API reference: https://docs.dexscreener.com/api/reference
- Solana RPC provider selection: https://solana.com/docs/rpc/providers
- Solana transaction landing and production RPC guidance: https://solana.com/docs/tools/transaction-landing
- Helius Parsed Events and Parsed Streams announcement: https://www.helius.dev/blog/parsed-events-and-streams
- GoPlus Solana Token Security API (Beta): https://docs.gopluslabs.io/reference/solanatokensecurityusingget
- GoPlus Solana pre-execution simulation: https://docs.gopluslabs.io/reference/preruntxusingpost
- Vercel AI SDK 7: https://vercel.com/blog/ai-sdk-7
- Claude Sonnet 5.5 on AI Gateway (model ID and listed price): https://vercel.com/ai-gateway/models/anthropic/claude-sonnet-5.5
- Vercel AI Gateway budgets: https://vercel.com/changelog/set-per-user-budgets-on-ai-gateway

