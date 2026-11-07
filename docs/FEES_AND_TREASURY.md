# WELP UP protocol swap-fee policy

**Policy:** WELP charges **0.50% (50 basis points) of gross input** on each swap that executes through a WELP-controlled, fee-enforcing swap instruction.

The fee is calculated before the swap from the input asset's raw base-unit amount:

\[
\text{protocol fee}=\left\lfloor\frac{\text{gross input}\times 50}{10,000}\right\rfloor
\]

There is no separate fixed $0.10 trade fee, $0.10 transfer fee, or $0.50 token-launch creation fee under this policy. The old creator-configurable 0–3% fee is also removed. This fee is not 0.5% of a creator fee; it is 0.5% of gross swap input.

## Allocation

The fee is split once:

| Recipient | Share of protocol fee |
|---|---:|
| Developer/operator | 60% |
| WELP protocol treasury | 40% |

The published developer receiving address is:

ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG

It is a public receiving address, not a private key or signing credential. The 40% treasury allocation belongs to the WELP treasury; it is not an additional developer payment. Any future treasury release policy must not split the same amount a second time.

## Scope and limitations

The fee applies only to swaps that actually pass through a WELP-controlled on-chain instruction. WELP cannot intercept or tax arbitrary wallet transfers or swaps routed directly through another DEX program without invoking WELP.

The fee is assessed on the gross input asset. For a SOL-in swap it is denominated in lamports; for an SPL-token-in swap it is denominated in that token's raw base units. Integer math must use checked arithmetic and an explicitly defined rounding direction. A route whose fee rounds to zero base units must be rejected or governed by a separately reviewed minimum-fee rule; it must not silently charge a different percentage.

## Atomic enforcement requirements

A successful swap and its fee transfers must be one Solana transaction. If either fee leg, the swap CPI, or any account validation fails, the entire transaction must roll back. The on-chain program must:

1. Validate the exact mainnet program IDs, source mint, source token account, token program, signer and destination accounts.
2. Derive the developer and treasury token accounts for the actual input mint; do not accept arbitrary fee destinations from the caller.
3. Calculate exactly 50 basis points from gross input using checked integer arithmetic.
4. Transfer 60% of the fee to the published developer recipient and 40% to the treasury PDA's token account.
5. Bind an operation receipt/nonce to the payer and swap so an operation cannot be charged twice.
6. Emit an event recording the payer, input mint, gross input, fee amount, both recipient amounts and slot.
7. Display the 0.50% fee, amount and recipient split before the wallet is asked to sign.

No browser setting or server-side flag is sufficient to enforce the fee. The program must verify and execute it on-chain.

## Current implementation status

The TypeScript policy and integer fee calculation are defined in source. This is not proof of fee collection.

The current Anchor welp_launchpad crate is **not deployed on Solana mainnet** and has no production deployment keypair. Its sample program ID must not be used to derive a payment address. The current source does not yet have a production bonding-curve swap instruction or a composable Jupiter swap CPI with both fee transfers. The application order and execute endpoints therefore remain fail-closed; they do not submit mainnet swaps that omit the protocol fee.

The previous fixed-amount USDC supported-transfer path is being removed from the on-chain source; this policy does not charge direct SPL transfers. No fees are currently collected by WELP.

## Treasury release and upgrade authority

The existing treasury design uses a 14-day epoch and a 60/40 allocation model. The final deployed program must specify whether the 60% operator allocation is transferred at fee collection or at epoch maturity; this must be implemented exactly once, not duplicated. The 40% treasury reserve must remain separately accounted and protected.

A program-controlled reserve is not permanently inaccessible while the program remains upgradeable by a privileged upgrade authority. Before public launch, either revoke upgrade authority after independent review or publish the exact multisig governance and its powers.

## Network and third-party costs

Solana network fees, priority fees, account rent, DEX routing fees and pool-creation costs are separate from the WELP protocol fee. They must be shown separately when applicable and must never be presented as WELP revenue.

## Release gates

Mainnet fee collection stays disabled until all of these are complete: production program ID and deployed binary are verified; SBF and ProgramTest checks pass; the actual swap instruction composes both fee transfers atomically; wrong mint/account/authority, insufficient funds, replay and rollback tests pass; the deployed IDL and upgrade authority are verified; and an independent Solana/Anchor security review is complete.
