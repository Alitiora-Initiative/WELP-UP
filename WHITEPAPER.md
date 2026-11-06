# WELP UP! — Technical Whitepaper

**Version:** 1.0  
**Date:** 6 November 2026  
**Status:** Product and architecture description; not an investment offer, audit report, or promise of future functionality.

## 1. Abstract

WELP UP! is a Solana market-analysis and wallet-approved trading interface. Its current product combines live token/market data, a deterministic rule-based signal scanner, wallet balance and transaction reads, and Jupiter Swap API v2 order preparation and execution after the user signs the transaction.

The project is exploring a future non-custodial vault and constrained strategy-agent architecture. Those components are not production services today. The vault program ID in source is a placeholder, the program is not deployed and audited on Solana mainnet, and unattended agent execution is not enabled. This paper separates the current product from the proposed roadmap.

## 2. Design principles

1. **User-controlled signing.** The current swap flow requires the connected wallet to review and sign each order. WELP UP does not request or store a seed phrase.
2. **Observable inputs.** Market signals are derived from retrieved data and published rules. Scores are rankings from those rules, not probabilities, forecasts, or guarantees.
3. **Fail closed.** Missing, stale, invalid, or unverified infrastructure must block the affected action rather than silently substitute a demo, simulation, or fallback balance.
4. **Verifiable history.** On-chain transaction signatures are the source of truth for executed transactions. Browser-local activity is supplemental and must not be described as a complete ledger.
5. **Least authority.** Any future agent should receive narrowly scoped authority over a user-created vault, never the user's primary wallet.
6. **Transparent economics.** Fees, profit shares, risks, and limitations must be disclosed before user consent and independently reconciled.

## 3. Current system

### 3.1 Market data and signals

The web app reads live Solana token/market information through the configured providers. A deterministic rule engine evaluates available fields and returns a score with rule-based eligibility. Missing or stale inputs must not be presented as a successful signal. A score range such as 80–98 is a filter output, not a statistical probability of profit.

### 3.2 Wallet and swap flow

The application connects to a compatible Solana wallet through Wallet Standard/Solana Kit. It requests an order from Jupiter Swap API v2, presents the order to the wallet for signature, and submits the signed transaction through Jupiter's execution endpoint. The user remains responsible for reviewing token, amount, route, slippage, network, and wallet prompts. A quote is not a fill; only a confirmed transaction signature establishes execution.

### 3.3 Portfolio and activity

Public wallet balances and transaction signatures are fetched from Solana RPC. Some activity snapshots and preferences are stored in browser localStorage. Local browser data can be cleared, is not synchronized across devices, and is not a complete accounting record. Profit and loss must not be inferred from partial snapshots.

## 4. Proposed vault architecture

The repository contains an Anchor/Rust vault scaffold intended to use a per-user program-derived address (PDA). The intended model is:

- The user creates and funds a vault through explicit wallet-signed instructions.
- A narrowly scoped executor may act only within user-approved on-chain constraints.
- The vault owner retains pause, executor revocation, and withdrawal authority.
- Vault accounting and token balances are controlled by the program, not by browser state.
- All actions emit events that an independent indexer can reconcile against confirmed transactions.

This is a proposed design, not an available mainnet service. The current program ID is a placeholder. The scaffold's swap instruction is disabled, and token-account/withdrawal coverage, deployment verification, independent audit, and mainnet launch gates remain incomplete. Do not send assets to an address derived from the placeholder.

## 5. Proposed agent and copy-trading model

A future agent should run as an isolated service with no access to user seed phrases. Each follower would explicitly authorize a constrained executor for a specific vault and strategy. Users must be able to pause or revoke the executor and recover assets without cooperation from the strategy owner.

A future marketplace may allow strategy owners to publish configurations and followers to subscribe. Performance must be calculated from confirmed on-chain executions, net of fees and slippage. Backtests and paper results must be clearly distinguished from live results. A strategy owner may configure a profit share from 0% to 30%; the final amount and settlement method must be disclosed and enforced by reviewed program logic. A one-time US$0.10 subscription fee per new strategy owner is a proposed commercial term, not an active charge.

## 6. Proposed fee policy

The proposed fee is US$0.10 per successful trade, deposit, and withdrawal. The proposed allocation is 60% to the operator wallet `6uyKhdb2iT8kWhk6SKyJjudWthYLESrVj3G7WHHydoEQ` and 40% to a platform treasury. The treasury address is not yet configured and fee collection is not active.

A production implementation must specify the USDC mint and price source, rounding, atomicity, transaction-success conditions, receipts, duplicate prevention, and refunds. Failed or reverted actions must not incur a platform fee. The fee must be displayed before signing. The website must not silently convert or transfer user assets.

## 7. Security model and launch gates

The primary threats include compromised executor keys, malicious or stale quotes, token mint controls, incorrect CPI account validation, accounting/rounding errors, upgrade-authority compromise, RPC/indexer outages, browser tampering, and misleading performance displays.

The vault requires independent review, property and adversarial tests, verified mainnet deployment, secure upgrade governance, monitoring, incident response, and recovery testing before any public deposits. See [docs/vault/THREAT_MODEL.md](docs/vault/THREAT_MODEL.md), [docs/vault/ARCHITECTURE.md](docs/vault/ARCHITECTURE.md), and [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md).

## 8. Risks

Solana transactions can fail, be delayed, or become irreversible once confirmed. Token liquidity can disappear; prices can move sharply; tokens may have freeze, transfer-fee, or other restrictive authorities; smart contracts, wallets, RPC providers, and aggregators can fail or be compromised. Users may lose some or all assets. WELP UP does not guarantee execution price, liquidity, returns, or capital protection.

## 9. Roadmap

The order of work is: (1) secure and verify the existing user-signed swap flow; (2) complete vault accounting and token support; (3) independently audit and verify deployment; (4) add durable transaction indexing and reconciled accounting; (5) build constrained agent execution and copy-trading settlement; (6) implement governance, referrals, API credentials, and operational monitoring only when their backing services exist.

## 10. Disclosures

This document describes the current application and proposed architecture. It is not financial, investment, legal, tax, or security advice. Nothing here is an offer to sell securities or a promise of profit. Features described as proposed are not available unless the live application and verified on-chain records demonstrate otherwise.
