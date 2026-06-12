"""In-memory fixed-window rate limiter for auth endpoints."""
from __future__ import annotations

import time

from fastapi import HTTPException

_buckets: dict[tuple[str, str], tuple[float, int, float]] = {}
_MAX_BUCKETS = 4096


def reset() -> None:
    _buckets.clear()


def allow(scope: str, key: str, *, limit: int, window: float) -> bool:
    now = time.time()
    start, count, _ = _buckets.get((scope, key), (now, 0, window))
    if now - start >= window:
        start, count = now, 0
    count += 1
    _buckets[(scope, key)] = (start, count, window)
    if len(_buckets) > _MAX_BUCKETS:
        for k, (s, _c, w) in list(_buckets.items()):
            if now - s >= w:
                _buckets.pop(k, None)
    return count <= limit


def enforce(scope: str, key: str | None, *, limit: int, window: float) -> None:
    if not allow(scope, key or "unknown", limit=limit, window=window):
        raise HTTPException(status_code=429, detail="rate_limited")
