# Base44-to-Next.js porting matrix

**Reference:** `welp-original-source` and [the source archive audit](BASE44_SOURCE_AUDIT.md).  
**Target:** the existing Next.js App Router application.  
**Rule:** preserve verified product behavior and design intent, not Base44 infrastructure or demo behavior.

| Recovered Base44 page | Current Next.js route | Porting treatment |
|---|---|---|
| `Home.jsx` | `/` | Preserve live market summary, explainable signal snapshot, workspace navigation, and explicit vault-disabled status. Use provider data only. |
| `Markets.jsx` | `/markets` | Preserve searchable live market board, refresh/status states, and transparent ranking. |
| `Signals.jsx` | `/signals` | Preserve published score weights, hard blockers, warnings, and eligible/blocked filters. No profit prediction. |
| `Swap.jsx` | `/swap` | Preserve token search, quote freshness, amount/risk checks, and explicit external wallet signing. Never silently retry or charge. |
| `Automation.jsx` | `/automation` | Preserve user-defined read-only watch policies and explainable evaluations. The original page's analyst panel is now ported using the server-side read-only runtime. Browser-local rules are not bots and cannot submit orders; AI analysis identifies its provider, timestamp, input snapshot, and failure state. |
| `Agent.jsx` | `/agent` | Original file is missing from the archive. The Next.js port now provides an optional server-side, read-only OpenAI market analyst using a fresh Jupiter snapshot. It has no wallet or execution tools; see [AI agent runtime](AI_AGENT_RUNTIME.md). |
| `Vault.jsx` | `/vault` | The source page includes Base44 entity calls and consent/status UI; that is not proof of a deployed vault. Keep funding and execution disabled until audited on-chain implementation and release gates pass. |
| `Portfolio.jsx` | `/portfolio` | Preserve public wallet balance reads; label snapshots and incomplete history accurately. |
| `History.jsx` | `/history` | Use confirmed on-chain records and explicit RPC coverage limits. Do not call a partial wallet scan a complete ledger. |
| `ActivityLogs.jsx` | `/activity-logs` | Original source file is missing from the archive. Keep browser-local events clearly distinguished from on-chain events. |
| `StrategyMarketplace.jsx` | `/strategy-marketplace` | Do not port the source's local strategy fixtures, backtest metrics, timeout-based subscribe flow, or simulated fee totals as production data. Marketplace and settlement remain disabled until verified bot identity, follower consent, and on-chain accounting exist. |
| `Docs.jsx` | `/docs` | Keep documentation aligned with shipped behavior, the security model, and open release gates. |
| `Whitepaper.jsx` | `/whitepaper` | Preserve the technical narrative, but update every claim to match the deployed implementation and current security status. |
| `Safety.jsx` | `/safety` | Publish only enforced limits and explain which checks are advisory versus on-chain. |
| `Terms.jsx` | `/terms` | Keep commercial terms consistent with the approved fee specification and actual enabled services. |
| `Privacy.jsx` | `/privacy` | Describe actual data handling and connected services; do not claim account infrastructure that is absent. |
| `Profile.jsx` | `/profile` | Use public wallet information and browser-local preferences; no fake account profile. |
| `Register.jsx`, `Login.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `Mfa.jsx`, `OAuthConsent.jsx` | No equivalent production account routes | The original pages depend on Base44 authentication. Do not recreate non-functional auth forms. A real auth provider, server-side sessions, account data model, MFA and security review are prerequisites. |
| `Support.jsx` | `/support` | Keep support guidance actionable and do not invent ticket submission or response status. |
| `SystemStatus.jsx` | `/system-status` | Report individual configured dependencies and disabled systems; never infer agent or vault health from a healthy RPC. |

## Shared components and mechanics

- `TopNav.jsx`, `Layout.jsx`, `Footer.jsx`, `TickerStrip.jsx`: use as references for navigation hierarchy, page shell, live-feed status, and footer information; retain responsive behavior in the Next.js shell.
- `MarketDataTable.jsx`, `MarketTable.jsx`, `TokenLogo.jsx`, `VaultChart.jsx`: port only when their data inputs are real provider/on-chain data and empty/error states remain honest.
- `useMarketTokens.js` and `engine.js`: the Next.js scorer now ports the recovered 32/20/15/13/12/8 weights, 80–98 ranking band, liquidity/volume/freeze/concentration/suspicious-token hard gates, and explicit warnings for missing data. Regression tests cover the weights and blockers.
- `useVaultStatus.js`, `vault.js`, `ledger.js`, `fees.js`, `jupiter.js`, `rpc.js`, `policies.js`, `strategies.js`, and `wallet.jsx` are listed in the archive TOC but absent as captured source sections. Reconstruct their behavior only from call sites, current code, tests, and the staged build specification; do not claim their original implementations were recovered.
- `base44Client.js`, `AuthContext.jsx`, Base44 entities, and Base44 functions are platform-specific dependencies. Replace them with explicitly designed, security-reviewed services or remove the dependency where no backend is justified.

## Conflicts resolved by the staged specification

The existing readiness and engineering-review documents previously described a different fee model (a per-trade/deposit/withdrawal fee and a 60/40 operator/treasury split). That conflicts with the staged bot specification. The approved planning model is:

- US$0.10 per successful bot creation/activation.
- 40% to a verified, explicitly configured recipient and 60% to the Treasury PDA.
- A separate creator share of 0–30% of realized positive net profit.
- All fee collection remains disabled until recipient verification, atomic settlement, disclosures, accounting, tests, and review are complete.

Do not use the old operator address or old per-action fee wording as production configuration. The candidate recipient in the staged specification is unverified and must be validated and confirmed before use.

## Implementation order

1. Inventory the current Next.js route and component for each recovered page.
2. Port the original information architecture and design behavior while keeping current Next.js routing and Solana integrations.
3. Reconcile every source-derived field and rule with the current API contract and tests.
4. Remove or clearly disable all demo, fixture, local-only, and non-settling marketplace behavior.
5. Complete vault and bot program work behind fail-closed feature gates; do not expose deposits or autonomous execution during development.
6. Add and validate the read-only analyst adapter with server-only credentials and explicit cost/abuse controls.
7. Update README, whitepaper, docs, terms, safety and status surfaces together whenever shipped behavior changes.
