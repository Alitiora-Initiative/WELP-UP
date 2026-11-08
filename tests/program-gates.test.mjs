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

test('bot registration validates strategy hash, allocation, slippage and fee bounds', () => {
  const body = instruction('pub fn register_bot(', '/// settle_creator_fee:');
  assert.match(body, /strategy_hash != \[0u8; 32\]/);
  assert.match(body, /max_position_bps > 0 && max_position_bps <= 10_000/);
  assert.match(body, /max_slippage_bps <= 1_000/);
  assert.match(body, /validate_fee_bps/);
  assert.match(body, /bot_account\.key\(\) != ctx\.accounts\.creator\.key\(\)/);
});

test('user slots require an enabled bot registry and snapshot the approved strategy', () => {
  const body = instruction('pub fn create_user_slot(', '/// Owner advances the order nonce');
  assert.match(body, /registry\.enabled/);
  assert.match(body, /registry\.strategy_hash/);
  assert.match(body, /slot\.strategy_hash = registry\.strategy_hash/);
  assert.match(body, /slot\.registry_version = registry\.version/);
  assert.match(body, /slot\.max_position_bps = registry\.max_position_bps/);
  assert.match(body, /slot\.max_slippage_bps = registry\.max_slippage_bps/);

  const context = source.slice(source.indexOf('pub struct CreateUserSlot'), source.indexOf('pub struct UpdateSlotLimits'));
  assert.match(context, /b"bot-registry-v1"/);
  assert.match(context, /bot_registry\.enabled/);

  const account = source.slice(source.indexOf('pub struct UserSlot {'), source.indexOf('impl UserSlot'));
  assert.match(account, /pub strategy_hash: \[u8; 32\]/);
  assert.match(account, /pub registry_version: u32/);
  assert.match(account, /pub max_position_bps: u16/);
  assert.match(account, /pub max_slippage_bps: u16/);
});

test('legacy initializer cannot imply that non-persisted caps are enforced', () => {
  const body = instruction('pub fn initialize(', '/// Legacy executor entry point is disabled');
  assert.match(body, /LegacyInitializeDisabled/);
  assert.doesNotMatch(body, /check_initialize/);
  assert.doesNotMatch(body, /ctx\.accounts\.vault/);
});


test('launchpad fee calculation is 0.50% of gross swap input with a 60/40 allocation', () => {
  const launchpad = readFileSync(new URL('../programs/launchpad/src/lib.rs', import.meta.url), 'utf8');
  assert.match(launchpad, /PROTOCOL_SWAP_FEE_BPS: u128 = 50/);
  assert.match(launchpad, /DEVELOPER_DISTRIBUTION_BPS: u128 = 6_000/);
  assert.match(launchpad, /PERMANENT_RESERVE_BPS: u128 = 4_000/);
  assert.match(launchpad, /pub fn calculate_protocol_swap_fee/);
  assert.match(launchpad, /gross_input_base_units/);
  assert.match(launchpad, /net_swap_input_base_units/);
  assert.match(launchpad, /FeeBelowMinimumUnit/);
  assert.doesNotMatch(launchpad, /PLATFORM_TRANSFER_FEE_USDC|PLATFORM_LAUNCH_FEE_USDC|PLATFORM_USDC_MINT/);
  assert.doesNotMatch(launchpad, /supported_transfer_with_fee|FeeReceipt|PlatformFeeCollected|CreatorFeeRoute/);
  assert.match(launchpad, /pub fn disburse_treasury_funds/);
});

test('Anchor SBF workspace includes both deployable programs and excludes host-only checks', () => {
  const config = readFileSync(new URL('../Anchor.toml', import.meta.url), 'utf8');
  assert.match(config, /members\s*=\s*\[\s*"programs\/vault"\s*,\s*"programs\/launchpad"\s*\]/);
  assert.doesNotMatch(config, /members\s*=\s*\[\s*"programs\/\*"\s*\]/);
  assert.doesNotMatch(config, /"programs\/vault-checks"/);
  assert.doesNotMatch(config, /"programs\/program-tests"/);
});

test('disabled creation-fee instruction does not pull unused Pyth SDK', () => {
  const manifest = readFileSync(new URL('../programs/vault/Cargo.toml', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../programs/vault/src/lib.rs', import.meta.url), 'utf8');
  const contextStart = source.indexOf('pub struct ChargeCreationFee');
  const contextEnd = source.indexOf('// ── Errors', contextStart);
  const context = source.slice(contextStart, contextEnd);
  assert.doesNotMatch(manifest, /pyth-solana-receiver-sdk/);
  assert.doesNotMatch(source, /pyth_solana_receiver_sdk|PriceUpdateV2/);
  assert.doesNotMatch(context, /price_update/);
  const disabledInstruction = source.slice(
    source.indexOf('pub fn charge_creation_fee('),
    source.indexOf('}', source.indexOf('pub fn charge_creation_fee(')) + 1,
  );
  assert.match(disabledInstruction, /FeeSettlementDisabled/);
});

test('Anchor SBF build preserves Cargo 1.75-compatible lockfiles', () => {
  const workflow = readFileSync(new URL('../.github/workflows/anchor-sbf.yml', import.meta.url), 'utf8');
  const compatibilityScript = readFileSync(new URL('../scripts/pin-sbf-compatible-locks.sh', import.meta.url), 'utf8');

  assert.match(compatibilityScript, /pin_if_present "\$manifest" blake3 1\.8\.7 1\.8\.2/);
  assert.match(compatibilityScript, /pin_if_present "\$manifest" constant_time_eq 0\.4\.2 0\.3\.1/);
  assert.match(compatibilityScript, /pin_if_present "\$manifest" base64ct 1\.8\.3 1\.7\.3/);
  assert.match(compatibilityScript, /pin_if_present "\$manifest" zeroize_derive 1\.5\.0 1\.4\.2/);
  assert.ok(compatibilityScript.includes('pin_if_present "$manifest" unicode-segmentation 1.13.3 1.12.0'));
  assert.ok(compatibilityScript.includes('pin_if_present "$manifest" jobserver 0.1.35 0.1.34'));
  assert.ok(compatibilityScript.includes('"jobserver:0.1.35"'));
  assert.match(compatibilityScript, /pin_if_present "\\$manifest" proc-macro2 1\\.0\\.107 1\\.0\\.94/);
  assert.ok(compatibilityScript.includes('"proc-macro2:1.0.107"'));
  assert.match(compatibilityScript, /pin_if_present "\$manifest" indexmap 2\.14\.2 2\.11\.4/);
  assert.match(compatibilityScript, /package_version_exists/);
  assert.ok(workflow.includes('bash scripts/pin-sbf-compatible-locks.sh'));
  assert.doesNotMatch(workflow, /pin-anchor-030-sbf-deps\.sh/);

  assert.match(workflow, /anchor build -- -- --locked/);
  assert.match(workflow, /Refresh Cargo metadata and normalize the SBF lockfile/);
  assert.ok(workflow.includes('if [[ "\\${1:-}" == "metadata" ]]; then'));
  assert.ok(workflow.includes('"$REAL_CARGO" "\\$@"'));
  assert.ok(workflow.includes('status=\\$?'));
  assert.ok(workflow.includes('if [[ \\$status -ne 0 ]]; then exit "\\$status"; fi'));
  assert.ok(workflow.includes('if [[ -f "\\$lockfile" ]]; then'));
  assert.ok(workflow.includes('sed -i \'s/^version = 4$/version = 3/\' "\\$lockfile"'));
  assert.match(workflow, /metadata --manifest-path programs\/launchpad\/Cargo\.toml/);
  assert.doesNotMatch(workflow, /--features program-test/);

  const ciWorkflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.ok(ciWorkflow.includes('cargo check --manifest-path programs/program-tests/Cargo.toml --tests'));
  assert.match(workflow, /for lockfile in programs\/vault\/Cargo\.lock programs\/launchpad\/Cargo\.lock/);
  assert.match(workflow, /test -s target\/deploy\/welp_launchpad\.so/);
  assert.match(workflow, /test -s target\/idl\/welp_launchpad\.json/);
  assert.match(workflow, /cargo test --manifest-path programs\/program-tests\/Cargo\.toml --test vault_program_test/);
  assert.match(workflow, /cargo test --manifest-path programs\/program-tests\/Cargo\.toml --test treasury_program_test/);
  assert.match(workflow, /uses: dtolnay\/rust-toolchain@stable/);

  const launchpadManifest = readFileSync(new URL('../programs/launchpad/Cargo.toml', import.meta.url), 'utf8');
  const vaultManifest = readFileSync(new URL('../programs/vault/Cargo.toml', import.meta.url), 'utf8');
  const hostTestsManifest = readFileSync(new URL('../programs/program-tests/Cargo.toml', import.meta.url), 'utf8');
  assert.doesNotMatch(launchpadManifest, /solana-program-test|solana-banks-client|\[\[test\]\]/);
  assert.doesNotMatch(vaultManifest, /solana-program-test|solana-banks-client|\[dev-dependencies\]/);
  assert.match(hostTestsManifest, /solana-program-test/);
  assert.match(hostTestsManifest, /welp-vault = \{ path = "\.\.\/vault", features = \["no-entrypoint"\] \}/);
  assert.match(hostTestsManifest, /welp-launchpad = \{ path = "\.\.\/launchpad", features = \["no-entrypoint"\] \}/);
  assert.match(workflow, /CARGO: \$\{\{ runner\.temp \}\}\/cargo-wrapper\/cargo/);
  assert.match(workflow, /grep -qx 'version = 3' "\$lockfile"/);
  assert.doesNotMatch(workflow, /for lockfile in programs\/vault\/Cargo\.lock programs\/vault-checks/);
});
