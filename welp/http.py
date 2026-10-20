from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class HttpError(RuntimeError):
    def __init__(self, message: str, status: int | None = None, body: str = ""):
        super().__init__(message)
        self.status = status
        self.body = body


def request_json(
    method: str,
    url: str,
    *,
    query: dict[str, str] | None = None,
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 25.0,
    retries: int = 3,
) -> Any:
    if query:
        url = url + "?" + urllib.parse.urlencode(query)
    base_headers = {
        "Accept": "application/json",
        "User-Agent": "WELP-UP/1.0 (Alitiora-Initiative)",
    }
    if headers:
        base_headers.update(headers)
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        base_headers["Content-Type"] = "application/json"

    last: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=base_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode()
                if not raw:
                    return {}
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode(errors="replace")
            last = HttpError(f"{method} {url} -> {exc.code}", exc.code, body[:800])
            if exc.code not in (429, 500, 502, 503, 504) or attempt == retries - 1:
                raise last
            time.sleep(1.5 * (attempt + 1))
        except urllib.error.URLError as exc:
            last = HttpError(f"{method} {url} failed: {exc.reason}")
            if attempt == retries - 1:
                raise last
            time.sleep(1.0 * (attempt + 1))
    raise last or HttpError("request failed")
