# Pump.fun metadata storage

The Launch Studio Pump.fun route pins token metadata JSON to public IPFS storage before asking PumpPortal to build the create transaction.

## Required production configuration

Add `PINATA_JWT` to the **welp-up** Vercel project's **Production** environment. Store it as an encrypted/sensitive server environment variable. Do not add it to `NEXT_PUBLIC_*`, browser code, Git, or a client form.

Create a Pinata API key with permission to upload files to the public IPFS network, then add the JWT to Vercel and redeploy. The launch API returns HTTP 503 with a specific configuration message when this variable is missing; it will not silently fall back to a long, non-persistent query-string metadata URL.

The metadata document includes the token name, ticker, description, HTTPS logo URL, and optional website/X/Telegram links. The URI sent to PumpPortal is the short IPFS gateway URI and is checked against Pump.fun's 200-byte on-chain URI limit.

## Verification

Run `node --experimental-strip-types --test tests/pump-metadata.test.mjs` to verify the metadata document structure and URL validation.
