from __future__ import annotations

import time
from typing import Any

from ..db.state import get_conn, migrate


def _ensure_db() -> None:
    migrate()


def list_bans() -> dict[str, Any]:
    _ensure_db()
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM bans ORDER BY added_at DESC").fetchall()
        return {"bans": [dict(r) for r in rows]}


def add_ban(identity: str, reason: str = "", added_by: str = "") -> dict[str, Any]:
    _ensure_db()
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM bans WHERE identity=?", (identity,)).fetchone()
        if existing:
            return {"state": "already_banned", "identity": identity}
        conn.execute(
            "INSERT INTO bans (identity, reason, added_at, added_by) VALUES (?,?,?,?)",
            (identity, reason, int(time.time()), added_by),
        )
        return {"state": "banned", "identity": identity}


def remove_ban(identity: str) -> dict[str, Any]:
    _ensure_db()
    with get_conn() as conn:
        conn.execute("DELETE FROM bans WHERE identity=?", (identity,))
        return {"state": "unbanned", "identity": identity}
