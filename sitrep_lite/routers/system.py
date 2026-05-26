from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import require_role
from ..engine.metrics import system_metrics

router = APIRouter(prefix="/api/system", tags=["system"])

_READ_ROLES = ("owner", "head_admin", "admin", "moderator", "viewer", "demo")

@router.get("/metrics")
async def get_metrics(user=Depends(require_role(*_READ_ROLES))) -> dict:
    return system_metrics()
