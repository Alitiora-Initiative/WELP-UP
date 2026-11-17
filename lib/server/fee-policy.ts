import 'server-only';

/**
 * Configuration policy for the Jupiter referral fee on WELP-routed swaps.
 *
 * This is not an on-chain fee or treasury settlement. A correctly shaped
 * referral account only enables requesting fee-bearing quotes; each Jupiter
 * order must return the configured fee rate before it is shown for signing.
 * The separate 60/40 epoch math is a design reference, not implemented here.
 */
export const WELP_FEE_POLICY = Object.freeze({
  network: 'solana-mainnet-beta',
  swapFeeBps: 50,
  basisPointDenominator: 10_000,
  developerRecipient: 'ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG',
  epochDurationSeconds: 1_209_600,
  epochDeveloperReleaseBps: 6_000,
  epochPermanentReserveBps: 4_000,
  treasuryPdaSeed: 'treasury-v1',
  referralAccount: process.env.WELP_REFERRAL_ACCOUNT ?? '',
  referralFeeBps: Number(process.env.WELP_REFERRAL_FEE_BPS ?? 50),
  collectionEnabled:
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(process.env.WELP_REFERRAL_ACCOUNT ?? '') &&
    Number.isInteger(Number(process.env.WELP_REFERRAL_FEE_BPS ?? 50)) &&
    Number(process.env.WELP_REFERRAL_FEE_BPS ?? 50) >= 50 &&
    Number(process.env.WELP_REFERRAL_FEE_BPS ?? 50) <= 255,
  collectionDisabledReason: 'No WELP Jupiter referral account is configured; WELP swap order and execution routes fail closed until an account is configured and fee-bearing orders are validated.',
});

export function splitProtocolSwapFee(grossInputBaseUnits: bigint) {
  if (grossInputBaseUnits <= 0n) {
    throw new RangeError('Gross swap input must be positive.');
  }
  const totalFee =
    (grossInputBaseUnits * BigInt(WELP_FEE_POLICY.swapFeeBps)) /
    BigInt(WELP_FEE_POLICY.basisPointDenominator);
  if (totalFee <= 0n) {
    throw new RangeError('Gross input is too small to express the protocol fee.');
  }
  return {
    grossInputBaseUnits,
    totalFeeBaseUnits: totalFee,
    treasuryCreditBaseUnits: totalFee,
    netSwapInputBaseUnits: grossInputBaseUnits - totalFee,
  };
}
