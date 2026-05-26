from __future__ import annotations

import json
import time

from fastapi import APIRouter, Depends, HTTPException

from ..db.state import get_conn, migrate
from ..deps import require_server_role

router = APIRouter(prefix="/api/servers/{instance_id}/scheduler", tags=["scheduler"])

_READ_ROLES = ("owner", "head_admin", "admin", "moderator", "viewer", "demo")
_ADMIN_ROLES = ("owner", "head_admin", "admin")


def _ensure_db():
    migrate()


@router.get("/jobs")
async def list_jobs(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM scheduler_jobs ORDER BY created_at DESC").fetchall()
        return {"jobs": [dict(r) for r in rows]}


@router.post("/jobs")
async def create_job(instance_id: int, payload: dict,
                     user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    name = payload.get("name", "")
    cron_expr = payload.get("cron_expr", "")
    action = payload.get("action", "")
    job_payload = payload.get("payload")
    if not name or not cron_expr or not action:
        raise HTTPException(status_code=400, detail="name, cron_expr, and action required")
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO scheduler_jobs (name,cron_expr,action,payload,created_at) VALUES (?,?,?,?,?)",
            (name, cron_expr, action, json.dumps(job_payload) if job_payload else None, int(time.time())),
        )
        return {"id": cur.lastrowid, "state": "created"}


@router.put("/jobs/{job_id}")
async def update_job(instance_id: int, job_id: int, payload: dict,
                     user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    fields = {}
    for key in ("name", "cron_expr", "action", "enabled"):
        if key in payload:
            fields[key] = payload[key]
    if "payload" in payload:
        fields["payload"] = json.dumps(payload["payload"])
    if not fields:
        raise HTTPException(status_code=400, detail="no fields to update")
    set_clause = ", ".join(f"{k}=?" for k in fields)
    with get_conn() as conn:
        conn.execute(f"UPDATE scheduler_jobs SET {set_clause} WHERE id=?",
                     (*fields.values(), job_id))
    return {"state": "updated"}


@router.delete("/jobs/{job_id}")
async def delete_job(instance_id: int, job_id: int,
                     user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        conn.execute("DELETE FROM scheduler_jobs WHERE id=?", (job_id,))
    return {"state": "deleted"}


@router.post("/jobs/{job_id}/run")
async def run_job_now(instance_id: int, job_id: int,
                      user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM scheduler_jobs WHERE id=?", (job_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="job not found")
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO scheduler_log (job_id,action,result,ran_at) VALUES (?,?,?,?)",
            (job_id, row["action"], "manual_trigger", int(time.time())),
        )
    return {"state": "triggered"}


@router.get("/jobs/{job_id}/log")
async def job_log(instance_id: int, job_id: int, limit: int = 50,
                  user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM scheduler_log WHERE job_id=? ORDER BY ran_at DESC LIMIT ?",
            (job_id, limit),
        ).fetchall()
    return {"entries": [dict(r) for r in rows]}
