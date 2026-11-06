import assert from 'node:assert/strict';
import test from 'node:test';
import { formatLamports, parseSolToLamports } from '../lib/vault-client.ts';

test('parseSolToLamports converts SOL strings to exact lamport bigints and rejects invalid input', () => {
  assert.equal(parseSolToLamports('1'), 1_000_000_000n);
  assert.equal(parseSolToLamports('0.001'), 1_000_000n);
  assert.equal(parseSolToLamports('0.02'), 20_000_000n);
  assert.equal(parseSolToLamports('100'), 100_000_000_000n);
  assert.equal(parseSolToLamports('0.000000001'), 1n);
  assert.equal(parseSolToLamports(''), null);
  assert.equal(parseSolToLamports('abc'), null);
  assert.equal(parseSolToLamports('-1'), null);
  assert.equal(parseSolToLamports('1.0000000001'), null);
});

test('formatLamports formats bigint lamports without imposing deposit or withdrawal ceilings', () => {
  assert.equal(formatLamports(0n), '0.0000');
  assert.equal(formatLamports(1_000_000_000n), '1.0000');
  assert.equal(formatLamports(1_000_000n), '0.0010');
  assert.equal(formatLamports(20_000_000n), '0.0200');
  assert.equal(formatLamports(100_000_000_000n), '100.0000');
  assert.equal(formatLamports(1_500_000_000n, 2), '1.50');
  assert.equal(formatLamports(1_500_000_000n, 0), '1');
  assert.equal(formatLamports(1_500_000_000_000n, 3), '1,500.000');
});
