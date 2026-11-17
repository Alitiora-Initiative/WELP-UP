import assert from 'node:assert/strict';
import test from 'node:test';
import { DexScreenerProvider, isValidMint } from '../lib/chart-providers.ts';

const MINT = 'So11111111111111111111111111111111111111112';
const LIQUID_PAIR = 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE';
const SECOND_PAIR = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function pairs() {
  return {
    pairs: [
      { chainId: 'solana', pairAddress: SECOND_PAIR, priceUsd: '1', liquidity: { usd: 2_500 }, volume: { h24: 600 } },
      { chainId: 'ethereum', pairAddress: LIQUID_PAIR, priceUsd: '20', liquidity: { usd: 900_000 }, volume: { h24: 4_000_000 } },
      { chainId: 'solana', pairAddress: LIQUID_PAIR, priceUsd: '149.25', priceChange: { h24: 2.4 }, liquidity: { usd: 90_000 }, volume: { h24: 1_500_000 } },
    ],
  };
}

test('isValidMint accepts base58 Solana addresses and rejects malformed values', () => {
  assert.equal(isValidMint(MINT), true);
  assert.equal(isValidMint('short'), false);
  assert.equal(isValidMint('So11111111111111111111111111111111111111110'), false);
  assert.equal(isValidMint(''), false);
  assert.equal(isValidMint('!!!'), false);
});

test('DexScreener selects the most liquid Solana pair and returns real pair metrics', async () => {
  const provider = new DexScreenerProvider();
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return response(pairs());
  };
  try {
    const result = await provider.fetchPair(MINT);
    assert.equal(result.status, 'ok');
    assert.equal(result.source, 'DexScreener');
    assert.equal(result.data?.pairAddress, LIQUID_PAIR);
    assert.equal(result.data?.priceUsd, 149.25);
    assert.equal(result.data?.liquidityUsd, 90_000);
    assert.equal(result.data?.volume24hUsd, 1_500_000);
    assert.equal(result.data?.priceChange24h, 2.4);
    assert.equal(requestedUrl, `https://api.dexscreener.com/latest/dex/tokens/${MINT}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DexScreener rejects malformed mints without a network request', async () => {
  const provider = new DexScreenerProvider();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('unexpected network call'); };
  try {
    const result = await provider.fetchPair('not-a-mint');
    assert.equal(result.status, 'error');
    assert.match(result.error ?? '', /invalid/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DexScreener rejects missing liquidity pairs and does not invent OHLC candles', async () => {
  const provider = new DexScreenerProvider();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ pairs: [{ chainId: 'solana', pairAddress: LIQUID_PAIR, priceUsd: '1', liquidity: { usd: 0 } }] });
  try {
    const result = await provider.fetchPair(MINT);
    assert.equal(result.status, 'error');
    assert.match(result.error ?? '', /no Solana liquidity pair/i);
    assert.equal('candles' in (result.data ?? {}), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DexScreener provider reports upstream errors without fabricated market data', async () => {
  const provider = new DexScreenerProvider();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response({}, 429);
  try {
    const result = await provider.fetchPair(MINT);
    assert.equal(result.status, 'error');
    assert.match(result.error ?? '', /429/);
    assert.equal(result.data, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
