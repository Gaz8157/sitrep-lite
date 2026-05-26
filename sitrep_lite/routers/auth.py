from __future__ import annotations

import asyncio
import json
import secrets
from random import uniform
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr

from ..deps import get_client_ip, get_current_user
from ..repos import (
    audit_repo,
    password_resets_repo,
    pending_2fa_repo,
    sessions_repo,
    users_repo,
)
from ..services import auth_service, discord_service, smtp_service, totp_service
from ..services.password_hash import hash_password, verify_password
from ..services.runtime_settings import integrations
from ..services.settings import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str
    remember: bool = False


class TotpVerifyIn(BaseModel):
    pending_token: str
    code: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str


class TwoFAEnableIn(BaseModel):
    code: str


class TwoFADisableIn(BaseModel):
    password: str


def _public_user(u: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": u["id"], "username": u["username"], "email": u["email"],
        "role": u["role"], "avatar_path": u.get("avatar_path"),
        "background_path": u.get("background_path"),
        "discord_id": u.get("discord_id"),
        "discord_username": u.get("discord_username"),
        "totp_enabled": bool(u.get("totp_secret")),
        "disabled": bool(u.get("disabled")),
        "last_login_at": u.get("last_login_at"),
    }


def _set_session_cookies(response: Response, *, access_jwt: str,
                         refresh_token: str, refresh_ttl_sec: int) -> None:
    response.set_cookie(
        "sitrep-access", access_jwt,
        max_age=settings().access_ttl_sec,
        httponly=True, secure=True, samesite="strict", path="/",
    )
    response.set_cookie(
        "sitrep-refresh", refresh_token,
        max_age=refresh_ttl_sec,
        httponly=True, secure=True, samesite="strict", path="/",
    )


def _clear_session_cookies(response: Response) -> None:
    for name in ("sitrep-access", "sitrep-refresh"):
        response.set_cookie(name, "", max_age=0, httponly=True,
                            secure=True, samesite="strict", path="/")


async def _issue_session(*, user: dict, remember: bool, response: Response,
                         request: Request) -> dict:
    s = settings()
    ttl = s.refresh_ttl_remember_sec if remember else s.refresh_ttl_sec
    refresh = sessions_repo.create(
        user_id=user["id"], ttl_sec=ttl,
        ip=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
        remember=remember,
    )
    access = auth_service.issue_access_jwt(user_id=user["id"], settings=s)
    _set_session_cookies(response, access_jwt=access, refresh_token=refresh,
                         refresh_ttl_sec=ttl)
    users_repo.record_login(user["id"], get_client_ip(request))
    audit_repo.append(
        actor_user_id=user["id"], action="login",
        ip=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
    )
    return {"user": _public_user(user)}


@router.get("/public-config")
async def public_config() -> dict:
    return {"discord_enabled": integrations().discord_enabled}


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response) -> dict:
    user = users_repo.find_by_username(body.username)
    if not user or user.get("disabled") or not verify_password(body.password, user["password_hash"]):
        await asyncio.sleep(uniform(0.1, 0.3))
        raise HTTPException(status_code=401, detail="invalid_credentials")
    if user.get("totp_secret"):
        token = pending_2fa_repo.create(user["id"], ttl_sec=settings().pending_2fa_ttl_sec)
        return {"requires_2fa": True, "pending_token": token}
    return await _issue_session(user=user, remember=body.remember,
                                response=response, request=request)


@router.post("/2fa/verify")
async def totp_verify(body: TotpVerifyIn, request: Request, response: Response) -> dict:
    row = pending_2fa_repo.consume(body.pending_token)
    if not row:
        raise HTTPException(status_code=401, detail="invalid_or_expired_token")
    user = users_repo.get(row["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="invalid_or_expired_token")
    if not totp_service.verify_code(user["totp_secret"], body.code):
        codes = json.loads(user.get("totp_backup_codes") or "[]")
        if isinstance(codes, list):
            remaining, ok = totp_service.consume_backup_code(codes, body.code)
        else:
            remaining, ok = [], False
        if not ok:
            raise HTTPException(status_code=401, detail="invalid_code")
        users_repo.update(user["id"], totp_backup_codes=json.dumps(remaining))
    return await _issue_session(user=user, remember=True,
                                response=response, request=request)


@router.post("/refresh")
async def refresh(request: Request, response: Response) -> dict:
    refresh_cookie = request.cookies.get("sitrep-refresh")
    if not refresh_cookie:
        _clear_session_cookies(response)
        raise HTTPException(status_code=401, detail="no_refresh_cookie")
    session = sessions_repo.get(refresh_cookie)
    if not session:
        _clear_session_cookies(response)
        raise HTTPException(status_code=401, detail="invalid_session")
    s = settings()
    ttl = s.refresh_ttl_remember_sec if session["remember"] else s.refresh_ttl_sec
    new_sid = sessions_repo.rotate(refresh_cookie, ttl_sec=ttl)
    if not new_sid:
        _clear_session_cookies(response)
        raise HTTPException(status_code=401, detail="rotation_failed")
    new_access = auth_service.issue_access_jwt(user_id=session["user_id"], settings=s)
    _set_session_cookies(response, access_jwt=new_access,
                         refresh_token=new_sid, refresh_ttl_sec=ttl)
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response) -> dict:
    refresh_cookie = request.cookies.get("sitrep-refresh")
    if refresh_cookie:
        sessions_repo.delete(refresh_cookie)
    user = await get_current_user(request)
    if user:
        audit_repo.append(actor_user_id=user["id"], action="logout",
                          ip=get_client_ip(request))
    _clear_session_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="not_logged_in")
    return {"user": _public_user(user)}


@router.post("/forgot-password")
async def forgot_password(body: ForgotIn, background: BackgroundTasks) -> dict:
    user = users_repo.find_by_email(body.email)
    if user:
        token = password_resets_repo.create(user["id"],
                                            ttl_sec=settings().password_reset_ttl_sec)
        background.add_task(
            smtp_service.send_reset_link,
            to=user["email"], token=token, settings=integrations(),
        )
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(body: ResetIn) -> dict:
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="password_too_short")
    row = password_resets_repo.get(body.token)
    if not row:
        raise HTTPException(status_code=400, detail="invalid_or_expired")
    users_repo.set_password(row["user_id"], hash_password(body.password))
    password_resets_repo.mark_used(body.token)
    sessions_repo.delete_all_for(row["user_id"])
    audit_repo.append(actor_user_id=row["user_id"], action="password.reset")
    return {"ok": True}


@router.get("/2fa/setup")
async def totp_setup(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="not_logged_in")
    secret = totp_service.new_secret()
    uri = totp_service.provisioning_uri(secret=secret, username=user["username"])
    backup = totp_service.generate_backup_codes()
    users_repo.update(
        user["id"], totp_secret=None,
        totp_backup_codes=json.dumps({"pending_secret": secret, "pending_codes": backup}),
    )
    return {"provisioning_uri": uri, "backup_codes": backup}


@router.post("/2fa/enable")
async def totp_enable(body: TwoFAEnableIn, request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="not_logged_in")
    stash = json.loads(user.get("totp_backup_codes") or "{}")
    pending = stash.get("pending_secret") if isinstance(stash, dict) else None
    if not pending or not totp_service.verify_code(pending, body.code):
        raise HTTPException(status_code=400, detail="invalid_code")
    users_repo.update(user["id"], totp_secret=pending,
                      totp_backup_codes=json.dumps(stash["pending_codes"]))
    audit_repo.append(actor_user_id=user["id"], action="2fa.enable")
    return {"enabled": True}


@router.post("/2fa/disable")
async def totp_disable(body: TwoFADisableIn, request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="not_logged_in")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="invalid_password")
    users_repo.update(user["id"], totp_secret=None, totp_backup_codes=None)
    audit_repo.append(actor_user_id=user["id"], action="2fa.disable")
    return {"enabled": False}


@router.get("/discord")
async def discord_redirect(request: Request, link: int = 0) -> Any:
    s = integrations()
    if not s.discord_enabled:
        raise HTTPException(status_code=400, detail="discord_not_configured")
    state = secrets.token_hex(16)
    url = discord_service.authorize_url(state=state, settings=s)
    resp = RedirectResponse(url, status_code=302)
    resp.set_cookie("sitrep-oauth-state", state, max_age=300,
                    httponly=True, secure=True, samesite="lax", path="/")
    if link:
        user = await get_current_user(request)
        if user and user.get("id"):
            resp.set_cookie(
                "sitrep-oauth-link", str(user["id"]),
                max_age=300, httponly=True, secure=True, samesite="lax", path="/",
            )
    return resp


@router.get("/discord/callback")
async def discord_callback(request: Request, code: str = "", state: str = "") -> Any:
    s = integrations()
    link_cookie = request.cookies.get("sitrep-oauth-link")
    link_user_id: int | None = None
    if link_cookie:
        try:
            link_user_id = int(link_cookie)
        except ValueError:
            link_user_id = None

    def _with_clear(resp: RedirectResponse) -> RedirectResponse:
        resp.delete_cookie("sitrep-oauth-link", path="/")
        resp.delete_cookie("sitrep-oauth-state", path="/")
        return resp

    cookie_state = request.cookies.get("sitrep-oauth-state")
    if not state or state != cookie_state:
        return _with_clear(RedirectResponse(
            f"{s.public_base_url}/login?discord_error=state_mismatch", status_code=302))
    if not s.discord_enabled:
        return _with_clear(RedirectResponse(
            f"{s.public_base_url}/login?discord_error=not_configured", status_code=302))
    try:
        access_token = await discord_service.exchange_code(code=code, settings=s)
        me_data = await discord_service.fetch_me(access_token=access_token)
    except Exception:
        return _with_clear(RedirectResponse(
            f"{s.public_base_url}/login?discord_error=exchange_failed", status_code=302))

    if link_user_id is not None:
        current = await get_current_user(request)
        if current and current["id"] == link_user_id:
            existing_by_discord = users_repo.find_by_discord_id(me_data["id"])
            if existing_by_discord and existing_by_discord["id"] != current["id"]:
                return _with_clear(RedirectResponse(
                    f"{s.public_base_url}/?discord_error=already_linked_other_account",
                    status_code=302,
                ))
            users_repo.link_discord(current["id"], me_data["id"], me_data.get("username") or "")
            audit_repo.append(
                actor_user_id=current["id"], action="discord.link",
                target=f"discord:{me_data['id']}", ip=get_client_ip(request),
            )
            return _with_clear(RedirectResponse(
                f"{s.public_base_url}/#profile", status_code=302))

    user = users_repo.find_by_discord_id(me_data["id"])
    if user is None and me_data.get("email"):
        user = users_repo.find_by_email(me_data["email"])
        if user:
            users_repo.link_discord(user["id"], me_data["id"], me_data["username"])
    if not user:
        return _with_clear(RedirectResponse(
            f"{s.public_base_url}/login?discord_error=no_account", status_code=302))

    response = RedirectResponse(f"{s.public_base_url}/", status_code=302)
    await _issue_session(user=user, remember=True, response=response, request=request)
    return _with_clear(response)


@router.delete("/discord/link")
async def discord_unlink(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="not_logged_in")
    users_repo.update(user["id"], discord_id=None, discord_username=None)
    audit_repo.append(actor_user_id=user["id"], action="discord.unlink",
                      ip=get_client_ip(request))
    return {"ok": True}
