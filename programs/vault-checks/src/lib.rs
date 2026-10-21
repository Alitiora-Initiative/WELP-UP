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
}

pub fn check_initialize(total_cap_lamports: u64, per_position_max_lamports: u64) -> Result<(), CheckError> {
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

pub fn check_withdraw(amount: u64, vault_lamports: u64, rent_exempt: u64) -> Result<(), CheckError> {
    if amount == 0 {
        return Err(CheckError::ZeroAmount);
    }
    let available = vault_lamports.saturating_sub(rent_exempt);
    if amount > available {
        return Err(CheckError::InsufficientFunds);
    }
    Ok(())
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
        for i in 0..len {
            carry += (bytes[i] as u32) * 58;
            bytes[i] = (carry & 0xff) as u8;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initialize_rejects_tiny_cap_and_bad_position() {
        assert_eq!(check_initialize(100, DEFAULT_PER_POSITION_MAX), Err(CheckError::CapTooSmall));
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
            authorize_spend(false, true, amt, DEFAULT_PER_POSITION_MAX, spent, 50_000_000, &route)
        };
        assert_eq!(base(500_000, 0), Err(CheckError::BelowMinPosition));
        assert_eq!(base(21_000_000, 0), Err(CheckError::AbovePerPosition));
        assert_eq!(base(20_000_000, 40_000_000), Err(CheckError::CapExceeded));
        assert_eq!(base(20_000_000, 0), Ok(20_000_000));
        assert_eq!(
            authorize_spend(true, true, 1_000_000, DEFAULT_PER_POSITION_MAX, 0, 50_000_000, &route),
            Err(CheckError::Paused)
        );
        assert_eq!(
            authorize_spend(false, false, 1_000_000, DEFAULT_PER_POSITION_MAX, 0, 50_000_000, &route),
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
        assert_eq!(settle_exposure(1_000_000, 2_000_000), Err(CheckError::ExposureUnderflow));
        assert_eq!(settle_exposure(3_000_000, 1_000_000), Ok(2_000_000));
    }

    #[test]
    fn jupiter_id_is_32_bytes_and_not_zero() {
        let id = jupiter_v6_bytes();
        assert_eq!(id.len(), 32);
        assert!(id.iter().any(|b| *b != 0));
    }
}
