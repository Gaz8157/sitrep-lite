from __future__ import annotations

from typing import Any

from .rcon import rcon_call


async def list_players() -> dict[str, Any]:
    try:
        output = await rcon_call("#players")
    except Exception:
        return {"players": [], "count": 0, "error": "RCON unavailable"}
    players = []
    for line in output.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("---") or line.lower().startswith("players"):
            continue
        parts = line.split(None, 2)
        if len(parts) >= 2:
            players.append({"id": parts[0], "name": parts[1] if len(parts) > 1 else "",
                          "extra": parts[2] if len(parts) > 2 else ""})
    return {"players": players, "count": len(players)}
