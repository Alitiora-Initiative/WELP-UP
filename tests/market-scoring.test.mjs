import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreToken } from '../lib/market-scoring.ts';

const strongToken = {
  id: 'Mint111111111111111111111111111111111111111',
  name: 'Example token',
  symbol: 'EX',
  decimals: 6,
  usdPrice: 1.25,
  mcap: 1_000_000,
  liquidity: 25_000_000,
  holderCount: 150_000,
  organicScore: 100,
  isVerified: true,
  audit: {
    freezeAuthorityDisabled: true,
    mintAuthorityDisabled: true,
    topHoldersPercentage: 10,
  },
  stats1h: { priceChange: 0 },
  stats24h: { priceChange: 2, buyVolume: 1_000_000, sellVolume: 1_000_000, numBuys: 10_000, numSells: 0 },
};

test('scoreToken ports the published 80–98 weighted quality model', () => {
  const scored = scoreToken(strongToken);
  assert.equal(scored.score, 98);
  assert.equal(scored.eligible, true);
  assert.equal(scored.state, 'Eligible');
  assert.equal(scored.turnover, 100);
  assert.equal(scored.buyPressure, 100);
  assert.equal(scored.holders, 150_000);
  assert.equal(scored.mint, strongToken.id);
});

test('hard gates block freeze authority, thin liquidity, low volume and concentrated holders', () => {
  const scored = scoreToken({
    ...strongToken,
    liquidity: 99_999,
    audit: {
      freezeAuthorityDisabled: false,
      mintAuthorityDisabled: true,
      topHoldersPercentage: 61,
    },
    stats24h: { priceChange: 0, buyVolume: 20_000, sellVolume: 20_000, numBuys: 2, numSells: 2 },
  });
  assert.equal(scored.eligible, false);
  assert.equal(scored.state, 'Blocked');
  assert.equal(scored.blockers.length, 4);
});

test('soft risks remain visible as warnings without being promoted to hard blockers', () => {
  const scored = scoreToken({
    ...strongToken,
    liquidity: 200_000,
    holderCount: 500,
    organicScore: 55,
    isVerified: false,
    audit: {
      freezeAuthorityDisabled: true,
      mintAuthorityDisabled: false,
      topHoldersPercentage: 50,
    },
    stats1h: { priceChange: 10 },
    stats24h: { priceChange: -30, buyVolume: 80_000, sellVolume: 80_000, numBuys: 4, numSells: 6 },
  });
  assert.equal(scored.eligible, true);
  assert.match(scored.warnings.join(' | '), /Mint authority is active/);
  assert.match(scored.warnings.join(' | '), /Small holder base/);
  assert.match(scored.warnings.join(' | '), /Top holders own 50.0%/);
  assert.match(scored.warnings.join(' | '), /Low organic score/);
  assert.match(scored.warnings.join(' | '), /24-hour drawdown/);
  assert.match(scored.warnings.join(' | '), /not marked verified/);
});

test('missing market-cap, momentum and audit fields are explicit and do not receive invented score inputs', () => {
  const scored = scoreToken({
    ...strongToken,
    mcap: null,
    holderCount: null,
    audit: {},
    stats1h: {},
    stats24h: { buyVolume: 100_000, sellVolume: 100_000, numBuys: 5, numSells: 5 },
  });
  assert.equal(scored.turnover, null);
  assert.equal(scored.priceChange1h, null);
  assert.equal(scored.topHoldersPercent, null);
  assert.equal(scored.eligible, true);
  assert.match(scored.warnings.join(' | '), /Market cap is unavailable/);
  assert.match(scored.warnings.join(' | '), /One-hour price change is unavailable/);
  assert.match(scored.warnings.join(' | '), /Holder concentration is unavailable/);
  assert.match(scored.warnings.join(' | '), /Freeze-authority status is not reported/);
});
