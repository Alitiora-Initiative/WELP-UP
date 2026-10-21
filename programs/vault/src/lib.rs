//! WELP UP! vault program (scaffold).
//!
//! Per-user PDA vault with on-chain total-cap and per-position limits.
//! Mainnet funds must remain disabled until ROADMAP vault gates 3–7 complete.
//!
//! Build (when Anchor + Solana CLI are available):
//!   anchor build -p welp-vault
//! Deploy only to devnet until audited.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Vault1111111111111111111111111111111111111"); // placeholder; replace after `anchor keys list`

/// Default per-position ceiling: 0.02 SOL.
pub const DEFAULT_PER_POSITION_MAX: u64 = 20_000_000;

/// Hard floor matching LIMITS.md / browser (0.001 SOL).
pub const MIN_POSITION_LAMPORTS: u64 = 1_000_000;

#[program]
pub mod welp_vault {
    use super::*;

    /// Create the caller's vault PDA. Cap and per-position max are fixed at init
    /// (future versions may allow owner-signed increases only after audit).
    pub fn initialize(
        ctx: Context<Initialize>,
        total_cap_lamports: u64,
        per_position_max_lamports: u64,
    ) -> Result<()> {
        require!(total_cap_lamports >= MIN_POSITION_LAMPORTS, VaultError::CapTooSmall);
        require!(
            per_position_max_lamports >= MIN_POSITION_LAMPORTS
                && per_position_max_lamports <= total_cap_lamports,
            VaultError::InvalidPerPosition
        );

        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.executor = Pubkey::default();
        vault.total_cap_lamports = total_cap_lamports;
        vault.spent_lamports = 0;
        vault.per_position_max_lamports = per_position_max_lamports;
        vault.paused = false;
        vault.bump = ctx.bumps.vault;
        vault.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Owner transfers SOL into the vault PDA (system account lamports).
    pub fn fund(ctx: Context<Fund>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        let cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi, amount)?;
        Ok(())
    }

    /// Owner sets or rotates the executor key used by the off-chain agent.
    pub fn set_executor(ctx: Context<OwnerOnly>, executor: Pubkey) -> Result<()> {
        ctx.accounts.vault.executor = executor;
        Ok(())
    }

    /// Owner immediately clears the executor.
    pub fn revoke_executor(ctx: Context<OwnerOnly>) -> Result<()> {
        ctx.accounts.vault.executor = Pubkey::default();
        Ok(())
    }

    pub fn pause(ctx: Context<OwnerOnly>) -> Result<()> {
        ctx.accounts.vault.paused = true;
        Ok(())
    }

    pub fn unpause(ctx: Context<OwnerOnly>) -> Result<()> {
        ctx.accounts.vault.paused = false;
        Ok(())
    }

    /// Executor-only path for size-checked spends.
    /// Full Jupiter CPI wiring is Gate 3; this instruction enforces the caps first.
    pub fn execute_swap(ctx: Context<ExecuteSwap>, amount_lamports: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(!vault.paused, VaultError::Paused);
        require!(
            vault.executor == ctx.accounts.executor.key(),
            VaultError::UnauthorizedExecutor
        );
        require!(amount_lamports >= MIN_POSITION_LAMPORTS, VaultError::BelowMinPosition);
        require!(
            amount_lamports <= vault.per_position_max_lamports,
            VaultError::AbovePerPosition
        );
        require!(
            vault
                .spent_lamports
                .checked_add(amount_lamports)
                .ok_or(VaultError::Overflow)?
                <= vault.total_cap_lamports,
            VaultError::CapExceeded
        );

        // Gate 3: CPI into approved Jupiter route using remaining accounts.
        // Until then we only record the spend authorization so off-chain tests
        // and future integration can assert the accounting path.
        vault.spent_lamports = vault
            .spent_lamports
            .checked_add(amount_lamports)
            .ok_or(VaultError::Overflow)?;
        Ok(())
    }

    /// Owner withdraws SOL from the vault PDA. Tokens (ATA) handled in Gate 3.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        let vault_info = ctx.accounts.vault.to_account_info();
        let owner_info = ctx.accounts.owner.to_account_info();
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(Vault::SPACE);
        let available = vault_info
            .lamports()
            .saturating_sub(min_rent);
        require!(amount <= available, VaultError::InsufficientFunds);

        **vault_info.try_borrow_mut_lamports()? -= amount;
        **owner_info.try_borrow_mut_lamports()? += amount;
        Ok(())
    }
}

// ── Accounts ──────────────────────────────────────────────────────────────

#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub executor: Pubkey,
    pub total_cap_lamports: u64,
    pub spent_lamports: u64,
    pub per_position_max_lamports: u64,
    pub paused: bool,
    pub bump: u8,
    pub created_at: i64,
}

impl Vault {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 8;
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = Vault::SPACE,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Fund<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerOnly<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
    pub executor: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
}

// ── Errors ────────────────────────────────────────────────────────────────

#[error_code]
pub enum VaultError {
    #[msg("Total cap is below the minimum position size")]
    CapTooSmall,
    #[msg("Per-position max is invalid")]
    InvalidPerPosition,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Vault is paused")]
    Paused,
    #[msg("Signer is not the authorized executor")]
    UnauthorizedExecutor,
    #[msg("Signer is not the vault owner")]
    UnauthorizedOwner,
    #[msg("Below minimum position size (0.001 SOL)")]
    BelowMinPosition,
    #[msg("Above per-position maximum")]
    AbovePerPosition,
    #[msg("Would exceed total allocation cap")]
    CapExceeded,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Insufficient vault balance for withdrawal")]
    InsufficientFunds,
}
