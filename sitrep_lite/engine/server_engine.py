from __future__ import annotations

from typing import Any

from .lifecycle import ServerLifecycle


class ServerEngine:
    def __init__(self) -> None:
        self.lifecycle = ServerLifecycle()

    async def lifecycle_status(self) -> dict[str, Any]:
        return self.lifecycle.status()

    async def lifecycle_start(self) -> dict[str, Any]:
        return self.lifecycle.start()

    async def lifecycle_stop(self) -> dict[str, Any]:
        return self.lifecycle.stop()

    async def lifecycle_restart(self) -> dict[str, Any]:
        return self.lifecycle.restart()
