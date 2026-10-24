//! WELP UP! vault program — M2 complete implementation.
//!
//! Per-user PDA vault with global config, share-based accounting,
//! user slots, treasury, and versioned events.
//! Mainnet funds must remain disabled until ROADMAP vault gates 3–7 complete.
//!
//! Build (when Anchor + Solana CLI are available):
//!   anchor build -p welp-vault
//! Deploy only to devnet until audited.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};
use welp_vault_checks::{
    check_initialize, check_withdraw, compute_redeem, compute_shares, settle_exposure, split_fee,
    usd_cents_to_lamports_rounded5, validate_pyth_price, CheckError,
};

declare_id!("US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx"); // undeployed placeholder; replace after `anchor keys list`

pub use welp_vault_checks::{
    DEFAULT_PER_POSITION_MAX as DEFAULT_PER_POSITION, MIN_POSITION_LAMPORTS as MIN_POSITION,
};

/// 100 SOL in lamports — aggregate deposit cap per vault.
const AGGREGATE_CAP_LAMPORTS: u64 = 100_000_000_000;

fn map_err(err: CheckError) -> VaultError {
    match err {
        CheckError::CapTooSmall => VaultError::CapTooSmall,
        CheckError::InvalidPerPosition => VaultError::InvalidPerPosition,
        CheckError::ZeroAmount => VaultError::ZeroAmount,
        CheckError::Paused => VaultError::Paused,
        CheckError::UnauthorizedExecutor => VaultError::UnauthorizedExecutor,
        CheckError::BelowMinPosition => VaultError::BelowMinPosition,
        CheckError::AbovePerPosition => VaultError::AbovePerPosition,
        CheckError::CapExceeded => VaultError::CapExceeded,
        CheckError::Overflow => VaultError::Overflow,
        CheckError::InsufficientFunds => VaultError::InsufficientFunds,
        CheckError::RouteNotAllowed => VaultError::RouteNotAllowed,
        CheckError::ExposureUnderflow => VaultError::ExposureUnderflow,
        CheckError::FeeTooHigh => VaultError::FeeTooHigh,
        CheckError::ZeroProfit => VaultError::ZeroAmount,
        CheckError::AlreadyClaimed => VaultError::ZeroAmount,
        CheckError::InvalidPrice => VaultError::InvalidPrice,
        CheckError::OverConfidence => VaultError::OverConfidence,
        CheckError::StaleFeed => VaultError::StaleFeed,
        CheckError::NonceTaken => VaultError::Overflow,
        CheckError::InsufficientBalance => VaultError::InsufficientFunds,
    }
}

fn map_check_err(err: welp_vault_checks::CheckError) -> VaultError {
    map_err(err)
}

// ── Enums ─────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VaultState {
    Funded,
    Active,
    Paused,
    Stopping,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum SlotState {
    Active,
    Paused,
    Stopping,
    Closed,
}

// ── Events ────────────────────────────────────────────────────────────────

#[event]
pub struct FundEvent {
    pub owner: Pubkey,
    pub amount: u64,
    pub shares_minted: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawEvent {
    pub owner: Pubkey,
    pub amount: u64,
    pub shares_burned: u64,
    pub timestamp: i64,
}

#[event]
pub struct VaultStateEvent {
    pub owner: Pubkey,
    pub new_state: u8,
    pub timestamp: i64,
}

#[event]
pub struct SlotCreatedEvent {
    pub owner: Pubkey,
    pub bot_account: Pubkey,
    pub timestamp: i64,
}

// ── Program ───────────────────────────────────────────────────────────────

#[program]
pub mod welp_vault {
    use super::*;

    // ── Global config ──────────────────────────────────────────────────

    /// Creates the singleton GlobalConfig PDA. Must be called once by the
    /// deployer before any vault activity.
    pub fn initialize_global_config(
        ctx: Context<InitializeGlobalConfig>,
        treasury_recipient: Pubkey,
        fee_recipient: Pubkey,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.global_config;
        cfg.authority = ctx.accounts.authority.key();
        cfg.treasury_recipient = treasury_recipient;
        cfg.fee_recipient = fee_recipient;
        cfg.pause_all = false;
        cfg.bump = ctx.bumps.global_config;
        Ok(())
    }

    // ── Vault lifecycle ────────────────────────────────────────────────

    /// Creates the caller's vault PDA in Funded state.
    pub fn create_vault(ctx: Context<CreateVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.total_deposited_lamports = 0;
        vault.available_lamports = 0;
        vault.total_shares = 0;
        vault.state = VaultState::Funded;
        vault.bump = ctx.bumps.vault;
        vault.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Owner deposits SOL; mints shares proportional to their contribution.
    pub fn fund_vault(ctx: Context<FundVault>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        {
            let vault = &ctx.accounts.vault;
            require!(
                vault.state == VaultState::Funded || vault.state == VaultState::Active,
                VaultError::InvalidState
            );
            // Enforce 100 SOL aggregate cap
            require!(
                vault
                    .total_deposited_lamports
                    .checked_add(amount)
                    .ok_or(VaultError::Overflow)?
                    <= AGGREGATE_CAP_LAMPORTS,
                VaultError::AggregateCap
            );
        }

        // Mint shares via vault-checks math
        let shares = compute_shares(
            amount,
            ctx.accounts.vault.total_deposited_lamports,
            ctx.accounts.vault.total_shares,
        )
        .map_err(map_err)?;

        // Transfer SOL into the vault PDA
        let cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi, amount)?;

        // Update accounting (now safe to mutably borrow)
        let vault = &mut ctx.accounts.vault;
        vault.total_deposited_lamports = vault
            .total_deposited_lamports
            .checked_add(amount)
            .ok_or(VaultError::Overflow)?;
        vault.available_lamports = vault
            .available_lamports
            .checked_add(amount)
            .ok_or(VaultError::Overflow)?;
        vault.total_shares = vault
            .total_shares
            .checked_add(shares)
            .ok_or(VaultError::Overflow)?;

        // Transition to Active on first fund
        if vault.state == VaultState::Funded {
            vault.state = VaultState::Active;
        }

        emit!(FundEvent {
            owner: vault.owner,
            amount,
            shares_minted: shares,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Owner pauses their vault (Active or Funded → Paused).
    pub fn pause_vault(ctx: Context<VaultOwnerOnly>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(
            vault.state == VaultState::Active || vault.state == VaultState::Funded,
            VaultError::InvalidState
        );
        vault.state = VaultState::Paused;
        emit!(VaultStateEvent {
            owner: vault.owner,
            new_state: 2, // Paused ordinal
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Owner resumes a paused vault (Paused → Active).
    pub fn resume_vault(ctx: Context<VaultOwnerOnly>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.state == VaultState::Paused, VaultError::InvalidState);
        vault.state = VaultState::Active;
        emit!(VaultStateEvent {
            owner: vault.owner,
            new_state: 1, // Active ordinal
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Owner burns shares and receives proportional SOL back.
    pub fn withdraw_vault(ctx: Context<WithdrawVault>, shares: u64) -> Result<()> {
        require!(shares > 0, VaultError::ZeroAmount);

        // Read-only checks first
        let (amount, vault_lamports) = {
            let vault = &ctx.accounts.vault;
            require!(
                vault.state == VaultState::Active
                    || vault.state == VaultState::Paused
                    || vault.state == VaultState::Funded,
                VaultError::InvalidState
            );
            require!(shares <= vault.total_shares, VaultError::InsufficientFunds);
            let amount = compute_redeem(shares, vault.available_lamports, vault.total_shares)
                .map_err(map_err)?;
            let vault_lamports = ctx.accounts.vault.to_account_info().lamports();
            (amount, vault_lamports)
        };

        // Verify vault has enough lamports above rent
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(Vault::SPACE);
        check_withdraw(amount, vault_lamports, min_rent).map_err(map_err)?;

        // Transfer SOL out (direct lamport manipulation — vault is a PDA)
        **ctx
            .accounts
            .vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .owner
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        // Update accounting
        let vault = &mut ctx.accounts.vault;
        vault.available_lamports = vault
            .available_lamports
            .checked_sub(amount)
            .ok_or(VaultError::Overflow)?;
        vault.total_shares = vault
            .total_shares
            .checked_sub(shares)
            .ok_or(VaultError::Overflow)?;

        emit!(WithdrawEvent {
            owner: vault.owner,
            amount,
            shares_burned: shares,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Owner closes the vault when all shares have been redeemed.
    pub fn close_vault(ctx: Context<VaultOwnerOnly>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.total_shares == 0, VaultError::SharesOutstanding);
        vault.state = VaultState::Closed;
        emit!(VaultStateEvent {
            owner: vault.owner,
            new_state: 4, // Closed ordinal
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // ── User slots ─────────────────────────────────────────────────────

    /// Creates a UserSlot PDA for the (owner, bot_account) pair.
    pub fn create_user_slot(ctx: Context<CreateUserSlot>, bot_account: Pubkey) -> Result<()> {
        let slot = &mut ctx.accounts.user_slot;
        slot.owner = ctx.accounts.owner.key();
        slot.bot_account = bot_account;
        slot.principal = 0;
        slot.available = 0;
        slot.open_exposure = 0;
        slot.realized_pnl = 0;
        slot.pending_creator_fee = 0;
        slot.accrued_protocol_fee = 0;
        slot.shares = 0;
        slot.state = SlotState::Active;
        slot.order_nonce = 0;
        slot.bump = ctx.bumps.user_slot;

        emit!(SlotCreatedEvent {
            owner: slot.owner,
            bot_account,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Owner advances the order nonce for the next bot order.
    pub fn update_slot_limits(ctx: Context<UpdateSlotLimits>, new_order_nonce: u64) -> Result<()> {
        let slot = &mut ctx.accounts.user_slot;
        require!(new_order_nonce > slot.order_nonce, VaultError::InvalidState);
        slot.order_nonce = new_order_nonce;
        Ok(())
    }

    /// register_bot: creator registers a new bot
    /// fee_bps must be <= 3000
    pub fn register_bot(
        ctx: Context<RegisterBot>,
        strategy_hash: [u8; 32],
        max_position_bps: u16,
        max_slippage_bps: u16,
        fee_bps: u16,
    ) -> Result<()> {
        use welp_vault_checks::validate_fee_bps;
        validate_fee_bps(fee_bps as u64).map_err(|_| VaultError::FeeTooHigh)?;

        let reg = &mut ctx.accounts.bot_registry;
        reg.creator = ctx.accounts.creator.key();
        reg.bot_account = ctx.accounts.bot_account.key();
        reg.strategy_hash = strategy_hash;
        reg.max_position_bps = max_position_bps;
        reg.max_slippage_bps = max_slippage_bps;
        reg.fee_bps = fee_bps;
        reg.enabled = true;
        reg.version = 1;
        reg.bump = ctx.bumps.bot_registry;
        Ok(())
    }

    /// settle_creator_fee: charge fee_bps on positive realized profit, add to user slot pending_creator_fee
    pub fn settle_creator_fee(
        ctx: Context<SettleCreatorFee>,
        realized_profit_lamports: u64,
    ) -> Result<()> {
        use welp_vault_checks::compute_creator_fee;
        let fee_bps = ctx.accounts.bot_registry.fee_bps as u64;
        let fee = compute_creator_fee(realized_profit_lamports, fee_bps).map_err(|e| match e {
            welp_vault_checks::CheckError::ZeroProfit => VaultError::ZeroAmount,
            welp_vault_checks::CheckError::FeeTooHigh => VaultError::FeeTooHigh,
            welp_vault_checks::CheckError::Overflow => VaultError::Overflow,
            _ => VaultError::Overflow,
        })?;

        let slot = &mut ctx.accounts.user_slot;
        slot.pending_creator_fee = slot
            .pending_creator_fee
            .checked_add(fee)
            .ok_or(VaultError::Overflow)?;
        Ok(())
    }

    /// claim_creator_fee: creator claims their pending fees from a user slot
    /// Transfers pending_creator_fee from vault to creator, zeros it out
    pub fn claim_creator_fee(ctx: Context<ClaimCreatorFee>) -> Result<()> {
        let pending = ctx.accounts.user_slot.pending_creator_fee;
        require!(pending > 0, VaultError::ZeroAmount);

        // Zero out first (prevent re-entrancy / double claim)
        ctx.accounts.user_slot.pending_creator_fee = 0;

        // Transfer from vault to creator
        let vault_info = ctx.accounts.vault.to_account_info();
        let creator_info = ctx.accounts.creator.to_account_info();

        **vault_info.try_borrow_mut_lamports()? -= pending;
        **creator_info.try_borrow_mut_lamports()? += pending;

        Ok(())
    }

    // ── Legacy compatibility stubs ──────────────────────────────────────

    /// Compatibility: create vault with cap/position params (delegates to create_vault logic).
    pub fn initialize(
        ctx: Context<Initialize>,
        total_cap_lamports: u64,
        per_position_max_lamports: u64,
    ) -> Result<()> {
        check_initialize(total_cap_lamports, per_position_max_lamports).map_err(map_err)?;

        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.total_deposited_lamports = 0;
        vault.available_lamports = 0;
        vault.total_shares = 0;
        vault.state = VaultState::Funded;
        vault.bump = ctx.bumps.vault;
        vault.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Owner sets or rotates the executor key (kept for compatibility).
    pub fn set_executor(_ctx: Context<SetExecutor>, _executor: Pubkey) -> Result<()> {
        // Executor management is handled per-slot in M5; this is a no-op stub.
        Ok(())
    }

    /// Owner immediately clears the executor (kept for compatibility).
    pub fn revoke_executor(_ctx: Context<RevokeExecutor>) -> Result<()> {
        Ok(())
    }

    /// Owner pauses vault (legacy name, delegates to pause_vault logic).
    pub fn pause(ctx: Context<LegacyOwnerOnly>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(
            vault.state == VaultState::Active || vault.state == VaultState::Funded,
            VaultError::InvalidState
        );
        vault.state = VaultState::Paused;
        Ok(())
    }

    /// Owner unpauses vault (legacy name, delegates to resume_vault logic).
    pub fn unpause(ctx: Context<LegacyOwnerOnly>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.state == VaultState::Paused, VaultError::InvalidState);
        vault.state = VaultState::Active;
        Ok(())
    }

    /// Trading stays disabled until the approved Jupiter CPI path is implemented.
    pub fn execute_swap(_ctx: Context<ExecuteSwap>, _amount: u64, _route: [u8; 32]) -> Result<()> {
        err!(VaultError::TradingDisabled)
    }

    /// Owner or executor records a closed position.
    pub fn settle_exit(ctx: Context<SettleExit>, amount_lamports: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        // Expose open_exposure via available_lamports for simplified accounting
        let current = vault.available_lamports;
        vault.available_lamports = settle_exposure(current, amount_lamports).map_err(map_err)?;
        Ok(())
    }

    /// Owner withdraws SOL (legacy direct-amount interface).
    pub fn withdraw(ctx: Context<LegacyWithdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        let vault_info = ctx.accounts.vault.to_account_info();
        let owner_info = ctx.accounts.owner.to_account_info();
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(Vault::SPACE);
        check_withdraw(amount, vault_info.lamports(), min_rent).map_err(map_err)?;

        **vault_info.try_borrow_mut_lamports()? -= amount;
        **owner_info.try_borrow_mut_lamports()? += amount;
        Ok(())
    }

    /// Charges a $0.10 creation fee in SOL via Pyth oracle price, split 40/60.
    pub fn charge_creation_fee(ctx: Context<ChargeCreationFee>, _bot_nonce: u64) -> Result<()> {
        // Read SOL/USD price from Pyth
        let sol_usd_feed_id = get_feed_id_from_hex(
            "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
        )
        .map_err(|_| VaultError::InvalidPrice)?;

        let price_data = ctx
            .accounts
            .price_update
            .get_price_no_older_than(&Clock::get()?, 30, &sol_usd_feed_id)
            .map_err(|_| VaultError::StaleFeed)?;

        let lamports_per_dollar =
            validate_pyth_price(price_data.price, price_data.conf, price_data.exponent)
                .map_err(map_check_err)?;

        // $0.10 = 10 cents
        let fee_lamports =
            usd_cents_to_lamports_rounded5(10, lamports_per_dollar).map_err(map_check_err)?;

        // Verify payer has enough above rent
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(0);
        let available = ctx.accounts.payer.lamports().saturating_sub(min_rent);
        require!(available >= fee_lamports, VaultError::InsufficientFunds);

        let (recipient_lamports, treasury_lamports) =
            split_fee(fee_lamports).map_err(map_check_err)?;

        // Transfer 40% to fee_recipient
        let cpi_to_recipient = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.fee_recipient_account.to_account_info(),
            },
        );
        system_program::transfer(cpi_to_recipient, recipient_lamports)?;

        // Transfer 60% to treasury
        let cpi_to_treasury = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_to_treasury, treasury_lamports)?;

        ctx.accounts.treasury.accumulated_lamports = ctx
            .accounts
            .treasury
            .accumulated_lamports
            .checked_add(treasury_lamports)
            .ok_or(VaultError::Overflow)?;

        Ok(())
    }
}

// ── Accounts ──────────────────────────────────────────────────────────────

#[account]
pub struct GlobalConfig {
    pub authority: Pubkey,
    pub treasury_recipient: Pubkey,
    pub fee_recipient: Pubkey,
    pub pause_all: bool,
    pub bump: u8,
}

impl GlobalConfig {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 1 + 1;
}

#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub total_deposited_lamports: u64,
    pub available_lamports: u64,
    pub total_shares: u64,
    pub state: VaultState,
    pub bump: u8,
    pub created_at: i64,
}

impl Vault {
    // VaultState enum is 1 byte
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 1 + 1 + 8;
}

#[account]
pub struct UserSlot {
    pub owner: Pubkey,
    pub bot_account: Pubkey,
    pub principal: u64,
    pub available: u64,
    pub open_exposure: u64,
    pub realized_pnl: i64,
    pub pending_creator_fee: u64,
    pub accrued_protocol_fee: u64,
    pub shares: u64,
    pub state: SlotState,
    pub order_nonce: u64,
    pub bump: u8,
}

impl UserSlot {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1;
}

#[account]
pub struct Treasury {
    pub accumulated_lamports: u64,
    pub bump: u8,
}

impl Treasury {
    pub const SPACE: usize = 8 + 8 + 1;
}

#[account]
pub struct BotRegistry {
    pub creator: Pubkey,
    pub bot_account: Pubkey,
    pub strategy_hash: [u8; 32],
    pub max_position_bps: u16,
    pub max_slippage_bps: u16,
    pub fee_bps: u16,
    pub enabled: bool,
    pub version: u32,
    pub bump: u8,
}

impl BotRegistry {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 2 + 2 + 2 + 1 + 4 + 1;
}

// ── Instruction contexts ──────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeGlobalConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = GlobalConfig::SPACE,
        seeds = [b"global-config-v1"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = Vault::SPACE,
        seeds = [b"vault-v1", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault-v1", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VaultOwnerOnly<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault-v1", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct WithdrawVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault-v1", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
#[instruction(bot_account: Pubkey)]
pub struct CreateUserSlot<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = UserSlot::SPACE,
        seeds = [b"user-slot-v1", owner.key().as_ref(), bot_account.as_ref()],
        bump
    )]
    pub user_slot: Account<'info, UserSlot>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateSlotLimits<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user-slot-v1", owner.key().as_ref(), user_slot.bot_account.as_ref()],
        bump = user_slot.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub user_slot: Account<'info, UserSlot>,
}

#[derive(Accounts)]
#[instruction(strategy_hash: [u8;32], max_position_bps: u16, max_slippage_bps: u16, fee_bps: u16)]
pub struct RegisterBot<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: stored as bot_account in registry
    pub bot_account: AccountInfo<'info>,
    #[account(
        init,
        payer = creator,
        space = BotRegistry::SPACE,
        seeds = [b"bot-registry-v1", creator.key().as_ref(), bot_account.key().as_ref()],
        bump
    )]
    pub bot_registry: Account<'info, BotRegistry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleCreatorFee<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user-slot-v1", user_slot.owner.as_ref(), user_slot.bot_account.as_ref()],
        bump = user_slot.bump
    )]
    pub user_slot: Account<'info, UserSlot>,
    #[account(
        seeds = [b"bot-registry-v1", bot_registry.creator.as_ref(), user_slot.bot_account.as_ref()],
        bump = bot_registry.bump
    )]
    pub bot_registry: Account<'info, BotRegistry>,
}

#[derive(Accounts)]
pub struct ClaimCreatorFee<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user-slot-v1", user_slot.owner.as_ref(), user_slot.bot_account.as_ref()],
        bump = user_slot.bump
    )]
    pub user_slot: Account<'info, UserSlot>,
    #[account(
        mut,
        seeds = [b"vault-v1", vault.owner.as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: vault owner
    pub owner: AccountInfo<'info>,
    #[account(
        seeds = [b"bot-registry-v1", creator.key().as_ref(), user_slot.bot_account.as_ref()],
        bump = bot_registry.bump,
        has_one = creator @ VaultError::UnauthorizedOwner
    )]
    pub bot_registry: Account<'info, BotRegistry>,
}

// ── Legacy compatibility contexts ─────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = Vault::SPACE,
        seeds = [b"vault-v1", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetExecutor<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault-v1", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct RevokeExecutor<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault-v1", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct LegacyOwnerOnly<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault-v1", owner.key().as_ref()],
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
        seeds = [b"vault-v1", vault.owner.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct SettleExit<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault-v1", vault.owner.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct LegacyWithdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault-v1", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
#[instruction(bot_nonce: u64)]
pub struct ChargeCreationFee<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub global_config: Account<'info, GlobalConfig>,
    /// CHECK: validated as fee_recipient from global_config
    #[account(
        mut,
        constraint = fee_recipient_account.key() == global_config.fee_recipient @ VaultError::UnauthorizedOwner
    )]
    pub fee_recipient_account: AccountInfo<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = Treasury::SPACE,
        seeds = [b"website-treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    pub price_update: Account<'info, PriceUpdateV2>,
    pub system_program: Program<'info, System>,
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
    #[msg("Route program is not on the allowlist")]
    RouteNotAllowed,
    #[msg("Exit amount exceeds open exposure")]
    ExposureUnderflow,
    #[msg("Trading is disabled until a reviewed Jupiter CPI implementation is deployed")]
    TradingDisabled,
    #[msg("Vault is not in a state that allows this operation")]
    InvalidState,
    #[msg("Vault has outstanding shares, cannot close")]
    SharesOutstanding,
    #[msg("Would exceed 100 SOL aggregate cap")]
    AggregateCap,
    #[msg("Creator fee basis points exceeds maximum 3000 (30%)")]
    FeeTooHigh,
    #[msg("Invalid or non-positive oracle price")]
    InvalidPrice,
    #[msg("Oracle confidence too wide (>2% of price)")]
    OverConfidence,
    #[msg("Oracle price feed is stale (>30s)")]
    StaleFeed,
}
