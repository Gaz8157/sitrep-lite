from __future__ import annotations
import time
import json
from typing import Any
from ..db.panel import get_conn


def append(*, actor_user_id: int | None, action: str,
           target: str | None = None, ip: str | None = None,
           user_agent: str | None = None, data: Any | None = None) -> None:
    payload = json.dumps(data) if data is not None else None
    with get_conn() as c:
        c.execute(
            """INSERT INTO audit_log (ts, actor_user_id, action, target, ip, user_agent, data)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (int(time.time()), actor_user_id, action, target, ip, user_agent, payload),
        )


def recent(*, limit: int = 100, actor_user_id: int | None = None) -> list[dict[str, Any]]:
    with get_conn() as c:
        if actor_user_id:
            rows = c.execute(
                "SELECT * FROM audit_log WHERE actor_user_id=? ORDER BY ts DESC LIMIT ?",
                (actor_user_id, limit),
            ).fetchall()
        else:
            rows = c.execute(
                "SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?",
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]
