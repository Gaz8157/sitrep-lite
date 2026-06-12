from __future__ import annotations
import hashlib
import time
import secrets
from typing import Any
from ..db.panel import get_conn


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create(user_id: int, ttl_sec: int = 1800) -> str:
    token = secrets.token_hex(32)
    now = int(time.time())
    with get_conn() as c:
        c.execute("DELETE FROM password_resets WHERE expires_at <= ?", (now,))
        c.execute(
            "INSERT INTO password_resets (token, user_id, created_at, expires_at) VALUES (?,?,?,?)",
            (_digest(token), user_id, now, now + ttl_sec),
        )
    return token


def get(token: str) -> dict[str, Any] | None:
    with get_conn() as c:
        row = c.execute(
            "SELECT * FROM password_resets WHERE token IN (?, ?) AND expires_at > ? AND used_at IS NULL",
            (_digest(token), token, int(time.time())),
        ).fetchone()
    return dict(row) if row else None


def mark_used(token: str) -> None:
    with get_conn() as c:
        c.execute("UPDATE password_resets SET used_at=? WHERE token IN (?, ?)",
                  (int(time.time()), _digest(token), token))
