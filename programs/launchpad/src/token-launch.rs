//! WELP UP custom launch rail — on-chain token creation with creator-defined
//! supply and precision, and an on-chain WELP service fee.
//!
//! The website is only a middleman: it serializes and broadcasts. The creator's
//! wallet signs, the mint keypair is generated client-side, and the service fee
//! is enforced by this program and paid straight to the treasury vault PDA.
//!
//! Token design: Token-2022 with the MetadataPointer extension pointing at the
//! mint itself, then TokenMetadata (name / symbol / uri) initialized on the
//! mint, so wallets render the token and its WELP metadata instantly with no
//! external metadata account and no external metadata program.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_program};
use anchor_lang::solana_program::pubkey::Pubkey;

use crate::{TREASURY_VAULT_SEED, TreasuryAccount};

/// One-shot service fee for the WELP custom launch rail: 0.0025 SOL.
pub const LAUNCH_SERVICE_FEE_LAMPORTS: u64 = 2_500_000;

/// Whole-token supply cap: one billion tokens.
pub const MAX_WHOLE_TOKEN_SUPPLY: u64 = 1_000_000_000;

/// Maximum mint precision accepted by the rail.
pub const MAX_TOKEN_DECIMALS: u8 = 9;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TokenLaunchParams {
    /// Whole-token supply the creator wants, 0 to 1,000,000,000.
    pub whole_token_supply: u64,
    /// Mint precision, 0 to 9 decimals.
    pub decimals: u8,
    /// Token name stored in the on-chain metadata extension.
    pub name: String,
    /// Ticker stored in the on-chain metadata extension.
    pub symbol: String,
    /// Metadata URI pointing at the audited welpup.fun metadata route.
    pub uri: String,
}


    /// Launch a creator-defined token in one atomic transaction: allocate and
    /// initialize the mint with the creator's chosen decimals and metadata
    /// extensions, create the creator's token account, mint the full supply to
    /// it, then charge the WELP service fee straight to the treasury vault PDA.
    pub fn launch_token_impl(
        ctx: Context<LaunchToken>,
        params: TokenLaunchParams,
    ) -> Result<()> {
        let TokenLaunchParams {
            whole_token_supply,
            decimals,
            name,
            symbol,
            uri,
        } = &params;

        require!(*decimals <= MAX_TOKEN_DECIMALS, LaunchError::DecimalsOutOfRange);
        require!(
            *whole_token_supply <= MAX_WHOLE_TOKEN_SUPPLY,
            LaunchError::SupplyOutOfRange
        );
        validate_metadata_bytes(name, symbol, uri)?;

        let raw_mint_amount = whole_mint_amount_u64(*whole_token_supply, *decimals)?;
        let token2022 = ctx.accounts.token_program.key();

        // Exact account lengths come from the token-2022 extension registry,
        // so this never hardcodes a byte count.
        let extensions = [
            spl_token_2022::extension::ExtensionType::MetadataPointer,
            spl_token_2022::extension::ExtensionType::TokenMetadata,
        ];
        let mint_space = spl_token_2022::extension::ExtensionType::try_calculate_account_len::<
            spl_token_2022::state::Mint,
        >(&extensions)
        .map_err(|_| error!(LaunchError::MintSpaceCalculation))?;
        let mint_rent = Rent::get()?.minimum_balance(mint_space);

        // 1. Allocate and create the mint account owned by Token-2022. The
        //    mint keypair signs the outer transaction from the client side.
        system_program::create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.mint.to_account_info(),
                },
            ),
            mint_rent,
            mint_space as u64,
            &token2022,
        )?;

        // 2. Point the mint's metadata pointer at the mint itself before the
        //    metadata is written.
        invoke_signed(
            &spl_token_2022::instruction::initialize_metadata_pointer(
                &token2022,
                &ctx.accounts.mint.key(),
                Some(ctx.accounts.creator.key()),
                Some(ctx.accounts.mint.key()),
            )?,
            &[ctx.accounts.mint.to_account_info()],
            &[],
        )?;

        // 3. Initialize the mint itself with the creator's precision. The
        //    creator keeps the mint authority; no freeze authority is set.
        invoke_signed(
            &spl_token_2022::instruction::initialize_mint2(
                &token2022,
                &ctx.accounts.mint.key(),
                &ctx.accounts.creator.key(),
                None,
                *decimals,
            )?,
            &[ctx.accounts.mint.to_account_info()],
            &[],
        )?;

        // 4. Initialize the metadata extension on the mint: name, symbol,
        //    uri. This is what wallets read to render logo and branding.
        let metadata_instruction = initialize_token_metadata_instruction(
            &token2022,
            &ctx.accounts.creator.key(),
            &ctx.accounts.mint.key(),
            name,
            symbol,
            uri,
        )?;
        invoke_signed(
            &metadata_instruction,
            &[ctx.accounts.mint.to_account_info()],
            &[],
        )?;

        // 5. Allocate, create and initialize the creator's token account, then
        //    mint the creator's full supply directly to it.
        let token_space = spl_token_2022::extension::ExtensionType::try_get_account_len::<
            spl_token_2022::state::Account,
        >()
        .map_err(|_| error!(LaunchError::TokenAccountSpaceCalculation))?;
        let token_rent = Rent::get()?.minimum_balance(token_space);
        system_program::create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.creator_token_account.to_account_info(),
                },
            ),
            token_rent,
            token_space as u64,
            &token2022,
        )?;
        invoke_signed(
            &spl_token_2022::instruction::initialize_account3(
                &token2022,
                &ctx.accounts.creator_token_account.key(),
                &ctx.accounts.mint.key(),
                &ctx.accounts.creator.key(),
            )?,
            &[ctx.accounts.creator_token_account.to_account_info()],
            &[],
        )?;
        if raw_mint_amount > 0 {
            invoke_signed(
                &spl_token_2022::instruction::mint_to(
                    &token2022,
                    &ctx.accounts.mint.key(),
                    &ctx.accounts.creator_token_account.key(),
                    &ctx.accounts.creator.key(),
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

        // 6. Charge the WELP service fee. The vault target is fixed by the
        //    seeds on this account, so the website cannot redirect the fee,
        //    and the accounting keeps the epoch split exact.
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.creator.key(),
                &ctx.accounts.treasury_vault.key(),
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
}

#[derive(Accounts)]
pub struct LaunchToken<'info> {
    /// The creator pays mint + token account rent and the service fee, receives
    /// the full supply and stays the mint authority.
    #[account(mut)]
    pub creator: Signer<'info>,
    /// Fresh mint keypair generated client-side; its signature in the outer
    /// transaction makes system create_account valid.
    #[account(mut)]
    pub mint: Signer<'info>,
    /// The creator's token account receiving the full minted supply.
    /// CHECK: system-created and initialized to the creator inside this same
    /// instruction, before any tokens move; nothing can spend from it here.
    #[account(mut)]
    pub creator_token_account: UncheckedAccount<'info>,
    /// Initialized treasury that holds the canonical vault bump.
    #[account(
        mut,
        seeds = [crate::TREASURY_SEED],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, TreasuryAccount>,
    /// The canonical treasury vault PDA, pinned by seeds so the fee can never
    /// be redirected to an arbitrary website-controlled wallet.
    #[account(
        mut,
        seeds = [TREASURY_VAULT_SEED],
        bump = treasury.vault_bump,
    )]
    pub treasury_vault: SystemAccount<'info>,
    pub token_program: Program<'info, SplToken2022>,
    pub system_program: Program<'info, System>,
}

// Token-2022 program wrapper so Anchor's ownership checks bind to the real
// on-chain program id without pulling a hand-rolled constant.
#[derive(Clone, Debug, AnchorSerialize, AnchorDeserialize)]
pub struct SplToken2022;
impl anchor_lang::Id for SplToken2022 {
    fn id() -> Pubkey {
        spl_token_2022::ID
    }
}

fn initialize_token_metadata_instruction(
    program_id: &Pubkey,
    mint_authority: &Pubkey,
    mint: &Pubkey,
    name: &str,
    symbol: &str,
    uri: &str,
) -> anchor_lang::solana_program::instruction::Instruction {
    // TokenMetadata lives in the mint itself for this rail: the metadata
    // account, the mint, and the pointer target are all the same key.
    let args = spl_token_2022::extension::token_metadata::TokenMetadataInstruction::Initialize(
        spl_token_2022::extension::token_metadata::instruction::InitializeInstructionArgs {
            name: name.to_string(),
            symbol: symbol.to_string(),
            uri: uri.to_string(),
            additional_metadata: vec![],
        },
    );
    let mut data = args.data();
    let mut payload = vec![spl_token_2022::instruction::TokenInstruction::TokenMetadataExtension as u8];
    payload.append(&mut data);
    anchor_lang::solana_program::instruction::Instruction {
        program_id: *program_id,
        accounts: vec![
            // [writable] metadata (the mint itself: pointer target)
            AccountMeta::new(*mint, false),
            // [writable] mint
            AccountMeta::new(*mint, false),
            // [writable+signer] mint authority
            AccountMeta::new(*mint_authority, true),
            // [signer] update authority
            AccountMeta::new_readonly(*mint_authority, true),
        ],
        data: payload,
    }
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
fn whole_mint_amount_u64(whole_supply: u64, decimals: u8) -> Result<u64> {
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
    #[msg("The token-2022 mint account size could not be computed.")]
    MintSpaceCalculation,
    #[msg("The token-2022 token account size could not be computed.")]
    TokenAccountSpaceCalculation,
}
