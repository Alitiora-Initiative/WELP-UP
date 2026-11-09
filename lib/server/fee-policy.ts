import 'server-only';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Proposed WELP economic policy and live Jupiter referral configuration.
 *
 * The arithmetic below models the requested 1% protocol fee, 0.5% creator fee,
 * 0.02% genesis allocation, and two-week 60/40 treasury split. These are policy
 * calculations only. They are not the live Jupiter referral rate or proof of
 * collection, direct payout, or epoch enforcement.
 */
export const WELP_FEE_POLICY = Object.freeze({
  network: 'solana-mainnet-beta',
  swapFeeBps: 100,
  creatorFeeBps: 50,
  genesisAllocationBps: 2,
  basisPointDenominator: 10_000,
  developerRecipient: 'ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG',
  epochDurationSeconds: 1_209_600,
  epochDeveloperReleaseBps: 6_000,
  epochPermanentReserveBps: 4_000,
  treasuryPdaSeed: 'treasury-v1',
  collectionDisabledReason: 'No WELP referral fee is configured; wallet-approved swaps remain available without a WELP fee.',
});

export type ReferralFeeConfig =
  | { kind: 'disabled' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'configured'; account: string; feeBps: number };

export function getReferralFeeConfig(environment: NodeJS.ProcessEnv = process.env): ReferralFeeConfig {
  const account = environment.WELP_REFERRAL_ACCOUNT?.trim() ?? '';
  if (!account) return { kind: 'disabled' };
  if (!BASE58.test(account)) return { kind: 'invalid', reason: 'WELP_REFERRAL_ACCOUNT is not a valid Solana address.' };

  const feeValue = environment.WELP_REFERRAL_FEE_BPS ?? '50';
  const feeBps = Number(feeValue);
  if (!Number.isInteger(feeBps) || feeBps < 50 || feeBps > 255) {
    return { kind: 'invalid', reason: 'WELP_REFERRAL_FEE_BPS must be an integer from 50 to 255.' };
  }

  return { kind: 'configured', account, feeBps };
}

export function splitProtocolSwapFee(grossInputBaseUnits: bigint) {
  if (grossInputBaseUnits <= 0n) {
    throw new RangeError('Gross swap input must be positive.');
  }
  const protocolFee =
    (grossInputBaseUnits * BigInt(WELP_FEE_POLICY.swapFeeBps)) / BigInt(WELP_FEE_POLICY.basisPointDenominator);
  const creatorFee =
    (grossInputBaseUnits * BigInt(WELP_FEE_POLICY.creatorFeeBps)) / BigInt(WELP_FEE_POLICY.basisPointDenominator);
  const netSwapInputBaseUnits = grossInputBaseUnits - protocolFee - creatorFee;
  if (protocolFee <= 0n) {
    throw new RangeError('Gross input is too small to express the protocol fee.');
  }
  return {
    grossInputBaseUnits,
    protocolFeeBaseUnits: protocolFee,
    creatorFeeBaseUnits: creatorFee,
    treasuryCreditBaseUnits: protocolFee,
    developerCreditBaseUnits: creatorFee,
    netSwapInputBaseUnits,
  };
}

export function calculateProtocolFees(transactionVolume: bigint) {
  if (transactionVolume <= 0n) throw new RangeError('Transaction volume must be positive.');
  const protocolFeeLamports =
    (transactionVolume * BigInt(WELP_FEE_POLICY.swapFeeBps)) /
    BigInt(WELP_FEE_POLICY.basisPointDenominator);
  const creatorFeeLamports =
    (transactionVolume * BigInt(WELP_FEE_POLICY.creatorFeeBps)) /
    BigInt(WELP_FEE_POLICY.basisPointDenominator);
  if (protocolFeeLamports === 0n) throw new RangeError('Volume is too small to express protocol fee.');
  if (protocolFeeLamports + creatorFeeLamports > transactionVolume) {
    throw new RangeError('Calculated fees exceed transaction volume.');
  }
  return {
    protocolFeeLamports,
    creatorFeeLamports,
    netVolumeLamports: transactionVolume - protocolFeeLamports - creatorFeeLamports,
  };
}

export function splitTreasuryEpoch(treasuryBaseUnits: bigint) {
  if (treasuryBaseUnits < 0n) {
    throw new RangeError('Treasury base units cannot be negative.');
  }
  const developerBaseUnits =
    (treasuryBaseUnits * BigInt(WELP_FEE_POLICY.epochDeveloperReleaseBps)) /
    BigInt(WELP_FEE_POLICY.basisPointDenominator);
  const reserveBaseUnits = treasuryBaseUnits - developerBaseUnits;
  return {
    treasuryBaseUnits,
    developerBaseUnits,
    reserveBaseUnits,
  };
}

export function splitGenesisAllocation(supplyBaseUnits: bigint) {
  if (supplyBaseUnits < 0n) {
    throw new RangeError('Supply base units cannot be negative.');
  }
  const developerBaseUnits =
    (supplyBaseUnits * BigInt(WELP_FEE_POLICY.genesisAllocationBps)) / BigInt(WELP_FEE_POLICY.basisPointDenominator);
  const creatorBaseUnits = supplyBaseUnits - developerBaseUnits;
  return { creatorBaseUnits, developerBaseUnits };
}
