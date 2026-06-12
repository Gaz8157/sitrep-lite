from __future__ import annotations

from pathlib import Path
from typing import Any

from ..paths import PROFILE_DIR, instance_profile

_MAX_LINES = 5000
_TAIL_HARD_CAP = 8 * 1024 * 1024
_CHUNK = 64 * 1024


def _tail_file(path: Path, lines: int) -> tuple[list[str], bool]:
    """Read the last `lines` lines without loading the whole file.

    Reads backward in chunks, capped at _TAIL_HARD_CAP bytes total so a
    multi-hundred-MB console.log can't be pulled into memory per poll.
    Returns (lines, truncated) — truncated means the window did not reach
    the start of the file.
    """
    size = path.stat().st_size
    if size == 0:
        return [], False
    budget = min(size, _TAIL_HARD_CAP)
    data = b""
    pos = size
    with path.open("rb") as f:
        while pos > 0 and len(data) < budget:
            step = min(_CHUNK, pos, budget - len(data))
            pos -= step
            f.seek(pos)
            data = f.read(step) + data
            if data.count(b"\n") > lines:
                break
    out = data.decode("utf-8", errors="replace").splitlines()
    truncated = pos > 0
    if truncated and len(out) > lines:
        out = out[1:]  # first line of the window is likely partial
    return out[-lines:], truncated


def tail_logs(lines: int = 100, *, instance_id: int | None = None) -> dict[str, Any]:
    lines = max(1, min(lines, _MAX_LINES))
    profile = instance_profile(instance_id) if instance_id is not None else PROFILE_DIR
    log_dir = profile / "logs"
    if not log_dir.exists():
        return {"lines": [], "file": None}

    console_log = log_dir / "console.log"
    if console_log.exists() and console_log.stat().st_size > 0:
        tail, truncated = _tail_file(console_log, lines)
        return {
            "lines": tail,
            "file": "console.log",
            "total_lines": len(tail),
            "truncated": truncated,
        }

    all_logs: list[Path] = list(log_dir.glob("*.log"))
    for sub in log_dir.iterdir():
        if sub.is_dir():
            all_logs.extend(sub.glob("*.log"))
            all_logs.extend(sub.glob("*.rpt"))

    if not all_logs:
        return {"lines": [], "file": None}

    latest = max(all_logs, key=lambda f: f.stat().st_mtime)
    tail, truncated = _tail_file(latest, lines)
    return {
        "lines": tail,
        "file": str(latest.relative_to(log_dir)),
        "total_lines": len(tail),
        "truncated": truncated,
    }
