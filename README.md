# WELP UP

**WELP UP is an independent Solana application for market discovery, wallet-approved trading, user-created on-chain safes, token launches and portfolio intelligence.**

- Website: https://welpup.fun/
- Repository: https://github.com/Alitiora-Initiative/WELP-UP
- Network: Solana Mainnet-Beta for supported live data and wallet-approved operations

## Product

1. **Markets** — live Solana token and pool discovery.
2. **Signals** — deterministic scoring with visible rules and blockers.
3. **Trade desk** — swap preparation, fee disclosure and explicit wallet approval.
4. **Personal safes** — each user creates and controls their own on-chain safe, chooses what to fund and signs its setup, permissions, deposits and withdrawals. The application operator has no user seed phrase or unilateral signing key.
5. **Launchpad** — creator-configured token supply and decimals, verified mint creation, launch records, market discovery and creator-reward accounting.
6. **Portfolio** — wallet-derived balances, transaction history, allocation and P&L only where the underlying data supports a defensible calculation.
7. **Security Lab** — reproducible static analysis, dependency scanning, adversarial tests and AI-assisted review with evidence-linked findings.

## Important implementation status

The existing app has live public market reads, wallet connection and RPC-derived wallet history. Swap order and execution endpoints are now deliberately fail-closed until the disclosed fee can be included atomically in the wallet-approved transaction.

The Anchor vault program remains an unlaunched scaffold. Its current program ID is a placeholder; it has not been deployed or independently audited. Automated swaps, fee settlement and production launchpad operations are not enabled. Do not deposit funds into a purported WELP safe until the exact mainnet program, source, upgrade authority, instructions, fees and security review are independently verified.

No fake token listings, simulated volume, placeholder transactions, fabricated balances, TVL, performance, audit scores or P&L are permitted. Empty or unavailable data must be shown as empty or unavailable.

## User-controlled safe model

WELP is software and protocol infrastructure, not a bank. Users create their own personal safe and sign every setup, permission, funding, withdrawal and other supported operation with their connected wallet. Assets deposited into a safe reside in a program-derived on-chain account and are governed by the deployed program's code; they are not held in a WELP operator wallet. Users must inspect the program, its permissions, upgrade authority and terms before funding. No server or AI agent may receive a user's seed phrase or private key.

A wallet signature is meaningful authorization. Users should inspect each transaction's program IDs, account addresses, amounts, fee recipients and permissions before signing.

## Fees and treasury

The target fee schedule is documented in docs/FEES_AND_TREASURY.md:

- 0.10 USD-equivalent per supported trade or transfer.
- 0.50 USD-equivalent launchpad creation fee.
- 60% of protocol fees to the published developer/operator wallet.
- 40% to the WELP protocol treasury PDA.
- Creator rewards are a separately accounted stream and may only be paid from a disclosed, funded creator allocation.

The configured developer fee destination is a public Solana address, not a signing key. Fee collection remains disabled until the treasury PDA, stablecoin accounts, atomic transaction composition, on-chain enforcement and user disclosures are implemented and verified. The website must never silently deduct a fee.

## Security rules

- Never request, accept, store, transmit or log seed phrases, private keys or wallet exports.
- All money-moving actions require explicit wallet authorization.
- Server-side configuration and provider credentials must not use browser-exposed environment variables.
- Program IDs, mint addresses, token-program IDs and account ownership must be validated on-chain.
- Fee transfers must be atomic with the operation they charge for and visible in the wallet prompt.
- The on-chain program is the source of truth for fees and treasury accounting; the backend may prepare transactions but cannot override protocol rules.
- Missing program IDs, stale quotes, unavailable data, failed checks or unverified accounts must fail closed.
- An AI-generated security finding is a hypothesis until independently reproduced. AI review is not an independent audit.

## Architecture

- app/ — Next.js App Router pages and API routes.
- components/ — application UI and wallet components.
- lib/ — market, wallet, risk and protocol client logic.
- programs/vault/ — Anchor/Rust on-chain program scaffold.
- programs/vault-checks/ — host-side pure Rust invariants.
- docs/ — protocol design, threat models, release gates, fee policy and runbooks.

## Local development

Requirements: Node.js and npm. Install dependencies with npm ci, start the development server with npm run dev, and run npm run lint, npm run typecheck and npm run build before submitting changes.

Run the relevant test suite for every changed subsystem. Anchor/SBF builds, ProgramTest, static analysis, independent audits and deployment verification must be reported separately. A green frontend build is not proof that an on-chain program is safe.

Keep provider credentials server-side. Never commit wallet secrets, private keys, seed phrases, RPC credentials or API tokens.

## Mainnet release gates

Before enabling any new fund-moving instruction:

1. Build the reviewed Anchor source and generate the IDL.
2. Run unit, SBF-backed ProgramTest, adversarial account-composition and invariant tests.
3. Run dependency and static-analysis tools and remediate findings.
4. Generate and verify a deployment keypair securely outside chat; never expose its secret key.
5. Deploy to Devnet first, then verify the program ID, binary, upgrade authority and configuration.
6. Verify fee recipient, treasury PDA, token accounts, fee splits and atomic settlement.
7. Complete independent Solana/Anchor review before public deposits or automated execution.
8. Publish transaction-level evidence and accurate status before enabling the UI.

## Risk disclosure

Digital assets are volatile and can lose all value. Transactions may be irreversible. Quotes, liquidity and token metadata may be incomplete or manipulated. WELP does not promise profit, capital protection, liquidity or uninterrupted operation. Nothing in the interface is investment, legal, tax or accounting advice.
