import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../programs/vault/src/lib.rs', import.meta.url), 'utf8');

function instruction(name, nextMarker) {
  const start = source.indexOf(name);
  assert.notEqual(start, -1, 'missing instruction ' + name);
  const end = source.indexOf(nextMarker, start + name.length);
  assert.notEqual(end, -1, 'missing boundary after ' + name);
  return source.slice(start, end);
}

test('vault deposits require owner-signed SOL transfer and mint proportional shares', () => {
  const body = instruction('pub fn fund_vault(', '/// Owner pauses their vault');
  assert.match(body, /amount > 0/);
  assert.match(body, /VaultState::Funded \|\| vault\.state == VaultState::Active/);
  assert.match(body, /compute_shares\(/);
  assert.match(body, /system_program::transfer/);
  assert.match(body, /available_lamports[\s\S]*checked_add\(amount\)/);
  assert.match(body, /total_shares[\s\S]*checked_add\(shares\)/);
  assert.doesNotMatch(body, /invoke_signed/);
  assert.doesNotMatch(body, /FundingDisabled/);
});

test('automated swaps are fail-closed', () => {
  const body = instruction("pub fn execute_swap<'info>(", '/// Owner or executor records a closed position');
  assert.match(body, /err!\(VaultError::TradingDisabled\)/);
  assert.doesNotMatch(body, /invoke_signed/);
});

test('position settlement is fail-closed', () => {
  const body = instruction('pub fn settle_exit(', '/// Owner withdraws SOL (legacy direct-amount interface)');
  assert.match(body, /err!\(VaultError::TradingDisabled\)/);
  assert.doesNotMatch(body, /settle_exposure/);
});

test('creator fee accrual and claims are fail-closed', () => {
  const accrual = instruction('pub fn settle_creator_fee(', '/// claim_creator_fee:');
  const claim = instruction('pub fn claim_creator_fee(', '// ── Legacy compatibility stubs');
  assert.match(accrual, /err!\(VaultError::FeeSettlementDisabled\)/);
  assert.match(claim, /err!\(VaultError::FeeSettlementDisabled\)/);
  assert.doesNotMatch(claim, /try_borrow_mut_lamports/);
});

test('bot creation fee collection is fail-closed', () => {
  const body = instruction('pub fn charge_creation_fee(', '// ── Errors');
  assert.match(body, /err!\(VaultError::FeeSettlementDisabled\)/);
  assert.doesNotMatch(body, /system_program::transfer/);
});
