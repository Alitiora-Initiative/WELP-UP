import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const policy = readFileSync(new URL('../lib/server/fee-policy.ts', import.meta.url), 'utf8');
const order = readFileSync(new URL('../app/api/order/route.ts', import.meta.url), 'utf8');
const execute = readFileSync(new URL('../app/api/execute/route.ts', import.meta.url), 'utf8');

test('canonical fee policy is server-only and uses the newly designated recipient', () => {
  assert.match(policy, /import 'server-only'/);
  assert.match(policy, /ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG/);
  assert.match(policy, /tradeOrTransferUsdcBaseUnits: 100_000n/);
  assert.match(policy, /launchCreationUsdcBaseUnits: 500_000n/);
  assert.match(policy, /developerShareBps: 6_000/);
  assert.match(policy, /treasuryShareBps: 4_000/);
  assert.match(policy, /collectionEnabled: false/);
});

test('swap order and execution fail closed until fees are atomically enforced', () => {
  for (const route of [order, execute]) {
    assert.match(route, /WELP_FEE_POLICY\.collectionEnabled/);
    assert.match(route, /status: 503/);
  }
});
