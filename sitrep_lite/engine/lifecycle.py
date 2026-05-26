from __future__ import annotations

import enum
import logging
import signal
import subprocess
import sys
import time
from typing import Any

from ..paths import SERVER_EXE, CONFIG_JSON, PROFILE_DIR

log = logging.getLogger(__name__)


class ServerState(enum.Enum):
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"


class ServerLifecycle:
    def __init__(self) -> None:
        self._process: subprocess.Popen | None = None
        self._state = ServerState.STOPPED
        self._start_time: float | None = None

    @property
    def state(self) -> ServerState:
        self._poll()
        return self._state

    @property
    def pid(self) -> int | None:
        if self._process is not None and self._process.poll() is None:
            return self._process.pid
        return None

    @property
    def uptime_sec(self) -> int:
        if self._state == ServerState.RUNNING and self._start_time:
            return int(time.time() - self._start_time)
        return 0

    def _poll(self) -> None:
        if self._process is None:
            self._state = ServerState.STOPPED
            return
        rc = self._process.poll()
        if rc is not None:
            self._state = ServerState.STOPPED
            self._process = None
            self._start_time = None

    def status(self) -> dict[str, Any]:
        self._poll()
        result: dict[str, Any] = {
            "instance_id": 1,
            "state": self._state.value,
            "pid": self.pid,
            "uptime_sec": self.uptime_sec,
            "binary_installed": SERVER_EXE.exists(),
        }
        if self._state == ServerState.RUNNING:
            from .config import read_config
            cfg = read_config()
            game = cfg.get("game", {})
            result["max_players"] = game.get("maxPlayers")
            result["name"] = game.get("name", "")
            result["display_name"] = game.get("name", "")
            mods = game.get("mods", [])
            result["mods_count"] = len(mods) if isinstance(mods, list) else 0
            result["scenario_id"] = game.get("scenarioId", "")
        return result

    def start(self) -> dict[str, Any]:
        self._poll()
        if self._state == ServerState.RUNNING:
            return {"state": "already_running", "pid": self.pid}
        if not SERVER_EXE.exists():
            raise RuntimeError("Server binary not installed. Run Install Server first.")
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        args = [
            str(SERVER_EXE),
            f"-config={CONFIG_JSON}",
            f"-profile={PROFILE_DIR}",
            f"-logDir={PROFILE_DIR / 'logs'}",
            "-maxFPS=60",
        ]
        kwargs: dict[str, Any] = {}
        if sys.platform == "win32":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        self._process = subprocess.Popen(args, **kwargs)
        self._state = ServerState.RUNNING
        self._start_time = time.time()
        return {"state": "started", "pid": self._process.pid}

    def stop(self) -> dict[str, Any]:
        self._poll()
        if self._state != ServerState.RUNNING or self._process is None:
            return {"state": "already_stopped"}
        self._state = ServerState.STOPPING
        if sys.platform == "win32":
            self._process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            self._process.terminate()
        try:
            self._process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            self._process.kill()
            self._process.wait(timeout=5)
        self._state = ServerState.STOPPED
        self._process = None
        self._start_time = None
        return {"state": "stopped"}

    def restart(self) -> dict[str, Any]:
        self.stop()
        return self.start()
