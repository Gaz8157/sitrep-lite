"""/api/audit — panel-wide audit log read endpoint.

Reads from the existing `audit_log` table populated by other routers
(auth, users, settings, etc.). Owner only.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import require_role
from ..repos import audit_repo, users_repo

router = APIRouter(prefix="/api/audit", tags=["audit"])


_VIEW_ROLES = ("owner",)


@router.get("")
def list_audit(
    limit: int = 100,
    actor_user_id: int | None = None,
    user=Depends(require_role(*_VIEW_ROLES)),
) -> dict:
    """Return recent audit log entries.

    Query params:
      - limit: max rows (default 100, clamped to 1..1000)
      - actor_user_id: filter to actions by a specific user
    """
    if limit < 1:
        limit = 1
    if limit > 1000:
        limit = 1000
    rows = audit_repo.recent(limit=limit, actor_user_id=actor_user_id)
    # Resolve actor usernames so the timeline reads naturally.
    actor_cache: dict[int, str] = {}
    out: list[dict] = []
    for r in rows:
        actor_id = r.get("actor_user_id")
        actor_name: str | None = None
        if isinstance(actor_id, int):
            if actor_id in actor_cache:
                actor_name = actor_cache[actor_id]
            else:
                u = users_repo.get(actor_id)
                actor_name = u["username"] if u else None
                actor_cache[actor_id] = actor_name or ""
        out.append({
            "id": r.get("id"),
            "ts": r.get("ts"),
            "actor_user_id": actor_id,
            "actor": actor_name or "system",
            "action": r.get("action"),
            "target": r.get("target"),
            "ip": r.get("ip"),
            "user_agent": r.get("user_agent"),
            "data": r.get("data"),
        })
    return {"entries": out, "total": len(out)}
