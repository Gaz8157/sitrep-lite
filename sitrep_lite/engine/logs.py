from __future__ import annotations

from pathlib import Path
from typing import Any

from ..paths import PROFILE_DIR


def tail_logs(lines: int = 100) -> dict[str, Any]:
    log_dir = PROFILE_DIR / "logs"
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
