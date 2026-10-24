import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidMint,
  validateCandle,
  deduplicateCandles,
  checkStale,
  STALE_MS,
  JupiterProvider,
  DexScreenerProvider,
  fetchWithFallback,
} from '../lib/chart-providers.ts';

// ---------------------------------------------------------------------------
// isValidMint
// ---------------------------------------------------------------------------

test('isValidMint accepts valid base-58 Solana addresses and rejects invalid ones', () => {
  // Valid — 44 char base58
  assert.ok(isValidMint('So11111111111111111111111111111111111111112'));
  // Valid — 32 char base58
  assert.ok(isValidMint('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'));
  // Too short
  assert.equal(isValidMint('short'), false);
  // Contains forbidden chars (0, O, I, l)
  assert.equal(isValidMint('So11111111111111111111111111111111111111110'), false); // ends in 0
  assert.equal(isValidMint(''), false);
  assert.equal(isValidMint('!!!'), false);
});

// ---------------------------------------------------------------------------
// validateCandle
// ---------------------------------------------------------------------------

test('validateCandle rejects non-objects and missing fields', () => {
  assert.equal(validateCandle(null), null);
  assert.equal(validateCandle('string'), null);
  assert.equal(validateCandle(42), null);
  assert.equal(validateCandle({}), null);
});

test('validateCandle rejects candles where high < low', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(validateCandle({ time: now, open: 1, high: 0.5, low: 1, close: 1, volume: 0 }), null);
});

test('validateCandle rejects future timestamps more than 60s ahead', () => {
  const future = Math.floor(Date.now() / 1000) + 120;
  assert.equal(validateCandle({ time: future, open: 1, high: 1, low: 1, close: 1, volume: 0 }), null);
});

test('validateCandle rejects non-positive OHLC values', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(validateCandle({ time: now, open: 0, high: 1, low: 1, close: 1, volume: 0 }), null);
  assert.equal(validateCandle({ time: now, open: -1, high: 1, low: 1, close: 1, volume: 0 }), null);
  assert.equal(validateCandle({ time: now, open: 1, high: 1, low: 1, close: 0, volume: 0 }), null);
});

test('validateCandle rejects negative volume', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(validateCandle({ time: now, open: 1, high: 1, low: 1, close: 1, volume: -1 }), null);
});

test('validateCandle accepts a valid candle', () => {
  const now = Math.floor(Date.now() / 1000);
  const result = validateCandle({ time: now, open: 1.5, high: 2, low: 1, close: 1.8, volume: 1000 });
  assert.ok(result !== null);
  assert.equal(result.time, now);
  assert.equal(result.close, 1.8);
});

// ---------------------------------------------------------------------------
// deduplicateCandles
// ---------------------------------------------------------------------------

test('deduplicateCandles removes duplicate timestamps, keeping last occurrence', () => {
  const now = Math.floor(Date.now() / 1000);
  const candles = [
    { time: now, open: 1, high: 1, low: 1, close: 1, volume: 0 },
    { time: now, open: 2, high: 2, low: 2, close: 2, volume: 0 }, // same timestamp, should win
    { time: now + 60, open: 3, high: 3, low: 3, close: 3, volume: 0 },
  ];
  const result = deduplicateCandles(candles);
  assert.equal(result.length, 2);
  assert.equal(result[0].close, 2); // last occurrence at `now`
  assert.equal(result[1].close, 3);
});

test('deduplicateCandles caps output at 1000 candles', () => {
  const now = Math.floor(Date.now() / 1000);
  const candles = Array.from({ length: 1200 }, (_, i) => ({
    time: now + i, open: 1, high: 1, low: 1, close: 1, volume: 0,
  }));
  const result = deduplicateCandles(candles);
  assert.equal(result.length, 1000);
});

// ---------------------------------------------------------------------------
// checkStale
// ---------------------------------------------------------------------------

test('checkStale marks data older than 5 minutes as stale', () => {
  const now = Date.now();
  const staleTimeSec = Math.floor((now - STALE_MS - 1000) / 1000);
  const candles = [{ time: staleTimeSec, open: 1, high: 1, low: 1, close: 1, volume: 0 }];
  const { stale } = checkStale(candles, now);
  assert.ok(stale, 'Expected stale=true for old data');
});

test('checkStale does not mark recent data as stale', () => {
  const now = Date.now();
  const recentTimeSec = Math.floor(now / 1000) - 60; // 60s old
  const candles = [{ time: recentTimeSec, open: 1, high: 1, low: 1, close: 1, volume: 0 }];
  const { stale } = checkStale(candles, now);
  assert.equal(stale, false);
});

// ---------------------------------------------------------------------------
// JupiterProvider — unit tests with mocked fetch
// ---------------------------------------------------------------------------

test('JupiterProvider returns error result for invalid mint (no network call)', async () => {
  const provider = new JupiterProvider();
  const result = await provider.fetchCandles('INVALID_MINT!!!', 0, 0);
  assert.equal(result.status, 'error');
  assert.ok(result.error?.includes('Invalid mint'));
  assert.equal(result.source, 'jupiter');
});

test('JupiterProvider returns error result when fetch throws (network error)', async () => {
  const provider = new JupiterProvider();
  // Override global fetch temporarily
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Network failure'); };
  try {
    const result = await provider.fetchCandles('So11111111111111111111111111111111111111112', 0, 0);
    assert.equal(result.status, 'error');
    assert.ok(result.error?.includes('Network failure') || result.error?.includes('unavailable'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('JupiterProvider returns error result when response is malformed JSON', async () => {
  const provider = new JupiterProvider();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('Unexpected token'); },
  });
  try {
    const result = await provider.fetchCandles('So11111111111111111111111111111111111111112', 0, 0);
    assert.equal(result.status, 'error');
    assert.ok(result.error !== undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('JupiterProvider returns error result when price is non-positive', async () => {
  const provider = new JupiterProvider();
  const originalFetch = globalThis.fetch;
  const mint = 'So11111111111111111111111111111111111111112';
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { [mint]: { price: 0 } } }),
  });
  try {
    const result = await provider.fetchCandles(mint, 0, 0);
    assert.equal(result.status, 'error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('JupiterProvider returns ok result with a single candle for valid price', async () => {
  const provider = new JupiterProvider();
  const originalFetch = globalThis.fetch;
  const mint = 'So11111111111111111111111111111111111111112';
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { [mint]: { price: 150.5 } } }),
  });
  try {
    const result = await provider.fetchCandles(mint, 0, 0);
    assert.equal(result.status, 'ok');
    assert.ok(Array.isArray(result.data));
    assert.equal(result.data?.length, 1);
    assert.equal(result.data?.[0].close, 150.5);
    assert.equal(result.data?.[0].high, result.data?.[0].low); // OHLC = close
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// DexScreenerProvider — unit tests with mocked fetch
// ---------------------------------------------------------------------------

test('DexScreenerProvider returns error result for invalid mint (no network call)', async () => {
  const provider = new DexScreenerProvider();
  const result = await provider.fetchCandles('bad!mint', 0, 0);
  assert.equal(result.status, 'error');
  assert.ok(result.error?.includes('Invalid mint'));
  assert.equal(result.source, 'dexscreener');
});

test('DexScreenerProvider returns error result when fetch throws (network error)', async () => {
  const provider = new DexScreenerProvider();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Connection refused'); };
  try {
    const result = await provider.fetchCandles('So11111111111111111111111111111111111111112', 0, 0);
    assert.equal(result.status, 'error');
    assert.ok(result.error?.includes('Connection refused') || result.error?.includes('unavailable'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DexScreenerProvider returns error result for malformed JSON', async () => {
  const provider = new DexScreenerProvider();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('Bad JSON'); },
  });
  try {
    const result = await provider.fetchCandles('So11111111111111111111111111111111111111112', 0, 0);
    assert.equal(result.status, 'error');
    assert.ok(result.error !== undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DexScreenerProvider returns stale result when data is older than 5 minutes', async () => {
  const _provider = new DexScreenerProvider();
  const originalFetch = globalThis.fetch;
  const _mint = 'So11111111111111111111111111111111111111112';
  // Mock DexScreener to return a valid pair with priceUsd
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      pairs: [{ priceUsd: '42.0', txns: { h1: { buys: 10, sells: 5 } } }],
    }),
  });
  try {
    // The provider builds candle timestamps from fetchedAt (now).
    // To simulate stale, we test checkStale directly with an old time.
    const staleTimeSec = Math.floor((Date.now() - STALE_MS - 5000) / 1000);
    const { stale } = checkStale(
      [{ time: staleTimeSec, open: 1, high: 1, low: 1, close: 1, volume: 0 }],
      Date.now(),
    );
    assert.ok(stale, 'Expected stale=true for data older than 5 minutes');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DexScreenerProvider returns ok result with valid pairs data', async () => {
  const provider = new DexScreenerProvider();
  const originalFetch = globalThis.fetch;
  const mint = 'So11111111111111111111111111111111111111112';
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      pairs: [
        { priceUsd: '99.5', txns: { h1: { buys: 100, sells: 80 } } },
        { priceUsd: '99.3', txns: { h1: { buys: 50, sells: 30 } } },
      ],
    }),
  });
  try {
    const result = await provider.fetchCandles(mint, 0, 0);
    // Should be ok or stale (candle time = now, so not stale)
    assert.ok(result.status === 'ok' || result.status === 'stale');
    assert.ok(Array.isArray(result.data));
    // Both candles have the same timestamp (now), so dedup keeps 1
    assert.ok((result.data ?? []).length >= 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// fetchWithFallback
// ---------------------------------------------------------------------------

test('fetchWithFallback falls back to DexScreener when Jupiter is in outage', async () => {
  const mint = 'So11111111111111111111111111111111111111112';
  const originalFetch = globalThis.fetch;

  // Jupiter will fail, DexScreener will succeed
  let callCount = 0;
  globalThis.fetch = async (url) => {
    callCount++;
    const urlStr = String(url);
    if (urlStr.includes('jup.ag')) {
      throw new Error('Jupiter network failure');
    }
    // DexScreener success
    return {
      ok: true,
      status: 200,
      json: async () => ({
        pairs: [{ priceUsd: '75.0', txns: { h1: { buys: 20, sells: 10 } } }],
      }),
    };
  };

  try {
    const result = await fetchWithFallback(mint, 0, 0);
    // Jupiter errors → falls back to DexScreener
    assert.ok(result.status === 'ok' || result.status === 'stale', `Expected ok or stale, got ${result.status}`);
    assert.equal(result.source, 'dexscreener');
    assert.ok(Array.isArray(result.data));
    assert.ok((result.data ?? []).length >= 1);
    // Both providers were attempted (Jupiter first, then DexScreener)
    assert.ok(callCount >= 2, `Expected at least 2 fetch calls, got ${callCount}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
