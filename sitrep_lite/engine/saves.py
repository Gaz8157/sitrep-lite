from __future__ import annotations

import shutil
import time
import zipfile
from pathlib import Path
from typing import Any

from ..paths import PROFILE_DIR, BACKUPS_DIR, instance_profile


def _profile_root(instance_id: int | None = None) -> Path:
    if instance_id is not None:
        return instance_profile(instance_id)
    return PROFILE_DIR


def _save_dir(instance_id: int | None = None) -> Path:
    return _profile_root(instance_id) / ".save"


def list_saves(*, instance_id: int | None = None) -> dict[str, Any]:
    sd = _save_dir(instance_id)
    if not sd.exists():
        return {"saves": []}
    saves = []
    for item in sorted(sd.iterdir()):
        if item.is_dir():
            total_size = sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
            saves.append({
                "name": item.name,
                "size": total_size,
                "mtime": int(item.stat().st_mtime),
            })
    return {"saves": saves}


def inspect_save(save_path: str, *, instance_id: int | None = None) -> dict[str, Any]:
    target = _save_dir(instance_id) / save_path
    if not target.is_dir():
        raise FileNotFoundError(f"Save {save_path!r} not found")
    files = []
    for f in target.rglob("*"):
        if f.is_file():
            files.append({"path": str(f.relative_to(target)), "size": f.stat().st_size})
    return {"name": save_path, "files": files}


def purge_save(save_path: str | None = None, *, instance_id: int | None = None) -> dict[str, Any]:
    if save_path:
        target = _save_dir(instance_id) / save_path
        if target.is_dir():
            shutil.rmtree(target)
        return {"purged": save_path}
    sd = _save_dir(instance_id)
    if sd.exists():
        shutil.rmtree(sd)
        sd.mkdir()
    return {"purged": "all"}


def create_backup(*, instance_id: int | None = None) -> dict[str, Any]:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    prefix = f"i{instance_id}-" if instance_id is not None else ""
    filename = f"backup-{prefix}{ts}.zip"
    zip_path = BACKUPS_DIR / filename
    profile = _profile_root(instance_id)
    sd = _save_dir(instance_id)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        if sd.exists():
            for f in sd.rglob("*"):
                if f.is_file():
                    zf.write(f, f.relative_to(profile))
    return {"filename": filename, "size": zip_path.stat().st_size}


def list_backups(*, instance_id: int | None = None) -> dict[str, Any]:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    backups = []
    for f in sorted(BACKUPS_DIR.glob("backup-*.zip"), reverse=True):
        backups.append({"filename": f.name, "size": f.stat().st_size, "mtime": int(f.stat().st_mtime)})
    return {"backups": backups}


def restore_backup(filename: str, *, instance_id: int | None = None) -> dict[str, Any]:
    zip_path = BACKUPS_DIR / filename
    if not zip_path.is_file():
        raise FileNotFoundError(f"Backup {filename!r} not found")
    profile = _profile_root(instance_id)
    sd = _save_dir(instance_id)
    if sd.exists():
        shutil.rmtree(sd)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(profile)
    return {"restored": filename}


def delete_backup(filename: str, *, instance_id: int | None = None) -> dict[str, Any]:
    zip_path = BACKUPS_DIR / filename
    if not zip_path.is_file():
        raise FileNotFoundError(f"Backup {filename!r} not found")
    zip_path.unlink()
    return {"deleted": filename}
