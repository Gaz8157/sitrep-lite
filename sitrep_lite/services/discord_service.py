"""Discord OAuth2 helpers — authorize_url, exchange_code, fetch_me."""
from __future__ import annotations

from urllib.parse import urlencode
import httpx

from typing import Any

DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN = "https://discord.com/api/oauth2/token"
DISCORD_ME = "https://discord.com/api/users/@me"


def authorize_url(*, state: str, settings: Any) -> str:
    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.discord_redirect_uri,
        "response_type": "code",
        "scope": "identify email",
        "state": state,
    }
    return f"{DISCORD_AUTHORIZE}?{urlencode(params)}"


async def exchange_code(*, code: str, settings: Any) -> str:
    """Exchange the OAuth code for an access token. Returns the access_token."""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            DISCORD_TOKEN,
            data={
                "client_id": settings.discord_client_id,
                "client_secret": settings.discord_client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.discord_redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        r.raise_for_status()
        return r.json()["access_token"]


async def fetch_me(*, access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(DISCORD_ME, headers={"Authorization": f"Bearer {access_token}"})
        r.raise_for_status()
        return r.json()
