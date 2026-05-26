from __future__ import annotations

import time
from typing import Any

from ..db.panel import get_conn
from ..services.auth_service import new_refresh_token


def create(*, user_id: int, ttl_sec: int, ip: str | None,
           user_agent: str | None, remember: bool) -> str:
    sid = new_refresh_token()
    now = int(time.time())
    with get_conn() as c:
        c.execute(
            """INSERT INTO sessions (id, user_id, created_at, expires_at,
                                     last_used_at, ip, user_agent, remember)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (sid, user_id, now, now + ttl_sec, now, ip, user_agent,
             1 if remember else 0),
        )
    return sid


def get(sid: str) -> dict[str, Any] | None:
    with get_conn() as c:
        row = c.execute(
            "SELECT * FROM sessions WHERE id=? AND expires_at > ?",
            (sid, int(time.time())),
        ).fetchone()
    return dict(row) if row else None


def rotate(old_sid: str, *, ttl_sec: int) -> str | None:
    new_sid = new_refresh_token()
    now = int(time.time())
    with get_conn() as c:
        old = c.execute("SELECT * FROM sessions WHERE id=?", (old_sid,)).fetchone()
        if not old or old["expires_at"] < now:
            return None
        c.execute(
            """INSERT INTO sessions (id, user_id, created_at, expires_at,
                                     last_used_at, ip, user_agent, remember)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (new_sid, old["user_id"], old["created_at"], now + ttl_sec,
             now, old["ip"], old["user_agent"], old["remember"]),
        )
        c.execute("DELETE FROM sessions WHERE id=?", (old_sid,))
    return new_sid


def delete(sid: str) -> None:
    with get_conn() as c:
        c.execute("DELETE FROM sessions WHERE id=?", (sid,))


def delete_all_for(user_id: int) -> int:
    with get_conn() as c:
        cur = c.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
        return cur.rowcount


def list_for(user_id: int) -> list[dict[str, Any]]:
    with get_conn() as c:
        rows = c.execute(
            "SELECT * FROM sessions WHERE user_id=? AND expires_at > ? ORDER BY last_used_at DESC",
            (user_id, int(time.time())),
        ).fetchall()
    return [dict(r) for r in rows]
