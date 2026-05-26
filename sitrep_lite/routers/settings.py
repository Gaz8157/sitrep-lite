"""Operator-settable runtime config — Discord OAuth + SMTP creds.

Owner-only. Values persist in panel_settings; reads are per-request via
runtime_settings.integrations() so changes take effect immediately.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..deps import get_client_ip, require_role
from ..repos import audit_repo, settings_repo
from ..services.runtime_settings import integrations, runtime_keys

router = APIRouter(prefix="/api/settings", tags=["settings"])


class IntegrationsIn(BaseModel):
    DISCORD_CLIENT_ID: str | None = None
    DISCORD_CLIENT_SECRET: str | None = None
    DISCORD_REDIRECT_URI: str | None = None
    SMTP_HOST: str | None = None
    SMTP_PORT: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASS: str | None = None
    SMTP_FROM: str | None = None
    SMTP_FROM_NAME: str | None = None


def _redact(values: dict[str, str]) -> dict[str, str]:
    """Mask secret-looking fields before returning to the client."""
    out = dict(values)
    for k in ("DISCORD_CLIENT_SECRET", "SMTP_PASS"):
        if out.get(k):
            out[k] = "*" * 8
    return out


@router.get("/integrations")
async def get_integrations(
    user=Depends(require_role("owner", "head_admin")),
) -> dict[str, Any]:
    """Return the effective values. Secrets masked unless empty."""
    s = integrations()
    raw = {
        "DISCORD_CLIENT_ID": s.discord_client_id,
        "DISCORD_CLIENT_SECRET": s.discord_client_secret,
        "DISCORD_REDIRECT_URI": s.discord_redirect_uri,
        "SMTP_HOST": s.smtp_host,
        "SMTP_PORT": str(s.smtp_port) if s.smtp_port else "",
        "SMTP_USER": s.smtp_user,
        "SMTP_PASS": s.smtp_pass,
        "SMTP_FROM": s.smtp_from,
        "SMTP_FROM_NAME": s.smtp_from_name,
    }
    return {
        "values": _redact(raw),
        "discord_enabled": s.discord_enabled,
        "smtp_enabled": s.smtp_enabled,
    }


@router.put("/integrations")
async def set_integrations(
    body: IntegrationsIn, request: Request,
    user=Depends(require_role("owner")),
) -> dict[str, Any]:
    """Save changed fields. Empty string clears the override (falls back to env)."""
    raw = body.model_dump(exclude_none=True)
    allowed = set(runtime_keys())
    cleaned = {k: v for k, v in raw.items() if k in allowed}
    if not cleaned:
        raise HTTPException(status_code=400, detail="no_changes")
    settings_repo.set_many(cleaned, updated_by=user["id"])
    audit_repo.append(
        actor_user_id=user["id"], action="settings.update",
        target="integrations",
        data={k: ("***" if k in ("DISCORD_CLIENT_SECRET", "SMTP_PASS") else v) for k, v in cleaned.items()},
        ip=get_client_ip(request),
    )
    return await get_integrations(user=user)
