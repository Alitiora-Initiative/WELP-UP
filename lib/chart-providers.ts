/**
 * Live OHLCV provider.
 *
 * Candles are sourced from GeckoTerminal's pool OHLCV endpoint. Price-only
 * token endpoints are deliberately not converted into synthetic candles.
 */
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

export type ProviderResult<T> = {
  status: 'ok' | 'stale' | 'error';
  data?: T;
  source: string;
  fetchedAt: number;
  error?: string;
  ageMs?: number;
  poolAddress?: string;
  poolLiquidityUsd?: number;
};

export interface ChartProvider {
  name: string;
  fetchCandles(
    mint: string,
    from: number,
    to: number,
    timeframe: ChartTimeframe,
    aggregate: ChartAggregate,
  ): Promise<ProviderResult<Candle[]>>;
}

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const STALE_MS = 5 * 60 * 1000;
export const OUTAGE_BACKOFF_MS = 30 * 1000;
export const MAX_CANDLES = 1000;
const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';
const GECKO_ACCEPT = 'application/json;version=20230203';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function isValidMint(mint: string): boolean {
  return MINT_RE.test(mint);
}

export function validateCandle(raw: unknown): Candle | null {
  if (!Array.isArray(raw) || raw.length < 6) return null;
  const time = asFiniteNumber(raw[0]);
  const open = asFiniteNumber(raw[1]);
  const high = asFiniteNumber(raw[2]);
  const low = asFiniteNumber(raw[3]);
  const close = asFiniteNumber(raw[4]);
  const volume = asFiniteNumber(raw[5]);

  if (time === null || open === null || high === null || low === null || close === null || volume === null) return null;
  if (!Number.isInteger(time) || time <= 0 || time > Math.floor(Date.now() / 1000) + 60) return null;
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) return null;
  if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) return null;

  return { time, open, high, low, close, volume };
}

export function deduplicateCandles(candles: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const candle of candles) byTime.set(candle.time, candle);
  return [...byTime.values()].sort((a, b) => a.time - b.time).slice(-MAX_CANDLES);
}

export function checkStale(candles: Candle[], fetchedAt: number): { stale: boolean; ageMs: number } {
  if (candles.length === 0) return { stale: true, ageMs: Number.POSITIVE_INFINITY };
  const latest = candles[candles.length - 1];
  const ageMs = Math.max(0, fetchedAt - latest.time * 1000);
  return { stale: ageMs > STALE_MS, ageMs };
}

function failure(source: string, fetchedAt: number, error: string): ProviderResult<Candle[]> {
  return { status: 'error', source, fetchedAt, error };
}

function validInterval(timeframe: ChartTimeframe, aggregate: ChartAggregate): boolean {
  if (timeframe === 'minute') return aggregate === 1 || aggregate === 5 || aggregate === 15;
  if (timeframe === 'hour') return aggregate === 1 || aggregate === 4 || aggregate === 12;
  return timeframe === 'day' && aggregate === 1;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('GeckoTerminal returned malformed JSON.');
  }
}

export class GeckoTerminalProvider implements ChartProvider {
  readonly name = 'geckoterminal';
  private outageUntil = 0;

  async fetchCandles(
    mint: string,
    _from: number,
    to: number,
    timeframe: ChartTimeframe = 'minute',
    aggregate: ChartAggregate = 5,
  ): Promise<ProviderResult<Candle[]>> {
    const fetchedAt = Date.now();
    if (!isValidMint(mint)) return failure(this.name, fetchedAt, 'Invalid Solana mint address.');
    if (!validInterval(timeframe, aggregate)) return failure(this.name, fetchedAt, 'Unsupported GeckoTerminal candle interval.');
    if (!Number.isSafeInteger(to) || to <= 0) return failure(this.name, fetchedAt, 'Invalid chart end timestamp.');
    if (Date.now() < this.outageUntil) {
      return failure(this.name, fetchedAt, 'GeckoTerminal is temporarily rate-limited or unavailable. Retry shortly.');
    }

    try {
      const poolUrl = new URL(`${GECKO_BASE}/networks/solana/tokens/${encodeURIComponent(mint)}/pools`);
      poolUrl.searchParams.set('page', '1');
      poolUrl.searchParams.set('include', 'dex');

      const poolResponse = await fetch(poolUrl, {
        headers: { accept: GECKO_ACCEPT },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      if (!poolResponse.ok) {
        if (poolResponse.status === 429 || poolResponse.status >= 500) this.outageUntil = Date.now() + OUTAGE_BACKOFF_MS;
        return failure(this.name, fetchedAt, `GeckoTerminal pool lookup returned HTTP ${poolResponse.status}.`);
      }

      const poolPayload = asRecord(await readJson(poolResponse));
      const poolRows = Array.isArray(poolPayload.data) ? poolPayload.data : [];
      const candidates = poolRows.map((row) => {
        const entry = asRecord(row);
        const attrs = asRecord(entry.attributes);
        const id = typeof entry.id === 'string' ? entry.id : '';
        const addressFromId = id.startsWith('solana_') ? id.slice('solana_'.length) : '';
        const address = typeof attrs.address === 'string' ? attrs.address : addressFromId;
        const liquidity = asFiniteNumber(attrs.reserve_in_usd);
        return { address, liquidity };
      }).filter((pool): pool is { address: string; liquidity: number } =>
        isValidMint(pool.address) &&
        typeof pool.liquidity === 'number' &&
        Number.isFinite(pool.liquidity) &&
        pool.liquidity > 0
      ).sort((a, b) => b.liquidity - a.liquidity);

      const selectedPool = candidates[0];
      if (!selectedPool) {
        return failure(this.name, fetchedAt, 'GeckoTerminal has no pool with a verifiable positive USD liquidity value for this mint.');
      }

      const ohlcvUrl = new URL(`${GECKO_BASE}/networks/solana/pools/${encodeURIComponent(selectedPool.address)}/ohlcv/${timeframe}`);
      ohlcvUrl.searchParams.set('aggregate', String(aggregate));
      ohlcvUrl.searchParams.set('limit', '500');
      ohlcvUrl.searchParams.set('currency', 'usd');
      ohlcvUrl.searchParams.set('token', mint);
      ohlcvUrl.searchParams.set('before_timestamp', String(to));

      const candleResponse = await fetch(ohlcvUrl, {
        headers: { accept: GECKO_ACCEPT },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      if (!candleResponse.ok) {
        if (candleResponse.status === 429 || candleResponse.status >= 500) this.outageUntil = Date.now() + OUTAGE_BACKOFF_MS;
        return failure(this.name, fetchedAt, `GeckoTerminal OHLCV request returned HTTP ${candleResponse.status}.`);
      }

      const candlePayload = asRecord(await readJson(candleResponse));
      const data = asRecord(candlePayload.data);
      const attributes = asRecord(data.attributes);
      const rawRows = Array.isArray(attributes.ohlcv_list) ? attributes.ohlcv_list : [];
      const candles = deduplicateCandles(rawRows.map(validateCandle).filter((candle): candle is Candle => candle !== null));
      if (candles.length === 0) {
        return failure(this.name, fetchedAt, 'GeckoTerminal returned no valid OHLCV candles for the selected pool and interval.');
      }

      const freshness = checkStale(candles, fetchedAt);
      return {
        status: freshness.stale ? 'stale' : 'ok',
        data: candles,
        source: this.name,
        fetchedAt,
        ageMs: freshness.ageMs,
        poolAddress: selectedPool.address,
        poolLiquidityUsd: selectedPool.liquidity,
      };
    } catch (error) {
      this.outageUntil = Date.now() + OUTAGE_BACKOFF_MS;
      const message = error instanceof Error ? error.message : 'GeckoTerminal request failed.';
      return failure(this.name, fetchedAt, message);
    }
  }
}

const PROVIDERS: Record<string, ChartProvider> = {
  geckoterminal: new GeckoTerminalProvider(),
};

export function getProvider(name: string): ChartProvider | null {
  return PROVIDERS[name] ?? null;
}

export function listProviders(): string[] {
  return Object.keys(PROVIDERS);
}

/** A single verified OHLCV source is used; price-only APIs are never fallback candles. */
export async function fetchWithFallback(
  mint: string,
  from: number,
  to: number,
  timeframe: ChartTimeframe = 'minute',
  aggregate: ChartAggregate = 5,
): Promise<ProviderResult<Candle[]>> {
  return PROVIDERS.geckoterminal.fetchCandles(mint, from, to, timeframe, aggregate);
}
