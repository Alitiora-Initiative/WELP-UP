# WELP Launchpad — protocol specification

**Status:** product and protocol specification. No WELP launchpad program or token-creation transaction is currently deployed. The website page is a locked preview, not a live token factory.

## Product direction

WELP Launchpad should feel like a launch studio and a transparent token directory, not a copy of another launchpad. The differentiators are:

- Creator-defined supply and decimals, with checked raw-unit conversion and a clear immutable-supply policy.
- A permanent launch receipt tying the creator, mint, metadata hash, supply, decimals, quote asset, fee receipt and pool status together.
- A public launch page showing verified mint authority, freeze authority, metadata mutability, token program, pool address, liquidity source and transaction signatures.
- A creator reward ledger with explicit accrual, claimable balance, paid balance and claim signatures.
- A launch health panel that shows only verifiable on-chain facts; no fake holders, volume, market cap or trust scores.
- A searchable discovery board with filters for newest launches, verified pool status, liquidity and activity sourced from confirmed mainnet transactions.

## Creator flow

1. Connect a Solana wallet.
2. Enter name, symbol, description, image URI, optional website/social links.
3. Choose total supply and decimals (0–9). The UI previews the exact raw integer supply and rejects overflow, zero supply and malformed metadata.
4. Choose a supported quote asset: SOL or canonical mainnet USDC. The selected pair must be explicit before signing.
5. Review token program, mint authority, freeze authority, metadata mutability, launch fee, creator reward terms and all account rent.
6. Sign a single creation transaction. The creator pays account rent and the 0.50 USDC launch fee from their own wallet.
7. Verify the mint account and permanent LaunchRecord PDA from the confirmed transaction.
8. Initialize the selected liquidity pool through a reviewed DEX adapter. Pool creation is a separate state transition and must never be implied by mint creation alone.
9. Publish the launch card only after on-chain verification.

Default policy proposal: classic SPL Token mint; fixed supply; freeze authority disabled; mint authority revoked after the initial mint; metadata immutability where the metadata standard supports it. Any non-default authority must be explicit, disclosed and wallet-approved.

## Launch state machine

- Draft — local form only; no on-chain record.
- Submitted — creator wallet has signed a transaction but confirmation is pending.
- Minted — mint and LaunchRecord verified on mainnet.
- Pool pending — mint exists but no verified market pool is attached.
- Trading — pool account and token pair are verified and live.
- Paused/failed — an explicit on-chain or provider status explains why the market is not active.

The board must not use the word "live" for a minted token with no verified pool.

## Fee and creator-reward accounting

- Launch fee: 0.50 USDC, six decimals.
- Protocol split: 60% to the developer/operator recipient defined in the server-only fee policy; 40% to the WELP treasury PDA.
- Trading/transfer fee target: 0.10 USDC per supported WELP operation.
- Creator rewards are a separate stream. The reward rate is intentionally unset until a clear percentage, source of funds, eligibility rules, claim schedule and accounting model are approved.
- Creator rewards must never be funded from personal safe deposits, and they must not silently change the fixed 60/40 protocol split.
- Every charge and reward must have an on-chain receipt and unique nonce. A backend database may index events but cannot create or modify balances.

## DEX integration boundary

WELP owns the launch records, creator interface, policy checks, fee accounting, discovery indexer and user experience. Liquidity pools may initially be created through a reviewed Solana DEX adapter. The adapter must pin the exact program ID and validate every mint, token program, pool authority, vault, quote asset, LP account and CPI account meta.

No arbitrary client-supplied CPI target is permitted. The launch program must not claim to be an AMM unless WELP actually implements and audits the AMM program. A third-party pool must be labelled with its real DEX and pool address.

## Creator reward mechanics — proposed

A creator dashboard can show:
- Gross eligible protocol fee volume attributed to the launch.
- Creator reward accruals, if an approved reward rate is configured.
- Amount already claimed and remaining claimable amount.
- Each accrual and claim transaction signature.

The creator claim instruction must prove the creator controls the launch record, calculate rewards from verified fee receipts, use checked arithmetic and a monotonically increasing receipt/claim nonce, and transfer only from the funded creator reward allocation. It must not accept a caller-supplied profit or volume number.

## Required program accounts

- LaunchRecord PDA: creator, mint, metadata hash, supply, decimals, quote mint, authority policy, fee receipt, launch state, timestamps and bump.
- Treasury PDA: protocol share and fee accounting; derived from the verified WELP program ID.
- CreatorReward PDA: creator, launch record, accrued amount, claimed amount, reward policy version and bump.
- OperationReceipt PDA: unique operation identifier, payer, operation kind, exact fee amount and split, preventing duplicate charge claims.

All account sizes, seeds, authority constraints and close/realloc behavior require tests and review before deployment.

## Security and launch gates

- SBF build and generated IDL from the reviewed commit.
- Unit and ProgramTest coverage for mint creation, decimals, supply overflow, authorities, metadata, fee split, replay, wrong mint, wrong token program, substituted accounts and rollback.
- Token program and metadata program IDs pinned and checked.
- No user-provided program IDs used as unchecked CPI destinations.
- Fee transfer atomic with the launch operation.
- Independent Solana program review before public launches.
- Mainnet program ID, deployed bytecode and upgrade authority verified.
- Indexer reconciles every launch card to confirmed/finalized transactions.
- Creator reward claims are disabled until a funded and audited reward source exists.

## Inspiration, not replication

The product borrows general UX patterns from token launch studios and launch directories: creator-controlled metadata, a clear create/trade lifecycle, public token cards, pool status and creator reward visibility. WELP's own implementation must use original code, branding, program architecture and transparent on-chain accounting. It must not copy another project's proprietary code, graphics or unsupported claims.
