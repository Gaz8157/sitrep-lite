from __future__ import annotations

import sys
from pathlib import Path

if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).parent.parent

DATA_DIR = BASE_DIR / "data"
PANEL_DB = DATA_DIR / "panel.db"
STATE_DB = DATA_DIR / "state.db"
BACKUPS_DIR = DATA_DIR / "backups"
SERVER_DIR = BASE_DIR / "server"
PROFILE_DIR = BASE_DIR / "profile"
STEAMCMD_DIR = BASE_DIR / "steamcmd"
CONFIG_JSON = BASE_DIR / "config.json"
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
SECRETS_FILE = DATA_DIR / "secrets.json"

STEAMCMD_EXE = STEAMCMD_DIR / "steamcmd.exe"
SERVER_EXE = SERVER_DIR / "ArmaReforgerServer.exe"

REFORGER_APP_ID = 1874900
REFORGER_WORKSHOP_APP_ID = 1874880

INSTANCES_DIR = BASE_DIR / "instances"


def instance_dir(instance_id: int) -> Path:
    return INSTANCES_DIR / str(instance_id)


def instance_config(instance_id: int) -> Path:
    return instance_dir(instance_id) / "config.json"


def instance_profile(instance_id: int) -> Path:
    return instance_dir(instance_id) / "profile"


def instance_server(instance_id: int) -> Path:
    return instance_dir(instance_id) / "server"


def instance_server_exe(instance_id: int) -> Path:
    return instance_server(instance_id) / "ArmaReforgerServer.exe"


def ensure_dirs() -> None:
    for d in (DATA_DIR, BACKUPS_DIR, SERVER_DIR, PROFILE_DIR, STEAMCMD_DIR, INSTANCES_DIR):
        d.mkdir(parents=True, exist_ok=True)
