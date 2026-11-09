# WELP UP — Terms and Conditions

**Effective date:** 7 November 2026  
**Version:** 2.0

These Terms govern access to and use of the WELP UP website and software at https://welpup.fun (the “Service”).

## 1. What the Service is

WELP UP is software and protocol infrastructure for Solana market discovery, wallet-approved transactions, user-created on-chain safes, token launches and portfolio information. It is not a bank, broker, investment manager or centralized exchange.

The Service does not ask for or require a seed phrase, private key, wallet export or custody credential. Users connect an external wallet and must review and sign each transaction. A signal or AI-generated analysis is information, not an instruction to trade.

## 2. User-created safes and control of assets

Each safe is intended to be created by its own user through an on-chain program instruction signed by that user's wallet. The user chooses whether to create a safe, what assets to deposit, which permissions to enable and when to withdraw, subject to the deployed program's rules.

A safe is a program-derived on-chain account. Assets deposited into it are held by that on-chain account and controlled by the deployed program logic; they are not held in a WELP operator wallet. The Service operator does not receive the user's private key and must not have an undisclosed unilateral withdrawal or signing authority. Users must inspect the deployed program, its source, upgrade authority, account constraints and permissions before funding.

**Current release status:** the vault program has not yet been approved for mainnet use. Do not deposit assets into any address presented as a WELP safe until the exact mainnet program and its instructions have been deployed, independently verified, security-reviewed and explicitly enabled in the application.

## 3. Wallet signatures and user responsibility

A wallet signature authorizes the transaction displayed by the wallet. Before signing, verify the network, program IDs, token mints, amounts, recipients, fees, slippage, account permissions and any delegated authority. Never sign a transaction you do not understand. WELP cannot reverse finalized blockchain transactions or recover assets sent to an incorrect address.

The user is responsible for wallet security, device security, transaction review, tax reporting and determining whether use of the Service is lawful where they reside.

## 4. Trading and third-party protocols

The Service may prepare swaps through third-party Solana protocols and market data providers. Such providers operate independently. Quotes can expire, routes can fail, liquidity can change and execution can differ from estimates. A transaction's finalized on-chain outcome is authoritative.

Wallet-approved Jupiter swaps are available through the site's order and execution routes. When WELP referral collection is not configured, swaps do not charge a WELP referral fee; third-party route fees may still apply. When collection is configured, WELP checks the referral account and the exact fee-mint token account before returning a signable order. Every swap still requires the user's wallet signature. No AI service or server may silently sign transactions on a user's behalf.

## 5. Fees

The codebase contains a target fee policy calculation that is not active collection:

- **Protocol allocation:** 1.00% of gross swap input.
- **Creator/developer allocation:** 0.50% of gross swap input.
- **Genesis allocation:** 0.02% of supply, for a launch path that is not currently live.
- **Treasury epoch target:** after 14 days, 60% of eligible treasury inflows to the developer/operator and 40% retained as reserve.

The live Jupiter referral rail accepts one configured rate (50–255 basis points) and sends referral proceeds to the referral partner's token account after Jupiter's share. It does not implement the 1.00% + 0.50% split or the treasury epoch. The current referral partner is the dev wallet, not a separate treasury. The WELP treasury program is not deployed as an executable mainnet program.

No fee is charged merely by these Terms or by a policy calculation. The quote must show the referral state and fee mint, and the resulting transaction must be confirmed on-chain to establish collection. Network fees, rent, Jupiter's share, and DEX/pool fees are separate. See the [current fee and treasury status](docs/FEES_AND_TREASURY.md).

## 6. Launchpad

Token creators may be able to configure a token's name, symbol, metadata, supply and decimals. Token creation, pool initialization and trading are separate on-chain steps. A mint alone does not prove that a market or liquidity pool exists.

Creators are responsible for the accuracy and legality of token metadata and for disclosing their token's risks, authorities, supply, liquidity and reward arrangements. WELP does not guarantee liquidity, price, buyers, listing, returns or successful trading. Creator rewards are not guaranteed and may only be paid from verified, available reward allocations.

The launchpad must not display a token as live until the mint and any claimed pool have been verified on Solana mainnet.

## 7. Portfolio, charts and P&L

Portfolio balances and transaction history are derived from public blockchain data and may be incomplete because of RPC limits, missing historical records, unsupported transaction versions, account closures or unavailable price data. Allocation charts must omit or clearly mark unpriced assets. Realized and unrealized P&L must not be represented as complete when cost basis or history is incomplete. These displays are informational and are not tax statements or audited financial records.

## 8. Digital-asset risks

Digital assets are volatile and can lose all value. Tokens may be illiquid, malicious, frozen, or impossible to sell. Smart contracts, wallets, third-party programs, oracles, RPC providers and bridges can fail or be exploited. Transactions are generally irreversible after finalization. Users should only transact with assets they can afford to lose.

## 9. No investment, legal, tax or accounting advice

The Service provides software and general information. It does not provide individualized investment, legal, tax or accounting advice. Users make their own decisions and should obtain qualified advice when appropriate.

## 10. Privacy and wallet information

The Service may process public wallet addresses, public transaction data, basic service telemetry and information users voluntarily send to support. Public blockchain data is visible independently of WELP. The Service will never request a seed phrase or private key. See the Privacy Policy for further information.

## 11. Prohibited use

Users must not use the Service to defraud, manipulate markets, launder funds, evade sanctions, exploit the application, attack third-party systems or solicit wallet secrets. Users must not misrepresent token supply, liquidity, trading activity, audit status or rewards.

## 12. Service availability and changes

The Service may be changed, suspended or discontinued for security, maintenance, legal or operational reasons. Third-party outages and Solana network conditions may affect functionality. A feature shown in the interface is not necessarily enabled; the published system status and on-chain evidence determine availability.

## 13. Disclaimers and limitation

The Service is provided “as is” and “as available”, to the maximum extent permitted by applicable law. No guarantee is made that the Service will be uninterrupted, error-free, secure or profitable. To the maximum extent permitted by applicable law, WELP is not liable for indirect or consequential losses, lost profits, lost data or digital-asset losses arising from user transactions, third-party services, network conditions or wallet compromise.

Nothing in these Terms excludes liability that cannot lawfully be excluded.

## 14. Governing law and disputes

These Terms are interpreted under the laws that apply to the relevant parties and transaction, including any mandatory consumer protections. The current Support Centre at https://welpup.fun/support provides self-service guidance only; it does not accept formal legal notices or privacy requests. A dedicated secure contact channel must be published before account-level personal-data features are enabled.

## 15. Support and contact status

General product guidance is available through the self-service Support Centre at https://welpup.fun/support. This release does not publish a direct personal contact address or accept formal legal notices through that page. A secure contact and privacy-request channel must be established before account-level personal-data features are enabled.

---

**Document control:** WELP UP Terms and Conditions · Version 2.0 · Effective 7 November 2026.

These Terms are a product disclosure, not a substitute for advice from a qualified lawyer in the user's jurisdiction.
