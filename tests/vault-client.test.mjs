import assert from 'node:assert/strict';
import test from 'node:test';
import { formatLamports, parseSolToLamports } from '../lib/vault-client.ts';

// Blueprint vault limits: 100 SOL aggregate cap (hard max), 0.02 SOL per-position max.
const MAX_AGGREGATE_LAMPORTS = 100_000_000_000n; // 100 SOL
const MAX_POSITION_LAMPORTS = 20_000_000n;       // 0.02 SOL

test('parseSolToLamports converts SOL strings to exact lamport bigints and rejects invalid input', () => {
  assert.equal(parseSolToLamports('1'), 1_000_000_000n);
  assert.equal(parseSolToLamports('0.001'), 1_000_000n);
  assert.equal(parseSolToLamports('0.02'), 20_000_000n);
  assert.equal(parseSolToLamports('100'), 100_000_000_000n);
  assert.equal(parseSolToLamports('100.000000000'), 100_000_000_000n);
  // Boundary: one lamport
  assert.equal(parseSolToLamports('0.000000001'), 1n);
  // Rejects non-numeric input
  assert.equal(parseSolToLamports(''), null);
  assert.equal(parseSolToLamports('abc'), null);
  assert.equal(parseSolToLamports('-1'), null);
  assert.equal(parseSolToLamports('1.0000000001'), null); // 10 decimal places — too many
});

test('formatLamports formats bigint lamports as SOL strings with correct decimal places', () => {
  assert.equal(formatLamports(0n), '0.0000');
  assert.equal(formatLamports(1_000_000_000n), '1.0000');
  assert.equal(formatLamports(1_000_000n), '0.0010');
  assert.equal(formatLamports(20_000_000n), '0.0200');
  assert.equal(formatLamports(100_000_000_000n), '100.0000');
  // Custom fractionDigits
  assert.equal(formatLamports(1_500_000_000n, 2), '1.50');
  assert.equal(formatLamports(1_500_000_000n, 0), '1');
  // Round-trip: parseSolToLamports then formatLamports
  const lamports = parseSolToLamports('0.02');
  assert.ok(lamports !== null);
  assert.equal(formatLamports(lamports, 9), '0.020000000');
});

test('vault limit constants match the configured 100 SOL aggregate cap and 0.02 SOL per-position max', () => {
  // These constants must match the blueprint caps enforced in VaultPage.tsx and the Anchor program.
  // MAX_POSITION_LAMPORTS = 20_000_000n (0.02 SOL) — see VaultPage.tsx MAX_POSITION_LAMPORTS.
  // MAX_AGGREGATE_LAMPORTS = 100_000_000_000n (100 SOL) — blueprint 2026-10-24 log.
  assert.equal(parseSolToLamports('0.02'), MAX_POSITION_LAMPORTS);
  assert.equal(parseSolToLamports('100'), MAX_AGGREGATE_LAMPORTS);
  // Per-position cap must be strictly less than the aggregate cap.
  assert.ok(MAX_POSITION_LAMPORTS < MAX_AGGREGATE_LAMPORTS);
  // Confirm 100 SOL = 100 * 1e9 lamports exactly.
  assert.equal(MAX_AGGREGATE_LAMPORTS, 100n * 1_000_000_000n);
  // Confirm 0.02 SOL = 20_000_000 lamports exactly.
  assert.equal(MAX_POSITION_LAMPORTS, 20n * 1_000_000n);
});
