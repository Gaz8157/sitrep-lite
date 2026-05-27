from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import psutil

from ..paths import DATA_DIR

log = logging.getLogger(__name__)

CPU_AFFINITY_FILE = DATA_DIR / "cpu_affinity.json"
MEMORY_SETTINGS_FILE = DATA_DIR / "memory_settings.json"

_DEFAULT_MEMORY = {
    "budget_mb": 0,
    "headroom_mb": 0,
    "ceiling_mb": 0,
    "preset": "production",
    "watcher_enabled": False,
    "auto_raise": False,
    "oom_adj": 0,
}


def _build_topology() -> list[dict[str, Any]]:
    total = psutil.cpu_count(logical=True) or 1
    if total <= 16:
        half = total // 2
        return [
            {"cpu_list": f"0-{half - 1}", "cpu_count": half},
            {"cpu_list": f"{half}-{total - 1}", "cpu_count": total - half},
        ]
    quarter = total // 4
    groups: list[dict[str, Any]] = []
    for i in range(4):
        lo = i * quarter
        hi = lo + quarter - 1 if i < 3 else total - 1
        groups.append({"cpu_list": f"{lo}-{hi}", "cpu_count": hi - lo + 1})
    return groups


def _cpu_list_from_mode(mode: str) -> list[int]:
    topo = _build_topology()
    total = psutil.cpu_count(logical=True) or 1
    if mode == "ccd0" and len(topo) >= 1:
        return _parse_cpu_list(topo[0]["cpu_list"])
    if mode == "ccd1" and len(topo) >= 2:
        return _parse_cpu_list(topo[1]["cpu_list"])
    return list(range(total))


def _parse_cpu_list(s: str) -> list[int]:
    cpus: list[int] = []
    for part in s.split(","):
        part = part.strip()
        if "-" in part:
            lo, hi = part.split("-", 1)
            cpus.extend(range(int(lo), int(hi) + 1))
        else:
            cpus.append(int(part))
    return cpus


def _format_cpu_list(cpus: list[int]) -> str:
    if not cpus:
        return ""
    cpus = sorted(set(cpus))
    ranges: list[str] = []
    start = cpus[0]
    end = cpus[0]
    for c in cpus[1:]:
        if c == end + 1:
            end = c
        else:
            ranges.append(f"{start}-{end}" if start != end else str(start))
            start = end = c
    ranges.append(f"{start}-{end}" if start != end else str(start))
    return ",".join(ranges)


def _load_affinity_prefs() -> dict[str, Any]:
    if CPU_AFFINITY_FILE.exists():
        try:
            return json.loads(CPU_AFFINITY_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {"mode": "auto", "cpu_list": ""}


def _save_affinity_prefs(prefs: dict[str, Any]) -> None:
    CPU_AFFINITY_FILE.parent.mkdir(parents=True, exist_ok=True)
    CPU_AFFINITY_FILE.write_text(json.dumps(prefs, indent=2))


def get_cpu_affinity(instance_id: int) -> dict[str, Any]:
    prefs = _load_affinity_prefs()
    total = psutil.cpu_count(logical=True) or 1
    all_cores = list(range(total))

    if prefs.get("cpu_list"):
        pinned = _parse_cpu_list(prefs["cpu_list"])
    else:
        pinned = all_cores

    return {
        "mode": prefs.get("mode", "auto"),
        "cpu_list": _format_cpu_list(pinned),
        "total_cores": total,
        "all_cores": all_cores,
        "pinned_cores": pinned,
        "topology": _build_topology(),
    }


def set_cpu_affinity(instance_id: int, payload: dict[str, Any], pid: int | None) -> dict[str, Any]:
    total = psutil.cpu_count(logical=True) or 1
    all_cores = list(range(total))

    cores = payload.get("cores")
    if isinstance(cores, list) and len(cores) > 0:
        cpus = [int(c) for c in cores if 0 <= int(c) < total]
        mode = "custom" if set(cpus) != set(all_cores) else "auto"
    else:
        mode = payload.get("mode", "auto")
        if mode == "auto":
            cpus = all_cores
        else:
            cpus = _cpu_list_from_mode(mode)

    cpu_list_str = _format_cpu_list(cpus)
    prefs = {"mode": mode, "cpu_list": cpu_list_str}
    _save_affinity_prefs(prefs)

    applied = False
    if pid:
        try:
            p = psutil.Process(pid)
            p.cpu_affinity(cpus)
            applied = True
        except (psutil.NoSuchProcess, psutil.AccessDenied, OSError) as exc:
            log.warning("Failed to set CPU affinity on pid %d: %s", pid, exc)

    total = psutil.cpu_count(logical=True) or 1
    return {
        "mode": mode,
        "cpu_list": cpu_list_str,
        "applied": applied,
        "total_cores": total,
        "all_cores": list(range(total)),
        "pinned_cores": cpus,
        "topology": _build_topology(),
    }


def _load_memory_settings() -> dict[str, Any]:
    if MEMORY_SETTINGS_FILE.exists():
        try:
            return json.loads(MEMORY_SETTINGS_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return dict(_DEFAULT_MEMORY)


def _save_memory_settings(settings: dict[str, Any]) -> None:
    MEMORY_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    MEMORY_SETTINGS_FILE.write_text(json.dumps(settings, indent=2))


def get_memory_settings(instance_id: int) -> dict[str, Any]:
    return {"state": _load_memory_settings()}


def set_memory_settings(instance_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    current = _load_memory_settings()
    for key in ("budget_mb", "headroom_mb", "ceiling_mb", "preset",
                "watcher_enabled", "auto_raise", "oom_adj"):
        if key in payload:
            current[key] = payload[key]
    _save_memory_settings(current)
    return {"state": current}


def reset_memory_settings(instance_id: int) -> dict[str, Any]:
    settings = dict(_DEFAULT_MEMORY)
    _save_memory_settings(settings)
    return {"state": settings}


def get_memory_live(instance_id: int, pid: int | None) -> dict[str, Any]:
    settings = _load_memory_settings()
    budget = settings.get("budget_mb", 0)
    ceiling = settings.get("ceiling_mb", 0)
    vm = psutil.virtual_memory()
    total_mb = round(vm.total / (1024 * 1024))
    rss_bytes = 0
    rss_mb = 0.0
    if pid:
        try:
            p = psutil.Process(pid)
            rss_bytes = p.memory_info().rss
            rss_mb = round(rss_bytes / (1024 * 1024), 1)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    effective_budget = budget if budget > 0 else total_mb
    pct = round(rss_mb / effective_budget * 100, 1) if effective_budget > 0 else 0.0
    eff_budget = budget if budget > 0 else total_mb
    eff_ceiling = ceiling if ceiling > 0 else total_mb
    return {
        "live": {
            "rss_bytes": rss_bytes,
            "online": pid is not None,
        },
        "rss_bytes": rss_bytes,
        "rss_mb": rss_mb,
        "budget_mb": eff_budget,
        "ceiling_mb": eff_ceiling,
        "pct": pct,
        "total_mb": total_mb,
    }


def get_memory_topology() -> dict[str, Any]:
    vm = psutil.virtual_memory()
    total_mb = round(vm.total / (1024 * 1024))
    available_mb = round(vm.available / (1024 * 1024))
    return {
        "total_mb": total_mb,
        "nodes": [
            {"id": 0, "total_mb": total_mb, "available_mb": available_mb},
        ],
    }
