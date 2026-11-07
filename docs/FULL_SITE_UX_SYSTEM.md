# WELP UP — Full-site UX and visual system

Status: implementation baseline for the full-site experience  
Scope: public website, market console, trading surfaces, automation, vault, account and documentation routes.

## Product design direction

WELP UP is a Solana market console, not a generic crypto landing page. The interface should feel like a focused professional trading workspace: high signal density, strong typography, precise numerical alignment, obvious wallet state and explicit transaction boundaries.

Visual identity:
- Near-black / charcoal canvas with subtle green atmospheric lighting.
- Vivid lime-green is the primary action colour and is visible at rest, not only on hover.
- Primary actions use a glossy lime gradient, dark ink text, pill geometry and a restrained highlight.
- Secondary actions use quiet glass/outline surfaces; destructive actions remain clearly red.
- White/soft-grey text hierarchy, muted green-grey supporting text and IBM Plex Mono for addresses, timestamps and market figures.
- Bricolage Grotesque for display headings; Inter for interface copy.

## Design principles

1. Data before decoration. Market values, wallet balances, fees and timestamps must come from an identified source and show a loading, stale, unavailable or error state.
2. No synthetic financial content. Never render fake volume, price, market cap, holdings, P&L, agent activity, vault TVL, users or token launches.
3. Separate product concepts. Wallet assets are not vault assets; vault policy is not portfolio performance; an analysis signal is not a buy recommendation; an agent status is not an execution permission.
4. One obvious primary action per section. Keep supporting actions visually secondary and preserve a consistent green primary action.
5. Explicit signing. Every swap and future on-chain action must show the asset, amount, route, slippage, price impact, fee and wallet approval boundary before signing.
6. Useful empty states. Explain why data is absent, what dependency is missing, and which safe next action is possible.
7. Responsive by design. Tables scroll horizontally when necessary; forms stack on narrow screens; navigation becomes a keyboard-operable mobile menu.
8. Accessible by default. Visible focus, semantic headings, labelled inputs, button states, reduced motion and readable contrast.

## Information architecture and page intent

| Route | Page job | Primary experience |
|---|---|---|
| / | Explain WELP and orient users | Clear value proposition, live feed snapshot, route shortcuts, safety promise |
| /markets | Explore the tracked Solana market set | Search, filters, sort, refresh, transparent eligibility reasons, source/update time |
| /token-explorer | Inspect a single mint | Identity, mint address, authority flags, metadata, pool/liquidity evidence and explorer links |
| /signals | Understand deterministic rule results | Score, rule-by-rule pass/block reasons, data freshness, link to review a quote |
| /risk-dashboard | Explain market and execution risk | Risk checks, thresholds, exposure definitions and explicit unavailable states |
| /leaderboard | Rank verifiable tracked activity | Published metric, period, source and tie handling; no fabricated ranks |
| /swap | Prepare and approve a trade | Token selection, amount, quote lifecycle, route/fee/impact review, wallet sign and transaction result |
| /safety | Explain controls | Risk limits, signing model, permissions and known limitations |
| /history | Review public wallet transactions | Signature, time, token/side, status, explorer link and empty state |
| /portfolio | Inspect wallet-owned assets | Public wallet balances and token holdings; label data source and snapshot time |
| /vault | Inspect vault policy and readiness | Program identity, authority model, pause state, limits and gated operations |
| /dashboard | Inspect the console snapshot | Wallet state, live signals and current system status |
| /launchpad | Discover verified launches | Indexed launches, token detail, creator disclosures and gated creation |
| /automation | Configure watch policies | Explain local vs server persistence, rule editor, evaluation and alert history |
| /agent | Use the market analyst | Evidence-backed analysis, cited inputs, limitations and no false execution claims |
| /autonomous | Inspect agent runtime gates | Runtime availability, permissions, kill switch and explicit disabled state |
| /strategy-marketplace | Review strategy listings | Clear strategy methodology, verified performance provenance or no-performance warning |
| /governance | Explain governance status | Actual proposal records and voting rules; no placeholder votes |
| /api-keys | Explain API access | Key status, scopes, creation/revocation only when backed by secure server support |
| /referral | Explain referral programme | Terms, eligibility and tracked rewards only when programme is live |
| /profile | Inspect user identity | Connected wallet, public address, account preferences |
| /settings | Configure display | Dark/light/system, text scale and preference persistence |
| /activity-logs | Review local activity | Clearly label browser-local records vs on-chain history |
| /activity | Review activity feed | Source, timestamp and transaction signature when applicable |
| /system-status | Diagnose dependencies | RPC, Jupiter, indexer, program and deployment checks with last checked time |
| /docs | Teach product use | Architecture, user journeys, permissions, limitations and runbooks |
| /whitepaper | Explain protocol design | Current architecture and roadmap, with implemented vs planned clearly separated |
| /support | Resolve user issues | Troubleshooting, safe wallet guidance and contact path |
| /terms, /privacy | Legal transparency | Published terms and data handling, not marketing filler |

## Shared page anatomy

Every operational route should use the same order:
1. Breadcrumb and page title.
2. One-sentence page purpose and a source/status label where live data is involved.
3. One primary action (or explicit disabled state with a reason).
4. Key metrics only when the data exists and has a defined source.
5. Main task surface: table, form, chart, policy list or transaction list.
6. Contextual explanation, warnings and provenance.
7. Empty/loading/error states that preserve the page layout and explain the next step.

## Interaction contracts

### Market data
- Show source and last-updated time beside the data region.
- Retain last successful values only if they are visibly marked stale.
- Distinguish zero from unknown/unavailable.
- Search should support name, symbol and mint; filters should be composable and resettable.
- Sorting should announce the active field and direction.

### Swap
- A quote is not a transaction.
- Quote refresh/expiry is explicit; wallet changes invalidate the quote.
- Review shows pay/receive, price impact, slippage, route fee and quote age.
- Signing happens only after the user chooses the sign action; show pending, success and failure states.
- Never auto-retry a signed transaction or imply that submission equals settlement.

### Vault and agents
- Unavailable program IDs, treasury configuration, indexers or runtime services must remain fail-closed.
- Disable funding, withdrawal, delegation and autonomous execution when the corresponding audited program/permission path is not deployed.
- Display the missing dependency and what evidence would unlock the action.

### Navigation
- Keep the grouped top navigation: Markets, Trade, Automate, Vault, Console and Docs.
- Mega menus are operable by pointer and keyboard; Escape closes them; route changes close overlays.
- On mobile, the nav is a compact menu with explicit expanded state and tap targets.

## Visual tokens

- Canvas: #070907
- Raised surface: #0d120d
- Elevated surface: #121a11
- Border: #263321
- Primary lime: #c7ff45
- Lime highlight: #e1ffa2
- Lime deep: #aeea48
- Primary text: #f3f8ed
- Muted text: #929d8c
- Danger: #fa7771
- Display: Bricolage Grotesque
- UI: Inter
- Data: IBM Plex Mono
- Corners: 12px controls, 16–20px surfaces, 999px primary buttons

## Research references

- Pons launchpad discovery and create flow: https://ponsfamily.com/launchpad and https://pons.family/launchpad/create
- Jupiter Developer Platform APIs: https://developers.jup.ag/
- Jupiter Token API reference: https://developers.jup.ag/docs/tokens
- Jupiter Swap API V2: https://developers.jup.ag/docs/swap
- Solana wallet message authentication: https://solana.com/docs/frontend/messages-and-auth
- Solana production signing guidance: https://solana.com/docs/core/transactions/signing-in-production
- Solana security guidance: https://solana.com/docs/tools/security

## Implementation note

This document describes the UX contract. It does not claim that every listed backend capability is already deployed. Each page must reflect the actual implementation and live dependencies; a planned feature remains visibly planned or disabled until its program, API and security gates are real.
