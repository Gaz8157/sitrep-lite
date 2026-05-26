from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from ..paths import PROFILE_DIR


def _safe_path(rel_path: str) -> Path:
    resolved = (PROFILE_DIR / rel_path).resolve()
    if not str(resolved).startswith(str(PROFILE_DIR.resolve())):
        raise ValueError(f"Path {rel_path!r} resolves outside profile directory")
    return resolved


def list_files(rel_path: str = "") -> dict[str, Any]:
    target = _safe_path(rel_path)
    if not target.exists():
        return {"path": rel_path, "entries": []}
    entries = []
    for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        stat = item.stat()
        entries.append({
            "name": item.name,
            "is_dir": item.is_dir(),
            "size": stat.st_size if item.is_file() else 0,
            "mtime": int(stat.st_mtime),
        })
    return {"path": rel_path, "entries": entries}


def read_file(rel_path: str) -> dict[str, Any]:
    target = _safe_path(rel_path)
    if not target.is_file():
        raise FileNotFoundError(f"{rel_path} not found")
    content = target.read_text(errors="replace")
    return {"path": rel_path, "content": content, "size": target.stat().st_size}


def write_file(rel_path: str, content: str) -> dict[str, Any]:
    target = _safe_path(rel_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    return {"path": rel_path, "size": target.stat().st_size}


def delete_file(rel_path: str) -> dict[str, Any]:
    target = _safe_path(rel_path)
    if target.is_dir():
        import shutil
        shutil.rmtree(target)
    elif target.is_file():
        target.unlink()
    else:
        raise FileNotFoundError(f"{rel_path} not found")
    return {"path": rel_path, "deleted": True}


def mkdir(rel_path: str) -> dict[str, Any]:
    target = _safe_path(rel_path)
    target.mkdir(parents=True, exist_ok=True)
    return {"path": rel_path, "created": True}
