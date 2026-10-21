# WELP UP!

WELP UP! is a Solana market-analysis and wallet trading interface. It reviews selected live token pools, shows the signals and limits it sees, and lets a user prepare a Jupiter swap for individual approval in Phantom or another compatible wallet.

The deployed browser app does **not** trade unattended. A signal is analysis, not an order. Every current swap must be reviewed and signed in the user's wallet. The app does not ask for a seed phrase or private key.

## Product flow

1. Connect a Solana wallet. WELP reads its public address and public balance data.
2. Review market signals and the reason each token passed or failed the current rules.
3. Set the swap amount, inspect the quote, and approve that transaction in the wallet.
4. Review wallet balance snapshots and transaction activity in Portfolio and Profile.

The swap amount opens at **0.001 SOL** and is editable. Current browser buy limits are 0.001 SOL minimum and 0.02 SOL maximum per buy.

## Pages

- `/` — product overview and how the current flow works.
- `/dashboard` — trading console overview.
- `/signals` — live market scanner and rule scores.
- `/swap` — token search, Jupiter quote, and wallet-approved swap.
- `/safety` — current rules, risks, and future vault requirements.
- `/activity` — wallet-value snapshots, strategy scan events, and swaps recorded by this browser.
- `/profile` — connected wallet, public balance summary, and paginated on-chain transaction history (10, 25, 50, or 100 per page).
- `/terms` — Terms and Conditions (v1.0).
- `/privacy` — Privacy Policy.

Activity snapshots and the activity feed are stored locally in the browser under the connected public wallet address. Profile transaction history is fetched from Solana RPC for the connected address. Neither page is an authenticated account service, complete portfolio ledger, tax report, or profit-and-loss statement. Local activity does not sync between devices.

## Current market and trade limits

- Signal discovery evaluates a small set of trending Solana pools. The current web scanner is rule-based; it is not an unattended AI trader.
- Entry scores must fall within 80–98 inclusive. A score is not a probability of profit.
- A buy requires at least $0.50 estimated wallet equity and checks that 0.003 SOL remains for fees.
- The interface blocks buys below 0.001 SOL or above 0.02 SOL and blocks quoted price impact above 2.5%.
- The wallet signs every current swap. Quotes can expire or change. Transactions use real mainnet assets and can lose all value.

These are application checks, not guarantees of safety. See [LIMITS.md](LIMITS.md), [ROADMAP.md](ROADMAP.md), [TERMS.md](TERMS.md), and [PRIVACY.md](PRIVACY.md).

## Autonomous vault status

Autonomous trading is a planned feature and is **not enabled on mainnet**. Architecture and a threat model are published:

- [docs/vault/THREAT_MODEL.md](docs/vault/THREAT_MODEL.md)
- [docs/vault/ARCHITECTURE.md](docs/vault/ARCHITECTURE.md)
- Scaffold Anchor program: [programs/vault/](programs/vault/)

The intended design is an isolated on-chain vault funded with an amount of SOL the user explicitly chooses and confirms. The agent analyzes the market and chooses candidates; the program enforces the user's total funding cap and a 0.02 SOL per-position ceiling. The user can revoke trading authority and withdraw available funds at any time.

Devnet implementation, audit, consent flow, and mainnet enablement remain open (see [ROADMAP.md](ROADMAP.md) gates 3–7). Do not send SOL to the current website expecting it to manage funds. Never provide WELP with your Phantom private key.

## Run locally

Requirements: Node.js and npm. The browser app uses Next.js, React, Solana Kit/Wallet Standard, and Jupiter Swap v2.

```bash
npm install
npm run dev
```

Optional environment variables:

- `NEXT_PUBLIC_SOLANA_RPC_URL` — public Solana RPC endpoint used by the wallet client.
- `SOLANA_RPC_URL` — server-side RPC endpoint for balance and transaction-history reads.
- `JUPITER_API_KEY` — server-only Jupiter API key; never prefix it with `NEXT_PUBLIC_`.

The app falls back to public Solana RPC endpoints and Jupiter's unauthenticated limits if keys are not configured. See `.env.example` for variable names.

Before committing or deploying changes, run:

```bash
npm run lint
npm run typecheck
npm run build
```

## Legacy command-line agent

The repository still contains a separate Python command-line runner under `welp/`. It is not part of the deployed browser app and does not connect to Phantom. That legacy path can read `SOLANA_PRIVATE_KEY` from its local environment and sign from the machine running it. Review its source and its separate documentation before running it; do not place a Google-created Phantom wallet secret or recovery phrase in that environment. The browser interface never uses that key path.

## Operator and licensing

**Operator:** Joseph Mushelle Nyingeh, Kenya, publishing under the free-tier GitHub organization [Alitiora Initiative](https://github.com/Alitiora-Initiative). Studio site: [alitiora-initiative.vercel.app](https://alitiora-initiative.vercel.app).

Repository source code is distributed under the [MIT License](LICENSE). MIT is the software license; it does not replace or govern the service's Terms and Conditions, privacy disclosures, third-party services, or on-chain permissions. [TERMS.md](TERMS.md) (v1.0, effective 21 October 2026) are the published service terms for the non-custodial interface. [PRIVACY.md](PRIVACY.md) describes how personal information is processed. Independent Kenyan legal review is still recommended for formal reliance. Third-party packages and services retain their own licenses and terms.

## Risks

Mainnet swaps move real assets. Token prices, liquidity, quotes, route availability, and wallet balance estimates can be wrong or change quickly. Blockchain transactions can fail, consume fees, or become irreversible. No signal, filter, chart, audit, or take-profit plan guarantees a return or an exit. Only transact with assets you can afford to lose.
