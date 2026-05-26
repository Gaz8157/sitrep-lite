"""SMTP send via aiosmtplib. Used only for password reset for now.

send_reset_link is fire-and-forget — failures are logged but never
propagated to the request that triggered them (per spec §5.5).
"""
from __future__ import annotations

import logging
from email.message import EmailMessage
import aiosmtplib

from typing import Any

log = logging.getLogger("sitrep.smtp")


def build_reset_email(*, to: str, token: str, settings: Any) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = f'{settings.smtp_from_name} <{settings.smtp_from}>'
    msg["To"] = to
    msg["Subject"] = "Reset your SITREP password"
    link = f"{settings.public_base_url}/login?reset_token={token}"
    body = (
        f"Hi,\n\n"
        f"Use the link below to set a new password. It expires in 30 minutes.\n\n"
        f"{link}\n\n"
        f"If you didn't request this, ignore this email.\n"
    )
    msg.set_content(body)
    return msg


async def send_reset_link(*, to: str, token: str, settings: Any) -> bool:
    """Background send. Returns True on success, False on any error (logged)."""
    if not settings.smtp_enabled:
        log.warning("SMTP disabled; would have sent reset link to %s", to)
        return False
    try:
        msg = build_reset_email(to=to, token=token, settings=settings)
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_pass or None,
            start_tls=True,
            timeout=10,
        )
        return True
    except Exception as e:
        log.exception("send_reset_link failed: %s", e)
        return False
