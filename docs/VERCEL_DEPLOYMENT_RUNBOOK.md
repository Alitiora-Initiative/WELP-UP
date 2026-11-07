# WELP UP! — Vercel deployment runbook

## Current project

- Vercel project: `welp-up`
- Project ID: `prj_CpBxKK2c7V007lpMUF5d1RjPkrkt`
- Git repository: `Alitiora-Initiative/WELP-UP`
- Framework: Next.js
- Production domain: `https://welpup.fun`
- Production branch: `main`

The project is already linked to this GitHub repository through Vercel Git integration. Do not create a second Vercel project or add a second deployment pipeline unless Git integration is deliberately retired.

## Deployment policy

1. Git integration owns Preview and Production deployment creation.
2. Pull requests and non-production branches are Preview only.
3. Merges to `main` are the Production release path.
4. The Vercel ignored-build script skips changes confined to documentation, tests, CI workflow files, and Anchor/Rust program sources.
5. Any Next.js app, component, library, public asset, package, lockfile, build configuration, `vercel.json`, or unknown path change triggers a build.
6. If Git SHAs are missing or the diff cannot be read, the script fails open and triggers a build. It never suppresses a deployment because of an uncertain diff.
7. Do not add Vercel tokens to source files, pull-request bodies, or untrusted workflows. No Vercel credentials are required for this Git-integration configuration.

## Why the ignored-build gate exists

The source-driven rebuild generated many preview deployments from individual commits. Vercel's daily deployment quota was reached before the latest merged source was built. The gate prevents docs-only, tests-only, and Anchor-only work from using website deployment slots while preserving deployments for actual web changes.

The gate does not bypass or reset Vercel's daily quota. After quota reset, merging a web-relevant PR to `main` should cause one production deployment through the existing Git integration.

## Release procedure

When the Vercel daily deployment quota has reset:

1. Confirm the deployment PR is merged into `main`.
2. Confirm GitHub shows the expected merge commit on `main`.
3. In Vercel, open project `welp-up` and check that the deployment's Git SHA matches the GitHub `main` SHA.
4. Confirm the deployment target is Production and its state is READY.
5. Confirm `https://welpup.fun` serves that deployment.
6. Smoke-test `/`, `/markets`, `/trade`, `/vault`, `/automation`, `/agent`, `/docs`, and `/whitepaper`.
7. Check `/api/markets` returns live provider data or an explicit provider error; check `/api/agent` reports unconfigured until both `OPENAI_API_KEY` and `WELP_AI_MODEL` are configured.
8. Do not describe the vault as live or accept deposits. The Anchor program ID is still a placeholder and no Devnet/Mainnet deployment is approved.

## Failure handling

- If no deployment appears after a merge, inspect the Vercel Git integration, deployment quota, project production branch, and build logs before creating any manual deployment.
- If the ignored-build command cannot access the previous commit, it intentionally builds instead of skipping.
- If a deployment fails, fix the build/test issue and make a new web-relevant commit. Do not promote a stale preview or deploy an unreviewed build.
- Do not use Vercel CLI/API deployment calls to repeatedly retry while the daily quota is exhausted.
