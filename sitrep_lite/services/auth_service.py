from __future__ import annotations

import secrets
import time
from typing import Any

import jwt

from .settings import AuthSettings


def issue_access_jwt(*, user_id: int, settings: AuthSettings) -> str:
    now = int(time.time())
    payload = {"sub": str(user_id), "iat": now, "exp": now + settings.access_ttl_sec}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def decode_access_jwt(token: str, *, settings: AuthSettings) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])


def new_refresh_token() -> str:
    return secrets.token_hex(32)
