# WELP UP! Terms and Conditions

**DRAFT — LEGAL REVIEW AND ACCEPTANCE FLOW STILL REQUIRED.** The operator details and country below were supplied by the project owner. Before treating this document as operative or asking users to accept it, obtain review from counsel qualified in Kenya, confirm the correct operator and notice details, and implement a durable way to present the final version and record each user's assent. The current website does not record acceptance of these Terms.

**Draft date:** 20 October 2026

**Service operator:** Joseph M. Nyingeh, individual operator based in Kenya; no separate company has been identified.

**Contact emails:** jaymnyon@gmail.com · jaymn2006@gmail.com

**Governing country:** Kenya; the appropriate law, venue, and mandatory consumer protections require Kenyan legal review before this draft is final.

These Terms describe the current WELP UP! website and its wallet-connected Solana interface. They also describe a possible future vault product so that its design limits are clear. The future vault is not live, has not been deployed, and is not made available by these Terms. Until an audited implementation and separate, versioned vault authorization are presented, the only trade execution flow described here is a transaction that the user individually reviews and signs in their connected wallet.

## 1. Read these terms before using WELP

WELP UP! is a software interface that displays market information and can prepare a transaction for a connected Solana wallet. The current browser interface is capable of requesting Jupiter swap quotes and submitting a transaction after the wallet has signed it. Solana mainnet transactions transfer real digital assets. They can lose value, execute at a different time or price than expected, fail after fees are incurred, or be impossible to reverse. You should read this document, the risk disclosures, the wallet's transaction details, and any protocol documentation before continuing.

By accessing the website, connecting a wallet, or using a feature, you indicate that you have read and understood these Terms to the extent the law recognizes that action as assent. The project owner has supplied an individual operator name and Kenya as the country, but this draft still needs legal review, confirmation of the final notice details, an effective version, and a durable acceptance-record system. The current website does not record acceptance. Complete those steps and provide any disclosures required by law before relying on this text as a binding agreement. If you do not agree with the final terms when they are published, do not use the service.

## 2. Operator and service identity

The project owner has identified the service operator as **Joseph M. Nyingeh, an individual based in Kenya**. No company or other separate legal entity has been identified. The contact addresses supplied for public support and notices are **jaymnyon@gmail.com** and **jaymn2006@gmail.com**. These details are published because the project owner requested them for the Terms and public service information. Confirm they are monitored and suitable for legal notices before presenting this draft as final. A repository author, open-source contributor, wallet provider, RPC provider, or token project is not automatically the operator merely because its software or infrastructure is used by the interface.

The service may be hosted by a cloud provider and may rely on independent providers for wallet discovery, blockchain data, token prices, charts, trade routes, or transaction relay. Such providers operate their own systems and may set their own terms. The operator does not control the Solana network, Phantom, Jupiter, GeckoTerminal, RPC operators, token issuers, or independent applications. References to a third party are for identification and do not imply sponsorship, endorsement, a partnership, or a guarantee.

## 3. Definitions

“WELP” or “Website” means the WELP UP! interface operated by the person identified above. “User” means a person or entity using it. “Wallet” means a self-custody Solana wallet and “public address” its publicly visible account identifier. “Private key” includes a seed or recovery phrase and any secret that authorizes a wallet signature. “Digital asset” means SOL or a token represented on a blockchain. “Signal” means a software analysis output, not a transaction. “Swap” means an exchange routed through a third-party protocol. “Vault” means the proposed, currently unavailable on-chain account described below.

## 4. Eligibility and authority

You may use WELP only if you can legally enter into an agreement, are old enough to use digital-asset services in your location, and are not prohibited by applicable law or sanctions from accessing the Website or the relevant protocols. If you use the Website for an organization, you represent that you have authority to bind that organization. You are responsible for determining whether use, trading, holding, or transferring any asset is lawful for you, including whether local restrictions apply to a particular token, provider, or transaction.

The operator does not represent that WELP is available, appropriate, or lawful in every country or territory. We may restrict access where required by law, provider terms, security concerns, or operational limits. A website being reachable from your location does not mean that the service is offered to you as a regulated brokerage, exchange, investment manager, or custodian. Do not access or use the Website if doing so would violate the laws that apply to you.

## 5. What the current Website does

The current browser application can display selected Solana pool information, evaluate a limited set of indicators and rules, show wallet balance estimates, request swap orders, and present transaction data for a connected wallet to review. The front end sets a starting buy amount of 0.001 SOL, allows the amount to be edited, and currently enforces a 0.001 SOL minimum and 0.02 SOL maximum for buys made through that interface. It applies additional code-level filters described in the README and in the interface. These are software constraints, not guarantees of safety or performance.

The current interface does not autonomously submit trades, manage positions, or take profits on your behalf. It does not run an unattended trading service from your browser. The signal engine's scan is analysis. To execute a swap, the connected wallet must sign the particular transaction and the signed transaction must be sent to the relevant provider. A successful response or displayed transaction signature does not guarantee a lasting economic result, a profitable fill, or a complete record of your portfolio. Feature behavior may change only with appropriate release notes and updated documentation.

## 6. No investment, legal, tax, or accounting advice

WELP is software, not an investment adviser, broker, dealer, exchange, bank, custodian, tax adviser, accountant, or law firm. Signals, scores, charts, estimates, and rankings are general software outputs, not advice tailored to your finances, goals, experience, risk tolerance, or tax position. They are not an offer, solicitation, fiduciary recommendation, or promise that an asset should be bought, sold, or held.

You make and own your decisions. Independently research each asset and transaction, and seek qualified financial, legal, or tax advice where appropriate. Product labels and examples do not change this section unless the operator publishes an authorized amendment.

## 7. Important digital-asset risks

Digital assets are volatile and speculative; an asset can lose some or all of its value. Prices, liquidity, pool statistics, token names, and charts may be inaccurate, manipulated, delayed, incomplete, or unavailable. A token can be fraudulent, restricted, frozen, exploited, impossible to sell, or unsupported by any meaningful redemption right. Stablecoins may depeg or be frozen; tokenized securities can involve issuer, custody, redemption, legal, and transfer risks. Verify mint addresses and rights independently.

Solana transactions are generally irreversible after finalization. A mistaken or malicious signature, wrong address, compromised wallet, exploit, failed route, outage, congestion, slippage, price impact, validator behavior, or smart-contract defect can cause permanent loss. A transaction may fail or land later than expected and still consume fees. A shown route or price does not guarantee that an asset can be sold.

Only risk funds you can afford to lose entirely. Prior price movements, model output, or a successful past trade do not predict a future result.

## 8. Wallet connection and private keys

The browser interface connects through the wallet's normal flow and can read your public address and public on-chain balances. It does not need or request a seed phrase or private key to prepare the current browser swaps. Never paste wallet secrets into WELP, a support message, form, or browser prompt. Project personnel should never ask for them.

You are responsible for choosing the right wallet and network, protecting your device, understanding wallet permissions, and reviewing every transaction prompt. A public address can be used to inspect public activity. Disconnecting does not erase blockchain records.

Separate legacy command-line code in the repository can read a locally configured private key. It is not launched by the deployed browser app. Do not run that legacy path unless you have reviewed and understand it; never send its key to the operator.

## 9. Your responsibility for each current swap

Before signing, check the asset mint, input amount, output asset, estimated output, slippage, impact, fees, recipient, and instructions shown by your wallet. A preview can be incomplete; wallet prompts may not explain every instruction. Reject anything unexpected, unclear, stale, or inconsistent. A quote is only an estimate.

Signing authorizes the transaction in that wallet prompt, not future trades. A connection, scan, quote request, click, earlier signature, or acknowledgment does not authorize ongoing trading. The current app requests a separate wallet signature for each swap. Keep SOL for network fees and verify transaction status before retrying; retries can duplicate activity if a previous submission lands late.

## 10. Market data, quotes, and transaction routing

Market data and quotes may be obtained from external services and public blockchain endpoints. They may be incomplete, delayed, cached, inconsistent, rate-limited, manipulated, or temporarily unavailable. A balance estimate can omit tokens or include stale valuations. A displayed portfolio estimate is not a statement, reconciliation, tax record, or valuation guarantee. A chart generated from snapshots only includes the observations recorded by this browser after it was used; it does not backfill prior activity and may not include all assets.

Swap routes and transaction instructions may be prepared or relayed by Jupiter or other independent providers. The operator does not control the route, liquidity, execution order, validator, quote expiry, token program, or third-party contracts. A quote is not an execution commitment. If the quote expires, wallet address changes, data is stale, or a provider cannot relay the transaction, request a fresh quote and inspect it again. The final blockchain outcome, rather than a preview, determines what was executed.

## 11. Fees, charges, and taxes

You are responsible for on-chain transaction fees, swap or protocol fees, token transfer fees, wallet charges, provider charges, and any other amount associated with your transactions. The Website may not display every fee in the same unit or at the same time. Third-party fees may be changed by the provider. Before signing, inspect available fee information in your wallet and relevant provider interface. Do not assume that the operator pays, reimburses, or caps a fee unless an authorized written notice expressly says so.

You are also responsible for determining and paying any taxes, duties, reporting obligations, or other assessments arising from your use of digital assets or the Website. The operator does not provide tax documents or personalized tax calculations unless an expressly identified feature is introduced. You should keep your own transaction records and consult a qualified tax professional about your situation.

## 12. Portfolio and activity page

The portfolio activity page may display a recent public wallet balance snapshot, a line based on recorded snapshots, rule scans, and successful swaps that the current browser recorded after execution was reported. This display is supplied for convenience. It is not a complete transaction history, official account statement, cost-basis report, performance record, profit-and-loss report, or tax report. A balance movement may have many causes besides a WELP swap, including external deposits, withdrawals, rewards, transfers, other wallet activity, fees, or changes in asset prices.

History is stored in the current browser's local storage and keyed by the connected public wallet address. This helps keep records for different addresses separate in that browser. It does not establish the civil identity of a user, create an authenticated account, sync history between browsers, or prevent someone with access to the same device from viewing it. Clearing browser data, using private mode, changing browsers, or device failure can remove the local history. Separate addresses can represent the same person, and one address can be used by more than one person. Use the blockchain explorer and your wallet records for authoritative transaction verification.

## 13. No custody in the current product

In the current browser product, you retain control of your wallet and sign each swap in the wallet. The operator does not ask for custody of your assets, take possession of your private key, or hold a balance on your behalf. A transaction that you sign interacts with on-chain programs and may move assets according to its instructions. This description is limited to the current product design and is not a legal conclusion about how any regulator would characterize the service.

Do not send assets to an address merely because it is displayed in an imitation of WELP. Verify the source, recipient, and transaction in the wallet. The operator does not promise to recover assets sent to the wrong address or to reverse a finalized transaction. Any future product that introduces a vault, delegate, relayer, or ongoing permission will need to explain its exact authority, security model, revocation process, and additional terms before you choose to activate it.

## 14. Proposed autonomous trading is not available

The operator is considering a future feature in which a user could fund a separate on-chain vault, set a total funding cap, approve limited trading authority, and revoke that authority. The design discussed so far includes a maximum of 0.02 SOL per position. These are planned requirements only. The current Website does not create such a vault, accept a trading mandate, monitor a funded vault, automatically close positions, or take profits without a separate user signature. Do not transfer assets to the current application expecting it to trade them.

An initial confirmation alone would be inadequate for ongoing unattended trading unless it authorizes a narrowly scoped on-chain account whose behavior can be independently verified. A future implementation must define eligible programs and assets, total and per-position exposure, transaction limits, time periods, fees, emergency stops, upgrade authority, key recovery, reporting, and user revocation. It must be separately disclosed and affirmatively activated. No future feature is covered by your signature on a current manual swap, and no feature will be treated as active simply because its interface appears in a roadmap or mockup.

## 15. Requirements for any future vault

The intended product is an isolated on-chain vault that the user funds from a self-custody wallet with an amount of SOL the user chooses and explicitly confirms. It should enforce the user's total funding cap and a maximum of 0.02 SOL per open position. The user must be able to stop the agent, revoke its authority, and withdraw available funds back to their wallet at any time without needing the agent's cooperation. No seed phrase or Phantom private key should be disclosed to the operator.

The exact program must enforce limits on-chain; an interface value alone is not a secure cap. Before release, publish the program address and source, permitted programs and assets, authority and upgrade model, transaction limits, fee model, audit scope and date, known findings, pause and revocation method, and handling of open positions and residual assets. A user should be able to inspect each allocation and the exact version of the authority being granted.

A withdrawal request must remain available to the user. If funds are in open token positions, converting them to SOL may require a separate sell, available liquidity, fees, and market execution; the user must be told clearly whether they can withdraw tokens as-is or must first close positions. Network congestion or a finalized transaction cannot be reversed. The current app implements none of these vault functions. An audit can find defects but cannot prove a program is risk-free. Unattended trading stays disabled until a reviewed implementation and separate authorization are live.

## 16. Open-source software and MIT license

The source code in this repository is made available under the MIT License, subject to the license text in the repository's `LICENSE` file. The MIT License is a software copyright license. It permits specified use, modification, and distribution of the covered code subject to its notice and disclaimer terms. It does not make these service Terms, privacy disclosures, third-party terms, token rights, wallet permissions, on-chain programs, or a user's transactions “MIT-licensed.” It does not constitute financial, legal, or security approval.

These Terms are a separate description of the relationship between the operator and a Website user. The Terms do not amend the repository's MIT license, and the MIT license does not replace these Terms. Third-party packages and services may have different licenses and conditions. Open-source availability does not mean the code has been independently audited, that the operator promises support, or that a user can recover funds lost through use of the software. The license text included with the repository controls the covered software license.

## 17. Prohibited use

You may not use the Website to violate laws, sanctions, provider terms, or another person's rights; to deceive, defraud, manipulate markets, launder proceeds, evade financial controls, or facilitate prohibited transactions; or to exploit, disrupt, overload, or gain unauthorized access to the Website, a wallet, an RPC endpoint, or a third-party service. You may not upload or transmit malicious code, interfere with another user's access, impersonate the operator, misrepresent an asset, or use the service to solicit seed phrases or credentials.

You may not reverse engineer or bypass a security or rate limit except to the extent applicable law does not permit that restriction. You may not represent a signal as an endorsed recommendation, a verified audit, a guaranteed return, or the operator's promise. You may not use WELP to manage someone else's wallet without their valid authority. The operator may suspend access, block requests, or report suspected abuse where reasonably necessary and lawful. These restrictions do not transfer responsibility for your conduct to the operator.

## 18. Privacy and information handling

The app can process your public wallet address to load balances, signals, and quotes. Public blockchain activity can be inspected by anyone and may be indexed by providers. The portfolio page stores wallet-keyed history in this browser's local storage; it is not an authenticated account database, is not synced across devices, and can be seen by someone with access to the same browser profile. Clearing site data may erase it.

Requests may go to hosting, wallet, RPC, price, market-data, and swap providers. Depending on use, providers may receive technical information, a public address, token mint, or quote/transaction data and apply their own privacy notices. The operator does not promise anonymity or that providers do not log requests.

Publish a separate privacy notice before collecting personal data beyond what the basic site needs. Privacy requests may be sent to jaymnyon@gmail.com or jaymn2006@gmail.com. Never send wallet secrets, passwords, or confidential financial information to WELP.

## 19. Security and incident response

Software and infrastructure can contain vulnerabilities. The operator may change, pause, or disable a feature if there is a suspected exploit, provider incident, data issue, or material risk. A security notice, maintenance banner, or audit report describes only the scope and time covered; it is not a guarantee that every component is safe. Users should independently verify software versions, URLs, wallet prompts, program addresses, and transaction contents.

If you believe a WELP page or transaction is malicious, stop signing, disconnect the wallet, and use your wallet's documented security steps. If a future vault is deployed, use the verified on-chain revocation route described for that exact version. Contact jaymnyon@gmail.com or jaymn2006@gmail.com with non-secret details. Never include seed phrases, private keys, passwords, or unredacted authentication data in a vulnerability report. The operator may not be able to stop a transaction that is already submitted or reverse one that has finalized.

## 20. Availability, changes, and discontinuation

The Website may be unavailable, slow, incomplete, or changed without notice due to maintenance, deployments, network conditions, provider limits, security events, or other causes. The operator does not promise uninterrupted access, a particular signal frequency, a minimum number of tokens, or continued support for a wallet or provider. The operator may correct errors, remove features, set request limits, pause trading-related functions, or discontinue the Website, subject to applicable law.

A change in software can change calculations, display, supported token types, or transaction building. Before a material new feature such as vault-based unattended trading is enabled, the operator should publish a new version of these Terms and require the user to review and affirmatively accept feature-specific terms. If you do not accept a material change, stop using the affected feature. Changes do not retroactively alter the meaning of a transaction that has already finalized on-chain.

## 21. Third-party services and protocols

The Website may link to or interact with independent wallets, exchanges, token lists, market-data providers, analytics services, smart contracts, block explorers, RPC services, and hosting platforms. Those services are not controlled by the operator. They may change their features, charge fees, impose restrictions, experience outages, make errors, or discontinue operation. Their software and terms can apply directly to your use. Review their current terms and security information before interacting with them.

The operator does not warrant, guarantee, or assume responsibility for a third-party product, token issuer, pool, wallet prompt, smart contract, route, quote, data feed, or market participant. A link or integration is not an endorsement. If a third-party service fails or acts incorrectly, the operator may be unable to obtain a refund, reverse an on-chain action, or provide a substitute service. Your relationship with a third party is governed by the terms that third party provides.

## 22. Disclaimers of warranties

To the fullest extent permitted by law, the Website and all related information, software, signals, quotes, charts, estimates, and interfaces are provided “as is” and “as available,” without warranties of any kind, whether express, implied, statutory, or otherwise. This includes implied warranties of merchantability, fitness for a particular purpose, title, non-infringement, accuracy, availability, quiet enjoyment, and warranties said to arise from course of dealing or usage of trade, to the extent such exclusions are permitted.

The operator does not warrant that the Website will be uninterrupted, secure, error-free, current, compatible with every wallet, free of harmful components, or suitable for your needs. The operator does not warrant that data, analysis, signals, quotes, prices, transaction previews, or local history are accurate, complete, timely, available, or profitable. Mandatory consumer rights and other warranties that cannot lawfully be excluded remain unaffected. Nothing in this section removes a non-waivable right granted by applicable law.

## 23. Limitation of liability

To the fullest extent Kenyan law permits, the operator and its contributors and service providers will not be liable for indirect, incidental, special, punitive, or consequential loss; lost profits or opportunity; data loss; business interruption; tax liability; or digital-asset loss arising from the Website, wallet, protocol, token, quote, or transaction, even if the possibility was known. This includes loss caused by volatility, mistaken signatures, provider outages, smart-contract defects, or failed and delayed transactions.

The operator's aggregate liability for all Website-related claims is limited to the amount you paid directly to the operator for Website access in the twelve months before the event. The current interface charges no direct access fee. On-chain and third-party provider fees are not payments to the operator unless expressly stated. This proposed limit needs Kenyan legal review; no fixed cash cap is supplied.

Nothing excludes liability for fraud, intentional misconduct, death or personal injury caused by negligence, non-waivable consumer rights, or other liability that cannot lawfully be limited. If a limitation is not lawful, it applies only to the extent permitted.

## 24. Suspension and termination

You can stop using the Website at any time by closing it and disconnecting your wallet. If a future vault exists, stopping use of the Website may not revoke the on-chain authority; you must follow the documented on-chain revocation instructions for the exact vault. The operator may suspend or terminate Website access for maintenance, security, legal compliance, suspected abuse, a provider restriction, or discontinuation. Where practicable and lawful, the operator will provide notice, but immediate action may be needed to reduce risk.

Suspension of the interface does not freeze a blockchain address, cancel pending transactions, close a position, or revoke a smart-contract authority unless the relevant on-chain mechanism specifically does so. Sections that by their nature should continue, including risk disclosures, intellectual property, disclaimers, liability, dispute provisions, and record-keeping obligations, survive termination as allowed by law.

## 25. Disputes and governing law

The project owner has identified Kenya as the intended governing country. Kenyan counsel must confirm the applicable law and an appropriate dispute process before this draft is final. The final version should state the applicable courts or other dispute forum, place of venue, notice method, whether a pre-filing discussion is required, and whether any arbitration or class-action language is lawful and appropriate. No arbitration, class-action waiver, shortened claim period, or foreign venue is imposed by this draft.

If a dispute arises, contact **[DISPUTES CONTACT]** with a description of the issue and the relief requested. The operator and user may try to resolve the issue informally where practical. Mandatory local consumer protections, regulator access, and non-waivable court rights are not removed by this draft. The law specified in the completed version should not be interpreted to deny protections that mandatory law gives a consumer in their home location.

## 26. Notices and contact

Legal notices and general support requests may be sent to jaymnyon@gmail.com or jaymn2006@gmail.com. The operator has not supplied a physical business address. Confirm that these inboxes are monitored and whether a postal address is legally required before publishing final terms. A notice is effective only when received through a valid contact channel, subject to applicable law. The operator may send Website notices through a prominent on-screen message, a published version notice, or an email if a user has provided and consented to use an address in a future account feature.

The current Website does not require registration and may not know the user's legal name or email address. Connecting a public wallet is not an agreement to receive email marketing. Do not send secrets or wallet recovery details in a contact request. The operator may ask for a public transaction signature or non-sensitive browser information to investigate a problem, but it should never ask for a private key.

## 27. Acknowledgment of risk

By using a completed version of the Website, you acknowledge that you understand digital-asset transactions can result in total loss; that quotes, prices, and signals can be inaccurate or stale; that a wallet signature can authorize an irreversible transaction; that automatic exit rules cannot guarantee execution or price; and that technical, economic, legal, and third-party risks can occur at any time. You accept responsibility for deciding whether to use the interface and for each transaction you approve, subject to rights that cannot be waived under applicable law.

This acknowledgment is not a waiver of mandatory legal rights and does not make a draft enforceable before the operator completes the missing details and appropriate acceptance process. Acknowledging risk does not excuse the operator from obligations that applicable law imposes or from liability that cannot legally be excluded. It also does not imply that the user has accepted an autonomous trading feature that is not currently deployed.

## 28. Final publication checklist

Before publication as final terms, the operator must verify the supplied individual name, confirm whether a physical notice address or separate legal entity exists, choose and validate the effective date and dispute forum, confirm the two email inboxes, and have a Kenyan lawyer review eligibility, regulatory characterization, consumer disclosures, privacy, electronic assent, liability limits, indemnity, disputes, and any required local language. The operator should publish a separate privacy notice, a clear risk summary, and a precise description of the current manual transaction flow.

If an autonomous vault is later released, the operator must also publish the audited program version and addresses, vault-specific terms, total-cap and per-position enforcement, supported assets and programs, fee model, monitoring assumptions, revocation instructions, open-position behavior, loss scenarios, incident procedure, and separate assent flow. It must record the user's chosen limits and the exact document version in a way that does not require collecting a private key. No such feature is activated by this draft.

## 29. Version information

Document title: WELP UP! Terms and Conditions.

Document status: Draft; Kenya and the individual operator were supplied, but legal review and an acceptance flow are pending.

Draft date: 20 October 2026.

Product scope described: Current wallet-connected browser interface; separate future vault requirements are explicitly not live.

License relationship: The software source is distributed under the repository's MIT License. These Terms are separate service terms and are not part of that software license.
