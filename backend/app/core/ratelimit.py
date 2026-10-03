"""Generic in-memory sliding-window limiter (P46: public 60/min/IP, R4). Resets on restart."""

import threading
import time
from collections import deque

from app.core.errors import AppError

_lock = threading.Lock()
_hits: dict[str, deque[float]] = {}


def check_rate(bucket: str, key: str, limit: int, window: float = 60.0) -> None:
    now = time.monotonic()
    k = f"{bucket}:{key}"
    with _lock:
        q = _hits.setdefault(k, deque())
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            raise AppError("RATE_LIMITED", "Too many requests", 429)
        q.append(now)


def reset_rate_limits() -> None:
    with _lock:
        _hits.clear()
