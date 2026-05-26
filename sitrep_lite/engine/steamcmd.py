from __future__ import annotations

import asyncio
import logging
import zipfile
from typing import Any

import httpx

from ..paths import STEAMCMD_DIR, STEAMCMD_EXE, SERVER_DIR, REFORGER_APP_ID

log = logging.getLogger(__name__)

STEAMCMD_URL = "https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip"


async def ensure_steamcmd() -> dict[str, Any]:
    if STEAMCMD_EXE.exists():
        return {"state": "ready", "path": str(STEAMCMD_EXE)}
    STEAMCMD_DIR.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient() as client:
        resp = await client.get(STEAMCMD_URL, follow_redirects=True)
        resp.raise_for_status()
    zip_path = STEAMCMD_DIR / "steamcmd.zip"
    zip_path.write_bytes(resp.content)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(STEAMCMD_DIR)
    zip_path.unlink()
    return {"state": "downloaded", "path": str(STEAMCMD_EXE)}


async def install_server(force: bool = False) -> dict[str, Any]:
    await ensure_steamcmd()
    server_exe = SERVER_DIR / "ArmaReforgerServer.exe"
    if server_exe.exists() and not force:
        return {"state": "already_installed"}
    SERVER_DIR.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(STEAMCMD_EXE),
        "+force_install_dir", str(SERVER_DIR),
        "+login", "anonymous",
        "+app_update", str(REFORGER_APP_ID), "validate",
        "+quit",
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    output = stdout.decode("utf-8", errors="replace") if stdout else ""
    if proc.returncode != 0:
        return {"state": "error", "output": output[-2000:]}
    return {"state": "installed", "output": output[-2000:]}


async def subscribe_mod(mod_guid: str) -> dict[str, Any]:
    await ensure_steamcmd()
    cmd = [
        str(STEAMCMD_EXE),
        "+login", "anonymous",
        "+workshop_download_item", "1874880", mod_guid,
        "+quit",
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    output = stdout.decode("utf-8", errors="replace") if stdout else ""
    return {"state": "subscribed" if proc.returncode == 0 else "error", "output": output[-2000:]}
