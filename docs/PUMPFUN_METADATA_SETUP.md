# Pump.fun metadata storage

The Launch Studio Pump.fun route follows PumpPortal's current creation contract: the creator's image is uploaded to public IPFS first, then a JSON metadata document is uploaded referencing that image's IPFS URI. PumpPortal receives the short IPFS URI for the JSON document in `tokenMetadata.uri`. The API checks Pump.fun's 200-byte on-chain URI limit before requesting a create transaction.

## Required production configuration

Add `PINATA_JWT` to the **welp-up** Vercel project's **Production** environment. Store it as an encrypted/sensitive server environment variable. Do not add it to `NEXT_PUBLIC_*`, browser code, Git, or a client form.

Create a Pinata API key with permission to upload files to the public IPFS network, then add the JWT to Vercel and redeploy. The launch API reports an explicit HTTP 503 when this variable is missing; it does not fall back to a query-string metadata URL or the user's non-pinned image URL.

## Metadata and image safety

- User logo must be a public HTTPS URL on port 443.
- The server resolves the hostname and rejects private, loopback, link-local and reserved IP ranges; it pins the HTTPS request to the resolved public IP and verifies TLS against the original hostname.
- Redirects are limited and revalidated; only PNG, JPEG and WebP image data up to 5 MB is accepted.
- The image is pinned to public IPFS, followed by metadata JSON that references the image CID.
- Token name, ticker, description, image URI, and optional website/X/Telegram links are included in the metadata.
- `PINATA_JWT` is server-side only and is never sent to the browser or included in the returned response.

## Verification

Run `npm run test:pump-metadata` to test the metadata document, public-IP checks, IPFS upload order, and failure handling without making real Pinata uploads or token-creation transactions.
