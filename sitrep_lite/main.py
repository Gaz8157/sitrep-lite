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
from .engine.server_engine import ServerEngine
from .paths import FRONTEND_DIST, ensure_dirs
from .routers import auth, audit, scheduler, server, settings, system, users, webhooks, workshop

log = logging.getLogger(__name__)

_BOOT_TS = time.time()
_engine: ServerEngine | None = None


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
    global _engine
    ensure_dirs()
    panel_migrate()
    state_migrate()
    from .engine.config import ensure_default_config
    from .services.settings import _load_or_create_secrets
    secrets = _load_or_create_secrets()
    ensure_default_config(secrets.get("rcon_password", ""))
    _engine = ServerEngine()
    server.set_engine(_engine)
    yield
    if _engine and _engine.lifecycle.pid:
        log.info("Shutting down — stopping server process")
        _engine.lifecycle.stop()
    _engine = None


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


@app.get("/api/servers/{instance_id}/storage")
def storage_stub(instance_id: int) -> dict:
    return {"quotas": {}, "usage": {}}


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
    pid = _engine.lifecycle.pid if _engine else None
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
    pid = _engine.lifecycle.pid if _engine else None
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
