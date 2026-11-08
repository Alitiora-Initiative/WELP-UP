//! WELP UP custom launch rail — on-chain token creation with creator-defined
//! supply and precision, and an on-chain WELP service fee.
//!
//! The website is only a middleman: it serializes and broadcasts. The creator's
//! wallet signs, the mint keypair is generated client-side, and the service fee
//! is enforced by this program and paid straight to the treasury vault PDA.
//!
//! Token design: a classic SPL mint (same program as the pump.fun rail's
//! tokens) initialized inside this instruction, full supply minted to the
//! creator's token account, and Metaplex metadata initialized over the mint so
//! wallets render the WELP name/ticker/logo instantly.

use crate::LaunchToken;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack as TokenPack;
use anchor_lang::solana_program::program::invoke_signed;

pub const LAUNCH_SERVICE_FEE_LAMPORTS: u64 = 2_500_000;
pub const MAX_WHOLE_TOKEN_SUPPLY: u64 = 1_000_000_000;
pub const MAX_TOKEN_DECIMALS: u8 = 9;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TokenLaunchParams {
    pub whole_token_supply: u64,
    pub decimals: u8,
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

/// Launch a creator-defined token in one atomic transaction.
pub fn launch_token_impl(ctx: Context<LaunchToken>, params: TokenLaunchParams) -> Result<()> {
    let TokenLaunchParams {
        whole_token_supply,
        decimals,
        name,
        symbol,
        uri,
    } = &params;

    require!(*decimals <= MAX_TOKEN_DECIMALS, LaunchError::DecimalsOutOfRange);
    require!(
        *whole_token_supply > 0 && *whole_token_supply <= MAX_WHOLE_TOKEN_SUPPLY,
        LaunchError::SupplyOutOfRange
    );
    validate_metadata_bytes(name, symbol, uri)?;

    let raw_mint_amount = whole_mint_amount_u64(*whole_token_supply, *decimals)?;

    // 1. Allocate and create the classic SPL mint. The mint keypair signs the
    //    outer transaction; the creator funds the rent.
    let mint_rent = Rent::get()?.minimum_balance(        spl_token::state::Mint::LEN);
    anchor_lang::solana_program::program::invoke_signed(
        &anchor_lang::solana_program::system_instruction::create_account(
            ctx.accounts.creator.key,
            ctx.accounts.mint.key,
            mint_rent,
                    spl_token::state::Mint::LEN as u64,
            &spl_token::id(),
        ),
        &[
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.mint.to_account_info(),
        ],
        &[],
    )?;

    // 2. Initialize the mint with the creator's chosen precision. The creator
    //    keeps the mint authority; no freeze authority is set.
    invoke_signed(
        &spl_token::instruction::initialize_mint2(
            &spl_token::id(),
            ctx.accounts.mint.key,
            ctx.accounts.creator.key,
            None,
            *decimals,
        )?,
        &[ctx.accounts.mint.to_account_info()],
        &[],
    )?;

    // Create the canonical ATA only after the mint is initialized. Attempting
    // to let Anchor initialize it during account validation would run before
    // this instruction has created the mint.
    anchor_spl::associated_token::create(CpiContext::new(
        ctx.accounts.associated_token_program.to_account_info(),
        anchor_spl::associated_token::Create {
            payer: ctx.accounts.creator.to_account_info(),
            associated_token: ctx.accounts.creator_token_account.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        },
    ))?;
    if raw_mint_amount > 0 {
        invoke_signed(
            &spl_token::instruction::mint_to(
                &spl_token::id(),
                ctx.accounts.mint.key,
                ctx.accounts.creator_token_account.key,
                ctx.accounts.creator.key,
                &[],
                raw_mint_amount,
            )?,
            &[
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.creator_token_account.to_account_info(),
            ],
            &[],
        )?;
    }
    // Permanently revoke mint authority so the chosen supply cannot be
    // inflated later. Freeze authority was already initialized as None.
    invoke_signed(
        &spl_token::instruction::set_authority(
            &spl_token::id(),
            ctx.accounts.mint.key,
            None,
            spl_token::instruction::AuthorityType::MintTokens,
            ctx.accounts.creator.key,
            &[],
        )?,
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.creator.to_account_info(),
        ],
        &[],
    )?;

    // 4. Initialize Metaplex metadata (name / symbol / uri). This is what
    //    wallets and explorers read to render the token's logo instantly.
    {
        // The client derives the canonical metadata PDA; the seeds constraint
        // on the accounts struct enforces it byte-for-byte.
        let metadata_instruction = anchor_spl::metadata::mpl_token_metadata::instructions::CreateMetadataAccountV3 {
            metadata: ctx.accounts.metadata.key(),
            mint: ctx.accounts.mint.key(),
            mint_authority: ctx.accounts.creator.key(),
            update_authority: (ctx.accounts.creator.key(), true),
            payer: ctx.accounts.creator.key(),
            system_program: ctx.accounts.system_program.key(),
            rent: None,
        }
        .instruction(
            anchor_spl::metadata::mpl_token_metadata::instructions::CreateMetadataAccountV3InstructionArgs {
                data: anchor_spl::metadata::mpl_token_metadata::types::DataV2 {
                    name: name.clone(),
                    symbol: symbol.clone(),
                    uri: uri.clone(),
                    seller_fee_basis_points: 0,
                    creators: None,
                    collection: None,
                    uses: None,
                },
                is_mutable: false,
                collection_details: None,
            },
        );
        anchor_lang::solana_program::program::invoke(
            &metadata_instruction,
            &[
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.creator.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.metadata_program.to_account_info(),
            ],
        )?;
    }

    // 5. Charge the WELP service fee. The vault target is fixed by the seeds on
    //    this account, so the website cannot redirect the fee, and the
    //    treasury accounting keeps the epoch split exact.
    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::system_instruction::transfer(
            ctx.accounts.creator.key,
            ctx.accounts.treasury_vault.key,
            LAUNCH_SERVICE_FEE_LAMPORTS,
        ),
        &[
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.treasury_vault.to_account_info(),
        ],
    )?;
    ctx.accounts.treasury.record_launch_fee(LAUNCH_SERVICE_FEE_LAMPORTS)?;

    emit!(TokenLaunched {
        mint: ctx.accounts.mint.key(),
        creator: ctx.accounts.creator.key(),
        whole_token_supply: *whole_token_supply,
        decimals: *decimals,
        raw_mint_amount,
        name: name.clone(),
        symbol: symbol.clone(),
        metadata_uri: uri.clone(),
        service_fee_lamports: LAUNCH_SERVICE_FEE_LAMPORTS,
        treasury_vault: ctx.accounts.treasury_vault.key(),
    });
    Ok(())
}

fn validate_metadata_bytes(name: &str, symbol: &str, uri: &str) -> Result<()> {
    let name_bytes = name.as_bytes();
    let symbol_bytes = symbol.as_bytes();
    let uri_bytes = uri.as_bytes();
    require!(!name_bytes.is_empty() && name_bytes.len() <= 48, LaunchError::InvalidName);
    require!(!symbol_bytes.is_empty() && symbol_bytes.len() <= 10, LaunchError::InvalidSymbol);
    require!(!uri_bytes.is_empty() && uri_bytes.len() <= 200, LaunchError::InvalidUri);
    // Ticker must be printable ASCII with no internal whitespace.
    if !symbol_bytes.iter().all(|byte| (0x21..=0x7e).contains(byte)) {
        return Err(LaunchError::InvalidSymbol.into());
    }
    // URI must start with a scheme so it stays a real web resource.
    if !uri.starts_with("http://") && !uri.starts_with("https://") {
        return Err(LaunchError::InvalidUri.into());
    }
    Ok(())
}


/// Exact raw base units for a creator's whole-token supply and decimals,
/// checked for u64 overflow before any token arithmetic runs.
pub fn whole_mint_amount_u64(whole_supply: u64, decimals: u8) -> Result<u64> {
    require!(decimals <= MAX_TOKEN_DECIMALS, LaunchError::DecimalsOutOfRange);
    let factor = 10u128
        .checked_pow(decimals as u32)
        .ok_or(LaunchError::DecimalsOutOfRange)?;
    let raw = (whole_supply as u128)
        .checked_mul(factor)
        .ok_or(LaunchError::SupplyRawOverflow)?;
    u64::try_from(raw).map_err(|_| LaunchError::SupplyRawOverflow.into())
}

#[event]
pub struct TokenLaunched {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub whole_token_supply: u64,
    pub decimals: u8,
    pub raw_mint_amount: u64,
    pub name: String,
    pub symbol: String,
    pub metadata_uri: String,
    pub service_fee_lamports: u64,
    pub treasury_vault: Pubkey,
}

#[error_code]
pub enum LaunchError {
    #[msg("Mint precision must be between 0 and 9 decimals.")]
    DecimalsOutOfRange,
    #[msg("Whole-token supply cannot exceed one billion tokens.")]
    SupplyOutOfRange,
    #[msg("The raw mint amount does not fit a u64.")]
    SupplyRawOverflow,
    #[msg("Token name must be 1 to 48 bytes of UTF-8 text.")]
    InvalidName,
    #[msg("Ticker must be 1 to 10 printable ASCII bytes.")]
    InvalidSymbol,
    #[msg("The metadata URI must be a 1 to 200 byte http(s) address.")]
    InvalidUri,
    #[msg("The metadata account is not funded to the rent-exempt floor.")]
    MetadataRentTooLow,
}
