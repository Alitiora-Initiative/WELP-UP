# WELP UP! production engineering review

**Review date:** 6 November 2026  
**Scope:** Static repository review of the current main branch and deployed product architecture.  
**Verdict:** The market research and wallet-approved swap console can be operated as a mainnet web application. The vault, delegated execution, copy trading, strategy settlement, governance execution, fee collection and account backend are **not approved for real-money production**.

This is an engineering review, not an independent smart-contract audit, penetration test, legal opinion or guarantee that every issue has been found.

## Executive summary

WELP should be presented as a mainnet market-data and wallet-approved swap application. It must not be marketed as a live vault or autonomous trading exchange yet.

The repository contains substantial UI and program scaffolding, but the presence of a route, Rust instruction, Python agent module or chart component does not prove that a production service is deployed or operating. Product pages must use verified provider/on-chain data or clearly report that the relevant backend is not configured.

### Verified from repository source

- Next.js App Router application with Solana wallet connection.
- Mainnet public wallet reads and transaction-signature lookup through Solana RPC.
- Jupiter Swap API v2 order preparation and wallet-signed execution endpoints.
- Live market/token feed and deterministic signal scoring.
- Browser-local preferences, watch policies and activity events.
- /docs and /whitepaper already exist, along with threat-model and production-readiness documents.
- Anchor.toml currently selects localnet for program development. This is not a Devnet or Mainnet deployment.
- The Anchor program ID in source is explicitly a placeholder. Do not derive a user vault PDA from it or send funds to it.

## Critical findings and required treatment

| Area | Current evidence | Production treatment |
|---|---|---|
| Vault deployment | Placeholder program ID; localnet-only Anchor config; no verified mainnet deployment | Keep all funding actions disabled |
| Contract security | Program scaffold includes SOL accounting, legacy entry points and creator-fee accounting; no independent audit evidence in repo | Complete code-level review, adversarial tests and independent audit before deployment |
| Executor controls | Some legacy executor functions are compatibility stubs; no production agent key service is configured | Do not expose delegated signing or unattended execution |
| Swap history | Execute endpoint returns a successful Jupiter signature; no durable server-side execution ledger is established by that endpoint | Reconcile signatures from chain; do not call browser-local events a complete ledger |
| Transaction history | RPC history endpoint lists signatures and confirmation metadata | Parse transaction details and token balance changes before claiming trade/deposit/withdrawal classification or complete P&L |
| P&L | Current balance snapshots do not establish cost basis or complete transfer history | No verified realized/unrealized P&L claims until an indexed, reconciled ledger exists |
| Copy trading | No production follower consent, replication engine or profit-share settlement | Keep copying and subscriptions disabled |
| Strategy performance | No verified deployed bot execution records | Never show invented ROI, win rate, TVL, followers or agent counts |
| Fees | No active fee collection or treasury settlement flow | Keep all fees disabled until a reviewed atomic payment design exists |
| API keys | No authenticated account/key issuance service | Do not issue client-side secrets or store provider credentials in localStorage |
| Governance | No deployed governance program or verified proposal registry | Read-only explanatory page; no fake proposals or votes |
| Referrals | No attribution and payout service | No referral balances or rewards until settlement exists |
| User settings | Theme and text scale are browser-local | Describe them as local preferences, not account-wide settings |
| System status | Live checks cover configured RPC/provider endpoints and explicit disabled states | Report each dependency separately; never infer vault/agent health from a healthy RPC |

## Mainnet-only operating policy

1. The public product network is Solana Mainnet.
2. Public reads and wallet-approved swaps must use a configured mainnet RPC endpoint.
3. The Anchor program remains a local-validator development artifact until a reviewed program ID, deployment transaction, executable account and source verification are published.
4. Do not add Devnet fallback behavior to production. Do not substitute local fixtures, fake fills, seeded chart points or fabricated balances when a provider is unavailable.
5. If a mainnet dependency is unavailable, return an explicit unavailable/degraded state with the source and fetch time.
6. Keep local-validator tests isolated from the deployed web application. A local test passing is not a mainnet launch gate.

## Vault launch gates

The current vault scaffold must not be deployed to Mainnet or funded based on this review. Before reconsidering launch:

- Reconcile the Anchor account layouts, PDA seeds, account constraints and instruction discriminators against the client.
- Remove or fully implement every compatibility stub. A no-op executor setter/revoker must never be presented as an effective owner control.
- Review all account constraints and signer requirements for initialization, funding, withdrawal, bot registration, creator-fee settlement and claims.
- Prove that only the vault owner can authorize owner actions and that only the intended authority can settle or claim fees.
- Prove that creator-fee amounts are derived from trusted, verified realized profit and cannot be asserted by an untrusted caller.
- Implement token-account deposits and withdrawals, supported mint policy, decimal-safe accounting and recovery paths. SOL-only arithmetic is not a complete token vault.
- Verify that vault rent, rent-exempt minimums, direct lamport changes, available balance, total deposits, shares and accrued liabilities remain consistent under every instruction sequence.
- Add property/fuzz tests, adversarial account substitution tests, replay/nonce tests, rounding tests, CPI tests and emergency pause/revoke/withdrawal tests.
- Publish an independent audit and remediation report.
- Deploy only from reviewed source with secured upgrade authority and a verified mainnet program account.
- Verify pause, revocation and user withdrawal from a separate wallet before any public launch.
- Complete operational, legal, tax, sanctions and consumer-protection review for intended jurisdictions.

**No arbitrary website maximum is imposed on deposits or withdrawals by this review.** That does not mean withdrawals can be guaranteed at all times: on-chain available liquidity, rent, network state and contract invariants still govern what can safely be withdrawn. Any future risk parameter must be explicit, user-visible and enforced by audited on-chain logic, not hidden in the UI.

## Agent and copy-trading architecture

A production bot system needs more than an AI page. Required components include:

- Isolated agent runtime with a documented model/provider, version, strategy hash and observable health.
- No access to user seed phrases or primary-wallet private keys.
- Explicit per-vault, per-strategy, per-token and per-position permissions.
- Owner-controlled pause and revocation that do not depend on the agent operator.
- Durable job queue, idempotent order intents, nonce/replay protection and retry policy.
- Quote validation, token/mint allowlists, slippage bounds and transaction preflight checks (never presented as an executed trade).
- Signed user consent and immutable subscription terms.
- On-chain confirmed execution receipts and a chain indexer.
- Profit-share settlement computed from verified net realized profit, with follower consent and a strategy-owner rate bounded to 0–30%.
- Stop-copy behavior that prevents new orders and clearly defines treatment of open positions.
- Independent reconciliation, monitoring, alerting and incident response.

Until these components are deployed and reviewed, the Agent Monitor must report that no production agents are running. It must not invent performance charts or active status.

## Fees and treasury

The requested commercial policy is a proposed US$0.10 fee per successful trade, deposit and withdrawal, with 60% allocated to the supplied operator wallet and 40% to a platform treasury.

- Operator wallet supplied by the project owner: 6uyKhdb2iT8kWhk6SKyJjudWthYLESrVj3G7WHHydoEQ.
- Platform treasury: **not supplied / not configured**.
- Fee collection: **disabled**.
- USDC mint and conversion route: must be explicitly selected and verified.
- A fee must be visible before the user signs and should settle atomically with the successful action where technically possible.
- Failed, expired or reverted actions must not be charged.
- Conversion from another asset to USDC must never happen silently or without explicit transaction review.
- The 60/40 allocation must be enforced by verifiable on-chain logic or an independently auditable settlement service, with receipts and reconciliation.

Do not enable fee collection until the treasury address, token account derivation, exact USDC mint, pricing/rounding policy, atomicity, refunds and reconciliation have been reviewed.

## Data integrity rules

- **Prices:** retain provider identity, observation time and stale/error status.
- **Charts:** plot only provider-returned candle/price points or on-chain indexed vault events. Empty data must render an empty state, not a fabricated flat line.
- **Wallet history:** a signature list is not a decoded ledger. Parse confirmed transactions, account keys, pre/post balances, token balance changes and failed status.
- **P&L:** distinguish realized from unrealized; include fees, slippage, token decimals, transfers and missing-price treatment. Do not calculate from partial snapshots.
- **Vault history:** source from program events and transaction metadata after deployment; browser localStorage is supplemental only.
- **Agent charts:** source from confirmed execution records, not backtests or strategy claims.
- **Status:** every check must have a real endpoint or explicit “not configured” state.

## Navigation and product organization

The site uses an OKX-inspired information architecture without copying OKX branding or content:

- **Markets:** Markets, Signals, Token Explorer.
- **Trade:** Swap, Transaction History, Portfolio.
- **Automate:** Automation policies, Agent Monitor, Strategy Marketplace.
- **Vault:** Vault status, Risk Dashboard.
- **Console:** Profile, Settings, Activity Logs, API Keys, Governance, Referrals, System Status, Support.
- **Docs:** Documentation, Whitepaper, Safety, Terms and Privacy.

The /agent-monitor route is an explicit route to the existing fail-closed agent status surface. It is not a claim that an execution service exists.

## Release checklist

- [ ] Lint and TypeScript checks pass.
- [ ] Unit tests pass.
- [ ] Production build passes.
- [ ] CI security/dependency checks pass.
- [ ] All public routes return expected HTTP status and metadata.
- [ ] Mainnet provider outages show honest degraded states.
- [ ] No fake balances, demo assets, simulated trades, seeded chart points or fabricated agent metrics.
- [ ] Wallet-signed swap is tested with a small-value controlled transaction and confirmed on Solana Explorer.
- [ ] Transaction signatures and chain results reconcile.
- [ ] No vault funding or agent execution control is exposed while launch gates remain open.
- [ ] Preview deployment is manually checked at desktop and mobile widths.
- [ ] Production deployment is promoted only after review and PR merge.

## External technical references

- [Jupiter Swap API v2 overview](https://developers.jup.ag/docs/swap/index.md)
- [Jupiter order endpoint](https://developers.jup.ag/docs/api-reference/swap/order.md)
- [Jupiter execute endpoint](https://developers.jup.ag/docs/api-reference/swap/execute.md)
- [Solana getTransaction RPC](https://solana.com/docs/rpc/http/gettransaction)
- [Solana Token Extensions transfer fees](https://solana.com/docs/tokens/extensions/transfer-fees)
- [OKX product/navigation organization reference](https://www.okx.com/trade-market/exchange)
- [OKX account, activity and support information architecture](https://www.okx.com/help)
