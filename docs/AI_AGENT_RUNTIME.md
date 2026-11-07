# WELP UP market analyst runtime

**Current implementation:** server-side, one-request, read-only market analysis.  
**Default state:** unavailable until a server-side OpenAI API key is configured.  
**Not an autonomous trading agent:** this runtime has no wallet, signing, transaction, bot-control, or vault permissions.

## Request flow

1. The browser sends a question (1–500 characters) to `POST /api/agent`.
2. The server calls the same live Jupiter market-feed handler used by the market board. If the feed fails or has no usable timestamp, analysis stops.
3. The server reduces the feed to at most 18 public assets and forwards only market fields needed for research: price changes, liquidity, volume, market cap, holder count, organic score, rule score, turnover, buy pressure, concentration, verification, suspicious-token flag, blockers and warnings. Wallet addresses, balances, private keys, local policies, and transaction details are not included.
4. The server sends the question and snapshot to the OpenAI Responses API with `store: false`, no tools, and instructions to treat market fields as untrusted data.
5. The server returns text plus the model and market timestamp. No conversation or model response is persisted by WELP.

The API key is read only from `OPENAI_API_KEY` on the server. The model is selected by `WELP_AI_MODEL` and defaults to `gpt-5.5`. The key must never use a `NEXT_PUBLIC_` prefix or be included in browser code.

## Vercel configuration

Add the following in the Vercel project’s Environment Variables, scoped to Preview first:

| Variable | Required | Purpose |
|---|---:|---|
| `OPENAI_API_KEY` | Yes | Server-only API credential |
| `WELP_AI_MODEL` | No | Model identifier; defaults to `gpt-5.5` |

Redeploy the Preview environment, then open `/agent`. The page calls `GET /api/agent` to report whether the key exists. It never returns the key. Test a simple market-summary question and confirm the answer includes the current feed timestamp. Promote to Production only after reviewing costs, privacy, and abuse controls.

No credential was available to this code change, so provider authentication and generated output have not been live-tested. Without the key, the endpoint returns an explicit 503 and the UI explains what is missing; it does not show canned AI responses.

## Safety boundaries

- The model receives public market data and the user's bounded question only.
- No wallet connector, wallet signer, Solana transaction builder, Jupiter order endpoint, vault client, or bot instruction is exposed to the model.
- No function-calling tools, web-search tools, or background execution are enabled.
- The prompt forbids buy/sell instructions, profit guarantees, unsupported data, and claims that a transaction or bot action occurred.
- The model's output is untrusted commentary. It must never be treated as a signal eligibility decision, risk-control result, or authorization to trade.
- A model answer is not a financial recommendation. Verify any quoted market facts against the feed and on-chain sources.

## Abuse and operational limitations

The market scorer follows the recovered WELP weighting and gate definitions and is regression-tested against known inputs. It consumes Jupiter Token API v2 fields documented at https://developers.jup.ag/docs/tokens. The route includes a small per-process request counter (four requests per minute per observed client address) as a best-effort guard. Serverless instances do not share this memory, and forwarded IP headers may be affected by the hosting proxy. This is **not** a durable production rate limiter or billing quota. Before enabling the endpoint broadly, add a trusted edge rate limiter or shared atomic store, configure provider spend limits, and monitor provider usage without logging user secrets.

The route times out upstream requests after 30 seconds. Provider errors are returned as bounded messages; API credentials are never returned. The runtime does not store a conversation history. If persistent chat is later introduced, it requires explicit privacy disclosures, retention controls, access isolation, and abuse controls.

## What this does not implement

- No long-running agent loop, scheduled keeper, or background monitoring service.
- No bot creation, bot configuration persistence, strategy marketplace subscriptions, or copy trading.
- No private-key handling, delegated signing, or automatic transaction submission.
- No vault deposits, withdrawals, or on-chain program changes.

Those systems are separate milestones. The on-chain bot/vault program remains gated by the release checklist and must be built, tested with a compatible Anchor/SBF toolchain, independently audited, and verified on Mainnet-Beta before any real funds or autonomous execution are enabled.
