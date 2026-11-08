import 'server-only';

/**
 * Canonical WELP mainnet swap-fee policy.
 *
 * The fee is 0.50% of gross input on each WELP-controlled swap.
 * The full fee is credited to treasury; after a 14-day epoch, 60% of
 * eligible new inflows is released to the developer and 40% remains reserved.
 * This server module is a policy reference, not on-chain enforcement.
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
  collectionDisabledReason: 'Trading remains disabled until a valid server-owned Jupiter referral account and 0.50%–2.55% fee are configured.',
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
