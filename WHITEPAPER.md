# WELP UP! — Technical Whitepaper

**Version:** 1.1  
**Date:** 7 November 2026  
**Status:** Describes the current application and gated protocol design. It is not an investment offer, audit report, or promise of future functionality.

## 1. Abstract

WELP UP! is a Solana market-analysis and wallet-approved trading interface. The current web application provides live token/market reads, deterministic rule-based signal analysis, Wallet Standard connection, wallet balance and transaction reads, a policy-based automation watcher, and Jupiter Swap API v2 order preparation and execution after the user signs. Jupiter referral fee collection is separately configurable and is not the WELP treasury waterfall.

The app has a Launchpad route for reviewing token parameters and release status. It does not currently mint tokens, run a bonding curve, accept launch purchases, manage buyer escrow/refunds, graduate a pool, or collect a live protocol fee. These features are not described as live until verified mainnet instructions and on-chain records exist.

## 2. Design principles

1. **User-controlled signing.** The current external-wallet flow requires the user to review and sign each transaction. WELP does not request or store seed phrases or private keys.
2. **Observable inputs.** Market signals and automation policies are evaluated against retrieved market data and explicit rules. Scores are rankings, not probabilities or profit forecasts.
3. **Fail closed.** Missing, stale, invalid or unverified infrastructure blocks the affected transaction. The application must not substitute a demo, simulated trade, sample mint or fabricated balance.
4. **Verifiable history.** Confirmed on-chain signatures are the source of truth for executed transactions. Browser-local activity is supplemental, can be cleared and is not a complete ledger.
5. **Least authority.** Any future executor must receive only narrowly scoped, revocable authority. It must never receive the user's primary wallet secret.
6. **Transparent economics.** Fees, treasury release rules, risks and limitations must be disclosed before consent and reconciled against on-chain state.

## 3. Current system

### 3.1 Market data and signals

The web application reads Solana token and market information from Jupiter Token API v2. Signal eligibility is calculated from source fields and explicit risk rules. Missing or stale data must be surfaced as unavailable or a blocker, not replaced with a fabricated price, volume, holder count or score.

### 3.2 Wallet and swap flow

The application discovers installed Solana Wallet Standard providers that advertise the Solana mainnet chain. It requests an order from Jupiter Swap API v2, presents the transaction to the connected wallet for review/signature, and submits the signed order through the Jupiter execution API. A quote is not a fill; only a confirmed transaction signature establishes execution.

**Current trading and fee state:** wallet-approved Jupiter swaps are available. With referral collection unconfigured, a swap has no WELP fee. With referral collection configured, the order API verifies Jupiter's referral account and the canonical token account for the quote's fee mint before returning the signable order. Jupiter referral fees accrue to the referral partner; they do not flow directly into a WELP treasury. The on-chain treasury program is not executable on mainnet, so its epoch split is inactive. See [fees and treasury](docs/FEES_AND_TREASURY.md).

### 3.3 Automation and AI research

The Automation page can save browser-local watch policies, scan the live Jupiter market feed while the page is open, and request a read-only AI review of a new policy match when a server-side model is configured. AI reviews do not sign, submit, or modify transactions. Monitoring stops when the page is closed and is not a persistent background service.

The current Vercel project has no configured environment variables for the AI analyst. The UI must report the analyst unavailable until a real server-side API credential and model setting are configured. It must not claim that AI is connected or running when the provider is not configured.

### 3.4 Portfolio and activity

Public wallet balances and transaction signatures are fetched from Solana RPC. Some activity snapshots and preferences are stored in browser localStorage. Local browser data can be cleared, is not synchronized across devices, and is not a complete accounting record. Profit and loss must not be inferred from partial snapshots.

## 4. Proposed vault architecture

The repository contains an Anchor/Rust vault scaffold intended to use per-user program-derived addresses. The intended model is user-signed funding, on-chain allocation limits, narrowly scoped authority, owner pause/revocation and owner-controlled recovery.

This is not an available mainnet custody service. The checked-in vault program ID is not a verified production deployment. Automated swaps, SPL-token position accounting, executor settlement and some recovery paths remain disabled or unimplemented. No funds should be sent to a PDA derived from an unverified program ID.

## 5. Launchpad and protocol-fee design

### 5.1 Launchpad status

The current Launchpad page validates token name, ticker, whole-token supply and mint precision, and displays the actual program/indexer release gate. It is a configuration and status page only. The current Anchor launchpad crate implements a local treasury state and distribution core plus pure target fee arithmetic. It does not implement mint creation, supply authority revocation, launch state, bonding-curve buy/sell, quote escrow, refunds, graduation, Raydium CPMM pool creation or LP burn. No production launch ID, deployer keypair, deployed bytecode or live launch indexer is configured.

### 5.2 Protocol swap fee

The target fee calculations in the codebase are **1.00% protocol + 0.50% creator/developer** of gross input, plus a separate 0.02% genesis allocation. They are not active collection and do not map directly onto Jupiter's referral rail, which accepts one configurable 50–255 bps rate and pays one referral partner after Jupiter's share.

The target treasury calculation releases 60% of eligible new inflows after a 14-day epoch and retains 40% as reserve. No mainnet program or treasury PDA is currently enforcing this split. A math helper or an RPC account address is not proof of collection or payout.

The configured launch/treasury program address is currently a non-executable System Program account. No WELP treasury PDA is active there. The Rust and TypeScript helpers calculate target amounts only; they do not collect funds.

WELP cannot intercept arbitrary wallet transfers or direct trades routed outside its app. A Jupiter referral fee can only be included in WELP-created Jupiter orders when the referral account and exact fee-mint token account are ready. Current mainnet referral collection remains incomplete until those accounts and production environment settings are verified.

## 6. Mainnet-only release gates

The project does not use Devnet, Testnet or Localnet as a product deployment or transaction-testing target. Before any mainnet fund-moving instruction is enabled:

1. Generate a production program keypair securely outside the web application; never commit or disclose its secret key.
2. Complete the mint, launch state, curve, escrow, refund, swap, fee accounting, event and recovery instructions.
3. Build the reviewed source reproducibly with the pinned Anchor/SBF toolchain and generate the matching IDL.
4. Complete unit, property, arithmetic, account-validation and SBF-backed program checks.
5. Complete an independent Solana/Anchor security audit and remediate critical/high findings.
6. Deploy only to Solana Mainnet after the separate release decision.
7. Verify deployed program identity, bytecode/source, IDL, upgrade authority, treasury accounts and configuration directly from mainnet.
8. Run controlled mainnet checks only after the deployed program is audited and verified; every transaction must be explicitly reviewed and signed by the user.
9. Keep UI actions disabled when any required program, account, fee or verification state is missing.

A green frontend build, a calculation test, a local validator or a documentation change is not evidence that a production launchpad or fee path is live.

## 7. Risks and disclosures

Solana transactions can fail, be delayed or be irreversible once confirmed. Token liquidity can disappear; prices can move sharply; token mints may have freeze, transfer-fee or other restrictive authorities; smart contracts, wallets, RPC providers and aggregators can fail or be compromised. Users may lose some or all assets. WELP does not guarantee execution price, liquidity, returns or capital protection.

## 8. Disclosures

This document describes current functionality and gated protocol work. It is not financial, investment, legal, tax or security advice. It is not an offer to sell securities and does not promise profit. Features described as planned or gated are not available unless the live application and verified mainnet records demonstrate otherwise.
