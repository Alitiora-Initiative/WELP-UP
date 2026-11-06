import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;
const FEED = 'https://lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=100';
const rec = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const n = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const scale = (value: number, low: number, high: number) => value <= low ? 0 : value >= high ? 100 : clamp((Math.log10(value) - Math.log10(low)) / (Math.log10(high) - Math.log10(low)) * 100);
const concentration = (value: unknown): number | null => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : clamp(Number(value) <= 1 ? Number(value) * 100 : Number(value));

function scoreToken(row: Row) {
  const audit = rec(row.audit);
  const s24 = rec(row.stats24h);
  const s5 = rec(row.stats5m);
  const s1 = rec(row.stats1h);
  const liquidity = n(row.liquidity);
  const volume = n(s24.buyVolume) + n(s24.sellVolume);
  const organic = clamp(n(row.organicScore));
  const topHolders = concentration(audit.topHoldersPercentage);
  const freezeDisabled = typeof audit.freezeAuthorityDisabled === 'boolean'
    ? audit.freezeAuthorityDisabled
    : typeof row.freezeAuthority === 'string' ? false : null;
  const buy = n(s24.buyVolume);
  const sell = n(s24.sellVolume);
  const buyPressure = buy + sell > 0 ? buy / (buy + sell) * 100 : 50;
  const depth = scale(liquidity, 100_000, 100_000_000);
  const turnover = liquidity > 0 ? volume / liquidity : 0;
  const holderSpread = topHolders === null ? 50 : clamp(100 - topHolders);
  const calm = clamp(100 - Math.abs(n(s5.priceChange) * 100) * 2.5 - Math.abs(n(s1.priceChange) * 100) * 0.65);
  const quality = organic * 0.32 + depth * 0.20 + scale(turnover, 0.05, 8) * 0.15
    + holderSpread * 0.13 + buyPressure * 0.12 + calm * 0.08;
  const score = Math.round(80 + quality * 0.18);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (freezeDisabled === false) blockers.push('Freeze authority is active');
  if (liquidity < 100_000) blockers.push('Liquidity is below $100,000');
  if (volume < 100_000) blockers.push('24-hour volume is below $100,000');
  if (topHolders !== null && topHolders > 60) blockers.push('Top holders own ' + topHolders.toFixed(1) + '%');
  if (freezeDisabled === null) warnings.push('Freeze-authority status is not reported');
  if (liquidity >= 100_000 && liquidity < 250_000) warnings.push('Liquidity is below the $250,000 desk guide');
  if (topHolders !== null && topHolders > 50 && topHolders <= 60) warnings.push('Top holders own ' + topHolders.toFixed(1) + '%');
  const change = n(s24.priceChange) * 100;
  if (change <= -25) warnings.push('24-hour drawdown is ' + change.toFixed(1) + '%');
  if (row.isVerified !== true) warnings.push('Token is not marked verified by the feed');
  if (topHolders === null) warnings.push('Holder concentration is unavailable');
  return {
    mint: String(row.id ?? ''),
    name: String(row.name ?? row.symbol ?? 'Unknown token').slice(0, 80),
    symbol: String(row.symbol ?? '—').slice(0, 20),
    logo: typeof row.icon === 'string' ? row.icon : null,
    decimals: Math.max(0, Math.min(18, Math.trunc(n(row.decimals)))),
    priceUsd: n(row.usdPrice),
    priceChange24h: change,
    liquidityUsd: liquidity,
    volume24hUsd: volume,
    holders: Math.max(0, Math.trunc(n(row.holderCount))),
    organicScore: Math.round(organic),
    score: Math.max(80, Math.min(98, score)),
    verified: row.isVerified === true,
    turnover,
    topHoldersPercent: topHolders,
    state: blockers.length ? 'Blocked' : warnings.length ? 'Watch' : 'Eligible',
    eligible: blockers.length === 0,
    blockers,
    warnings,
  };
}

export async function GET() {
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (process.env.JUPITER_API_KEY) headers['x-api-key'] = process.env.JUPITER_API_KEY;
    const response = await fetch(FEED, { headers, cache: 'force-cache', next: { revalidate: 60 }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return NextResponse.json({ error: 'Jupiter market feed returned ' + response.status + '.' }, { status: 502 });
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return NextResponse.json({ error: 'Jupiter returned an unexpected market-feed format.' }, { status: 502 });
    const assets = payload.map((item) => scoreToken(rec(item))).filter((item) => item.mint.length > 0);
    assets.sort((a, b) => b.score - a.score || b.liquidityUsd - a.liquidityUsd);
    const eligible = assets.filter((asset) => asset.eligible).length;
    return NextResponse.json({
      source: 'Jupiter Token API v2',
      updatedAt: new Date().toISOString(),
      total: assets.length,
      eligible,
      blocked: assets.length - eligible,
      liquidityUsd: assets.reduce((sum, asset) => sum + asset.liquidityUsd, 0),
      volume24hUsd: assets.reduce((sum, asset) => sum + asset.volume24hUsd, 0),
      assets,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Jupiter market feed could not be reached.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
