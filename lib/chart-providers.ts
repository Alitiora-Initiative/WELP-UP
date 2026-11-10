/** Read-only DexScreener market snapshots for the self-hosted chart. */
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartTimeframe = 'minute' | 'hour' | 'day';
export type ChartAggregate = 1 | 4 | 5 | 12 | 15;
export type ProviderResult<T> = { status: 'ok' | 'stale' | 'error'; data?: T; source: string; fetchedAt: number; error?: string; ageMs?: number; poolAddress?: string; poolLiquidityUsd?: number };
export interface ChartProvider { name: string; fetchCandles(mint: string, from: number, to: number, timeframe: ChartTimeframe, aggregate: ChartAggregate): Promise<ProviderResult<Candle[]>>; }

type RecordValue = Record<string, unknown>;
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DEX_BASE = 'https://api.dexscreener.com/latest/dex/tokens';
const SOURCE = 'DexScreener live snapshot';

function record(value: unknown): RecordValue { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as RecordValue : {}; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function failure(fetchedAt: number, error: string): ProviderResult<Candle[]> { return { status: 'error', source: SOURCE, fetchedAt, error }; }

export class DexScreenerProvider implements ChartProvider {
  readonly name = 'dexscreener';
  async fetchCandles(mint: string, _from: number, to: number, _timeframe: ChartTimeframe, _aggregate: ChartAggregate): Promise<ProviderResult<Candle[]>> {
    const fetchedAt = Date.now();
    if (!MINT_RE.test(mint)) return failure(fetchedAt, 'Invalid Solana mint address.');
    try {
      const response = await fetch(`${DEX_BASE}/${encodeURIComponent(mint)}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000), headers: { accept: 'application/json' } });
      if (!response.ok) return failure(fetchedAt, `DexScreener returned HTTP ${response.status}.`);
      const payload = record(await response.json());
      const pairs = Array.isArray(payload.pairs) ? payload.pairs.map(record) : [];
      const pair = pairs.filter((item) => item.chainId === 'solana').sort((a, b) => (number(record(b.liquidity).usd) ?? 0) - (number(record(a.liquidity).usd) ?? 0))[0];
      if (!pair) return failure(fetchedAt, 'DexScreener returned no Solana liquidity pair for this mint.');
      const close = number(pair.priceUsd);
      const liquidity = number(record(pair.liquidity).usd);
      const volume = number(record(pair.volume).h24) ?? 0;
      if (!close || close <= 0 || !liquidity || liquidity <= 0) return failure(fetchedAt, 'DexScreener returned incomplete price or liquidity data.');
      const timestamp = number(pair.pairCreatedAt) ? Math.floor(number(pair.pairCreatedAt)! / 1000) : Math.floor(to);
      const candle: Candle = { time: timestamp, open: close, high: close, low: close, close, volume };
      return { status: 'ok', data: [candle], source: SOURCE, fetchedAt, ageMs: 0, poolAddress: String(pair.pairAddress ?? ''), poolLiquidityUsd: liquidity };
    } catch (error) {
      return failure(fetchedAt, error instanceof Error ? error.message : 'DexScreener request failed.');
    }
  }
}

const PROVIDERS: Record<string, ChartProvider> = { dexscreener: new DexScreenerProvider() };
export function getProvider(name: string): ChartProvider | null { return PROVIDERS[name] ?? null; }
export function listProviders(): string[] { return Object.keys(PROVIDERS); }
export async function fetchWithFallback(mint: string, from: number, to: number, timeframe: ChartTimeframe = 'minute', aggregate: ChartAggregate = 5) { return PROVIDERS.dexscreener.fetchCandles(mint, from, to, timeframe, aggregate); }
