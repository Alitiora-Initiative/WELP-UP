# Webacy Security Integration

WELP UP proxies Webacy API calls from Next.js server routes. The browser never receives the provider credential.

## Configuration

Set `WEBACY_API_KEY` as a **Sensitive** Vercel environment variable for Production, Preview and Development. Do not use a `NEXT_PUBLIC_` prefix and do not commit the credential to Git. The API key is sent to Webacy using the `x-api-key` header.

## Enabled operations

The dashboard at `/risk-dashboard` calls the server-only `POST /api/webacy` route. The route is an allowlist, not an arbitrary URL proxy.

- **Solana token scan:** `GET /trading-lite/{mint}?chain=sol` — token security indicators, top-holder share, snipers/bundlers, deployer activity, mint and freeze authority.
- **Early holder analysis:** `GET /holder-analysis/{mint}?chain=sol` — holder behaviour and early buyer analysis. Data availability depends on provider retention.
- **Token pool intelligence:** `GET /tokens/{mint}/pools?chain=sol`.
- **Wallet due diligence:** `GET /addresses/{address}`, `GET /quick-profile/{address}`, and `GET /addresses/sanctioned/{address}` for selected supported chain. The EVM wallet path additionally requests `/addresses/{address}/approvals` and `/addresses/{address}/poisoning`; those two calls are intentionally omitted for Solana.
- **Transaction risk:** `GET /transactions/{txHash}?chain=...`, including Solana signatures.
- **URL risk:** `POST /url` for HTTP(S) phishing/malware analysis.
- **Pool analytics:** `GET /tokens/pools/{poolAddress}?chain=...&timeFrame=...`.
- **Discovery:** `GET /tokens/trending` and `GET /tokens/pools/trending?chain=sol`.
- **Provider usage:** `GET /usage/current`.
- **EVM contract analysis:** `GET /contracts/{address}?chain=...` for supported EVM networks.

## Safety boundaries

- This integration is read-only. It does not sign, broadcast, or modify a wallet transaction.
- A Webacy result is an additional risk signal, not an audit, guarantee, financial recommendation, or proof that an asset is safe.
- Provider errors, unsupported input, missing fields, stale data, or unavailable scans must be treated as **unknown**, never as a clean result.
- Webacy documents raw EVM transaction simulation and EIP-712 signature scanning for EVM chains. Those operations are not used for Solana signing.
- Webacy's poisoning and standalone approval endpoints are documented for EVM chains; the UI labels them as such and does not send Solana addresses to those endpoints.
- Webacy's ERC-4626 vault and RWA/stablecoin risk products are not an audit or security assessment of WELP's custom Solana Anchor vault.
- API rate limits and plan quotas apply. Avoid tight polling or repeated refreshes; prefer cached provider results.

## References

- [Webacy API reference](https://docs.webacy.com/)
- [Authentication](https://docs.webacy.com/api-reference/authentication)
- [Solana trading-lite](https://docs.webacy.com/api-reference/trading-lite/get-simplified-token-analysis-with-security-indicators)
- [Holder analysis](https://docs.webacy.com/api-reference/holder-analysis/get-detailed-early-holder-analysis-for-a-token)
- [Threat risk](https://docs.webacy.com/api-reference/threat-risks/threat-considerations-for-an-address)
- [Transaction risk](https://docs.webacy.com/api-reference/transaction-risks/risk-details-for-a-transaction)
