# WELP UP! — Production build blueprint

**Current status:** mainnet-only product target. This document supersedes older implementation notes in this file. Do not follow the legacy bot setup-fee, creator-profit-share, Devnet, Testnet, Localnet or sample-payout instructions recorded in older progress logs.

## Binding production requirements

- Solana Mainnet-Beta is the only deployment and transaction target. No non-mainnet deployment or transaction test is part of the product release path.
- No simulations, paper trading, generated prices, fabricated balances, sample token launches, synthetic volume or unverified program/account addresses may be presented as live product data.
- Users connect compatible external Solana wallets through Wallet Standard. The app must never request, receive, store, transmit or log private keys, seed phrases or wallet exports.
- Every money-moving transaction requires an explicit review and signature by the user's connected wallet. Connection alone does not grant a bot or server transaction authority.
- No AI agent or server may receive a user's wallet secret. Any future execution authority must be narrowly scoped, revocable and enforced by a verified on-chain program.
- Mainnet program ID, bytecode, IDL, upgrade authority, account ownership, mint and recipient accounts must be verified directly on mainnet before any corresponding UI action can be enabled.
- Missing, stale, unverified or unsupported infrastructure must fail closed and be described accurately.

## Current application capabilities

- Live Solana token/market reads and deterministic risk/signal evaluation from retrieved feed data.
- Mainnet-only Wallet Standard discovery and connection.
- Wallet balance and confirmed transaction-signature reads.
- Jupiter order preparation and user-signed execution interface. Current order/execute endpoints remain fail-closed because the WELP 0.50% protocol fee is not yet enforced atomically on-chain.
- Browser-local automation policies that scan the live Jupiter market feed while the Automation page remains open. When a real server-side model is configured, one new match can receive read-only AI review. This does not create, sign or submit a trade and is not a persistent background agent.
- Launchpad route with token parameter validation and actual program/indexer release status. It is not a token-mint or buy/sell transaction service yet.

## Current protocol fee policy

WELP's target fee is **0.50% (50 bps) of gross input** for a swap that executes through a WELP-controlled, fee-enforcing on-chain instruction.

At collection, 100% of the fee must be credited to treasury in the same atomic transaction as the swap. After at least 14 days, the treasury program releases 60% of eligible new SOL fee inflows to the published developer recipient and retains 40% as protected reserve. The split occurs once at epoch maturity.

The former $0.10 bot setup fee, fixed $0.10/$0.50 USDC charges and 0–30% creator-profit-share design are superseded and must not be reintroduced.

The current treasury vault is a SOL System Program PDA, not a generic SPL-token vault. SPL-token input fees require per-mint treasury token accounts and token-program CPI settlement that are not implemented. Current Rust/TypeScript fee helpers calculate values only; they do not collect funds.

## Launchpad implementation status

The checked-in Anchor launchpad crate currently contains treasury initialization/distribution logic and a pure 50-bps fee calculation helper. It does not implement production token mint initialization, supply minting and authority revocation, launch-state accounts, bonding-curve buys/sells, quote escrow, refunds, graduation, Raydium CPMM creation, LP burn or a live event indexer.

The checked-in program ID is not a verified production deployment ID and has no production deployment keypair associated with it. Do not derive payment addresses from it or send assets to its PDAs.

The current UI is intentionally a configuration/status page. It must remain disabled for minting and trading until the full on-chain path is implemented, compiled, independently audited, deployed to mainnet, source-verified and exercised with explicit wallet signatures.

The previously proposed 85 SOL graduation milestone, 25–187.5 lamports-per-whole-token curve endpoints and creator-selected supply range do not produce a consistent graduation rule for every supply. The sale/funding economics must be resolved mathematically before any buy instruction is enabled. Do not invent replacement parameters.

## AI automation and agent boundaries

The current AI automation watch uses real market-feed matches and a read-only analyst response. It can only run while the browser page remains open. Saved rules and review cooldowns are browser-local. The Vercel project currently has no server-side AI environment variables configured; the analyst must report unavailable until a real API key and model are configured.

Autonomous trading is not implemented. Do not add unattended trade submission until the vault and swap program enforce per-user allocations, token allowlists, expiry/nonces, price/slippage bounds, pause/revoke, owner recovery and accounting; then perform an independent security review and separate mainnet release approval.

## Mainnet-only release checklist

1. Generate a production program keypair securely outside this repository and keep its secret out of ChatGPT, GitHub and Vercel source files.
2. Implement the complete token mint, launch state, curve, escrow, buy/sell, refund, fee, event and graduation instructions.
3. Support only explicitly reviewed input assets. For SPL-token input, create and validate per-mint treasury token accounts and token CPI settlement; do not treat the SOL vault as a generic token vault.
4. Build the reviewed source and IDL reproducibly with the pinned Anchor/SBF toolchain.
5. Pass formatting, lint, typecheck, application build, Rust unit/Clippy/host tests, SBF build, SBF-backed ProgramTest, arithmetic/invariant and adversarial account-composition checks.
6. Complete an independent Solana/Anchor audit and remediate all critical/high findings.
7. Deploy only to Solana Mainnet after audit and explicit release review. Verify deployed bytecode/source, IDL, program ID, upgrade authority, treasury accounts and configuration directly from mainnet.
8. Run only controlled, user-authorized mainnet checks after deployment verification. Every real transaction must be explicitly reviewed and signed by the user.
9. Enable a UI action only when its backing mainnet instruction is deployed, verified, audited and covered by passing tests.

## References

- [README](README.md)
- [Roadmap](ROADMAP.md)
- [Production readiness](docs/PRODUCTION_READINESS.md)
- [Launchpad protocol specification](docs/LAUNCHPAD_PROTOCOL_SPEC.md)
- [Launchpad and security backlog](docs/LAUNCHPAD_AND_SECURITY_BACKLOG.md)
- [Fee and treasury policy](docs/FEES_AND_TREASURY.md)
- [Treasury epoch design](docs/TREASURY_AND_CREATOR_FEES.md)
- [Whitepaper](WHITEPAPER.md)
