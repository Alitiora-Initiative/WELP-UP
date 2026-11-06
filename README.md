# WELP UP!

WELP UP! is a Solana market research and wallet-approved trading interface. It reads public market and wallet data, evaluates transparent rule-based signals, and prepares Jupiter swap orders for the connected wallet to review and sign.

**Production status: not an autonomous trading platform and not a live vault product.** The browser app does not operate user funds without an explicit wallet signature. No unattended agents, copy trading, strategy marketplace settlement, governance voting, referral rewards, or mainnet vault custody are enabled.

## Current working capabilities

- Connect a compatible Solana wallet and read its public address and balance.
- Retrieve live token/market information from the configured market-data providers.
- Review deterministic signal scores and the rules behind them. A score is not a probability of profit or a forecast.
- Request a Jupiter Swap API v2 order, review the transaction in the wallet, and submit the wallet-signed order through Jupiter's execute endpoint.
- View on-chain transaction signatures for a connected wallet through Solana RPC.
- View browser-local activity and wallet-value snapshots. These are not a complete transaction ledger or verified P&L statement.
- Save browser-local market watch policies and optionally monitor them with 60-second browser notifications while the Automation page remains open. Alerts are read-only and never create orders.
- Adjust local appearance preferences.

## Important limitations

- **No live AI execution:** the Automation, Agent, and Autonomous pages are policy/status interfaces. There is no production agent runtime, delegated signing authority, or live strategy execution. The former browser paper-bot simulator was removed; no bot ROI, TVL, or copier statistics should be represented as live performance.
- **No production vault:** the Anchor program ID in source is a placeholder. The program is not deployed or independently audited on mainnet. Vault deposits, withdrawals, and automated trading must remain disabled.
- **No copy trading:** there is no production bot-owner identity, follower consent, trade replication, or profit-share settlement system.
- **No account backend:** preferences and activity stored in localStorage are specific to one browser. There is no authenticated user account, server-side profile, secure API-key manager, or multi-device sync.
- **No governance or referral settlement:** no governance program, proposal registry, referral attribution, or reward payment system is deployed.
- **No production fee routing:** the requested $0.10 fee and 60/40 operator/treasury split are not active. A treasury destination, on-chain payment flow, fee disclosures, reconciliation, and operational controls must exist before collection can be enabled.
- **No max deposit/withdrawal policy is promised.** Any future vault limits must be disclosed and enforced by audited on-chain logic. Do not assume unlimited withdrawals or deposits until the program design and liquidity mechanics support them.
- The checked-in Anchor configuration targets a local validator only. No Devnet or Mainnet provider is configured. This is not evidence of a deployment and must never be used to invite deposits.

## Pages

- `/` — WELP UP terminal home and product overview.
- `/markets` — live Jupiter-powered market board; `/dashboard` redirects here.
- `/signals` — rule-based market scanner with visible warnings and blockers.
- `/swap` — Jupiter order preparation and wallet-signed execution.
- `/portfolio`, `/profile`, `/history` — wallet summary, public transaction history, and portfolio views.
- `/activity-logs` — browser-local activity log; it is not a complete transaction ledger.
- `/automation`, `/agent`, `/autonomous` — automation policies and agent status; no unattended execution is enabled.
- `/vault` — vault launch status; funding is not enabled.
- `/strategy-marketplace`, `/governance`, `/referral` — status pages; marketplace settlement, governance execution, and referral payouts are not enabled.
- `/risk-dashboard`, `/token-explorer`, `/api-keys`, `/support`, `/system-status` — risk, token, account-service, support, and service-status interfaces.
- `/settings` — local appearance preferences.
- `/docs`, `/whitepaper` — product and integration documentation.
- `/terms`, `/privacy`, `/safety` — legal and safety information.

## Architecture

- Next.js App Router and React.
- Solana Kit / Wallet Standard for wallet connection and transaction signing.
- Jupiter Swap API v2 for order creation and execution.
- Solana mainnet RPC for public wallet and transaction reads.
- Anchor/Rust source under `programs/vault` is an unlaunched vault scaffold. The deployed app must fail closed while the program ID is unverified or the security gates are incomplete.
- Python modules under `welp/` are research/agent code; their presence does not mean a production hosted agent is running.

## Local development

Requirements: Node.js and npm. Install and run:

```bash
npm install
npm run dev
npm run lint
npm run typecheck
```

Optional environment variables are documented in `.env.example`. Keep API keys server-side. Never commit wallet seed phrases, private keys, RPC credentials, or provider secrets.

## Release and security gates

See [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md), [docs/vault/ARCHITECTURE.md](docs/vault/ARCHITECTURE.md), [docs/vault/THREAT_MODEL.md](docs/vault/THREAT_MODEL.md), [LIMITS.md](LIMITS.md), and [ROADMAP.md](ROADMAP.md). A successful frontend build is not a security audit or authorization to accept deposits.

WELP UP does not promise profits, capital protection, liquidity, or uninterrupted execution. On-chain transactions are irreversible in many circumstances and users can lose all funds they trade.
