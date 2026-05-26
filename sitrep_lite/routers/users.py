"""Users router — CRUD + sessions."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from ..deps import get_current_user, get_client_ip, require_role
from ..repos import (
    users_repo, sessions_repo,
    password_resets_repo, audit_repo,
)
from ..services import smtp_service
from ..services.password_hash import hash_password, verify_password
from ..services.settings import settings

router = APIRouter(prefix="/api/users", tags=["users"])


Role = Literal["owner", "head_admin", "admin", "moderator", "viewer", "demo"]


class CreateUserIn(BaseModel):
    username: str
    email: EmailStr | None = None       # optional — invite-by-email needs it; direct-create doesn't
    role: Role
    password: str | None = None         # if set, account is active immediately; else invite-by-email


class UpdateUserIn(BaseModel):
    email: EmailStr | None = None
    role: Role | None = None
    disabled: bool | None = None


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


class UpdateMeIn(BaseModel):
    username: str | None = None
    email: EmailStr | None = None


def _public_user(u: dict) -> dict:
    return {
        "id": u["id"], "username": u["username"], "email": u["email"],
        "role": u["role"], "avatar_path": u.get("avatar_path"),
        "discord_id": u.get("discord_id"),
        "discord_username": u.get("discord_username"),
        "totp_enabled": bool(u.get("totp_secret")),
        "disabled": bool(u.get("disabled")),
        "created_at": u.get("created_at"),
        "last_login_at": u.get("last_login_at"),
    }


@router.get("")
async def list_users(
    user=Depends(require_role("owner", "head_admin", "admin")),
) -> dict:
    return {"users": [_public_user(u) for u in users_repo.list_all()]}


@router.post("")
async def create_user(
    body: CreateUserIn, background: BackgroundTasks, request: Request,
    user=Depends(require_role("owner")),
) -> dict:
    if users_repo.find_by_username(body.username):
        raise HTTPException(status_code=400, detail="username_taken")
    # Email is optional; only check uniqueness if one was provided.
    effective_email = body.email
    if effective_email and users_repo.find_by_email(effective_email):
        raise HTTPException(status_code=400, detail="email_taken")
    if not effective_email:
        # Placeholder satisfies UNIQUE NOT NULL. Operator can replace via Edit later.
        effective_email = f"{body.username}@local"
        if users_repo.find_by_email(effective_email):
            # Vanishingly rare collision; fall back to a hex suffix.
            import secrets as _s2
            effective_email = f"{body.username}-{_s2.token_hex(4)}@local"

    if body.password is not None:
        # Direct-create with a real password — user can sign in immediately.
        password_hash_val = hash_password(body.password)
        uid = users_repo.create(
            username=body.username, email=effective_email,
            password_hash=password_hash_val, role=body.role,
        )
        audit_repo.append(actor_user_id=user["id"], action="user.create",
                          target=f"user:{uid}", ip=get_client_ip(request),
                          data={"mode": "direct"})
        return {"user": _public_user(users_repo.get(uid))}
    # Invite-by-email path — needs a real email.
    if not body.email:
        raise HTTPException(status_code=400, detail="email_required_for_invite")
    import secrets as _s
    placeholder = hash_password(_s.token_hex(32))
    uid = users_repo.create(
        username=body.username, email=effective_email,
        password_hash=placeholder, role=body.role,
    )
    token = password_resets_repo.create(uid, ttl_sec=86400)
    background.add_task(
        smtp_service.send_reset_link,
        to=effective_email, token=token, settings=settings(),
    )
    audit_repo.append(actor_user_id=user["id"], action="user.create",
                      target=f"user:{uid}", ip=get_client_ip(request),
                      data={"mode": "invite"})
    return {"user": _public_user(users_repo.get(uid))}


# NOTE: /me/* routes must be registered BEFORE /{user_id}/* so FastAPI
# doesn't try to parse "me" as an int.
@router.patch("/me")
async def update_me(body: UpdateMeIn, request: Request) -> dict:
    """Self-service profile edit: username and/or email."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="not_logged_in")
    patch: dict = {}
    if body.username is not None:
        new_username = body.username.strip()
        if not new_username or len(new_username) > 32:
            raise HTTPException(status_code=400, detail="invalid_username")
        if new_username != user["username"]:
            existing = users_repo.find_by_username(new_username)
            if existing and existing["id"] != user["id"]:
                raise HTTPException(status_code=400, detail="username_taken")
            patch["username"] = new_username
    if body.email is not None:
        new_email = str(body.email).strip()
        if new_email and new_email != user["email"]:
            existing = users_repo.find_by_email(new_email)
            if existing and existing["id"] != user["id"]:
                raise HTTPException(status_code=400, detail="email_taken")
            patch["email"] = new_email
    if patch:
        users_repo.update(user["id"], **patch)
        audit_repo.append(actor_user_id=user["id"], action="profile.update",
                          data=patch, ip=get_client_ip(request))
    return {"user": _public_user(users_repo.get(user["id"]))}


@router.get("/{user_id}")
async def get_user(
    user_id: int, user=Depends(require_role("owner", "head_admin", "admin")),
) -> dict:
    u = users_repo.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="not_found")
    return {"user": _public_user(u)}


@router.patch("/{user_id}")
async def update_user(
    user_id: int, body: UpdateUserIn, request: Request,
    user=Depends(require_role("owner")),
) -> dict:
    u = users_repo.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="not_found")
    if u["role"] == "owner" and body.role and body.role != "owner":
        raise HTTPException(status_code=400, detail="cannot_demote_owner")
    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "disabled" in patch:
        patch["disabled"] = 1 if patch["disabled"] else 0
    if patch:
        users_repo.update(user_id, **patch)
    audit_repo.append(actor_user_id=user["id"], action="user.update",
                      target=f"user:{user_id}", data=patch,
                      ip=get_client_ip(request))
    return {"user": _public_user(users_repo.get(user_id))}


@router.delete("/{user_id}")
async def delete_user(
    user_id: int, request: Request,
    user=Depends(require_role("owner")),
) -> dict:
    u = users_repo.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="not_found")
    if u["role"] == "owner":
        raise HTTPException(status_code=400, detail="cannot_delete_owner")
    if u["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="cannot_delete_self")
    sessions_repo.delete_all_for(user_id)
    users_repo.delete(user_id)
    audit_repo.append(actor_user_id=user["id"], action="user.delete",
                      target=f"user:{user_id}",
                      data={"username": u.get("username"), "role": u.get("role")},
                      ip=get_client_ip(request))
    return {"ok": True, "deleted_user_id": user_id}


class DiscordLinkIn(BaseModel):
    discord_id: str
    discord_username: str | None = None


@router.put("/{user_id}/discord")
async def set_user_discord(
    user_id: int, body: DiscordLinkIn, request: Request,
    user=Depends(require_role("owner")),
) -> dict:
    """Manually link a Discord account to a user (admin override of OAuth flow).

    Mirrors v1's PUT /api/users/{username}/link-discord — the operator pastes
    the Discord snowflake themselves instead of round-tripping through OAuth.
    Refuses if the snowflake is already attached to a different account.
    """
    target = users_repo.get(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="not_found")
    did = (body.discord_id or "").strip()
    if not did or not did.isdigit() or not (15 <= len(did) <= 22):
        raise HTTPException(status_code=400, detail="invalid_discord_id")
    existing = users_repo.find_by_discord_id(did)
    if existing and existing["id"] != user_id:
        raise HTTPException(status_code=400, detail="discord_id_already_linked")
    users_repo.link_discord(user_id, did, (body.discord_username or "").strip())
    audit_repo.append(actor_user_id=user["id"], action="discord.link.admin",
                      target=f"user:{user_id}",
                      data={"discord_id": did},
                      ip=get_client_ip(request))
    return {"user": _public_user(users_repo.get(user_id))}


@router.delete("/{user_id}/discord")
async def clear_user_discord(
    user_id: int, request: Request,
    user=Depends(require_role("owner")),
) -> dict:
    target = users_repo.get(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="not_found")
    users_repo.update(user_id, discord_id=None, discord_username=None)
    audit_repo.append(actor_user_id=user["id"], action="discord.unlink.admin",
                      target=f"user:{user_id}", ip=get_client_ip(request))
    return {"user": _public_user(users_repo.get(user_id))}


@router.post("/me/password")
async def change_my_password(
    body: ChangePasswordIn, request: Request,
) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="not_logged_in")
    if not verify_password(body.old_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="invalid_old_password")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="password_too_short")
    users_repo.set_password(user["id"], hash_password(body.new_password))
    audit_repo.append(actor_user_id=user["id"], action="password.change",
                      ip=get_client_ip(request))
    return {"ok": True}


@router.get("/me/sessions")
async def my_sessions(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="not_logged_in")
    current_sid = request.cookies.get("sitrep-refresh")
    return {
        "sessions": [
            {
                "id": s["id"],
                "created_at": s["created_at"],
                "expires_at": s["expires_at"],
                "last_used_at": s["last_used_at"],
                "ip": s["ip"], "user_agent": s["user_agent"],
                "is_current": s["id"] == current_sid,
                "remember": bool(s["remember"]),
            }
            for s in sessions_repo.list_for(user["id"])
        ]
    }


@router.delete("/me/sessions/{sid}")
async def revoke_session(sid: str, request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="not_logged_in")
    target = sessions_repo.get(sid)
    if not target or target["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="not_found")
    sessions_repo.delete(sid)
    return {"ok": True}


@router.delete("/me/sessions")
async def revoke_all_other_sessions(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="not_logged_in")
    current = request.cookies.get("sitrep-refresh")
    count = 0
    for s in sessions_repo.list_for(user["id"]):
        if s["id"] != current:
            sessions_repo.delete(s["id"])
            count += 1
    return {"revoked": count}
