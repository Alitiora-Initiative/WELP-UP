
/**
 * Pure launchpad configuration rules shared by the creator UI and tests.
 * This module validates user-selected whole-token supply and decimal precision.
 * It does not build or submit transactions and does not imply a deployed program.
 */
export const MIN_TOTAL_SUPPLY_WHOLE = 1n;
export const MAX_TOTAL_SUPPLY_WHOLE = 1_000_000_000n;
export const SUPPORTED_TOKEN_DECIMALS = [0, 6, 9] as const;
export type SupportedTokenDecimals = (typeof SUPPORTED_TOKEN_DECIMALS)[number];
export const U64_MAX = (1n << 64n) - 1n;
const BPS_DENOMINATOR = 10_000n;
const EARLY_WALLET_LIMIT_BPS = 500n;

export type LaunchSupplyValidation =
  | {
      ok: true;
      wholeSupply: bigint;
      decimals: SupportedTokenDecimals;
      maxSupplyBaseUnits: bigint;
      earlyWalletLimitBaseUnits: bigint;
      earlyWalletLimitWholeTokens: string;
      earlyWindowPurchasesBlockedByGranularity: boolean;
    }
  | { ok: false; error: string };

/**
 * Accepts whole tokens, never a JavaScript floating-point amount.
 * 200000000 is one valid creator choice, not a platform-wide default.
 */
export function validateLaunchSupply(
  wholeSupplyInput: string,
  decimalsInput: number | null,
): LaunchSupplyValidation {
  const normalized = wholeSupplyInput.trim();
  if (!/^[0-9]+$/.test(normalized)) {
    return { ok: false, error: 'Enter a whole-number token supply.' };
  }

  const wholeSupply = BigInt(normalized);
  if (wholeSupply < MIN_TOTAL_SUPPLY_WHOLE) {
    return { ok: false, error: 'Supply must be greater than zero.' };
  }
  if (wholeSupply > MAX_TOTAL_SUPPLY_WHOLE) {
    return { ok: false, error: 'Maximum supply is 1,000,000,000 whole tokens.' };
  }
  if (
    decimalsInput === null ||
    !SUPPORTED_TOKEN_DECIMALS.some((value) => value === decimalsInput)
  ) {
    return { ok: false, error: 'Choose 0, 6, or 9 decimals.' };
  }

  const scale = 10n ** BigInt(decimalsInput);
  const maxSupplyBaseUnits = wholeSupply * scale;
  if (maxSupplyBaseUnits > U64_MAX) {
    return { ok: false, error: 'This supply and decimal combination exceeds the on-chain u64 limit.' };
  }

  // Floor the exact 5% basis-point calculation. Never use floating point.
  const earlyWalletLimitBaseUnits =
    (maxSupplyBaseUnits * EARLY_WALLET_LIMIT_BPS) / BPS_DENOMINATOR;

  return {
    ok: true,
    wholeSupply,
    decimals: decimalsInput,
    maxSupplyBaseUnits,
    earlyWalletLimitBaseUnits,
    earlyWalletLimitWholeTokens: formatBaseUnits(earlyWalletLimitBaseUnits, decimalsInput),
    // If 5% is below one indivisible token unit, early-window buys must fail;
    // do not round the limit up and silently exceed 5%.
    earlyWindowPurchasesBlockedByGranularity: earlyWalletLimitBaseUnits === 0n,
  };
}

/** Format raw SPL units without converting through floating point. */
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
