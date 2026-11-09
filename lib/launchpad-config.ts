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
/** 1% of gross launch/purchase volume -> Official Project Treasury Wallet. */
export const PROTOCOL_SWAP_FEE_BPS = 100n;
/** 0.5% of gross volume -> Liquid Private Developer Wallet. */
export const CREATOR_FEE_BPS = 50n;
/** 0.02% of the genesis mint -> Private Developer Wallet pre-launch allocation. */
export const GENESIS_DEV_ALLOCATION_BPS = 2n;
/** 60% of accumulated treasury inflows -> Liquid Developer Wallet after a 14-day epoch. */
export const TREASURY_EPOCH_DEVELOPER_BPS = 6_000n;
/** 40% retained in the treasury as the permanent protocol stability reserve. */
export const TREASURY_EPOCH_RESERVE_BPS = 4_000n;
/** Two-week treasury epoch, in seconds (14 days). */
export const TREASURY_EPOCH_SECONDS = 1_209_600;

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

/**
 * Validate a creator's whole-token supply and derive its exact raw mint amount.
 * The chain program must repeat these checks; this helper never creates a mint.
 */
export function validateLaunchSupply(
  rawSupply: string,
  decimals: number | null,
): LaunchSupplyValidation {
  const input = rawSupply.trim();
  if (!/^\d+$/.test(input)) {
    return { ok: false, error: 'Enter a whole-token supply using digits only.' };
  }
  if (
    decimals === null ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 9 ||
    !SUPPORTED_TOKEN_DECIMALS.includes(decimals as SupportedTokenDecimals)
  ) {
    return { ok: false, error: 'Choose mint precision from 0 through 9 decimals.' };
  }

  // Normalize leading zeroes and reject excessive input before BigInt parsing.
  const normalizedSupply = input.replace(/^0+(?=\d)/, '');
  if (normalizedSupply.length > MAX_TOTAL_SUPPLY_WHOLE.toString().length) {
    return { ok: false, error: 'Total supply cannot exceed one billion whole tokens.' };
  }

  const wholeSupply = BigInt(normalizedSupply);
  if (wholeSupply > MAX_TOTAL_SUPPLY_WHOLE) {
    return { ok: false, error: 'Total supply cannot exceed one billion whole tokens.' };
  }

  const scale = 10n ** BigInt(decimals);
  const maxSupplyBaseUnits = wholeSupply * scale;
  if (maxSupplyBaseUnits > U64_MAX) {
    return { ok: false, error: 'Raw mint supply exceeds the on-chain u64 limit.' };
  }

  // The early-window cap is 5% of supply, rounded down to whole base units.
  // A cap below one whole token is preserved as-is and blocks early purchases.
  const earlyWalletLimitBaseUnits = (maxSupplyBaseUnits * 500n) / BASIS_POINTS_DENOMINATOR;
  const earlyWindowPurchasesBlockedByGranularity =
    wholeSupply > 0n && earlyWalletLimitBaseUnits < scale;

  return {
    ok: true,
    wholeSupply,
    decimals: decimals as SupportedTokenDecimals,
    launchable: wholeSupply > MIN_TOTAL_SUPPLY_WHOLE,
    maxSupplyBaseUnits,
    earlyWalletLimitBaseUnits,
    earlyWalletLimitWholeTokens: formatBaseUnits(earlyWalletLimitBaseUnits, decimals),
    earlyWindowPurchasesBlockedByGranularity,
  };
}

export type ProtocolSwapFeeRoute = {
  grossInputBaseUnits: bigint;
  protocolFeeBaseUnits: bigint;
  creatorFeeBaseUnits: bigint;
  netSwapInputBaseUnits: bigint;
};

/**
 * Exact integer fee preview for a WELP-controlled launch/purchase volume:
 * 1% of gross input is routed to the Official Project Treasury Wallet and the
 * separate 0.5% creator slice is routed to the Liquid Developer Wallet, both from
 * the same gross base with multiplication before division (no truncation loss).
 * The remaining net input is the spendable amount.
 *
 * The same gross volume seeds the two-week treasury epoch: 60% releases to the
 * developer as liquid capital and 40% stays embedded as the protocol reserve.
 *
 * This function only calculates amounts. It does not prove that a swap or launch
 * occurred, sign a transaction, or collect funds. On-chain enforcement is
 * required before the website may submit mainnet transactions using this policy.
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
  const creatorFeeBaseUnits =
    (grossInputBaseUnits * CREATOR_FEE_BPS) / BASIS_POINTS_DENOMINATOR;
  const totalFeeBaseUnits = protocolFeeBaseUnits + creatorFeeBaseUnits;
  const netSwapInputBaseUnits = grossInputBaseUnits - totalFeeBaseUnits;

  if (protocolFeeBaseUnits === 0n) {
    throw new RangeError('Swap input is too small to express the protocol fee in base units.');
  }

  return {
    grossInputBaseUnits,
    protocolFeeBaseUnits,
    creatorFeeBaseUnits,
    netSwapInputBaseUnits,
  };
}

/**
 * Two-week treasury epoch split: exactly 60% of the accumulated treasury base
 * releases to the Liquid Developer Wallet and exactly 40% remains embedded in the
 * treasury as the permanent protocol stability reserve, with zero rounding leaks.
 */
export function calculateTreasuryEpochSplit(treasuryBaseUnits: bigint): {
  treasuryBaseUnits: bigint;
  developerBaseUnits: bigint;
  reserveBaseUnits: bigint;
} {
  if (treasuryBaseUnits < 0n) {
    throw new RangeError('Treasury base units cannot be negative.');
  }
  const developerBaseUnits =
    (treasuryBaseUnits * TREASURY_EPOCH_DEVELOPER_BPS) / BASIS_POINTS_DENOMINATOR;
  const reserveBaseUnits = treasuryBaseUnits - developerBaseUnits;
  return { treasuryBaseUnits, developerBaseUnits, reserveBaseUnits };
}

/**
 * Genesis pre-launch developer allocation: 0.02% of the freshly minted supply is
 * routed to the Private Developer Wallet while 99.98% stays with the creator.
 */
export function calculateGenesisAllocation(supplyBaseUnits: bigint): {
  creatorBaseUnits: bigint;
  developerBaseUnits: bigint;
} {
  if (supplyBaseUnits < 0n) {
    throw new RangeError('Supply base units cannot be negative.');
  }
  const developerBaseUnits =
    (supplyBaseUnits * GENESIS_DEV_ALLOCATION_BPS) / BASIS_POINTS_DENOMINATOR;
  const creatorBaseUnits = supplyBaseUnits - developerBaseUnits;
  return { creatorBaseUnits, developerBaseUnits };
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
