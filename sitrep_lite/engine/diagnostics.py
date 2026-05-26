from __future__ import annotations

from typing import Any

from ..paths import SERVER_EXE, CONFIG_JSON, PROFILE_DIR
from .config import read_config


def run_checks() -> dict[str, Any]:
    checks = []
    checks.append(_check_binary())
    checks.append(_check_config())
    checks.append(_check_profile())
    return {"checks": checks}


def _check_binary() -> dict[str, Any]:
    ok = SERVER_EXE.exists()
    return {
        "id": "binary_installed",
        "label": "Server Binary",
        "ok": ok,
        "message": "Installed" if ok else "Not installed — use Install Server",
        "fix_id": "install_server" if not ok else None,
    }


def _check_config() -> dict[str, Any]:
    if not CONFIG_JSON.exists():
        return {"id": "config_exists", "label": "Config File", "ok": False,
                "message": "config.json missing", "fix_id": "create_default_config"}
    try:
        cfg = read_config()
        game = cfg.get("game", {})
        if not game.get("scenarioId"):
            return {"id": "config_valid", "label": "Config Valid", "ok": False,
                    "message": "No scenario selected", "fix_id": None}
    except Exception as e:
        return {"id": "config_valid", "label": "Config Valid", "ok": False,
                "message": f"Config parse error: {e}", "fix_id": None}
    return {"id": "config_valid", "label": "Config Valid", "ok": True, "message": "OK"}


def _check_profile() -> dict[str, Any]:
    ok = PROFILE_DIR.exists()
    return {"id": "profile_dir", "label": "Profile Directory", "ok": ok,
            "message": "Exists" if ok else "Missing — will be created on server start"}


def apply_fix(fix_id: str, payload: dict | None = None) -> dict[str, Any]:
    if fix_id == "create_default_config":
        from .config import ensure_default_config
        from ..services.settings import _load_or_create_secrets
        secrets = _load_or_create_secrets()
        ensure_default_config(secrets.get("rcon_password", ""))
        return {"ok": True, "message": "Default config.json created"}
    return {"ok": False, "message": f"Unknown fix: {fix_id}"}
