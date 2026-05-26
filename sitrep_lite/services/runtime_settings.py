"""Runtime config: env defaults overridden by panel_settings table.

Auth + JWT settings stay in the env-loaded AuthSettings (used by token signing
which can't change mid-process). This module provides the per-request view of
Discord and SMTP creds — values an operator can edit in the Admin → Settings UI.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..repos import settings_repo
from .settings import settings as base_settings


_RUNTIME_KEYS = (
    "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_REDIRECT_URI",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS",
    "SMTP_FROM", "SMTP_FROM_NAME",
)


@dataclass(frozen=True)
class IntegrationSettings:
    """Effective Discord + SMTP settings = env defaults | DB overrides."""
    discord_client_id: str
    discord_client_secret: str
    discord_redirect_uri: str
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_pass: str
    smtp_from: str
    smtp_from_name: str
    public_base_url: str

    @property
    def discord_enabled(self) -> bool:
        return bool(self.discord_client_id and self.discord_client_secret and self.discord_redirect_uri)

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_from)


def integrations() -> IntegrationSettings:
    """Read-once-per-request: env fallbacks + DB overrides."""
    env = base_settings()
    db = settings_repo.get_all()

    def _v(key: str, env_default: str) -> str:
        v = db.get(key)
        return v if v else env_default

    try:
        port = int(_v("SMTP_PORT", str(env.smtp_port)))
    except (TypeError, ValueError):
        port = env.smtp_port

    return IntegrationSettings(
        discord_client_id=_v("DISCORD_CLIENT_ID", env.discord_client_id),
        discord_client_secret=_v("DISCORD_CLIENT_SECRET", env.discord_client_secret),
        discord_redirect_uri=_v("DISCORD_REDIRECT_URI", env.discord_redirect_uri),
        smtp_host=_v("SMTP_HOST", env.smtp_host),
        smtp_port=port,
        smtp_user=_v("SMTP_USER", env.smtp_user),
        smtp_pass=_v("SMTP_PASS", env.smtp_pass),
        smtp_from=_v("SMTP_FROM", env.smtp_from),
        smtp_from_name=_v("SMTP_FROM_NAME", env.smtp_from_name),
        public_base_url=env.public_base_url,
    )


def runtime_keys() -> tuple[str, ...]:
    return _RUNTIME_KEYS
