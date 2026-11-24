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

const QUALITY_WEIGHTS = {
  organic: 32,
  depth: 20,
  turnover: 15,
  holders: 13,
  buyPressure: 12,
  momentum: 8,
} as const;

export type ScoredMarketToken = {
  mint: string;
  name: string;
  symbol: string;
  logo: string | null;
  decimals: number;
  priceUsd: number;
  priceChange24h: number;
  priceChange1h: number | null;
  liquidityUsd: number;
  volume24hUsd: number;
  marketCapUsd: number | null;
  holders: number;
  organicScore: number;
  score: number;
  scoreCoveragePct: number;
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

export function scoreToken(value: unknown): ScoredMarketToken {
  const row = rec(value);
  const audit = rec(row.audit);
  const s24 = rec(row.stats24h);
  const s1 = rec(row.stats1h);

  const rawLiquidity = optionalNumber(row.liquidity);
  const liquidity = Math.max(0, rawLiquidity ?? 0);
  const buyVolume = optionalNumber(s24.buyVolume);
  const sellVolume = optionalNumber(s24.sellVolume);
  const volumeAvailable = buyVolume !== null && sellVolume !== null;
  const volume = volumeAvailable ? Math.max(0, buyVolume + sellVolume) : 0;

  const organicValue = optionalNumber(row.organicScore);
  const organic = clamp(organicValue ?? 0);
  const holdersValue = optionalNumber(row.holderCount);
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
  const buys = Math.max(0, buysValue ?? 0);
  const sells = Math.max(0, sellsValue ?? 0);
  const tradeCountsAvailable = buysValue !== null && sellsValue !== null;
  const totalTrades = tradeCountsAvailable ? buys + sells : 0;
  const buyPressure = totalTrades > 0 ? buys / totalTrades * 100 : null;

  const change1h = optionalNumber(s1.priceChange);
  const momentum = change1h === null ? null : clamp(100 * (1 - Math.abs(change1h) / 14));
  const depth = rawLiquidity === null ? null : logScale(liquidity, 100_000, 25_000_000);
  const turnover = mcap !== null && mcap > 0 && volumeAvailable
    ? clamp(volume / mcap / 1.5 * 100)
    : null;
  const holderScore = holdersValue === null ? null : logScale(holders, 500, 150_000);

  // Missing provider fields are excluded and the remaining weights are normalized.
  // Unknown data therefore cannot silently become a neutral 50 or a fabricated zero.
  const qualityInputs: Array<{ name: string; value: number | null; weight: number }> = [
    { name: 'Organic activity', value: organicValue === null ? null : organic, weight: QUALITY_WEIGHTS.organic },
    { name: 'Liquidity depth', value: depth, weight: QUALITY_WEIGHTS.depth },
    { name: 'Turnover', value: turnover, weight: QUALITY_WEIGHTS.turnover },
    { name: 'Holder spread', value: holderScore, weight: QUALITY_WEIGHTS.holders },
    { name: 'Buy pressure', value: buyPressure, weight: QUALITY_WEIGHTS.buyPressure },
    { name: 'Short-term calm', value: momentum, weight: QUALITY_WEIGHTS.momentum },
  ];
  const observedWeight = qualityInputs.reduce((sum, item) => sum + (item.value === null ? 0 : item.weight), 0);
  const weightedQuality = qualityInputs.reduce(
    (sum, item) => sum + (item.value === null ? 0 : item.value * item.weight),
    0,
  );
  const quality = observedWeight > 0 ? weightedQuality / observedWeight : 0;
  const score = Math.round(clamp(quality));
  const scoreCoveragePct = observedWeight;

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (freezeDisabled === false) blockers.push('Freeze authority is active');
  if (rawLiquidity === null) blockers.push('Liquidity data is unavailable');
  else if (liquidity < 100_000) blockers.push('Liquidity is below $100,000');
  if (!volumeAvailable) blockers.push('24-hour volume data is unavailable');
  else if (volume < 100_000) blockers.push('24-hour volume is below $100,000');
  if (topHolders !== null && topHolders > 60) blockers.push('Top holders own ' + topHolders.toFixed(1) + '%');
  if (developerOwnership !== null && developerOwnership > 20) blockers.push('Developer allocation exceeds 20%');
  if (liquidityLocked === false) blockers.push('Liquidity lock is reported as not locked');
  if (honeypot === true) blockers.push('Honeypot risk is reported by the audit feed');
  const suspicious = audit.isSus === true;
  if (suspicious) blockers.push('Jupiter audit flags this token as suspicious');

  if (freezeDisabled === null) warnings.push('Freeze-authority status is not reported');
  if (mintDisabled === false) warnings.push('Mint authority is active');
  if (mintDisabled === null) warnings.push('Mint-authority status is not reported');
  if (liquidityLocked === null) warnings.push('Liquidity-lock status is not reported by this feed');
  if (honeypot === null) warnings.push('Honeypot status is not reported by this feed; check the token-security provider before trading');
  if (rawLiquidity !== null && liquidity >= 100_000 && liquidity < 250_000) warnings.push('Liquidity is below the $250,000 desk guide');
  if (holdersValue !== null && holders > 0 && holders < 1_000) warnings.push('Small holder base: ' + holders.toLocaleString('en-US') + ' holders');
  if (holdersValue === null || holders === 0) warnings.push('Holder count is unavailable');
  if (topHolders !== null && topHolders > 40 && topHolders <= 60) warnings.push('Top holders own ' + topHolders.toFixed(1) + '%');
  if (topHolders === null) warnings.push('Holder concentration is unavailable');
  if (organicValue === null) warnings.push('Organic activity score is unavailable');
  else if (organic < 60) warnings.push('Low organic score: ' + organic.toFixed(0) + '/100');
  if (!volumeAvailable) warnings.push('24-hour buy/sell volume fields are incomplete');
  if (mcap === null || mcap <= 0) warnings.push('Market cap is unavailable; turnover is not scored');
  if (change1h === null) warnings.push('One-hour price change is unavailable; momentum is not scored');
  if (!tradeCountsAvailable) warnings.push('Buy/sell trade counts are unavailable; buy pressure is not scored');
  const change24h = number(s24.priceChange);
  if (change24h <= -25) warnings.push('24-hour drawdown is ' + change24h.toFixed(1) + '%');
  if (row.isVerified !== true) warnings.push('Token is not marked verified by the feed');

  const confidenceBreakdown = qualityInputs.map((item) =>
    item.value === null
      ? item.name + ' is unavailable and is excluded from the score.'
      : item.name + ' contributes ' + Math.round(item.value * item.weight / observedWeight * 100) / 100 +
        ' normalized points from an original ' + item.weight + '% weight.',
  );
  confidenceBreakdown.push(
    'Observed input coverage: ' + scoreCoveragePct + '% of the six weighted fields. Score is normalized over observed fields only.',
  );
  confidenceBreakdown.push(
    blockers.length ? 'Blocked by: ' + blockers.join('; ') + '.' :
      warnings.length ? 'Review warnings: ' + warnings.slice(0, 4).join('; ') + '.' :
        'No hard blockers or open data warnings were reported by the available feed fields.',
  );

  return {
    mint: String(row.id ?? ''),
    name: String(row.name ?? row.symbol ?? 'Unknown token').slice(0, 80),
    symbol: String(row.symbol ?? '—').slice(0, 20),
    logo: typeof row.icon === 'string' ? row.icon : null,
    decimals: Math.max(0, Math.min(18, Math.trunc(number(row.decimals)))),
    priceUsd: Math.max(0, number(row.usdPrice)),
    priceChange24h: change24h,
    priceChange1h: change1h,
    liquidityUsd: liquidity,
    volume24hUsd: volume,
    marketCapUsd: mcap,
    holders,
    organicScore: Math.round(organic),
    score,
    scoreCoveragePct,
    verified: row.isVerified === true,
    suspicious,
    turnover,
    buyPressure,
    topHoldersPercent: topHolders,
    state: blockers.length ? 'Blocked' : warnings.length ? 'Watch' : 'Eligible',
    eligible: blockers.length === 0,
    blockers,
    warnings,
    confidenceBreakdown,
  };
}
