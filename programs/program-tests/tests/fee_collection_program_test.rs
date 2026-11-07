use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use solana_program_test::{processor, ProgramTest};
use solana_sdk::{
    account::Account,
    instruction::Instruction,
    program_option::COption,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    signature::Signer,
    system_program,
    transaction::Transaction,
};
use spl_associated_token_account::get_associated_token_address;
use spl_token::state::{Account as SplAccount, AccountState, Mint as SplMint};
use welp_launchpad::{
    accounts, id, instruction, FeeReceipt, TreasuryAccount, DEVELOPER_WALLET,
    PLATFORM_USDC_MINT, FEE_RECEIPT_SEED, TREASURY_SEED, TREASURY_VAULT_SEED,
};

fn system_account(lamports: u64) -> Account {
    Account {
        lamports,
        data: Vec::new(),
        owner: system_program::ID,
        executable: false,
        rent_epoch: 0,
    }
}

fn mint_account(decimals: u8) -> Account {
    let mut data = vec![0; SplMint::LEN];
    SplMint {
        mint_authority: COption::None,
        supply: 0,
        decimals,
        is_initialized: true,
        freeze_authority: COption::None,
    }
    .pack(&mut data)
    .expect("pack SPL mint");
    Account {
        lamports: Rent::default().minimum_balance(SplMint::LEN),
        data,
        owner: spl_token::id(),
        executable: false,
        rent_epoch: 0,
    }
}

fn token_account(mint: Pubkey, authority: Pubkey, amount: u64) -> Account {
    let mut data = vec![0; SplAccount::LEN];
    SplAccount {
        mint,
        owner: authority,
        amount,
        delegate: COption::None,
        state: AccountState::Initialized,
        is_native: COption::None,
        delegated_amount: 0,
        close_authority: COption::None,
    }
    .pack(&mut data)
    .expect("pack SPL token account");
    Account {
        lamports: Rent::default().minimum_balance(SplAccount::LEN),
        data,
        owner: spl_token::id(),
        executable: false,
        rent_epoch: 0,
    }
}

fn read_token_amount(account: &Account) -> u64 {
    SplAccount::unpack(&account.data)
        .expect("SPL token account deserializes")
        .amount
}

fn read_treasury(account: &Account) -> TreasuryAccount {
    let mut data: &[u8] = account.data.as_slice();
    TreasuryAccount::try_deserialize(&mut data).expect("TreasuryAccount deserializes")
}

fn read_receipt(account: &Account) -> FeeReceipt {
    let mut data: &[u8] = account.data.as_slice();
    FeeReceipt::try_deserialize(&mut data).expect("FeeReceipt deserializes")
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

fn transfer_with_fee_ix(
    payer: Pubkey,
    treasury: Pubkey,
    fee_receipt: Pubkey,
    source_mint: Pubkey,
    source_token_account: Pubkey,
    destination_token_account: Pubkey,
    recipient: Pubkey,
    usdc_mint: Pubkey,
    payer_usdc_account: Pubkey,
    developer_usdc_account: Pubkey,
    treasury_usdc_account: Pubkey,
    operation_id: [u8; 32],
    amount: u64,
) -> Instruction {
    Instruction {
        program_id: id(),
        accounts: accounts::SupportedTransferWithFee {
            payer,
            treasury,
            fee_receipt,
            source_mint,
            source_token_account,
            destination_token_account,
            recipient,
            usdc_mint,
            payer_usdc_account,
            developer_usdc_account,
            developer_wallet: DEVELOPER_WALLET,
            treasury_usdc_account,
            token_program: spl_token::id(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::SupportedTransferWithFee {
            operation_id,
            amount,
        }
        .data(),
    }
}

async fn send(
    context: &mut solana_program_test::ProgramTestContext,
    ix: Instruction,
) -> Result<(), solana_banks_client::BanksClientError> {
    let blockhash = context.banks_client.get_latest_blockhash().await?;
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&context.payer.pubkey()),
        &[&context.payer],
        blockhash,
    );
    context.banks_client.process_transaction(tx).await
}

#[tokio::test]
async fn supported_transfer_collects_fixed_usdc_fee_atomically_and_rejects_replay() {
    let program_id = id();
    let (treasury, _) = Pubkey::find_program_address(&[TREASURY_SEED], &program_id);
    let (treasury_vault, _) =
        Pubkey::find_program_address(&[TREASURY_VAULT_SEED], &program_id);

    let source_mint = Pubkey::new_unique();
    let developer_usdc_ata =
        get_associated_token_address(&DEVELOPER_WALLET, &PLATFORM_USDC_MINT);
    let treasury_usdc_ata =
        get_associated_token_address(&treasury, &PLATFORM_USDC_MINT);

    let mut program_test = ProgramTest::new("welp_launchpad", program_id, None);
    program_test.add_program(
        "spl_token",
        processor!(spl_token::processor::Processor::process),
        spl_token::id(),
    );
    program_test.add_account(DEVELOPER_WALLET, system_account(1));
    program_test.add_account(PLATFORM_USDC_MINT, mint_account(6));
    program_test.add_account(source_mint, mint_account(9));
    program_test.add_account(
        developer_usdc_ata,
        token_account(PLATFORM_USDC_MINT, DEVELOPER_WALLET, 0),
    );
    program_test.add_account(
        treasury_usdc_ata,
        token_account(PLATFORM_USDC_MINT, treasury, 0),
    );

    let mut context = program_test.start_with_context().await;
    let actual_payer = context.payer.pubkey();
    let recipient = Pubkey::new_unique();
    let payer_usdc_ata = get_associated_token_address(&actual_payer, &PLATFORM_USDC_MINT);
    let source_ata = get_associated_token_address(&actual_payer, &source_mint);
    let destination_ata = get_associated_token_address(&recipient, &source_mint);

    context.set_account(
        &payer_usdc_ata,
        &solana_sdk::account::AccountSharedData::from(token_account(
            PLATFORM_USDC_MINT,
            actual_payer,
            500_000,
        )),
    );
    context.set_account(
        &source_ata,
        &solana_sdk::account::AccountSharedData::from(token_account(
            source_mint,
            actual_payer,
            10_000,
        )),
    );
    context.set_account(
        &destination_ata,
        &solana_sdk::account::AccountSharedData::from(token_account(source_mint, recipient, 0)),
    );

    let initialize = initialize_ix(actual_payer, treasury, treasury_vault);
    send(&mut context, initialize)
        .await
        .expect("treasury PDA initialization succeeds");

    let operation_id = [7_u8; 32];
    let (fee_receipt, _) = Pubkey::find_program_address(
        &[FEE_RECEIPT_SEED, actual_payer.as_ref(), operation_id.as_ref()],
        &program_id,
    );
    let developer_before = read_token_amount(
        &context
            .banks_client
            .get_account(developer_usdc_ata)
            .await
            .expect("developer ATA lookup")
            .expect("developer ATA exists"),
    );
    let payer_usdc_before = read_token_amount(
        &context
            .banks_client
            .get_account(payer_usdc_ata)
            .await
            .expect("payer USDC ATA lookup")
            .expect("payer USDC ATA exists"),
    );

    let ix = transfer_with_fee_ix(
        actual_payer,
        treasury,
        fee_receipt,
        source_mint,
        source_ata,
        destination_ata,
        recipient,
        PLATFORM_USDC_MINT,
        payer_usdc_ata,
        developer_usdc_ata,
        treasury_usdc_ata,
        operation_id,
        250,
    );
    send(&mut context, ix.clone())
        .await
        .expect("token transfer and fixed platform fee succeed atomically");

    let source_balance = read_token_amount(
        &context
            .banks_client
            .get_account(source_ata)
            .await
            .expect("source lookup")
            .expect("source exists"),
    );
    let destination_balance = read_token_amount(
        &context
            .banks_client
            .get_account(destination_ata)
            .await
            .expect("destination lookup")
            .expect("destination exists"),
    );
    let payer_usdc_after = read_token_amount(
        &context
            .banks_client
            .get_account(payer_usdc_ata)
            .await
            .expect("payer USDC lookup")
            .expect("payer USDC exists"),
    );
    let developer_after = read_token_amount(
        &context
            .banks_client
            .get_account(developer_usdc_ata)
            .await
            .expect("developer USDC lookup")
            .expect("developer USDC exists"),
    );
    let treasury_after = read_token_amount(
        &context
            .banks_client
            .get_account(treasury_usdc_ata)
            .await
            .expect("treasury USDC lookup")
            .expect("treasury USDC exists"),
    );

    assert_eq!(source_balance, 9_750);
    assert_eq!(destination_balance, 250);
    assert_eq!(payer_usdc_before - payer_usdc_after, 100_000);
    assert_eq!(developer_after - developer_before, 60_000);
    assert_eq!(treasury_after, 40_000);

    let treasury_state_account = context
        .banks_client
        .get_account(treasury)
        .await
        .expect("treasury state lookup")
        .expect("treasury state exists");
    let treasury_state = read_treasury(&treasury_state_account);
    assert_eq!(treasury_state.total_platform_usdc_fees_collected, 100_000);
    assert_eq!(treasury_state.total_platform_usdc_developer_paid, 60_000);
    assert_eq!(treasury_state.total_platform_usdc_treasury_paid, 40_000);

    let receipt_account = context
        .banks_client
        .get_account(fee_receipt)
        .await
        .expect("receipt lookup")
        .expect("operation receipt exists");
    let receipt = read_receipt(&receipt_account);
    assert_eq!(receipt.payer, actual_payer);
    assert_eq!(receipt.operation_id, operation_id);
    assert_eq!(receipt.transfer_amount, 250);
    assert_eq!(receipt.total_fee_usdc, 100_000);
    assert_eq!(receipt.developer_fee_usdc, 60_000);
    assert_eq!(receipt.treasury_fee_usdc, 40_000);

    // The same payer/operation id cannot create a second receipt or be charged
    // again. Failed replay leaves all three token balances unchanged.
    let replay = send(&mut context, ix).await;
    assert!(replay.is_err(), "duplicate operation receipt must fail");
    assert_eq!(
        read_token_amount(
            &context.banks_client.get_account(payer_usdc_ata).await.unwrap().unwrap()
        ),
        payer_usdc_after
    );
    assert_eq!(
        read_token_amount(
            &context.banks_client.get_account(developer_usdc_ata).await.unwrap().unwrap()
        ),
        developer_after
    );
    assert_eq!(
        read_token_amount(
            &context.banks_client.get_account(treasury_usdc_ata).await.unwrap().unwrap()
        ),
        treasury_after
    );
}
