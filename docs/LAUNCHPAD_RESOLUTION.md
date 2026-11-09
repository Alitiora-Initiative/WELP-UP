# WELP Launch Studio — launchpad structural resolution

Source of the required behaviour: the operator brief received from the community
engineering review (preserved in the shared transfers notes) — “Architecture
Blueprint: No-Capital Structural Resolutions for Solana Protocol Modules” —
and the token-metadata launch brief that followed.

This resolution applies the same rules to the launchpad module and supersedes the
stale “Launchpad” naming with the chosen product name.

## Module: Launch Studio (formerly Launchpad)

### 1. Core architectural problem and strategic constraints

The WELP custom rail cannot currently be presented as a live token factory.
The Anchor source contains token-mint/metadata and treasury instructions, but
the configured mainnet address is not an executable program and no live launch
indexer is configured. The creator studio also offers a separate Pump.fun
launch flow through PumpPortal. The custom rail must remain gated until the
program, treasury state, audit and operator enablement are independently
verified on mainnet.

### 2. Capital-free launch resolution

1. Public, permissionless rails first: the pump.fun bonding curve through
   PumpPortal (wallet-signed, live) remains the primary launch rail.
2. Custom creator supply/decimals rail: defer the bespoke deployment; use a
   shared, audited, multi-tenant launchpad program or the user-pays-rent model
   (creator signs the launch transaction and funds rent) before any custom
   launch is enabled.
3. Custom launch charge: source currently specifies a flat 0.0025 SOL charge
   (`2,500,000` lamports) in `programs/launchpad/src/token_launch.rs`. It is not
   collected today because the WELP program and treasury are not deployed and
   initialized on mainnet. This launch charge is separate from the variable
   Jupiter referral fee on swaps.

### 3. Token metadata resolution (followed to the last letter)

- Mint address: served per launch via `/api/launch/metadata?mint=…`; mint must
  pass base58 programme-address validation.
- Decimals: standard 9 (native) or 6 (USDC) for existing mints; creator choice of
  0–18 decimals for new mints (the WELP custom rail currently enforces 0–9 in
  application and on-chain code; the 0–18 creator range is the target).
- Token name: under 32 bytes (currently enforced at 1–48 bytes in application;
  the metadata layer must enforce the 32-byte ceiling).
- Ticker / symbol: ideally 3–5 characters (currently 1–10 in application; the
  3–5 ceiling is the target, with the WELP UP suffix branding).
- Logo / icon URL: 512x512 pixel PNG with transparent background, pinned to
  Arweave or IPFS (not ordinary web hosting), hosted permanently.
- Description: one to two sentence public pitch.
- Extensions JSON: website, twitter, telegram, discord.

metadata.json shape:

```json
{
  "name": "Token Name",
  "symbol": "TICKER",
  "description": "Short pitch.",
  "image": "arweave-or-ipfs-url",
  "showName": true,
  "extensions": {
    "website": "https://…",
    "twitter": "https://…",
    "telegram": "https://…",
    "discord": "https://…"
  }
}
```

- Checklist: generate the 512x512 transparent PNG; pin logo and metadata.json to
  Arweave/IPFS; bind via Metaplex (or Token-2022 metadata pointer extension);
  verify display in explorer/wallet.
- Verification checklist: mint substitution, signer/fee-payer allocation,
  PDA derivation, ATA verification, state logging.

### 4. Phases

- Phase 1: configuration cleanup — eliminate local deployer keypair reads,
  point program constants at public mainnet addresses, keep fee policy integer-only.
- Phase 2: client transaction injection — move rent/supply/fee payloads onto the
  user-signed transaction, keep metadata + fee atomic.
- Phase 3: external integration hooks — public keeper/MEV incentive loops,
  serverless/edge triggers, free-tier indexing.

### 5. Naming decision

The better name between **Creator Studio** and **Launch Studio** is
**Launch Studio**: it states what the product does (launch a token) and matches
the existing `lp-studio` UI family and the “Launch a coin” action.

## Blocked set resolution index

- Vault: shared multi-tenant locker/yield middleware, user-pays-rent deposits,
  shadow indexing (pasted Module 1).
- Automation / agent / marketplace: on-chain strategy encapsulation, keeper
  incentive loops, serverless edge triggers, client-side execution delegation
  (pasted Module 2).
- Referral: URL-based cryptographic attribution, atomic fee splitting, Jupiter
  referral routing, pull-based indexing (pasted Module 3).
- Launch Studio: this document.

## Validation and verification checklist

- [ ] Launch Studio route, nav labels and copy renamed consistently.
- [ ] Token metadata layer returns the full pasted metadata.json shape
      (name, symbol, description, image, showName, extensions with discord).
- [ ] Token name ceiling (32 bytes) and ticker window (3–5) enforced.
- [ ] Logo served as 512x512 transparent PNG via Arweave/IPFS.
- [ ] Custom launch validation stays BigInt-only, 1..1,000,000,000 whole tokens,
      0–9 decimals, 5% early cap, u64 bounds.
- [ ] Green build, lint, typecheck and test suite pass before any deploy.
