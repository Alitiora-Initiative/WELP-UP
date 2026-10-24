/**
 * chart-providers.ts
 * Typed provider adapters for multi-source candle data.
 * All external data is treated as untrusted.
 */

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ProviderResult<T> = {
  status: 'ok' | 'stale' | 'error';
  data?: T;
  source: string;
  fetchedAt: number;
  error?: string;
  ageMs?: number;
};

export interface ChartProvider {
  name: string;
  fetchCandles(mint: string, from: number, to: number): Promise<ProviderResult<Candle[]>>;
}

// Mint address must match base-58 Solana format (32–44 chars, no 0/O/I/l)
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Data older than 5 minutes is considered stale
const STALE_MS = 5 * 60 * 1000;

// How long to mark a provider unavailable after a failure (ms)
const OUTAGE_BACKOFF_MS = 30 * 1000;

// Max candles to accept per response
const MAX_CANDLES = 1000;

/**
 * Validate a mint address. Returns true if valid.
 */
export function isValidMint(mint: string): boolean {
  return MINT_RE.test(mint);
}

/**
 * Validate and clean a single candle. Returns null if invalid.
 */
function validateCandle(raw: unknown): Candle | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as Record<string, unknown>;
  const time = Number(c.time);
  const open = Number(c.open);
  const high = Number(c.high);
  const low = Number(c.low);
  const close = Number(c.close);
  const volume = Number(c.volume);
  // All numeric fields must be finite
  if (!Number.isFinite(time) || !Number.isFinite(open) || !Number.isFinite(high) ||
      !Number.isFinite(low) || !Number.isFinite(close) || !Number.isFinite(volume)) return null;
  // Timestamps must be > 0 and not more than 60s in the future
  if (time <= 0 || time > (Date.now() / 1000) + 60) return null;
  // OHLC must be positive; volume non-negative
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) return null;
  // high must be >= low
  if (high < low) return null;
  return { time, open, high, low, close, volume };
}

/**
 * Deduplicate candles by timestamp, keeping the last occurrence.
 * Then cap at MAX_CANDLES.
 */
function deduplicateCandles(candles: Candle[]): Candle[] {
  const seen = new Map<number, Candle>();
  for (const c of candles) seen.set(c.time, c);
  const result = [...seen.values()].sort((a, b) => a.time - b.time);
  return result.slice(0, MAX_CANDLES);
}

/**
 * Determine staleness: if the most recent candle time is > 5min ago, mark stale.
 */
function checkStale(candles: Candle[], fetchedAt: number): { stale: boolean; ageMs: number } {
  if (candles.length === 0) return { stale: false, ageMs: 0 };
  const latestSec = Math.max(...candles.map((c) => c.time));
  const ageMs = fetchedAt - latestSec * 1000;
  return { stale: ageMs > STALE_MS, ageMs };
}

// ---------------------------------------------------------------------------
// JupiterProvider
// Uses https://price.jup.ag/v6/price?ids={mint} for current price.
// Returns a single synthetic candle (OHLC = close = current price).
// Outage backoff is tracked per-instance so tests with fresh instances start clean,
// while the module-level singleton (PROVIDERS) correctly persists backoff across requests.
// ---------------------------------------------------------------------------

export class JupiterProvider implements ChartProvider {
  readonly name = 'jupiter';
  private outageUntil = 0;

  private isInOutage(): boolean {
    return Date.now() < this.outageUntil;
  }

  private markOutage(): void {
    this.outageUntil = Date.now() + OUTAGE_BACKOFF_MS;
  }

  async fetchCandles(mint: string, _from: number, _to: number): Promise<ProviderResult<Candle[]>> {
    if (!isValidMint(mint)) {
      return { status: 'error', source: this.name, fetchedAt: Date.now(), error: 'Invalid mint address.' };
    }
    if (this.isInOutage()) {
      return { status: 'error', source: this.name, fetchedAt: Date.now(), error: 'Provider temporarily unavailable. Retry in 30s.' };
    }
    const fetchedAt = Date.now();
    try {
      const url = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(mint)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
      if (!response.ok) {
        this.markOutage();
        return { status: 'error', source: this.name, fetchedAt, error: `Jupiter price API returned ${response.status}.` };
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        this.markOutage();
        return { status: 'error', source: this.name, fetchedAt, error: 'Malformed JSON from Jupiter price API.' };
      }
      // Parse: { data: { [mint]: { price: number, ... } } }
      const data = (json as Record<string, unknown>)?.data;
      if (typeof data !== 'object' || data === null) {
        return { status: 'error', source: this.name, fetchedAt, error: 'Unexpected Jupiter price response shape.' };
      }
      const entry = (data as Record<string, unknown>)[mint];
      if (typeof entry !== 'object' || entry === null) {
        return { status: 'error', source: this.name, fetchedAt, error: 'Mint not found in Jupiter price response.' };
      }
      const price = Number((entry as Record<string, unknown>).price);
      if (!Number.isFinite(price) || price <= 0) {
        return { status: 'error', source: this.name, fetchedAt, error: 'Jupiter returned invalid price.' };
      }
      const timeSec = Math.floor(fetchedAt / 1000);
      // Future-timestamp check: must not be more than 60s in the future
      if (timeSec > Math.floor(Date.now() / 1000) + 60) {
        return { status: 'error', source: this.name, fetchedAt, error: 'Candle timestamp is in the future.' };
      }
      const candle: Candle = { time: timeSec, open: price, high: price, low: price, close: price, volume: 0 };
      const ageMs = 0; // current price, not stale
      return { status: 'ok', data: [candle], source: this.name, fetchedAt, ageMs };
    } catch (err) {
      this.markOutage();
      const message = err instanceof Error ? err.message : 'Network error.';
      return { status: 'error', source: this.name, fetchedAt, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// DexScreenerProvider
// Uses https://api.dexscreener.com/latest/dex/tokens/{mint}
// Returns candles synthesized from pair price data if available.
// ---------------------------------------------------------------------------

export class DexScreenerProvider implements ChartProvider {
  readonly name = 'dexscreener';
  private outageUntil = 0;

  private isInOutage(): boolean {
    return Date.now() < this.outageUntil;
  }

  private markOutage(): void {
    this.outageUntil = Date.now() + OUTAGE_BACKOFF_MS;
  }

  async fetchCandles(mint: string, _from: number, _to: number): Promise<ProviderResult<Candle[]>> {
    if (!isValidMint(mint)) {
      return { status: 'error', source: this.name, fetchedAt: Date.now(), error: 'Invalid mint address.' };
    }
    if (this.isInOutage()) {
      return { status: 'error', source: this.name, fetchedAt: Date.now(), error: 'Provider temporarily unavailable. Retry in 30s.' };
    }
    const fetchedAt = Date.now();
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
      if (!response.ok) {
        this.markOutage();
        return { status: 'error', source: this.name, fetchedAt, error: `DexScreener API returned ${response.status}.` };
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        this.markOutage();
        return { status: 'error', source: this.name, fetchedAt, error: 'Malformed JSON from DexScreener API.' };
      }
      const payload = json as Record<string, unknown>;
      const pairs = Array.isArray(payload?.pairs) ? (payload.pairs as unknown[]) : [];
      if (pairs.length === 0) {
        return { status: 'error', source: this.name, fetchedAt, error: 'No pairs found for this mint on DexScreener.' };
      }
      const rawCandles: Candle[] = [];
      for (const pair of pairs.slice(0, 20)) {
        if (typeof pair !== 'object' || pair === null) continue;
        const p = pair as Record<string, unknown>;
        const priceUsd = Number(p.priceUsd);
        if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue;
        const txns = typeof p.txns === 'object' && p.txns !== null ? (p.txns as Record<string, unknown>) : {};
        // Use h1 or h24 volume if available
        const vol =
          Number((typeof txns.h1 === 'object' && txns.h1 !== null ? (txns.h1 as Record<string, unknown>).buys : 0) ?? 0) +
          Number((typeof txns.h1 === 'object' && txns.h1 !== null ? (txns.h1 as Record<string, unknown>).sells : 0) ?? 0);
        const volumeUsd = Number.isFinite(vol) && vol >= 0 ? vol : 0;
        const timeSec = Math.floor(fetchedAt / 1000);
        // Clamp: not in the future
        if (timeSec > Math.floor(Date.now() / 1000) + 60) continue;
        const candle: Candle = { time: timeSec, open: priceUsd, high: priceUsd, low: priceUsd, close: priceUsd, volume: volumeUsd };
        rawCandles.push(candle);
      }
      if (rawCandles.length === 0) {
        return { status: 'error', source: this.name, fetchedAt, error: 'No valid price data in DexScreener response.' };
      }
      const candles = deduplicateCandles(rawCandles);
      const { stale, ageMs } = checkStale(candles, fetchedAt);
      return { status: stale ? 'stale' : 'ok', data: candles, source: this.name, fetchedAt, ageMs };
    } catch (err) {
      this.markOutage();
      const message = err instanceof Error ? err.message : 'Network error.';
      return { status: 'error', source: this.name, fetchedAt, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const PROVIDERS: Record<string, ChartProvider> = {
  jupiter: new JupiterProvider(),
  dexscreener: new DexScreenerProvider(),
};

export function getProvider(name: string): ChartProvider | null {
  return PROVIDERS[name] ?? null;
}

export function listProviders(): string[] {
  return Object.keys(PROVIDERS);
}

// ---------------------------------------------------------------------------
// fetchWithFallback
// Tries providers in order (Jupiter first, then DexScreener).
// Returns the first 'ok' result, or the best available result (stale > error).
// ---------------------------------------------------------------------------

export async function fetchWithFallback(
  mint: string,
  from: number,
  to: number,
): Promise<ProviderResult<Candle[]>> {
  const order: ChartProvider[] = [PROVIDERS.jupiter, PROVIDERS.dexscreener];
  let bestResult: ProviderResult<Candle[]> | null = null;

  for (const provider of order) {
    const result = await provider.fetchCandles(mint, from, to);
    if (result.status === 'ok') {
      return result;
    }
    // Keep a stale result in preference to an error result
    if (
      bestResult === null ||
      (result.status === 'stale' && bestResult.status === 'error')
    ) {
      bestResult = result;
    }
  }

  // Return the best we have (stale or error); guaranteed non-null since order.length >= 1
  return bestResult!;
}

// Export validation and dedup helpers for testing
export { validateCandle, deduplicateCandles, checkStale, STALE_MS, OUTAGE_BACKOFF_MS };
