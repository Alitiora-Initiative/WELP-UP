# WELP UP treasury and protocol swap-fee design

**Status:** treasury state and the 14-day distribution math exist in the local Anchor source. The deployed mainnet treasury, launch swap instruction, atomic fee transfers and event indexer do not exist. No fee is currently collected and no distribution has occurred.

## 1. Protocol fee

Every swap that passes through a WELP-controlled, fee-enforcing instruction is charged **0.50% (50 bps) of gross input**:

\[
\text{fee}=\left\lfloor\frac{\text{gross input}\times 50}{10,000}\right\rfloor
\]

The fee is calculated in the input asset's raw base units. The former creator-configurable 0–3% fee, the 0.5%-of-creator-fee model and the fixed $0.10/$0.50 USDC charges are removed.

The fee allocation is 60% developer/operator and 40% WELP protocol treasury, applied exactly once. The public developer destination is ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG; it is a receiving address only, not a signing key.

WELP cannot intercept arbitrary swaps sent directly to another DEX or wallet program. Only WELP-controlled swap instructions can enforce this fee.

## 2. Atomic fee settlement

A live swap must calculate the fee from gross input and execute the swap plus both fee transfers in a single transaction. A failure in any leg rolls back the entire transaction. The fee recipient token accounts must be derived for the actual input mint; the program must not accept caller-selected destination accounts.

Each operation requires a unique receipt or nonce, checked integer math, validated token program/mint/authority, and an event with payer, input mint, gross input, fee amount, split and slot. The wallet review must show the fee and recipients before signing.

The current helper in lib/launchpad-config.ts and the Rust math primitive are calculations only; neither moves funds. The Jupiter /order + /execute integration does not allow WELP to append arbitrary instructions after the order has been assembled. A composable transaction-building route and a production on-chain settlement instruction are required before trade execution can be enabled.

## 3. Treasury account and epoch

The existing local Anchor design derives a state PDA from the treasury-v1 seed and a SOL System Program vault PDA from the treasury-vault-v1 seed. A successful epoch release requires at least 1,209,600 seconds (14 days) since the stored distribution timestamp. Clock reversal is rejected.

The 40% reserve must be separately accounted and protected from later disbursements. The deployed policy must specify whether the 60% developer allocation is transferred at collection time or at epoch maturity. The same fee must never be split twice.

**Important asset limitation:** the current treasury vault is a SOL System Program PDA. It is not a generic SPL-token vault. A 0.50% fee on an SPL-token input requires a token account owned by the treasury PDA for that exact mint (and a verified developer recipient account for that mint). That generic token-account path is not implemented. No arbitrary token should be transferred into an unverified or guessed address.

The checked-in launchpad program ID is a sample local ID, not a deployed mainnet ID. There is no production keypair associated with it. Do not derive deposit or payment addresses from it.

## 4. Launchpad and liquidity routes

The current launchpad page validates token configuration, but the Anchor crate does not yet implement mint creation, supply authority revocation, bonding-curve buys/sells, buyer escrow, refunds, graduation or Raydium CPMM pool creation/LP burn. The creator fee slider has been removed because it described an unimplemented, incompatible fee route.

Post-graduation swaps routed directly through Raydium do not execute WELP's bonding-curve instruction. WELP must not claim to tax those swaps unless a supported on-chain fee path actually receives and splits the fees. Third-party creator-fee configuration does not automatically direct proceeds to WELP's treasury.

The creator-supply and graduation economics still require a final, consistent funding-goal decision. The current 85 SOL milestone and fixed price endpoints cannot be reached by every creator-selected supply; do not enable launches using an invented curve assumption.

## 5. Mainnet release gates

- Generate a production program ID from a securely held deployment keypair. Do not expose the private key.
- Implement real mint creation, supply minting and authority revocation, launch-state and escrow PDAs, bonding-curve buy/sell and refund logic.
- Implement 50-bps fee transfers for SOL and each supported SPL input mint, with exact 60/40 accounting, receipt replay protection and event emission.
- Integrate the swap program through a composable transaction path; validate all invoked program IDs and accounts.
- Build the reviewed source with the pinned Anchor/SBF toolchain; run unit, adversarial and SBF-backed ProgramTest cases.
- Verify deployed program binary, IDL, upgrade authority, PDAs, recipient accounts and treasury token accounts on mainnet.
- Complete an independent Solana/Anchor security audit and remediate findings before accepting real funds.

No Devnet-only or simulated transaction is evidence of mainnet readiness. Mainnet collection remains disabled until the exact production path above is deployed and verified.
