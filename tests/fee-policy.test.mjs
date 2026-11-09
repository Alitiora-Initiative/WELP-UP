import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const policy = readFileSync(new URL('../lib/server/fee-policy.ts', import.meta.url), 'utf8');
const order = readFileSync(new URL('../app/api/order/route.ts', import.meta.url), 'utf8');
const execute = readFileSync(new URL('../app/api/execute/route.ts', import.meta.url), 'utf8');
const jupiter = readFileSync(new URL('../lib/jupiter.ts', import.meta.url), 'utf8');

test('canonical protocol fee is 1% plus 0.5% creator fee with a 60/40 epoch split', () => {
  assert.match(policy, /import 'server-only'/);
  assert.match(policy, /swapFeeBps: 100/);
  assert.match(policy, /creatorFeeBps: 50/);
  assert.match(policy, /epochDurationSeconds: 1_209_600/);
  assert.match(policy, /epochDeveloperReleaseBps: 6_000/);
  assert.match(policy, /epochPermanentReserveBps: 4_000/);
  assert.match(policy, /not the live Jupiter referral rate/);
  assert.match(policy, /getReferralFeeConfig/);
  assert.doesNotMatch(policy, /tradeOrTransferUsdcBaseUnits|launchCreationUsdcBaseUnits/);
});

test('Jupiter swaps fall back to an explicitly fee-free quote when referral collection is unavailable', () => {
  assert.doesNotMatch(execute, /WELP_FEE_POLICY\.collectionEnabled/);
  assert.match(order, /kind === 'disabled'/);
  assert.match(order, /checkReferralAccountReadiness/);
  assert.match(order, /state: 'not_collected'/);
  assert.match(order, /const feeFreeOrder = await requestOrder\(baseOrderParams\)/);
  assert.match(order, /feeSetupMessage\(readiness\.kind\)/);
  assert.doesNotMatch(order, /feeSetup: readiness\.kind/);
  assert.doesNotMatch(order, /body\.referralAccount|body\.referralFeeBps/);
  assert.match(policy, /wallet-approved swaps remain available/);
});

test('Jupiter v2 order sends only documented fields and requires a signable transaction', () => {
  assert.doesNotMatch(jupiter, /Object\.entries\(params\)/);
  assert.match(jupiter, /searchParams\.set\('referralFee', String\(params\.referralFeeBps\)\)/);
  assert.match(jupiter, /maxSupportedTransactionVersion', '0'/);
  assert.match(jupiter, /!data\.transaction\.trim\(\)/);
  assert.match(jupiter, /!data\.requestId\.trim\(\)/);
});
