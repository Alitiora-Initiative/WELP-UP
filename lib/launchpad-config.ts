/**
 * Exact, client-side launch parameter validation.
 *
 * These helpers are previews only; the Anchor program must repeat every
 * validation and must be the authority for all token/fee accounting.
 */
export const MIN_TOTAL_SUPPLY_WHOLE = 0n;
export const MAX_TOTAL_SUPPLY_WHOLE = 1_000_000_000n;
export const SUPPORTED_TOKEN_DECIMALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type SupportedTokenDecimals = (typeof SUPPORTED_TOKEN_DECIMALS)[number];

export const U64_MAX = (1n << 64n) - 1n;
export const BASIS_POINTS_DENOMINATOR = 10_000n;
export const MAX_CREATOR_FEE_BPS = 300;
export const TREASURY_SHARE_OF_CREATOR_FEE_BPS = 50n;

export type LaunchSupplyValidation =
  | {
      ok: true;
      wholeSupply: bigint;
      decimals: SupportedTokenDecimals;
      launchable: boolean;
      maxSupplyBaseUnits: bigint;
      earlyWalletLimitBaseUnits: bigint;
      earlyWalletLimitWholeTokens: string;
      earlyWindowPurchasesBlockedByGranularity: boolean;
    }
  | { ok: false; error: string };

export type CreatorFeeRoute = {
  creatorFeeLamports: bigint;
  treasuryShareLamports: bigint;
  creatorRewardLamports: bigint;
  nextRemainder: bigint;
};

/**
 * Accepts whole tokens, never a JavaScript floating-point amount.
 * Zero is previewable but is not a launchable mint/sale.
 * 200000000 is one valid creator choice, not a platform-wide default.
 */
export function validateLaunchSupply(
  wholeSupplyInput: string,
  decimalsInput: number | null,
): LaunchSupplyValidation {
  const normalized = wholeSupplyInput.trim();
  if (normalized.length === 0 || normalized.length > 10) {
    return { ok: false, error: 'Enter a whole-number supply with at most 10 digits.' };
  }
  if (!/^[0-9]+$/.test(normalized)) {
    return { ok: false, error: 'Enter a whole-number token supply.' };
  }

  const wholeSupply = BigInt(normalized);
  if (wholeSupply < MIN_TOTAL_SUPPLY_WHOLE) {
    return { ok: false, error: 'Supply must be a non-negative whole number.' };
  }
  if (wholeSupply > MAX_TOTAL_SUPPLY_WHOLE) {
    return { ok: false, error: 'Maximum supply is 1,000,000,000 whole tokens.' };
  }
  if (
    decimalsInput === null ||
    !Number.isInteger(decimalsInput) ||
    decimalsInput < 0 ||
    decimalsInput > 9
  ) {
    return { ok: false, error: 'Choose a decimal precision from 0 through 9.' };
  }

  const decimals = decimalsInput as SupportedTokenDecimals;
  const scale = 10n ** BigInt(decimals);
  const maxSupplyBaseUnits = wholeSupply * scale;
  if (maxSupplyBaseUnits > U64_MAX) {
    return { ok: false, error: 'This supply and decimal combination exceeds the on-chain u64 limit.' };
  }

  // Floor the exact 5% basis-point calculation. Never use floating point.
  const earlyWalletLimitBaseUnits =
    (maxSupplyBaseUnits * 500n) / BASIS_POINTS_DENOMINATOR;

  return {
    ok: true,
    wholeSupply,
    decimals,
    launchable: wholeSupply > 0n,
    maxSupplyBaseUnits,
    earlyWalletLimitBaseUnits,
    earlyWalletLimitWholeTokens: formatBaseUnits(earlyWalletLimitBaseUnits, decimals),
    // If 5% is below one indivisible token unit, early-window buys must fail;
    // do not round the cap up and silently exceed 5%.
    earlyWindowPurchasesBlockedByGranularity: wholeSupply > 0n && earlyWalletLimitBaseUnits === 0n,
  };
}

/**
 * Creator fee is a 0–3% rate on an eligible WELP-routed swap volume.
 * The treasury receives 0.5% of the *creator-fee amount*, not 0.5% of gross
 * volume. The remainder is the creator reward. Carrying the remainder makes
 * the cumulative split exact at lamport precision over repeated collections.
 *
 * This is a calculation helper only. It does not prove that a swap occurred,
 * sign a transaction, or move funds.
 */
export function calculateCreatorFeeRoute(
  swapVolumeLamports: bigint,
  creatorFeeBps: number,
  priorRemainder = 0n,
): CreatorFeeRoute {
  if (swapVolumeLamports < 0n) throw new RangeError('Swap volume cannot be negative.');
  if (
    !Number.isInteger(creatorFeeBps) ||
    creatorFeeBps < 0 ||
    creatorFeeBps > MAX_CREATOR_FEE_BPS
  ) {
    throw new RangeError('Creator fee must be an integer from 0 to 300 basis points.');
  }
  if (priorRemainder < 0n || priorRemainder >= BASIS_POINTS_DENOMINATOR) {
    throw new RangeError('Fee-share remainder must be between 0 and 9,999.');
  }

  const creatorFeeLamports =
    (swapVolumeLamports * BigInt(creatorFeeBps)) / BASIS_POINTS_DENOMINATOR;
  const shareNumerator =
    creatorFeeLamports * TREASURY_SHARE_OF_CREATOR_FEE_BPS + priorRemainder;
  const treasuryShareLamports = shareNumerator / BASIS_POINTS_DENOMINATOR;
  const nextRemainder = shareNumerator % BASIS_POINTS_DENOMINATOR;
  const creatorRewardLamports = creatorFeeLamports - treasuryShareLamports;

  return {
    creatorFeeLamports,
    treasuryShareLamports,
    creatorRewardLamports,
    nextRemainder,
  };
}

/** Format raw units without converting through floating point. */
export function formatBaseUnits(amount: bigint, decimals: number): string {
  if (amount < 0n) throw new RangeError('Token amount cannot be negative.');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new RangeError('Decimals must be an integer from 0 to 9.');
  }
  if (decimals === 0) return amount.toString();

  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, '0');
  const trimmedFraction = fraction.replace(/0+$/, '');
  return trimmedFraction.length > 0
    ? whole.toString() + '.' + trimmedFraction
    : whole.toString();
}
