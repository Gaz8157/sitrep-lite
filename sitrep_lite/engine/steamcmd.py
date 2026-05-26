from __future__ import annotations

import asyncio
import logging
import time
import zipfile
from pathlib import Path
from typing import Any

import httpx

from ..paths import STEAMCMD_DIR, STEAMCMD_EXE, SERVER_DIR, PROFILE_DIR, REFORGER_APP_ID, instance_server, instance_profile

log = logging.getLogger(__name__)

STEAMCMD_URL = "https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip"

_install_state: dict[str, Any] = {"status": "idle"}
_install_task: asyncio.Task | None = None


def _log_path(instance_id: int | None = None) -> Path:
    profile = instance_profile(instance_id) if instance_id is not None else PROFILE_DIR
    d = profile / "logs"
    d.mkdir(parents=True, exist_ok=True)
    return d / "install.log"


def _write_log(msg: str, instance_id: int | None = None) -> None:
    with open(_log_path(instance_id), "a", encoding="utf-8") as f:
        f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")


def install_status() -> dict[str, Any]:
    return dict(_install_state)


async def ensure_steamcmd() -> dict[str, Any]:
    if STEAMCMD_EXE.exists():
        return {"state": "ready", "path": str(STEAMCMD_EXE)}
    STEAMCMD_DIR.mkdir(parents=True, exist_ok=True)
    _write_log("Downloading SteamCMD...")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(STEAMCMD_URL, follow_redirects=True)
        resp.raise_for_status()
    zip_path = STEAMCMD_DIR / "steamcmd.zip"
    zip_path.write_bytes(resp.content)
    _write_log(f"Downloaded {len(resp.content)} bytes, extracting...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(STEAMCMD_DIR)
    zip_path.unlink()
    _write_log("SteamCMD extracted.")
    return {"state": "downloaded", "path": str(STEAMCMD_EXE)}


async def _run_steamcmd(args: list[str], label: str, instance_id: int | None = None) -> dict[str, Any]:
    _write_log(f"Running: steamcmd {' '.join(args[1:])}", instance_id)
    log_file = open(_log_path(instance_id), "a", encoding="utf-8", errors="replace")
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=log_file,
        stderr=log_file,
    )
    await proc.wait()
    log_file.close()
    _write_log(f"{label} finished with exit code {proc.returncode}", instance_id)
    return {"returncode": proc.returncode}


async def _install_bg(force: bool = False, instance_id: int | None = None) -> None:
    global _install_state
    srv_dir = instance_server(instance_id) if instance_id is not None else SERVER_DIR
    try:
        _install_state = {"status": "installing", "started_at": time.time()}

        with open(_log_path(instance_id), "w", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] === Server Install Started ===\n")

        await ensure_steamcmd()

        _write_log("Running SteamCMD self-update...", instance_id)
        await _run_steamcmd([str(STEAMCMD_EXE), "+quit"], "SteamCMD update")
        _write_log("SteamCMD ready.", instance_id)

        server_exe = srv_dir / "ArmaReforgerServer.exe"
        if server_exe.exists() and not force:
            _write_log("Server binary already exists. Done.", instance_id)
            _install_state = {"status": "installed"}
            return

        srv_dir.mkdir(parents=True, exist_ok=True)
        install_dir = str(srv_dir).replace("/", "\\")
        _write_log(f"Installing Arma Reforger Dedicated Server (App ID {REFORGER_APP_ID})...", instance_id)
        _write_log(f"Install dir: {install_dir}", instance_id)
        _write_log("This will download ~2 GB. Please wait...", instance_id)

        for attempt in range(1, 6):
            _write_log(f"Install attempt {attempt}/5...", instance_id)
            result = await _run_steamcmd(
                [
                    str(STEAMCMD_EXE),
                    "+force_install_dir", install_dir,
                    "+login", "anonymous",
                    "+app_update", str(REFORGER_APP_ID), "validate",
                    "+quit",
                ],
                f"Server install (attempt {attempt})",
            )
            if result["returncode"] == 0:
                break
            if attempt < 5:
                import asyncio as _aio
                _write_log(f"Attempt {attempt} failed (code {result['returncode']}), retrying in 3s...", instance_id)
                await _aio.sleep(3)

        if result["returncode"] != 0:
            _write_log(f"ERROR: SteamCMD exited with code {result['returncode']} after 5 attempts", instance_id)
            _install_state = {"status": "error", "error": f"SteamCMD exit code {result['returncode']}"}
            return

        _write_log("Running final validation pass...", instance_id)
        await _run_steamcmd(
            [
                str(STEAMCMD_EXE),
                "+force_install_dir", install_dir,
                "+login", "anonymous",
                "+app_update", str(REFORGER_APP_ID), "validate",
                "+quit",
            ],
            "Final validation",
        )

        if server_exe.exists():
            _write_log("=== Server installed successfully! ===", instance_id)
            _install_state = {"status": "installed"}
        else:
            _write_log("ERROR: Install completed but ArmaReforgerServer.exe not found", instance_id)
            _install_state = {"status": "error", "error": "Binary not found after install"}

    except Exception as e:
        _write_log(f"ERROR: {e}", instance_id)
        _install_state = {"status": "error", "error": str(e)}


async def install_server(force: bool = False, instance_id: int | None = None) -> dict[str, Any]:
    global _install_task
    if _install_state.get("status") == "installing":
        return {"state": "already_installing"}
    _install_task = asyncio.create_task(_install_bg(force=force, instance_id=instance_id))
    return {"state": "installing"}


async def update_server(instance_id: int | None = None) -> dict[str, Any]:
    return await install_server(force=True, instance_id=instance_id)


async def subscribe_mod(mod_guid: str) -> dict[str, Any]:
    await ensure_steamcmd()
    result = await _run_steamcmd(
        [
            str(STEAMCMD_EXE),
            "+login", "anonymous",
            "+workshop_download_item", "1874880", mod_guid,
            "+quit",
        ],
        f"Mod download {mod_guid}",
    )
    return {"state": "subscribed" if result["returncode"] == 0 else "error"}
