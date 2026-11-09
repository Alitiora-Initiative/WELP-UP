# WELP UP

[![Website](https://img.shields.io/website?url=https%3A%2F%2Fwelpup.fun)](https://welpup.fun) [![License: MIT](https://img.shields.io/badge/License-MIT-22c55e)](LICENSE) [![Solana: Mainnet](https://img.shields.io/badge/Solana-Mainnet-111111)](https://welpup.fun)

WELP UP is a Solana market research and wallet-signed trading interface at [welpup.fun](https://welpup.fun). Fork the repo, open a pull request, and send updates. Reviewers merge changes that keep live data honest and wallet signing in the user's wallet. It provides live market reads, rule-based signals, wallet-derived portfolio data, market analysis and a token launch interface.

## Current feature boundaries

- **Markets and signals:** read live upstream Solana market data. Feed or RPC outages are reported as unavailable; the app does not fabricate prices, balances, listings or volume.
- **Trading:** users review and sign supported Jupiter v2 swaps in their wallet. `/api/status` checks the token feed and makes a quote-only Swap API request; a server-side `JUPITER_API_KEY` is optional for keyless access and can provide a higher rate tier. Automated trading and custody are not enabled. If referral collection is not configured or cannot be verified, the order route returns a clearly labelled quote with no WELP referral fee, so the swap can still proceed by wallet approval. If the referral account and exact fee-mint token account verify, the configured referral fee is included. Jupiter referral proceeds are claimable by the configured partner wallet and are not automatically sent to a WELP treasury.
- **Fees and treasury:** the referral fee is one configurable Jupiter fee (50–255 bps), not the proposed 100-bps protocol plus 50-bps creator split. Jupiter retains 20% of the integrator fee. The app reports the referral rate and token mint on quotes; actual collection requires the matching on-chain referral token account. The custom treasury/launch program is not executable on mainnet, so its PDA and two-week 60/40 split are not active. See [fees and treasury](docs/FEES_AND_TREASURY.md) and the live [system status](https://welpup.fun/system-status).
- **Pump launch:** the launch route prepares a PumpPortal `create` transaction targeting the Pump bonding-curve pool; the connected wallet must sign it, and the site submits the signed transaction to Solana. A successful transaction's mint is its Solana contract address (CA). This does not guarantee listing or indexing by third-party platforms.
- **Custom supply and decimals:** UI or program source is not proof of mainnet support. Keep this feature disabled until the program is built, reviewed, deployed, initialized and independently verified on mainnet.
- **Development fund:** the homepage shows the confirmed SOL balance of the public development wallet against a 4 SOL goal. It links to the account explorer and reports unavailable when RPC verification fails. Donations are voluntary, go directly to that address and are not controlled by WELP software. The goal does not trigger an unattended transaction or guarantee deployment.
- **Graduation and DEX listing:** platform support, graduation, indexing and CoinGecko inclusion are controlled by third parties and are not promised by mint creation alone.

## Security and operations

WELP does not ask for seed phrases. Every supported asset transfer requires the user's wallet signature. Never place private keys in source, issues, chat, browser storage or deployment logs. A deployment key must be protected outside the application, funded only for a reviewed deployment, and used only after reproducible builds, tests, security review and verification of program ID, binary, upgrade authority, treasury and fee destinations.

The current Anchor source and configured launch/treasury program ID are not evidence of a deployed or audited mainnet program. Mainnet RPC currently reports that address as non-executable; no WELP treasury PDA or epoch split is active. No funds should be sent to a program/PDA until its deployed code and permissions have been independently verified. Jupiter referral collection applies only to orders created through WELP's configured swap route; it does not tax direct trades on Pump, Jupiter or other DEXs.

## Local development

Requirements: Node.js, npm, Rust and Anchor. From the repository root:

```sh
npm ci
npm run lint
npm run typecheck
npm run build
```

For program work, run the pinned Cargo/Anchor build and program tests in the Linux filesystem under WSL. Report frontend compilation, Rust host tests, SBF builds, integration tests, security review and mainnet verification as separate evidence; one does not imply the others.

## Third-party token compatibility

A Solana CA is a mint address. Wallets and platforms may recognize it, but market pages and trading routes depend on each platform's supported pools, liquidity, metadata, indexing delays and policies. Pump bonding-curve trading, Jupiter routing, DexScreener discovery, FOMO support and CoinGecko listing are separate capabilities. Verify each platform directly; do not claim universal compatibility.

## Launchpad requirements and actual support

- **Bonding curve:** the Pump launch route delegates creation to PumpPortal's public Pump pool. WELP does not operate its own curve or control Pump's lifecycle.
- **Graduation, DEX liquidity and LP locking:** WELP does not create or burn a Raydium LP position for Pump-launched tokens. No WELP-controlled migration or permanent LP lock is implemented.
- **Supply and decimals:** the custom Anchor code is local source only. It is gated off until the executable mainnet program, operator enablement and release review are verified; a host Rust build is not an SBF artifact or audit.
- **Fixed supply controls:** the custom program source is being hardened to create a fixed mint and revoke mint authority, but it is not enabled or deployed. Pump tokens follow Pump's own program rules.
- **Anti-bot and per-wallet limits:** WELP does not currently enforce custom launch-time wallet caps or anti-sniping controls.
- **Social metadata:** optional HTTPS website, X and Telegram links are included in Pump launch metadata. The WELP token image remains the default image; creator image upload is not provided.
- **Comments and community chat:** not provided.
- **Holder concentration charts:** no WELP holder-distribution chart is provided; do not interpret an aggregate holder count as a distribution.
- **Candles:** charts use live provider OHLCV when available and surface provider/freshness failures.
- **Transaction history:** the portfolio view reads transactions for a connected public wallet; it is not a token-specific live buy/sell/migration ledger.
- **Discovery filters:** the market board filters and sorts only on fields returned by its live provider. Creation time, bonding progress and social engagement are not shown without verified feeds.
