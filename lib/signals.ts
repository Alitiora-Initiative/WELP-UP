import { requestOrder } from '@/lib/jupiter';
import { SOL_MINT } from '@/lib/constants';

const GECKO = 'https://api.geckoterminal.com/api/v2';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const QUOTE_MINTS = new Set([SOL_MINT, USDC_MINT, USDT_MINT]);

type Candle = { ts: number; high: number; low: number; close: number; volume: number };
type Pool = {
  pool: string;
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  kind: 'meme' | 'stock';
  liquidityUsd: number;
  volumeH24: number;
  changeM5: number;
  changeH1: number;
  ageHours: number;
  buyRatio: number | null;
};
export type Signal = Pool & {
  score: number;
  eligible: boolean;
  reason: string;
  notes: string[];
  priceImpactPct: number | null;
};

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function poolFrom(row: Record<string, unknown>, included: Map<string, Record<string, unknown>>): Pool | null {
  const attr = record(row.attributes);
  const rel = record(row.relationships);
  const baseRef = record(record(rel.base_token).data).id;
  const quoteRef = record(record(rel.quote_token).data).id;
  const base = record(included.get(typeof baseRef === 'string' ? baseRef : '')?.attributes);
  const quote = record(included.get(typeof quoteRef === 'string' ? quoteRef : '')?.attributes);
  const baseMint = String(base.address ?? '');
  const quoteMint = String(quote.address ?? '');
  let token;
  if (QUOTE_MINTS.has(quoteMint) && !QUOTE_MINTS.has(baseMint)) token = base;
  else if (QUOTE_MINTS.has(baseMint) && !QUOTE_MINTS.has(quoteMint)) token = quote;
  else return null;
  const mint = String(token.address ?? '');
  const pool = String(attr.address ?? '');
  if (!mint || !pool || mint === SOL_MINT) return null;
  const name = String(token.name ?? '');
  const kind = name.toLowerCase().includes('xstock') ? 'stock' : 'meme';
  const createdAt = Date.parse(String(attr.pool_created_at ?? ''));
  const ageHours = Number.isFinite(createdAt) ? Math.max(0, (Date.now() - createdAt) / 3_600_000) : 0;
  const transactions = record(attr.transactions);
  const tx = record(transactions.h1 ?? transactions.m5);
  const buys = num(tx.buys, -1);
  const sells = num(tx.sells, -1);
  const buyRatio = buys >= 0 && sells >= 0 && buys + sells > 0 ? buys / (buys + sells) : null;
  return {
    pool,
    mint,
    symbol: String(token.symbol ?? 'TOKEN').slice(0, 16),
    name: name.slice(0, 64),
    decimals: Math.min(18, Math.max(0, Math.trunc(num(token.decimals, 0)))),
    kind,
    liquidityUsd: num(attr.reserve_in_usd),
    volumeH24: num(record(attr.volume_usd).h24),
    changeM5: num(record(attr.price_change_percentage).m5),
    changeH1: num(record(attr.price_change_percentage).h1),
    ageHours,
    buyRatio,
  };
}

async function fetchCandles(pool: string): Promise<Candle[]> {
  const url = new URL(`${GECKO}/networks/solana/pools/${encodeURIComponent(pool)}/ohlcv/minute`);
  url.searchParams.set('aggregate', '5');
  url.searchParams.set('limit', '60');
  url.searchParams.set('currency', 'usd');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(14_000) });
  if (!response.ok) return [];
  const data = record(await response.json());
  const rows: unknown[] = record(record(data.data).attributes).ohlcv_list as unknown[] ?? [];
  const dedup = new Map<number, Candle>();
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const candle = { ts: num(row[0]), high: num(row[2]), low: num(row[3]), close: num(row[4]), volume: num(row[5]) };
    if (candle.close > 0) dedup.set(candle.ts, candle);
  }
  return [...dedup.values()].sort((a, b) => a.ts - b.ts);
}

function ema(values: number[], length: number) {
  const k = 2 / (length + 1);
  let current = values[0] ?? 0;
  for (const value of values) current = value * k + current * (1 - k);
  return current;
}

function rsi(values: number[], length = 14) {
  if (values.length < length + 1) return null;
  const changes = values.slice(1).map((value, index) => value - values[index]);
  let gain = changes.slice(0, length).reduce((sum, value) => sum + Math.max(value, 0), 0) / length;
  let loss = changes.slice(0, length).reduce((sum, value) => sum + Math.max(-value, 0), 0) / length;
  for (const change of changes.slice(length)) {
    gain = (gain * (length - 1) + Math.max(change, 0)) / length;
    loss = (loss * (length - 1) + Math.max(-change, 0)) / length;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

function analyze(pool: Pool, candles: Candle[], order: Record<string, unknown> | null) {
  if (candles.length < 30) return { score: 0, notes: ['fewer than 30 candles'], ready: false, impact: null as number | null };
  const closes = candles.map((candle) => candle.close);
  const valueRsi = rsi(closes);
  if (valueRsi === null) return { score: 0, notes: ['RSI unavailable'], ready: false, impact: null as number | null };
  const notes: string[] = [];
  const fast = ema(closes, 9);
  const slow = ema(closes, 21);
  const close = closes[closes.length - 1];
  const left = candles.slice(-8, -4);
  const right = candles.slice(-4);
  const higherLows = Math.min(...right.map((candle) => candle.low)) > Math.min(...left.map((candle) => candle.low));
  const higherHighs = Math.max(...right.map((candle) => candle.high)) > Math.max(...left.map((candle) => candle.high));
  const recentVolume = candles.slice(-6).reduce((sum, candle) => sum + candle.volume, 0);
  const priorVolume = candles.slice(-12, -6).reduce((sum, candle) => sum + candle.volume, 0);
  const volRatio = priorVolume > 0 ? recentVolume / priorVolume : 0;
  let score = 0;
  const emaStack = close > fast && fast > slow;
  if (emaStack) { score += 16; notes.push('EMA stack up'); }
  else if (close > slow) { score += 6; notes.push('above slow EMA only'); }
  if (valueRsi >= 52 && valueRsi <= 66) { score += 12; notes.push(`RSI ${valueRsi.toFixed(1)} in band`); }
  else if ((valueRsi >= 45 && valueRsi < 52) || (valueRsi > 66 && valueRsi <= 70)) score += 5;
  if (higherHighs && higherLows) { score += 10; notes.push('higher highs and higher lows'); }
  else if (higherLows) score += 4;
  if (volRatio >= 1.25) { score += 8; notes.push(`volume x${volRatio.toFixed(2)}`); }
  else if (volRatio >= 1) score += 3;
  if (pool.liquidityUsd >= 80_000) score += 10;
  else if (pool.liquidityUsd >= 12_000) score += 6;
  else notes.push('pool liquidity below $12k');
  if (pool.changeH1 >= 1 && pool.changeH1 <= 8) score += 8;
  else if (pool.changeH1 >= 0.2 && pool.changeH1 < 1) score += 3;
  if (pool.changeM5 <= -6) { score -= 18; notes.push('5m dump'); }
  else if (pool.changeM5 >= 12) { score -= 14; notes.push('5m blowoff'); }
  else score += 6;
  if (pool.ageHours >= 24) score += 8;
  else if (pool.ageHours >= 6) score += 4;
  else if (pool.ageHours < 1) { score -= 16; notes.push('pool younger than 1h'); }
  const turnover = pool.liquidityUsd > 0 ? pool.volumeH24 / pool.liquidityUsd : 0;
  if (turnover >= 0.15) score += 6;
  else if (turnover >= 0.05) score += 3;
  const impact = order && order.priceImpact != null ? Math.abs(num(order.priceImpact)) : null;
  if (impact !== null) {
    if (impact <= 1) { score += 10; notes.push(`Jupiter impact ${impact.toFixed(3)}%`); }
    else if (impact <= 2.5) score += 4;
    else { score -= 22; notes.push('Jupiter impact too high'); }
  }
  if (order?.inUsdValue != null && order.outUsdValue != null) {
    const inUsd = num(order.inUsdValue);
    const edge = inUsd > 0 ? (num(order.outUsdValue) / inUsd - 1) * 100 : null;
    if (edge !== null && edge >= -1.5 && edge <= 0.4) score += 6;
    else if (edge !== null) { score -= 12; notes.push('Jupiter quote disagrees with the mark'); }
  }
  if (pool.buyRatio !== null) {
    if (pool.buyRatio >= 0.52 && pool.buyRatio <= 0.72) score += 6;
    else if (pool.buyRatio > 0.85) { score -= 6; notes.push('one-sided buys'); }
  }
  if (valueRsi >= 74) { score -= 12; notes.push('RSI overbought'); }
  if (pool.changeH1 >= 25) { score -= 15; notes.push('already extended'); }
  return { score: Math.max(0, Math.min(100, score)), notes, ready: true, impact };
}

export async function loadSignals(owner: string): Promise<Signal[]> {
  const response = await fetch(`${GECKO}/networks/solana/trending_pools?page=1&include=base_token,quote_token`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('Live pool discovery is temporarily unavailable.');
  const payload = record(await response.json());
  const includedRows: unknown[] = Array.isArray(payload.included) ? payload.included : [];
  const included = new Map<string, Record<string, unknown>>();
  for (const item of includedRows) {
    const row = record(item);
    if (typeof row.id === 'string') included.set(row.id, row);
  }
  const seen = new Set<string>();
  const pools: Pool[] = [];
  for (const item of Array.isArray(payload.data) ? payload.data : []) {
    const pool = poolFrom(record(item), included);
    if (!pool || pool.kind !== 'meme' || pool.liquidityUsd < 12_000 || seen.has(pool.mint)) continue;
    seen.add(pool.mint);
    pools.push(pool);
    if (pools.length === 3) break;
  }
  const candleSets = await Promise.all(pools.map((pool) => fetchCandles(pool.pool).catch(() => [])));
  const signals: Signal[] = [];
  const minimumGapMs = process.env.JUPITER_API_KEY ? 1_100 : 2_100;
  for (let index = 0; index < pools.length; index += 1) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, minimumGapMs));
    const pool = pools[index];
    const candles = candleSets[index];
    const quote = await requestOrder({ inputMint: SOL_MINT, outputMint: pool.mint, amount: '1000000', taker: owner, slippageBps: 150 }).catch(() => null);
    const quoteReady = quote !== null && typeof quote.transaction === 'string' && typeof quote.requestId === 'string';
    const result = analyze(pool, candles, quoteReady ? quote : null);
    const eligible = result.ready && quoteReady && result.score >= 80 && result.score <= 98;
    signals.push({
      ...pool,
      score: Math.round(result.score * 100) / 100,
      eligible,
      reason: !result.ready ? 'Not enough chart history' : !quoteReady ? 'Jupiter quote unavailable' : result.score < 80 ? 'Below the 80 point entry floor' : result.score > 98 ? 'Above the 98 point entry ceiling' : 'Inside the 80–98 entry window',
      notes: result.notes,
      priceImpactPct: result.impact,
    });
  }
  return signals;
}
