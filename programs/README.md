# On-chain programs

## welp-vault

Per-user PDA SOL vault (Anchor source implementation, not yet deployed). Current instructions include vault creation, explicit owner-signed deposits, proportional share accounting, owner-only share withdrawals, and pause/resume. Automated swaps, executor authorization, SPL-token custody, settlement, and fees remain disabled or unimplemented. See:

- `docs/vault/THREAT_MODEL.md`
- `docs/vault/ARCHITECTURE.md`
- `docs/PRODUCTION_READINESS.md`

**Deployment status: not deployed to Devnet or Mainnet. Mainnet funds are disabled.** The program ID in source is a placeholder. Do not derive a user deposit address or accept funds from this source build. `execute_swap` fails closed with `TradingDisabled`; Jupiter CPI, executor revocation, SPL-token accounting, local-validator tests, and independent audit are not complete.

Do not derive a deposit address from the placeholder program ID. Do not deploy this program or accept deposits until all launch gates have been completed and independently reviewed.

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
