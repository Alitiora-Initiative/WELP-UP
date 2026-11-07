use anchor_lang::{AccountDeserialize, AccountSerialize, InstructionData, ToAccountMetas};
use solana_program_test::ProgramTest;
use solana_sdk::{
    account::{Account, AccountSharedData},
    clock::Clock,
    instruction::Instruction,
    pubkey::Pubkey,
    rent::Rent,
    signature::Signer,
    system_program,
    transaction::Transaction,
};
use welp_launchpad::{
    accounts, id, instruction, TreasuryAccount, DEVELOPER_WALLET, DISTRIBUTION_EPOCH_SECONDS,
    TREASURY_SEED, TREASURY_VAULT_SEED,
};

fn decode_treasury(account: &Account) -> TreasuryAccount {
    let mut data: &[u8] = account.data.as_slice();
    TreasuryAccount::try_deserialize(&mut data).expect("TreasuryAccount deserializes")
}

fn serialize_treasury(account: &mut Account, state: &TreasuryAccount) {
    let mut data = Vec::with_capacity(TreasuryAccount::SPACE);
    state
        .try_serialize(&mut data)
        .expect("TreasuryAccount serializes");
    assert_eq!(data.len(), TreasuryAccount::SPACE);
    account.data = data;
}

fn system_account(lamports: u64) -> Account {
    Account {
        lamports,
        data: Vec::new(),
        owner: system_program::ID,
        executable: false,
        rent_epoch: 0,
    }
}

fn initialize_ix(payer: Pubkey, treasury: Pubkey, treasury_vault: Pubkey) -> Instruction {
    Instruction {
        program_id: id(),
        accounts: accounts::InitializeTreasury {
            payer,
            treasury,
            treasury_vault,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitializeTreasury {}.data(),
    }
}

fn disburse_ix(
    caller: Pubkey,
    treasury: Pubkey,
    treasury_vault: Pubkey,
    developer_wallet: Pubkey,
) -> Instruction {
    Instruction {
        program_id: id(),
        accounts: accounts::DisburseTreasuryFunds {
            caller,
            treasury,
            treasury_vault,
            developer_wallet,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::DisburseTreasuryFunds {}.data(),
    }
}

async fn send_as_payer(
    context: &mut solana_program_test::ProgramTestContext,
    instruction: Instruction,
) -> Result<(), solana_banks_client::BanksClientError> {
    let blockhash = context.banks_client.get_latest_blockhash().await?;
    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&context.payer.pubkey()),
        &[&context.payer],
        blockhash,
    );
    context.banks_client.process_transaction(transaction).await
}

#[tokio::test]
async fn treasury_initialization_epoch_gate_distribution_and_reserve_are_enforced() {
    let program_id = id();
    let (treasury, _) = Pubkey::find_program_address(&[TREASURY_SEED], &program_id);
    let (treasury_vault, _) =
        Pubkey::find_program_address(&[TREASURY_VAULT_SEED], &program_id);

    // BPF_OUT_DIR is set by the Anchor/SBF workflow. ProgramTest loads the
    // compiled welp_launchpad.so rather than a native Rust processor.
    let mut program_test = ProgramTest::new("welp_launchpad", program_id, None);
    program_test.add_account(DEVELOPER_WALLET, system_account(1));

    let mut context = program_test.start_with_context().await;

    // Freeze a known Clock timestamp so initialization and release boundaries
    // are asserted against a deterministic runtime sysvar.
    let initialized_at = 1_700_000_000_i64;
    context.set_sysvar(&Clock {
        slot: 10,
        epoch_start_timestamp: initialized_at,
        epoch: 1,
        leader_schedule_epoch: 1,
        unix_timestamp: initialized_at,
    });

    let payer = context.payer.pubkey();
    let initialize_instruction = initialize_ix(payer, treasury, treasury_vault);
    send_as_payer(&mut context, initialize_instruction)
        .await
        .expect("treasury initialization succeeds");

    let mut treasury_account = context
        .banks_client
        .get_account(treasury)
        .await
        .expect("treasury lookup succeeds")
        .expect("treasury PDA exists");
    let mut treasury_state = decode_treasury(&treasury_account);
    let mut vault_account = context
        .banks_client
        .get_account(treasury_vault)
        .await
        .expect("vault lookup succeeds")
        .expect("separate TreasuryVault PDA exists");

    assert_eq!(treasury_state.developer_wallet, DEVELOPER_WALLET);
    assert_eq!(treasury_state.treasury_vault, treasury_vault);
    assert_eq!(treasury_state.last_distribution_timestamp, initialized_at);
    assert_eq!(treasury_state.total_fees_collected, 0);
    assert_eq!(treasury_state.locked_reserve_lamports, 0);
    assert_eq!(vault_account.owner, system_program::ID);

    // Simulate the ledger state that a future, atomic creator-fee collection
    // instruction must create: 1,000 recorded fee lamports plus 300 unsolicited
    // lamports that are deliberately NOT included in total_fees_collected.
    treasury_state.total_fees_collected = 1_000;
    serialize_treasury(&mut treasury_account, &treasury_state);
    context.set_account(
        &treasury,
        &AccountSharedData::from(treasury_account.clone()),
    );
    vault_account.lamports = vault_account
        .lamports
        .checked_add(1_300)
        .expect("test balance does not overflow");
    context.set_account(
        &treasury_vault,
        &AccountSharedData::from(vault_account.clone()),
    );

    let developer_before = context
        .banks_client
        .get_account(DEVELOPER_WALLET)
        .await
        .expect("developer account lookup succeeds")
        .expect("developer account exists")
        .lamports;

    // One hour after initialization must not unlock the treasury.
    context.set_sysvar(&Clock {
        slot: 20,
        epoch_start_timestamp: initialized_at,
        epoch: 1,
        leader_schedule_epoch: 1,
        unix_timestamp: initialized_at + 3_600,
    });
    let caller = context.payer.pubkey();
    let premature_instruction =
        disburse_ix(caller, treasury, treasury_vault, DEVELOPER_WALLET);
    let premature = send_as_payer(&mut context, premature_instruction).await;
    assert!(premature.is_err(), "premature disbursal must fail");

    let after_premature = context
        .banks_client
        .get_account(treasury_vault)
        .await
        .expect("vault lookup succeeds")
        .expect("vault remains present");
    assert_eq!(after_premature.lamports, vault_account.lamports);

    // A timestamp that precedes initialization must fail closed as well.
    context.set_sysvar(&Clock {
        slot: 21,
        epoch_start_timestamp: initialized_at,
        epoch: 1,
        leader_schedule_epoch: 1,
        unix_timestamp: initialized_at - 1,
    });
    let backwards_instruction =
        disburse_ix(caller, treasury, treasury_vault, DEVELOPER_WALLET);
    let backwards = send_as_payer(&mut context, backwards_instruction).await;
    assert!(backwards.is_err(), "clock rollback must fail");

    // An address substitution must not redirect the developer distribution.
    let attacker = Pubkey::new_unique();
    context.set_account(&attacker, &AccountSharedData::from(system_account(1)));
    context.set_sysvar(&Clock {
        slot: 22,
        epoch_start_timestamp: initialized_at,
        epoch: 1,
        leader_schedule_epoch: 1,
        unix_timestamp: initialized_at + DISTRIBUTION_EPOCH_SECONDS,
    });
    let substituted_instruction = disburse_ix(caller, treasury, treasury_vault, attacker);
    let substituted = send_as_payer(&mut context, substituted_instruction).await;
    assert!(
        substituted.is_err(),
        "developer destination substitution must fail"
    );

    // Exactly 14 days is sufficient. The program uses a >= check, so it
    // does not require an extra second or a privileged keeper.
    let matured_at = initialized_at + DISTRIBUTION_EPOCH_SECONDS;
    context.set_sysvar(&Clock {
        slot: 23,
        epoch_start_timestamp: initialized_at,
        epoch: 1,
        leader_schedule_epoch: 1,
        unix_timestamp: matured_at,
    });
    let matured_instruction =
        disburse_ix(caller, treasury, treasury_vault, DEVELOPER_WALLET);
    send_as_payer(&mut context, matured_instruction)
        .await
        .expect("matured epoch disbursal succeeds");

    let after_distribution = context
        .banks_client
        .get_account(treasury_vault)
        .await
        .expect("vault lookup succeeds")
        .expect("vault remains present");
    let state_account_after_distribution = context
        .banks_client
        .get_account(treasury)
        .await
        .expect("treasury lookup succeeds")
        .expect("treasury state remains present");
    let state_after_distribution = decode_treasury(&state_account_after_distribution);
    let developer_after = context
        .banks_client
        .get_account(DEVELOPER_WALLET)
        .await
        .expect("developer lookup succeeds")
        .expect("developer account remains present");

    // 60% of 1,000 recorded fee lamports is sent to the developer.
    assert_eq!(developer_after.lamports - developer_before, 600);
    // 40% is protected in state. The 300 unsolicited lamports also remain,
    // but they are not recorded and can never be harvested by this instruction.
    assert_eq!(state_after_distribution.locked_reserve_lamports, 400);
    assert_eq!(state_after_distribution.total_developer_disbursed, 600);
    assert_eq!(
        after_distribution.lamports,
        vault_account.lamports - 600
    );
    assert_eq!(
        after_distribution.lamports,
        Rent::default().minimum_balance(0) + 400 + 300
    );
    assert_eq!(
        state_after_distribution.last_distribution_timestamp,
        matured_at
    );

    // A later epoch with no newly recorded fee inflow cannot take the
    // previously locked 40% reserve or the unsolicited donation.
    context.set_sysvar(&Clock {
        slot: 24,
        epoch_start_timestamp: matured_at,
        epoch: 2,
        leader_schedule_epoch: 2,
        unix_timestamp: matured_at + DISTRIBUTION_EPOCH_SECONDS,
    });
    let second_harvest_instruction =
        disburse_ix(caller, treasury, treasury_vault, DEVELOPER_WALLET);
    let second_harvest = send_as_payer(&mut context, second_harvest_instruction).await;
    assert!(
        second_harvest.is_err(),
        "previous reserve and unaccounted deposits are not distributable"
    );

    let final_vault = context
        .banks_client
        .get_account(treasury_vault)
        .await
        .expect("final vault lookup succeeds")
        .expect("vault remains present");
    let final_state_account = context
        .banks_client
        .get_account(treasury)
        .await
        .expect("final state lookup succeeds")
        .expect("treasury state remains present");
    let final_state = decode_treasury(&final_state_account);
    assert_eq!(final_state.locked_reserve_lamports, 400);
    assert_eq!(final_state.total_developer_disbursed, 600);
    assert_eq!(final_vault.lamports, after_distribution.lamports);
}
