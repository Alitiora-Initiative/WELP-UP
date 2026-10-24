//! Pure limit checks for the WELP vault.
//!
//! The Anchor program calls these so the same rules can be tested with
//! `cargo test` and no validator. Mainnet stays disabled.

/// Matches LIMITS.md minimum buy (0.001 SOL).
pub const MIN_POSITION_LAMPORTS: u64 = 1_000_000;
/// Design default per-position ceiling (0.02 SOL).
pub const DEFAULT_PER_POSITION_MAX: u64 = 20_000_000;

/// Jupiter Aggregator v6 program id (mainnet and devnet), base58 `JUP6…`.
pub fn jupiter_v6_bytes() -> [u8; 32] {
    // base58 decoded once; asserted in tests against the known string length.
    bs58_decode_32("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CheckError {
    CapTooSmall,
    InvalidPerPosition,
    ZeroAmount,
    Paused,
    UnauthorizedExecutor,
    BelowMinPosition,
    AbovePerPosition,
    CapExceeded,
    Overflow,
    InsufficientFunds,
    RouteNotAllowed,
    ExposureUnderflow,
    FeeTooHigh,         // fee_bps > 3000
    ZeroProfit,         // profit == 0 — cannot charge
    AlreadyClaimed,     // double-claim guard
    InvalidPrice,
    OverConfidence,
    StaleFeed,
    NonceTaken,
    InsufficientBalance,
}

pub const MAX_FEE_BPS: u64 = 3000;

/// Validate fee_bps is within 0..=3000
pub fn validate_fee_bps(fee_bps: u64) -> Result<(), CheckError> {
    if fee_bps > MAX_FEE_BPS {
        Err(CheckError::FeeTooHigh)
    } else {
        Ok(())
    }
}

/// Compute creator fee on realized positive profit. Rounds down.
/// Returns fee in lamports (or 0 if rounded to 0)
pub fn compute_creator_fee(
    realized_profit_lamports: u64,
    fee_bps: u64,
) -> Result<u64, CheckError> {
    if realized_profit_lamports == 0 {
        return Err(CheckError::ZeroProfit);
    }
    validate_fee_bps(fee_bps)?;
    let fee = (realized_profit_lamports as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(CheckError::Overflow)?
        .checked_div(10_000)
        .ok_or(CheckError::Overflow)? as u64;
    // fee of 0 is allowed (very small profit * small bps)
    Ok(fee)
}

pub fn check_initialize(
    total_cap_lamports: u64,
    per_position_max_lamports: u64,
) -> Result<(), CheckError> {
    if total_cap_lamports < MIN_POSITION_LAMPORTS {
        return Err(CheckError::CapTooSmall);
    }
    if per_position_max_lamports < MIN_POSITION_LAMPORTS
        || per_position_max_lamports > total_cap_lamports
    {
        return Err(CheckError::InvalidPerPosition);
    }
    Ok(())
}

/// Lifetime spend authorization. Returns the new `spent_lamports`.
pub fn authorize_spend(
    paused: bool,
    executor_matches: bool,
    amount_lamports: u64,
    per_position_max_lamports: u64,
    spent_lamports: u64,
    total_cap_lamports: u64,
    route_program: &[u8; 32],
) -> Result<u64, CheckError> {
    if paused {
        return Err(CheckError::Paused);
    }
    if !executor_matches {
        return Err(CheckError::UnauthorizedExecutor);
    }
    if amount_lamports < MIN_POSITION_LAMPORTS {
        return Err(CheckError::BelowMinPosition);
    }
    if amount_lamports > per_position_max_lamports {
        return Err(CheckError::AbovePerPosition);
    }
    if !route_allowed(route_program) {
        return Err(CheckError::RouteNotAllowed);
    }
    let next = spent_lamports
        .checked_add(amount_lamports)
        .ok_or(CheckError::Overflow)?;
    if next > total_cap_lamports {
        return Err(CheckError::CapExceeded);
    }
    Ok(next)
}

/// Reduce open exposure after an exit. Lifetime `spent` is not refunded.
pub fn settle_exposure(open_exposure: u64, amount: u64) -> Result<u64, CheckError> {
    if amount == 0 {
        return Err(CheckError::ZeroAmount);
    }
    open_exposure
        .checked_sub(amount)
        .ok_or(CheckError::ExposureUnderflow)
}

pub fn check_withdraw(
    amount: u64,
    vault_lamports: u64,
    rent_exempt: u64,
) -> Result<(), CheckError> {
    if amount == 0 {
        return Err(CheckError::ZeroAmount);
    }
    let available = vault_lamports.saturating_sub(rent_exempt);
    if amount > available {
        return Err(CheckError::InsufficientFunds);
    }
    Ok(())
}

/// Compute shares to mint when depositing `amount` lamports into a vault
/// with `total_deposited` already and `total_shares` issued.
/// On first deposit (total_shares==0): shares = amount
/// Otherwise: shares = (amount * total_shares) / total_deposited
/// Returns Err(CheckError::Overflow) on overflow, Err(CheckError::ZeroAmount) if result is 0
pub fn compute_shares(
    amount: u64,
    total_deposited: u64,
    total_shares: u64,
) -> Result<u64, CheckError> {
    if amount == 0 {
        return Err(CheckError::ZeroAmount);
    }
    if total_shares == 0 || total_deposited == 0 {
        return Ok(amount); // first depositor: 1:1
    }
    let shares = (amount as u128)
        .checked_mul(total_shares as u128)
        .ok_or(CheckError::Overflow)?
        .checked_div(total_deposited as u128)
        .ok_or(CheckError::Overflow)?;
    if shares == 0 {
        return Err(CheckError::ZeroAmount);
    }
    Ok(shares as u64)
}

/// Compute lamports to return when burning `shares` from a vault
/// with `available_lamports` and `total_shares`.
/// lamports = (shares * available_lamports) / total_shares
pub fn compute_redeem(
    shares: u64,
    available_lamports: u64,
    total_shares: u64,
) -> Result<u64, CheckError> {
    if shares == 0 {
        return Err(CheckError::ZeroAmount);
    }
    if total_shares == 0 {
        return Err(CheckError::InsufficientFunds);
    }
    let lamports = (shares as u128)
        .checked_mul(available_lamports as u128)
        .ok_or(CheckError::Overflow)?
        .checked_div(total_shares as u128)
        .ok_or(CheckError::Overflow)?;
    if lamports == 0 {
        return Err(CheckError::ZeroAmount);
    }
    Ok(lamports as u64)
}

/// Default pubkey (all zeros) means "accounting only, no CPI yet".
/// Otherwise the route program must be Jupiter v6.
pub fn route_allowed(program: &[u8; 32]) -> bool {
    if program.iter().all(|b| *b == 0) {
        return true;
    }
    program == &jupiter_v6_bytes()
}

fn bs58_decode_32(input: &str) -> [u8; 32] {
    const ALPHABET: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let mut bytes = [0u8; 64];
    let mut len = 0usize;
    for c in input.bytes() {
        let val = ALPHABET.iter().position(|a| *a == c).expect("base58") as u32;
        let mut carry = val;
        for b in bytes.iter_mut().take(len) {
            carry += (*b as u32) * 58;
            *b = (carry & 0xff) as u8;
            carry >>= 8;
        }
        while carry > 0 {
            bytes[len] = (carry & 0xff) as u8;
            len += 1;
            carry >>= 8;
        }
    }
    let zeros = input.bytes().take_while(|c| *c == b'1').count();
    let mut out = [0u8; 32];
    let payload = len;
    assert!(zeros + payload <= 32, "pubkey too long");
    for i in 0..payload {
        out[32 - 1 - i] = bytes[i];
    }
    out
}

/// Convert USD cents to lamports using a SOL/USD price.
/// `sol_price_ulamports_per_usd`: lamports per dollar (= 1_000_000_000 / sol_price_usd).
/// `fee_usd_cents`: fee in cents (10 = $0.10).
/// Returns lamports, rounded UP to nearest 5.
pub fn usd_cents_to_lamports_rounded5(
    fee_usd_cents: u64,
    sol_price_ulamports_per_usd: u64,
) -> Result<u64, CheckError> {
    if sol_price_ulamports_per_usd == 0 {
        return Err(CheckError::InvalidPrice);
    }
    let lamports = (fee_usd_cents as u128)
        .checked_mul(sol_price_ulamports_per_usd as u128)
        .ok_or(CheckError::Overflow)?
        .checked_div(100)
        .ok_or(CheckError::Overflow)? as u64;
    // Round UP to nearest 5 lamports
    let rem = lamports % 5;
    let rounded = if rem == 0 {
        lamports
    } else {
        lamports.checked_add(5 - rem).ok_or(CheckError::Overflow)?
    };
    Ok(rounded)
}

/// Validate a Pyth price: must be positive, confidence < 2% of price.
/// Returns `lamports_per_dollar` (= 1_000_000_000 / price_usd).
/// `price`: raw price from Pyth (positive).
/// `conf`: raw confidence from Pyth.
/// `exponent`: Pyth exponent (typically negative, e.g. -8).
pub fn validate_pyth_price(price: i64, conf: u64, exponent: i32) -> Result<u64, CheckError> {
    if price <= 0 {
        return Err(CheckError::InvalidPrice);
    }
    let price_u = price as u64;
    // confidence < 2% of price => conf * 50 < price_u
    if conf.saturating_mul(50) >= price_u {
        return Err(CheckError::OverConfidence);
    }
    // Compute lamports_per_dollar:
    // lamports_per_dollar = 10^9 / (price * 10^exponent)
    // If exponent < 0: = (10^9 * 10^|exponent|) / price
    let abs_exp = exponent.unsigned_abs() as u32;
    if abs_exp > 18 {
        return Err(CheckError::InvalidPrice);
    }
    let scale: u128 = 10u128.pow(abs_exp);
    let numerator: u128 = if exponent < 0 {
        (1_000_000_000u128)
            .checked_mul(scale)
            .ok_or(CheckError::Overflow)?
    } else {
        1_000_000_000u128
            .checked_div(scale)
            .ok_or(CheckError::InvalidPrice)?
    };
    let lamports_per_dollar = numerator
        .checked_div(price_u as u128)
        .ok_or(CheckError::Overflow)? as u64;
    if lamports_per_dollar == 0 {
        return Err(CheckError::InvalidPrice);
    }
    Ok(lamports_per_dollar)
}

/// Compute the 40/60 fee split. Returns `(fee_recipient_lamports, treasury_lamports)`.
/// Rounds down fee_recipient; treasury gets the remainder to ensure exact total.
pub fn split_fee(total: u64) -> Result<(u64, u64), CheckError> {
    let recipient = total
        .checked_mul(40)
        .ok_or(CheckError::Overflow)?
        .checked_div(100)
        .ok_or(CheckError::Overflow)?;
    let treasury = total
        .checked_sub(recipient)
        .ok_or(CheckError::Overflow)?;
    Ok((recipient, treasury))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initialize_rejects_tiny_cap_and_bad_position() {
        assert_eq!(
            check_initialize(100, DEFAULT_PER_POSITION_MAX),
            Err(CheckError::CapTooSmall)
        );
        assert_eq!(
            check_initialize(5_000_000, 100),
            Err(CheckError::InvalidPerPosition)
        );
        assert_eq!(
            check_initialize(5_000_000, 6_000_000),
            Err(CheckError::InvalidPerPosition)
        );
        assert!(check_initialize(50_000_000, DEFAULT_PER_POSITION_MAX).is_ok());
    }

    #[test]
    fn spend_respects_pause_executor_min_max_and_cap() {
        let route = [0u8; 32];
        let base = |amt, spent| {
            authorize_spend(
                false,
                true,
                amt,
                DEFAULT_PER_POSITION_MAX,
                spent,
                50_000_000,
                &route,
            )
        };
        assert_eq!(base(500_000, 0), Err(CheckError::BelowMinPosition));
        assert_eq!(base(21_000_000, 0), Err(CheckError::AbovePerPosition));
        assert_eq!(base(20_000_000, 40_000_000), Err(CheckError::CapExceeded));
        assert_eq!(base(20_000_000, 0), Ok(20_000_000));
        assert_eq!(
            authorize_spend(
                true,
                true,
                1_000_000,
                DEFAULT_PER_POSITION_MAX,
                0,
                50_000_000,
                &route
            ),
            Err(CheckError::Paused)
        );
        assert_eq!(
            authorize_spend(
                false,
                false,
                1_000_000,
                DEFAULT_PER_POSITION_MAX,
                0,
                50_000_000,
                &route
            ),
            Err(CheckError::UnauthorizedExecutor)
        );
    }

    #[test]
    fn unknown_route_is_rejected_jupiter_and_default_pass() {
        let mut bad = [1u8; 32];
        bad[0] = 9;
        assert!(!route_allowed(&bad));
        assert!(route_allowed(&[0u8; 32]));
        let jup = jupiter_v6_bytes();
        assert!(route_allowed(&jup));
        assert_eq!(
            authorize_spend(
                false,
                true,
                1_000_000,
                DEFAULT_PER_POSITION_MAX,
                0,
                50_000_000,
                &bad
            ),
            Err(CheckError::RouteNotAllowed)
        );
    }

    #[test]
    fn withdraw_keeps_rent_and_exposure_cannot_go_negative() {
        assert_eq!(check_withdraw(0, 10, 1), Err(CheckError::ZeroAmount));
        assert_eq!(check_withdraw(5, 10, 6), Err(CheckError::InsufficientFunds));
        assert!(check_withdraw(4, 10, 6).is_ok());
        assert_eq!(
            settle_exposure(1_000_000, 2_000_000),
            Err(CheckError::ExposureUnderflow)
        );
        assert_eq!(settle_exposure(3_000_000, 1_000_000), Ok(2_000_000));
    }

    #[test]
    fn jupiter_id_is_32_bytes_and_not_zero() {
        let id = jupiter_v6_bytes();
        assert_eq!(id.len(), 32);
        assert!(id.iter().any(|b| *b != 0));
    }

    #[test]
    fn compute_shares_first_deposit_is_one_to_one() {
        // First depositor: total_shares == 0
        assert_eq!(compute_shares(1_000_000, 0, 0), Ok(1_000_000));
        // First depositor: total_deposited == 0 but total_shares is also 0
        assert_eq!(compute_shares(5_000_000, 0, 0), Ok(5_000_000));
    }

    #[test]
    fn compute_shares_proportional_on_subsequent_deposits() {
        // 10 SOL in, 10 shares out on first deposit (1:1)
        // Then another 10 SOL → should also get 10 shares (pool doubled)
        assert_eq!(
            compute_shares(10_000_000, 10_000_000, 10_000_000),
            Ok(10_000_000)
        );
        // Half deposit → half shares
        assert_eq!(
            compute_shares(5_000_000, 10_000_000, 10_000_000),
            Ok(5_000_000)
        );
    }

    #[test]
    fn compute_shares_rejects_zero_amount() {
        assert_eq!(
            compute_shares(0, 10_000_000, 10_000_000),
            Err(CheckError::ZeroAmount)
        );
    }

    #[test]
    fn compute_redeem_proportional_withdrawal() {
        // Burn all 10 shares from a 10 SOL pool → get 10 SOL back
        assert_eq!(
            compute_redeem(10_000_000, 10_000_000, 10_000_000),
            Ok(10_000_000)
        );
        // Burn half → get half back
        assert_eq!(
            compute_redeem(5_000_000, 10_000_000, 10_000_000),
            Ok(5_000_000)
        );
    }

    #[test]
    fn compute_redeem_rejects_zero_shares_and_empty_pool() {
        assert_eq!(
            compute_redeem(0, 10_000_000, 10_000_000),
            Err(CheckError::ZeroAmount)
        );
        assert_eq!(
            compute_redeem(1_000_000, 10_000_000, 0),
            Err(CheckError::InsufficientFunds)
        );
    }

    #[test]
    fn creator_fee_rules() {
        // fee_bps validation
        assert!(validate_fee_bps(0).is_ok());
        assert!(validate_fee_bps(1).is_ok());
        assert!(validate_fee_bps(3000).is_ok());
        assert_eq!(validate_fee_bps(3001), Err(CheckError::FeeTooHigh));
        assert_eq!(validate_fee_bps(10000), Err(CheckError::FeeTooHigh));

        // compute_creator_fee
        // zero profit -> error
        assert_eq!(compute_creator_fee(0, 1000), Err(CheckError::ZeroProfit));
        // fee_bps too high -> error
        assert_eq!(
            compute_creator_fee(1_000_000, 3001),
            Err(CheckError::FeeTooHigh)
        );
        // 10% fee on 1 SOL (1_000_000_000 lamports)
        assert_eq!(
            compute_creator_fee(1_000_000_000, 1000),
            Ok(100_000_000)
        );
        // 30% fee on 1 SOL
        assert_eq!(
            compute_creator_fee(1_000_000_000, 3000),
            Ok(300_000_000)
        );
        // min fee bps (0) -> fee = 0 (no fee on loss/zero bps)
        assert_eq!(compute_creator_fee(1_000_000, 0), Ok(0));
        // rounds down: 1 lamport profit * 3000 bps = 0.3 lamports -> 0
        assert_eq!(compute_creator_fee(1, 3000), Ok(0));
        // 3 lamports * 3000 bps / 10000 = 0.9 -> 0 (floor)
        assert_eq!(compute_creator_fee(3, 3000), Ok(0));
        // 10 lamports * 3000 bps / 10000 = 3
        assert_eq!(compute_creator_fee(10, 3000), Ok(3));
    }
}
