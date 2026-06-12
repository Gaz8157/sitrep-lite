"""Instance manager -- CRUD for server instances + engine registry."""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path
from typing import Any

from .. import paths
from ..paths import instance_dir, instance_config
from .server_engine import ServerEngine
from .config import ensure_default_config_for

_engines: dict[int, ServerEngine] = {}


def _meta_path(instance_id: int) -> Path:
    return instance_dir(instance_id) / "instance.json"


def _load_meta(instance_id: int) -> dict[str, Any]:
    p = _meta_path(instance_id)
    if p.exists():
        return json.loads(p.read_text())
    return {"id": instance_id, "name": f"Server {instance_id}", "created_at": 0}


def _save_meta(instance_id: int, meta: dict[str, Any]) -> None:
    p = _meta_path(instance_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(meta, indent=2))


def list_instances() -> list[dict[str, Any]]:
    if not paths.INSTANCES_DIR.exists():
        return []
    instances = []
    for d in sorted(paths.INSTANCES_DIR.iterdir()):
        if d.is_dir() and d.name.isdigit():
            iid = int(d.name)
            meta = _load_meta(iid)
            engine = get_engine(iid)
            status = engine.lifecycle.status()
            instances.append({**meta, **status, "id": iid, "instance_id": iid})
    return instances


def create_instance(name: str = "") -> dict[str, Any]:
    paths.INSTANCES_DIR.mkdir(parents=True, exist_ok=True)
    existing = [int(d.name) for d in paths.INSTANCES_DIR.iterdir() if d.is_dir() and d.name.isdigit()]
    new_id = max(existing, default=0) + 1
    d = instance_dir(new_id)
    d.mkdir(parents=True, exist_ok=True)
    (d / "profile").mkdir(exist_ok=True)
    meta = {"id": new_id, "name": name or f"Server {new_id}", "created_at": int(time.time())}
    _save_meta(new_id, meta)
    from ..services.settings import _load_or_create_secrets
    secrets = _load_or_create_secrets()
    rcon_pw = secrets.get("rcon_password", "")
    ensure_default_config_for(new_id, rcon_pw)
    return meta


def delete_instance(instance_id: int) -> dict[str, Any]:
    engine = _engines.pop(instance_id, None)
    if engine and engine.lifecycle.pid:
        engine.lifecycle.stop()
    d = instance_dir(instance_id)
    if d.exists():
        shutil.rmtree(d)
    return {"deleted": instance_id}


def rename_instance(instance_id: int, name: str) -> dict[str, Any]:
    meta = _load_meta(instance_id)
    meta["name"] = name
    _save_meta(instance_id, meta)
    return meta


def get_engine(instance_id: int) -> ServerEngine:
    if instance_id not in _engines:
        _engines[instance_id] = ServerEngine(instance_id)
    return _engines[instance_id]


def ensure_default_instance() -> None:
    """Create instance 1 if no instances exist."""
    if not paths.INSTANCES_DIR.exists() or not any(
        d.is_dir() and d.name.isdigit() for d in paths.INSTANCES_DIR.iterdir()
    ):
        create_instance("Server 1")


def stop_all() -> None:
    for engine in _engines.values():
        if engine.lifecycle.pid:
            engine.lifecycle.stop()
