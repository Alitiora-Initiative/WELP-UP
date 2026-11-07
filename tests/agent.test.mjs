import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAnalystSnapshot,
  extractResponsesText,
  normalizeAnalystQuestion,
} from '../lib/market-analyst.ts';

test('normalizeAnalystQuestion trims valid questions and rejects empty or oversized input', () => {
  assert.equal(normalizeAnalystQuestion('  Explain liquidity risks  '), 'Explain liquidity risks');
  assert.equal(normalizeAnalystQuestion('   '), null);
  assert.equal(normalizeAnalystQuestion('x'.repeat(501)), null);
  assert.equal(normalizeAnalystQuestion({ question: 'not a string' }), null);
});

test('buildAnalystSnapshot includes only bounded public market fields', () => {
  const snapshot = buildAnalystSnapshot({
    updatedAt: '2026-11-07T10:00:00.000Z',
    total: 25,
    assets: [{
      mint: 'public-mint',
      name: 'Example token',
      symbol: 'EX',
      priceUsd: '1.25',
      priceChange24h: -3.5,
      liquidityUsd: 120000,
      volume24hUsd: 45000,
      organicScore: 82,
      score: 91,
      verified: true,
      eligible: true,
      blockers: [],
      warnings: ['Holder concentration unavailable'],
      privateKey: 'must-not-be-forwarded',
      walletAddress: 'must-not-be-forwarded',
    }],
  });
  assert.equal(snapshot.assets.length, 1);
  assert.equal(snapshot.assets[0].priceUsd, 1.25);
  assert.equal(snapshot.assets[0].eligible, true);
  assert.deepEqual(snapshot.assets[0].warnings, ['Holder concentration unavailable']);
  assert.equal('mint' in snapshot.assets[0], false);
  assert.equal('privateKey' in snapshot.assets[0], false);
  assert.equal('walletAddress' in snapshot.assets[0], false);
});

test('buildAnalystSnapshot caps rows and normalizes malformed input', () => {
  const assets = Array.from({ length: 30 }, (_, index) => ({ name: 'Token ' + index, score: index }));
  const snapshot = buildAnalystSnapshot({ assets, updatedAt: 42 });
  assert.equal(snapshot.assets.length, 18);
  assert.equal(snapshot.updatedAt, null);
  assert.equal(snapshot.total, 30);
  assert.equal(snapshot.assets[0].priceUsd, null);
  assert.equal(buildAnalystSnapshot(null).assets.length, 0);
});

test('extractResponsesText joins only model output text blocks', () => {
  const text = extractResponsesText({
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', content: [
        { type: 'output_text', text: 'Market structure is mixed.' },
        { type: 'refusal', refusal: 'hidden' },
        { type: 'output_text', text: 'Liquidity remains a key risk.' },
      ] },
    ],
  });
  assert.equal(text, 'Market structure is mixed.\nLiquidity remains a key risk.');
  assert.equal(extractResponsesText({ output: [] }), '');
});
