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
export const PROTOCOL_SWAP_FEE_BPS = 50n; // 0.50% of gross swap input
export const TREASURY_EPOCH_DEVELOPER_BPS = 6_000n; // 60% of eligible accrued fees
export const TREASURY_EPOCH_RESERVE_BPS = 4_000n; // 40% permanently retained by policy

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

export type ProtocolSwapFeeRoute = {
  grossInputBaseUnits: bigint;
  protocolFeeBaseUnits: bigint;
  netSwapInputBaseUnits: bigint;
};

/**
 * Exact integer fee preview for a WELP-controlled swap:
 * 0.50% of gross input is credited to the protocol treasury. The separate
 * 14-day treasury epoch releases 60% of eligible new inflows and protects
 * the remaining 40% as reserve.
 *
 * This function only calculates amounts. It does not prove that a swap
 * occurred, sign a transaction, or collect funds. On-chain enforcement is
 * required before the website may submit mainnet swaps using this policy.
 */
export function calculateProtocolSwapFee(grossInputBaseUnits: bigint): ProtocolSwapFeeRoute {
  if (grossInputBaseUnits <= 0n) {
    throw new RangeError('Gross swap input must be positive.');
  }
  if (grossInputBaseUnits > U64_MAX) {
    throw new RangeError('Gross swap input exceeds the on-chain u64 limit.');
  }

  const protocolFeeBaseUnits =
    (grossInputBaseUnits * PROTOCOL_SWAP_FEE_BPS) / BASIS_POINTS_DENOMINATOR;
  if (protocolFeeBaseUnits === 0n) {
    throw new RangeError('Swap input is too small to express the 0.50% fee in base units.');
  }

  const netSwapInputBaseUnits = grossInputBaseUnits - protocolFeeBaseUnits;

  return {
    grossInputBaseUnits,
    protocolFeeBaseUnits,
    netSwapInputBaseUnits,
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
