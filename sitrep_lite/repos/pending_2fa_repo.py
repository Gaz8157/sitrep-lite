from __future__ import annotations
import time
import secrets
from typing import Any
from ..db.panel import get_conn


def create(user_id: int, ttl_sec: int = 300) -> str:
    token = secrets.token_hex(16)
    now = int(time.time())
    with get_conn() as c:
        c.execute("DELETE FROM pending_2fa WHERE expires_at <= ?", (now,))
        c.execute(
            "INSERT INTO pending_2fa (token, user_id, expires_at) VALUES (?,?,?)",
            (token, user_id, now + ttl_sec),
        )
    return token


def consume(token: str) -> dict[str, Any] | None:
    """Atomically read + delete. Returns the row, or None if missing/expired."""
    with get_conn() as c:
        row = c.execute(
            "SELECT * FROM pending_2fa WHERE token=? AND expires_at > ?",
            (token, int(time.time())),
        ).fetchone()
        if not row:
            return None
        c.execute("DELETE FROM pending_2fa WHERE token=?", (token,))
    return dict(row)
