# WELP vault threat model (draft — Phase 1)

**Status:** Design only. No on-chain program is deployed. Mainnet funds must not be enabled until roadmap vault launch gates are complete.

## Goal

Isolated per-user vault that:

- Is funded only by an explicit user-signed transfer of SOL the user chooses.
- Enforces a total allocation cap and a per-position ceiling (design default 0.02 SOL) **on-chain**.
- Lets a narrowly scoped executor trade only through the vault authority.
- Never receives the user’s Phantom private key or seed phrase.
- Allows the user to pause, revoke, and withdraw available assets without the agent’s cooperation.

## Actors

| Actor | Trust | Notes |
|-------|--------|------|
| User wallet | Trusted by user | Signs fund, revoke, withdraw |
| Vault program | Must be audited | PDA-owned vault account |
| Executor key / bot | Semi-trusted | Can only call allowed instructions within caps |
| Jupiter / RPCs | Untrusted | Quotes can be stale or adversarial |
| Operator host | Semi-trusted | Runs agent software; must not hold user keys |

## Assets

- SOL and SPL tokens inside each vault PDA.
- User’s main wallet (never delegated as full owner).
- Agent off-chain state (ledger, brain) — not a source of funds authority.

## Threats and mitigations

1. **Agent key compromise** — Caps and allowlists on-chain; revoke instruction; no seed storage.
2. **Unlimited spending** — Total cap + per-position 0.02 SOL enforced in program.
3. **Wrong program / CPI** — Strict allowlist of programs (e.g. Jupiter route programs only).
4. **Frozen or fee-on-transfer tokens** — Pre-trade mint checks (freeze authority, transfer fee).
5. **Orphan positions** — Reconciliation of on-chain balances vs ledger every cycle.
6. **Upgrade rug** — Immutable or multi-sig upgrade authority; publish addresses before mainnet.
7. **UI lying about limits** — On-chain state is source of truth; UI reads vault account.
8. **Cross-user leakage** — One vault PDA seed per user pubkey; no shared authority.

## Authority diagram (target)

```
User wallet  --fund/revoke/withdraw-->  Vault PDA
Executor key --trade within caps----->  Vault PDA  --CPI-->  Jupiter / token programs
```

## Out of scope for Phase 1

- Mainnet deployment
- Custody of user primary wallet keys
- Guaranteed take-profit execution or price

## Next gates

See ROADMAP.md vault launch gates 2–7.
