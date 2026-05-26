from __future__ import annotations

import json
from typing import Any

from ..paths import CONFIG_JSON, PROFILE_DIR, DATA_DIR

_PARAMS_FILE = DATA_DIR / "startup_params.json"

PARAM_CATALOG = [
    {"key": "maxFPS", "type": "int", "default": 60, "label": "Max FPS", "desc": "Server frame rate cap"},
    {"key": "maxPlayers", "type": "int", "default": 32, "label": "Max Players (CLI override)"},
    {"key": "nds", "type": "int", "default": 128, "label": "Network Data Size"},
    {"key": "nwkResolution", "type": "int", "default": 2, "label": "Network Resolution"},
    {"key": "staggeringBudget", "type": "int", "default": 2500, "label": "Staggering Budget"},
    {"key": "streamingBudget", "type": "int", "default": 500, "label": "Streaming Budget"},
    {"key": "streamsDelta", "type": "int", "default": 100, "label": "Streams Delta"},
    {"key": "logLevel", "type": "string", "default": "normal", "label": "Log Level"},
]


def catalog() -> dict[str, Any]:
    return {"params": PARAM_CATALOG}


def read_params() -> dict[str, Any]:
    if _PARAMS_FILE.exists():
        data = json.loads(_PARAMS_FILE.read_text())
    else:
        data = {"params": {}, "customLaunchParams": ""}
    return {
        "catalog": PARAM_CATALOG,
        "current": data.get("params", {}),
        "customLaunchParams": data.get("customLaunchParams", ""),
    }


def write_params(params: dict[str, Any], custom_launch_params: str = "") -> dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    data = {"params": params, "customLaunchParams": custom_launch_params}
    _PARAMS_FILE.write_text(json.dumps(data, indent=2))
    return read_params()


def build_launch_args() -> list[str]:
    data = read_params()
    args = [
        f"-config={CONFIG_JSON}",
        f"-profile={PROFILE_DIR}",
        f"-logDir={PROFILE_DIR / 'logs'}",
    ]
    for p in PARAM_CATALOG:
        key = p["key"]
        val = data["current"].get(key, p.get("default"))
        if val is not None:
            args.append(f"-{key}={val}")
    custom = data.get("customLaunchParams", "").strip()
    if custom:
        args.extend(custom.split())
    return args
