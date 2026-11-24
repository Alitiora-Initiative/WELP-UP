# Webacy security controls in WELP UP

Webacy is an active server-side security dependency in WELP UP's real flows, not only a separate risk dashboard.

## Pre-swap protection (Solana)

Before the server requests a Jupiter order, `POST /api/order` identifies the non-SOL mint and calls:

`GET https://api.webacy.com/trading-lite/{mint}`

The API key is read only from `WEBACY_API_KEY` on the server and sent in the `x-api-key` header. WELP uses Webacy's documented quick-pass criteria:

- Allow only when `isHoneypot === false` and `riskScore < 50`.
- Block a token when `isHoneypot === true` or `riskScore >= 50`.
- Fail closed if the key is missing, the provider times out/errors, or the response lacks either required field.
- Only after this check passes does WELP request a Jupiter quote/order. The returned quote includes a compact Webacy pass result shown in the review panel.

This does not simulate the serialized Solana transaction. Webacy's documented `POST /scan/transaction` and EIP-712 simulation examples are EVM transaction flows, not Solana transaction decoding/signing.

## Launch link protection

Before a Pump.fun launch transaction is prepared, creator-provided website, X and Telegram links are screened using:

`POST https://api.webacy.com/url/check`

WELP blocks phishing/malware results, incomplete/unknown provider responses, and links with a score above 40 (caution/high range). Users can omit optional links and still prepare a launch. The logo URL is handled separately by existing hardened image ingestion: HTTPS-only, DNS lookup with public-IP enforcement and pinned destination, redirect limits, max-size and MIME/magic-byte validation, then the image is pinned to IPFS.

## Existing wallet/dashboard checks

The optional Webacy console also uses documented address quick-profile, sanctions, approvals, poisoning, contract and pool endpoints. URL screening uses `/url/check`. The optional console is supplemental; swap/launch controls above are server-enforced.

## Security boundaries

- Do not put the Webacy key in client code or in a `NEXT_PUBLIC_*` variable.
- Provider errors and incomplete fields are unknown; they must never be converted to a pass.
- Webacy signals are risk indicators, not guarantees or independent audits.
- Solana Trading Lite screens the token; it is not a simulation of the final Jupiter transaction.
- Rotate a credential immediately if it has been shared outside the private Vercel environment.

## References

- [Webacy DEX token screening](https://docs.webacy.com/guides/dex-token-screening)
- [Webacy dApp browser security](https://docs.webacy.com/guides/dapp-browser-security)
- [Webacy consumer wallet security](https://docs.webacy.com/guides/wallet-security)
- [Webacy transaction simulation](https://docs.webacy.com/guides/transaction-simulation)
