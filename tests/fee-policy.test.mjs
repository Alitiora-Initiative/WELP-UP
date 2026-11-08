import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const policy = readFileSync(new URL('../lib/server/fee-policy.ts', import.meta.url), 'utf8');
const order = readFileSync(new URL('../app/api/order/route.ts', import.meta.url), 'utf8');
const execute = readFileSync(new URL('../app/api/execute/route.ts', import.meta.url), 'utf8');
const jupiter = readFileSync(new URL('../lib/jupiter.ts', import.meta.url), 'utf8');

test('canonical protocol fee is 0.50% of gross swap input with a 60/40 split', () => {
  assert.match(policy, /import 'server-only'/);
  assert.match(policy, /swapFeeBps: 50/);
  assert.match(policy, /epochDurationSeconds: 1_209_600/);
  assert.match(policy, /epochDeveloperReleaseBps: 6_000/);
  assert.match(policy, /epochPermanentReserveBps: 4_000/);
  assert.match(policy, /collectionEnabled:/);
  assert.match(policy, /process\.env\.WELP_REFERRAL_ACCOUNT/);
  assert.match(policy, /referralFeeBps/);
  assert.doesNotMatch(policy, /tradeOrTransferUsdcBaseUnits|launchCreationUsdcBaseUnits/);
});

test('Jupiter order and execute endpoints allow wallet-approved swaps without a WELP referral account', () => {
  for (const route of [order, execute]) {
    assert.doesNotMatch(route, /WELP_FEE_POLICY\.collectionEnabled/);
    assert.doesNotMatch(route, /status: 503/);
  }
  assert.match(order, /const referralAccount = WELP_FEE_POLICY\.referralAccount/);
  assert.match(order, /const referralFeeBps = WELP_FEE_POLICY\.referralFeeBps/);
  assert.doesNotMatch(order, /body\.referralAccount|body\.referralFeeBps/);
  assert.match(policy, /wallet-approved swaps remain available/);
});

test('Jupiter v2 order sends only documented fields and requires a signable transaction', () => {
  assert.doesNotMatch(jupiter, /Object\.entries\(params\)/);
  assert.match(jupiter, /searchParams\.set\('referralFee', String\(params\.referralFeeBps\)\)/);
  assert.match(jupiter, /!data\.transaction\.trim\(\)/);
  assert.match(jupiter, /!data\.requestId\.trim\(\)/);
});
