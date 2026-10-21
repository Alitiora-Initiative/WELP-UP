# WELP UP! Terms and Conditions

**Effective date:** 21 October 2026  
**Version:** 1.0

These Terms and Conditions (“**Terms**”) govern access to and use of the WELP UP! website and software interface at [https://welpup.fun](https://welpup.fun) (the “**Service**” or “**Website**”).

**Operator.** The Service is operated by **Joseph Mushelle Nyingeh** (“**Operator**,” “**we**,” “**us**,” or “**our**”), an individual based in Kenya, under the public software studio **Alitiora Initiative** ([github.com/Alitiora-Initiative](https://github.com/Alitiora-Initiative)). Alitiora Initiative is a free-tier GitHub organization used to publish open-source software and product documentation. No separate limited company has been formed for this Service as of the effective date.

**Contact.**  
- Email: [jaymnyon@gmail.com](mailto:jaymnyon@gmail.com) · [jaymn2006@gmail.com](mailto:jaymn2006@gmail.com)  
- Postal: House 1 Mtwapa Creek, Nairobi, coastal 80109, Kenya  
- Studio site: [alitiora-initiative.vercel.app](https://alitiora-initiative.vercel.app)

**Related documents.** These Terms should be read with the [Privacy Policy](PRIVACY.md), [LIMITS.md](LIMITS.md), [ROADMAP.md](ROADMAP.md), and the repository [README](README.md). Source code is available at [github.com/Alitiora-Initiative/WELP-UP](https://github.com/Alitiora-Initiative/WELP-UP) under the MIT License.

By accessing the Website, connecting a wallet, requesting a quote, or using any feature, you agree to these Terms. If you do not agree, do not use the Service.

---

## 1. What WELP UP! is

WELP UP! is a **non-custodial** Solana market-analysis and wallet trading interface. It:

- reviews selected live token pools and displays rule-based signals and limits;
- lets you prepare a Jupiter swap for **individual approval** in Phantom or another compatible self-custody wallet;
- does **not** trade unattended in the current release;
- signs only through the wallet session on the website;
- does **not** hold, custody, or control your digital assets.

A signal is analysis, not an order. Every current swap must be reviewed and signed in your wallet. The Operator does not match orders for third parties, hold client assets, or operate a licensed virtual-asset exchange or broker under Kenya’s Virtual Asset Service Providers Act, 2025, or the Virtual Asset Service Providers Regulations, 2026.

## 2. Operator identity and open-source studio

| Item | Detail |
|------|--------|
| Legal operator | Joseph Mushelle Nyingeh, individual |
| Country | Kenya |
| Public studio | Alitiora Initiative (GitHub free-tier organization) |
| Product repository | [Alitiora-Initiative/WELP-UP](https://github.com/Alitiora-Initiative/WELP-UP) |
| Studio principles | Free tiers first; on-chain receipts over marketing claims; say what is not built |

References to “Alitiora Initiative” identify the public software studio and GitHub organization. They do not by themselves create a company, partnership, or regulated entity. Third-party hosts (for example Vercel), RPC providers, Jupiter, Phantom, and Solana network participants operate under their own terms.

## 3. Definitions

- **Wallet** — a self-custody Solana wallet; **public address** is its on-chain identifier.  
- **Private key / seed** — any secret that authorizes a wallet signature.  
- **Digital asset** — SOL or any token on a blockchain.  
- **Signal** — software analysis output, not a transaction instruction.  
- **Swap** — an exchange routed through a third-party protocol (currently Jupiter).  
- **Vault** — a proposed future on-chain account; **not available** under these Terms.

## 4. Eligibility

You may use the Service only if you:

1. are at least 18 years of age and legally able to enter a binding contract where you live;  
2. are not prohibited by applicable law or sanctions from using Solana, Jupiter, or similar interfaces;  
3. will not use the Service for any prohibited purpose in Section 17.

You are solely responsible for determining whether use of the Service or any digital asset is lawful in your location. The Operator does not offer the Service as a regulated brokerage, exchange, investment manager, or custodian. Reachability of the Website from your location does not mean the Service is licensed or offered to you under local virtual-asset rules.

## 5. Acceptance of these Terms

Accessing the Website, connecting a wallet, or using a feature constitutes acceptance of these Terms to the extent recognized by applicable law. The Operator may later implement an explicit click-wrap or wallet-signed acknowledgment; until then, continued use after notice of updated Terms is acceptance of the updated version.

## 6. Description of the current Service

The browser application may:

- display selected Solana pool information and rule scores;  
- show public wallet balance estimates for a connected address;  
- request Jupiter swap quotes;  
- present transaction data for your wallet to review and sign.

**Current interface limits (software checks, not safety guarantees):**

- starting buy amount 0.001 SOL (editable);  
- minimum buy 0.001 SOL; maximum buy 0.02 SOL per transaction;  
- entry score band 80–98 inclusive (not a probability of profit);  
- minimum estimated wallet equity about USD 0.50 and residual SOL for fees;  
- blocks quoted price impact above 2.5%.

These limits are described further in [LIMITS.md](LIMITS.md). They may change with documentation updates. The current interface does **not** autonomously submit trades, manage positions, or take profits without a separate wallet signature for each swap.

## 7. No investment, legal, tax, or accounting advice

The Service is software. It is not an investment adviser, broker, dealer, exchange, bank, custodian, tax adviser, accountant, or law firm. Signals, scores, charts, and estimates are general outputs, not personalized advice. You make and own every decision. Seek qualified professional advice where appropriate.

## 8. Digital-asset risks

Digital assets are volatile and can lose all value. Prices, liquidity, pool data, and charts may be wrong, delayed, manipulated, or incomplete. Tokens may be fraudulent, frozen, or unsellable. Solana transactions are generally irreversible after finalization. Failed routes, congestion, slippage, exploits, and wallet compromise can cause permanent loss. Only risk amounts you can afford to lose entirely. Past performance or a model score does not predict future results.

## 9. Website wallet session

The browser may read the public address and public balances of the wallet session on the website. Quotes, history, and swaps stay unavailable until that session is active. **Never** paste wallet secrets into WELP, support messages, or forms.

You are responsible for wallet choice, device security, reviewing every transaction prompt, and network selection. Ending the session does not erase blockchain records.

Command-line code under `welp/` cannot sign swaps. Live swaps run only on the website after the wallet session is active.

## 10. Your responsibility for each swap

Before signing, verify mint, amounts, route, slippage, fees, and recipient in your wallet. Quotes are estimates and can expire. Signing authorizes only that transaction, not future trades. Keep SOL for network fees. Verify status before retrying.

## 11. Market data, quotes, and routing

Data and quotes may come from third parties and public RPCs. They may be incomplete or unavailable. Jupiter and similar providers prepare or relay routes; the Operator does not control liquidity, validators, or third-party contracts. The on-chain outcome controls what executed.

## 12. Fees and taxes

You pay network fees, protocol fees, and any third-party charges. The Operator does not reimburse fees unless expressly stated in writing. You are responsible for taxes and reporting arising from your activity. Keep your own records.

## 13. Portfolio and activity displays

Activity and portfolio views may show local browser snapshots and public RPC history for the connected address. They are convenience displays only—not official statements, tax reports, or complete ledgers. Local data does not sync across devices and can be cleared. Use explorers and your wallet for authoritative records.

## 14. No custody

In the current product you retain control of your wallet and sign each swap on the website. The Operator does not take custody of assets. Do not send assets to addresses merely because they appear in an imitation of the Service. The Operator cannot reverse finalized transactions or recover assets sent to the wrong address.

## 15. Autonomous vault — not available

Autonomous trading and any on-chain vault are **planned only** and are **not enabled**. Do not send SOL or tokens to the Website expecting automated management. Any future vault must:

- be funded only with amounts you explicitly confirm;  
- enforce total and per-position caps on-chain (design target includes 0.02 SOL per position);  
- allow you to revoke authority and withdraw available funds without the agent’s cooperation;  
- publish program addresses, source, audit status, fees, and separate assent terms before activation.

No current signature or these Terms activates unattended trading. See [ROADMAP.md](ROADMAP.md).

## 16. Open-source software and MIT license

Repository source is under the MIT License in `LICENSE`. That license governs copyright in the code. It does not replace these Terms, the Privacy Policy, third-party terms, or on-chain permissions. Open-source availability is not an audit, warranty, or promise of support.

## 17. Prohibited use

You must not:

- violate law, sanctions, or third-party terms;  
- use the Service to defraud, manipulate markets, launder funds, or facilitate prohibited activity;  
- exploit, overload, or gain unauthorized access to the Service, wallets, or RPCs;  
- solicit wallet secrets or credentials;  
- reverse-engineer or bypass security except as mandatory law allows;  
- misrepresent assets, the Operator, or Alitiora Initiative.

The Operator may restrict or terminate access for prohibited use or for security and operational reasons.

## 18. Intellectual property

The Service’s branding, interface design, and original content are owned by the Operator or licensors. You receive a limited, revocable license to use the Service as offered. You do not acquire ownership of software or trademarks by using the Service. Third-party marks (Phantom, Jupiter, Solana, etc.) belong to their owners.

## 19. Third-party services

The Service depends on independent providers (wallets, RPCs, Jupiter, hosting, data sources). Their outages, terms, and failures are outside the Operator’s control. Links to third parties are for convenience and do not imply endorsement.

## 20. Disclaimers

THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. THE OPERATOR DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS, OR THAT SIGNALS OR QUOTES WILL BE ACCURATE OR PROFITABLE.

## 21. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE OPERATOR SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, OR DIGITAL ASSETS, ARISING FROM USE OF THE SERVICE OR INABILITY TO USE IT, EVEN IF ADVISED OF THE POSSIBILITY. THE OPERATOR’S TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR THE SERVICE SHALL NOT EXCEED ONE HUNDRED UNITED STATES DOLLARS (USD 100) OR THE AMOUNT YOU PAID THE OPERATOR FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM (CURRENTLY ZERO FOR THE FREE INTERFACE), WHICHEVER IS GREATER.

Nothing in these Terms excludes liability that cannot be excluded under the law of Kenya or other mandatory rules that apply to you.

## 22. Indemnity

You agree to indemnify and hold harmless the Operator from claims, losses, and expenses (including reasonable legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any law or third-party right, except to the extent caused by the Operator’s willful misconduct where such exclusion is not permitted by law.

## 23. Suspension and changes

The Operator may modify, suspend, or discontinue the Service or any feature at any time. Material changes to these Terms will be indicated by an updated effective date. Continued use after the effective date of changes constitutes acceptance of the revised Terms where permitted by law.

## 24. Privacy

Personal information is handled as described in the [Privacy Policy](PRIVACY.md). The current product does not create a traditional authenticated account; wallet connection uses public addresses and local browser storage for convenience features.

## 25. Governing law and disputes

These Terms are governed by the laws of **Kenya**, without regard to conflict-of-law rules. Courts in Kenya have non-exclusive jurisdiction, subject to mandatory consumer protections that may apply where you live. Before formal proceedings, contact the Operator at the emails above to attempt informal resolution.

**Regulatory note.** Under Kenya’s Virtual Asset Service Providers Act, 2025, only companies limited by shares (or registered foreign companies) may be licensed as virtual asset service providers. The Operator is an individual. The current Service is offered as a non-custodial software interface: you sign every swap in your own wallet; the Operator does not hold client assets or operate a matching exchange on behalf of clients. If the product changes in a way that requires licensing, the Operator will address legal structure and authorization before offering those features.

## 26. Severability and entire agreement

If any provision is unenforceable, the remainder stays in effect. These Terms, together with the Privacy Policy and documents expressly incorporated by reference, are the entire agreement between you and the Operator regarding the Service and supersede prior informal statements about the Service.

## 27. Contact

Questions about these Terms: [jaymnyon@gmail.com](mailto:jaymnyon@gmail.com) or [jaymn2006@gmail.com](mailto:jaymn2006@gmail.com).

---

**Document control**

| Field | Value |
|-------|--------|
| Title | WELP UP! Terms and Conditions |
| Version | 1.0 |
| Effective date | 21 October 2026 |
| Operator | Joseph Mushelle Nyingeh (Alitiora Initiative) |
| Product | Non-custodial Solana browser interface at welpup.fun |
| Source | github.com/Alitiora-Initiative/WELP-UP |

*These Terms are published by the Operator for the live Service. They are not a substitute for advice from a lawyer admitted in Kenya. Users who need formal legal certainty for their own jurisdiction should obtain independent counsel.*
