# WELP UP fee and treasury policy

**Status: policy configured in backend source; on-chain collection remains disabled pending implementation, deployment and verification.**

## Fixed policy

All amounts are denominated in mainnet USDC (mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v, six decimals):

| Operation | Total | 60% developer/operator | 40% protocol treasury |
|---|---:|---:|---:|
| Each supported trade | $0.10 USDC | $0.06 | $0.04 |
| Each supported transfer | $0.10 USDC | $0.06 | $0.04 |
| Token launch creation | $0.50 USDC | $0.30 | $0.20 |

The developer/operator fee destination is the newly supplied public Solana wallet:

ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG

No old or compromised destination is authorized by this policy. The address is a public receiving address; it is not a private key and must never be treated as a signing credential.

## Treasury PDA

The protocol treasury is intended to be a program-derived address (PDA) under the WELP Anchor program using the seed treasury-v1. A PDA is not a separate program ID. The program ID must be generated from a securely held deployment keypair, then the treasury PDA can be derived deterministically from that verified program ID.

The current Anchor program ID is an undeployed placeholder. Therefore the treasury PDA does not yet have a valid production address. Do not accept payments to a guessed address and do not put a fabricated address in the interface.

## On-chain enforcement requirements

The Rust program, not browser JavaScript or a mutable web server setting, must enforce the fixed fee amounts and split. The $0.10 USDC trade fee, $0.10 USDC supported-transfer fee, $0.50 USDC launch-creation fee, and 60/40 split are fixed protocol constants—not operator-adjustable runtime settings. Charge each qualifying operation exactly once and atomically with that operation. The backend may build a transaction for a connected wallet to review and sign, but it must not custody a user's signing key.

Before fees are enabled:
1. Create the treasury PDA and its USDC associated token account.
2. Verify the developer USDC associated token account is owned by the exact developer recipient above.
3. Validate the canonical USDC mint and Token Program owner.
4. Transfer 60% and 40% atomically in the same transaction as the operation being charged.
5. Bind a unique operation/receipt nonce to prevent replay and duplicate charging.
6. Reject a charged operation if the fee transfer cannot complete; reject a fee-only payment that is not tied to a supported operation.
7. Emit an on-chain event containing payer, operation kind, amount, both fee destinations, and timestamp/slot context.
8. Display the exact fee and recipient split before wallet signing.
9. Test under SBF ProgramTest, adversarial account substitution, replay, missing ATA, wrong mint, wrong token program, insufficient balance and transaction rollback.
10. Verify the deployed program binary and upgrade authority before enabling the frontend.

## Creator rewards

Creator rewards are a separate accounting stream. No reward percentage is enabled by this policy. A creator reward may only be paid from an explicitly configured share of the relevant launch's trading or protocol revenue, with on-chain attribution, claim accounting and replay protection. It must never be taken from user safe balances or silently reduce the fixed 60/40 split.

## Network costs

Solana transaction fees and rent-exemption deposits are not WELP revenue. Rent is paid to create accounts and remains governed by Solana account lifecycle rules. Third-party DEX, routing or priority fees are separate and must be disclosed.

## Current enforcement status

The backend policy module contains the fixed amounts and developer destination. The current Jupiter /order + /execute path returns an assembled transaction that WELP cannot safely modify after the fact. A fee must not be described as collected on that path until the trade flow is migrated to a composable transaction path or another reviewed atomic mechanism. Vault deposits/withdrawals and launchpad instructions must enforce their fees inside the same on-chain instruction transaction.

**Until those changes are deployed and verified, fees are configured as policy but not collected.**


## Separate creator-configured fee model

A separate planned launchpad creator fee is specified in [TREASURY_AND_CREATOR_FEES.md](./TREASURY_AND_CREATOR_FEES.md). It is selectable per launch from 0% to 3% and applies only to eligible trades that pass through a supported WELP route. The proposed 0.5% treasury share is 0.5% **of the creator-fee amount**, not 0.5% of gross swap volume; the remaining creator-fee amount is the creator reward.

This creator-fee model is separate from the fixed USDC policy above. The fixed USDC charges must not be duplicated or silently replaced by the creator-fee slider. Neither creator-fee transfers nor the existing fixed fee collection are currently active on-chain. The current Anchor treasury crate has only the treasury state/disbursal instructions and a tested fee calculation helper; no live swap instruction calls it yet.
