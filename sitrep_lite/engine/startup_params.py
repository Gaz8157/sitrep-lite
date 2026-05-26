from __future__ import annotations

import json
from typing import Any

from ..paths import CONFIG_JSON, PROFILE_DIR, DATA_DIR, instance_config, instance_profile

_PARAMS_FILE = DATA_DIR / "startup_params.json"

PARAM_CATALOG = [
    {"key": "maxFPS", "label": "Max FPS", "type": "int", "default": 60, "category": "Performance", "description": "Server tick rate cap. Recommended 60–120. Without this the server will peg CPU.", "min": 10, "max": 240},
    {"key": "noSound", "label": "No Sound", "type": "flag", "default": True, "category": "Performance", "description": "Disable audio output. Always set on dedicated servers."},
    {"key": "noPause", "label": "No Pause", "type": "flag", "default": True, "category": "Performance", "description": "Prevent server from pausing when its window loses focus."},
    {"key": "nothrow", "label": "No Throw", "type": "flag", "default": False, "category": "Performance", "description": "Suppress assert errors on startup. Recommended for production stability."},
    {"key": "logStats", "label": "Log Stats Interval (ms)", "type": "int", "default": 0, "category": "Logging", "description": "Log FPS and performance data at this interval in milliseconds. 0 = disabled. e.g. 10000 = every 10s.", "min": 0},
    {"key": "logLevel", "label": "Log Level", "type": "enum", "default": "normal", "category": "Logging", "description": "Verbosity of console log output.", "options": ["normal", "warning", "error", "fatal"]},
    {"key": "logAppend", "label": "Log Append", "type": "flag", "default": False, "category": "Logging", "description": "Append to existing log file instead of creating a new one each start."},
    {"key": "logTime", "label": "Log Timestamps", "type": "flag", "default": False, "category": "Logging", "description": "Prefix every log line with a timestamp."},
    {"key": "keepCrashFiles", "label": "Keep Crash Files", "type": "flag", "default": False, "category": "Logging", "description": "Preserve crash dump files on disk for debugging."},
    {"key": "listScenarios", "label": "List Scenarios", "type": "flag", "default": False, "category": "Logging", "description": "Log all available scenario .conf paths on startup."},
    {"key": "disableCrashReporter", "label": "Disable Crash Reporter", "type": "flag", "default": False, "category": "Logging", "description": "Disable automatic crash report submission to Bohemia Interactive."},
    {"key": "backendLog", "label": "Backend Log", "type": "flag", "default": False, "category": "Logging", "description": "Enable backend logging output."},
    {"key": "aiLimit", "label": "AI Limit", "type": "int", "default": -1, "category": "AI", "description": "Maximum number of AI characters. -1 = unlimited.", "min": -1},
    {"key": "aiPartialSim", "label": "AI Partial Simulation", "type": "flag", "default": True, "category": "AI", "description": "Partial-simulate AI when no players are nearby. Required for GM-placed AI to persist away from players."},
    {"key": "disableAI", "label": "Disable AI", "type": "flag", "default": False, "category": "AI", "description": "Disable AI entirely. For testing/diagnostic use only."},
    {"key": "nds", "label": "Network Dynamic Sim", "type": "int", "default": 0, "category": "Network", "description": "Network Dynamic Simulation diameter. 0 = disabled.", "min": 0},
    {"key": "staggeringBudget", "label": "Staggering Budget", "type": "int", "default": 0, "category": "Network", "description": "Stationary spatial cells processed per tick (1–10201). Lower = fewer per tick, slower client stream-in. 0 = disabled.", "min": 0, "max": 10201},
    {"key": "streamingBudget", "label": "Streaming Budget", "type": "int", "default": 0, "category": "Network", "description": "Global entity streaming budget split across all connections. Minimum 100 when set. 0 = disabled.", "min": 0},
    {"key": "loadSessionSave", "label": "Load Session Save", "type": "string", "default": "", "category": "Persistence", "description": "Load a session save by UUID, or 'latest' for the most recent save of the current scenario."},
    {"key": "keepSessionSave", "label": "Keep Session Save", "type": "flag", "default": False, "category": "Persistence", "description": "Preserve the session save between server restarts."},
]


def categories_in_order() -> list[str]:
    seen: list[str] = []
    for p in PARAM_CATALOG:
        c = p["category"]
        if c not in seen:
            seen.append(c)
    return seen


def catalog() -> dict[str, Any]:
    return {"params": PARAM_CATALOG}


def read_params() -> dict[str, Any]:
    if _PARAMS_FILE.exists():
        data = json.loads(_PARAMS_FILE.read_text())
    else:
        data = {"params": {}, "customLaunchParams": ""}
    current = data.get("params", {})
    if isinstance(current, list):
        current = {}
    merged = []
    for p in PARAM_CATALOG:
        entry = dict(p)
        entry["value"] = current.get(p["key"], p.get("default"))
        entry["active"] = p["key"] in current
        merged.append(entry)
    return {
        "params": merged,
        "categories": categories_in_order(),
        "customLaunchParams": data.get("customLaunchParams", ""),
    }


def write_params(params: dict[str, Any], custom_launch_params: str = "") -> dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Merge incoming edits with existing saved params so untouched keys persist.
    if _PARAMS_FILE.exists():
        existing = json.loads(_PARAMS_FILE.read_text()).get("params", {})
        if isinstance(existing, list):
            existing = {}
    else:
        existing = {}
    existing.update(params)
    data = {"params": existing, "customLaunchParams": custom_launch_params}
    _PARAMS_FILE.write_text(json.dumps(data, indent=2))
    return read_params()


def build_launch_args(instance_id: int | None = None) -> list[str]:
    if _PARAMS_FILE.exists():
        raw = json.loads(_PARAMS_FILE.read_text())
    else:
        raw = {"params": {}}
    current = raw.get("params", {})
    if isinstance(current, list):
        current = {}
    cfg = instance_config(instance_id) if instance_id is not None else CONFIG_JSON
    prof = instance_profile(instance_id) if instance_id is not None else PROFILE_DIR
    args = [
        f"-config={cfg}",
        f"-profile={prof}",
        f"-logDir={prof / 'logs'}",
    ]
    for p in PARAM_CATALOG:
        key = p["key"]
        val = current.get(key)
        if val is None:
            val = p.get("default")
        if p["type"] == "flag":
            if val:
                args.append(f"-{key}")
        elif p["type"] == "string":
            if val:
                args.append(f"-{key}={val}")
        elif p["type"] in ("int", "enum"):
            if val is not None and val != 0:
                args.append(f"-{key}={val}")
    custom = raw.get("customLaunchParams", "").strip()
    if custom:
        args.extend(custom.split())
    return args
