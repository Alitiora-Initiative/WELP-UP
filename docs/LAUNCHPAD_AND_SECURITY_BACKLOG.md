# Launchpad implementation backlog — custom supply, bonding curve and security

**Status: design + implementation backlog. Not deployed.** The launch program, purchases, refunds, Raydium graduation CPI, LP burning and launch fee settlement must remain disabled until their release gates pass.

This backlog replaces the earlier incorrect fixed-supply wording. **200,000,000 is an example creator choice, not a global supply limit.**

## 0.1 Progress in the custom-supply implementation branch

The following configuration-only slice is now implemented on \`feature/launchpad-custom-supply-spec\`:

- \`lib/launchpad-config.ts\`: BigInt-only validation for 1..1,000,000,000 whole tokens; decimals 0/6/9; raw mint-unit conversion; u64 bounds; dynamic 5% cap; exact base-unit formatting.
- \`components/LaunchpadCreatorStudio.tsx\`: creator input/precision preview, dynamic 5% wallet-cap display and explicit disabled state.
- \`app/launchpad/page.tsx\` + \`app/launchpad/launchpad.css\`: responsive creator/discovery layout and restrained glass / emerald pill styling.
- \`tests/launchpad-config.test.mjs\`: boundary tests for 200m as an example, the 1b maximum, decimal choices, zero/invalid input and exact integer formatting.

This is **not** the on-chain launch implementation. The creator UI is a configuration preview only. The following remain unimplemented and must not be represented as live: mint initialization, supply minting/authority revocation, sale curve, quote escrow, buys, refunds, anti-snipe program enforcement, fee transfer, Raydium CPMM CPI, LP burn, live event indexing or transaction execution. The launch action remains disabled. CI results for the pull request must be inspected before this slice is considered validated.


## 1. Product contract and supply rules

- [ ] The creator configuration range is **0 through 1,000,000,000** whole tokens inclusive. Zero may be previewed but cannot become a tradable sale; the on-chain sale initializer rejects zero supply.
- [ ] Treat 200,000,000 as one valid example only. Never use it as the UI default, global maximum, hardcoded program constant or shared anti-snipe quantity.
- [ ] Support every decimals value from 0 through 9. Decimals are written into the mint during creation and immutable thereafter.
- [ ] Parse the whole supply as an integer string; do not use JavaScript number/floating-point conversions.
- [ ] Calculate \`raw_supply = whole_supply * 10^decimals\` with checked on-chain arithmetic and ensure it fits the SPL mint's u64 supply.
- [ ] Calculate the early-window wallet cap dynamically as floor(raw supply × 500 / 10,000). It is 5% of each launch's configured supply.
- [ ] If the exact 5% cap is below one indivisible base unit, early-window purchases must fail; do not round the cap up above 5%.
- [ ] Display the configured whole supply, raw base units, decimals and launch-specific anti-snipe limit before signing.
- [ ] Initial token standard is original SPL Token Program. Do not imply Token-2022 support until every allowed extension is specifically implemented and tested.

Detailed reference: [LAUNCHPAD_PROTOCOL_SPEC.md](./LAUNCHPAD_PROTOCOL_SPEC.md).

## 2. Launchpad program and token mint

**Target:** create \`programs/launchpad/src/lib.rs\` and its unit/integration tests. Integrate it into \`Anchor.toml\` only after the crate builds and tests. Do not reuse the vault program's placeholder deployment ID.

- [ ] Create a deployment-specific program ID and versioned launch state PDA, SOL escrow PDA, token inventory ATA and buyer position PDA.
- [ ] Initialize a new mint for each creator launch with the selected decimals.
- [ ] Mint exactly the creator-selected raw supply into the program-controlled inventory vault.
- [ ] Permanently revoke mint authority after full supply is minted; ensure no freeze authority remains.
- [ ] Store name, symbol and metadata URI using the chosen token metadata standard; validate lengths/URI and disclose metadata mutability.
- [ ] State must record creator, mint, quote asset, whole supply, raw supply, decimals, allocated units, raised quote units, funding cap, curve version/parameters, start slot, early-window end slot, expiry, status, pool references and bumps.
- [ ] Reject zero supply at tradable-sale initialization, supply above 1,000,000,000 whole tokens, decimals outside 0–9, raw-supply overflow, incorrect mint owner and token-program substitution.
- [ ] All balance/state-modifying instructions require the correct signer and owner-checked PDA accounts.

## 3. Bonding curve and purchases

- [ ] Freeze an exact, versioned curve formula before enabling buys. The specified curve now proposes 25 to 187.5 lamports per whole token and an 80/20 supply allocation, but these values do not permit every supply to reach a fixed 85 SOL milestone. Resolve this mismatch in `docs/TREASURY_AND_CREATOR_FEES.md` before coding the funding rule. Do not invent curve defaults.
- [ ] Store all curve parameters on-chain and expose them in the UI; they cannot be overridden by the backend or an AI model.
- [ ] Use deterministic integer math and checked arithmetic. Use a reviewed wide-integer helper or a proven bounded decomposition for products beyond u128.
- [ ] Implement a bounded quote-in / token-out calculation with caller-provided maximum quote in and minimum token output.
- [ ] Round token output down and quote cost up to avoid over-allocating inventory or accepting underpayment; return unused quote to the buyer rather than silently keeping dust.
- [ ] Enforce remaining sale inventory and funding cap in the same instruction as transfers and state updates.
- [ ] Create buyer ATAs idempotently when necessary and validate the canonical mint, token program, token-account authority and ATA derivation.
- [ ] Emit versioned launch-created and purchase events with raw units, quote units, slot/time and nonce.

## 4. Anti-snipe and buyer accounting

- [ ] Record launch start slot and a protocol-bounded early-window end slot (initial design example: 500 slots).
- [ ] Calculate 5% from the per-launch max supply in raw base units.
- [ ] Maintain one position PDA per launch/buyer. Increment cumulative early-window purchases across transactions.
- [ ] Require canonical buyer ATA and do not lower purchase accounting when tokens are transferred elsewhere.
- [ ] Emit a specific custom anti-snipe error and test exact start/end boundaries, 5% boundary, split purchases and alternate token-account attempts.
- [ ] Document the limit accurately: it is per wallet. It cannot prove one person controls a wallet or prevent a Sybil buyer from using multiple independent wallets.

## 5. Quote assets, escrow and refunds

- [ ] Store the quote asset in the launch state and enforce a strict on-chain allowlist. Never accept an arbitrary user-supplied quote mint.
- [ ] Initial quote candidates: native SOL and canonical Mainnet-Beta USDC. USDC uses the mint already recorded in the fee policy.
- [ ] For SOL, deposit lamports into a launch-specific PDA; wrap the exact amount to WSOL and SyncNative for Raydium CPMM initialization.
- [ ] For USDC, transfer quote units to the launch-state-owned USDC ATA using the canonical Token Program.
- [ ] Synthetic stocks/commodities/baskets require separate issuer/mint allowlisting, metadata verification, oracle/price-source policy and AMM-compatibility review; they are not enabled by arbitrary mint input.
- [ ] Implement \`Active -> Refundable\` only after expiry below the funding goal.
- [ ] Permit each original buyer to claim only the recorded contribution once; prevent duplicate claims, claimant substitution and escrow insolvency.
- [ ] No creator/operator sweep or admin withdrawal path from buyer escrow.

## 6. Lifecycle and Raydium CPMM

- [ ] Use status values: Active (0), Graduated (1), Complete (2), Refundable (3).
- [ ] On funding/sale condition, transition Active -> Graduated and disable buys/refunds.
- [ ] Make \`graduate_launch\` permissionless after graduation. The finalizer is not controlled by a privileged creator/admin.
- [ ] Pin Raydium CPMM's official source/IDL and independently verify the exact Mainnet-Beta program ID and configuration before coding the CPI.
- [ ] Validate the AMM config, authority, pool state, ordered mints, LP mint, launch-controlled input token accounts, pool vaults, pool fee destination, observation state, token programs, associated-token program, system program and rent.
- [ ] Do not forward arbitrary remaining accounts or accept a caller-selected AMM program ID.
- [ ] Wrap native SOL to WSOL when required; deposit the exact quote and token amounts from launch-controlled accounts.
- [ ] Verify pool state, pool vaults, LP mint and deposited amounts before setting status Complete.
- [ ] Burn the received LP tokens with the SPL Token Program's BurnChecked instruction from the launch-PDA-owned LP token account, signed by the launch PDA.
- [ ] Do **not** send LP tokens to \`11111111111111111111111111111111\`. That is not a token burn. Verify the LP mint supply decreases by the burned amount.
- [ ] Complete pool initialization, LP burn, events and state transition atomically. A failed CPI must leave the launch Graduated and retryable with assets still accounted.
- [ ] Document that burning the initial LP tokens does not guarantee all future liquidity, market prices or trading activity remain safe forever.

Official sources:
- https://github.com/raydium-io/raydium-cp-swap
- https://github.com/raydium-io/raydium-cp-swap/blob/master/programs/cp-swap/src/instructions/initialize.rs
- https://solana.com/docs/tokens/basics/burn-tokens

## 7. WELP protocol swap-fee settlement

Source of truth: docs/FEES_AND_TREASURY.md. Target fee is **0.50% of gross input** on each WELP-controlled swap.

At collection, 100% of the protocol fee is credited to treasury. After at least 14 days, 60% of eligible new SOL inflows is released to the developer/operator receiving wallet and 40% is added to the protected reserve. The split must occur once at epoch maturity, never twice.

- [ ] Enforce 50 basis points of gross input in the on-chain buy/sell/swap instruction, with checked integer math and explicit rounding.
- [ ] Credit 100% of the fee into the correct input-asset treasury vault in the same atomic transaction as the swap.
- [ ] Implement per-mint treasury token accounts and token CPI settlement before accepting SPL-token input routes; the current treasury vault holds SOL only.
- [ ] Prevent duplicate fee collection with a unique operation receipt, and emit an event containing payer, mint, gross input, fee amount and slot.
- [ ] Show the exact 0.50% fee and the 14-day 60/40 treasury waterfall before wallet signing.
- [ ] Do not imply that WELP taxes arbitrary SPL transfers or swaps that bypass WELP.
- [ ] Keep swap endpoints fail-closed until composable transaction building, deployed program verification and SBF-backed adversarial tests pass.

The prior fixed $0.10/$0.50 USDC charge schedule and creator-configurable 0–3% fee design are superseded and must not remain in frontend or on-chain code.

## 8. TypeScript service and transaction assembly

**Current stack:** Next.js App Router, \`@solana/kit\`, \`@solana/react\`, \`@solana/kit-plugin-wallet\`.

- [ ] Implement \`lib/launchpad-service.ts\` using the existing Kit wallet stack; do not import \`@solana/wallet-adapter-react\`.
- [ ] Keep transaction messages, addresses, raw amount types and signatures type-safe; use bigint for supply, token amounts and fee math.
- [ ] Derive launch, escrow, position, inventory, quote and fee receipt PDAs using the program ID and documented seeds.
- [ ] Compose ATA creation, launch instruction, protocol fee and bounded Compute Budget instructions in the correct order.
- [ ] Clamp server-provided priority fees and compute-unit limits.
- [ ] Verify program ID, all accounts, token mints, quote amount, min output, fee destinations and blockhash before prompting the user to sign.
- [ ] Distinguish prepared, rejected, submitted, confirmed, finalized and failed transaction statuses.

## 9. RPC, client-side indexing and resilience

- [ ] Keep Helius keys and credential-bearing RPC URLs server-only. Never commit keys or expose them through NEXT_PUBLIC variables.
- [ ] Use public browser RPC subscriptions only when the endpoint is intended for public access and configured for the expected load.
- [ ] Create narrow Next.js App Router handlers under \`app/api/**/route.ts\` for privileged fee/provider calls, not \`src/pages/api\`.
- [ ] Validate schemas, method allowlists, upstream host allowlists, request sizes, origin/CSRF where relevant, and rate limits.
- [ ] Add bounded retries with jitter for transient failures, explicit timeouts, circuit breakers and verified fallback endpoints.
- [ ] Client-side WebSocket indexing may avoid a persistent database, but it is not unlimited or guaranteed zero-cost. Load-test RPC quotas, subscriptions, bandwidth and browser resource usage.
- [ ] Use \`logsSubscribe\` with a single address per mentions filter; decode versioned Anchor event records against the matching IDL.
- [ ] Confirm transaction signatures and reconcile finalized data; backfill missing events through paginated history queries after reconnect.
- [ ] Deduplicate events, cache bounded history in IndexedDB and clean up subscriptions on navigation.
- [ ] Do not fabricate market cap, USD price, volume or candles without verified token/quote deltas and a valid price source.

Official references:
- https://solana.com/docs/rpc/websocket/logssubscribe
- https://nextjs.org/docs/app/getting-started/route-handlers

## 10. UI/UX and creator experience

- [ ] Refactor the Launchpad route to an open, spacious deep-space layout inspired by the information hierarchy of stonkfun.xyz, not a copy of its branding.
- [ ] Use #09090B canvas, faint zinc glass panels, subtle borders/backdrop blur and natural spacing; remove nested box/grid clutter.
- [ ] Use prominent metrics, monospaced addresses and technical metadata.
- [ ] Use pill-shaped zinc-gradient primary controls with subtle emerald outline/glow and stronger hover glow. Disabled controls must remain visibly disabled.
- [ ] Mobile is a one-column flow; desktop expands into spacious columns.
- [ ] Creator form supports name, ticker, custom whole supply 1..1B, decimals 0/6/9, quote asset and finalized curve configuration.
- [ ] Display dynamic 5% cap, raw supply and fee disclosure before signing.
- [ ] Discovery only shows real, confirmed launches; no mock tokens, fake volume, generated prices or simulated transaction data.
- [ ] Use existing CSS architecture. There is no Tailwind dependency/config or \`src/styles/globals.css\` in the current project.

## 11. AI security and micro-API scope

- [ ] Run deterministic CI gates against the shared launch program source/build: Anchor/SBF build, tests, fuzz/property tests, static analysis, dependency/secret scans and reproducible artifacts.
- [ ] AI may summarize findings and suggest tests. It must not issue a "verified" security certificate or pass Mainnet deployment solely because a model score exceeds 90.
- [ ] The same audited launch program handles all token launches; there is no per-creator custom Anchor source file to submit for runtime AI approval.
- [ ] If metadata moderation is added, treat model output as advisory; on-chain account validation remains authoritative.
- [ ] Replace arbitrary AI-generated database schemas/SQL with an allowlisted metric API, validated parameters and fixed query templates.

## 12. Validation, audit and release gates

- [ ] Rust unit/property/fuzz tests for custom supply, decimals, curve math, anti-snipe, fees, state transitions, refund claims and overflow edges.
- [ ] Anchor/SBF ProgramTest for creation, mint authority revocation, SOL/WSOL and USDC escrow, purchase, fee settlement, refund, CPMM CPI, LP burn and rollback.
- [ ] Adversarial tests for spoofed creator, wrong PDA/bump, wrong mint, wrong Token Program, fake ATA, changed AMM program, substituted pool vault, duplicate nonce, unauthorized writable accounts and split-order attacks.
- [ ] TypeScript tests for supply validation, decimal conversion, PDA derivation, instruction order, ATA idempotency, fee/curve display, priority-fee bounds and RPC errors.
- [ ] Run controlled Mainnet integration checks only after production program deployment, source verification and independent audit; each transaction requires an explicit wallet signature and a separately identified, user-authorized test amount.
- [ ] Verify program ID, deployed binary/source hash, IDL, mint/freeze authority state, treasury ATA, developer recipient, Raydium CPMM program/config, pool and LP burn.
- [ ] Independent Solana security audit; remediate all critical/high issues.
- [ ] Confirm upgrade-authority / multisig controls, monitoring, outage runbooks, incident response and recovery.
- [ ] Mainnet enablement only by separate reviewed release. Closing GitHub issues or merging documentation never switches on deposits/trading.

## Current facts and boundaries

- \`app/launchpad/page.tsx\` is the existing route; the prior version was a locked discovery/status page.
- The current Anchor workspace contains \`programs/vault\` and a local \`programs/launchpad\` treasury-only crate. The launchpad crate has no production program ID or deployment keypair and does not implement token minting or buy/sell instructions.
- The current client uses Solana Kit. \`@solana/web3.js\` and wallet-adapter hooks are not current project dependencies.
- Tailwind is not currently configured.
- The fee policy is documented but not collected on-chain.
- Helius configuration has not been proven by the tracked source; the client currently uses \`NEXT_PUBLIC_SOLANA_RPC_URL\` or the public Solana Mainnet RPC default. Hosting environment variables must be checked separately.
- No production launchpad, bonding curve, quote escrow, refund program, CPMM CPI, LP burn or launch execution is claimed by this backlog.


## 13. Treasury epochs and protocol-fee routing

Design and current implementation detail: [TREASURY_AND_CREATOR_FEES.md](./TREASURY_AND_CREATOR_FEES.md).

### Implemented local treasury core

- [x] Add \`programs/launchpad/Cargo.toml\` and \`programs/launchpad/src/lib.rs\` to the local Anchor workspace.
- [x] Define the single \`treasury-v1\` PDA and hardcode developer destination \`ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG\`.
- [x] Initialize \`last_distribution_timestamp\` from \`Clock::get()?.unix_timestamp\`.
- [x] Enforce the 1,209,600-second minimum epoch before any disbursal.
- [x] Pay 60% of new, previously undistributed fee inflows to the fixed developer account.
- [x] Add the remaining 40% to \`locked_reserve_lamports\` and exclude it from every future harvest, preventing repeated 60/40 calls from slowly draining the reserve.
- [x] Test fee math, remainder carry, exact epoch boundary, backwards clock, 60/40 split and treasury account sizing.
- [x] Keep host-only ProgramTest dependencies outside the Anchor SBF workspace in `programs/program-tests`.
- [x] Add `scripts/pin-sbf-compatible-locks.sh` to constrain edition2024-sensitive transitive crates for the Solana 1.18/Cargo 1.75 SBF toolchain.
- [x] Keep host-only ProgramTest dependencies outside the Anchor SBF workspace in `programs/program-tests`.
- [ ] Connect the tested creator-fee helper to a verified buy/sell instruction and atomically transfer the treasury/creator amounts.
- [ ] Add operation receipt/nonces, replay tests and event reconciliation for each fee-bearing swap.
- [x] Add treasury ProgramTest integration coverage for rent preservation, unauthorized destination substitution, unsolicited donations, fee-ledger reconciliation, premature withdrawal rollback and repeated epochs in `programs/program-tests/tests/treasury_program_test.rs`.
- [ ] Confirm both SBF artifacts build and both ProgramTest suites pass against the built binaries in the dedicated Anchor SBF workflow.
- [ ] Complete an immutable-program or explicit multisig-upgrade policy before marketing the retained reserve as permanently locked.

### Protocol swap fee design

- [ ] Enforce 50 basis points (0.50%) of gross input on each WELP-controlled swap using checked integer arithmetic.
- [ ] Credit 100% of the protocol fee to a treasury vault for the exact input mint in the same atomic transaction as the swap.
- [ ] After at least 14 days, release 60% of eligible new SOL inflows and protect the remaining 40% as reserve. Apply this split once, at epoch maturity.
- [ ] Implement per-mint treasury token vaults and token CPI settlement before accepting SPL-token input routes; the current treasury vault is SOL-only.
- [ ] Add operation receipts/nonces and event reconciliation to prevent duplicate fee collection.
- [ ] Do not claim a fee on arbitrary SPL transfers or direct external DEX swaps that bypass WELP.
- [ ] Treat Raydium post-graduation trades as out-of-scope until a supported, reviewed collection path can actually route the fee to WELP treasury.

### Economic blockers

- [ ] Resolve 85 SOL graduation target versus fixed 25/187.5 lamports-per-whole-token curve endpoints and 80% sale allocation. At the stated curve, maximum proceeds are approximately 85 SOL for 1B supply, 17 SOL for 200M supply and 8.5 SOL for 100M supply. Choose a supply-scaled funding target or supply-scaled price anchors, or explicitly restrict which launches can graduate.
- [ ] Implement the 0.02% initial creator purchase as a normal creator-signed buy instruction in the same transaction as creation; show amount, price, fee, early-wallet-cap impact and all recipients before signing. Never allocate tokens through an undisclosed privileged shortcut.
