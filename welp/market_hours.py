"""US equity session helpers. xStocks trade 24/7 on Solana; the underlying does not."""
from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
OPEN = time(9, 30)
CLOSE = time(16, 0)


def is_us_session(now: datetime | None = None) -> bool:
    now = (now or datetime.now(timezone.utc)).astimezone(NY)
    if now.weekday() >= 5:            # Sat/Sun
        return False
    return OPEN <= now.time() < CLOSE


def minutes_to_close(now: datetime | None = None) -> float:
    now = (now or datetime.now(timezone.utc)).astimezone(NY)
    if not is_us_session(now):
        return 0.0
    close = now.replace(hour=CLOSE.hour, minute=CLOSE.minute, second=0, microsecond=0)
    return (close - now).total_seconds() / 60.0

# Holiday caveat: no holiday calendar yet — sessions on US market holidays will
# still report as open during 09:30–16:00 ET weekdays.
