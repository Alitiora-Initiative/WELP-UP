
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TOTAL_SUPPLY_WHOLE,
  U64_MAX,
  formatBaseUnits,
  validateLaunchSupply,
} from '../lib/launchpad-config.ts';

test('a creator can choose 200 million; 5% is derived from that launch', () => {
  const result = validateLaunchSupply('200000000', 6);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.wholeSupply, 200_000_000n);
  assert.equal(result.maxSupplyBaseUnits, 200_000_000_000_000n);
  assert.equal(result.earlyWalletLimitBaseUnits, 10_000_000_000_000n);
  assert.equal(result.earlyWalletLimitWholeTokens, '10000000');
});

test('the maximum is one billion whole tokens, not a fixed 200 million', () => {
  const result = validateLaunchSupply('1000000000', 9);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.maxSupplyBaseUnits, 1_000_000_000_000_000_000n);
  assert.ok(result.maxSupplyBaseUnits <= U64_MAX);
  assert.equal(result.earlyWalletLimitWholeTokens, '50000000');
});

test('zero is previewable but not launchable; rejects fractions, negatives and supply above one billion', () => {
  const zero = validateLaunchSupply('0', 9);
  assert.equal(zero.ok, true);
  if (zero.ok) {
    assert.equal(zero.launchable, false);
    assert.equal(zero.maxSupplyBaseUnits, 0n);
    assert.equal(zero.earlyWalletLimitBaseUnits, 0n);
  }
  for (const invalid of ['0.5', '-1', '1000000001', '1e6', '']) {
    assert.equal(validateLaunchSupply(invalid, 9).ok, false, invalid);
  }
  assert.equal(MAX_TOTAL_SUPPLY_WHOLE, 1_000_000_000n);
});

test('only 0, 6 and 9 decimal configurations are accepted', () => {
  for (const decimals of [0, 6, 9]) {
    assert.equal(validateLaunchSupply('1000', decimals).ok, true);
  }
  for (const decimals of [1, 2, 8, 10, -1, null]) {
    assert.equal(validateLaunchSupply('1000', decimals).ok, false);
  }
});

test('small zero-decimal launches do not round the 5% cap up', () => {
  const result = validateLaunchSupply('19', 0);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.earlyWalletLimitBaseUnits, 0n);
  assert.equal(result.earlyWindowPurchasesBlockedByGranularity, true);
});

test('raw base-unit formatting remains exact for 0, 6 and 9 decimals', () => {
  assert.equal(formatBaseUnits(12n, 0), '12');
  assert.equal(formatBaseUnits(1_234_500n, 6), '1.2345');
  assert.equal(formatBaseUnits(1_000_000_000n, 9), '1');
});
