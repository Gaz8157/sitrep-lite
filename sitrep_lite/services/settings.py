from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from functools import lru_cache

from ..paths import SECRETS_FILE


@dataclass(frozen=True)
class AuthSettings:
    jwt_secret: str
    jwt_alg: str = "HS256"
    access_ttl_sec: int = 86400
    refresh_ttl_sec: int = 86400
    refresh_ttl_remember_sec: int = 2592000
    pending_2fa_ttl_sec: int = 300
    password_reset_ttl_sec: int = 1800

    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: str = ""

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = ""
    smtp_from_name: str = "SITREP Lite"

    auth_disabled: bool = False
    public_base_url: str = "http://localhost:8000"

    @property
    def discord_enabled(self) -> bool:
        return bool(self.discord_client_id and self.discord_client_secret
                     and self.discord_redirect_uri)

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_from)


def _load_or_create_secrets() -> dict:
    SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if SECRETS_FILE.exists():
        return json.loads(SECRETS_FILE.read_text())
    data = {
        "jwt_secret": secrets.token_hex(32),
        "rcon_password": secrets.token_hex(16),
    }
    SECRETS_FILE.write_text(json.dumps(data, indent=2))
    return data


def load_settings() -> AuthSettings:
    s = _load_or_create_secrets()
    return AuthSettings(jwt_secret=s["jwt_secret"])


@lru_cache(maxsize=1)
def settings() -> AuthSettings:
    return load_settings()


def reload_settings() -> AuthSettings:
    settings.cache_clear()
    return settings()
