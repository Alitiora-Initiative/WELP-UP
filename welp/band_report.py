"""One-shot band occupancy report from the decisions table (issue #11 B1)."""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path


def main(db_path: str) -> int:
    path = Path(db_path)
    if not path.exists():
        print(f"missing ledger: {path}", file=sys.stderr)
        return 1
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT CAST(score / 5 AS INT) * 5 AS bucket,
               COUNT(*) AS seen,
               SUM(CASE WHEN action = 'enter' THEN 1 ELSE 0 END) AS entered
        FROM decisions
        WHERE score IS NOT NULL
        GROUP BY bucket
        ORDER BY bucket
        """
    ).fetchall()
    total = sum(int(r["seen"]) for r in rows) or 1
    in_band = sum(int(r["seen"]) for r in rows if 80 <= int(r["bucket"]) <= 95)
    print(f"{'bucket':>8} {'seen':>8} {'entered':>8} {'share':>8}")
    for r in rows:
        share = 100.0 * int(r["seen"]) / total
        print(f"{int(r['bucket']):>8} {int(r['seen']):>8} {int(r['entered'] or 0):>8} {share:7.2f}%")
    print(f"in_band_80_98_approx={100.0 * in_band / total:.2f}% of scored decisions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "data/ledger.sqlite"))
