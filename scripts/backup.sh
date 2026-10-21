#!/usr/bin/env bash
# Nightly ledger + brain backup. Keeps 14 days.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${WELP_DATA_DIR:-$ROOT/data}"
mkdir -p "$DATA"
STAMP=$(date +%F)
if command -v sqlite3 >/dev/null 2>&1 && [[ -f "$DATA/welp.db" ]]; then
  sqlite3 "$DATA/welp.db" ".backup $DATA/welp-$STAMP.db"
fi
if [[ -f "$DATA/brain.json" ]]; then
  cp "$DATA/brain.json" "$DATA/brain-$STAMP.json"
fi
# prune older than 14 days
find "$DATA" -maxdepth 1 -name 'welp-*.db' -mtime +14 -delete 2>/dev/null || true
find "$DATA" -maxdepth 1 -name 'brain-*.json' -mtime +14 -delete 2>/dev/null || true
