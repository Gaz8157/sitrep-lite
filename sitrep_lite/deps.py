from __future__ import annotations

from typing import Any
from fastapi import HTTPException, Request

import jwt

from .repos import users_repo
from .services import auth_service
from .services.settings import settings


async def get_current_user(request: Request) -> dict[str, Any] | None:
    s = settings()
    if s.auth_disabled:
        return {"id": 0, "username": "owner", "email": "", "role": "owner", "disabled": 0}
    token = request.cookies.get("sitrep-access")
    if not token:
        return None
    try:
        payload = auth_service.decode_access_jwt(token, settings=s)
    except jwt.PyJWTError:
        return None
    try:
        uid = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return None
    user = users_repo.get(uid)
    if not user or user.get("disabled"):
        return None
    return user


def require_role(*allowed: str):
    async def dep(request: Request) -> dict[str, Any]:
        user = await get_current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="not_logged_in")
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="forbidden")
        return user
    return dep


def require_server_role(*allowed: str):
    async def dep(request: Request, instance_id: int) -> dict[str, Any]:
        user = await get_current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="not_logged_in")
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="forbidden")
        return user
    return dep


def get_client_ip(request: Request) -> str | None:
    return request.headers.get("CF-Connecting-IP") or (
        request.client.host if request.client else None
    )
