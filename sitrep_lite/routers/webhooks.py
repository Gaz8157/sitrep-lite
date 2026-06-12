from __future__ import annotations

import json
import time

from fastapi import APIRouter, Depends, HTTPException

from ..db.state import get_conn, migrate
from ..deps import require_server_role

router = APIRouter(prefix="/api/servers/{instance_id}/webhooks", tags=["webhooks"])

_READ_ROLES = ("owner", "head_admin", "admin", "moderator", "viewer", "demo")
_ADMIN_ROLES = ("owner", "head_admin", "admin")


def _ensure_db():
    migrate()


@router.get("")
async def list_webhooks(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM webhooks ORDER BY created_at DESC").fetchall()
        webhooks = []
        for r in rows:
            wh = dict(r)
            wh["events"] = json.loads(wh.get("events", "[]"))
            webhooks.append(wh)
        return {"webhooks": webhooks}


@router.post("")
async def create_webhook(instance_id: int, payload: dict,
                         user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    name = payload.get("name", "")
    url = payload.get("url", "")
    kind = payload.get("kind", "discord")
    events = payload.get("events", [])
    if not name or not url:
        raise HTTPException(status_code=400, detail="name and url required")
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO webhooks (name,url,kind,events,created_at) VALUES (?,?,?,?,?)",
            (name, url, kind, json.dumps(events), int(time.time())),
        )
        return {"id": cur.lastrowid, "state": "created"}


@router.put("/{webhook_id}")
async def update_webhook(instance_id: int, webhook_id: int, payload: dict,
                         user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    fields = {}
    for key in ("name", "url", "kind", "enabled"):
        if key in payload:
            fields[key] = payload[key]
    if "events" in payload:
        fields["events"] = json.dumps(payload["events"])
    if not fields:
        raise HTTPException(status_code=400, detail="no fields to update")
    set_clause = ", ".join(f"{k}=?" for k in fields)
    with get_conn() as conn:
        conn.execute(f"UPDATE webhooks SET {set_clause} WHERE id=?",
                     (*fields.values(), webhook_id))
    return {"state": "updated"}


@router.delete("/{webhook_id}")
async def delete_webhook(instance_id: int, webhook_id: int,
                         user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        conn.execute("DELETE FROM webhooks WHERE id=?", (webhook_id,))
    return {"state": "deleted"}


@router.post("/{webhook_id}/test")
async def test_fire(instance_id: int, webhook_id: int,
                    user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM webhooks WHERE id=?", (webhook_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="webhook not found")
    from ..services.http_client import shared_client
    payload = {"content": f"SITREP Lite test fire from webhook '{row['name']}'"}
    try:
        resp = await shared_client().post(row["url"], json=payload, timeout=10)
        status = resp.status_code
    except Exception:
        status = 0
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO webhook_log (webhook_id,event,status_code,fired_at) VALUES (?,?,?,?)",
            (webhook_id, "test", status, int(time.time())),
        )
    return {"status_code": status}


@router.get("/{webhook_id}/log")
async def webhook_log(instance_id: int, webhook_id: int, limit: int = 50,
                      user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM webhook_log WHERE webhook_id=? ORDER BY fired_at DESC LIMIT ?",
            (webhook_id, limit),
        ).fetchall()
    return {"entries": [dict(r) for r in rows]}
