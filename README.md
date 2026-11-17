# WELP UP

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e)](LICENSE) [![Solana: Mainnet](https://img.shields.io/badge/Solana-Mainnet-111111)](https://welpup.fun)

WELP UP is a Solana market research and wallet-signed trading interface at [welpup.fun](https://welpup.fun). Fork the repo, open a pull request, and send updates. Reviewers merge changes that keep live data honest and wallet signing in the user's wallet. It provides live market reads, rule-based signals, wallet-derived portfolio data, market analysis and a token launch interface.

## Current feature boundaries

- **Markets and signals:** read live upstream Solana market data. Feed or RPC outages are reported as unavailable; the app does not fabricate prices, balances, listings or volume.
- **Trading:** Jupiter Swap API v2 orders are designed for user review and wallet signing; automated trading and custody are not enabled. WELP swap order and execute routes fail closed until a server-side Jupiter referral account and fee are configured. Each returned order must include the configured fee basis points. This referral route is separate from WELP's undeployed on-chain treasury program and does not implement the proposed 60/40 treasury settlement.
- **Pump launch:** the launch route prepares a PumpPortal `create` transaction targeting the Pump bonding-curve pool; the connected wallet must sign it, and the site submits the signed transaction to Solana. A successful transaction's mint is its Solana contract address (CA). This does not guarantee listing or indexing by third-party platforms.
- **Custom supply and decimals:** the WELP program is not executable on mainnet. Keep the rail disabled until the binary and program ID are verified, an independent security review is complete, and both `WELP_LAUNCHPAD_ENABLED` and `WELP_LAUNCHPAD_SECURITY_REVIEWED` are explicitly enabled.
- **Development fund:** the homepage shows the confirmed SOL balance of the public development wallet against a 3,000 SOL target. The target is based on the full protocol lower-budget estimate plus a 20% contingency (about $216,000 / 3,000 SOL at the $72.16/SOL planning reference); it is not an estimate of program rent and excludes seed liquidity. It links to the account explorer and reports unavailable when RPC verification fails. Donations are voluntary, go directly to that address and are not controlled by WELP software. The goal does not trigger an unattended transaction or guarantee deployment.
- **Graduation and DEX listing:** platform support, graduation, indexing and CoinGecko inclusion are controlled by third parties and are not promised by mint creation alone.

## Security and operations

WELP does not ask for seed phrases. Every supported asset transfer requires the user's wallet signature. Never place private keys in source, issues, chat, browser storage or deployment logs. A deployment key must be protected outside the application, funded only for a reviewed deployment, and used only after reproducible builds, tests, security review and verification of program ID, binary, upgrade authority, treasury and fee destinations.

The current Anchor source and sample program IDs are not evidence of a deployed or audited mainnet program. No user funds should be sent to a program/PDA until deployed code and permissions have been independently verified. A Jupiter referral fee applies only to orders requested through WELP's configured Jupiter route; it does not tax direct trades on Pump, Jupiter or other DEXs. The proposed 14-day 60/40 allocation is a policy design until implemented and verified on-chain.

### Mainnet readiness check (2026-11-17)

- The vault has no configured production program ID; the source placeholder returned no account from the public mainnet RPC. Vault deposits, automated execution and fee settlement remain disabled.
- The custom launchpad ID (`BrcdB9sV7z9DvF9rDHG263HUxXgJM3iCQdF36TcxbFEn`) returned an account owned by the System Program with `executable: false`; it is not a deployed WELP program. The custom-supply launch rail must remain disabled.
- The current development environment does not expose `WELP_REFERRAL_ACCOUNT` or `WELP_REFERRAL_FEE_BPS`. Jupiter order/execute routes therefore return 503; no end-to-end signed swap or WELP fee settlement is claimed. Check `/api/status` in the target deployment before enabling any route.
- The public Jupiter token/search feeds and Jupiter Swap API v2 order endpoint responded during read-only checks. A reachable quote API is not proof that a wallet-signed swap will execute or settle.

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
- **Charts:** the app embeds DexScreener's hosted chart for the highest-liquidity Solana pair returned for a mint. WELP does not synthesize OHLC candles from a single price snapshot. Signals separately use GeckoTerminal OHLCV plus Jupiter fee-bearing quotes.
- **Transaction history:** the portfolio view reads transactions for a connected public wallet; it is not a token-specific live buy/sell/migration ledger.
- **Discovery filters:** the market board filters and sorts only on fields returned by its live provider. Creation time, bonding progress and social engagement are not shown without verified feeds.
