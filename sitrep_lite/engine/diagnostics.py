from __future__ import annotations

from typing import Any

from ..paths import SERVER_EXE, CONFIG_JSON, PROFILE_DIR, instance_server_exe, instance_config, instance_profile
from .config import read_config


def run_checks(*, instance_id: int | None = None) -> dict[str, Any]:
    checks = []
    checks.append(_check_binary(instance_id=instance_id))
    checks.append(_check_config(instance_id=instance_id))
    checks.append(_check_profile(instance_id=instance_id))
    return {"checks": checks}


def _check_binary(*, instance_id: int | None = None) -> dict[str, Any]:
    exe = instance_server_exe(instance_id) if instance_id is not None else SERVER_EXE
    ok = exe.exists()
    return {
        "id": "binary_installed",
        "label": "Server Binary",
        "ok": ok,
        "message": "Installed" if ok else "Not installed -- use Install Server",
        "fix_id": "install_server" if not ok else None,
    }


def _check_config(*, instance_id: int | None = None) -> dict[str, Any]:
    cfg_path = instance_config(instance_id) if instance_id is not None else CONFIG_JSON
    if not cfg_path.exists():
        return {"id": "config_exists", "label": "Config File", "ok": False,
                "message": "config.json missing", "fix_id": "create_default_config"}
    try:
        cfg = read_config(instance_id=instance_id)
        game = cfg.get("game", {})
        if not game.get("scenarioId"):
            return {"id": "config_valid", "label": "Config Valid", "ok": False,
                    "message": "No scenario selected", "fix_id": None}
    except Exception as e:
        return {"id": "config_valid", "label": "Config Valid", "ok": False,
                "message": f"Config parse error: {e}", "fix_id": None}
    return {"id": "config_valid", "label": "Config Valid", "ok": True, "message": "OK"}


def _check_profile(*, instance_id: int | None = None) -> dict[str, Any]:
    prof = instance_profile(instance_id) if instance_id is not None else PROFILE_DIR
    ok = prof.exists()
    return {"id": "profile_dir", "label": "Profile Directory", "ok": ok,
            "message": "Exists" if ok else "Missing -- will be created on server start"}


def apply_fix(fix_id: str, payload: dict | None = None, *, instance_id: int | None = None) -> dict[str, Any]:
    if fix_id == "create_default_config":
        if instance_id is not None:
            from .config import ensure_default_config_for
            from ..services.settings import _load_or_create_secrets
            secrets = _load_or_create_secrets()
            ensure_default_config_for(instance_id, secrets.get("rcon_password", ""))
        else:
            from .config import ensure_default_config
            from ..services.settings import _load_or_create_secrets
            secrets = _load_or_create_secrets()
            ensure_default_config(secrets.get("rcon_password", ""))
        return {"ok": True, "message": "Default config.json created"}
    return {"ok": False, "message": f"Unknown fix: {fix_id}"}
