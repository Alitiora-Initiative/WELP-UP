# Recovered Base44 source audit

**Reference archive:** [`welp-original-source`](../welp-original-source)  
**Reference application:** https://welp-vault-prime.base44.app  
**Audit basis:** the committed source archive, not a live Base44 backend export.

## What was recovered

- Archive size: 578,766 characters.
- Captured source sections: 134.
- Every captured section has a balanced Markdown code fence.
- The archive includes the Vite/React application shell, navigation, UI components, market and vault pages, documentation and whitepaper components, plus captured libraries and hooks.
- The source is a Base44/Vite/React application. The production repository is a separate Next.js App Router application. Base44 SDK/runtime assumptions must be replaced, not reintroduced as production dependencies.

## Known archive gaps

The archive table of contents lists 150 files, but only 134 file sections are present. These 16 paths are listed but have no captured source section:

- `src/lib/fees.js`
- `src/lib/format.js`
- `src/lib/jupiter.js`
- `src/lib/ledger.js`
- `src/lib/policies.js`
- `src/lib/query-client.js`
- `src/lib/rpc.js`
- `src/lib/strategies.js`
- `src/lib/utils.js`
- `src/lib/vault.js`
- `src/lib/vaultProgramSource.js`
- `src/lib/wallet.jsx`
- `src/lib/watchlist.js`
- `src/main.jsx`
- `src/pages/ActivityLogs.jsx`
- `src/pages/Agent.jsx`

There is also a stray `s` after the final closing code fence. It is an archive-formatting artifact, not source code.

## How the rebuild must use this archive

1. Treat every captured file as the reference for the original product's page structure, interaction intent, labels, visual patterns, and code-level behavior.
2. Cross-check the source against the current Next.js repository before porting. Do not copy Base44 SDK imports, Base44 auth assumptions, Vite configuration, or browser-router wiring into the production runtime.
3. For any path in the known-gap list, inspect the current repository and the captured call sites. Reconstruct only from verifiable behavior and the security/product blueprint; mark unresolved behavior as an explicit implementation gap instead of pretending the missing original code was recovered.
4. Keep user-facing claims aligned with the actual deployed application and verified integrations. A source component, route, UI state, or local mock is not evidence of a live service.
5. Preserve fail-closed behavior for vault and automated execution. No deposits or autonomous mainnet fund movement until the on-chain program, integrations, tests, independent audit, and release gates are complete.

This archive is the primary recovered reference for the rebuild, but it is not a complete export of all files in its own table of contents and is not a production deployment specification by itself.
