import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidMint,
  validateCandle,
  deduplicateCandles,
  checkStale,
  STALE_MS,
  GeckoTerminalProvider,
  fetchWithFallback,
} from '../lib/chart-providers.ts';

const MINT = 'So11111111111111111111111111111111111111112';
const LIQUID_POOL = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SECOND_POOL = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function geckoPools() {
  return {
    data: [
      { id: 'solana_low-liquidity', attributes: { address: SECOND_POOL, reserve_in_usd: '2500' } },
      { id: 'solana_high-liquidity', attributes: { address: LIQUID_POOL, reserve_in_usd: '90000' } },
    ],
  };
}

function geckoCandles(now = Math.floor(Date.now() / 1000)) {
  return {
    data: {
      attributes: {
        ohlcv_list: [
          [now - 600, 10, 12, 9, 11, 1000],
          [now - 300, 11, 13, 10, 12, 1500],
          [now, 12, 14, 11, 13, 2000],
        ],
      },
    },
  };
}

test('isValidMint accepts base58 Solana addresses and rejects malformed values', () => {
  assert.equal(isValidMint(MINT), true);
  assert.equal(isValidMint('short'), false);
  assert.equal(isValidMint('So11111111111111111111111111111111111111110'), false);
  assert.equal(isValidMint(''), false);
  assert.equal(isValidMint('!!!'), false);
});

test('validateCandle rejects malformed rows and OHLC violations', () => {
  assert.equal(validateCandle(null), null);
  assert.equal(validateCandle('candle'), null);
  assert.equal(validateCandle([1, 1, 0.5, 1, 1, 0]), null);
  assert.equal(validateCandle([1, 1, 2, 1, 3, 0]), null);
  assert.equal(validateCandle([1, 0, 2, 0, 1, 0]), null);
  assert.equal(validateCandle([1, 1, 2, 1, 1, -1]), null);
  assert.equal(validateCandle([Math.floor(Date.now() / 1000) + 120, 1, 2, 1, 1, 1]), null);
});

test('validateCandle accepts a structurally valid OHLCV row', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.deepEqual(validateCandle([now, 10, 13, 9, 11, 200]), {
    time: now, open: 10, high: 13, low: 9, close: 11, volume: 200,
  });
});

test('deduplicateCandles keeps the last row for each timestamp and sorts ascending', () => {
  const candles = [
    { time: 3, open: 2, high: 3, low: 1, close: 2, volume: 1 },
    { time: 1, open: 1, high: 2, low: 1, close: 2, volume: 2 },
    { time: 3, open: 2, high: 4, low: 2, close: 4, volume: 3 },
  ];
  assert.deepEqual(deduplicateCandles(candles), [
    { time: 1, open: 1, high: 2, low: 1, close: 2, volume: 2 },
    { time: 3, open: 2, high: 4, low: 2, close: 4, volume: 3 },
  ]);
});

test('deduplicateCandles enforces the documented maximum candle count', () => {
  const candles = Array.from({ length: 1200 }, (_, index) => ({
    time: index + 1, open: 1, high: 2, low: 1, close: 1, volume: 1,
  }));
  assert.equal(deduplicateCandles(candles).length, 1000);
});

test('checkStale marks OHLCV data older than five minutes', () => {
  const now = Date.now();
  const stale = [{ time: Math.floor((now - STALE_MS - 1000) / 1000), open: 1, high: 2, low: 1, close: 1, volume: 1 }];
  assert.equal(checkStale(stale, now).stale, true);
});

test('GeckoTerminalProvider rejects invalid mint without a network request', async () => {
  const provider = new GeckoTerminalProvider();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('unexpected network call'); };
  try {
    const result = await provider.fetchCandles('not-a-mint', 0, Math.floor(Date.now() / 1000), 'minute', 5);
    assert.equal(result.status, 'error');
    assert.match(result.error ?? '', /invalid/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GeckoTerminalProvider selects the most liquid pool and returns real OHLCV rows', async () => {
  const provider = new GeckoTerminalProvider();
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('/tokens/')) return response(geckoPools());
    return response(geckoCandles());
  };
  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await provider.fetchCandles(MINT, now - 3600, now, 'minute', 5);
    assert.equal(result.status, 'ok');
    assert.equal(result.source, 'geckoterminal');
    assert.equal(result.poolAddress, LIQUID_POOL);
    assert.equal(result.poolLiquidityUsd, 90000);
    assert.equal(result.data?.length, 3);
    assert.deepEqual(result.data?.[1], { time: now - 300, open: 11, high: 13, low: 10, close: 12, volume: 1500 });
    assert.equal(urls.length, 2);
    assert.match(urls[1], new RegExp(`/pools/${LIQUID_POOL}/ohlcv/minute\\?`));
    assert.match(urls[1], /aggregate=5/);
    assert.match(urls[1], /currency=usd/);
    assert.match(urls[1], new RegExp(`token=${MINT}`));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GeckoTerminalProvider refuses to guess a pool when liquidity is missing', async () => {
  const provider = new GeckoTerminalProvider();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response({
    data: [{ id: 'solana_pool', attributes: { address: LIQUID_POOL, reserve_in_usd: null } }],
  });
  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await provider.fetchCandles(MINT, 0, now, 'minute', 5);
    assert.equal(result.status, 'error');
    assert.match(result.error ?? '', /positive USD liquidity/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GeckoTerminalProvider does not convert a current price response into a fake candle', async () => {
  const provider = new GeckoTerminalProvider();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ data: { [MINT]: { price: 123.45 } } });
  try {
    const result = await provider.fetchCandles(MINT, 0, Math.floor(Date.now() / 1000), 'minute', 5);
    assert.equal(result.status, 'error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchWithFallback uses the one configured real OHLCV source only', async () => {
  const provider = new GeckoTerminalProvider();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1 ? response(geckoPools()) : response(geckoCandles());
  };
  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await fetchWithFallback(MINT, 0, now, 'minute', 1);
    assert.equal(result.status, 'ok');
    assert.equal(result.source, 'geckoterminal');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
