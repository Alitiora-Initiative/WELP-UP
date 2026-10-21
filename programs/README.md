# On-chain programs

## welp-vault

Per-user PDA vault (Anchor). See:

- `docs/vault/THREAT_MODEL.md` — Gate 1
- `docs/vault/ARCHITECTURE.md` — Gate 2 (authority model, instructions)

**Mainnet is disabled.** Program ID in source is a placeholder until `anchor keys list` / first deploy.

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

Deploy and integration tests are **Gate 3**. Do not fund mainnet addresses from this scaffold.
