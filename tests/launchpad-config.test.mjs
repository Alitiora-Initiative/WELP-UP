import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TOTAL_SUPPLY_WHOLE,
  U64_MAX,
  calculateCreatorFeeRoute,
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

test('the maximum is one billion whole tokens at nine decimals', () => {
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
    assert.equal(zero.earlyWindowPurchasesBlockedByGranularity, false);
  }
  for (const invalid of ['0.5', '-1', '1000000001', '1e6', '']) {
    assert.equal(validateLaunchSupply(invalid, 9).ok, false, invalid);
  }
  assert.equal(MAX_TOTAL_SUPPLY_WHOLE, 1_000_000_000n);
});

test('all decimal precisions from 0 through 9 are accepted', () => {
  for (let decimals = 0; decimals <= 9; decimals += 1) {
    assert.equal(validateLaunchSupply('1000', decimals).ok, true, String(decimals));
  }
  for (const decimals of [-1, 10, 1.5, null]) {
    assert.equal(validateLaunchSupply('1000', decimals).ok, false);
  }
});

test('small positive zero-decimal launches do not round the 5% cap up', () => {
  const result = validateLaunchSupply('19', 0);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.launchable, true);
  assert.equal(result.earlyWalletLimitBaseUnits, 0n);
  assert.equal(result.earlyWindowPurchasesBlockedByGranularity, true);
});

test('raw base-unit formatting remains exact for 0, 6 and 9 decimals', () => {
  assert.equal(formatBaseUnits(12n, 0), '12');
  assert.equal(formatBaseUnits(1_234_500n, 6), '1.2345');
  assert.equal(formatBaseUnits(1_000_000_000n, 9), '1');
});

test('creator fee route sends 0.5% of the creator-fee amount to treasury', () => {
  const route = calculateCreatorFeeRoute(1_000_000_000n, 300);
  assert.equal(route.creatorFeeLamports, 30_000_000n);
  assert.equal(route.treasuryShareLamports, 150_000n);
  assert.equal(route.creatorRewardLamports, 29_850_000n);
  assert.equal(route.treasuryShareLamports + route.creatorRewardLamports, route.creatorFeeLamports);
});

test('zero creator fee does not route protocol or creator rewards', () => {
  const route = calculateCreatorFeeRoute(1_000_000_000n, 0);
  assert.equal(route.creatorFeeLamports, 0n);
  assert.equal(route.treasuryShareLamports, 0n);
  assert.equal(route.creatorRewardLamports, 0n);
});

test('fee remainder carry yields exactly 0.5% over repeated tiny creator fees', () => {
  let remainder = 0n;
  let treasuryTotal = 0n;
  let creatorTotal = 0n;

  // 34 lamports at a 3% creator fee produces a 1-lamport creator fee.
  for (let index = 0; index < 10_000; index += 1) {
    const route = calculateCreatorFeeRoute(34n, 300, remainder);
    treasuryTotal += route.treasuryShareLamports;
    creatorTotal += route.creatorRewardLamports;
    remainder = route.nextRemainder;
  }

  assert.equal(treasuryTotal, 50n);
  assert.equal(creatorTotal, 9_950n);
  assert.equal(remainder, 0n);
});

test('creator fee above 3% and invalid remainder are rejected', () => {
  assert.throws(() => calculateCreatorFeeRoute(100n, 301), /0 to 300/);
  assert.throws(() => calculateCreatorFeeRoute(100n, 100, 10_000n), /remainder/);
});
