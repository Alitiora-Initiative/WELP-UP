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
  assert.match(body, /available_lamports,\s*ctx\.accounts\.vault\.total_shares/);
  assert.match(body, /VaultError::AccountingInvariant/);
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
  const body = instruction('pub fn settle_exit(', '/// Legacy direct-amount withdrawal is disabled');
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

test('executor policy configuration is owner-scoped and bounded by vault assets', () => {
  const body = instruction('pub fn configure_executor_policy(', '/// register_bot:');
  assert.match(body, /executor != Pubkey::default\(\) && executor != owner/);
  assert.match(body, /VaultState::Active[\s\S]*VaultState::Paused/);
  assert.match(body, /max_trade_lamports >= MIN_POSITION_LAMPORTS/);
  assert.match(body, /max_trade_lamports <= max_daily_lamports/);
  assert.match(body, /max_daily_lamports <= available/);
  assert.match(body, /max_slippage_bps <= 1_000/);
  assert.match(body, /policy\.version\.checked_add\(1\)/);
  assert.match(body, /ExecutorPolicyEvent/);
});

test('executor policy is a per-vault PDA and can be revoked by its owner', () => {
  const account = source.slice(source.indexOf('pub struct ExecutorPolicy {'), source.indexOf('impl ExecutorPolicy'));
  assert.match(account, /pub owner: Pubkey/);
  assert.match(account, /pub vault: Pubkey/);
  assert.match(account, /pub executor: Pubkey/);
  assert.match(account, /pub max_trade_lamports: u64/);
  assert.match(account, /pub max_daily_lamports: u64/);
  assert.match(account, /pub daily_spent_lamports: u64/);
  assert.match(account, /pub day_index: i64/);

  const context = source.slice(source.indexOf('pub struct ConfigureExecutorPolicy'), source.indexOf('pub struct RevokeExecutorPolicy'));
  assert.match(context, /init_if_needed/);
  assert.match(context, /b"executor-policy-v1"/);

  const revoke = instruction('pub fn revoke_executor_policy(', '/// register_bot:');
  assert.match(revoke, /policy\.enabled = false/);
  assert.match(revoke, /policy\.executor = Pubkey::default\(\)/);
  assert.match(revoke, /policy\.version\.checked_add\(1\)/);
});

test('legacy executor setters cannot silently succeed', () => {
  const set = instruction('pub fn set_executor(', '/// Legacy executor entry point is disabled; use revoke_executor_policy');
  const revoke = instruction('pub fn revoke_executor(', '/// Owner pauses vault (legacy name');
  assert.match(set, /ExecutorPolicyRequired/);
  assert.match(revoke, /ExecutorPolicyRequired/);
});

test('legacy direct withdrawal cannot bypass share accounting', () => {
  const body = instruction('pub fn withdraw(', '/// Charges a $0.10 creation fee');
  assert.match(body, /LegacyWithdrawDisabled/);
  assert.doesNotMatch(body, /try_borrow_mut_lamports/);
});

test('global configuration cannot be claimed by the first arbitrary signer', () => {
  const body = instruction('pub fn initialize_global_config(', '// ── Vault lifecycle');
  assert.match(body, /GlobalConfigInitDisabled/);
  assert.doesNotMatch(body, /cfg\.authority = ctx\.accounts\.authority\.key\(\)/);
});
