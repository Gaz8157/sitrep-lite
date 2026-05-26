from __future__ import annotations

from pathlib import Path
from typing import Any

from ..paths import PROFILE_DIR, instance_profile


def tail_logs(lines: int = 100, *, instance_id: int | None = None) -> dict[str, Any]:
    profile = instance_profile(instance_id) if instance_id is not None else PROFILE_DIR
    log_dir = profile / "logs"
    if not log_dir.exists():
        return {"lines": [], "file": None}
    log_files = sorted(log_dir.glob("*.log"), key=lambda f: f.stat().st_mtime, reverse=True)
    if not log_files:
        return {"lines": [], "file": None}
    latest = log_files[0]
    all_lines = latest.read_text(errors="replace").splitlines()
    return {
        "lines": all_lines[-lines:],
        "file": latest.name,
        "total_lines": len(all_lines),
    }
