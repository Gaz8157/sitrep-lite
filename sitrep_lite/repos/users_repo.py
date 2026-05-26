"""Read/write for the users table."""
from __future__ import annotations

import time
from typing import Any

from ..db.panel import get_conn


def create(
    *, username: str, email: str, password_hash: str, role: str,
    discord_id: str | None = None, discord_username: str | None = None,
) -> int:
    with get_conn() as c:
        cur = c.execute(
            """INSERT INTO users (username, email, password_hash, role,
                                  discord_id, discord_username, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (username, email, password_hash, role, discord_id, discord_username,
             int(time.time())),
        )
        return cur.lastrowid


def get(user_id: int) -> dict[str, Any] | None:
    with get_conn() as c:
        row = c.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    return dict(row) if row else None


def find_by_username(username: str) -> dict[str, Any] | None:
    with get_conn() as c:
        row = c.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    return dict(row) if row else None


def find_by_email(email: str) -> dict[str, Any] | None:
    with get_conn() as c:
        row = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    return dict(row) if row else None


def find_by_discord_id(discord_id: str) -> dict[str, Any] | None:
    with get_conn() as c:
        row = c.execute("SELECT * FROM users WHERE discord_id=?", (discord_id,)).fetchone()
    return dict(row) if row else None


def list_all() -> list[dict[str, Any]]:
    with get_conn() as c:
        rows = c.execute("SELECT * FROM users ORDER BY id").fetchall()
    return [dict(r) for r in rows]


def update(user_id: int, **fields: Any) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k}=?" for k in fields)
    with get_conn() as c:
        c.execute(f"UPDATE users SET {cols} WHERE id=?",
                  (*fields.values(), user_id))


def set_password(user_id: int, password_hash: str) -> None:
    update(user_id, password_hash=password_hash)


def set_disabled(user_id: int, disabled: bool) -> None:
    update(user_id, disabled=1 if disabled else 0)


def delete(user_id: int) -> None:
    with get_conn() as c:
        c.execute("DELETE FROM users WHERE id=?", (user_id,))


def link_discord(user_id: int, discord_id: str, discord_username: str) -> None:
    update(user_id, discord_id=discord_id, discord_username=discord_username)


def record_login(user_id: int, ip: str | None) -> None:
    update(user_id, last_login_at=int(time.time()), last_login_ip=ip)


def count() -> int:
    with get_conn() as c:
        return c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
