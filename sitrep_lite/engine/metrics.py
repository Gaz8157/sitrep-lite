from __future__ import annotations

import time
from typing import Any

import psutil

psutil.cpu_percent(interval=None)
psutil.cpu_percent(interval=None, percpu=True)

_last_net: dict[str, float] = {"ts": 0.0, "bytes_sent": 0.0, "bytes_recv": 0.0}


def system_metrics() -> dict[str, Any]:
    now = time.time()
    cpu_percent = psutil.cpu_percent(interval=None)
    per_core = psutil.cpu_percent(interval=None, percpu=True) or []
    vm = psutil.virtual_memory()

    disks = []
    seen_devs: set[str] = set()
    for d in psutil.disk_partitions(all=False):
        if d.device in seen_devs:
            continue
        seen_devs.add(d.device)
        try:
            u = psutil.disk_usage(d.mountpoint)
        except (PermissionError, FileNotFoundError, OSError):
            continue
        disks.append({
            "name": d.mountpoint,
            "used": round(u.used / 1e9, 1),
            "total": round(u.total / 1e9, 1),
            "pct": round(u.used / u.total * 100, 1) if u.total else 0,
        })

    net = psutil.net_io_counters()
    up_mbps = 0.0
    down_mbps = 0.0
    if _last_net["ts"] > 0:
        dt = now - _last_net["ts"]
        if dt > 0:
            up_mbps = round((net.bytes_sent - _last_net["bytes_sent"]) * 8 / 1e6 / dt, 2)
            down_mbps = round((net.bytes_recv - _last_net["bytes_recv"]) * 8 / 1e6 / dt, 2)
    _last_net["ts"] = now
    _last_net["bytes_sent"] = net.bytes_sent
    _last_net["bytes_recv"] = net.bytes_recv

    return {
        "ts": now,
        "cpu": {
            "usage": round(cpu_percent, 1),
            "cores": psutil.cpu_count() or 0,
            "per_core": [round(v, 1) for v in per_core],
        },
        "ram": {
            "used": round(vm.used / 1e9, 1),
            "total": round(vm.total / 1e9, 1),
            "pct": int(vm.percent),
        },
        "disks": disks,
        "network_rate": {"up_mbps": up_mbps, "down_mbps": down_mbps},
    }
