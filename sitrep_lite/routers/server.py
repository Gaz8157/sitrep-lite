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

def _get_engine(instance_id: int):
    from ..engine.instance_manager import get_engine
    return get_engine(instance_id)


@router.get("")
async def list_servers(user=Depends(require_role(*_READ_ROLES))) -> dict:
    from ..engine.instance_manager import list_instances
    return {"instances": list_instances()}


@router.post("")
async def create_server(payload: dict, user=Depends(require_role(*_OWNER_ONLY))) -> dict:
    from ..engine.instance_manager import create_instance
    return create_instance(payload.get("name", ""))


@router.delete("/{instance_id}")
async def delete_server(instance_id: int, user=Depends(require_server_role(*_OWNER_ONLY))) -> dict:
    from ..engine.instance_manager import delete_instance
    return delete_instance(instance_id)


@router.put("/{instance_id}/name")
async def rename_server(instance_id: int, payload: dict, user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.instance_manager import rename_instance
    return rename_instance(instance_id, payload.get("name", ""))


@router.get("/{instance_id}/status")
async def server_status(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    return _get_engine(instance_id).lifecycle.status()


@router.post("/{instance_id}/start")
async def start_server(instance_id: int, user=Depends(require_server_role(*_OP_ROLES))) -> dict:
    from ..paths import instance_server_exe
    from ..engine.steamcmd import install_server, install_status
    exe = instance_server_exe(instance_id)
    if not exe.exists():
        status = install_status()
        if status.get("status") == "installing":
            return {"state": "installing", "message": "Server is being installed. Check Console for progress."}
        await install_server(instance_id=instance_id)
        return {"state": "installing", "message": "Installing server via SteamCMD. Check Console for progress."}
    return _get_engine(instance_id).lifecycle.start()


@router.post("/{instance_id}/update")
async def update_server(instance_id: int, user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.steamcmd import update_server as do_update
    engine = _get_engine(instance_id)
    if engine.lifecycle.pid:
        engine.lifecycle.stop()
    await do_update(instance_id=instance_id)
    return {"state": "updating", "message": "Updating server via SteamCMD. Check Console for progress."}


@router.get("/{instance_id}/install-status")
async def get_install_status(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.steamcmd import install_status
    return install_status()


@router.post("/{instance_id}/stop")
async def stop_server(instance_id: int, user=Depends(require_server_role(*_OP_ROLES))) -> dict:
    return _get_engine(instance_id).lifecycle.stop()


@router.post("/{instance_id}/restart")
async def restart_server(instance_id: int, user=Depends(require_server_role(*_OP_ROLES))) -> dict:
    return _get_engine(instance_id).lifecycle.restart()


@router.post("/{instance_id}/install")
async def install_server(instance_id: int, force: bool = False,
                         user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.steamcmd import install_server as do_install
    return await do_install(force=force, instance_id=instance_id)


@router.get("/{instance_id}/config")
async def get_config(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.config import read_config
    return {"config": read_config(instance_id=instance_id)}


@router.put("/{instance_id}/config")
async def put_config(instance_id: int, payload: dict,
                     user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.config import write_config
    write_config(payload, instance_id=instance_id)
    return {"config": payload}


@router.patch("/{instance_id}/config")
async def patch_config(instance_id: int, payload: dict,
                       user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.config import patch_config as do_patch
    result = do_patch(payload, instance_id=instance_id)
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
    return list_mods(instance_id=instance_id)


@router.post("/{instance_id}/mods")
async def post_mod(instance_id: int, payload: dict,
                   user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.mods import add_mod
    guid = payload.get("mod_guid", "")
    return add_mod(guid, instance_id=instance_id)


@router.delete("/{instance_id}/mods/{mod_guid}")
async def delete_mod(instance_id: int, mod_guid: str,
                     user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.mods import remove_mod
    return remove_mod(mod_guid, instance_id=instance_id)


@router.delete("/{instance_id}/mods")
async def delete_all_mods(instance_id: int,
                          user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.mods import clear_mods
    return clear_mods(instance_id=instance_id)


@router.post("/{instance_id}/mods/{mod_guid}/subscribe")
async def subscribe_mod(instance_id: int, mod_guid: str,
                        user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.steamcmd import subscribe_mod as do_sub
    return await do_sub(mod_guid)


@router.get("/{instance_id}/files")
async def list_files(instance_id: int, path: str = "",
                     user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.files import list_files as do_list
    return do_list(path, instance_id=instance_id)


@router.get("/{instance_id}/files/content")
async def get_file_content(instance_id: int, path: str,
                           user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.files import read_file
    return read_file(path, instance_id=instance_id)


@router.put("/{instance_id}/files")
async def put_file(instance_id: int, payload: dict, path: str,
                   user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.files import write_file
    return write_file(path, payload.get("content", ""), instance_id=instance_id)


@router.delete("/{instance_id}/files")
async def delete_file(instance_id: int, path: str,
                      user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.files import delete_file as do_delete
    return do_delete(path, instance_id=instance_id)


@router.post("/{instance_id}/files/mkdir")
async def post_file_mkdir(instance_id: int, payload: dict,
                          user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.files import mkdir
    return mkdir(payload.get("rel_path", ""), instance_id=instance_id)


@router.get("/{instance_id}/saves")
async def list_saves(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.saves import list_saves as do_list
    return do_list(instance_id=instance_id)


@router.get("/{instance_id}/saves/inspect")
async def inspect_save(instance_id: int, path: str,
                       user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.saves import inspect_save as do_inspect
    return do_inspect(path, instance_id=instance_id)


@router.delete("/{instance_id}/saves")
async def purge_saves(instance_id: int, path: str | None = None,
                      user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.saves import purge_save
    return purge_save(path, instance_id=instance_id)


@router.get("/{instance_id}/backups")
async def list_backups(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.saves import list_backups as do_list
    return do_list(instance_id=instance_id)


@router.post("/{instance_id}/backups")
async def create_backup(instance_id: int, user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.saves import create_backup as do_create
    return do_create(instance_id=instance_id)


@router.delete("/{instance_id}/backups/{filename}")
async def delete_backup(instance_id: int, filename: str,
                        user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.saves import delete_backup as do_delete
    return do_delete(filename, instance_id=instance_id)


@router.post("/{instance_id}/backups/{filename}/restore")
async def restore_backup(instance_id: int, filename: str,
                         user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.saves import restore_backup as do_restore
    return do_restore(filename, instance_id=instance_id)


@router.get("/{instance_id}/logs")
async def get_logs(instance_id: int, lines: int = 100,
                   user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.logs import tail_logs
    return tail_logs(lines, instance_id=instance_id)


@router.get("/{instance_id}/diagnostics")
async def get_diagnostics(instance_id: int,
                          user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.diagnostics import run_checks
    return run_checks(instance_id=instance_id)


@router.post("/{instance_id}/diagnostics/fix")
async def apply_diagnostics_fix(instance_id: int, payload: dict,
                                user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.diagnostics import apply_fix
    return apply_fix(payload.get("fix_id", ""), payload.get("payload"), instance_id=instance_id)


@router.post("/{instance_id}/rcon")
async def send_rcon(instance_id: int, payload: dict,
                    user=Depends(require_server_role(*_OP_ROLES))) -> dict:
    from ..engine.rcon import rcon_call
    cmd = payload.get("command", "")
    output = await rcon_call(cmd, instance_id=instance_id)
    return {"command": cmd, "output": output}


@router.post("/{instance_id}/rcon/say")
async def say_rcon(instance_id: int, payload: dict,
                   user=Depends(require_server_role(*_OP_ROLES))) -> dict:
    from ..engine.rcon import rcon_call
    msg = payload.get("message", "")
    output = await rcon_call(f"#say {msg}", instance_id=instance_id)
    return {"message": msg, "output": output}


@router.get("/{instance_id}/players")
async def list_players(instance_id: int,
                       user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.players import list_players as do_list
    return await do_list(instance_id=instance_id)


@router.get("/{instance_id}/admins")
async def list_admins(instance_id: int,
                      user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    from ..engine.config import read_config
    cfg = read_config(instance_id=instance_id)
    admins = (cfg.get("game", {}) or {}).get("admins", []) or []
    return {"instance_id": instance_id, "admins": list(admins)}


@router.post("/{instance_id}/admins")
async def add_admin(instance_id: int, payload: dict,
                    user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.config import read_config, write_config
    guid = (payload or {}).get("guid", "").strip()
    if not guid:
        raise HTTPException(status_code=400, detail="'guid' required")
    cfg = read_config(instance_id=instance_id)
    game = cfg.setdefault("game", {})
    admins = list(game.get("admins", []) or [])
    if guid not in admins:
        admins.append(guid)
    game["admins"] = admins
    write_config(cfg, instance_id=instance_id)
    return {"instance_id": instance_id, "admins": admins, "state": "added"}


@router.delete("/{instance_id}/admins/{guid}")
async def remove_admin(instance_id: int, guid: str,
                       user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    from ..engine.config import read_config, write_config
    cfg = read_config(instance_id=instance_id)
    game = cfg.setdefault("game", {})
    admins = [a for a in (game.get("admins", []) or []) if a != guid]
    game["admins"] = admins
    write_config(cfg, instance_id=instance_id)
    return {"instance_id": instance_id, "admins": admins, "state": "removed"}


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
    engine = _get_engine(instance_id)
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
