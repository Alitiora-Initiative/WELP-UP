# On-chain programs

## welp-vault

Per-user PDA vault (Anchor). See:

- `docs/vault/THREAT_MODEL.md` — Gate 1
- `docs/vault/ARCHITECTURE.md` — Gate 2 (authority model, instructions)

**Mainnet is disabled.** Program ID in source is a placeholder until `anchor keys list` / first deploy.

The `execute_swap` instruction currently fails closed with `TradingDisabled`. The
program does not yet invoke Jupiter, validate swap accounts, or manage token
positions. Do not set an executor or fund a PDA derived from the placeholder
program ID. A usable vault address exists only after the program is deployed to
Devnet under its final program ID and the PDA is derived from the user's wallet.

Host-side limit tests (no validator):

```bash
cargo test --manifest-path programs/vault-checks/Cargo.toml
```

### Build (requires Solana CLI + Anchor 0.30+)

```bash
# Install once (Ubuntu/Linux)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked

solana config set --url devnet
anchor build -p welp-vault
```

Devnet deployment and transaction-level verification are **Gate 3**. Do not
fund a vault until a successful Devnet deployment is confirmed and the program
ID is published. Never fund a mainnet address from this scaffold.

For a fresh Devnet deployment, generate the program keypair locally with the
Anchor/Solana tooling, run `anchor keys sync`, rebuild, then deploy with the
Devnet provider. Keep that keypair out of Git and never share it. After a
successful deploy, verify the executable program account on Devnet and derive
the user's vault PDA from the final program ID and their public wallet address.
The user-specific PDA is derived at runtime; it is not a standalone keypair.
