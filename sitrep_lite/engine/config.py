from __future__ import annotations

import json
from typing import Any

from ..paths import CONFIG_JSON


def _deep_merge(dst: dict, src: dict) -> dict:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            _deep_merge(dst[k], v)
        else:
            dst[k] = v
    return dst


def read_config() -> dict[str, Any]:
    if not CONFIG_JSON.exists():
        return {}
    return json.loads(CONFIG_JSON.read_text())


def write_config(config: dict[str, Any]) -> None:
    tmp = CONFIG_JSON.with_suffix(".tmp")
    tmp.write_text(json.dumps(config, indent=2) + "\n")
    tmp.replace(CONFIG_JSON)


def patch_config(patch: dict[str, Any]) -> dict[str, Any]:
    current = read_config()
    _deep_merge(current, patch)
    write_config(current)
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


def ensure_default_config(rcon_password: str) -> dict[str, Any]:
    if CONFIG_JSON.exists():
        return read_config()
    config = {
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
    write_config(config)
    return config
