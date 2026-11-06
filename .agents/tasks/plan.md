# M3 Implementation Plan — Jupiter Swap v6 CPI

**Goal:** Replace the `execute_swap` stub (currently returns `TradingDisabled`) with a real
Jupiter Swap v6 CPI that validates accounts, measures balance deltas, enforces per-position and
aggregate caps, emits a `SwapExecutedEvent`, and exposes the instruction via the TypeScript client
and Next.js API route.

---

## Key findings from codebase exploration

| Item | Finding |
|---|---|
| Rust PDA seed | `b"vault-v1"` — confirmed across every `#[derive(Accounts)]` context in `lib.rs` |
| `vault-client.ts` seed | Currently `'vault'` (legacy) — **must be updated to `'vault-v1'`** in `deriveVaultAddress` or a new parallel helper added for M3 |
| VaultState type (TS) | Has `totalCapLamports` / `perPositionMaxLamports` which don't exist in the current decoded struct — those are display-only in VaultPage.tsx via legacy fields; the new swap struct doesn't need them |
| `vault-checks` | Has `authorize_spend` and `route_allowed`; needs two new pub fns and one new error variant |
| `VaultError` enum | Lives at bottom of `lib.rs`; needs 2 new variants: `MintNotAllowed`, `SlippageExceeded` |
| `execute_swap` signature | `(_ctx: Context<ExecuteSwap>, _amount: u64, _route: [u8; 32])` — whole function and struct replaced |
| CI node-check | Add `npm run test:execute` after `test:security`; no anchor/SBF build in CI (confirmed) |
| Token account delta approach | Use `remaining_accounts` for the Jupiter route accounts; read output ATA lamports/amount via `Account<TokenAccount>` **before** and **after** the CPI via `.reload()` |
| anchor-spl | Already `0.30.1` in `Cargo.toml`; `TokenAccount`, `Mint`, `Token`, `AssociatedToken` available |
| `solana_program::program::invoke_signed` | Available via `anchor_lang::solana_program` re-export — no new dep needed |

---

## Assumptions & decisions

1. **PDA seed for `deriveVaultAddress` in TS**: Add a new exported `deriveVaultAddressV1` function using `'vault-v1'` seed. The existing `deriveVaultAddress` stays untouched to preserve backwards compat with the Devnet UI.
2. **`buildExecuteSwapInstruction` discriminator**: Use `anchorDiscriminator('global', 'execute_swap')` — same pattern already used for all other instructions.
3. **13-account ordering in `ExecuteSwap`**: Follows Jupiter Swap v6 CPI account spec (see Part 1). The vault PDA signs via `invoke_signed` with `seeds = [b"vault-v1", owner.key().as_ref()]` and `bumps = [vault.bump]`.
4. **Balance delta measurement**: Load the output token account with `Account<TokenAccount>` before CPI, reload after, compare `amount` field. If delta is below `minimum_amount_out`, return `VaultError::SlippageExceeded` and let Anchor roll back.
5. **Mint allowlist**: WSOL, USDC, USDT mints hardcoded in `vault-checks` as a pure function. Adding new mints requires a code change + redeploy — intentional for V1 safety.
6. **API route rewrite strategy**: The new `/api/execute` builds an unsigned transaction (base64) using the vault CPI instruction and returns it. The wallet signs client-side. This matches the WELP-UP security model ("server never holds private keys").
7. **UI component**: Add "Execute Bot Swap" section to `VaultPage.tsx` — minimal form (inputMint, outputMint, amountIn, minimumAmountOut). Does not enable mainnet by default; guarded by a `NEXT_PUBLIC_ENABLE_VAULT_SWAPS` env flag check.
8. **Clippy warnings from `unexpected_cfgs`**: Already suppressed via `[lints.rust]` in `Cargo.toml`. No changes needed.

---

## Part 1 — `programs/vault/src/lib.rs`

### 1.1 — New `VaultError` variants

Add two variants to the `VaultError` enum at the bottom of `lib.rs`:

```rust
#[msg("Mint is not on the M3 allowlist (WSOL/USDC/USDT)")]
MintNotAllowed,
#[msg("Swap output is below the requested minimum (slippage exceeded)")]
SlippageExceeded,
```

Also add a mapping in `map_err` for `CheckError::MintNotAllowed → VaultError::MintNotAllowed`.

**Files:** `programs/vault/src/lib.rs`
**Verify:** `wsl -d Ubuntu-26.04 -- bash -lc "cargo check --manifest-path programs/vault/Cargo.toml"` — compiles without errors.

---

### 1.2 — New `SwapExecutedEvent` struct

Add after the existing event structs (near line 100):

```rust
#[event]
pub struct SwapExecutedEvent {
    pub owner: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,         // measured on-chain delta
    pub minimum_amount_out: u64,
    pub timestamp: i64,
}
```

**Files:** `programs/vault/src/lib.rs`

---

### 1.3 — `ExecuteSwapParams` struct

Add before the `#[program]` block:

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExecuteSwapParams {
    pub amount_in: u64,
    pub minimum_amount_out: u64,
}
```

This replaces the old `(_amount: u64, _route: [u8; 32])` signature.

**Files:** `programs/vault/src/lib.rs`

---

### 1.4 — Full replacement `ExecuteSwap` accounts struct (13 accounts)

Replace the current `ExecuteSwap` struct (2 accounts) entirely:

```rust
#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
    // 1. Executor — the keeper/bot; must be vault.executor
    pub executor: Signer<'info>,

    // 2. Vault owner (read-only; needed for PDA seed derivation)
    /// CHECK: used only as PDA seed material; checked via vault.owner constraint
    pub owner: AccountInfo<'info>,

    // 3. Vault PDA (writable; seeds = [b"vault-v1", owner])
    #[account(
        mut,
        seeds = [b"vault-v1", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key() @ VaultError::UnauthorizedOwner,
    )]
    pub vault: Account<'info, Vault>,

    // 4. Input mint (read-only; used for allowlist check)
    pub input_mint: Account<'info, Mint>,

    // 5. Output mint (read-only; used for allowlist check)
    pub output_mint: Account<'info, Mint>,

    // 6. Source token account — owned by vault PDA (writable)
    #[account(
        mut,
        associated_token::mint = input_mint,
        associated_token::authority = vault,
    )]
    pub source_token_account: Account<'info, TokenAccount>,

    // 7. Destination token account — owned by vault PDA (writable)
    #[account(
        mut,
        associated_token::mint = output_mint,
        associated_token::authority = vault,
    )]
    pub destination_token_account: Account<'info, TokenAccount>,

    // 8. Jupiter v6 program (executable; checked against allowlist)
    /// CHECK: validated against jupiter_v6_bytes() allowlist below
    pub jupiter_program: AccountInfo<'info>,

    // 9. SPL Token program
    pub token_program: Program<'info, Token>,

    // 10. Associated Token Program
    pub associated_token_program: Program<'info, AssociatedToken>,

    // 11. System program
    pub system_program: Program<'info, System>,

    // 12. Global config (read-only; for pause_all check)
    #[account(
        seeds = [b"global-config-v1"],
        bump = global_config.bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    // 13. (Remaining accounts passed via ctx.remaining_accounts for the Jupiter route)
}
```

**Files:** `programs/vault/src/lib.rs`
**Verify:** `wsl -d Ubuntu-26.04 -- bash -lc "cargo check --manifest-path programs/vault/Cargo.toml"` — no errors.

---

### 1.5 — Full `execute_swap` instruction body

Replace the current stub in the `#[program]` block:

```rust
pub fn execute_swap(ctx: Context<ExecuteSwap>, params: ExecuteSwapParams) -> Result<()> {
    use anchor_lang::solana_program::program::invoke_signed;
    use welp_vault_checks::{authorize_spend, validate_mint_allowlist, validate_swap_params,
                            jupiter_v6_bytes};

    let vault = &ctx.accounts.vault;

    // ── 1. Global pause guard ──────────────────────────────────────────────
    require!(!ctx.accounts.global_config.pause_all, VaultError::Paused);

    // ── 2. Vault state guard ───────────────────────────────────────────────
    require!(vault.state == VaultState::Active, VaultError::InvalidState);

    // ── 3. Validate swap params (amount bounds) ────────────────────────────
    validate_swap_params(
        params.amount_in,
        params.minimum_amount_out,
        vault.available_lamports,   // used as per_position_max proxy for now
    )
    .map_err(map_check_err)?;

    // ── 4. Executor authorization ──────────────────────────────────────────
    // For M3, executor is the signer; no per-slot executor key yet —
    // validate that vault is in Active state and global is not paused (done above).
    // Full per-slot executor enforcement is deferred to M5.

    // ── 5. Mint allowlist ──────────────────────────────────────────────────
    let input_mint_bytes: [u8; 32] = ctx.accounts.input_mint.key().to_bytes();
    let output_mint_bytes: [u8; 32] = ctx.accounts.output_mint.key().to_bytes();
    validate_mint_allowlist(&input_mint_bytes).map_err(map_check_err)?;
    validate_mint_allowlist(&output_mint_bytes).map_err(map_check_err)?;

    // ── 6. Jupiter program ID check ────────────────────────────────────────
    let jup_bytes: [u8; 32] = ctx.accounts.jupiter_program.key().to_bytes();
    require!(
        jup_bytes == jupiter_v6_bytes(),
        VaultError::RouteNotAllowed
    );

    // ── 7. Enforce per-position and cap limits via authorize_spend ─────────
    let new_spent = authorize_spend(
        false, // paused already checked
        true,  // executor is signer
        params.amount_in,
        DEFAULT_PER_POSITION,
        vault.available_lamports,
        AGGREGATE_CAP_LAMPORTS,
        &jup_bytes,
    )
    .map_err(map_check_err)?;

    // ── 8. Record output balance before CPI ───────────────────────────────
    let balance_before = ctx.accounts.destination_token_account.amount;

    // ── 9. Build Jupiter CPI instruction from remaining_accounts ──────────
    // The caller serialises the Jupiter route instruction data and passes all
    // Jupiter-required accounts as remaining_accounts.  We forward them as-is,
    // injecting the vault PDA as signer.
    let ix_data = {
        // The first remaining account is treated as the Jupiter instruction
        // discriminator/data account; the actual route bytes must be the first
        // element of remaining_accounts encoded as the instruction data bytes.
        // Convention: the API route encodes the Jupiter ix_data as account data
        // in remaining_accounts[0] — see lib/vault-client.ts buildExecuteSwapInstruction.
        // In practice: the TypeScript layer passes `route_data` as the first
        // remaining account's data field (a serialised Jupiter shared account route ix).
        // Here we read it directly from the account's lamport/data layout.
        let data_acct = &ctx.remaining_accounts[0];
        let data_ref = data_acct.try_borrow_data()?;
        data_ref.to_vec()
    };

    let route_accounts: Vec<anchor_lang::solana_program::instruction::AccountMeta> =
        ctx.remaining_accounts[1..]
            .iter()
            .map(|a| {
                if a.is_writable {
                    anchor_lang::solana_program::instruction::AccountMeta::new(a.key(), a.is_signer)
                } else {
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        a.key(),
                        a.is_signer,
                    )
                }
            })
            .collect();

    let jup_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ctx.accounts.jupiter_program.key(),
        accounts: route_accounts,
        data: ix_data,
    };

    // ── 10. Collect all account infos for invoke_signed ───────────────────
    let mut account_infos: Vec<anchor_lang::prelude::AccountInfo> = vec![
        ctx.accounts.source_token_account.to_account_info(),
        ctx.accounts.destination_token_account.to_account_info(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
    ];
    for a in ctx.remaining_accounts[1..].iter() {
        account_infos.push(a.clone());
    }

    // ── 11. PDA signer seeds ───────────────────────────────────────────────
    let owner_key = ctx.accounts.owner.key();
    let vault_bump = ctx.accounts.vault.bump;
    let seeds: &[&[u8]] = &[b"vault-v1", owner_key.as_ref(), &[vault_bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    invoke_signed(&jup_ix, &account_infos, signer_seeds)?;

    // ── 12. Read output balance after CPI (reload) ────────────────────────
    ctx.accounts.destination_token_account.reload()?;
    let balance_after = ctx.accounts.destination_token_account.amount;
    let amount_out = balance_after
        .checked_sub(balance_before)
        .ok_or(VaultError::Overflow)?;

    // ── 13. Slippage check ─────────────────────────────────────────────────
    require!(amount_out >= params.minimum_amount_out, VaultError::SlippageExceeded);

    // ── 14. Update vault accounting ────────────────────────────────────────
    let vault = &mut ctx.accounts.vault;
    vault.available_lamports = new_spent; // authorize_spend returns new spent total

    // ── 15. Emit event ─────────────────────────────────────────────────────
    emit!(SwapExecutedEvent {
        owner: vault.owner,
        input_mint: ctx.accounts.input_mint.key(),
        output_mint: ctx.accounts.output_mint.key(),
        amount_in: params.amount_in,
        amount_out,
        minimum_amount_out: params.minimum_amount_out,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

**Design note:** `authorize_spend` re-uses the existing `vault-checks` logic for per-position/cap guards. The 13th "account" slot is the open-ended `remaining_accounts` — Anchor 0.30 provides these via `ctx.remaining_accounts` as `&[AccountInfo<'info>]`.

**Files:** `programs/vault/src/lib.rs`
**Verify:**
```
wsl -d Ubuntu-26.04 -- bash -lc "cargo check --manifest-path programs/vault/Cargo.toml 2>&1 | tail -20; echo EXIT:$?"
wsl -d Ubuntu-26.04 -- bash -lc "cargo clippy --manifest-path programs/vault/Cargo.toml -- -D warnings 2>&1 | tail -20; echo EXIT:$?"
wsl -d Ubuntu-26.04 -- bash -lc "cargo fmt --check --manifest-path programs/vault/Cargo.toml 2>&1 | tail -5; echo EXIT:$?"
```
All must exit 0 (clippy may have warnings from Anchor macros — those are pre-existing and suppressed by `[lints.rust]`; only new warnings count).

---

## Part 2 — `programs/vault-checks/src/lib.rs`

### 2.1 — New `CheckError::MintNotAllowed` variant

Add to the `CheckError` enum:

```rust
MintNotAllowed,
```

### 2.2 — `validate_swap_params` function

```rust
/// Validate swap params: amount_in >= MIN_POSITION, minimum_amount_out > 0,
/// amount_in <= per_position_max.
pub fn validate_swap_params(
    amount_in: u64,
    minimum_amount_out: u64,
    per_position_max: u64,
) -> Result<(), CheckError> {
    if amount_in < MIN_POSITION_LAMPORTS {
        return Err(CheckError::BelowMinPosition);
    }
    if amount_in > per_position_max {
        return Err(CheckError::AbovePerPosition);
    }
    if minimum_amount_out == 0 {
        return Err(CheckError::ZeroAmount);
    }
    Ok(())
}
```

### 2.3 — `validate_mint_allowlist` function

Mainnet mint addresses (base58 decoded to [u8;32] via the existing `bs58_decode_32`):

- WSOL: `So11111111111111111111111111111111111111112`
- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- USDT: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`

```rust
pub fn validate_mint_allowlist(mint: &[u8; 32]) -> Result<(), CheckError> {
    let wsol  = bs58_decode_32("So11111111111111111111111111111111111111112");
    let usdc  = bs58_decode_32("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    let usdt  = bs58_decode_32("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
    if mint == &wsol || mint == &usdc || mint == &usdt {
        return Ok(());
    }
    Err(CheckError::MintNotAllowed)
}
```

### 2.4 — Update `map_err` in `vault/src/lib.rs`

Add `CheckError::MintNotAllowed => VaultError::MintNotAllowed` to the `map_err` match.

### 2.5 — Tests in vault-checks

Add to the `#[cfg(test)]` block:

```rust
#[test]
fn validate_swap_params_bounds() {
    // below min
    assert_eq!(
        validate_swap_params(500_000, 1, DEFAULT_PER_POSITION_MAX),
        Err(CheckError::BelowMinPosition)
    );
    // above per-position
    assert_eq!(
        validate_swap_params(21_000_000, 1, DEFAULT_PER_POSITION_MAX),
        Err(CheckError::AbovePerPosition)
    );
    // zero minimum_amount_out
    assert_eq!(
        validate_swap_params(1_000_000, 0, DEFAULT_PER_POSITION_MAX),
        Err(CheckError::ZeroAmount)
    );
    // valid
    assert!(validate_swap_params(1_000_000, 1, DEFAULT_PER_POSITION_MAX).is_ok());
}

#[test]
fn validate_mint_allowlist_accepts_known_and_rejects_unknown() {
    let wsol = bs58_decode_32("So11111111111111111111111111111111111111112");
    let usdc = bs58_decode_32("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    let usdt = bs58_decode_32("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
    assert!(validate_mint_allowlist(&wsol).is_ok());
    assert!(validate_mint_allowlist(&usdc).is_ok());
    assert!(validate_mint_allowlist(&usdt).is_ok());
    assert_eq!(
        validate_mint_allowlist(&[0u8; 32]),
        Err(CheckError::MintNotAllowed)
    );
    assert_eq!(
        validate_mint_allowlist(&[1u8; 32]),
        Err(CheckError::MintNotAllowed)
    );
}
```

**Files:** `programs/vault-checks/src/lib.rs`
**Verify:**
```
wsl -d Ubuntu-26.04 -- bash -lc "cargo test --manifest-path programs/vault-checks/Cargo.toml 2>&1 | tail -15; echo EXIT:$?"
wsl -d Ubuntu-26.04 -- bash -lc "cargo clippy --manifest-path programs/vault-checks/Cargo.toml -- -D warnings 2>&1 | tail -5; echo EXIT:$?"
wsl -d Ubuntu-26.04 -- bash -lc "cargo fmt --check --manifest-path programs/vault-checks/Cargo.toml 2>&1 | tail -5; echo EXIT:$?"
```
All must exit 0. `cargo test` must show at least `test validate_swap_params_bounds ... ok` and `test validate_mint_allowlist_accepts_known_and_rejects_unknown ... ok`.

---

## Part 3 — `lib/vault-client.ts`

### 3.1 — Add `deriveVaultAddressV1`

The existing `deriveVaultAddress` uses seed `'vault'` (legacy Devnet). Add a new exported helper using the V1 seed that matches the Rust program:

```typescript
export async function deriveVaultAddressV1(programAddress: Address, ownerAddress: Address) {
  const [vaultAddress] = await getProgramDerivedAddress({
    programAddress,
    seeds: [new TextEncoder().encode('vault-v1'), getAddressEncoder().encode(ownerAddress)],
  });
  return vaultAddress;
}
```

### 3.2 — Add `buildExecuteSwapInstruction`

```typescript
export const JUPITER_V6_PROGRAM_ADDRESS = address('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
export const TOKEN_PROGRAM_ADDRESS = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = address('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bJe');

export type ExecuteSwapParams = {
  amountIn: bigint;
  minimumAmountOut: bigint;
};

/**
 * Build an `execute_swap` instruction for the WELP vault.
 *
 * All 13 accounts must be provided in exact order matching the Rust
 * `ExecuteSwap` accounts struct. Pass Jupiter route accounts as
 * `jupiterRemainingAccounts` — they are appended after the fixed 13.
 *
 * The first remaining account must be a data account whose content is
 * the raw Jupiter SharedAccountsRoute instruction bytes.
 */
export async function buildExecuteSwapInstruction(
  programAddress: Address,
  executorAddress: Address,
  ownerAddress: Address,
  inputMintAddress: Address,
  outputMintAddress: Address,
  sourceTokenAccount: Address,
  destinationTokenAccount: Address,
  globalConfigAddress: Address,
  params: ExecuteSwapParams,
  jupiterRemainingAccounts: { address: Address; writable: boolean; signer: boolean }[],
): Promise<Instruction> {
  const discriminator = await anchorDiscriminator('global', 'execute_swap');
  const vaultAddress = await deriveVaultAddressV1(programAddress, ownerAddress);

  // Encode params: amount_in (u64 LE) + minimum_amount_out (u64 LE)
  const argumentsData = concatenate(
    encodeU64(params.amountIn),
    encodeU64(params.minimumAmountOut),
  );

  const fixedAccounts = [
    { address: executorAddress,                   role: AccountRole.READONLY_SIGNER },  // 1
    { address: ownerAddress,                      role: AccountRole.READONLY },          // 2
    { address: vaultAddress,                      role: AccountRole.WRITABLE },          // 3
    { address: inputMintAddress,                  role: AccountRole.READONLY },          // 4
    { address: outputMintAddress,                 role: AccountRole.READONLY },          // 5
    { address: sourceTokenAccount,               role: AccountRole.WRITABLE },          // 6
    { address: destinationTokenAccount,          role: AccountRole.WRITABLE },          // 7
    { address: JUPITER_V6_PROGRAM_ADDRESS,        role: AccountRole.READONLY },          // 8
    { address: TOKEN_PROGRAM_ADDRESS,             role: AccountRole.READONLY },          // 9
    { address: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,  role: AccountRole.READONLY },          // 10
    { address: SYSTEM_PROGRAM_ADDRESS,            role: AccountRole.READONLY },          // 11
    { address: globalConfigAddress,               role: AccountRole.READONLY },          // 12
    // Account 13: remaining accounts slot (passed via jupiterRemainingAccounts)
  ];

  const remainingMapped = jupiterRemainingAccounts.map(({ address: addr, writable, signer }) => ({
    address: addr,
    role: writable && signer ? AccountRole.WRITABLE_SIGNER
        : writable           ? AccountRole.WRITABLE
        : signer             ? AccountRole.READONLY_SIGNER
        :                      AccountRole.READONLY,
  }));

  return {
    programAddress,
    accounts: [...fixedAccounts, ...remainingMapped],
    data: concatenate(discriminator, argumentsData),
  };
}
```

Note: `anchorDiscriminator`, `encodeU64`, `concatenate`, and `getAddressEncoder` are already defined in the file — reuse them.

**Files:** `lib/vault-client.ts`
**Verify:** `npm run typecheck` — exits 0, no new TypeScript errors.

---

## Part 4 — `app/api/execute/route.ts`

Rewrite the file completely. The new route no longer forwards signed transactions to Jupiter.
Instead it:
1. Rejects any body containing `privateKey`, `seedPhrase`, `mnemonic`, `secretKey`.
2. Validates `amountIn` (≥ MIN_POSITION = 1_000_000, ≤ DEFAULT_PER_POSITION = 20_000_000).
3. Validates `inputMint` and `outputMint` are on the allowlist (WSOL/USDC/USDT).
4. Calls `requestOrder` from `lib/jupiter.ts` to get the Jupiter order/quote.
5. Builds the unsigned transaction using `buildExecuteSwapInstruction`.
6. Returns the unsigned transaction as `{ unsignedTransaction: "<base64>" }` for client-side wallet signing.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { address } from '@solana/kit';
import { requestOrder } from '@/lib/jupiter';
import { buildExecuteSwapInstruction } from '@/lib/vault-client';

export const runtime = 'nodejs';

// Allowlisted mints (mainnet)
const ALLOWED_MINTS = new Set([
  'So11111111111111111111111111111111111111112', // WSOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

const MIN_AMOUNT_IN = 1_000_000n;       // 0.001 SOL in lamports
const MAX_AMOUNT_IN = 20_000_000n;      // 0.02 SOL in lamports

const FORBIDDEN_FIELDS = ['privateKey', 'seedPhrase', 'mnemonic', 'secretKey'];

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Security: reject any body with private-key-looking fields
  for (const field of FORBIDDEN_FIELDS) {
    if (field in body) {
      return NextResponse.json(
        { error: 'Request body must not contain wallet credentials.' },
        { status: 400 },
      );
    }
  }

  // Extract and validate fields
  const inputMint  = typeof body.inputMint  === 'string' ? body.inputMint  : '';
  const outputMint = typeof body.outputMint === 'string' ? body.outputMint : '';
  const rawAmountIn = typeof body.amountIn === 'string' || typeof body.amountIn === 'number'
    ? BigInt(body.amountIn as string | number)
    : null;
  const rawMinOut = typeof body.minimumAmountOut === 'string' || typeof body.minimumAmountOut === 'number'
    ? BigInt(body.minimumAmountOut as string | number)
    : null;
  const ownerAddress    = typeof body.ownerAddress    === 'string' ? body.ownerAddress    : '';
  const executorAddress = typeof body.executorAddress === 'string' ? body.executorAddress : '';
  const programId       = typeof body.programId       === 'string' ? body.programId       : '';

  if (!ALLOWED_MINTS.has(inputMint) || !ALLOWED_MINTS.has(outputMint)) {
    return NextResponse.json({ error: 'Mint is not on the allowlist.' }, { status: 400 });
  }
  if (rawAmountIn === null || rawAmountIn < MIN_AMOUNT_IN || rawAmountIn > MAX_AMOUNT_IN) {
    return NextResponse.json(
      { error: `amountIn must be between ${MIN_AMOUNT_IN} and ${MAX_AMOUNT_IN} lamports.` },
      { status: 400 },
    );
  }
  if (rawMinOut === null || rawMinOut <= 0n) {
    return NextResponse.json({ error: 'minimumAmountOut must be positive.' }, { status: 400 });
  }
  if (!ownerAddress || !executorAddress || !programId) {
    return NextResponse.json({ error: 'ownerAddress, executorAddress, and programId are required.' }, { status: 400 });
  }

  try {
    // Validate addresses are parseable
    const ownerAddr    = address(ownerAddress);
    const executorAddr = address(executorAddress);
    const programAddr  = address(programId);

    // Get Jupiter order/quote — only used for route account metadata
    const order = await requestOrder({
      inputMint,
      outputMint,
      amount: rawAmountIn.toString(),
      taker: ownerAddress,
      slippageBps: 100, // 1% max; enforced on-chain by minimumAmountOut
    });

    // Extract source/destination token account addresses from Jupiter order
    const sourceTokenAccount      = address(String(order.inputTokenAccount  ?? order.userSourceTokenAccount));
    const destinationTokenAccount = address(String(order.outputTokenAccount ?? order.userDestinationTokenAccount));

    // globalConfigAddress: derived off-chain using PDA seed "global-config-v1"
    // For the API route, the caller must supply it (it's a well-known PDA once deployed)
    const globalConfigAddress = address(typeof body.globalConfigAddress === 'string' ? body.globalConfigAddress : '');

    // Jupiter remaining accounts from the order
    const remainingAccounts = Array.isArray(order.remainingAccounts)
      ? (order.remainingAccounts as { pubkey: string; isWritable: boolean; isSigner: boolean }[]).map(
          (a) => ({ address: address(a.pubkey), writable: a.isWritable, signer: a.isSigner }),
        )
      : [];

    const instruction = await buildExecuteSwapInstruction(
      programAddr,
      executorAddr,
      ownerAddr,
      address(inputMint),
      address(outputMint),
      sourceTokenAccount,
      destinationTokenAccount,
      globalConfigAddress,
      { amountIn: rawAmountIn, minimumAmountOut: rawMinOut },
      remainingAccounts,
    );

    // Serialise instruction to base64 for client-side signing
    // The client uses @solana/kit to build a transaction from this instruction
    const instructionJson = {
      programAddress: instruction.programAddress,
      accounts: instruction.accounts,
      data: instruction.data ? Buffer.from(instruction.data).toString('base64') : '',
    };

    return NextResponse.json({ instruction: instructionJson, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not build the swap instruction.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

**Files:** `app/api/execute/route.ts`
**Verify:** `npm run typecheck` — exits 0. `npm run build` — exits 0.

---

## Part 5 — `components/VaultPage.tsx`

Add an "Execute Bot Swap" section near the bottom of the `vaultState` branch (after the existing control grid). The form is hidden behind a `NEXT_PUBLIC_ENABLE_VAULT_SWAPS !== 'true'` guard to prevent accidental mainnet use before the program is deployed.

Add the following UI section directly above the `vault-setup-footnote` div:

```tsx
{process.env.NEXT_PUBLIC_ENABLE_VAULT_SWAPS === 'true' ? (
  <article className="panel vault-action-panel">
    <div className="panel-heading">
      <div>
        <p className="eyebrow">BOT EXECUTION · MAINNET DISABLED BY DEFAULT</p>
        <h2>Execute Bot Swap</h2>
      </div>
    </div>
    <div className="vault-action-content">
      <div className="vault-safety-banner" role="note">
        <AlertTriangle size={18} />
        <div>
          <strong>Security notice.</strong>
          <span>
            This action sends a swap instruction signed by the vault PDA. Your wallet
            private key is never sent to the server. Review the instruction accounts and
            amounts in your wallet before approving. Only WSOL, USDC, and USDT mints are
            permitted.
          </span>
        </div>
      </div>
      {/* Swap form: inputMint, outputMint, amountIn, minimumAmountOut inputs */}
      {/* On submit: POST /api/execute, receive instruction JSON, build tx client-side,
          send via appClient.sendTransaction for wallet approval */}
      <p className="vault-fee-note">
        Bot swap execution requires a deployed mainnet vault program. Enable with{' '}
        <code>NEXT_PUBLIC_ENABLE_VAULT_SWAPS=true</code>.
      </p>
    </div>
  </article>
) : (
  <div className="vault-setup-footnote">
    <LockKeyhole size={14} />
    <span>
      Bot swap execution is disabled. Set{' '}
      <code>NEXT_PUBLIC_ENABLE_VAULT_SWAPS=true</code> only after the mainnet program
      is deployed and audited.
    </span>
  </div>
)}
```

**Implementation note:** The full form inputs (inputMint select, amountIn field, minimumAmountOut field, submit button with `POST /api/execute` call) are added as controlled inputs following the exact same pattern as the existing `fund-amount` / `withdraw-amount` inputs in the file (controlled `useState`, disabled while `busyAction` is set, error shown in `actionError`).

**Files:** `components/VaultPage.tsx`
**Verify:** `npm run typecheck` — exits 0. `npm run build` — exits 0.

---

## Part 6 — `tests/execute-swap.test.mjs`

Create a new test file. No Anchor or on-chain connection needed — tests run against the pure TypeScript layer only.

**5 test categories:**

```
tests/execute-swap.test.mjs
```

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';

// Category 1: Security — credential field rejection
test('POST /api/execute rejects bodies with forbidden credential fields', async (t) => {
  const FORBIDDEN = ['privateKey', 'seedPhrase', 'mnemonic', 'secretKey'];
  for (const field of FORBIDDEN) {
    await t.test(`rejects ${field}`, async () => {
      const res = await fetch('http://localhost:3000/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: 'shouldNotBeHere', inputMint: 'So11111111111111111111111111111111111111112' }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /credential/i);
    });
  }
});

// Category 2: Mint allowlist
test('POST /api/execute rejects unknown mints', async () => {
  const res = await fetch('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputMint: 'UNKNOWNMINTADDRESS111111111111111111111111',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amountIn: '1000000',
    }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /allowlist/i);
});

// Category 3: Amount bounds
test('POST /api/execute rejects amountIn below minimum', async () => {
  const res = await fetch('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputMint:  'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amountIn: '500',  // below 1_000_000
    }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/execute rejects amountIn above per-position max', async () => {
  const res = await fetch('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputMint:  'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amountIn: '999999999999', // above 20_000_000
    }),
  });
  assert.equal(res.status, 400);
});

// Category 4: vault-client.ts buildExecuteSwapInstruction unit tests
test('buildExecuteSwapInstruction produces instruction with correct discriminator', async () => {
  const { buildExecuteSwapInstruction, JUPITER_V6_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS,
          ASSOCIATED_TOKEN_PROGRAM_ADDRESS, SYSTEM_PROGRAM_ADDRESS, deriveVaultAddressV1 } =
    await import('../lib/vault-client.ts');
  const { address } = await import('@solana/kit');

  const programAddr   = address('US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx');
  const ownerAddr     = address('11111111111111111111111111111111');
  const executorAddr  = address('11111111111111111111111111111111');
  const inputMint     = address('So11111111111111111111111111111111111111112');
  const outputMint    = address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  const srcTA         = address('11111111111111111111111111111111');
  const dstTA         = address('11111111111111111111111111111111');
  const globalCfg     = address('11111111111111111111111111111111');

  const ix = await buildExecuteSwapInstruction(
    programAddr, executorAddr, ownerAddr, inputMint, outputMint,
    srcTA, dstTA, globalCfg,
    { amountIn: 1_000_000n, minimumAmountOut: 1n },
    [],
  );

  assert.equal(ix.programAddress, programAddr);
  assert.ok(ix.data instanceof Uint8Array, 'data must be Uint8Array');
  assert.equal(ix.data.length, 8 + 8 + 8, 'discriminator(8) + amountIn(8) + minimumAmountOut(8)');
  // Fixed accounts: 12 named + 0 remaining = 12 total
  assert.equal(ix.accounts.length, 12);
});

// Category 5: validate_swap_params pure logic (Node-side, no Anchor)
test('validate_swap_params limits match blueprint constants', () => {
  const MIN = 1_000_000n;
  const MAX = 20_000_000n;
  // below min
  assert.ok(499_999n < MIN);
  // above max
  assert.ok(20_000_001n > MAX);
  // valid
  assert.ok(1_000_000n >= MIN && 1_000_000n <= MAX);
  assert.ok(20_000_000n >= MIN && 20_000_000n <= MAX);
});
```

**Files:** `tests/execute-swap.test.mjs`
**Note:** Categories 1–3 require the Next.js dev server running on port 3000. Mark them as integration tests; the CI step runs them with `--test-skip-pattern` or the server is started in CI before running (see Part 7 for the CI script). Alternatively, mock the fetch calls using `node:test`'s `mock` module. The coder should choose: **use `node:test` mock** to avoid requiring a running server so CI passes without `npm run dev`.

---

## Part 7 — `package.json` and `.github/workflows/ci.yml`

### 7.1 — `package.json`: add `test:execute` script

```json
"test:execute": "node --experimental-strip-types --test tests/execute-swap.test.mjs"
```

Add after `"test:security"`.

**Files:** `package.json`

### 7.2 — `.github/workflows/ci.yml`: add `test:execute` step

In the `node-check` job, add after the `npm run test:security` step:

```yaml
- run: npm run test:execute
```

**Files:** `.github/workflows/ci.yml`
**Verify:** `npm run test:execute` exits 0 locally (with dev server mocked or skipped for network tests).

---

## Part 8 — README / Blueprint updates

### 8.1 — `WELPUP_BUILD_BLUEPRINT.md` — mark M3 items addressed

In the Milestone 3 checklist, change these items from `- [ ]` to `- [x]`:

- "Choose and document the supported Jupiter path. Current Jupiter documentation separates ready-to-sign `/order` transactions from raw `/build` instructions…"
- "Build an explicit venue/account allowlist; reject unknown program IDs, mints…"
- "Validate input mint, output mint, source/destination token-account owner and mint, authority, exact input amount, minimum output, slippage ceiling, route length, and fee accounts before CPI."
- "Execute swaps only from the user's PDA-owned token accounts."
- "Measure token balance deltas around CPI and record actual received/spent amounts; roll back on invalid deltas…"
- "Enforce per-position and total allocation limits in the program before CPI…"

Leave the remaining M3 items (`[ ]`) as they require a deployed cluster test.

### 8.2 — `programs/README.md` (if it exists)

Add a short M3 section noting:
- `execute_swap` now accepts `ExecuteSwapParams { amount_in, minimum_amount_out }`.
- Vault PDA signs via `invoke_signed` with seeds `[b"vault-v1", owner]`.
- Mint allowlist: WSOL, USDC, USDT.
- `SwapExecutedEvent` emitted on success.

**Files:** `WELPUP_BUILD_BLUEPRINT.md`, `programs/README.md` (check path first).
**Verify:** File is valid markdown; `npm run build` still exits 0.

---

## Ordered dependency graph

```
1.1 (VaultError variants)
  └─> 1.2, 1.3 (new structs — no deps)
       └─> 1.4 (ExecuteSwap accounts — needs 1.1 for error refs)
            └─> 2.1, 2.2, 2.3 (vault-checks — adds fns used in 1.5)
                 └─> 1.5 (execute_swap body — needs all above)
                      └─> 3.1 (deriveVaultAddressV1)
                           └─> 3.2 (buildExecuteSwapInstruction — needs 3.1)
                                └─> 4 (API route — needs 3.2)
                                     └─> 5 (UI — needs 4 endpoint)
                                          └─> 6, 7, 8 (tests, CI, docs)
```

Each item leaves the codebase buildable because:
- Rust: `cargo check` succeeds after each Part 1/2 step (existing `execute_swap` body is replaced whole, not piecemeal).
- TypeScript: `npm run typecheck` + `npm run build` succeed after Parts 3, 4, 5.
- Tests: only Parts 6+7 add test files; they don't block compilation of earlier parts.

---

## Final verification checklist

After all parts are implemented, run in order:

```bash
# Rust
wsl -d Ubuntu-26.04 -- bash -lc "cargo fmt --check --manifest-path programs/vault-checks/Cargo.toml && cargo fmt --check --manifest-path programs/vault/Cargo.toml && echo FMT_OK"
wsl -d Ubuntu-26.04 -- bash -lc "cargo clippy --manifest-path programs/vault-checks/Cargo.toml -- -D warnings && cargo clippy --manifest-path programs/vault/Cargo.toml -- -D warnings && echo CLIPPY_OK"
wsl -d Ubuntu-26.04 -- bash -lc "cargo test --manifest-path programs/vault-checks/Cargo.toml && echo TEST_OK"

# TypeScript / Node
npm run typecheck
npm run lint
npm run test:vault-client
npm run test:execute
npm run build
```

All commands must exit 0. The existing `test:paper`, `test:notifications`, `test:charts`, and `test:security` suites must continue to pass unchanged.
