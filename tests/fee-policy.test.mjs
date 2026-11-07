import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const policy = readFileSync(new URL('../lib/server/fee-policy.ts', import.meta.url), 'utf8');
const order = readFileSync(new URL('../app/api/order/route.ts', import.meta.url), 'utf8');
const execute = readFileSync(new URL('../app/api/execute/route.ts', import.meta.url), 'utf8');

test('canonical protocol fee is 0.50% of gross swap input with a 60/40 split', () => {
  assert.match(policy, /import 'server-only'/);
  assert.match(policy, /swapFeeBps: 50/);
  assert.match(policy, /developerShareBps: 6_000/);
  assert.match(policy, /treasuryShareBps: 4_000/);
  assert.match(policy, /collectionEnabled: false/);
  assert.doesNotMatch(policy, /tradeOrTransferUsdcBaseUnits|launchCreationUsdcBaseUnits/);
});

test('Jupiter order and execute endpoints remain closed without atomic on-chain fee enforcement', () => {
  for (const route of [order, execute]) {
    assert.match(route, /WELP_FEE_POLICY\.collectionEnabled/);
    assert.match(route, /status: 503/);
  }
});
