# WELP UP Launchpad — Protocol and Platform Specification

**Document status:** Engineering specification / not a deployment claim  
**Target:** Solana Mainnet-Beta only, after independent review and a separately approved production release. No Devnet deployment or test flow is part of this product requirement.  
**Application:** \`welpup.fun\`  
**On-chain framework target:** Anchor 0.30.1, aligned to the existing repository workspace  
**Frontend target:** Next.js App Router, React, TypeScript and the repository's current \`@solana/kit\` + \`@solana/react\` wallet stack

This document translates the launchpad manifesto into implementation requirements that are compatible with the actual repository and Solana's account, token and transaction model. It corrects ambiguities and unsafe assumptions. It must not be read as evidence that the launch program, AMM adapter, fees or Mainnet-Beta transaction flow are already deployed.

---

## 1. Product objective and implementation boundaries

WELP UP is intended to provide a non-custodial creator launch flow and token discovery/trading console. Creators configure a token's name, ticker, whole-token supply, decimals and supported quote asset. A shared, audited launchpad program creates the mint and enforces the sale lifecycle; creators do not upload arbitrary Rust programs or receive a new bespoke program deployment for each token.

The shared-program design matters: every token launch uses the same reviewed code. Therefore the on-chain security review belongs in the program's source/build/release pipeline. It is not meaningful to ask an AI to audit a different generated Anchor contract for every creator when no new contract is generated for each token.

### Existing repository facts

- The launch route is \`app/launchpad/page.tsx\`.
- The application uses Next.js App Router and React.
- Wallet/RPC integration uses \`@solana/kit\`, \`@solana/react\` and \`@solana/kit-plugin-wallet\`.
- The repository does not currently use \`@solana/wallet-adapter-react\` or \`@solana/web3.js\`.
- Global styling is hand-authored in \`app/globals.css\` and \`app/terminal.css\`; Tailwind is not a configured project dependency.
- The Anchor workspace currently contains \`programs/vault\`. A deployable launchpad crate and verified launchpad program ID still need to be created.
- The documented fee policy is configured in source, but on-chain collection remains disabled.
- The existing UI has no verified launch listings or production launch/purchase/refund/graduation actions.

Implementation must extend these structures. Do not create an unused \`src/pages\` app, import legacy wallet-adapter hooks, or add a Tailwind config merely to match an example path.

## 2. Creator-controlled token configuration

### 2.1 Supply is a per-launch creator choice

The maximum supply is not fixed at 200,000,000.

- Creator configuration range: **0 through 1,000,000,000 whole tokens**.
- A zero-supply configuration may be previewed, but it cannot initialize a tradable sale, accept purchases or graduate to a liquidity pool. The on-chain sale initializer must reject zero supply.
- Maximum accepted tradable supply: **1,000,000,000 whole tokens**.
- The creator submits an integer count of whole tokens.
- **200,000,000** is a valid example selected by a creator, not the platform default and not the platform ceiling.
- A value of zero is allowed in the configuration preview to match the creator-selected range, but it is non-launchable. The UI must explain this, and the on-chain sale initializer must independently reject zero supply.

The UI may display a zero starting point in a visual slider or empty state, but it must not permit a zero value to reach the initialization instruction.

### 2.2 Decimal precision

The creator may select any integer decimal precision from 0 through 9. The initial SPL Token Program release supports this numeric range; Token-2022 extensions remain disabled unless separately reviewed.

The supported launch presets are:

| Decimals | Meaning |
|---:|---|
| 0 | Indivisible whole-token units |
| 1–5 | The selected number of fractional decimal places |
| 6 | Six fractional decimal places |
| 7–8 | The selected number of fractional decimal places |
| 9 | Nine fractional decimal places |

The creator chooses one value. It is written into the mint at initialization and cannot be edited later.

### 2.3 Whole supply to raw mint units

All supply input is parsed as a decimal-free integer string. Do not parse token amounts through JavaScript \`number\`, \`f32\` or \`f64\`.

\`\`\`text
scale = 10 ^ decimals
max_supply_base_units = whole_supply * scale
early_wallet_cap_base_units = floor(max_supply_base_units * 500 / 10,000)
\`\`\`

For the maximum supported configuration (1,000,000,000 whole tokens with 9 decimals), raw supply is 1,000,000,000,000,000,000 units, which fits in an SPL Mint's \`u64\` supply field. The on-chain implementation must still use checked operations and reject any invalid value. Client-side validation is advisory; the program is authoritative.

Example only:

| Creator input | On-chain decimals | Raw mint supply | Early-window 5% cap |
|---:|---:|---:|---:|
| 200,000,000 whole tokens | 6 | 200,000,000,000,000 | 10,000,000,000,000 raw units (10,000,000 whole tokens) |

The example does not impose a global 200-million limit.

### 2.4 Token program and extensions

**Initial release target:** original SPL Token Program only. Token-2022 is not enabled merely because a token program interface exists.

Token-2022 may be added in a later, explicit compatibility phase. Each extension must be assessed for its effect on transfers, minting, freezing, transfer fees, hooks, permanent delegates, metadata, AMM compatibility and wallet display. Unsupported extensions and arbitrary token program IDs must be rejected.

### 2.5 Mint and supply authority

The launch program creates a new mint for each launch. The program-controlled launch authority initializes the mint with the creator-selected decimals, mints exactly the configured raw supply into the launch inventory vault, then permanently revokes the mint authority. The freeze authority must be absent or explicitly and permanently revoked; no hidden authority may remain able to freeze holders or alter token supply.

The state account records the mint, raw supply, whole-token supply, decimals and token program. The mint account is the authoritative supply record. The launch inventory vault is the source of tokens sold on the curve and later supplied to the pool.

Name, symbol and metadata URI are validated and written using the selected supported metadata standard. Metadata mutability and update authority must be disclosed before creation; the default production policy should make critical identity fields immutable once the mint is launched.

## 3. On-chain accounts and state machine

### 3.1 Launch state

Each mint has one deterministic launch state PDA. The state records at least:

- creator public key;
- token mint public key;
- quote asset identifier / mint;
- quote token program where applicable;
- whole-token max supply and raw max supply;
- decimals;
- allocated / sold token base units;
- quote asset raised in its raw base units;
- funding cap in quote base units;
- curve version and the immutable curve parameters used by the launch;
- sale end / expiry slot;
- initial slot and early-window end slot;
- early-window wallet cap in raw token units;
- launch status and any terminal outcome;
- escrow, token-vault and AMM pool references;
- bump values and version fields.

Seed conventions must be versioned and written into the IDL and SDK. Proposed deterministic seeds:

| Account | Seeds |
|---|---|
| Launch state | \`["launch-v1", mint]\` |
| Native SOL escrow | \`["sol-escrow-v1", launch_state]\` |
| Quote-token escrow | Associated Token Account for launch-state PDA and approved quote mint |
| Token inventory vault | Associated Token Account for launch-state PDA and launched mint |
| Buyer position | \`["position-v1", launch_state, buyer]\` |
| Global config | \`["launch-config-v1"]\` |
| Fee receipt | \`["fee-receipt-v1", operation_kind, operation_nonce]\` |

All seeds, bumps, owners, mints, token programs and authorities must be checked in every instruction. The program must not accept a creator-provided program ID as a substitute for a pinned program.

### 3.2 Status values and permitted transitions

The protocol uses the four requested states:

| Numeric value | State | Meaning |
|---:|---|---|
| 0 | \`Active\` | Purchases are permitted if all limits and deadlines pass. |
| 1 | \`Graduated\` | The funding condition is met; purchases and refunds are disabled; pool finalization is permitted. |
| 2 | \`Complete\` | Pool creation and required LP-token burn were completed and verified on-chain. |
| 3 | \`Refundable\` | The sale expired below its funding condition; original buyers may claim recorded refunds. |

Permitted transitions:

- \`Active -> Graduated\`: a buy reaches the funding condition or the sale allocation limit.
- \`Active -> Refundable\`: the expiry slot is reached without a successful graduation.
- \`Graduated -> Complete\`: the permissionless, pinned-AMM finalization CPI succeeds and the LP-token burn is verified.
- \`Complete\` and \`Refundable\` are terminal states. Refund claims do not reopen the sale.

The \`graduate_launch\` instruction is permissionless after graduation. This avoids relying on a privileged operator approval. A browser client, keeper or any user can submit the finalization transaction. If the Raydium CPI fails, Solana transaction atomicity must leave the launch in \`Graduated\` with the assets still in the launch vaults so finalization can be retried safely. No one may redirect the escrow or pool assets during retries.

### 3.3 Buyer positions

Each launch/buyer pair has one position PDA. It records the buyer's contribution, tokens allocated, early-window purchases and refund-claim state. The buyer is the signer and the position's immutable owner.

During the anti-snipe window, the canonical buyer ATA must be used for the launched mint and all purchases by that signer are accumulated in the same position. The program must not permit a buyer to create alternate token-account destinations to evade its per-wallet accounting.

## 4. Bonding curve and integer precision

### 4.1 Required curve inputs

The manifesto describes a linearly increasing bonding curve but does not specify a complete economic parameter set. A slope alone is insufficient to calculate a deterministic quote cost. Before the purchase instruction is enabled, the protocol must freeze a versioned formula and the exact launch parameters used by it. At minimum, the curve version must define:

- sale inventory in raw token units;
- initial price and terminal price in quote base units per whole token;
- funding cap in quote base units;
- the mapping between token supply, curve progress and quote contributions;
- the behavior when a purchase reaches either the funding cap or sale inventory limit.

These values must be stored in the launch account and shown before signing. They must not be silently supplied by an AI model or mutable backend setting. Do not ship an invented default curve simply to make a button work.

### 4.2 Linear marginal-price model

For a linear marginal price curve over sale inventory, define:

- \(S\): sale inventory in token base units;
- \(s\): token base units already allocated;
- \(\Delta\): proposed additional token base units;
- \(d\): token decimals;
- \(P_0\): initial quote base units per whole token;
- \(P_1\): terminal quote base units per whole token;
- \(Q(\Delta)\): quote base units required for the allocation.

The continuous integral to implement with deterministic integer rounding is:

\[
Q(\Delta)=\left\lceil
\frac{P_0\Delta+(P_1-P_0)\frac{2s\Delta+\Delta^2}{2S}}
{10^d}
\right\rceil
\]

The implementation must calculate the greatest allocation that costs no more than the user's supplied maximum quote amount, then enforce the caller's minimum token output. Use checked fixed-width arithmetic; use a reviewed wide-integer helper or proven bounded decomposition where intermediate products exceed \`u128\`. Overflow, underflow, division by zero and out-of-range curve states must fail the transaction.

The curve version, parameters, rounding method and boundary cases must be covered by unit/property tests. The final curve economics must be agreed before the program is enabled. No floating-point arithmetic belongs in the on-chain program.

### 4.3 Purchase safety

Each buy instruction must:

1. require the buyer's signature;
2. validate launch PDA, status, deadline and quote asset;
3. validate the mint, token program, escrow and canonical buyer ATA;
4. calculate allocation through the pinned curve version;
5. enforce maximum quote in and minimum tokens out;
6. enforce the early-window cumulative wallet cap;
7. enforce remaining sale inventory and funding cap;
8. calculate and collect the disclosed target protocol and creator/developer fee legs in the same transaction, using the current fee-policy source of truth;
9. transfer the exact quote amount into the escrow;
10. transfer the exact token allocation from inventory to the buyer;
11. update position and launch counters;
12. emit a versioned purchase event.

Any failed CPI or validation must roll back all updates and transfers. The program must not accept arbitrary CPI accounts or forward arbitrary remaining accounts.

### 4.4 Rounding policy

Use an explicit rounding direction for each leg. Token output is rounded down so a buyer never receives more than the curve math permits. Quote cost is rounded up to the smallest quote base unit so a buyer cannot underpay due to fractional arithmetic. The UI shows the exact quote maximum and token minimum. Any amount not charged remains with the buyer; it must not be silently retained as unexplained dust.

## 5. Early-window anti-snipe protection

At initialization, store the Solana clock slot and calculate the early-window end slot using a protocol-bounded configurable slot count (initial design example: 500 slots). The duration must be stored per launch and cannot be changed by the creator after launch begins.

The early-window wallet cap is calculated from that launch's own selected supply:

\[
\text{wallet cap raw units}=\left\lfloor
\frac{\text{max supply raw units}\times 500}{10,000}
\right\rfloor
\]

This is 5% of the creator's chosen supply. For a 200,000,000-token launch it is 10,000,000 whole tokens; for a 1,000,000,000-token launch it is 50,000,000 whole tokens (subject to decimals/base-unit conversion).

Every purchase during the early window increments the launch-scoped buyer position. Splitting a purchase across transactions does not reset the counter. Transferring tokens to another token account does not reduce the recorded purchase amount. A signer must use the canonical ATA for that mint.

**Honest limitation:** a wallet-based cap cannot identify one person controlling several independent wallets. It is an on-chain per-wallet concentration limit, not proof of bot identity and not a complete Sybil/MEV defense. Do not market it as preventing every sniper or multi-wallet attack.

If the 5% cap floors to zero raw units (possible for very small zero-decimal supplies), no early-window purchase is valid. Do not round the cap upward beyond 5%. Boundary slot tests must cover the exact start and end slot.

## 6. Quote assets, escrow and refunds

### 6.1 Quote asset allowlist

The state stores the quote mint / asset selected for the launch. The program must not accept arbitrary mints.

Initial candidate allowlist:

- native SOL, held in a launch-specific SOL escrow PDA and wrapped to WSOL for CPMM liquidity initialization;
- canonical mainnet USDC, held in an associated token account owned by the launch PDA.

Synthetic equity, stock, commodity, basket and other custom quote assets require a separate mint allowlist, issuer/asset verification, price-source policy, extension compatibility and AMM review. They are not enabled by passing any arbitrary mint address.

SOL and USDC amounts are measured in their raw base units. USD market-cap display requires a separate, timestamped price source; it cannot be inferred from a token/quote ratio unless the quote asset is itself USD-denominated and validated.

### 6.2 Escrow model

Native SOL contributions move into the launch-specific escrow PDA through the System Program. USDC contributions move into the quote-token ATA owned by the launch-state PDA through the canonical SPL Token Program. The token inventory is held in the launch-state-controlled ATA for the created mint.

Escrow balance must reconcile with the on-chain contribution counter, subject to documented rent and explicitly accounted fees. Funds are not withdrawable by a creator or operator. There is no admin sweep instruction.

### 6.3 Refund path

A launch may become \`Refundable\` only after its expiry slot is reached without meeting the funding target. Each original buyer can claim exactly their recorded net contribution once. A refund instruction must verify the buyer signer, launch state, buyer position, escrow solvency and unclaimed amount, then mark the receipt/position as claimed atomically with the transfer.

A refunded position cannot be replayed, transferred to a different claimant or claimed twice. Refund claims are not allowed from \`Active\`, \`Graduated\` or \`Complete\` launches.

## 7. Raydium CPMM graduation and LP handling

### 7.1 Pinned AMM adapter

Graduation uses a dedicated adapter for the selected Raydium Constant Product AMM (CPMM) program. The integration must be based on the official Raydium source/IDL, pinned to a reviewed release/commit and an independently verified Mainnet-Beta program ID.

Raydium CPMM pool initialization requires a defined account set including the AMM configuration, authority, pool state, ordered token mints, LP mint, creator input token accounts, creator LP token account, pool vaults, pool-creation fee destination, observation state, token programs, associated-token program, system program and rent. Every account must be derived or checked against the pinned implementation. Do not pass arbitrary remaining accounts.

For native SOL, the program first wraps the exact escrow amount into WSOL and calls SyncNative. The token and quote sides are deposited from launch-controlled accounts. Token mint ordering must follow the AMM's required public-key ordering. The program verifies the resulting pool address, LP mint, vaults and deposit amounts before completing the state transition.

Raydium's official CPMM repository and initialization source are the reference implementation:
- https://github.com/raydium-io/raydium-cp-swap
- https://github.com/raydium-io/raydium-cp-swap/blob/master/programs/cp-swap/src/instructions/initialize.rs

### 7.2 Atomic finalization

The finalization instruction is permissionless once the state is \`Graduated\`. It must validate the exact pinned AMM program ID and all pool accounts, invoke pool initialization, verify the pool/LP mint outputs, burn the LP tokens, emit the pool/burn events and only then set the launch to \`Complete\`.

All steps occur in a single Solana transaction. If any step fails, the entire transaction rolls back and the state stays \`Graduated\`; no partially initialized or unaccounted pool may be reported as complete.

### 7.3 LP tokens must be burned, not sent to the System Program address

The proposed instruction to send LP tokens to \`11111111111111111111111111111111\` is not a token burn. LP tokens are SPL tokens. The correct irreversible operation is the Token Program's \`BurnChecked\` (or reviewed Token-2022 equivalent) against the verified LP mint and a token account owned by the launch PDA, signed by that PDA through \`invoke_signed\`. The LP mint's supply must decrease by the exact amount burned.

Official reference: https://solana.com/docs/tokens/basics/burn-tokens

The burn amount, LP mint, source account and authority are validated. The burn is irreversible and must be clearly disclosed to the creator before launch. Burning initial LP tokens removes the redemption claim represented by those tokens; it does not guarantee that all future liquidity, token trading or market prices will remain safe forever.

## 8. WELP protocol swap fee

The target fee math is **1.00% (100 bps) protocol + 0.50% (50 bps) creator/developer** of gross input. It is not active fee collection and is not a fixed USDC charge. The two legs must not be described as live until an actual signed transaction and balance changes prove them.

The intended settlement sends the 1.00% protocol leg to the treasury and the 0.50% creator/developer leg to its disclosed recipient. After at least 14 days, the treasury epoch releases 60% of eligible protocol inflows and retains 40% as reserve. These separate allocations are arithmetic policy only until the same transaction and treasury program enforce them.

Calculate the fee from the input asset's raw base units using checked integer arithmetic. A successful swap and treasury credit must commit atomically. If any leg fails, the entire transaction must roll back. Each operation requires a unique receipt/nonce to prevent duplicate collection.

The current treasury vault is a SOL System Program PDA. It is not a generic SPL-token vault. SPL-token input assets require per-mint treasury token accounts and token-program CPI settlement, which are not yet implemented. The existing epoch-distribution code tracks SOL lamports only.

WELP cannot intercept ordinary wallet-to-wallet SPL transfers or swaps routed directly to another DEX. A fee applies only to WELP-controlled instructions. Post-graduation Raydium swaps cannot be described as taxed by WELP unless a reviewed adapter or other supported on-chain mechanism actually receives and routes the fee.

**Current status:** the app offers user-approved Jupiter v2 swaps. The separate Jupiter referral rail is optional and pays its partner wallet; it is not the 1.00% + 0.50% settlement above. The launch/treasury program is not executable on mainnet, its fee/PDA state is not active, and no epoch payout is occurring. See [current fee and treasury status](FEES_AND_TREASURY.md).

## 9. Frontend and transaction service

### 9.1 Existing stack

Implement in the App Router and existing Solana Kit architecture. Do not mix \`@solana/web3.js\` and Solana Kit object types within the same transaction service without a documented, tested boundary. Do not add \`@solana/wallet-adapter-react\`.

The frontend service should expose typed functions for:
- validating creator configuration;
- deriving all launch-related PDAs;
- reading launch state and account balances;
- creating a mint/launch transaction;
- building buy/refund/finalize instructions;
- estimating bounded compute-unit price/limit;
- inserting idempotent ATA creation instructions where needed;
- verifying transaction message contents before the connected wallet signs;
- submitting signed bytes and tracking confirmed/finalized results.

The connected wallet signs locally. No private key, recovery phrase, exported wallet data or wallet JSON may be sent to an API route.

### 9.2 Wallet signing UX

Before signing, show:
- network and program ID;
- token name, ticker, whole supply, raw supply and decimals;
- quote asset and contribution;
- estimated token output and minimum output;
- WELP fee and exact 60/40 recipients;
- network/priority fee estimate and account rent;
- escrow and token vault addresses;
- irreversible mint-authority/freeze-authority settings;
- for graduation, Raydium program, pool address, assets deposited and LP token burn amount.

A submission is not a confirmed transaction. The UI shows distinct states for prepared, wallet rejected, submitted, confirmed, finalized and failed. Only data fetched from the selected RPC and reconciled against transaction status can be described as confirmed/finalized.

### 9.3 Helius and API key boundary

The Helius API key and credential-bearing RPC URL must never use \`NEXT_PUBLIC_*\` names. A browser bundle is public.

- Browser clients may use an explicitly public, rate-limited RPC endpoint for public reads and WebSocket subscriptions.
- Authenticated Helius APIs, priority-fee estimation and provider credentials remain server-side behind narrow Next.js route handlers.
- Use the existing App Router convention: \`app/api/<route>/route.ts\`, not \`src/pages/api\`.
- Server routes validate schemas, size limits, allowed methods and upstream hostnames; they apply rate limits, timeouts, bounded retries with jitter and safe error responses.
- Do not proxy arbitrary JSON-RPC method names, arbitrary URLs or arbitrary account data through an unrestricted endpoint.
- Provider credentials belong in the hosting provider's encrypted environment store and must be rotated if exposure is suspected.

### 9.4 Client-side indexing is not literally free

The app may perform per-browser log subscriptions and decoding without operating a centralized database. This lowers backend/indexer requirements, but it does not create unlimited or zero-cost capacity: RPC requests, WebSocket subscriptions, bandwidth, compute, hosting and provider plans have quotas and possible fees. Thousands of simultaneous viewers cannot be promised without load testing and provider capacity evidence.

For the no-database path:
- subscribe to the launch program address using a WebSocket logs filter;
- note that Solana \`logsSubscribe\` currently allows only one address in a \`mentions\` filter per subscription;
- parse Anchor event records using the matching, versioned IDL and event discriminators (do not guess a Base58/Base64 format from arbitrary log lines);
- verify each event's signature and status via confirmed/finalized transaction data;
- reconnect with bounded backoff, then backfill missed signatures through paginated historical RPC queries;
- cache bounded history in IndexedDB; use local storage for small preferences only;
- handle duplicate events, missing transactions, reverted/failed signatures, ordering and slot reorg/reconciliation rules;
- clean up listeners on navigation/unmount and avoid duplicate subscriptions.

Official WebSocket reference: https://solana.com/docs/rpc/websocket/logssubscribe

### 9.5 Event and chart pipeline

The program emits versioned events for launch creation, purchase, refund, graduation, pool creation, LP-token burn and fee settlement. Events include the launch/mint, signer, quote amount, token amount, slot/time context and nonce/receipt identifiers.

The client validates the transaction before translating it into a trade tick. A chart price is derived from the actual quote and token deltas with decimals handled exactly. USD valuation requires an explicit quote-asset price source with timestamp and staleness checks.

Use TradingView Lightweight Charts or another reviewed client-side chart library only after adding and locking the real dependency. Do not draw candles from placeholder or synthesized volume. Aggregate trades into OHLC candles by selected interval, persist bounded cache in IndexedDB, and backfill history from verified signatures when possible. Missing history must remain visibly missing rather than becoming fabricated candles.

## 10. AI and dynamic API boundaries

### 10.1 Security review pipeline

AI may assist reviewers by identifying suspicious patterns, summarizing test failures and proposing additional adversarial test cases. AI output is not a formal audit, a deterministic vulnerability proof or an authorization to deploy funds.

Do not make a model-generated score of 90/100 an authoritative pass gate. Models can miss critical defects, hallucinate findings or change output between calls. Mainnet promotion instead requires deterministic gates:
- formatting, lint and strict type checks;
- Anchor build and reproducible program artifact checks;
- Rust unit/property/fuzz tests;
- SBF/ProgramTest and adversarial account-composition tests;
- dependency, license, secret and supply-chain scans;
- IDL and account-layout compatibility checks;
- independent human security audit and documented remediation;
- verified program ID, upgrade authority and deployment artifact.

AI reports are advisory evidence attached to a commit and reviewed by humans. A failing deterministic test or unresolved critical/high audit finding blocks release regardless of an AI score.

### 10.2 Creator input moderation

Because all launches use the same shared launch program, there is no per-token custom contract source to audit. An optional metadata safety review may assess name, symbol, URI and linked content. It is advisory/moderation data only and cannot bypass on-chain ownership, mint, fee or state checks.

### 10.3 Dynamic metrics API

Do not let an AI router generate arbitrary SQL, database DDL, table names, outbound URLs or unrestricted schemas at runtime. Define a small allowlist of supported metrics, query templates, input schemas and response types. Unknown metrics return a typed unsupported response. Add rate limits, request size caps and safe caching.

## 11. User interface specification

### 11.1 Visual language

The launchpad view uses a deep-space charcoal canvas (#09090B), understated zinc/charcoal surfaces and emerald accents. The target style is open and spacious, using visual grouping rather than nested boxed grids.

- Use translucent glass surfaces with a faint zinc tint, backdrop blur and subtle edges.
- Remove redundant outlines, nested borders and unnecessary table/grid rules.
- Keep large on-chain metrics visually prominent.
- Render mint/creator/program/account addresses in readable monospaced text with copy/truncate affordances.
- Use responsive one-column mobile layout and spacious desktop columns.
- Empty discovery views remain honest and do not invent example tokens, price, volume, progress, holders or transactions.

The visual reference is StonkFun's minimal launch/discovery structure, not a pixel-for-pixel copy: https://stonkfun.xyz/

### 11.2 Cool-green CTA

Primary actions use pill-shaped controls, a restrained zinc/slate gradient, subtle emerald outline and a small green outer glow. Hover expands the glow and scales slightly. Disabled or unavailable actions must look disabled and explain why; the green glow must not imply an operation is executable when the program is not deployed.

Reusable styles are implemented in the project's CSS. Do not introduce Tailwind solely to create a Tailwind config when the repository has no Tailwind dependency.

### 11.3 Creator flow

The creator form collects:
- name and ticker;
- whole-token supply from 0 through 1,000,000,000 (zero is preview-only; a tradable launch requires positive supply);
- decimals selector 0 / 6 / 9;
- supported quote asset and the finalized curve parameters when the program economics are frozen;
- required metadata URI and disclosed metadata mutability.

The UI calculates raw supply and the launch-specific 5% wallet cap using integer arithmetic. It shows the supply example as an example only. Until the reviewed program is deployed, creation, buying, refunds and graduation remain disabled and clearly labelled unavailable.

### 11.4 Discovery and token details

Discovery search/filter categories may include quote asset, newest, market cap and recent volume only when there is verified backing data. Each token page includes verified mint/program/creator addresses, token decimals/supply, curve parameters, quote asset, raised amount, allocation, funding progress, expiry slot, status, transaction links, pool ID and LP burn transaction. Unavailable fields are omitted or labelled unavailable.

## 12. Test plan and release gates

### Rust and math

- Supply bounds at 1, 200,000,000 and 1,000,000,000 whole tokens.
- Decimal conversion for 0, 6 and 9; raw supply and u64 boundary.
- Rejection of zero, negative, fractional, scientific-notation and above-limit input.
- Curve math property tests, rounding boundaries, extreme values, overflow, underflow and division-by-zero.
- Exact 5% cap for every decimals preset, zero-base-unit edge case, start/end slots, repeated/split orders, alternate token account attempts and position PDA substitution.
- Funding cap, inventory exhaustion, state transitions, refunds and duplicate claims.

### Anchor/SBF integration

- Mint initialization, metadata, mint-to-vault and permanent authority revocation.
- PDA seeds, bump, account owner, mint, canonical ATA and token program substitutions.
- SOL escrow and WSOL sync, USDC quote-token vault, insufficient funds and exact rollback.
- Fee recipient/treasury validation, exact 60/40 values, duplicate receipt and atomic failure.
- Raydium CPMM account validation, pool creation, LP mint/account checks and BurnChecked of the exact LP amount.
- Failed CPMM CPI rollback; permissionless retry from \`Graduated\`.
- Reentrancy-like composed instruction sequences, duplicate nonce and writable/signer escalation.

### Client, indexing and UI

- PDA derivation parity with the IDL.
- BigInt supply/fee/curve math and exact display.
- Transaction instruction order, ATA idempotency, compute limits and priority-fee clamping.
- Wallet rejection, expired blockhash, RPC timeout/429, retry jitter and status transitions.
- WebSocket duplicate, reconnect, missing event, invalid discriminator, finalized backfill and history-cache tests.
- Responsive view, accessibility, keyboard flow and disabled-program states.

### Release promotion

1. Complete source formatting, host unit tests, dependency checks and reproducible Anchor/SBF builds.
2. Complete a full independent Solana/Anchor security review and remediate every critical/high finding.
3. Generate and secure a production deployment keypair outside the app; never commit its secret key.
4. Deploy only to Solana Mainnet-Beta after review and explicit release approval.
5. Verify the deployed binary, IDL, program ID, token mint and authority state directly from mainnet.
6. Verify treasury vaults, fee accounting, AMM config/program IDs and LP-token burn against deployed accounts and confirmed transactions.
7. Review upgrade authority, multisig/custody policy, monitoring, incident response, pause/recovery and communication plan.
8. Keep trading/deposits disabled until every mainnet verification and user-consent gate is complete. No documentation PR, issue closure or CI automation may silently enable trading or deposits.

---

## 13. External technical references

- Solana token basics and mint/token-account model: https://solana.com/docs/tokens/basics
- Solana token authority management: https://solana.com/docs/tokens/basics/set-authority
- Solana token burns / BurnChecked: https://solana.com/docs/tokens/basics/burn-tokens
- Solana logsSubscribe: https://solana.com/docs/rpc/websocket/logssubscribe
- Raydium CPMM source: https://github.com/raydium-io/raydium-cp-swap
- Raydium CPMM initialization account context: https://github.com/raydium-io/raydium-cp-swap/blob/master/programs/cp-swap/src/instructions/initialize.rs
- Next.js App Router route handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Visual reference: https://stonkfun.xyz/


## 14. Treasury epochs and protocol swap fee

The implementation status and fee waterfall are documented in [TREASURY_AND_CREATOR_FEES.md](./TREASURY_AND_CREATOR_FEES.md).

WELP's target fee calculation is 100 basis points (1.00%) for the protocol and 50 basis points (0.50%) for the creator/developer. The protocol allocation is intended for the input asset's treasury vault in the same transaction as the swap. After a minimum 14-day epoch, 60% of eligible protocol inflows is released to the published developer recipient and 40% remains as protected treasury reserve. This is not implemented on mainnet.

The configured launch/treasury program address is non-executable on mainnet. Generic SPL-token input vaults, swap instructions, fee receipts and live treasury fee transfers are not implemented. The Rust fee helper is math only and does not collect funds. Jupiter swaps remain available with no WELP fee if referral collection is unconfigured; configured orders now fail closed if the exact referral fee account is missing.

### 14.2 Treasury distribution

The global Treasury PDA stores the fixed developer wallet, accumulated fee counters, remainder, rent-protected balance, locked reserve and last distribution timestamp.

- Initialization stores the Solana Clock timestamp.
- A harvest requires at least 1,209,600 seconds since the last successful harvest.
- 60% of newly undistributed treasury inflows is sent to the hardcoded developer wallet.
- 40% of those new inflows is added to a separate \`locked_reserve_lamports\` counter and is excluded from all subsequent distributions.
- The account's rent floor is never treated as revenue.
- There is no treasury reserve withdrawal instruction.

This "permanent" reserve is only as immutable as the deployed program. An unrestricted program upgrade authority could replace the logic; Mainnet release must remove upgrade authority or disclose a multisig-governed upgrade process.

The local crate now contains \`initialize_treasury\` and \`disburse_treasury_funds\`. The crate is not deployed, has not been audited and must not receive Mainnet funds. The fee helper is not yet connected to atomic transfers or a launch buy/sell route.

### 14.3 External Raydium fee boundaries

Raydium CPMM has separate trade-fee and creator-fee buckets. The creator-fee rate comes from `AmmConfig.creator_fee_rate` and is shared by pools using that config, while each pool stores an enable flag and fee side. A `CreatorFeeShare` PDA can override the creator's share rate for a specific creator/config pair; that split is applied at collection and the shared amount is moved to Raydium's protocol-fee bucket. That bucket is not the WELP Treasury PDA. See [Raydium CPMM fees](https://github.com/raydium-io/raydium-docs-v1/blob/main/products/cpmm/fees.mdx) and [creator-fee flow](https://github.com/raydium-io/raydium-docs-v1/blob/main/user-flows/how-creator-fees-work.mdx).

WELP must not claim that its own instructions intercept post-graduation Raydium swaps. Raydium's native creator-fee mechanism is independent of the WELP target 1.00% protocol + 0.50% creator allocation and does not automatically credit the WELP treasury. No WELP creator-fee slider or post-graduation fee route is enabled. Do not advertise or configure any external fee unless its actual destination and collection path are verified.

## 15. Graduation economics — fixed target mismatch

The requested constants are interpreted as **25 to 187.5 lamports per whole token**, not per raw base unit. The average price of a linear curve with these endpoints is 106.25 lamports per whole token.

With 80% of the selected supply allocated to the public sale, maximum curve proceeds at these endpoints are approximately:

| Total supply | Public sale allocation | Maximum proceeds |
|---:|---:|---:|
| 1,000,000,000 | 800,000,000 | 85 SOL |
| 200,000,000 | 160,000,000 | 17 SOL |
| 100,000,000 | 80,000,000 | 8.5 SOL |

Therefore the fixed 85 SOL graduation milestone cannot be reached by smaller-supply launches at the stated curve endpoints, even if the entire 80% public allocation sells. The 85 SOL target and fixed prices must not be implemented together without a defined policy for smaller supplies.

Choose and freeze one of:
1. scale initial/terminal prices inversely with chosen supply so the curve reaches 85 SOL;
2. scale the funding cap proportionally to chosen supply while preserving the fixed price endpoints;
3. keep 85 SOL and explicitly make smaller launches refundable/non-graduating if the target cannot be reached.

The implementation branch leaves this decision unresolved and the sale action disabled.

## 16. Bundled creator initial purchase

The proposed initial buy is 0.02% of the selected total supply (2 basis points of supply). It must be an ordinary creator-signed purchase instruction placed after create/initialize in the same transaction. It must:
- calculate the exact token amount in raw units;
- calculate the quote cost using the same curve and target 1.00% protocol + 0.50% creator-fee logic as any other buyer;
- count against the creator's 5% early-window per-wallet allocation;
- be visible with its amount, fees, destinations and expected output before signing;
- be optional or explicitly confirmed by the creator (never hidden);
- roll back the entire create if it fails and the creator chose an atomic bundle.

It is not an administrative mint-to-creator shortcut and does not guarantee protection from bots or other wallets.
