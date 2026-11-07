import 'server-only';

/**
 * Canonical WELP mainnet swap-fee policy.
 *
 * The fee is 0.50% of gross input on each WELP-controlled swap.
 * 60% routes to the published developer recipient and 40% to the treasury.
 * This server module is a policy reference, not on-chain enforcement.
 */
export const WELP_FEE_POLICY = Object.freeze({
  network: 'solana-mainnet-beta',
  swapFeeBps: 50,
  basisPointDenominator: 10_000,
  developerRecipient: 'ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG',
  developerShareBps: 6_000,
  treasuryShareBps: 4_000,
  treasuryPdaSeed: 'treasury-v1',
  collectionEnabled: false,
  collectionDisabledReason:
    'The mainnet launchpad program has not been deployed and verified with atomic 0.50% swap-fee enforcement.',
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
  const developer =
    (totalFee * BigInt(WELP_FEE_POLICY.developerShareBps)) /
    BigInt(WELP_FEE_POLICY.basisPointDenominator);
  const treasury = totalFee - developer;
  return {
    grossInputBaseUnits,
    totalFeeBaseUnits: totalFee,
    developerFeeBaseUnits: developer,
    treasuryFeeBaseUnits: treasury,
    netSwapInputBaseUnits: grossInputBaseUnits - totalFee,
  };
}
