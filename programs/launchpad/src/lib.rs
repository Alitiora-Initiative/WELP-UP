//! WELP UP treasury core.
//!
//! IMPORTANT: this is a local-test implementation slice, not a deployed or
//! audited production launchpad. The program id below is a sample local ID.
//! Replace it with a deployment keypair-generated ID before any deployment.
//! The launch buy/curve/refund/Raydium instructions are not enabled in this
//! crate yet; the 50-bps gross-input fee arithmetic below is a tested primitive for that route.

use anchor_lang::{prelude::*, system_program};

declare_id!("BrcdB9sV7z9DvF9rDHG263HUxXgJM3iCQdF36TcxbFEn");

pub const TREASURY_SEED: &[u8] = b"treasury-v1";
pub const TREASURY_VAULT_SEED: &[u8] = b"treasury-vault-v1";
pub const DEVELOPER_WALLET: Pubkey = pubkey!("ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG");
pub const BASIS_POINTS_DENOMINATOR: u128 = 10_000;
pub const PROTOCOL_SWAP_FEE_BPS: u128 = 50; // 0.50% of gross swap input
pub const DISTRIBUTION_EPOCH_SECONDS: i64 = 1_209_600; // exactly 14 days
pub const DEVELOPER_DISTRIBUTION_BPS: u128 = 6_000; // 60%
pub const PERMANENT_RESERVE_BPS: u128 = 4_000; // 40%

pub mod token_launch;
use token_launch::TokenLaunchParams;

#[derive(Accounts)]
pub struct LaunchToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut)]
    pub mint: Signer<'info>,
    /// CHECK: constrained to the creator's canonical ATA and created after mint initialization.
    #[account(mut, seeds = [creator.key().as_ref(), token_program.key().as_ref(), mint.key().as_ref()], bump, seeds::program = anchor_spl::associated_token::ID)]
    pub creator_token_account: UncheckedAccount<'info>,
    #[account(mut, seeds = [TREASURY_SEED], bump = treasury.bump)]
    pub treasury: Account<'info, TreasuryAccount>,
    #[account(mut, seeds = [TREASURY_VAULT_SEED], bump = treasury.vault_bump, address = treasury.treasury_vault)]
    pub treasury_vault: SystemAccount<'info>,
    /// CHECK: canonical Metaplex metadata PDA, created by the metadata CPI.
    #[account(mut, seeds = [b"metadata", anchor_spl::metadata::ID.as_ref(), mint.key().as_ref()], bump, seeds::program = anchor_spl::metadata::ID)]
    pub metadata: UncheckedAccount<'info>,
    /// CHECK: constrained to the canonical executable Metaplex program.
    #[account(address = anchor_spl::metadata::ID)]
    pub metadata_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[program]
pub mod welp_launchpad {
    use super::*;

    /// Launch a creator-defined token: same behavior as the rail's inner
    /// processor, exposed through the single Anchor program interface.
    pub fn launch_token(ctx: Context<LaunchToken>, params: TokenLaunchParams) -> Result<()> {
        token_launch::launch_token_impl(ctx, params)
    }

    /// Initialize the one global Treasury PDA. The destination is compiled
    /// into the program and cannot be supplied or changed by the caller.
    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let treasury = &mut ctx.accounts.treasury;

        treasury.developer_wallet = DEVELOPER_WALLET;
        treasury.treasury_vault = ctx.accounts.treasury_vault.key();
        treasury.total_fees_collected = 0;
        treasury.total_developer_disbursed = 0;
        treasury.locked_reserve_lamports = 0;
        treasury.last_distribution_timestamp = now;
        treasury.bump = ctx.bumps.treasury;
        treasury.vault_bump = ctx.bumps.treasury_vault;

        emit!(TreasuryInitialized {
            developer_wallet: DEVELOPER_WALLET,
            treasury_vault: treasury.treasury_vault,
            timestamp: now,
        });
        Ok(())
    }

    /// Permissionless epoch harvest. Anyone may pay the transaction fee to
    /// trigger it, but the only recipient is the hardcoded developer wallet.
    ///
    /// The 40% reserve is tracked in state and excluded from every later
    /// distributable-balance calculation. It is never included in a later
    /// 60/40 split. This avoids slowly draining the "permanent" 40% over
    /// repeated epochs.
    pub fn disburse_treasury_funds(ctx: Context<DisburseTreasuryFunds>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let treasury = &mut ctx.accounts.treasury;

        require_keys_eq!(
            treasury.developer_wallet,
            DEVELOPER_WALLET,
            TreasuryError::InvalidDeveloperWallet
        );
        require!(
            ctx.accounts.developer_wallet.key() == DEVELOPER_WALLET,
            TreasuryError::InvalidDeveloperWallet
        );

        require!(
            now >= treasury.last_distribution_timestamp,
            TreasuryError::ClockMovedBackwards
        );
        let elapsed = now
            .checked_sub(treasury.last_distribution_timestamp)
            .ok_or(TreasuryError::ArithmeticOverflow)?;
        require!(
            elapsed >= DISTRIBUTION_EPOCH_SECONDS,
            TreasuryError::EpochNotElapsed
        );

        let vault_info = ctx.accounts.treasury_vault.to_account_info();
        let developer_info = ctx.accounts.developer_wallet.to_account_info();

        let current_vault_balance = vault_info.lamports();
        let vault_rent_floor = Rent::get()?.minimum_balance(0);
        let protected_balance = vault_rent_floor
            .checked_add(treasury.locked_reserve_lamports)
            .ok_or(TreasuryError::ArithmeticOverflow)?;

        // Only protocol fees previously recorded by the program can be
        // harvested. Direct donations or unsolicited lamport transfers to the
        // PDA remain untouched and cannot be swept to the developer wallet.
        let distributable = calculate_undistributed_fees(
            treasury.total_fees_collected,
            treasury.total_developer_disbursed,
            treasury.locked_reserve_lamports,
        )?;

        let minimum_accounted_balance = protected_balance
            .checked_add(distributable)
            .ok_or(TreasuryError::ArithmeticOverflow)?;
        require!(
            current_vault_balance >= minimum_accounted_balance,
            TreasuryError::TreasuryAccountingInvariant
        );
        require!(distributable > 0, TreasuryError::NothingToDisburse);

        let developer_amount = mul_div_floor_u64(
            distributable,
            DEVELOPER_DISTRIBUTION_BPS,
            BASIS_POINTS_DENOMINATOR,
        )?;
        let newly_locked = distributable
            .checked_sub(developer_amount)
            .ok_or(TreasuryError::ArithmeticUnderflow)?;

        require!(developer_amount > 0, TreasuryError::NothingToDisburse);

        let new_locked_reserve = treasury
            .locked_reserve_lamports
            .checked_add(newly_locked)
            .ok_or(TreasuryError::ArithmeticOverflow)?;
        let new_developer_disbursed = treasury
            .total_developer_disbursed
            .checked_add(developer_amount)
            .ok_or(TreasuryError::ArithmeticOverflow)?;

        // TreasuryVault is a separate System Program-owned PDA. A signed
        // System Program transfer is required to debit this vault.
        let bump_seed = [treasury.vault_bump];
        let signer_seeds: &[&[u8]] = &[TREASURY_VAULT_SEED, &bump_seed];
        let signer = &[signer_seeds];
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: vault_info,
                    to: developer_info,
                },
                signer,
            ),
            developer_amount,
        )?;

        treasury.locked_reserve_lamports = new_locked_reserve;
        treasury.total_developer_disbursed = new_developer_disbursed;
        treasury.last_distribution_timestamp = now;

        emit!(TreasuryDisbursed {
            developer_wallet: DEVELOPER_WALLET,
            treasury_vault: treasury.treasury_vault,
            developer_amount,
            newly_locked_reserve: newly_locked,
            total_locked_reserve: new_locked_reserve,
            timestamp: now,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = TreasuryAccount::SPACE,
        seeds = [TREASURY_SEED],
        bump
    )]
    pub treasury: Account<'info, TreasuryAccount>,
    /// CHECK: initialized as a zero-data System Program account at the vault PDA.
    #[account(
        init,
        payer = payer,
        space = 0,
        seeds = [TREASURY_VAULT_SEED],
        bump,
        owner = system_program::ID
    )]
    pub treasury_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DisburseTreasuryFunds<'info> {
    /// Any caller may trigger a matured epoch; the caller receives no funds.
    pub caller: Signer<'info>,
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump,
        has_one = developer_wallet @ TreasuryError::InvalidDeveloperWallet,
        has_one = treasury_vault @ TreasuryError::InvalidTreasuryVault
    )]
    pub treasury: Account<'info, TreasuryAccount>,
    #[account(
        mut,
        seeds = [TREASURY_VAULT_SEED],
        bump = treasury.vault_bump,
        address = treasury.treasury_vault @ TreasuryError::InvalidTreasuryVault
    )]
    pub treasury_vault: SystemAccount<'info>,
    #[account(
        mut,
        address = DEVELOPER_WALLET @ TreasuryError::InvalidDeveloperWallet
    )]
    pub developer_wallet: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct TreasuryAccount {
    pub developer_wallet: Pubkey,
    pub treasury_vault: Pubkey,
    /// Cumulative fee amount credited by a future verified swap instruction.
    pub total_fees_collected: u64,
    /// Cumulative developer allocation released at epoch maturity.
    pub total_developer_disbursed: u64,
    /// 40% reserves retained by treasury policy.
    pub locked_reserve_lamports: u64,
    pub last_distribution_timestamp: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl TreasuryAccount {
    pub const SPACE: usize = 8 + 32 + 32 + (8 * 4) + 2;

    /// Record a verified on-chain fee payment so the epoch split stays exact.
    /// Called by the rail's launch path with the enforced service fee.
    pub fn record_launch_fee(&mut self, fee: u64) -> Result<()> {
        let total = self
            .total_fees_collected
            .checked_add(fee)
            .ok_or_else(|| error!(TreasuryError::ArithmeticOverflow))?;
        self.total_fees_collected = total;
        Ok(())
    }
}

/// Calculate a 0.50% protocol fee from gross input, split 60/40.
///
/// This is a pure arithmetic primitive. It does not prove a swap occurred and
/// does not move funds; the production swap instruction must invoke it and
/// atomically settle the recipient transfers.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct ProtocolSwapFeeRoute {
    pub gross_input_base_units: u64,
    pub protocol_fee_base_units: u64,
    pub treasury_credit_base_units: u64,
    pub net_swap_input_base_units: u64,
}

pub fn calculate_protocol_swap_fee(gross_input_base_units: u64) -> Result<ProtocolSwapFeeRoute> {
    require!(gross_input_base_units > 0, TreasuryError::ZeroSwapInput);
    let protocol_fee = mul_div_floor_u64(
        gross_input_base_units,
        PROTOCOL_SWAP_FEE_BPS,
        BASIS_POINTS_DENOMINATOR,
    )?;
    require!(protocol_fee > 0, TreasuryError::FeeBelowMinimumUnit);

    let net_swap_input = gross_input_base_units
        .checked_sub(protocol_fee)
        .ok_or(TreasuryError::ArithmeticUnderflow)?;

    Ok(ProtocolSwapFeeRoute {
        gross_input_base_units,
        protocol_fee_base_units: protocol_fee,
        treasury_credit_base_units: protocol_fee,
        net_swap_input_base_units: net_swap_input,
    })
}

/// Return only fee inflows that have not already been disbursed or locked.
/// This excludes direct donations and any balance not recorded by the fee
/// collection instruction. All three counters are cumulative lamports.
pub fn calculate_undistributed_fees(
    total_fees_collected: u64,
    total_developer_disbursed: u64,
    locked_reserve_lamports: u64,
) -> Result<u64> {
    let already_accounted = total_developer_disbursed
        .checked_add(locked_reserve_lamports)
        .ok_or(TreasuryError::ArithmeticOverflow)?;
    total_fees_collected
        .checked_sub(already_accounted)
        .ok_or(TreasuryError::TreasuryAccountingInvariant.into())
}

pub fn split_epoch_balance(distributable_lamports: u64) -> Result<(u64, u64)> {
    let developer_amount = mul_div_floor_u64(
        distributable_lamports,
        DEVELOPER_DISTRIBUTION_BPS,
        BASIS_POINTS_DENOMINATOR,
    )?;
    let retained_amount = distributable_lamports
        .checked_sub(developer_amount)
        .ok_or(TreasuryError::ArithmeticUnderflow)?;
    Ok((developer_amount, retained_amount))
}

pub fn epoch_is_mature(last_distribution_timestamp: i64, now: i64) -> Result<bool> {
    require!(
        now >= last_distribution_timestamp,
        TreasuryError::ClockMovedBackwards
    );
    let elapsed = now
        .checked_sub(last_distribution_timestamp)
        .ok_or(TreasuryError::ArithmeticOverflow)?;
    Ok(elapsed >= DISTRIBUTION_EPOCH_SECONDS)
}

fn mul_div_floor_u64(value: u64, numerator: u128, denominator: u128) -> Result<u64> {
    require!(denominator > 0, TreasuryError::DivisionByZero);
    let product = (value as u128)
        .checked_mul(numerator)
        .ok_or(TreasuryError::ArithmeticOverflow)?;
    let quotient = product / denominator;
    u64::try_from(quotient).map_err(|_| error!(TreasuryError::ArithmeticOverflow))
}

#[event]
pub struct TreasuryInitialized {
    pub developer_wallet: Pubkey,
    pub treasury_vault: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TreasuryDisbursed {
    pub developer_wallet: Pubkey,
    pub treasury_vault: Pubkey,
    pub developer_amount: u64,
    pub newly_locked_reserve: u64,
    pub total_locked_reserve: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum TreasuryError {
    #[msg("The destination is not the hardcoded WELP developer wallet.")]
    InvalidDeveloperWallet,
    #[msg("The treasury vault account is not the configured vault PDA.")]
    InvalidTreasuryVault,
    #[msg("The two-week distribution epoch has not elapsed.")]
    EpochNotElapsed,
    #[msg("The Solana clock moved backwards relative to the stored timestamp.")]
    ClockMovedBackwards,
    #[msg("No distributable treasury balance is available.")]
    NothingToDisburse,
    #[msg("Treasury balance does not cover rent and its permanent reserve.")]
    TreasuryAccountingInvariant,
    #[msg("A swap input must be greater than zero.")]
    ZeroSwapInput,
    #[msg("The 0.50% protocol fee is below one raw input base unit.")]
    FeeBelowMinimumUnit,
    #[msg("Checked arithmetic overflow.")]
    ArithmeticOverflow,
    #[msg("Checked arithmetic underflow.")]
    ArithmeticUnderflow,
    #[msg("Division by zero.")]
    DivisionByZero,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn developer_wallet_constant_is_the_published_recipient() {
        assert_eq!(
            DEVELOPER_WALLET,
            Pubkey::from_str("ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG").unwrap()
        );
    }

    #[test]
    fn protocol_fee_is_half_percent_of_gross_input_and_credits_treasury() {
        let route = calculate_protocol_swap_fee(1_000_000_000).unwrap();
        assert_eq!(route.gross_input_base_units, 1_000_000_000);
        assert_eq!(route.protocol_fee_base_units, 5_000_000);
        assert_eq!(route.treasury_credit_base_units, 5_000_000);
        assert_eq!(route.net_swap_input_base_units, 995_000_000);
        assert_eq!(
            route.net_swap_input_base_units + route.protocol_fee_base_units,
            route.gross_input_base_units
        );
    }

    #[test]
    fn protocol_fee_uses_checked_integer_rounding() {
        let route = calculate_protocol_swap_fee(10_000).unwrap();
        assert_eq!(route.protocol_fee_base_units, 50);
        assert_eq!(route.treasury_credit_base_units, 50);
        assert_eq!(route.net_swap_input_base_units, 9_950);
    }

    #[test]
    fn protocol_fee_rejects_zero_and_fee_below_input_precision() {
        assert!(calculate_protocol_swap_fee(0).is_err());
        assert!(calculate_protocol_swap_fee(1).is_err());
    }

    #[test]
    fn epoch_requires_at_least_two_weeks() {
        let start = 1_700_000_000_i64;
        assert!(!epoch_is_mature(start, start + DISTRIBUTION_EPOCH_SECONDS - 1).unwrap());
        assert!(epoch_is_mature(start, start + DISTRIBUTION_EPOCH_SECONDS).unwrap());
        assert!(epoch_is_mature(start, start + DISTRIBUTION_EPOCH_SECONDS + 1).unwrap());
        assert!(epoch_is_mature(start, start).is_ok());
    }

    #[test]
    fn clock_reversal_is_rejected() {
        assert!(epoch_is_mature(2_000, 1_999).is_err());
    }

    #[test]
    fn harvest_uses_only_recorded_fee_inflows() {
        assert_eq!(calculate_undistributed_fees(1_000, 600, 400).unwrap(), 0);
        assert_eq!(calculate_undistributed_fees(1_500, 600, 400).unwrap(), 500);
        assert!(calculate_undistributed_fees(999, 600, 400).is_err());
        // Any lamports sent directly to the PDA are not in total_fees_collected
        // and therefore cannot be counted as distributable program revenue.
        assert_eq!(calculate_undistributed_fees(0, 0, 0).unwrap(), 0);
    }

    #[test]
    fn epoch_harvest_retains_forty_percent() {
        let (developer, retained) = split_epoch_balance(1_000).unwrap();
        assert_eq!(developer, 600);
        assert_eq!(retained, 400);
        assert_eq!(developer + retained, 1_000);
    }

    #[test]
    fn one_lamport_rounding_is_retained_in_the_reserve() {
        let (developer, retained) = split_epoch_balance(1).unwrap();
        assert_eq!(developer, 0);
        assert_eq!(retained, 1);
    }

    #[test]
    fn treasury_account_space_includes_anchor_discriminator_and_fields() {
        assert_eq!(TreasuryAccount::SPACE, 106);
    }

    #[test]
    fn creator_supply_scaling_is_exact_at_zero_and_nine_decimals() {
        assert_eq!(token_launch::whole_mint_amount_u64(1, 0).unwrap(), 1);
        assert_eq!(
            token_launch::whole_mint_amount_u64(1_000_000_000, 9).unwrap(),
            1_000_000_000_000_000_000
        );
        assert!(token_launch::whole_mint_amount_u64(1, 10).is_err());
    }
}
