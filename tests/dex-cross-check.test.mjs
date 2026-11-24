import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDexScreenerTokenPairs } from '../lib/dexscreener-cross-check.ts';

const mintA = 'So11111111111111111111111111111111111111112';
const mintB = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

test('matches the highest-liquidity Solana base-token pair and reports price variance', () => {
  const checks = parseDexScreenerTokenPairs(
    [mintA],
    { [mintA]: 100 },
    [
      { chainId: 'solana', pairAddress: 'PoolLow11111111111111111111111111111111111', baseToken: { address: mintA }, priceUsd: '101', liquidity: { usd: 1000 }, volume: { h24: 500 } },
      { chainId: 'solana', pairAddress: 'PoolHigh1111111111111111111111111111111111', baseToken: { address: mintA }, priceUsd: '102', liquidity: { usd: 5000 }, volume: { h24: 2500 } },
      { chainId: 'ethereum', pairAddress: 'WrongChain111111111111111111111111111111', baseToken: { address: mintA }, priceUsd: '999', liquidity: { usd: 999999 } },
    ],
  );
  assert.equal(checks[mintA].state, 'matched');
  assert.equal(checks[mintA].priceUsd, 102);
  assert.equal(checks[mintA].liquidityUsd, 5000);
  assert.equal(checks[mintA].volume24hUsd, 2500);
  assert.equal(checks[mintA].priceDeltaPct, 2);
});

test('leaves absent pairs explicit and does not invent a price comparison', () => {
  const checks = parseDexScreenerTokenPairs([mintB], {}, []);
  assert.deepEqual(checks[mintB], { provider: 'DexScreener', state: 'no_pair' });
});

test('ignores invalid mints and malformed provider rows', () => {
  const checks = parseDexScreenerTokenPairs(
    ['not-a-solana-mint', mintA],
    { [mintA]: 100 },
    [null, { chainId: 'solana', baseToken: { address: mintA }, priceUsd: 'bad' }],
  );
  assert.equal(Object.keys(checks).length, 1);
  assert.equal(checks[mintA].state, 'no_pair');
});
