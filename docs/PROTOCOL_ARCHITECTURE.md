# WELP UP Protocol Architecture

Status: engineering specification, not a deployment or a claim that these protocol modules are live.

WELP UP is intended to become an independent Solana application and protocol stack. The application must not claim that a feature is live until its program is deployed, its IDL and program binary are verified, mainnet transactions have been observed, and the user-facing flow has been tested against those transactions.

## Product principles

- Build WELP-owned programs, APIs, indexers, risk rules and interfaces where that creates durable value.
- Use public Solana RPC and on-chain program interfaces as the source of truth. Third-party APIs may be optional adapters, never the only source of truth for custody, balances, fees or transaction status.
- No simulated balances, synthetic volume, fabricated P&L, placeholder signatures or fake transaction states.
- Every money-moving action is initiated by a wallet signature or an explicitly authorized, revocable on-chain executor.
- Display the cluster, program ID, mint, quote asset, fee amount, fee destination and transaction signature for every protocol action.
- Keep vault custody, token issuance, buyback/burn and portfolio accounting as separate audited modules.

## Protocol modules

### 1. WELP Launchpad

The launchpad is a native Anchor program, not a proxy to StonkFun.

Proposed instruction lifecycle:
1. Creator submits token name, symbol, metadata URI, decimals, fixed supply, quote mint and launch configuration.
2. Program validates metadata bounds, supported token program, mint configuration, creator authority and fee configuration.
3. Creator pays Solana account rent-exemption reserves in SOL. These reserves are network account deposits, not WELP revenue.
4. Creator pays a separate 0.50 USD-equivalent website launch fee on-chain.
5. Program creates/initializes the mint and metadata accounts through validated Token Program / Token-2022 CPIs.
6. Mint authority and freeze authority are revoked or retained only where the creator explicitly selected a disclosed, supported policy. Default should be fixed supply with no freeze authority.
7. Launch record PDA stores the mint, creator, metadata hash/URI, supply, quote mint, fee receipt, program version and status.
8. A market is not marked live until the actual pool initialization transaction is confirmed and the pool's mint pair, liquidity and authority accounts are verified.

Fee design:
- Preferred initial denomination: 0.50 USDC, paid in the same on-chain launch transaction. This avoids a USD/SOL oracle dependency for the fee itself.
- Existing fee routing preference: 60% developer/operator and 40% platform treasury. For a 0.50 USDC launch fee, that is 0.30 USDC and 0.20 USDC.
- Developer/operator wallet previously specified: `6uyKhdb2iT8kWhk6SKyJjudWthYLESrVj3G7WHHydoEQ`.
- Platform treasury address has not been supplied. Do not invent one, and do not enable fee collection or claim a split is live until the treasury is configured and reviewed.
- The existing 0.10 USD per-trade/deposit/withdrawal fee policy is separate from this proposed 0.50 USD launch fee. Do not silently change or combine the fee schedules.

### 2. Market creation and liquidity

A token mint is not itself a market. WELP must not show a Buy button or market chart merely because a mint exists.

The launch flow must distinguish:
- Mint created
- Metadata verified
- Initial liquidity prepared
- Pool initialized
- Pool discovered and validated
- Trading observed on-chain

Initial liquidity is supplied by the creator or another explicitly identified liquidity provider. The launchpad must not promise liquidity or price support. Pool initialization should use a separately reviewed DEX adapter with strict account, mint, token-program, authority and quote-asset checks. Never accept arbitrary CPI program IDs from the client.

### 3. Buyback and burn

Buyback is a separate treasury operation, not a hidden fee diversion.
- A dedicated BuybackConfig PDA identifies the authorized treasury, token mint, quote asset, per-operation limit, cumulative budget, cooldown and pause authority.
- Buyback funds must be explicitly deposited and separately accounted for.
- A keeper may submit a permissionless execution request, but the program validates all bounds and the exact DEX adapter accounts.
- Tokens are burned only after a confirmed purchase and a balance-delta check against the expected mint and token account.
- Every buy and burn emits an event and records the quote amount, token amount, transaction slot, mint, authority and burn signature.
- No automatic buyback is enabled until a reviewed DEX CPI adapter, oracle/price-impact bounds, slippage checks, replay protection and emergency pause are implemented.
- Do not describe a fee as being used for buybacks unless the on-chain ledger proves that allocation.

### 4. Portfolio and transaction accounting

The portfolio page should be wallet-address scoped and derive its state from confirmed/finalized chain data:
- SOL and SPL / Token-2022 holdings, including decimals and mint.
- Token metadata and current price with source and timestamp.
- Allocation chart only for assets with a verified current price.
- Transaction history with signature, slot, timestamp, status, fees and decoded token/SOL balance deltas.
- Realized P&L only when cost basis can be reconstructed from complete supported transaction history.
- Unrealized P&L only when a defensible cost basis and a current, sufficiently liquid market price exist.
- Unknown, unpriced or incomplete positions must be shown as unknown/unpriced, not zero.
- P&L must be labelled incomplete when history is truncated, accounts are missing, or transfers cannot be classified. Wallet transfers, airdrops, LP deposits/withdrawals, token burns and swaps must not be blindly classified as buys/sells.

### 5. WELP Indexer and read APIs

Build a WELP-owned read service that indexes:
- Program logs and account changes for WELP programs.
- Launch records, mint authorities, token metadata, pool initialization and pool state.
- Fee receipts and distributions.
- Buyback and burn events.
- Wallet signatures and parsed balance changes for portfolio history.

The indexer is a derived read model. Solana account state and confirmed transactions remain authoritative. Every indexed record stores signature, slot, block time, program ID, account keys, source RPC and parse status. Reorgs, provider disagreement and incomplete transaction metadata must be represented explicitly.

Start with a bounded RPC indexer and resumable cursors. Add database persistence and redundant RPC only when deployment credentials and hosting are configured. Never silently fall back to static fixture data.

### 6. WELP Security Lab (AI-assisted audit engine)

The audit product is a WELP-owned security workflow, not a claim that an AI model is an independent auditor.

Pipeline:
1. Inventory Rust/Anchor programs, TypeScript server routes, wallet signing paths, dependencies, deployment configuration and secrets.
2. Run deterministic checks: Cargo audit/advisories, dependency/license policy, formatting, Clippy, TypeScript lint/typecheck, secret scanning, SAST rules, unsafe-code inventory, Anchor account-constraint checks and test coverage.
3. Run program-specific invariants and adversarial tests: signer/owner checks, PDA seeds and bumps, account substitution, mint/program validation, checked arithmetic, token-account ownership, rent preservation, replay protection, pause/revoke behavior and CPI target allowlists.
4. AI reviews the exact source and deterministic findings, proposes attack paths and tests, and cites file/line references. AI findings remain hypotheses until reproduced.
5. A finding is closed only by a passing regression test or an independently reviewed remediation.
6. Generate a signed report with commit SHA, tool versions, ruleset version, findings, evidence, test results and limitations.

Snyk can contribute dependency and code scanning if the connected project/report is available. It does not replace Solana-specific account/CPI review, adversarial testing or an independent human audit. Do not label an AI-generated report an independent audit.

## Security and release gates

No mainnet money-moving feature is enabled merely because the frontend is complete.

Required gates for each program:
- SBF build and IDL generated from the reviewed commit.
- Unit tests, ProgramTest against the SBF binary, fuzz/property tests for arithmetic and account invariants.
- Static analysis and dependency/security scans.
- Program ID and upgrade authority reviewed; no placeholder ID used for funds.
- Mainnet deployment transaction and verified deployed bytecode.
- Program account, mint, treasury and fee destination independently checked.
- Mainnet smoke tests with minimal non-custodial transactions.
- Monitoring, pause/revocation, incident and recovery runbooks.
- Independent review before accepting public deposits or enabling autonomous execution.

## Current implementation truth

The current application already has wallet connection, public SOL/stablecoin balance reads, Solana RPC transaction history, live market/signal reads, and a wallet-approved Jupiter order path. These are not a complete portfolio ledger or a WELP-owned exchange.

The current vault source contains owner-controlled policy and SOL share-accounting groundwork, but automated swap execution and fee settlement remain fail-closed. The vault is not approved for mainnet custody.

The current PR's SBF build and ProgramTest must pass before vault work is treated as validated. No launchpad, buyback, burn or AI audit product should be labelled live until its program, indexer and transaction evidence exist.

## Explicit non-goals

- No fake TVL, volume, holders, P&L, chart candles, audit scores or transaction statuses.
- No unreviewed arbitrary CPI.
- No private-key collection or server custody of user wallet keys.
- No fee collection to an unset treasury.
- No claim that token account rent is a WELP fee. Solana rent-exemption deposits belong to the account and are subject to Solana account lifecycle rules.
- No automatic buyback funded from user deposits or vault assets.
