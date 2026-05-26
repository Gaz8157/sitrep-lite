"""argon2id password hashing. Single module so we can swap hashers later."""
from __future__ import annotations

from passlib.context import CryptContext

_ctx = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plaintext: str) -> str:
    return _ctx.hash(plaintext)


def verify_password(plaintext: str, stored_hash: str) -> bool:
    try:
        return _ctx.verify(plaintext, stored_hash)
    except (ValueError, TypeError):
        return False
