import 'server-only';

/**
 * Canonical WELP fee policy.
 *
 * Keep this module server-only. The on-chain program must independently
 * enforce the same values; this module is for backend transaction builders
 * and validation only. It is not proof that fees are currently collected.
 */
export const WELP_FEE_POLICY = Object.freeze({
  network: 'solana-mainnet-beta',
  stablecoin: Object.freeze({
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
  }),
  developerRecipient: 'ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG',
  developerShareBps: 6_000,
  treasuryShareBps: 4_000,
  fees: Object.freeze({
    tradeOrTransferUsdcBaseUnits: 100_000n,
    launchCreationUsdcBaseUnits: 500_000n,
  }),
  treasuryPdaSeed: 'treasury-v1',
  collectionEnabled: false,
});

export type WelpFeeKind = 'trade-or-transfer' | 'launch-creation';

export function splitWelpFee(amount: bigint) {
  if (amount <= 0n) throw new Error('Fee amount must be positive.');
  const developer = (amount * BigInt(WELP_FEE_POLICY.developerShareBps)) / 10_000n;
  const treasury = amount - developer;
  return { developer, treasury };
}

export function getWelpFee(kind: WelpFeeKind) {
  const amount = kind === 'launch-creation'
    ? WELP_FEE_POLICY.fees.launchCreationUsdcBaseUnits
    : WELP_FEE_POLICY.fees.tradeOrTransferUsdcBaseUnits;
  return { amount, ...splitWelpFee(amount), mint: WELP_FEE_POLICY.stablecoin.mint };
}
