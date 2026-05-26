"""TOTP helpers (RFC 6238) + one-shot backup codes.

State lives in users.totp_secret / users.totp_backup_codes (JSON array).
This module is stateless — callers persist the result.
"""
from __future__ import annotations

import secrets
import pyotp


def new_secret() -> str:
    """Return a fresh base32 TOTP secret (160 bits)."""
    return pyotp.random_base32()


def provisioning_uri(*, secret: str, username: str, issuer: str = "SITREP") -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name=issuer)


def verify_code(secret: str, code: str, *, valid_window: int = 1) -> bool:
    """Verify a 6-digit TOTP code. valid_window=1 accepts ±30s of clock drift."""
    if not secret or not code:
        return False
    try:
        return pyotp.TOTP(secret).verify(code.replace(" ", ""), valid_window=valid_window)
    except Exception:
        return False


def generate_backup_codes(count: int = 10) -> list[str]:
    """Return `count` one-shot 8-char alphanumeric backup codes."""
    alphabet = "0123456789abcdefghjkmnpqrstuvwxyz"
    return [
        "".join(secrets.choice(alphabet) for _ in range(8))
        for _ in range(count)
    ]


def consume_backup_code(codes: list[str], submitted: str) -> tuple[list[str], bool]:
    """Return (remaining_codes, matched)."""
    s = submitted.strip().lower().replace("-", "").replace(" ", "")
    if s in codes:
        return [c for c in codes if c != s], True
    return codes, False
