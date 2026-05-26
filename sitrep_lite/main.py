from __future__ import annotations

import logging
import sys
import time
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import FileResponse, HTMLResponse

from .db.panel import migrate as panel_migrate
from .db.state import migrate as state_migrate
from .paths import FRONTEND_DIST, ensure_dirs
from .routers import auth, audit, scheduler, server, settings, system, users, webhooks, workshop

log = logging.getLogger(__name__)

_BOOT_TS = time.time()


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as ex:
            if ex.status_code == 404:
                response = FileResponse(Path(self.directory) / "index.html")
            else:
                raise
        if path.startswith("assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif not path.startswith("api/"):
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    panel_migrate()
    state_migrate()
    from .engine.instance_manager import ensure_default_instance, stop_all
    ensure_default_instance()
    workshop.start_index_build_if_needed()
    yield
    log.info("Shutting down -- stopping all server instances")
    stop_all()


app = FastAPI(title="SITREP Lite", version="1.0.0", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(server.router)
app.include_router(system.router)
app.include_router(users.router)
app.include_router(settings.router)
app.include_router(audit.router)
app.include_router(webhooks.router)
app.include_router(scheduler.router)
app.include_router(workshop.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": "1.0.0", "uptime_sec": round(time.time() - _BOOT_TS, 3)}


@app.get("/api/packages")
@app.post("/api/packages")
def packages_stub() -> dict:
    return {"packages": []}


_storage_cache: dict[int, tuple[float, dict]] = {}


def _dir_size(path: Path) -> int:
    if not path.is_dir():
        return 0
    try:
        return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
    except Exception:
        return 0


@app.get("/api/servers/{instance_id}/storage")
def storage_info(instance_id: int) -> dict:
    import json as _json
    import shutil as _shutil

    now = time.time()
    cached = _storage_cache.get(instance_id)
    if cached and now - cached[0] < 60:
        return cached[1]

    from .paths import instance_dir, instance_profile, instance_server

    idir = instance_dir(instance_id)
    prof = instance_profile(instance_id)
    sdir = instance_server(instance_id)

    try:
        disk = _shutil.disk_usage(str(idir.parent if idir.exists() else "."))
    except Exception:
        disk = type("D", (), {"total": 0, "free": 0})()

    mod_count = 0
    config_path = idir / "config.json"
    if config_path.is_file():
        try:
            cfg = _json.loads(config_path.read_text(encoding="utf-8"))
            mod_count = len(cfg.get("game", {}).get("mods", []))
        except Exception:
            pass

    addons_size = _dir_size(sdir / "addons") + _dir_size(prof / "addons")
    logs_size = _dir_size(prof / "logs")
    profile_size = _dir_size(prof) - logs_size

    total = addons_size + logs_size + profile_size

    breakdown = {
        "active_mods": {"size_mb": 0, "label": f"{mod_count} active mods" if mod_count else "No active mods"},
        "addons": {"size_mb": round(addons_size / 1e6, 1), "label": "Addons folder"},
        "logs": {"size_mb": round(logs_size / 1e6, 1), "label": "Logs"},
        "profile": {"size_mb": round(profile_size / 1e6, 1), "label": "Profile"},
    }

    result = {
        "total_bytes": total,
        "breakdown": breakdown,
        "disk_total_gb": round(disk.total / 1e9, 1),
        "disk_free_gb": round(disk.free / 1e9, 1),
        "quotas": {},
        "usage": {"total_mb": round(total / 1e6, 1)},
    }
    _storage_cache[instance_id] = (now, result)
    return result


@app.get("/api/servers/{instance_id}/memory")
def memory_settings_get(instance_id: int) -> dict:
    from .engine.resources import get_memory_settings
    return get_memory_settings(instance_id)


@app.put("/api/servers/{instance_id}/memory")
def memory_settings_put(instance_id: int, payload: dict) -> dict:
    from .engine.resources import set_memory_settings
    return set_memory_settings(instance_id, payload)


@app.delete("/api/servers/{instance_id}/memory")
def memory_settings_reset(instance_id: int) -> dict:
    from .engine.resources import reset_memory_settings
    return reset_memory_settings(instance_id)


@app.get("/api/servers/{instance_id}/memory/live")
def memory_live(instance_id: int) -> dict:
    from .engine.resources import get_memory_live
    from .engine.instance_manager import get_engine
    engine = get_engine(instance_id)
    pid = engine.lifecycle.pid
    return get_memory_live(instance_id, pid)


@app.get("/api/servers/memory-topology")
def memory_topology() -> dict:
    from .engine.resources import get_memory_topology
    return get_memory_topology()


@app.get("/api/servers/{instance_id}/cpu-affinity")
def cpu_affinity_get(instance_id: int) -> dict:
    from .engine.resources import get_cpu_affinity
    return get_cpu_affinity(instance_id)


@app.put("/api/servers/{instance_id}/cpu-affinity")
def cpu_affinity_put(instance_id: int, payload: dict) -> dict:
    from .engine.resources import set_cpu_affinity
    from .engine.instance_manager import get_engine
    engine = get_engine(instance_id)
    pid = engine.lifecycle.pid
    return set_cpu_affinity(instance_id, payload, pid)


def _find_owner():
    from .db.panel import get_conn
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM users WHERE role='owner' LIMIT 1").fetchone()
        return dict(row) if row else None


@app.get("/api/setup/status")
def setup_status() -> dict:
    owner = _find_owner()
    return {"setup_complete": owner is not None, "has_owner": owner is not None}


@app.post("/api/setup/owner")
async def create_owner(payload: dict) -> dict:
    from .repos import users_repo
    from .services.password_hash import hash_password
    if _find_owner():
        return {"error": "Owner already exists"}
    username = payload.get("username", "").strip()
    password = payload.get("password", "")
    email = payload.get("email", "admin@localhost")
    if not username or not password:
        return {"error": "username and password required"}
    user_id = users_repo.create(
        username=username, email=email,
        password_hash=hash_password(password), role="owner",
    )
    return {"user_id": user_id, "username": username}


if FRONTEND_DIST.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/", response_class=HTMLResponse)
    def root_fallback() -> HTMLResponse:
        return HTMLResponse(
            "<h1>SITREP Lite — frontend not built</h1>"
            "<p>Run <code>npm run build</code> in frontend/</p>",
        )


def run() -> None:
    import uvicorn
    print("Starting SITREP Lite on http://localhost:8000")
    if sys.platform == "win32":
        webbrowser.open("http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")


if __name__ == "__main__":
    run()
