# WELP-UP Runbook

Operational notes for the Python agent under `welp/`. The browser app signs only through a connected wallet session.

## Balance-mismatch HALT

When the agent logs `HALT ... balance mismatch`, the on-chain token balance differs from the ledger by more than 2%.

1. Stop the agent loop.
2. Confirm the wallet is dedicated to WELP (no manual transfers of the same mint).
3. Inspect the position row in `data/welp.db` and the on-chain ATA balance.
4. If the tokens were sold manually, close the ledger row with status `missing` or reconcile via adopt logic after the next cycle.
5. Restart only after ledger and chain agree.

## Manually exit an orphan

Orphans are on-chain balances with no open ledger row (adopted via issue #2 reconcile).

1. Prefer letting the agent adopt and manage the exit.
2. Manual exit: swap the mint to SOL in the site wallet session, then delete or mark the adopted row closed in the DB if present.

## Recover a corrupt `brain.json`

Delete `data/brain.json`. A fresh brain with zero weights is valid; the rule score still drives entries until labels accumulate.

## Reset a cooldown

Cooldowns are derived from the last closed row for that mint (`closed_at` + win/loss window). To clear:

```sql
UPDATE positions SET closed_at = 0 WHERE mint = '<mint>' AND status = 'closed';
```

Prefer waiting out the cooldown unless you know why it fired.

## Model storage

`data/` holds the only model (`brain.json`) and the SQLite ledger (`welp.db`). Back up both nightly (see `scripts/backup.sh`).
