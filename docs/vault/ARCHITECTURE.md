# WELP vault architecture (Gate 2)

**Status:** Chosen and documented. No mainnet deployment. Devnet implementation is the next gate.

**Effective:** 2026-10-21  
**Operator:** Alitiora Initiative / Joseph Mushelle Nyingeh (Kenya)

## Decision

We use a **custom Anchor program** with **per-user PDA vaults**, not a generic smart wallet (Squads, etc.).

### Why this shape

| Requirement | How it is met |
|-------------|----------------|
| User never gives the agent their Phantom seed | Vault is a separate PDA. Funding is an explicit SOL transfer the user signs. |
| Total allocation cap on-chain | `Vault.total_cap_lamports` and `Vault.spent_lamports` checked in every trade instruction. |
| Per-position ceiling ≤ 0.02 SOL | `Vault.per_position_max_lamports` enforced before any swap CPI. |
| Narrow executor authority | Only a designated `executor` pubkey may call `execute_swap`. User can revoke it. |
| User can stop and recover funds without the bot | `pause`, `revoke_executor`, and `withdraw` are callable by the vault owner alone. |
| No cross-user leakage | PDA seeds: `[b"vault", owner_pubkey]`. One vault account per user. |
| Program allowlist | Optional CPI allowlist (Jupiter V6 route programs) to limit what the executor can touch. |

This matches the Phase-1 threat model in `THREAT_MODEL.md`.

## On-chain accounts

### Vault (PDA)

```
seeds = [b"vault", owner.key().as_ref()]
bump stored in account
```

Fields (conceptual):

- `owner: Pubkey` — user’s main wallet
- `executor: Pubkey` — agent key authorized to trade (can be `Pubkey::default()` after revoke)
- `total_cap_lamports: u64` — max SOL the vault may ever spend on positions
- `spent_lamports: u64` — cumulative SOL used for entries
- `per_position_max_lamports: u64` — hard ceiling, design default 20_000_000 (0.02 SOL)
- `paused: bool`
- `bump: u8`
- `created_at: i64`

The target design stores token balances in associated token accounts **owned by the vault PDA**, not by the user’s main wallet. The current scaffold does not create those token accounts or implement token withdrawals.

### Authority flow

```
User wallet
  │ fund (transfer SOL)
  │ set_executor / revoke_executor
  │ pause / unpause
  │ withdraw
  ▼
Vault PDA  ──execute_swap (size-checked)──►  Jupiter / Token programs
  ▲
  │ only if executor == signer and !paused
Executor key (bot)
```

The executor **never** becomes the owner of the vault and cannot change the owner, the total cap, or the per-position max after initialization (except via future audited upgrade paths, which remain multi-sig / immutable preference for mainnet).

## Instructions (v0 surface)

1. **`initialize`** — User creates their vault PDA, sets `total_cap_lamports` and `per_position_max_lamports`. Executor may be set later.
2. **`fund`** — User transfers SOL into the vault system account. Increases available balance; does not raise the *cap*.
3. **`set_executor`** — Owner sets or rotates the executor pubkey.
4. **`revoke_executor`** — Owner clears executor (sets to default). Immediate.
5. **`pause` / `unpause`** — Owner only.
6. **`execute_swap`** — Reserved for the future executor path. The current
   scaffold returns `TradingDisabled` and does not change vault state. Jupiter
   CPI, swap-account validation, and token-position accounting are not
   implemented. Do not set an executor or describe this instruction as trading.
7. **`withdraw`** — Owner withdraws SOL held by the vault PDA. No executor involvement is required. SPL token withdrawals are not implemented in the current scaffold.

## Agent authorization model

- No process in this repository loads a wallet secret.
- The Python CLI agent (`welp`) can analyze and record decisions, but it cannot sign.
- Swaps, funding, revoke, and withdraw run only after a wallet connects on the website.
- The `/autonomous` page stays UI-only until gates 3–7 complete.

## Devnet vs mainnet

| Environment | Status |
|-------------|--------|
| Unit tests + local agent | Active |
| Devnet program deploy | Gate 3 (next) |
| Independent audit | Gate 4 |
| Mainnet funds enabled | Disabled until gates 4–7 |

The program ID in `programs/vault/src/lib.rs` is an undeployed placeholder. No
vault PDA derived from it is ready to receive funds. After a Devnet deployment
uses a final program ID, the website can derive each user's PDA from that ID and
the connected public wallet address; a separate address does not need to be
copied into source code.

**Do not send real mainnet SOL into any vault address until the roadmap explicitly opens that gate.**

## Relationship to the existing Python agent

The CLI agent already implements off-chain controls that the vault will eventually enforce on-chain:

- Per-trade size floor/ceiling (`LIMITS.md` / `config.py`)
- Mint risk (freeze authority, transfer fee) — `welp/safety.py`
- Orphan adoption — `welp/reconcile.py`
- Dynamic priority fee — `welp/rpc.py`
- Signer membership check before signing — `welp/wallet.py`

Vault work does **not** replace those checks; it moves the hard spending limits on-chain so a compromised executor still cannot exceed the user’s allocation.

## Source layout (this repository)

```
programs/vault/          # Anchor program (scaffold)
docs/vault/
  THREAT_MODEL.md        # Gate 1
  ARCHITECTURE.md        # this file (Gate 2)
```

## Next step (Gate 3)

The website now has a Devnet-only `/vault` owner console for initializing a
per-wallet PDA, SOL funding and withdrawal, pause, and executor revocation.
It uses a separate Devnet wallet/RPC client; the existing swap interface stays
on Mainnet. The console requires `NEXT_PUBLIC_WELP_VAULT_PROGRAM_ID` and checks
that the address is executable on Devnet before deriving a PDA. Keep the value
unset until the matching program has been deployed. Executable-account checks
do not verify source or establish an audit. Each owner action is submitted only
after the user clicks its review button and signs in their wallet.

This is a partial Gate 3 implementation only. The program is still undeployed,
`execute_swap` still fails closed, SPL-token withdrawals are absent, and no
Devnet transaction-level validation has been completed.

Implement and test on **devnet**:

- Initialize, fund, set_executor, execute_swap (mock or real Jupiter devnet route), pause, revoke, withdraw.
- Property tests for cap and per-position enforcement.
- Publish program id and verified source after successful devnet runs.
