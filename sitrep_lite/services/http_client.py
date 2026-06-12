"""Process-lifetime shared httpx client.

Per-request AsyncClient construction (own SSLContext + pool) ratchets RSS
under bursty use — one shared client keeps connection reuse and a bounded
pool. Per-call timeouts still apply via the `timeout=` request argument.
"""
from __future__ import annotations

import httpx

_client: httpx.AsyncClient | None = None


def shared_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=15,
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )
    return _client


async def aclose_shared_client() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
