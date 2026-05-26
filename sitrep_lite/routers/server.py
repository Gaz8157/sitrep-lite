from __future__ import annotations

from typing import Annotated

import psutil
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..deps import get_client_ip, require_role, require_server_role
from ..repos import audit_repo

router = APIRouter(prefix="/api/servers", tags=["servers"])

_READ_ROLES = ("owner", "head_admin", "admin", "moderator", "viewer", "demo")
_OP_ROLES = ("owner", "head_admin", "admin", "moderator")
_ADMIN_ROLES = ("owner", "head_admin", "admin")
_OWNER_ONLY = ("owner",)

_engine = None

def set_engine(engine) -> None:
    global _engine
    _engine = engine

def _get_engine():
    if _engine is None:
        raise HTTPException(status_code=503, detail="Engine not initialized")
    return _engine


@router.get("")
async def list_servers(user=Depends(require_role(*_READ_ROLES))) -> dict:
    engine = _get_engine()
    st = engine.lifecycle.status()
    inst = {"id": 1, "instance_id": 1, **st}
    return {"instances": [inst]}


@router.get("/{instance_id}/status")
async def server_status(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    return _get_engine().lifecycle.status()


@router.post("/{instance_id}/start")
async def start_server(instance_id: int, user=Depends(require_server_role(*_OP_ROLES))) -> dict:
    from ..paths import SERVER_EXE
    if not SERVER_EXE.exists():
        from ..engine.steamcmd import install_server
        result = await install_server()
        if result.get("state") == "error":
            raise HTTPException(status_code=500, detail=result.get("output", "Install failed"))
    return _get_engine().lifecycle.start()


@router.post("/{instance_id}/stop")
async def stop_server(instance_id: int, user=Depends(require_server_role(*_OP_ROLES))) -> dict:
    return _get_engine().lifecycle.stop()


@router.post("/{instance_id}/restart")
async def restart_server(instance_id: int, user=Depends(require_server_role(*_OP_ROLES))) -> dict:
    return _get_engine().lifecycle.restart()


@router.post("/{instance_id}/install")
async def install_server(instance_id: int, force: bool = False,
                         user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.steamcmd import install_server as do_install
    return await do_install(force=force)


@router.get("/{instance_id}/config")
async def get_config(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.config import read_config
    return {"config": read_config()}


@router.put("/{instance_id}/config")
async def put_config(instance_id: int, payload: dict,
                     user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.config import write_config
    write_config(payload)
    return {"config": payload}


@router.patch("/{instance_id}/config")
async def patch_config(instance_id: int, payload: dict,
                       user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.config import patch_config as do_patch
    result = do_patch(payload)
    return {"config": result}


@router.post("/{instance_id}/config/validate")
async def validate_config_payload(instance_id: int, payload: dict,
                                  user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.config import validate_config
    errors = validate_config(payload)
    return {"valid": len(errors) == 0, "errors": errors}


@router.get("/{instance_id}/startup-params")
async def get_startup_params(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.startup_params import read_params
    return read_params()


@router.put("/{instance_id}/startup-params")
async def put_startup_params(instance_id: int, payload: dict,
                             user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.startup_params import write_params
    return write_params(payload.get("params", {}), payload.get("customLaunchParams", ""))


@router.get("/{instance_id}/mods")
async def get_mods(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.mods import list_mods
    return list_mods()


@router.post("/{instance_id}/mods")
async def post_mod(instance_id: int, payload: dict,
                   user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.mods import add_mod
    guid = payload.get("mod_guid", "")
    return add_mod(guid)


@router.delete("/{instance_id}/mods/{mod_guid}")
async def delete_mod(instance_id: int, mod_guid: str,
                     user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.mods import remove_mod
    return remove_mod(mod_guid)


@router.delete("/{instance_id}/mods")
async def delete_all_mods(instance_id: int,
                          user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.mods import clear_mods
    return clear_mods()


@router.post("/{instance_id}/mods/{mod_guid}/subscribe")
async def subscribe_mod(instance_id: int, mod_guid: str,
                        user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.steamcmd import subscribe_mod as do_sub
    return await do_sub(mod_guid)


@router.get("/{instance_id}/files")
async def list_files(instance_id: int, path: str = "",
                     user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.files import list_files as do_list
    return do_list(path)


@router.get("/{instance_id}/files/content")
async def get_file_content(instance_id: int, path: str,
                           user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.files import read_file
    return read_file(path)


@router.put("/{instance_id}/files")
async def put_file(instance_id: int, payload: dict, path: str,
                   user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.files import write_file
    return write_file(path, payload.get("content", ""))


@router.delete("/{instance_id}/files")
async def delete_file(instance_id: int, path: str,
                      user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.files import delete_file as do_delete
    return do_delete(path)


@router.post("/{instance_id}/files/mkdir")
async def post_file_mkdir(instance_id: int, payload: dict,
                          user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.files import mkdir
    return mkdir(payload.get("rel_path", ""))


@router.get("/{instance_id}/saves")
async def list_saves(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.saves import list_saves as do_list
    return do_list()


@router.get("/{instance_id}/saves/inspect")
async def inspect_save(instance_id: int, path: str,
                       user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.saves import inspect_save as do_inspect
    return do_inspect(path)


@router.delete("/{instance_id}/saves")
async def purge_saves(instance_id: int, path: str | None = None,
                      user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.saves import purge_save
    return purge_save(path)


@router.get("/{instance_id}/backups")
async def list_backups(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.saves import list_backups as do_list
    return do_list()


@router.post("/{instance_id}/backups")
async def create_backup(instance_id: int, user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.saves import create_backup as do_create
    return do_create()


@router.delete("/{instance_id}/backups/{filename}")
async def delete_backup(instance_id: int, filename: str,
                        user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.saves import delete_backup as do_delete
    return do_delete(filename)


@router.post("/{instance_id}/backups/{filename}/restore")
async def restore_backup(instance_id: int, filename: str,
                         user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.saves import restore_backup as do_restore
    return do_restore(filename)


@router.get("/{instance_id}/logs")
async def get_logs(instance_id: int, lines: int = 100,
                   user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.logs import tail_logs
    return tail_logs(lines)


@router.get("/{instance_id}/diagnostics")
async def get_diagnostics(instance_id: int,
                          user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.diagnostics import run_checks
    return run_checks()


@router.post("/{instance_id}/diagnostics/fix")
async def apply_diagnostics_fix(instance_id: int, payload: dict,
                                user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.diagnostics import apply_fix
    return apply_fix(payload.get("fix_id", ""), payload.get("payload"))


@router.post("/{instance_id}/rcon")
async def send_rcon(instance_id: int, payload: dict,
                    user=Depends(require_server_role(*_OP_ROLES))) -> dict:
    from ..engine.rcon import rcon_call
    cmd = payload.get("command", "")
    output = await rcon_call(cmd)
    return {"command": cmd, "output": output}


@router.post("/{instance_id}/rcon/say")
async def say_rcon(instance_id: int, payload: dict,
                   user=Depends(require_server_role(*_OP_ROLES))) -> dict:
    from ..engine.rcon import rcon_call
    msg = payload.get("message", "")
    output = await rcon_call(f"#say {msg}")
    return {"message": msg, "output": output}


@router.get("/{instance_id}/players")
async def list_players(instance_id: int,
                       user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.players import list_players as do_list
    return await do_list()


@router.get("/{instance_id}/admins")
async def list_admins(instance_id: int,
                      user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.config import read_config
    cfg = read_config()
    admins = (cfg.get("game", {}) or {}).get("admins", []) or []
    return {"instance_id": 1, "admins": list(admins)}


@router.post("/{instance_id}/admins")
async def add_admin(instance_id: int, payload: dict,
                    user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.config import read_config, write_config
    guid = (payload or {}).get("guid", "").strip()
    if not guid:
        raise HTTPException(status_code=400, detail="'guid' required")
    cfg = read_config()
    game = cfg.setdefault("game", {})
    admins = list(game.get("admins", []) or [])
    if guid not in admins:
        admins.append(guid)
    game["admins"] = admins
    write_config(cfg)
    return {"instance_id": 1, "admins": admins, "state": "added"}


@router.delete("/{instance_id}/admins/{guid}")
async def remove_admin(instance_id: int, guid: str,
                       user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.config import read_config, write_config
    cfg = read_config()
    game = cfg.setdefault("game", {})
    admins = [a for a in (game.get("admins", []) or []) if a != guid]
    game["admins"] = admins
    write_config(cfg)
    return {"instance_id": 1, "admins": admins, "state": "removed"}


@router.get("/{instance_id}/bans")
async def list_bans(instance_id: int,
                    user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.bans import list_bans as do_list
    return do_list()


@router.post("/{instance_id}/bans")
async def add_ban(instance_id: int, payload: dict,
                  user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.bans import add_ban as do_add
    from ..engine.rcon import rcon_call
    identity = (payload or {}).get("identity", "").strip()
    reason = (payload or {}).get("reason", "")
    result = do_add(identity, reason)
    try:
        await rcon_call(f"#ban {identity}")
        result["rcon"] = "sent"
    except Exception:
        result["rcon"] = "skipped"
    return result


@router.delete("/{instance_id}/bans/{identity}")
async def remove_ban(instance_id: int, identity: str,
                     user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.bans import remove_ban as do_remove
    return do_remove(identity)


@router.get("/{instance_id}/process-stats")
async def get_process_stats(instance_id: int,
                            user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    engine = _get_engine()
    pid = engine.lifecycle.pid
    total_cpus = psutil.cpu_count(logical=True) or 1
    empty = {"running": False, "cpu_percent": None, "rss_mb": None,
             "main_pid": None, "total_logical_cpus": total_cpus}
    if not pid:
        return empty
    try:
        p = psutil.Process(pid)
        cpu = p.cpu_percent(interval=None)
        rss_mb = p.memory_info().rss / (1024 * 1024)
        return {"running": True, "cpu_percent": round(cpu, 1), "rss_mb": round(rss_mb, 1),
                "main_pid": pid, "total_logical_cpus": total_cpus}
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return empty
