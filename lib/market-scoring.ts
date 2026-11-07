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
  priceUsd: number;
  priceChange24h: number;
  priceChange1h: number | null;
  liquidityUsd: number;
  volume24hUsd: number;
  marketCapUsd: number | null;
  holders: number;
  organicScore: number;
  score: number;
  verified: boolean;
  suspicious: boolean;
  turnover: number | null;
  buyPressure: number | null;
  topHoldersPercent: number | null;
  state: 'Blocked' | 'Watch' | 'Eligible';
  eligible: boolean;
  blockers: string[];
  warnings: string[];
};

export function scoreToken(row: Row): ScoredMarketToken {
  const audit = rec(row.audit);
  const s24 = rec(row.stats24h);
  const s1 = rec(row.stats1h);
  const liquidity = Math.max(0, number(row.liquidity));
  const volume = Math.max(0, number(s24.buyVolume) + number(s24.sellVolume));
  const organic = clamp(number(row.organicScore));
  const holders = Math.max(0, Math.trunc(number(row.holderCount)));
  const mcap = optionalNumber(row.mcap);
  const topHolders = optionalNumber(audit.topHoldersPercentage);
  const freezeDisabled = typeof audit.freezeAuthorityDisabled === 'boolean'
    ? audit.freezeAuthorityDisabled
    : typeof row.freezeAuthority === 'string' ? false : null;
  const mintDisabled = typeof audit.mintAuthorityDisabled === 'boolean'
    ? audit.mintAuthorityDisabled
    : typeof row.mintAuthority === 'string' ? false : null;
  const buys = Math.max(0, number(s24.numBuys));
  const sells = Math.max(0, number(s24.numSells));
  const totalTrades = buys + sells;
  const buyPressure = totalTrades > 0 ? buys / totalTrades * 100 : 50;
  const change1h = optionalNumber(s1.priceChange);
  const momentum = change1h === null ? 0 : clamp(100 * (1 - Math.abs(change1h) / 14));
  const depth = logScale(liquidity, 100_000, 25_000_000);
  const turnover = mcap !== null && mcap > 0 ? clamp(volume / mcap / 1.5 * 100) : null;
  const holderScore = logScale(holders, 500, 150_000);
  const quality = organic * 0.32
    + depth * 0.20
    + (turnover ?? 0) * 0.15
    + holderScore * 0.13
    + buyPressure * 0.12
    + momentum * 0.08;
  const score = Math.round(80 + 18 * quality / 100);

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (freezeDisabled === false) blockers.push('Freeze authority is active');
  if (liquidity < 100_000) blockers.push('Liquidity is below $100,000');
  if (volume < 100_000) blockers.push('24-hour volume is below $100,000');
  if (topHolders !== null && topHolders > 60) blockers.push('Top holders own ' + topHolders.toFixed(1) + '%');

  if (freezeDisabled === null) warnings.push('Freeze-authority status is not reported');
  if (mintDisabled === false) warnings.push('Mint authority is active');
  if (liquidity >= 100_000 && liquidity < 250_000) warnings.push('Liquidity is below the $250,000 desk guide');
  if (holders > 0 && holders < 1_000) warnings.push('Small holder base: ' + holders.toLocaleString() + ' holders');
  if (holders === 0) warnings.push('Holder count is unavailable');
  if (topHolders !== null && topHolders > 40 && topHolders <= 60) warnings.push('Top holders own ' + topHolders.toFixed(1) + '%');
  if (topHolders === null) warnings.push('Holder concentration is unavailable');
  if (organic < 60) warnings.push('Low organic score: ' + organic.toFixed(0) + '/100');
  if (mcap === null || mcap <= 0) warnings.push('Market cap is unavailable; turnover contributes no score');
  if (change1h === null) warnings.push('One-hour price change is unavailable; momentum contributes no score');
  const change24h = number(s24.priceChange);
  if (change24h <= -25) warnings.push('24-hour drawdown is ' + change24h.toFixed(1) + '%');
  if (row.isVerified !== true) warnings.push('Token is not marked verified by the feed');
  const suspicious = audit.isSus === true;
  if (suspicious) warnings.push('Jupiter audit flags this token as suspicious');

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
    score: clamp(score, 80, 98),
    verified: row.isVerified === true,
    suspicious,
    turnover,
    buyPressure: totalTrades > 0 ? buyPressure : null,
    topHoldersPercent: topHolders,
    state: blockers.length ? 'Blocked' : warnings.length ? 'Watch' : 'Eligible',
    eligible: blockers.length === 0,
    blockers,
    warnings,
  };
}
