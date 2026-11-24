# WELP UP — production research and upgrade plan

**Research date:** 24 November 2026  
**Target product:** WELP UP at https://welpup.fun  
**Scope:** Solana market intelligence, safety screening, AI analyst, swap preparation, wallet history, operational readiness and real-data integrity.

> **Release boundary:** The changes described as “branch changes” are on the `production-readiness-2026-11` branch. They are not production features until the pull request is reviewed, CI passes, Preview is tested and the change is merged/promoted. This document does not approve real-money vault custody, autonomous trading, or public deposits.

## 1. Product decision: AI is plausible, autonomous trading is not

WELP UP should be an **AI-assisted Solana research and wallet-approved execution-review terminal**.

The useful division of responsibility is:

1. Market-data providers supply observed facts.
2. Deterministic application code computes scores, risk gates, price comparisons and transaction constraints.
3. AI explains the supplied evidence, highlights discrepancies, answers bounded research questions and summarizes what is missing.
4. The connected wallet, not the model, signs any supported transaction.
5. The server refuses an order when a mandatory security or fee prerequisite is missing.

Do not let a language model determine token eligibility, invent market data, calculate a user’s balance, choose a trade size, bypass a risk gate, sign a transaction or hold a private key. A model can help a user understand the output of the deterministic rules; it must not become the authority that defines those rules.

This aligns with the project's current stack: Next.js 16, React 19, Solana Kit 8, AI SDK 7, Jupiter APIs, GeckoTerminal and wallet-based signing. The installed `ai` package is already on the AI SDK 7 line; a framework upgrade is not the main missing feature.

## 2. What already exists in WELP UP

Repository inspection on 24 November 2026 found these real foundations:

| Area | Existing implementation | Important limitation |
|---|---|---|
| Market board | Jupiter Tokens API v2; score and audit fields; market list refresh | Provider snapshot/caching must be distinguished from the exact time a trade occurred |
| SOL price | Jupiter Price API v3 | A provider response is not an exchange execution price |
| Charting | Provider-based chart data and DexScreener pair charts | Historical candle coverage and provider errors must remain explicit |
| Signal engine | GeckoTerminal trending pools and 5-minute OHLCV; EMA, RSI, volume and pool-structure calculations | Only a few trending pools are sampled; it is not a backtested strategy or profitability signal |
| Swap preparation | Jupiter Swap API v2 `/order` and `/execute` with wallet-signed transactions | Current WELP referral-fee configuration blocks the order/execute route; end-to-end mainnet swap is not yet confirmed |
| Wallet | Public balance and signature reads, wallet-based user signing | No complete persistent account or accounting ledger |
| AI analyst | Server-side AI SDK and Vercel AI Gateway, one request at a time | Read-only; currently no tools, memory, durable workflow, shared rate limiter or confirmed background worker |
| AI watch | Browser-local watch policies; scans while the page remains open | Not a server-side scheduled agent; state lives in localStorage |
| Webacy | Server-only helpers, token check before a Jupiter order and URL checks during launch preparation | Prior live tests returned HTTP 500 for the Solana token scan and HTTP 403 for URL screening; do not claim the provider is operational until retested with working permissions |
| Vault / bots | Anchor program source, policy and safety scaffolding | No verified audited mainnet deployment; keep funding and autonomous execution disabled |

The application has real provider integrations. The goal is to improve verification, freshness, operational controls and provenance—not replace them with demo values or make a second dashboard that simply repeats data already shown elsewhere.

## 3. Live data architecture

### Primary market and token identity: Jupiter

Continue using Jupiter Tokens API v2 for mint-address-based token identity, metadata, verification, organic score, market cap, liquidity, holder count, audit fields and trading statistics. Use the mint address as the stable identifier; token symbols are not unique.

Jupiter documents keyless access for lightweight prototyping at 0.5 requests per second and recommends an API key for production rate limits and usage visibility. WELP currently sends an API key only when `JUPITER_API_KEY` is configured. The reviewed Vercel custom-environment listing did not contain that variable.

**Release action:** create a production Jupiter API key, store it as a Sensitive server-side Vercel environment variable, and monitor usage. Do not put it in a `NEXT_PUBLIC_` variable or browser bundle.

### Independent market cross-check: DexScreener

DexScreener provides a practical second view of price, pool liquidity, volume and pair metadata. Its documented token endpoint accepts up to 30 comma-separated token addresses in one request and is rate-limited at 300 requests per minute.

**Branch change:** WELP compares the top 30 ranked Jupiter assets against a batched DexScreener response. It selects the largest-liquidity matching Solana base-token pair and exposes the price delta and liquidity/volume context. The check is cached for 30 seconds and is explicitly supplementary:

- It does not replace Jupiter prices.
- It does not contribute to the deterministic score.
- It does not establish that a token is safe or tradable.
- Missing pairs, unsupported rows and provider errors remain visible rather than being treated as a pass.

This is cross-source data validation, not a security audit. The two providers can differ because pools, routing sources, cache timing and liquidity coverage are not identical.

### Pool discovery and candles: GeckoTerminal

Keep GeckoTerminal for pool discovery and OHLCV used by the signal engine. Its public API documentation describes approximately 10 calls per minute, data cached for one minute, and updates typically a few seconds after a confirmed transaction, subject to network availability.

**Branch change:** trending-pool discovery and candle fetches now use a shared 60-second revalidation window rather than forcing uncached provider calls on every page request. This is intended to reduce rate-limit pressure; it does not make the cached candles a tick-by-tick execution feed.

The signal API also reports partial data when chart history or required Jupiter quotes are missing. It must not label an incomplete signal snapshot “complete”.

### Optional additional security data: Birdeye

Birdeye's 2 November 2026 changelog added optional Solana Token Security components for holder, market, liquidity, risk-score history and top-holder data. This could be a useful second security provider when WELP has a defined monthly data budget and a working account.

Do not add Birdeye as a hard dependency yet. First measure the value of the existing Jupiter audit and Webacy checks, then test Birdeye coverage, data freshness, API permissions, compute-unit consumption and price. The currently published pricing guide lists a free Standard tier with restricted API access and low request rate, and paid plans starting with Lite. Treat plan limits/prices as subject to change.

### Chain state, transactions and indexer

A public Solana RPC health check does not make an application production-grade. Solana explicitly says shared public RPC endpoints are not intended for production applications and may return 429/403 under load.

**Release action:** configure a dedicated private RPC provider for server-side Solana reads and transaction handling. Evaluate providers against mainnet latency from WELP's deployment region, request rate, WebSocket availability, historical transaction coverage, commitment levels, price, key rotation, monitoring and tested failover. Keep provider credentials server-side.

For a durable history and later accounting engine, evaluate Helius **Parsed Events API and Parsed Streams** rather than building a new indexer around the older Enhanced Transactions API. Helius announced Parsed Events and Streams on 3 September 2026; the products decode transactions across thousands of programs, offer historical REST/GraphQL queries and event streaming, and were released as open beta on paid plans. Its 3 November 2026 Parsed Events Scan API can filter wallet history by program, instruction or token mint. Helius states the older Enhanced Transactions API is in maintenance mode and recommends Parsed Events for new mainnet integrations.

A production ledger still needs WELP-owned durable ingestion, not just an upstream history API:
- Verify every webhook/stream notification and preserve the raw source payload.
- Use transaction signature plus instruction/event index as an idempotency key.
- Store slot, block time, commitment, success/failure, fee, token mint, token decimals and owner balance deltas.
- Reconcile tentative events against confirmed/finalized RPC results.
- Backfill history and periodically reconcile balances from chain.
- Preserve provider/source timestamps and explicit gaps.
- Do not calculate realized P&L from a partial wallet-history response.

## 4. AI strategy and current trends

### What to integrate now

The first AI experience should be a **read-only market copilot**:

- “Explain why this token is not eligible.”
- “Compare the Jupiter and DexScreener price/liquidity data.”
- “Which inputs are missing, and how does that affect coverage?”
- “Summarize the last signal scan and separate market observations from model interpretation.”
- “Explain a transaction after WELP has fetched and decoded its confirmed on-chain data.”
- “Summarize a wallet's public activity when a properly permissioned chain-data service is available.”

The model should receive a bounded, sanitized market snapshot and the exact WELP observation time. It should say when the feed is stale, when one provider has no matching pair, and when the snapshot lacks a field. AI output must never be written back as a token risk score or eligible flag.

### What not to integrate yet

Do not ship:
- Autonomous buy/sell agents.
- A bot that asks users to paste private keys or seed phrases.
- Copy trading or profit-share settlement.
- AI-controlled token allowlists or slippage.
- AI-generated wallet balances, chart candles, P&L or performance metrics.
- A persistent agent that can sign, submit or retry orders independently.

Those features require user identity, explicit consent, a durable ledger, an audited on-chain permission model, idempotent execution, transaction reconciliation, key isolation, owner pause/revocation, independent audits, incident response and legal review. The current product does not have all those prerequisites.

### Model and framework choice

WELP already has AI SDK 7 and Vercel AI Gateway. Use the existing SDK rather than adding LangChain, a second agent framework or a separate chatbot vendor simply because those tools are popular. For one-turn explanation, `generateText` is adequate. When real read-only tools are added, define them with schemas and server-controlled execution functions, and keep the available tool set narrow.

A future durable workflow may use the AI SDK's workflow/agent facilities for non-financial tasks such as scheduled research digests or market event summaries. Do not confuse durable workflow execution with permission to sign financial transactions.

Vercel AI Gateway supports deployment OIDC and API-key authentication. Vercel deployments can receive `VERCEL_OIDC_TOKEN` automatically; a custom `AI_GATEWAY_API_KEY` is therefore an alternative rather than an automatic requirement for a Vercel deployment. `WELP_AI_MODEL` is an optional model override. A status endpoint that merely sees auth configured must not report the model as verified: verification should occur only after a successful generation request.

**Spend controls:** configure a small project-level AI Gateway budget and usage alerts. Vercel's published budgets documentation says budgets are checked before a request but are soft caps: a request that crosses the threshold can finish and produce a small overage. A gateway budget is not a substitute for WELP's own abuse prevention and shared rate limiting.

### AI watch is not a background agent

The current watch page reads browser-local policies and scans while the tab is open. That is a valid lightweight, user-visible monitoring view, but not a durable scheduler or background worker.

The next safe step is to move **alerts**, not trades, to a durable scheduled/event-driven service. Persist user-approved policies, record provider observations, run deterministic filters, and generate an AI explanation when a meaningful event occurs. Deliver a notification; do not sign or place an order. Add account authentication, policy ownership, event deduplication, subscription limits and opt-out controls first.

## 5. Specific branch changes in this release candidate

The `production-readiness-2026-11` branch contains the following proposed improvements:

1. **Score integrity:** replace the misleading 80–98 score mapping with a transparent 0–100 weighted average. Missing metrics are excluded instead of being assigned a neutral value. A separate percentage reports coverage of the configured score inputs.
2. **Fail-closed core data:** no asset is marked eligible when liquidity, 24-hour buy/sell volume, freeze-authority status or top-holder concentration is missing. Known risks remain blockers; incomplete inputs are displayed as review warnings.
3. **Independent market cross-check:** compare up to 30 highest-ranked Solana mints against DexScreener in one batch. Show provider match state and price delta separately; never silently blend the secondary provider into the primary feed or score.
4. **Honest freshness metadata:** expose WELP observation time and the upstream cache window rather than implying that the API timestamp is the exact provider trade time.
5. **AI analyst context:** pass score coverage and optional DexScreener deltas to the analyst. Prompt rules distinguish data quality, cross-provider disagreements and provider-derived facts from model interpretation.
6. **AI Gateway status:** report detected API-key/OIDC auth separately from a successful model response. The user interface no longer instructs users to add an unrelated OpenAI key.
7. **Signal-feed rate safety:** use one-minute shared revalidation for GeckoTerminal trending pools and OHLCV calls; report partial signal data if charts or fee-bearing quotes are unavailable.
8. **RPC status honesty:** report a shared public Solana RPC as not production-ready when no dedicated `SOLANA_RPC_URL` is configured.
9. **Regression coverage:** add tests for weighted scoring, missing inputs, score coverage, absence of fabricated buy pressure and DexScreener cross-check parsing.

These changes still require automated CI, Preview deployment checks, live provider tests and human review before production promotion.

## 6. Known operational blockers to resolve

| Priority | Blocker | Evidence / action |
|---|---|---|
| P0 | Dedicated RPC not configured | Vercel custom environment listing on 24 November contained no `SOLANA_RPC_URL`; add and test private mainnet RPC and failover |
| P0 | Jupiter API key absent | Custom environment listing contained no `JUPITER_API_KEY`; set a production key for proper production rate limits and usage visibility |
| P0 | Jupiter referral-fee route not configured | Existing WELP fee policy remains disabled; swap order/execute routes remain fail-closed until a valid referral account is configured and verified |
| P0 | Webacy provider permission/health issue | Prior deployed checks returned 403 for URL screening and 500 for Solana Trading Lite; rotate the exposed key, verify account/endpoint permissions and re-run live requests |
| P0 | AI public rate limiter is process-local | The four-per-minute in-memory counter is not shared across serverless instances; configure a shared atomic limiter or trusted edge control before opening broad public usage |
| P0 | AI provider has not been confirmed by a live successful response | A detected Gateway credential is only “configured”; run a real preview request and inspect provider result/usage. Set a low project spend budget and alerts |
| P1 | No durable event ledger | Add authenticated storage, idempotent event ingestion, reconciliation and transaction history backfill |
| P1 | No user/account persistence | Watch policies and scan state live in browser localStorage; add user authentication and per-user access control before cross-device or background alerts |
| P1 | No complete AI background scheduler | The watch requires the page to remain open; build durable alert scheduling only after account/policy persistence exists |
| P1 | Vault and custom launch programs are not approved | Keep disabled until deployed-bytecode verification, local-validator testing and independent security audit |
| P2 | No multi-provider observability | Track per-provider availability, latency, stale-data windows, request cost, rate-limit errors and reconciliation drift |

## 7. Release sequence

### Gate A — honest live data
- Merge the confidence-aware scoring and cross-check changes only after test/build pass.
- Verify that the Jupiter source returns real current assets and values.
- Confirm DexScreener returns matching pairs for representative Solana mints; compare a stable, a volatile asset and one token with no direct pool.
- Confirm provider failure leaves the primary page usable and shows the secondary check as unavailable.
- Confirm a 30-second/60-second cached response never claims to be an exact trade timestamp.
- Confirm incomplete audit fields do not qualify a token.

### Gate B — provider and transaction operations
- Configure private mainnet RPC and a tested fallback.
- Configure Jupiter production key.
- Fix Webacy permissions; test both Solana token screening and URL screening with known safe/unsafe test inputs.
- Configure the Jupiter referral account and inspect the returned fee fields; execute a small wallet-approved transaction only under an operator-controlled test plan.
- Reconcile the signature and actual fee/asset deltas with finalized on-chain data.

### Gate C — AI safety and cost
- Verify a live Vercel AI Gateway response in Preview.
- Configure a low project budget and spend alerts.
- Implement a trusted shared rate limiter and abuse controls.
- Test authentication and same-origin checks, request-size limits, timeouts, provider errors and malformed model output.
- Add read-only tools only after schema validation, timeouts and audit logs are in place.
- Preserve a hard boundary between AI explanation and deterministic trade/risk authorization.

### Gate D — durable data and operations
- Implement identity and PostgreSQL-backed persistence with row-level access control.
- Ingest and reconcile Helius Parsed Events/Streams or an equivalent provider.
- Add idempotency, event replay, dead-letter handling, retention and recovery.
- Add uptime, stale-data, provider-cost, error-rate and event-gap monitoring.
- Add deployment rollback, backup restore test, incident response and privacy review.

### Gate E — vault / automation (separate release)
- Complete Anchor local-validator and SBF tests.
- Perform an independent Solana/Anchor security audit and remediate all findings.
- Deploy and verify the reviewed program ID and bytecode.
- Test owner pause, revocation, emergency withdrawal, accounting and recovery.
- Only then reconsider a constrained approval-based execution design. An AI model must never be the signer or sole risk control.

## 8. Acceptance criteria for “production-ready”

WELP is not production-ready merely because Vercel says a deployment is READY. The product should meet these minimums for its declared scope:

- Every displayed price/volume/liquidity metric has a provider, mint/pair identifier where applicable, observation time and explicit stale/unavailable state.
- No fabricated data is inserted when providers fail.
- Cross-source differences are visible and are not hidden by averaging providers.
- Score coverage is explicit; missing core risk inputs withhold eligibility.
- Public endpoints have trusted rate limits, request validation and provider spend controls.
- Provider credentials never appear in browser code, logs or source files.
- Swap routes fail closed until required security and fee settings are verified.
- Wallet user action remains explicit; no seed phrase/private key collection.
- Confirmed transactions are reconciled with on-chain data before they affect financial metrics.
- AI analysis quotes the source snapshot and states uncertainty; it cannot alter deterministic eligibility or sign/send transactions.
- CI, tests, Preview smoke checks, alerting, rollback and backup procedures pass.
- Vault deposits and unattended trading remain disabled until their separate program/security release gates are completed.

## 9. Official references checked on 24 November 2026

- [Solana RPC overview](https://solana.com/docs/rpc) — public RPC endpoints are shared and not intended for production applications.
- [Solana RPC provider selection](https://solana.com/docs/rpc/providers) — compare workload, rate limits, latency, retention, key scope and failover.
- [Jupiter Swap API v2](https://developers.jup.ag/docs/swap/index.md) — `/order` + `/execute` managed landing path and `/build` custom transaction path.
- [Jupiter Token API](https://developers.jup.ag/docs/tokens) — token identity, verification, organic score, market and audit fields.
- [DexScreener API reference](https://docs.dexscreener.com/api/reference) — batching up to 30 Solana token addresses and endpoint limits.
- [GeckoTerminal API v2](https://api.geckoterminal.com/docs/index.html) — public API caching and approximate rate limit.
- [Webacy DEX token screening](https://docs.webacy.com/guides/dex-token-screening) and [dApp/browser URL security](https://docs.webacy.com/guides/dapp-browser-security).
- [Birdeye Data API changelog](https://birdeye.so/data-api/changelog) — Solana Token Security component data added 2 November 2026; [published plan limits](https://docs.birdeye.so/docs/pricing).
- [Helius Parsed Events and Streams](https://www.helius.dev/blog/parsed-events-and-streams) — announced 3 September 2026.
- [Helius Parsed Events Scan API](https://www.helius.dev/blog/parsed-events-scan) — announced 3 November 2026; new mainnet history-search direction.
- [AI SDK text generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-text) and [tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling).
- [Vercel AI Gateway authentication and BYOK](https://vercel.com/docs/ai-gateway/authentication-and-byok) — API-key and Vercel OIDC authentication.
- [Vercel AI Gateway budgets](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets) — project/team/key/user budgets; documented budget checks are soft caps.
- [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist).

Provider APIs, free quotas, pricing, supported models, and beta status can change. Re-check the provider's current documentation and plan limits before a production commitment.
