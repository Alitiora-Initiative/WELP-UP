use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use solana_program_test::{ProgramTest, ProgramTestContext};
use solana_sdk::{
    instruction::Instruction,
    signature::{Keypair, Signer},
    system_instruction, system_program,
    transaction::Transaction,
};
use welp_vault::{accounts, instruction, BotRegistry, ExecutorPolicy, UserSlot, Vault};

async fn send_ix(
    context: &mut ProgramTestContext,
    instruction: Instruction,
) -> Result<(), Box<dyn std::error::Error>> {
    let blockhash = context.banks_client.get_latest_blockhash().await?;
    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&context.payer.pubkey()),
        &[&context.payer],
        blockhash,
    );
    context
        .banks_client
        .process_transaction(transaction)
        .await?;
    Ok(())
}

fn decode_account<T: AccountDeserialize>(data: &[u8]) -> T {
    let mut slice = data;
    T::try_deserialize(&mut slice).expect("account data should deserialize")
}

async fn start_program() -> ProgramTestContext {
    ProgramTest::new(
        "welp_vault",
        welp_vault::id(),
        None,
    )
    .start_with_context()
    .await
}

#[tokio::test]
async fn owner_can_create_fund_redeem_and_revoke_executor_policy() {
    let mut context = start_program().await;
    let owner = context.payer.pubkey();
    let program_id = welp_vault::id();
    let (vault, _) = solana_sdk::pubkey::Pubkey::find_program_address(
        &[b"vault-v1", owner.as_ref()],
        &program_id,
    );

    let create_vault = Instruction {
        program_id,
        accounts: accounts::CreateVault {
            owner,
            vault,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: instruction::CreateVault {}.data(),
    };
    send_ix(&mut context, create_vault).await.unwrap();

    let deposit = Instruction {
        program_id,
        accounts: accounts::FundVault {
            owner,
            vault,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: instruction::FundVault {
            amount: 1_000_000_000,
        }
        .data(),
    };
    send_ix(&mut context, deposit).await.unwrap();

    let account = context
        .banks_client
        .get_account(vault)
        .await
        .unwrap()
        .expect("vault account exists");
    let state: Vault = decode_account(&account.data);
    assert_eq!(state.owner, owner);
    assert_eq!(state.available_lamports, 1_000_000_000);
    assert_eq!(state.total_shares, 1_000_000_000);

    let redeem = Instruction {
        program_id,
        accounts: accounts::WithdrawVault { owner, vault }.to_account_metas(None),
        data: instruction::WithdrawVault {
            shares: 250_000_000,
        }
        .data(),
    };
    send_ix(&mut context, redeem).await.unwrap();

    let account = context
        .banks_client
        .get_account(vault)
        .await
        .unwrap()
        .expect("vault account exists after partial redemption");
    let state: Vault = decode_account(&account.data);
    assert_eq!(state.available_lamports, 750_000_000);
    assert_eq!(state.total_shares, 750_000_000);
    assert_eq!(state.total_deposited_lamports, 1_000_000_000);

    // A later deposit is priced against current assets and outstanding shares.
    let second_deposit = Instruction {
        program_id,
        accounts: accounts::FundVault {
            owner,
            vault,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: instruction::FundVault {
            amount: 250_000_000,
        }
        .data(),
    };
    send_ix(&mut context, second_deposit).await.unwrap();

    let account = context
        .banks_client
        .get_account(vault)
        .await
        .unwrap()
        .expect("vault account exists after repeat deposit");
    let state: Vault = decode_account(&account.data);
    assert_eq!(state.available_lamports, 1_000_000_000);
    assert_eq!(state.total_shares, 1_000_000_000);
    assert_eq!(state.total_deposited_lamports, 1_250_000_000);

    // The legacy amount-based withdrawal cannot bypass the share ledger.
    let legacy_withdraw = Instruction {
        program_id,
        accounts: accounts::LegacyWithdraw { owner, vault }.to_account_metas(None),
        data: instruction::Withdraw { amount: 1_000_000 }.data(),
    };
    assert!(send_ix(&mut context, legacy_withdraw).await.is_err());

    let executor = solana_sdk::pubkey::Pubkey::new_unique();
    let (executor_policy, _) = solana_sdk::pubkey::Pubkey::find_program_address(
        &[b"executor-policy-v1", vault.as_ref()],
        &program_id,
    );
    let invalid_config = Instruction {
        program_id,
        accounts: accounts::ConfigureExecutorPolicy {
            owner,
            vault,
            executor_policy,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: instruction::ConfigureExecutorPolicy {
            executor,
            max_trade_lamports: 20_000_000,
            max_daily_lamports: 10_000_000,
            max_slippage_bps: 100,
        }
        .data(),
    };
    assert!(send_ix(&mut context, invalid_config).await.is_err());

    let configure = Instruction {
        program_id,
        accounts: accounts::ConfigureExecutorPolicy {
            owner,
            vault,
            executor_policy,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: instruction::ConfigureExecutorPolicy {
            executor,
            max_trade_lamports: 5_000_000,
            max_daily_lamports: 20_000_000,
            max_slippage_bps: 100,
        }
        .data(),
    };
    send_ix(&mut context, configure).await.unwrap();

    let account = context
        .banks_client
        .get_account(executor_policy)
        .await
        .unwrap()
        .expect("executor policy exists");
    let policy: ExecutorPolicy = decode_account(&account.data);
    assert_eq!(policy.owner, owner);
    assert_eq!(policy.vault, vault);
    assert_eq!(policy.executor, executor);
    assert_eq!(policy.max_trade_lamports, 5_000_000);
    assert_eq!(policy.max_daily_lamports, 20_000_000);
    assert_eq!(policy.max_slippage_bps, 100);
    assert!(policy.enabled);
    assert_eq!(policy.version, 1);

    // A different signer cannot revoke this vault owner's executor.
    let attacker = Keypair::new();
    let fund_attacker = system_instruction::transfer(&owner, &attacker.pubkey(), 10_000_000);
    let blockhash = context.banks_client.get_latest_blockhash().await.unwrap();
    let fund_transaction = Transaction::new_signed_with_payer(
        &[fund_attacker],
        Some(&owner),
        &[&context.payer],
        blockhash,
    );
    context
        .banks_client
        .process_transaction(fund_transaction)
        .await
        .unwrap();

    let unauthorized_revoke = Instruction {
        program_id,
        accounts: accounts::RevokeExecutorPolicy {
            owner: attacker.pubkey(),
            vault,
            executor_policy,
        }
        .to_account_metas(None),
        data: instruction::RevokeExecutorPolicy {}.data(),
    };
    let blockhash = context.banks_client.get_latest_blockhash().await.unwrap();
    let unauthorized_transaction = Transaction::new_signed_with_payer(
        &[unauthorized_revoke],
        Some(&owner),
        &[&context.payer, &attacker],
        blockhash,
    );
    assert!(context
        .banks_client
        .process_transaction(unauthorized_transaction)
        .await
        .is_err());

    let revoke = Instruction {
        program_id,
        accounts: accounts::RevokeExecutorPolicy {
            owner,
            vault,
            executor_policy,
        }
        .to_account_metas(None),
        data: instruction::RevokeExecutorPolicy {}.data(),
    };
    send_ix(&mut context, revoke).await.unwrap();

    let account = context
        .banks_client
        .get_account(executor_policy)
        .await
        .unwrap()
        .expect("revoked policy remains auditable");
    let policy: ExecutorPolicy = decode_account(&account.data);
    assert!(!policy.enabled);
    assert_eq!(policy.executor, solana_sdk::pubkey::Pubkey::default());
    assert_eq!(policy.version, 2);
}

#[tokio::test]
async fn user_slot_requires_enabled_registry_and_snapshots_strategy_limits() {
    let mut context = start_program().await;
    let creator = context.payer.pubkey();
    let program_id = welp_vault::id();
    let bot = Keypair::new();
    let rent = context.banks_client.get_rent().await.unwrap();
    let create_bot_account = system_instruction::create_account(
        &creator,
        &bot.pubkey(),
        rent.minimum_balance(0),
        0,
        &system_program::id(),
    );
    let blockhash = context.banks_client.get_latest_blockhash().await.unwrap();
    let create_bot_transaction = Transaction::new_signed_with_payer(
        &[create_bot_account],
        Some(&creator),
        &[&context.payer, &bot],
        blockhash,
    );
    context
        .banks_client
        .process_transaction(create_bot_transaction)
        .await
        .unwrap();

    let (bot_registry, _) = solana_sdk::pubkey::Pubkey::find_program_address(
        &[b"bot-registry-v1", creator.as_ref(), bot.pubkey().as_ref()],
        &program_id,
    );
    let register = Instruction {
        program_id,
        accounts: accounts::RegisterBot {
            creator,
            bot_account: bot.pubkey(),
            bot_registry,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: instruction::RegisterBot {
            strategy_hash: [7u8; 32],
            max_position_bps: 2_500,
            max_slippage_bps: 150,
            fee_bps: 500,
        }
        .data(),
    };
    send_ix(&mut context, register).await.unwrap();

    let account = context
        .banks_client
        .get_account(bot_registry)
        .await
        .unwrap()
        .expect("bot registry exists");
    let registry: BotRegistry = decode_account(&account.data);
    assert!(registry.enabled);
    assert_eq!(registry.strategy_hash, [7u8; 32]);
    assert_eq!(registry.version, 1);

    let (user_slot, _) = solana_sdk::pubkey::Pubkey::find_program_address(
        &[b"user-slot-v1", creator.as_ref(), bot.pubkey().as_ref()],
        &program_id,
    );
    let create_slot = Instruction {
        program_id,
        accounts: accounts::CreateUserSlot {
            owner: creator,
            user_slot,
            bot_registry,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: instruction::CreateUserSlot {
            bot_account: bot.pubkey(),
        }
        .data(),
    };
    send_ix(&mut context, create_slot).await.unwrap();

    let account = context
        .banks_client
        .get_account(user_slot)
        .await
        .unwrap()
        .expect("user slot exists");
    let slot: UserSlot = decode_account(&account.data);
    assert_eq!(slot.owner, creator);
    assert_eq!(slot.bot_account, bot.pubkey());
    assert_eq!(slot.strategy_hash, [7u8; 32]);
    assert_eq!(slot.registry_version, 1);
    assert_eq!(slot.max_position_bps, 2_500);
    assert_eq!(slot.max_slippage_bps, 150);
}
