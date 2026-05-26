"""Key/value settings persisted in panel.db.

Used for runtime-editable config — Discord OAuth credentials, SMTP creds,
etc. JWT_SECRET stays env-only.
"""
from __future__ import annotations

import time

from ..db.panel import get_conn


def get(key: str) -> str | None:
    with get_conn() as c:
        row = c.execute("SELECT value FROM panel_settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else None


def get_all() -> dict[str, str]:
    with get_conn() as c:
        rows = c.execute("SELECT key, value FROM panel_settings").fetchall()
    return {r["key"]: (r["value"] or "") for r in rows}


def set_many(values: dict[str, str], *, updated_by: int | None) -> None:
    """Upsert a batch of keys atomically. Empty-string value clears the row."""
    now = int(time.time())
    with get_conn() as c:
        for k, v in values.items():
            if v == "" or v is None:
                c.execute("DELETE FROM panel_settings WHERE key=?", (k,))
            else:
                c.execute(
                    """INSERT INTO panel_settings (key, value, updated_at, updated_by)
                       VALUES (?, ?, ?, ?)
                       ON CONFLICT(key) DO UPDATE SET
                         value=excluded.value,
                         updated_at=excluded.updated_at,
                         updated_by=excluded.updated_by""",
                    (k, v, now, updated_by),
                )
