import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLaunchInputs } from '../lib/launch-program.ts';

const params = { wholeTokenSupply: '1', decimals: 0, name: 'Token WELP UP', symbol: 'TOKENWUP', uri: 'https://welpup.fun/metadata' };

test('custom launch accepts the minimum positive supply and configured precision range', () => {
  assert.deepEqual(validateLaunchInputs(params), { ok: true, supply: 1n });
  assert.equal(validateLaunchInputs({ ...params, wholeTokenSupply: '1000000000', decimals: 9 }).ok, true);
});

test('custom launch rejects zero supply and values above one billion', () => {
  assert.equal(validateLaunchInputs({ ...params, wholeTokenSupply: '0' }).ok, false);
  assert.equal(validateLaunchInputs({ ...params, wholeTokenSupply: '1000000001' }).ok, false);
});

test('custom launch rejects unsupported precision and non-HTTPS metadata', () => {
  assert.equal(validateLaunchInputs({ ...params, decimals: 10 }).ok, false);
  assert.equal(validateLaunchInputs({ ...params, uri: 'http://welpup.fun/metadata' }).ok, false);
});
