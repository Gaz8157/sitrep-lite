from __future__ import annotations

from pathlib import Path
from typing import Any

from ..paths import PROFILE_DIR, instance_profile


def tail_logs(lines: int = 100, *, instance_id: int | None = None) -> dict[str, Any]:
    profile = instance_profile(instance_id) if instance_id is not None else PROFILE_DIR
    log_dir = profile / "logs"
    if not log_dir.exists():
        return {"lines": [], "file": None}

    console_log = log_dir / "console.log"
    if console_log.exists() and console_log.stat().st_size > 0:
        all_lines = console_log.read_text(errors="replace").splitlines()
        return {
            "lines": all_lines[-lines:],
            "file": "console.log",
            "total_lines": len(all_lines),
        }

    all_logs: list[Path] = list(log_dir.glob("*.log"))
    for sub in log_dir.iterdir():
        if sub.is_dir():
            all_logs.extend(sub.glob("*.log"))
            all_logs.extend(sub.glob("*.rpt"))

    if not all_logs:
        return {"lines": [], "file": None}

    latest = max(all_logs, key=lambda f: f.stat().st_mtime)
    all_lines = latest.read_text(errors="replace").splitlines()
    return {
        "lines": all_lines[-lines:],
        "file": str(latest.relative_to(log_dir)),
        "total_lines": len(all_lines),
    }
