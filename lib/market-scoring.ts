type Row = Record<string, unknown>;

const rec = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const number = (value: unknown, fallback = 0) =>
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : fallback;
const optionalNumber = (value: unknown): number | null =>
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : null;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const logScale = (value: number, floor: number, ceiling: number) => {
  if (value <= floor) return 0;
  if (value >= ceiling) return 100;
  return clamp((Math.log10(value) - Math.log10(floor)) / (Math.log10(ceiling) - Math.log10(floor)) * 100);
};

export type ScoredMarketToken = {
  mint: string;
  name: string;
  symbol: string;
  logo: string | null;
  decimals: number;
  priceUsd: number | null;
  priceChange24h: number | null;
  priceChange1h: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  holders: number | null;
  organicScore: number | null;
  score: number;
  /** Share of the configured scoring inputs supplied by the provider, 0–100. */
  confidence: number;
  screeningDataComplete: boolean;
  verified: boolean;
  suspicious: boolean;
  turnover: number | null;
  buyPressure: number | null;
  topHoldersPercent: number | null;
  state: 'Blocked' | 'Watch' | 'Eligible';
  eligible: boolean;
  blockers: string[];
  warnings: string[];
  confidenceBreakdown: string[];
};

type ScoreFactor = { label: string; value: number | null; weight: number; detail: string };

export function scoreToken(value: unknown): ScoredMarketToken {
  const row = rec(value);
  const audit = rec(row.audit);
  const s24 = rec(row.stats24h);
  const s1 = rec(row.stats1h);

  const liquidityValue = optionalNumber(row.liquidity);
  const liquidityKnown = liquidityValue !== null && liquidityValue >= 0;
  const liquidity = Math.max(0, liquidityValue ?? 0);

  const buyVolume = optionalNumber(s24.buyVolume);
  const sellVolume = optionalNumber(s24.sellVolume);
  const volumeKnown = buyVolume !== null && sellVolume !== null;
  const volume = Math.max(0, (buyVolume ?? 0) + (sellVolume ?? 0));

  const organicValue = optionalNumber(row.organicScore);
  const organicKnown = organicValue !== null;
  const organic = organicKnown ? clamp(organicValue!) : 0;

  const holdersValue = optionalNumber(row.holderCount);
  const holdersKnown = holdersValue !== null && holdersValue >= 0;
  const holders = Math.max(0, Math.trunc(holdersValue ?? 0));
  const mcap = optionalNumber(row.mcap);
  const topHolders = optionalNumber(audit.topHoldersPercentage);
  const developerOwnership = optionalNumber(audit.developerOwnershipPercentage);
  const liquidityLocked = typeof audit.liquidityLocked === 'boolean' ? audit.liquidityLocked : null;
  const honeypot = typeof audit.honeypot === 'boolean' ? audit.honeypot : null;
  const freezeDisabled = typeof audit.freezeAuthorityDisabled === 'boolean'
    ? audit.freezeAuthorityDisabled
    : typeof row.freezeAuthority === 'string' ? false : null;
  const mintDisabled = typeof audit.mintAuthorityDisabled === 'boolean'
    ? audit.mintAuthorityDisabled
    : typeof row.mintAuthority === 'string' ? false : null;

  const buysValue = optionalNumber(s24.numBuys);
  const sellsValue = optionalNumber(s24.numSells);
  const tradesKnown = buysValue !== null && sellsValue !== null;
  const buys = Math.max(0, buysValue ?? 0);
  const sells = Math.max(0, sellsValue ?? 0);
  const totalTrades = buys + sells;
  const buyPressure = tradesKnown && totalTrades > 0 ? buys / totalTrades * 100 : null;

  const change1h = optionalNumber(s1.priceChange);
  const momentum = change1h === null ? null : clamp(100 * (1 - Math.abs(change1h) / 14));
  const depth = liquidityKnown ? logScale(liquidity, 100_000, 25_000_000) : null;
  const turnover = mcap !== null && mcap > 0 && volumeKnown
    ? clamp(volume / mcap / 1.5 * 100)
    : null;
  const holderScore = holdersKnown ? logScale(holders, 500, 150_000) : null;

  // Missing metrics are excluded from the weighted average and reduce confidence.
  // They are never replaced with neutral or invented values.
  const factors: ScoreFactor[] = [
    { label: 'Organic activity', value: organicKnown ? organic : null, weight: 0.32, detail: organicKnown ? `Organic activity contributes ${(organic * 0.32).toFixed(1)} weighted points.` : 'Organic activity is unavailable and is not scored.' },
    { label: 'Liquidity depth', value: depth, weight: 0.20, detail: depth === null ? 'Liquidity depth is unavailable and is not scored.' : `Liquidity depth contributes ${(depth * 0.20).toFixed(1)} weighted points.` },
    { label: 'Turnover', value: turnover, weight: 0.15, detail: turnover === null ? 'Turnover is not scored because market cap or volume data is unavailable.' : `Turnover contributes ${(turnover * 0.15).toFixed(1)} weighted points.` },
    { label: 'Holder spread', value: holderScore, weight: 0.13, detail: holderScore === null ? 'Holder spread is unavailable and is not scored.' : `Holder spread contributes ${(holderScore * 0.13).toFixed(1)} weighted points.` },
    { label: 'Buy pressure', value: buyPressure, weight: 0.12, detail: buyPressure === null ? 'Buy pressure is not scored because usable buy and sell counts are unavailable.' : `Buy pressure is ${buyPressure.toFixed(1)}% and contributes ${(buyPressure * 0.12).toFixed(1)} weighted points.` },
    { label: 'Short-term calm', value: momentum, weight: 0.08, detail: momentum === null ? 'Short-term momentum is unavailable and is not scored.' : `Short-term calm contributes ${(momentum * 0.08).toFixed(1)} weighted points.` },
  ];
  const availableFactors = factors.filter((factor) => factor.value !== null);
  const availableWeight = availableFactors.reduce((sum, factor) => sum + factor.weight, 0);
  const weightedQuality = availableFactors.reduce((sum, factor) => sum + (factor.value ?? 0) * factor.weight, 0);
  const score = availableWeight > 0 ? clamp(weightedQuality / availableWeight) : 0;
  const confidence = Math.round(availableWeight * 10_000) / 100;

  const blockers: string[] = [];
  const warnings: string[] = [];
  const missingCriticalData: string[] = [];

  if (freezeDisabled === false) blockers.push('Freeze authority is active');
  if (liquidityKnown && liquidity < 100_000) blockers.push('Liquidity is below $100,000');
  if (volumeKnown && volume < 100_000) blockers.push('24-hour volume is below $100,000');
  if (topHolders !== null && topHolders > 60) blockers.push('Top holders own ' + topHolders.toFixed(1) + '%');
  if (developerOwnership !== null && developerOwnership > 20) blockers.push('Developer allocation exceeds 20%');
  if (liquidityLocked === false) blockers.push('Liquidity lock is reported as unlocked');
  if (honeypot === true) blockers.push('Honeypot risk is reported by the audit feed');
  const suspicious = audit.isSus === true;
  if (suspicious) blockers.push('Jupiter audit flags this token as suspicious');

  // A token cannot be marked eligible when the feed omits core screening fields.
  if (!liquidityKnown) missingCriticalData.push('Liquidity data is unavailable');
  if (!volumeKnown) missingCriticalData.push('24-hour buy/sell volume data is unavailable');
  if (freezeDisabled === null) missingCriticalData.push('Freeze-authority status is unavailable');
  if (topHolders === null) missingCriticalData.push('Top-holder concentration data is unavailable');

  if (missingCriticalData.length) warnings.push(...missingCriticalData);
  if (freezeDisabled === null) warnings.push('Freeze-authority status is not reported');
  if (mintDisabled === false) warnings.push('Mint authority is active');
  if (liquidityLocked === null) warnings.push('Liquidity-lock status is not provided by this feed');
  if (liquidityKnown && liquidity >= 100_000 && liquidity < 250_000) warnings.push('Liquidity is below the $250,000 desk guide');
  if (holdersKnown && holders > 0 && holders < 1_000) warnings.push('Small holder base: ' + holders.toLocaleString() + ' holders');
  if (!holdersKnown || holders === 0) warnings.push('Holder count is unavailable');
  if (topHolders !== null && topHolders > 40 && topHolders <= 60) warnings.push('Top holders own ' + topHolders.toFixed(1) + '%');
  if (topHolders === null) warnings.push('Holder concentration is unavailable');
  if (!organicKnown) warnings.push('Organic activity score is unavailable');
  else if (organic < 60) warnings.push('Low organic score: ' + organic.toFixed(0) + '/100');
  if (mcap === null || mcap <= 0) warnings.push('Market cap is unavailable; turnover contributes no score');
  if (!volumeKnown) warnings.push('24-hour volume is unavailable');
  if (change1h === null) warnings.push('One-hour price change is unavailable; momentum contributes no score');
  if (!tradesKnown || totalTrades === 0) warnings.push('Buy/sell trade counts are unavailable; buy pressure contributes no score');
  const change24h = optionalNumber(s24.priceChange);
  if (change24h === null) warnings.push('24-hour price change is unavailable');
  else if (change24h <= -25) warnings.push('24-hour drawdown is ' + change24h.toFixed(1) + '%');
  if (row.isVerified !== true) warnings.push('Token is not marked verified by the feed');

  const confidenceBreakdown = [
    ...factors.map((factor) => factor.detail),
    `Data coverage: ${confidence.toFixed(0)}% of the configured score inputs are present.`,
    blockers.length ? `Hard risk blockers: ${blockers.join('; ')}.` : 'No provider-reported hard risk blocker is present.',
    missingCriticalData.length ? `Eligibility withheld because core screening fields are missing: ${missingCriticalData.join('; ')}.` : 'Core market and audit screening fields are present.',
    warnings.length ? `Additional review items: ${warnings.filter((warning) => !missingCriticalData.includes(warning)).slice(0, 4).join('; ')}.` : 'No additional data warnings were reported.',
  ];

  const eligible = blockers.length === 0 && missingCriticalData.length === 0;
  return {
    mint: String(row.id ?? ''),
    name: String(row.name ?? row.symbol ?? 'Unknown token').slice(0, 80),
    symbol: String(row.symbol ?? '—').slice(0, 20),
    logo: typeof row.icon === 'string' ? row.icon : null,
    decimals: Math.max(0, Math.min(18, Math.trunc(number(row.decimals)))),
    priceUsd: optionalNumber(row.usdPrice) !== null && optionalNumber(row.usdPrice)! > 0 ? optionalNumber(row.usdPrice) : null,
    priceChange24h: change24h,
    priceChange1h: change1h,
    liquidityUsd: liquidityKnown ? liquidity : null,
    volume24hUsd: volumeKnown ? volume : null,
    marketCapUsd: mcap,
    holders: holdersKnown ? holders : null,
    organicScore: organicKnown ? Math.round(organic) : null,
    score: Math.round(score * 100) / 100,
    confidence,
    screeningDataComplete: missingCriticalData.length === 0,
    verified: row.isVerified === true,
    suspicious,
    turnover,
    buyPressure,
    topHoldersPercent: topHolders,
    state: blockers.length ? 'Blocked' : eligible && warnings.length === 0 ? 'Eligible' : 'Watch',
    eligible,
    blockers,
    warnings: [...new Set(warnings)],
    confidenceBreakdown,
  };
}
