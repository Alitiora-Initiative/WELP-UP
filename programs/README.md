# On-chain programs

## welp-vault

Per-user PDA vault scaffold (Anchor). See:

- `docs/vault/THREAT_MODEL.md`
- `docs/vault/ARCHITECTURE.md`
- `docs/PRODUCTION_READINESS.md`

**Deployment status: not deployed to Devnet or Mainnet. Mainnet funds are disabled.** The program ID in source is a placeholder. The `execute_swap` instruction fails closed with `TradingDisabled`; Jupiter CPI, complete token-account accounting, and production withdrawal coverage are not complete.

Do not derive a deposit address from the placeholder program ID. Do not deploy this scaffold or accept deposits until all launch gates have been completed and independently reviewed.

Host-side limit tests (no validator):

```bash
cargo test --manifest-path programs/vault-checks/Cargo.toml
```

### Local build and test

Requires Solana CLI and Anchor 0.30+.

```bash
anchor build -p welp-vault
anchor test
```

The checked-in Anchor configuration targets a local validator only. It intentionally does not configure a Devnet or Mainnet provider. Any later deployment must be a separately reviewed release with a final program ID, verified source, independent audit, secure upgrade authority, monitoring, and a documented recovery process.
