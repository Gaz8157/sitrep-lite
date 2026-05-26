from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..paths import CONFIG_JSON, instance_config


def _deep_merge(dst: dict, src: dict) -> dict:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            _deep_merge(dst[k], v)
        else:
            dst[k] = v
    return dst


def _resolve_cfg(config_path: Path | None = None, instance_id: int | None = None) -> Path:
    if config_path is not None:
        return config_path
    if instance_id is not None:
        return instance_config(instance_id)
    return CONFIG_JSON


def read_config(config_path: Path | None = None, *, instance_id: int | None = None) -> dict[str, Any]:
    p = _resolve_cfg(config_path, instance_id)
    if not p.exists():
        return {}
    return json.loads(p.read_text())


def write_config(config: dict[str, Any], config_path: Path | None = None, *, instance_id: int | None = None) -> None:
    p = _resolve_cfg(config_path, instance_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(config, indent=2) + "\n")
    tmp.replace(p)


def patch_config(patch: dict[str, Any], config_path: Path | None = None, *, instance_id: int | None = None) -> dict[str, Any]:
    current = read_config(config_path, instance_id=instance_id)
    _deep_merge(current, patch)
    write_config(current, config_path, instance_id=instance_id)
    return current


def validate_config(config: dict[str, Any]) -> list[str]:
    errors = []
    game = config.get("game")
    if not isinstance(game, dict):
        errors.append("'game' section is required")
        return errors
    mp = game.get("maxPlayers")
    if mp is not None and (not isinstance(mp, int) or mp < 1 or mp > 256):
        errors.append("game.maxPlayers must be 1-256")
    bp = config.get("bindPort")
    if bp is not None and (not isinstance(bp, int) or bp < 1 or bp > 65535):
        errors.append("bindPort must be 1-65535")
    rcon = config.get("rcon", {})
    if isinstance(rcon, dict):
        rp = rcon.get("port")
        if rp is not None and (not isinstance(rp, int) or rp < 1 or rp > 65535):
            errors.append("rcon.port must be 1-65535")
    return errors


def _default_config_dict(rcon_password: str) -> dict[str, Any]:
    return {
        "bindAddress": "0.0.0.0",
        "bindPort": 2001,
        "publicAddress": "",
        "publicPort": 2001,
        "a2s": {"address": "0.0.0.0", "port": 17777},
        "rcon": {
            "address": "127.0.0.1",
            "port": 19999,
            "password": rcon_password,
            "permission": "admin",
            "blacklist": [],
            "whitelist": [],
        },
        "game": {
            "name": "SITREP Lite Server",
            "password": "",
            "passwordAdmin": "",
            "scenarioId": "{ECC61978EDCC2B5A}Missions/23_Campaign.conf",
            "maxPlayers": 32,
            "visible": True,
            "crossPlatform": True,
            "supportedPlatforms": ["PLATFORM_PC", "PLATFORM_XBL", "PLATFORM_PSN"],
            "gameProperties": {
                "serverMaxViewDistance": 2500,
                "serverMinGrassDistance": 50,
                "fastValidation": True,
                "networkViewDistance": 1500,
            },
            "mods": [],
        },
        "operating": {"lobbyPlayerSynchronise": True},
    }


def ensure_default_config(rcon_password: str) -> dict[str, Any]:
    if CONFIG_JSON.exists():
        return read_config()
    config = _default_config_dict(rcon_password)
    write_config(config)
    return config


def ensure_default_config_for(instance_id: int, rcon_password: str) -> dict[str, Any]:
    cfg_path = instance_config(instance_id)
    if cfg_path.exists():
        return json.loads(cfg_path.read_text())
    config = _default_config_dict(rcon_password)
    offset = instance_id - 1
    config["bindPort"] = 2001 + offset
    config["publicPort"] = 2001 + offset
    config["a2s"]["port"] = 17777 + offset
    config["rcon"]["port"] = 19999 + offset
    config["game"]["name"] = f"SITREP Lite Server {instance_id}"
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = cfg_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(config, indent=2) + "\n")
    tmp.replace(cfg_path)
    return config
