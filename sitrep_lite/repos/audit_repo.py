from __future__ import annotations
import time
import json
from typing import Any
from ..db.panel import get_conn

_TRIM_EVERY = 256
_KEEP_ROWS = 50_000
_appends_since_trim = 0


def append(*, actor_user_id: int | None, action: str,
           target: str | None = None, ip: str | None = None,
           user_agent: str | None = None, data: Any | None = None) -> None:
    global _appends_since_trim
    payload = json.dumps(data) if data is not None else None
    with get_conn() as c:
        c.execute(
            """INSERT INTO audit_log (ts, actor_user_id, action, target, ip, user_agent, data)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (int(time.time()), actor_user_id, action, target, ip, user_agent, payload),
        )
        _appends_since_trim += 1
        if _appends_since_trim >= _TRIM_EVERY:
            _appends_since_trim = 0
            c.execute(
                "DELETE FROM audit_log WHERE rowid IN "
                "(SELECT rowid FROM audit_log ORDER BY ts DESC LIMIT -1 OFFSET ?)",
                (_KEEP_ROWS,),
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
