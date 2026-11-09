# WELP swap fees and treasury status

**Checked:** 9 November 2026. This document separates the live Jupiter referral path from the proposed WELP fee allocation and treasury program.

## Live swap path

The browser requests an order from Jupiter Swap API v2, signs it with the connected wallet, and submits it to Jupiter's execution endpoint. The API pins the order to versioned transaction v0. No server-held signer is used for user swaps.

Live quotes work through Jupiter Swap API v2 keyless access; a server-side `JUPITER_API_KEY` is optional and provides a higher rate tier. Jupiter currently documents 0.5 requests/second for keyless access, so a production deployment serving multiple users should use a free server-side key and monitor its rate limits. `/api/status` independently checks the token feed and a quote-only Jupiter order request. A successful quote check proves the provider can return a price, not that a particular user's balance, route, wallet signing, or execution will succeed.

WELP referral collection is optional configuration. Set `WELP_REFERRAL_ACCOUNT` and `WELP_REFERRAL_FEE_BPS` on the server to request a Jupiter referral fee. The fee rate must be from 50 to 255 basis points. The order route verifies that:

1. The referral account exists and is owned by Jupiter's referral program.
2. Jupiter returns the configured referral account and a fee mint.
3. The canonical associated token account for that referral account and exact fee mint exists, uses the correct token program, and has matching mint and owner bytes.

If configured collection is incomplete or cannot be verified, `/api/order` requests a fresh quote without referral parameters and labels it `not_collected`. This keeps wallet-approved swaps available without silently claiming a WELP fee. The quote UI shows the no-WELP-fee state before wallet signing. Jupiter's own platform/route fees may still apply. The quote's `feeBps`, `platformFee.feeBps`, and `feeMint` are separate fields and must not be presented as WELP revenue.

The referral account `welpup` was created on mainnet at `2puMMFLeeVYPifiJGeNefnYiGFpXSDNTDSAMiq9ndUuV`. Its partner is the dev wallet `ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG`. Referral fees are claimed to that partner's token account; the referral rail does not route directly to a WELP treasury PDA. Jupiter retains 20% of the integrator fee. The partner must claim and separately route proceeds to a designated treasury if one is established. The official dashboard is [referral.jup.ag](https://referral.jup.ag/).

At the last mainnet account check, the SOL referral token account was absent and the dev wallet held 0.001256102 SOL. The mainnet rent quote for a standard 165-byte token account was 0.001488440 SOL, before transaction fees. These values are time-sensitive and must be rechecked before acting. SOL referral collection could not be enabled with that balance. The fee route checks the exact `feeMint` per quote, so every fee mint returned by Jupiter needs its own initialized referral account.

## Fee policy calculations (not active collection)

`lib/server/fee-policy.ts` and `lib/launchpad-config.ts` calculate the requested target split:

- 100 bps (1.00%) protocol allocation.
- 50 bps (0.50%) creator/developer allocation.
- 2 bps (0.02%) genesis allocation.
- 14-day treasury epoch with 60% developer release and 40% retained reserve.

These calculations do not collect, transfer, reserve, or distribute funds. Jupiter's referral option charges one configured fee rate to one referral token account. It does not implement the separate 100-bps and 50-bps transfers, WELP's 60/40 epoch, or an on-chain treasury. Do not set a referral rate and describe it as the proposed allocation unless the transaction and final balances prove the chosen economics.

## Treasury deployment status

The source declares launch/treasury program ID `BrcdB9sV7z9DvF9rDHG263HUxXgJM3iCQdF36TcxbFEn`. Mainnet RPC reports the address is owned by the System Program and is not executable. No WELP treasury program or treasury PDA is active at this address. Rust unit tests and fee math are not deployment evidence.

The existing referral account's partner is the dev wallet, and the repository does not define a separate treasury receiving wallet. Therefore the current route can only accrue claimable referral proceeds for that partner. To implement the desired treasury waterfall, choose and verify a treasury authority (preferably a governance-controlled multisig), then either:

1. Deploy and independently review a treasury program that receives fees atomically, records mint-specific balances, and enforces the epoch; or
2. Claim referrals to the partner wallet and run a disclosed, auditable settlement process that transfers proceeds to the verified treasury and applies the 60/40 split after the epoch.

The first option requires an audited program, production deployment key, verified executable address, upgrade-authority policy, mint-specific vaults, replay protection, event/indexer reconciliation, and mainnet transaction tests. The second option is not an on-chain enforced epoch and must be described as operator-managed.

## Operational checklist

- [x] Create the named Jupiter referral account on mainnet.
- [x] Verify referral account program owner and partner.
- [x] Add quote-time verification of the exact referral token account.
- [ ] Fund a payer and initialize the SOL referral token account.
- [ ] Set Vercel `WELP_REFERRAL_ACCOUNT` and `WELP_REFERRAL_FEE_BPS` only after fee-account verification.
- [ ] Make a small, explicitly approved swap and inspect the confirmed transaction and referral balance delta.
- [ ] Establish a treasury address and documented custody/governance model.
- [ ] Implement and independently review the 1.00% + 0.50% allocation and 14-day 60/40 settlement before describing those policy calculations as active fees.

Network fees, priority fees, account rent, Jupiter's share, and DEX/pool fees are separate from WELP proceeds. For the current state, use `/api/status`; it reports environment readiness and on-chain account checks rather than inferring activation from source constants.
