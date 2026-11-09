# On-chain programs

## welp-vault

Per-user PDA SOL vault (Anchor source implementation, not yet deployed). Current instructions include vault creation, explicit owner-signed deposits, proportional share accounting, owner-only share withdrawals, pause/resume, and owner-managed per-vault executor policy configuration/revocation. The policy stores a maximum trade, daily cap, slippage ceiling and version, but is not yet consumed by a swap instruction. Bot registration validates strategy/risk metadata and user-slot creation requires an enabled registry and snapshots the owner's approved strategy hash/version. Automated swaps, SPL-token custody, settlement, and fees remain disabled or unimplemented. The disabled creation-fee instruction has no oracle account or Pyth dependency until a compatible, tested price-feed integration is implemented. See:

- `docs/vault/THREAT_MODEL.md`
- `docs/vault/ARCHITECTURE.md`
- `docs/PRODUCTION_READINESS.md`

**Deployment status: not deployed to Devnet or Mainnet. Mainnet funds are disabled.** The program ID in source is a placeholder. Do not derive a user deposit address or accept funds from this source build. `execute_swap` fails closed with `TradingDisabled`; Jupiter CPI, policy consumption and strategy-snapshot enforcement by the swap path, SPL-token accounting, local-validator tests, and independent audit are not complete. Legacy direct withdrawal is disabled to prevent share-accounting bypass; the legacy initializer is disabled because its cap arguments were not persisted.

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

## welp-launchpad

A new Anchor 0.30.1 crate is present at \`programs/launchpad\`. The current implementation slice contains:

- a single \`treasury-v1\` PDA with the hardcoded developer recipient;
- \`initialize_treasury\`, which records the Solana Clock timestamp;
- \`disburse_treasury_funds\`, a permissionless harvest gated by at least 1,209,600 seconds;
- a protected 40% reserve counter excluded from later epoch distributions;
- checked Rust math and unit tests for the target 1.00% protocol plus 0.50% creator/developer allocation and remainder carry.

**Deployment status: local source only; not deployed to Devnet or Mainnet.** The program ID in \`lib.rs\` is a sample local ID with no deployment keypair. Do not derive a production PDA or send funds to it. The fee routing helper is not yet called by a launch buy/sell handler and does not transfer any funds. Mint initialization, purchases, curve, escrow, refunds, Raydium CPMM CPI, LP burn and production indexing are not implemented.

Run the host-side unit tests with:

\`\`\`bash
cargo fmt --check --manifest-path programs/launchpad/Cargo.toml
cargo clippy --manifest-path programs/launchpad/Cargo.toml -- -D warnings
cargo test --lib --manifest-path programs/launchpad/Cargo.toml
\`\`\`

The ProgramTest suites live in the separate host-only crate `programs/program-tests`, not inside either deployable SBF crate. This keeps validator dependencies out of the program lockfiles. Before the SBF build, `scripts/pin-sbf-compatible-locks.sh` pins transitive releases that declare Cargo 2024-edition features beyond the Solana 1.18 bundled Cargo 1.75 parser. After Anchor builds both `target/deploy/welp_vault.so` and `target/deploy/welp_launchpad.so`, the workflow runs each integration test with `BPF_OUT_DIR` pointing at `target/deploy`.

The 40% reserve is only permanently inaccessible if the final deployed program is immutable or subject to the explicitly disclosed upgrade-governance policy. Do not describe it as irrevocably locked while an unrestricted upgrade authority remains.
