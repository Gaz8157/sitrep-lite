from __future__ import annotations

import re
from typing import Any

from .config import read_config, write_config

_GUID_RE = re.compile(r"^[0-9A-Fa-f]{16}$")
_URL_GUID_RE = re.compile(r"/workshop/([0-9A-Fa-f]{16})")


def extract_guid(input_str: str) -> str:
    input_str = input_str.strip()
    if _GUID_RE.match(input_str):
        return input_str.upper()
    m = _URL_GUID_RE.search(input_str)
    if m:
        return m.group(1).upper()
    raise ValueError(f"Cannot extract mod GUID from: {input_str!r}")


def list_mods(*, instance_id: int | None = None) -> dict[str, Any]:
    cfg = read_config(instance_id=instance_id)
    mods = cfg.get("game", {}).get("mods", [])
    if not isinstance(mods, list):
        mods = []
    return {"mods": mods}


def add_mod(guid_or_url: str, *, instance_id: int | None = None) -> dict[str, Any]:
    guid = extract_guid(guid_or_url)
    cfg = read_config(instance_id=instance_id)
    game = cfg.setdefault("game", {})
    mods = game.setdefault("mods", [])
    if not isinstance(mods, list):
        mods = []
        game["mods"] = mods
    if any(m.get("modId") == guid for m in mods):
        return {"state": "already_added", "mod_guid": guid}
    mods.append({"modId": guid, "name": "", "version": ""})
    write_config(cfg, instance_id=instance_id)
    return {"state": "added", "mod_guid": guid}


def remove_mod(guid: str, *, instance_id: int | None = None) -> dict[str, Any]:
    cfg = read_config(instance_id=instance_id)
    game = cfg.get("game", {})
    mods = game.get("mods", [])
    game["mods"] = [m for m in mods if m.get("modId") != guid]
    write_config(cfg, instance_id=instance_id)
    return {"state": "removed", "mod_guid": guid}


def clear_mods(*, instance_id: int | None = None) -> dict[str, Any]:
    cfg = read_config(instance_id=instance_id)
    cfg.setdefault("game", {})["mods"] = []
    write_config(cfg, instance_id=instance_id)
    return {"state": "cleared"}
