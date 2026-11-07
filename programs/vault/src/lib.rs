//! WELP UP! vault program — unlaunched security scaffold.
//!
//! The program is not deployed to Devnet or Mainnet and has not been audited.
//! Mainnet funds and automated execution must remain disabled until every
//! launch gate in docs/PRODUCTION_READINESS.md is independently verified.
//!
//! Build and test against a local validator only. Do not deploy this scaffold.

use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use welp_vault_checks::{check_initialize, check_withdraw, compute_redeem, CheckError};

declare_id!("US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx"); // undeployed placeholder; replace after `anchor keys list`

/// Jupiter Aggregator v6 program id (mainnet).
pub const JUPITER_V6_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

pub use welp_vault_checks::{
    DEFAULT_PER_POSITION_MAX as DEFAULT_PER_POSITION, MIN_POSITION_LAMPORTS as MIN_POSITION,
};

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
        CheckError::NonceTaken => VaultError::DuplicateNonce,
        CheckError::InsufficientBalance => VaultError::InsufficientFunds,
        CheckError::MintNotAllowed => VaultError::MintNotAllowed,
    }
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

#[event]
pub struct SwapExecutedEvent {
    pub owner: Pubkey,
    pub bot_account: Pubkey,
    pub amount_in: u64,
    pub actual_out: u64,
    pub order_nonce: u64,
    pub timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExecuteSwapParams {
    pub amount_in: u64,
    pub minimum_amount_out: u64,
    pub order_nonce: u64,
    pub route_data: Vec<u8>,
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
    /// Funding remains disabled until the complete vault program is reviewed and released.
    pub fn fund_vault(_ctx: Context<FundVault>, _amount: u64) -> Result<()> {
        err!(VaultError::FundingDisabled)
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
    /// Creator fee accrual is disabled until realized profit is proven by on-chain accounting.
    pub fn settle_creator_fee(
        _ctx: Context<SettleCreatorFee>,
        _realized_profit_lamports: u64,
    ) -> Result<()> {
        err!(VaultError::FeeSettlementDisabled)
    }

    /// claim_creator_fee: creator claims their pending fees from a user slot
    /// Transfers pending_creator_fee from vault to creator, zeros it out
    /// Creator fee payouts remain disabled until vault and slot accounting are reconciled.
    pub fn claim_creator_fee(_ctx: Context<ClaimCreatorFee>) -> Result<()> {
        err!(VaultError::FeeSettlementDisabled)
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
    /// Real-fund execution is deliberately fail-closed pending CPI and accounting review.
    pub fn execute_swap<'info>(
        _ctx: Context<'_, '_, '_, 'info, ExecuteSwap<'info>>,
        _params: ExecuteSwapParams,
    ) -> Result<()> {
        err!(VaultError::TradingDisabled)
    }

    /// Owner or executor records a closed position.
    /// Position settlement is disabled until realized P&L is derived from verified swap events.
    pub fn settle_exit(_ctx: Context<SettleExit>, _amount_lamports: u64) -> Result<()> {
        err!(VaultError::TradingDisabled)
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
    /// Creation fees remain disabled until idempotent bot registration and recipients are verified.
    pub fn charge_creation_fee(_ctx: Context<ChargeCreationFee>, _bot_nonce: u64) -> Result<()> {
        err!(VaultError::FeeSettlementDisabled)
    }
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
    #[msg("Vault funding is disabled pending security review")]
    FundingDisabled,
    #[msg("Automated trading and position settlement are disabled pending security review")]
    TradingDisabled,
    #[msg("Fee accrual, claims and collection are disabled pending security review")]
    FeeSettlementDisabled,
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
    #[msg("Vault is not in a state that allows this operation")]
    InvalidState,
    #[msg("Vault has outstanding shares, cannot close")]
    SharesOutstanding,
    #[msg("Creator fee basis points exceeds maximum 3000 (30%)")]
    FeeTooHigh,
    #[msg("Invalid or non-positive oracle price")]
    InvalidPrice,
    #[msg("Oracle confidence too wide (>2% of price)")]
    OverConfidence,
    #[msg("Oracle price feed is stale (>30s)")]
    StaleFeed,
    #[msg("Trading is paused globally")]
    TradingPaused,
    #[msg("User slot is not active")]
    SlotNotActive,
    #[msg("Vault is not active")]
    VaultNotActive,
    #[msg("Order nonce has already been used")]
    DuplicateNonce,
    #[msg("CPI swap output is below minimum")]
    InsufficientOutput,
    #[msg("Jupiter program address is incorrect")]
    InvalidJupiterProgram,
    #[msg("Mint is not on the allowed list")]
    MintNotAllowed,
    #[msg("Vault does not have enough available balance")]
    InsufficientVaultBalance,
}
