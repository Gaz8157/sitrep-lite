from __future__ import annotations

from typing import Literal
from pydantic import BaseModel

Role = Literal["owner", "head_admin", "admin", "moderator", "viewer", "demo"]
RoleOrNone = Literal["none", "viewer", "moderator", "admin", "head_admin", "owner"]


class User(BaseModel):
    id: int
    username: str
    email: str
    role: Role
    avatar_path: str | None = None
    background_path: str | None = None
    discord_id: str | None = None
    discord_username: str | None = None
    totp_enabled: bool = False
    disabled: bool = False
    created_at: int
    last_login_at: int | None = None


class Session(BaseModel):
    id: str
    user_id: int
    created_at: int
    expires_at: int
    last_used_at: int
    ip: str | None = None
    user_agent: str | None = None
    remember: bool = False
