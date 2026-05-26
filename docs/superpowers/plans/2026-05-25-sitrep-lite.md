# SITREP Lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows-native, single-server Arma Reforger panel derived from the full SITREP panel at /opt/sitrep.

**Architecture:** Fork the FastAPI backend, replace the AgentClient→Unix-socket→agent chain with a direct `ServerEngine` class that manages the server via subprocess, file I/O, and RCON. Ship the same React frontend with multi-instance/workshop/tracker tabs removed. Package with PyInstaller as a portable zip.

**Tech Stack:** Python 3.12+, FastAPI, uvicorn, SQLite, psutil, APScheduler, React/Vite, PyInstaller

**Source panel:** `/opt/sitrep` (backend), `/home/mark/sitrep/frontend/src` (frontend source)
**Target project:** `/home/mark/sitrep-lite/`

---

## File Structure

```
sitrep-lite/
├── pyproject.toml
├── sitrep_lite/
│   ├── __init__.py
│   ├── main.py                      # FastAPI app, lifespan, SPA serving
│   ├── paths.py                     # All path constants, resolved at startup
│   ├── db/
│   │   ├── __init__.py
│   │   ├── panel.py                 # Fork of backend/app/db/panel.py
│   │   ├── state.py                 # state.db for webhooks/scheduler/bans
│   │   └── migrations/
│   │       ├── panel/
│   │       │   ├── 0001_init.sql    # Fork: drop user_server_access table
│   │       │   └── 0002_settings.sql
│   │       └── state/
│   │           └── 0001_init.sql    # Webhooks, scheduler, bans tables
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── server_engine.py         # Main engine class — the agent replacement
│   │   ├── lifecycle.py             # subprocess start/stop/restart/status
│   │   ├── config.py                # config.json read/write/patch/validate
│   │   ├── rcon.py                  # BattlEye UDP RCON (forked from agent)
│   │   ├── files.py                 # File browser with path containment
│   │   ├── saves.py                 # Save list/inspect/purge, backup/restore
│   │   ├── logs.py                  # Log tail
│   │   ├── steamcmd.py              # Auto-download + server install/update
│   │   ├── mods.py                  # Config.json mods array + SteamCMD subscribe
│   │   ├── bans.py                  # JSON ban list + RCON kick
│   │   ├── players.py               # RCON #players parser
│   │   ├── metrics.py               # psutil system metrics (no GPU)
│   │   ├── diagnostics.py           # Health checks and auto-fixes
│   │   └── startup_params.py        # Launch argument catalog + read/write
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py                  # Copy as-is from full panel
│   ├── repos/
│   │   ├── __init__.py
│   │   ├── users_repo.py            # Copy as-is
│   │   ├── sessions_repo.py         # Copy as-is
│   │   ├── pending_2fa_repo.py      # Copy as-is
│   │   ├── password_resets_repo.py  # Copy as-is
│   │   ├── audit_repo.py           # Copy as-is
│   │   └── settings_repo.py        # Copy as-is
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py          # Fork: remove effective_role/per-server matrix
│   │   ├── settings.py              # Fork: auto-generate JWT_SECRET, Windows paths
│   │   ├── password_hash.py         # Copy as-is
│   │   ├── totp_service.py          # Copy as-is
│   │   ├── smtp_service.py          # Copy as-is
│   │   ├── discord_service.py       # Copy as-is
│   │   ├── runtime_settings.py      # Copy as-is
│   │   ├── webhooks.py              # NEW: webhook dispatch + event system
│   │   └── scheduler.py             # NEW: APScheduler wrapper
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py                  # Fork from full panel
│   │   ├── users.py                 # Fork: remove per-server access matrix routes
│   │   ├── server.py                # NEW: replaces servers.py, calls ServerEngine
│   │   ├── system.py                # Fork: remove GPU, keep CPU/RAM/disk/network
│   │   ├── settings.py              # Copy as-is
│   │   ├── audit.py                 # Copy as-is
│   │   ├── webhooks.py              # NEW: webhook CRUD via state.db
│   │   └── scheduler.py             # NEW: job CRUD via state.db + APScheduler
│   └── deps.py                      # Fork: simplify role checks (no per-server)
├── tests/
│   ├── conftest.py
│   ├── test_engine_lifecycle.py
│   ├── test_engine_config.py
│   ├── test_engine_rcon.py
│   ├── test_engine_files.py
│   ├── test_engine_saves.py
│   ├── test_engine_mods.py
│   ├── test_engine_bans.py
│   ├── test_engine_metrics.py
│   ├── test_server_router.py
│   └── test_auth_flow.py
├── frontend/                        # Forked React source
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                  # Modified: no server picker, hardcoded instance 1
│       ├── constants.js             # Modified: remove tracker/network/aigm tabs
│       └── ...                      # Rest copied from /home/mark/sitrep/frontend/src/
├── build/
│   ├── sitrep-lite.spec             # PyInstaller spec
│   └── build.sh                     # Build script (runs on Linux, cross-compiles)
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-25-sitrep-lite-design.md
```

**Copy-as-is strategy:** Many files from `/opt/sitrep/backend/app/` are pure Python with zero Linux dependencies. These are copied verbatim into `sitrep_lite/` and noted as "copy as-is" in the tasks below. The plan only shows full code for **new** files and **modified** files.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `sitrep-lite/pyproject.toml`
- Create: `sitrep-lite/sitrep_lite/__init__.py`
- Create: `sitrep-lite/sitrep_lite/paths.py`
- Create: `sitrep-lite/tests/__init__.py`
- Create: `sitrep-lite/tests/conftest.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "sitrep-lite"
version = "1.0.0"
description = "Windows-native Arma Reforger server panel"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "pydantic[email]>=2.8.0",
    "httpx>=0.27.0",
    "psutil>=6.0",
    "passlib[argon2]>=1.7.4",
    "PyJWT>=2.9.0",
    "pyotp>=2.9.0",
    "qrcode[pil]>=7.4.2",
    "aiosmtplib>=3.0.0",
    "apscheduler>=3.10,<4",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "ruff>=0.6"]
build = ["pyinstaller>=6.0"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 2: Create paths.py**

```python
"""All path constants for SITREP Lite.

Resolved once at import time. Every path is relative to BASE_DIR,
which defaults to the directory containing the exe (or the project
root during development).
"""
from __future__ import annotations

import os
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

def ensure_dirs() -> None:
    for d in (DATA_DIR, BACKUPS_DIR, SERVER_DIR, PROFILE_DIR, STEAMCMD_DIR):
        d.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 3: Create __init__.py and conftest.py**

`sitrep_lite/__init__.py`: empty file.

```python
# tests/conftest.py
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

@pytest.fixture(autouse=True)
def isolated_data(tmp_path, monkeypatch):
    """Point all path constants at a temp directory for test isolation."""
    import sitrep_lite.paths as p
    monkeypatch.setattr(p, "BASE_DIR", tmp_path)
    monkeypatch.setattr(p, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(p, "PANEL_DB", tmp_path / "data" / "panel.db")
    monkeypatch.setattr(p, "STATE_DB", tmp_path / "data" / "state.db")
    monkeypatch.setattr(p, "BACKUPS_DIR", tmp_path / "data" / "backups")
    monkeypatch.setattr(p, "SERVER_DIR", tmp_path / "server")
    monkeypatch.setattr(p, "PROFILE_DIR", tmp_path / "profile")
    monkeypatch.setattr(p, "STEAMCMD_DIR", tmp_path / "steamcmd")
    monkeypatch.setattr(p, "CONFIG_JSON", tmp_path / "config.json")
    monkeypatch.setattr(p, "SECRETS_FILE", tmp_path / "data" / "secrets.json")
    monkeypatch.setattr(p, "STEAMCMD_EXE", tmp_path / "steamcmd" / "steamcmd.exe")
    monkeypatch.setattr(p, "SERVER_EXE", tmp_path / "server" / "ArmaReforgerServer.exe")
    p.ensure_dirs()
```

- [ ] **Step 4: Verify project installs**

Run: `cd /home/mark/sitrep-lite && uv venv && uv pip install -e ".[dev]"`
Expected: installs cleanly

- [ ] **Step 5: Commit**

```bash
git init
git add pyproject.toml sitrep_lite/ tests/
git commit -m "feat: project scaffolding with paths and test isolation"
```

---

### Task 2: Database Layer

**Files:**
- Create: `sitrep_lite/db/__init__.py`
- Create: `sitrep_lite/db/panel.py`
- Create: `sitrep_lite/db/state.py`
- Create: `sitrep_lite/db/migrations/panel/0001_init.sql`
- Create: `sitrep_lite/db/migrations/panel/0002_settings.sql`
- Create: `sitrep_lite/db/migrations/state/0001_init.sql`

- [ ] **Step 1: Write test for panel DB migration**

```python
# tests/test_db.py
from sitrep_lite.db.panel import migrate, get_conn

def test_panel_migrate_creates_tables():
    applied = migrate()
    assert applied >= 1
    with get_conn() as conn:
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()]
        assert "users" in tables
        assert "sessions" in tables
        assert "audit_log" in tables
        assert "panel_settings" in tables
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_db.py -v`
Expected: ImportError

- [ ] **Step 3: Create panel.py — fork from /opt/sitrep/backend/app/db/panel.py**

Fork `/opt/sitrep/backend/app/db/panel.py` → `sitrep_lite/db/panel.py`. Change:
- Replace hardcoded `PANEL_DB_PATH` with import from `sitrep_lite.paths`:

```python
"""panel.db — auth/users/sessions/audit."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from ..paths import PANEL_DB

MIGRATIONS_DIR = Path(__file__).parent / "migrations" / "panel"


def _connect(path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(path or str(PANEL_DB), isolation_level=None, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row
    return conn


def migrate(path: str | None = None) -> int:
    target = path or str(PANEL_DB)
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    autocommit = _connect(target)
    try:
        autocommit.execute(
            "CREATE TABLE IF NOT EXISTS panel_schema_version "
            "(version INTEGER PRIMARY KEY)"
        )
        row = autocommit.execute(
            "SELECT MAX(version) AS v FROM panel_schema_version"
        ).fetchone()
        current = row["v"] or 0
    finally:
        autocommit.close()
    applied = 0
    for sql_file in sorted(MIGRATIONS_DIR.glob("[0-9]*.sql")):
        num = int(sql_file.name.split("_")[0])
        if num <= current:
            continue
        tx = sqlite3.connect(target)
        tx.execute("PRAGMA foreign_keys=ON")
        try:
            with tx:
                tx.executescript(sql_file.read_text())
                tx.execute(
                    "INSERT INTO panel_schema_version (version) VALUES (?)", (num,),
                )
        finally:
            tx.close()
        applied += 1
    return applied


@contextmanager
def get_conn(path: str | None = None) -> Iterator[sqlite3.Connection]:
    conn = _connect(path or str(PANEL_DB))
    try:
        yield conn
    finally:
        conn.close()
```

- [ ] **Step 4: Create panel migration 0001_init.sql**

Fork from `/opt/sitrep/backend/app/db/migrations/panel/0001_init.sql` but **remove the `user_server_access` table entirely** (no per-server roles in Lite):

```sql
CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK(role IN ('owner','head_admin','admin','moderator','viewer','demo')),
  totp_secret     TEXT,
  totp_backup_codes TEXT,
  discord_id      TEXT UNIQUE,
  discord_username TEXT,
  avatar_path     TEXT,
  background_path TEXT,
  created_at      INTEGER NOT NULL,
  last_login_at   INTEGER,
  last_login_ip   TEXT,
  disabled        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX users_role_idx ON users(role);

CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  last_used_at    INTEGER NOT NULL,
  ip              TEXT,
  user_agent      TEXT,
  remember        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

CREATE TABLE pending_2fa (
  token           TEXT PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at      INTEGER NOT NULL
);

CREATE TABLE password_resets (
  token           TEXT PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  used_at         INTEGER
);

CREATE TABLE audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              INTEGER NOT NULL,
  actor_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  target          TEXT,
  ip              TEXT,
  user_agent      TEXT,
  data            TEXT
);
CREATE INDEX audit_log_ts_idx ON audit_log(ts DESC);
CREATE INDEX audit_log_actor_idx ON audit_log(actor_user_id, ts DESC);
```

- [ ] **Step 5: Copy 0002_settings.sql as-is from full panel**

```sql
CREATE TABLE panel_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  INTEGER NOT NULL,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);
```

- [ ] **Step 6: Create state.db migration 0001_init.sql**

```sql
CREATE TABLE bans (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  identity  TEXT NOT NULL UNIQUE,
  reason    TEXT NOT NULL DEFAULT '',
  added_at  INTEGER NOT NULL,
  added_by  TEXT
);

CREATE TABLE webhooks (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  url       TEXT NOT NULL,
  kind      TEXT NOT NULL DEFAULT 'discord',
  events    TEXT NOT NULL DEFAULT '[]',
  enabled   INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE webhook_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id  INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  status_code INTEGER,
  response    TEXT,
  fired_at    INTEGER NOT NULL
);
CREATE INDEX webhook_log_wh_idx ON webhook_log(webhook_id, fired_at DESC);

CREATE TABLE scheduler_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  cron_expr   TEXT NOT NULL,
  action      TEXT NOT NULL,
  payload     TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE scheduler_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id    INTEGER NOT NULL REFERENCES scheduler_jobs(id) ON DELETE CASCADE,
  action    TEXT NOT NULL,
  result    TEXT,
  ran_at    INTEGER NOT NULL
);
CREATE INDEX scheduler_log_job_idx ON scheduler_log(job_id, ran_at DESC);
```

- [ ] **Step 7: Create state.py (same pattern as panel.py)**

```python
"""state.db — webhooks, scheduler, bans."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from ..paths import STATE_DB

MIGRATIONS_DIR = Path(__file__).parent / "migrations" / "state"


def _connect(path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(path or str(STATE_DB), isolation_level=None, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row
    return conn


def migrate(path: str | None = None) -> int:
    target = path or str(STATE_DB)
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    autocommit = _connect(target)
    try:
        autocommit.execute(
            "CREATE TABLE IF NOT EXISTS state_schema_version "
            "(version INTEGER PRIMARY KEY)"
        )
        row = autocommit.execute(
            "SELECT MAX(version) AS v FROM state_schema_version"
        ).fetchone()
        current = row["v"] or 0
    finally:
        autocommit.close()
    applied = 0
    for sql_file in sorted(MIGRATIONS_DIR.glob("[0-9]*.sql")):
        num = int(sql_file.name.split("_")[0])
        if num <= current:
            continue
        tx = sqlite3.connect(target)
        tx.execute("PRAGMA foreign_keys=ON")
        try:
            with tx:
                tx.executescript(sql_file.read_text())
                tx.execute(
                    "INSERT INTO state_schema_version (version) VALUES (?)", (num,),
                )
        finally:
            tx.close()
        applied += 1
    return applied


@contextmanager
def get_conn(path: str | None = None) -> Iterator[sqlite3.Connection]:
    conn = _connect(path or str(STATE_DB))
    try:
        yield conn
    finally:
        conn.close()
```

- [ ] **Step 8: Run test, verify it passes**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_db.py -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: database layer with panel.db and state.db migrations"
```

---

### Task 3: Settings, Secrets, and Auth Service

**Files:**
- Create: `sitrep_lite/services/__init__.py`
- Create: `sitrep_lite/services/settings.py`
- Create: `sitrep_lite/services/auth_service.py`
- Copy as-is: `sitrep_lite/services/password_hash.py` ← `/opt/sitrep/backend/app/services/password_hash.py`
- Copy as-is: `sitrep_lite/services/totp_service.py` ← `/opt/sitrep/backend/app/services/totp_service.py`
- Copy as-is: `sitrep_lite/services/smtp_service.py` ← `/opt/sitrep/backend/app/services/smtp_service.py`
- Copy as-is: `sitrep_lite/services/discord_service.py` ← `/opt/sitrep/backend/app/services/discord_service.py`
- Copy as-is: `sitrep_lite/services/runtime_settings.py` ← `/opt/sitrep/backend/app/services/runtime_settings.py`
- Create: `sitrep_lite/models/__init__.py`
- Copy as-is: `sitrep_lite/models/user.py` ← `/opt/sitrep/backend/app/models/user.py`

- [ ] **Step 1: Write test for auto-generated JWT secret**

```python
# tests/test_settings.py
import json
from sitrep_lite.services.settings import settings, _load_or_create_secrets

def test_auto_generates_jwt_secret(tmp_path, monkeypatch):
    import sitrep_lite.paths as p
    secrets_file = p.SECRETS_FILE
    assert not secrets_file.exists()
    s = _load_or_create_secrets()
    assert len(s["jwt_secret"]) >= 32
    assert secrets_file.exists()
    data = json.loads(secrets_file.read_text())
    assert data["jwt_secret"] == s["jwt_secret"]

def test_loads_existing_secret(tmp_path, monkeypatch):
    import sitrep_lite.paths as p
    p.SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    p.SECRETS_FILE.write_text(json.dumps({"jwt_secret": "test-secret-123"}))
    s = _load_or_create_secrets()
    assert s["jwt_secret"] == "test-secret-123"
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_settings.py -v`
Expected: ImportError

- [ ] **Step 3: Create settings.py**

Key difference from full panel: no env vars for JWT_SECRET. Instead, auto-generate on first run and persist to `data/secrets.json`. Discord/SMTP config loaded from runtime_settings (panel_settings table) same as the full panel.

```python
"""Settings for SITREP Lite.

JWT secret auto-generated on first run and persisted to data/secrets.json.
Discord/SMTP configured via the Settings page (stored in panel_settings table).
"""
from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from functools import lru_cache

from ..paths import SECRETS_FILE


@dataclass(frozen=True)
class AuthSettings:
    jwt_secret: str
    jwt_alg: str = "HS256"
    access_ttl_sec: int = 86400
    refresh_ttl_sec: int = 86400
    refresh_ttl_remember_sec: int = 2592000
    pending_2fa_ttl_sec: int = 300
    password_reset_ttl_sec: int = 1800

    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: str = ""

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = ""
    smtp_from_name: str = "SITREP Lite"

    auth_disabled: bool = False
    public_base_url: str = "http://localhost:8000"

    @property
    def discord_enabled(self) -> bool:
        return bool(self.discord_client_id and self.discord_client_secret
                     and self.discord_redirect_uri)

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_from)


def _load_or_create_secrets() -> dict:
    SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if SECRETS_FILE.exists():
        return json.loads(SECRETS_FILE.read_text())
    data = {
        "jwt_secret": secrets.token_hex(32),
        "rcon_password": secrets.token_hex(16),
    }
    SECRETS_FILE.write_text(json.dumps(data, indent=2))
    return data


def load_settings() -> AuthSettings:
    s = _load_or_create_secrets()
    # Discord/SMTP settings loaded from DB at runtime via runtime_settings
    # module — here we just provide the JWT secret and defaults.
    return AuthSettings(jwt_secret=s["jwt_secret"])


@lru_cache(maxsize=1)
def settings() -> AuthSettings:
    return load_settings()


def reload_settings() -> AuthSettings:
    """Clear cache and reload. Called after Settings page updates."""
    settings.cache_clear()
    return settings()
```

- [ ] **Step 4: Create auth_service.py — fork, remove per-server matrix**

```python
"""Auth primitives: JWT, refresh tokens.

Simplified from full panel: no per-server effective_role.
Global role is the only role.
"""
from __future__ import annotations

import secrets
import time
from typing import Any

import jwt

from .settings import AuthSettings


def issue_access_jwt(*, user_id: int, settings: AuthSettings) -> str:
    now = int(time.time())
    payload = {"sub": str(user_id), "iat": now, "exp": now + settings.access_ttl_sec}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def decode_access_jwt(token: str, *, settings: AuthSettings) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])


def new_refresh_token() -> str:
    return secrets.token_hex(32)
```

- [ ] **Step 5: Copy service files as-is from full panel**

Copy these files from `/opt/sitrep/backend/app/services/` to `sitrep_lite/services/`, adjusting only the import paths (`from ..repos` etc. stay the same since the relative structure is preserved):
- `password_hash.py`
- `totp_service.py`
- `smtp_service.py`
- `discord_service.py`
- `runtime_settings.py`

Copy `models/user.py` from `/opt/sitrep/backend/app/models/user.py` as-is.

- [ ] **Step 6: Run test, verify it passes**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_settings.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: settings with auto-generated secrets, auth service, models"
```

---

### Task 4: ServerEngine — Config and Lifecycle

**Files:**
- Create: `sitrep_lite/engine/__init__.py`
- Create: `sitrep_lite/engine/server_engine.py`
- Create: `sitrep_lite/engine/lifecycle.py`
- Create: `sitrep_lite/engine/config.py`
- Test: `tests/test_engine_lifecycle.py`
- Test: `tests/test_engine_config.py`

- [ ] **Step 1: Write test for config read/write/patch**

```python
# tests/test_engine_config.py
import json
from sitrep_lite.engine.config import read_config, write_config, patch_config
from sitrep_lite.paths import CONFIG_JSON

def test_write_and_read_config():
    cfg = {"game": {"name": "Test Server", "maxPlayers": 16}}
    write_config(cfg)
    result = read_config()
    assert result["game"]["name"] == "Test Server"
    assert result["game"]["maxPlayers"] == 16

def test_patch_config_deep_merge():
    write_config({"game": {"name": "Test", "maxPlayers": 32}, "bindPort": 2001})
    patch_config({"game": {"maxPlayers": 16}})
    result = read_config()
    assert result["game"]["maxPlayers"] == 16
    assert result["game"]["name"] == "Test"
    assert result["bindPort"] == 2001
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_engine_config.py -v`
Expected: ImportError

- [ ] **Step 3: Create engine/config.py**

```python
"""Config.json read/write/patch/validate for the single server."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..paths import CONFIG_JSON


def _deep_merge(dst: dict, src: dict) -> dict:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            _deep_merge(dst[k], v)
        else:
            dst[k] = v
    return dst


def read_config() -> dict[str, Any]:
    if not CONFIG_JSON.exists():
        return {}
    return json.loads(CONFIG_JSON.read_text())


def write_config(config: dict[str, Any]) -> None:
    tmp = CONFIG_JSON.with_suffix(".tmp")
    tmp.write_text(json.dumps(config, indent=2) + "\n")
    tmp.replace(CONFIG_JSON)


def patch_config(patch: dict[str, Any]) -> dict[str, Any]:
    current = read_config()
    _deep_merge(current, patch)
    write_config(current)
    return current


def validate_config(config: dict[str, Any]) -> list[str]:
    errors = []
    game = config.get("game")
    if not isinstance(game, dict):
        errors.append("'game' section is required")
        return errors
    mp = game.get("maxPlayers")
    if mp is not None and (not isinstance(mp, int) or mp < 1 or mp > 256):
        errors.append("game.maxPlayers must be 1-256")
    bp = config.get("bindPort")
    if bp is not None and (not isinstance(bp, int) or bp < 1 or bp > 65535):
        errors.append("bindPort must be 1-65535")
    rcon = config.get("rcon", {})
    if isinstance(rcon, dict):
        rp = rcon.get("port")
        if rp is not None and (not isinstance(rp, int) or rp < 1 or rp > 65535):
            errors.append("rcon.port must be 1-65535")
    return errors


def ensure_default_config(rcon_password: str) -> dict[str, Any]:
    """Create a default config.json if none exists. Returns the config."""
    if CONFIG_JSON.exists():
        return read_config()
    config = {
        "bindAddress": "0.0.0.0",
        "bindPort": 2001,
        "publicAddress": "",
        "publicPort": 2001,
        "a2s": {"address": "0.0.0.0", "port": 17777},
        "rcon": {
            "address": "127.0.0.1",
            "port": 19999,
            "password": rcon_password,
            "permission": "admin",
            "blacklist": [],
            "whitelist": [],
        },
        "game": {
            "name": "SITREP Lite Server",
            "password": "",
            "passwordAdmin": "",
            "scenarioId": "{ECC61978EDCC2B5A}Missions/23_Campaign.conf",
            "maxPlayers": 32,
            "visible": True,
            "crossPlatform": True,
            "supportedPlatforms": ["PLATFORM_PC", "PLATFORM_XBL", "PLATFORM_PSN"],
            "gameProperties": {
                "serverMaxViewDistance": 2500,
                "serverMinGrassDistance": 50,
                "fastValidation": True,
                "networkViewDistance": 1500,
            },
            "mods": [],
        },
        "operating": {"lobbyPlayerSynchronise": True},
    }
    write_config(config)
    return config
```

- [ ] **Step 4: Write test for lifecycle**

```python
# tests/test_engine_lifecycle.py
import sys
from unittest.mock import patch, MagicMock
from sitrep_lite.engine.lifecycle import ServerLifecycle, ServerState

def test_initial_state_is_stopped():
    lc = ServerLifecycle()
    assert lc.state == ServerState.STOPPED
    assert lc.pid is None
    assert lc.uptime_sec == 0

def test_status_returns_dict():
    lc = ServerLifecycle()
    s = lc.status()
    assert s["state"] == "stopped"
    assert s["pid"] is None
    assert s["binary_installed"] is False
```

- [ ] **Step 5: Create engine/lifecycle.py**

```python
"""Server process lifecycle via subprocess.Popen."""
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
```

- [ ] **Step 6: Create engine/server_engine.py — the facade**

```python
"""ServerEngine — the single entry point replacing the AgentClient.

Each subsystem is a separate module. ServerEngine composes them and
provides the same method signatures the routers expect.
"""
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
```

Methods for other subsystems will be added in subsequent tasks as those modules are built.

- [ ] **Step 7: Run tests, verify they pass**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_engine_config.py tests/test_engine_lifecycle.py -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: ServerEngine with config and lifecycle management"
```

---

### Task 5: ServerEngine — RCON Client

**Files:**
- Create: `sitrep_lite/engine/rcon.py`
- Test: `tests/test_engine_rcon.py`

- [ ] **Step 1: Write test for RCON packet building**

```python
# tests/test_engine_rcon.py
from sitrep_lite.engine.rcon import _build_login, _build_command, _parse_packet

def test_build_login_packet():
    pkt = _build_login("mypass")
    assert pkt[:2] == b"BE"
    assert pkt[6] == 0xFF
    assert pkt[7] == 0x00
    assert pkt[8:] == b"mypass"

def test_build_command_packet():
    pkt = _build_command(0, "#players")
    assert pkt[:2] == b"BE"
    assert pkt[7] == 0x01
    assert pkt[8] == 0x00
    assert pkt[9:] == b"#players"

def test_parse_login_success():
    pkt = _build_login("test")
    # Simulate a login success response
    payload = b"\xff\x00\x01"
    import binascii, struct
    crc = struct.pack("<I", binascii.crc32(payload) & 0xFFFFFFFF)
    resp = b"BE" + crc + payload
    result = _parse_packet(resp)
    assert result is not None
    assert result[0] == 0x00  # login type
    assert result[1] == 0x01  # success
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_engine_rcon.py -v`
Expected: ImportError

- [ ] **Step 3: Fork RCON from agent**

Fork `/opt/sitrep/agent/sitrep_agent/ops/rcon.py` → `sitrep_lite/engine/rcon.py`. Changes:
- Remove `StateStore` dependency (password comes from `paths.SECRETS_FILE`)
- Remove `_rcon_port_for` multi-instance logic (read port from config.json)
- Remove `send()` and `say()` dispatch functions (ServerEngine calls `_rcon_call` directly)
- Keep all packet-building and protocol functions intact

```python
"""BattlEye RCON client for Reforger.

Forked from the full panel's agent/ops/rcon.py. Stripped of multi-instance
state store; password and port read from config.json and secrets.json.
"""
from __future__ import annotations

import asyncio
import binascii
import json
import socket
import struct
from typing import Any

from ..paths import CONFIG_JSON, SECRETS_FILE

RCON_HOST = "127.0.0.1"
RCON_TIMEOUT = 5.0


def _get_rcon_port() -> int:
    try:
        cfg = json.loads(CONFIG_JSON.read_text())
        port = cfg.get("rcon", {}).get("port")
        if isinstance(port, int) and 1 <= port <= 65535:
            return port
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return 19999


def _get_rcon_password() -> str:
    try:
        cfg = json.loads(CONFIG_JSON.read_text())
        pw = cfg.get("rcon", {}).get("password")
        if isinstance(pw, str) and pw:
            return pw
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    try:
        s = json.loads(SECRETS_FILE.read_text())
        return s.get("rcon_password", "")
    except (OSError, ValueError, json.JSONDecodeError):
        return ""


def _crc32_le(data: bytes) -> bytes:
    return struct.pack("<I", binascii.crc32(data) & 0xFFFFFFFF)


def _build_login(password: str) -> bytes:
    payload = b"\xff\x00" + password.encode("utf-8")
    return b"BE" + _crc32_le(payload) + payload


def _build_command(seq: int, command: str) -> bytes:
    payload = b"\xff\x01" + bytes([seq & 0xFF]) + command.encode("utf-8")
    return b"BE" + _crc32_le(payload) + payload


def _build_message_ack(seq: int) -> bytes:
    payload = b"\xff\x02" + bytes([seq & 0xFF])
    return b"BE" + _crc32_le(payload) + payload


def _parse_packet(packet: bytes) -> tuple[int, int, bytes] | None:
    if len(packet) < 9 or packet[:2] != b"BE":
        return None
    if packet[6] != 0xFF:
        return None
    pkt_type = packet[7]
    if pkt_type == 0x00:
        return (0x00, packet[8], b"")
    if pkt_type == 0x01:
        return (0x01, packet[8], packet[9:])
    if pkt_type == 0x02:
        return (0x02, packet[8], packet[9:])
    return None


async def rcon_call(command: str, *, host: str | None = None,
                    port: int | None = None, password: str | None = None,
                    timeout: float = RCON_TIMEOUT) -> str:
    host = host or RCON_HOST
    port = port or _get_rcon_port()
    password = password or _get_rcon_password()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setblocking(False)
    loop = asyncio.get_running_loop()
    sock.connect((host, port))

    async def _send(data: bytes) -> None:
        await loop.sock_sendall(sock, data)

    try:
        await _send(_build_login(password))
        resp = await asyncio.wait_for(loop.sock_recv(sock, 4096), timeout)
        parsed = _parse_packet(resp)
        if parsed is None or parsed[0] != 0x00 or parsed[1] != 0x01:
            raise RuntimeError("RCON login failed (wrong password?)")

        while True:
            try:
                pre = await asyncio.wait_for(loop.sock_recv(sock, 4096), 0.3)
            except asyncio.TimeoutError:
                break
            pp = _parse_packet(pre)
            if pp is not None and pp[0] == 0x02:
                await _send(_build_message_ack(pp[1]))

        await _send(_build_command(0, command))

        chunks: dict[int, bytes] = {}
        expected_total: int | None = None
        body = b""
        single_packet = False

        while True:
            try:
                resp = await asyncio.wait_for(loop.sock_recv(sock, 4096), 1.0)
            except asyncio.TimeoutError:
                break
            p = _parse_packet(resp)
            if p is None:
                continue
            if p[0] == 0x02:
                await _send(_build_message_ack(p[1]))
                continue
            if p[0] != 0x01:
                continue
            chunk = p[2]
            if len(chunk) >= 3 and chunk[0] == 0x00:
                total = chunk[1]
                index = chunk[2]
                chunks[index] = chunk[3:]
                expected_total = total
                if len(chunks) >= total:
                    break
            else:
                body = chunk
                single_packet = True
                break

        if not single_packet and expected_total is not None:
            body = b"".join(chunks[i] for i in sorted(chunks.keys()))

        return body.decode("utf-8", errors="replace")
    finally:
        sock.close()
```

- [ ] **Step 4: Run tests**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_engine_rcon.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: BattlEye RCON client forked from agent"
```

---

### Task 6: ServerEngine — Files, Saves, Logs

**Files:**
- Create: `sitrep_lite/engine/files.py`
- Create: `sitrep_lite/engine/saves.py`
- Create: `sitrep_lite/engine/logs.py`
- Test: `tests/test_engine_files.py`

- [ ] **Step 1: Write test for file operations with path containment**

```python
# tests/test_engine_files.py
import pytest
from sitrep_lite.engine.files import list_files, read_file, write_file, delete_file, mkdir
from sitrep_lite.paths import PROFILE_DIR

def test_list_empty_profile(tmp_path):
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    result = list_files("")
    assert result["entries"] == []

def test_write_and_read_file():
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    write_file("test.txt", "hello world")
    result = read_file("test.txt")
    assert result["content"] == "hello world"

def test_path_traversal_blocked():
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    with pytest.raises(ValueError, match="outside"):
        read_file("../../etc/passwd")

def test_mkdir_and_list():
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    mkdir("subdir")
    result = list_files("")
    names = [e["name"] for e in result["entries"]]
    assert "subdir" in names
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_engine_files.py -v`
Expected: ImportError

- [ ] **Step 3: Create engine/files.py**

```python
"""File browser scoped to the profile directory."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from ..paths import PROFILE_DIR


def _safe_path(rel_path: str) -> Path:
    resolved = (PROFILE_DIR / rel_path).resolve()
    if not str(resolved).startswith(str(PROFILE_DIR.resolve())):
        raise ValueError(f"Path {rel_path!r} resolves outside profile directory")
    return resolved


def list_files(rel_path: str = "") -> dict[str, Any]:
    target = _safe_path(rel_path)
    if not target.exists():
        return {"path": rel_path, "entries": []}
    entries = []
    for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        stat = item.stat()
        entries.append({
            "name": item.name,
            "is_dir": item.is_dir(),
            "size": stat.st_size if item.is_file() else 0,
            "mtime": int(stat.st_mtime),
        })
    return {"path": rel_path, "entries": entries}


def read_file(rel_path: str) -> dict[str, Any]:
    target = _safe_path(rel_path)
    if not target.is_file():
        raise FileNotFoundError(f"{rel_path} not found")
    content = target.read_text(errors="replace")
    return {"path": rel_path, "content": content, "size": target.stat().st_size}


def write_file(rel_path: str, content: str) -> dict[str, Any]:
    target = _safe_path(rel_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    return {"path": rel_path, "size": target.stat().st_size}


def delete_file(rel_path: str) -> dict[str, Any]:
    target = _safe_path(rel_path)
    if target.is_dir():
        import shutil
        shutil.rmtree(target)
    elif target.is_file():
        target.unlink()
    else:
        raise FileNotFoundError(f"{rel_path} not found")
    return {"path": rel_path, "deleted": True}


def mkdir(rel_path: str) -> dict[str, Any]:
    target = _safe_path(rel_path)
    target.mkdir(parents=True, exist_ok=True)
    return {"path": rel_path, "created": True}
```

- [ ] **Step 4: Create engine/saves.py**

```python
"""Save file management and backups as .zip."""
from __future__ import annotations

import shutil
import time
import zipfile
from pathlib import Path
from typing import Any

from ..paths import PROFILE_DIR, BACKUPS_DIR


def _save_dir() -> Path:
    return PROFILE_DIR / ".save"


def list_saves() -> dict[str, Any]:
    sd = _save_dir()
    if not sd.exists():
        return {"saves": []}
    saves = []
    for item in sorted(sd.iterdir()):
        if item.is_dir():
            total_size = sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
            saves.append({
                "name": item.name,
                "size": total_size,
                "mtime": int(item.stat().st_mtime),
            })
    return {"saves": saves}


def inspect_save(save_path: str) -> dict[str, Any]:
    target = _save_dir() / save_path
    if not target.is_dir():
        raise FileNotFoundError(f"Save {save_path!r} not found")
    files = []
    for f in target.rglob("*"):
        if f.is_file():
            files.append({"path": str(f.relative_to(target)), "size": f.stat().st_size})
    return {"name": save_path, "files": files}


def purge_save(save_path: str | None = None) -> dict[str, Any]:
    if save_path:
        target = _save_dir() / save_path
        if target.is_dir():
            shutil.rmtree(target)
        return {"purged": save_path}
    sd = _save_dir()
    if sd.exists():
        shutil.rmtree(sd)
        sd.mkdir()
    return {"purged": "all"}


def create_backup() -> dict[str, Any]:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    filename = f"backup-{ts}.zip"
    zip_path = BACKUPS_DIR / filename
    sd = _save_dir()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        if sd.exists():
            for f in sd.rglob("*"):
                if f.is_file():
                    zf.write(f, f.relative_to(PROFILE_DIR))
    return {"filename": filename, "size": zip_path.stat().st_size}


def list_backups() -> dict[str, Any]:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    backups = []
    for f in sorted(BACKUPS_DIR.glob("backup-*.zip"), reverse=True):
        backups.append({"filename": f.name, "size": f.stat().st_size, "mtime": int(f.stat().st_mtime)})
    return {"backups": backups}


def restore_backup(filename: str) -> dict[str, Any]:
    zip_path = BACKUPS_DIR / filename
    if not zip_path.is_file():
        raise FileNotFoundError(f"Backup {filename!r} not found")
    sd = _save_dir()
    if sd.exists():
        shutil.rmtree(sd)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(PROFILE_DIR)
    return {"restored": filename}


def delete_backup(filename: str) -> dict[str, Any]:
    zip_path = BACKUPS_DIR / filename
    if not zip_path.is_file():
        raise FileNotFoundError(f"Backup {filename!r} not found")
    zip_path.unlink()
    return {"deleted": filename}
```

- [ ] **Step 5: Create engine/logs.py**

```python
"""Server log tailing."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from ..paths import PROFILE_DIR


def tail_logs(lines: int = 100) -> dict[str, Any]:
    log_dir = PROFILE_DIR / "logs"
    if not log_dir.exists():
        return {"lines": [], "file": None}
    log_files = sorted(log_dir.glob("*.log"), key=lambda f: f.stat().st_mtime, reverse=True)
    if not log_files:
        return {"lines": [], "file": None}
    latest = log_files[0]
    all_lines = latest.read_text(errors="replace").splitlines()
    return {
        "lines": all_lines[-lines:],
        "file": latest.name,
        "total_lines": len(all_lines),
    }
```

- [ ] **Step 6: Run tests**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_engine_files.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: file browser, save management, log tailing"
```

---

### Task 7: ServerEngine — SteamCMD and Mods

**Files:**
- Create: `sitrep_lite/engine/steamcmd.py`
- Create: `sitrep_lite/engine/mods.py`
- Test: `tests/test_engine_mods.py`

- [ ] **Step 1: Write test for mod add/remove via config.json**

```python
# tests/test_engine_mods.py
from sitrep_lite.engine.config import write_config, read_config
from sitrep_lite.engine.mods import list_mods, add_mod, remove_mod, clear_mods, extract_guid

def test_add_and_list_mod():
    write_config({"game": {"name": "Test", "mods": []}})
    add_mod("5965550E5B1B64F7")
    result = list_mods()
    assert len(result["mods"]) == 1
    assert result["mods"][0]["modId"] == "5965550E5B1B64F7"

def test_remove_mod():
    write_config({"game": {"name": "Test", "mods": [{"modId": "AAA", "name": "", "version": ""}]}})
    remove_mod("AAA")
    result = list_mods()
    assert len(result["mods"]) == 0

def test_clear_mods():
    write_config({"game": {"name": "Test", "mods": [
        {"modId": "AAA", "name": "", "version": ""},
        {"modId": "BBB", "name": "", "version": ""},
    ]}})
    clear_mods()
    assert len(list_mods()["mods"]) == 0

def test_extract_guid_from_url():
    assert extract_guid("5965550E5B1B64F7") == "5965550E5B1B64F7"
    assert extract_guid("https://reforger.armaplatform.com/workshop/5965550E5B1B64F7-SomeMod") == "5965550E5B1B64F7"
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_engine_mods.py -v`

- [ ] **Step 3: Create engine/mods.py**

```python
"""Mod management via config.json + SteamCMD workshop downloads."""
from __future__ import annotations

import re
from typing import Any

from .config import read_config, write_config

_GUID_RE = re.compile(r"^[0-9A-Fa-f]{16}$")
_URL_GUID_RE = re.compile(r"/workshop/([0-9A-Fa-f]{16})")


def extract_guid(input_str: str) -> str:
    input_str = input_str.strip()
    if _GUID_RE.match(input_str):
        return input_str.upper()
    m = _URL_GUID_RE.search(input_str)
    if m:
        return m.group(1).upper()
    raise ValueError(f"Cannot extract mod GUID from: {input_str!r}")


def list_mods() -> dict[str, Any]:
    cfg = read_config()
    mods = cfg.get("game", {}).get("mods", [])
    if not isinstance(mods, list):
        mods = []
    return {"mods": mods}


def add_mod(guid_or_url: str) -> dict[str, Any]:
    guid = extract_guid(guid_or_url)
    cfg = read_config()
    game = cfg.setdefault("game", {})
    mods = game.setdefault("mods", [])
    if not isinstance(mods, list):
        mods = []
        game["mods"] = mods
    if any(m.get("modId") == guid for m in mods):
        return {"state": "already_added", "mod_guid": guid}
    mods.append({"modId": guid, "name": "", "version": ""})
    write_config(cfg)
    return {"state": "added", "mod_guid": guid}


def remove_mod(guid: str) -> dict[str, Any]:
    cfg = read_config()
    game = cfg.get("game", {})
    mods = game.get("mods", [])
    game["mods"] = [m for m in mods if m.get("modId") != guid]
    write_config(cfg)
    return {"state": "removed", "mod_guid": guid}


def clear_mods() -> dict[str, Any]:
    cfg = read_config()
    cfg.setdefault("game", {})["mods"] = []
    write_config(cfg)
    return {"state": "cleared"}
```

- [ ] **Step 4: Create engine/steamcmd.py**

```python
"""SteamCMD auto-download and server install/update."""
from __future__ import annotations

import asyncio
import logging
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
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
        f"+force_install_dir", str(SERVER_DIR),
        "+login", "anonymous",
        f"+app_update", str(REFORGER_APP_ID), "validate",
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
```

- [ ] **Step 5: Run tests**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_engine_mods.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: SteamCMD bootstrap, mod management by GUID"
```

---

### Task 8: ServerEngine — Bans, Players, Metrics, Diagnostics, Startup Params

**Files:**
- Create: `sitrep_lite/engine/bans.py`
- Create: `sitrep_lite/engine/players.py`
- Create: `sitrep_lite/engine/metrics.py`
- Create: `sitrep_lite/engine/diagnostics.py`
- Create: `sitrep_lite/engine/startup_params.py`
- Test: `tests/test_engine_bans.py`
- Test: `tests/test_engine_metrics.py`

- [ ] **Step 1: Write test for bans**

```python
# tests/test_engine_bans.py
from sitrep_lite.engine.bans import list_bans, add_ban, remove_ban

def test_add_and_list_ban():
    add_ban("player123", reason="cheating")
    result = list_bans()
    assert len(result["bans"]) == 1
    assert result["bans"][0]["identity"] == "player123"
    assert result["bans"][0]["reason"] == "cheating"

def test_remove_ban():
    add_ban("player123")
    remove_ban("player123")
    assert len(list_bans()["bans"]) == 0

def test_duplicate_ban_ignored():
    add_ban("player123")
    add_ban("player123")
    assert len(list_bans()["bans"]) == 1
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_engine_bans.py -v`

- [ ] **Step 3: Create engine/bans.py**

```python
"""Ban list stored in state.db."""
from __future__ import annotations

import time
from typing import Any

from ..db.state import get_conn, migrate


def _ensure_db() -> None:
    migrate()


def list_bans() -> dict[str, Any]:
    _ensure_db()
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM bans ORDER BY added_at DESC").fetchall()
        return {"bans": [dict(r) for r in rows]}


def add_ban(identity: str, reason: str = "", added_by: str = "") -> dict[str, Any]:
    _ensure_db()
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM bans WHERE identity=?", (identity,)).fetchone()
        if existing:
            return {"state": "already_banned", "identity": identity}
        conn.execute(
            "INSERT INTO bans (identity, reason, added_at, added_by) VALUES (?,?,?,?)",
            (identity, reason, int(time.time()), added_by),
        )
        return {"state": "banned", "identity": identity}


def remove_ban(identity: str) -> dict[str, Any]:
    _ensure_db()
    with get_conn() as conn:
        conn.execute("DELETE FROM bans WHERE identity=?", (identity,))
        return {"state": "unbanned", "identity": identity}
```

- [ ] **Step 4: Create engine/players.py**

```python
"""Player list via RCON."""
from __future__ import annotations

import re
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
```

- [ ] **Step 5: Create engine/metrics.py — fork from system router, remove GPU**

```python
"""System metrics via psutil. No GPU."""
from __future__ import annotations

import time
from typing import Any

import psutil

psutil.cpu_percent(interval=None)
psutil.cpu_percent(interval=None, percpu=True)

_last_net: dict[str, float] = {"ts": 0.0, "bytes_sent": 0.0, "bytes_recv": 0.0}


def system_metrics() -> dict[str, Any]:
    now = time.time()
    cpu_percent = psutil.cpu_percent(interval=None)
    per_core = psutil.cpu_percent(interval=None, percpu=True) or []
    vm = psutil.virtual_memory()

    disks = []
    seen_devs: set[str] = set()
    for d in psutil.disk_partitions(all=False):
        if d.device in seen_devs:
            continue
        seen_devs.add(d.device)
        try:
            u = psutil.disk_usage(d.mountpoint)
        except (PermissionError, FileNotFoundError, OSError):
            continue
        disks.append({
            "name": d.mountpoint,
            "used": round(u.used / 1e9, 1),
            "total": round(u.total / 1e9, 1),
            "pct": round(u.used / u.total * 100, 1) if u.total else 0,
        })

    net = psutil.net_io_counters()
    up_mbps = 0.0
    down_mbps = 0.0
    if _last_net["ts"] > 0:
        dt = now - _last_net["ts"]
        if dt > 0:
            up_mbps = round((net.bytes_sent - _last_net["bytes_sent"]) * 8 / 1e6 / dt, 2)
            down_mbps = round((net.bytes_recv - _last_net["bytes_recv"]) * 8 / 1e6 / dt, 2)
    _last_net["ts"] = now
    _last_net["bytes_sent"] = net.bytes_sent
    _last_net["bytes_recv"] = net.bytes_recv

    return {
        "ts": now,
        "cpu": {
            "usage": round(cpu_percent, 1),
            "cores": psutil.cpu_count() or 0,
            "per_core": [round(v, 1) for v in per_core],
        },
        "ram": {
            "used": round(vm.used / 1e9, 1),
            "total": round(vm.total / 1e9, 1),
            "pct": int(vm.percent),
        },
        "disks": disks,
        "network_rate": {"up_mbps": up_mbps, "down_mbps": down_mbps},
    }
```

- [ ] **Step 6: Create engine/diagnostics.py**

```python
"""Diagnostics checks and auto-fixes."""
from __future__ import annotations

from typing import Any

from ..paths import SERVER_EXE, CONFIG_JSON, PROFILE_DIR
from .config import read_config


def run_checks() -> dict[str, Any]:
    checks = []
    checks.append(_check_binary())
    checks.append(_check_config())
    checks.append(_check_profile())
    return {"checks": checks}


def _check_binary() -> dict[str, Any]:
    ok = SERVER_EXE.exists()
    return {
        "id": "binary_installed",
        "label": "Server Binary",
        "ok": ok,
        "message": "Installed" if ok else "Not installed — use Install Server",
        "fix_id": "install_server" if not ok else None,
    }


def _check_config() -> dict[str, Any]:
    if not CONFIG_JSON.exists():
        return {"id": "config_exists", "label": "Config File", "ok": False,
                "message": "config.json missing", "fix_id": "create_default_config"}
    try:
        cfg = read_config()
        game = cfg.get("game", {})
        if not game.get("scenarioId"):
            return {"id": "config_valid", "label": "Config Valid", "ok": False,
                    "message": "No scenario selected", "fix_id": None}
    except Exception as e:
        return {"id": "config_valid", "label": "Config Valid", "ok": False,
                "message": f"Config parse error: {e}", "fix_id": None}
    return {"id": "config_valid", "label": "Config Valid", "ok": True, "message": "OK"}


def _check_profile() -> dict[str, Any]:
    ok = PROFILE_DIR.exists()
    return {"id": "profile_dir", "label": "Profile Directory", "ok": ok,
            "message": "Exists" if ok else "Missing — will be created on server start"}


def apply_fix(fix_id: str, payload: dict | None = None) -> dict[str, Any]:
    if fix_id == "create_default_config":
        from .config import ensure_default_config
        from ..services.settings import _load_or_create_secrets
        secrets = _load_or_create_secrets()
        ensure_default_config(secrets.get("rcon_password", ""))
        return {"ok": True, "message": "Default config.json created"}
    return {"ok": False, "message": f"Unknown fix: {fix_id}"}
```

- [ ] **Step 7: Create engine/startup_params.py**

```python
"""Startup parameter management."""
from __future__ import annotations

import json
from typing import Any

from ..paths import CONFIG_JSON, PROFILE_DIR, SERVER_EXE, DATA_DIR

_PARAMS_FILE = DATA_DIR / "startup_params.json"

PARAM_CATALOG = [
    {"key": "maxFPS", "type": "int", "default": 60, "label": "Max FPS", "desc": "Server frame rate cap"},
    {"key": "maxPlayers", "type": "int", "default": 32, "label": "Max Players (CLI override)"},
    {"key": "nds", "type": "int", "default": 128, "label": "Network Data Size"},
    {"key": "nwkResolution", "type": "int", "default": 2, "label": "Network Resolution"},
    {"key": "staggeringBudget", "type": "int", "default": 2500, "label": "Staggering Budget"},
    {"key": "streamingBudget", "type": "int", "default": 500, "label": "Streaming Budget"},
    {"key": "streamsDelta", "type": "int", "default": 100, "label": "Streams Delta"},
    {"key": "logLevel", "type": "string", "default": "normal", "label": "Log Level"},
]


def catalog() -> dict[str, Any]:
    return {"params": PARAM_CATALOG}


def read_params() -> dict[str, Any]:
    if _PARAMS_FILE.exists():
        data = json.loads(_PARAMS_FILE.read_text())
    else:
        data = {"params": {}, "customLaunchParams": ""}
    return {
        "catalog": PARAM_CATALOG,
        "current": data.get("params", {}),
        "customLaunchParams": data.get("customLaunchParams", ""),
    }


def write_params(params: dict[str, Any], custom_launch_params: str = "") -> dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    data = {"params": params, "customLaunchParams": custom_launch_params}
    _PARAMS_FILE.write_text(json.dumps(data, indent=2))
    return read_params()


def build_launch_args() -> list[str]:
    data = read_params()
    args = [
        f"-config={CONFIG_JSON}",
        f"-profile={PROFILE_DIR}",
        f"-logDir={PROFILE_DIR / 'logs'}",
    ]
    for p in PARAM_CATALOG:
        key = p["key"]
        val = data["current"].get(key, p.get("default"))
        if val is not None:
            args.append(f"-{key}={val}")
    custom = data.get("customLaunchParams", "").strip()
    if custom:
        args.extend(custom.split())
    return args
```

- [ ] **Step 8: Run tests**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/test_engine_bans.py tests/test_engine_metrics.py -v`
Expected: PASS (test_engine_metrics.py just needs a simple import+call test)

- [ ] **Step 9: Wire all subsystems into ServerEngine**

Update `sitrep_lite/engine/server_engine.py` to expose methods for every subsystem. Each method delegates to the corresponding module function. This keeps the engine as a thin facade.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: bans, players, metrics, diagnostics, startup params"
```

---

### Task 9: Repos Layer (Copy from Full Panel)

**Files:**
- Create: `sitrep_lite/repos/__init__.py`
- Copy: `sitrep_lite/repos/users_repo.py` ← `/opt/sitrep/backend/app/repos/users_repo.py`
- Copy: `sitrep_lite/repos/sessions_repo.py` ← `/opt/sitrep/backend/app/repos/sessions_repo.py`
- Copy: `sitrep_lite/repos/pending_2fa_repo.py` ← `/opt/sitrep/backend/app/repos/pending_2fa_repo.py`
- Copy: `sitrep_lite/repos/password_resets_repo.py` ← `/opt/sitrep/backend/app/repos/password_resets_repo.py`
- Copy: `sitrep_lite/repos/audit_repo.py` ← `/opt/sitrep/backend/app/repos/audit_repo.py`
- Copy: `sitrep_lite/repos/settings_repo.py` ← `/opt/sitrep/backend/app/repos/settings_repo.py`

- [ ] **Step 1: Copy all repo files**

Copy each file, adjusting only the import path for `db.panel`:
- Change `from ..db.panel import get_conn` → stays the same (relative imports preserved by matching directory structure)

Do NOT copy `user_server_access_repo.py` — per-server access matrix is removed in Lite.

- [ ] **Step 2: Verify imports resolve**

Run: `cd /home/mark/sitrep-lite && uv run python -c "from sitrep_lite.repos import users_repo, sessions_repo, audit_repo; print('OK')"`
Expected: OK

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: repos layer (forked from full panel, no per-server access)"
```

---

### Task 10: Deps and Auth Router

**Files:**
- Create: `sitrep_lite/deps.py`
- Fork: `sitrep_lite/routers/auth.py` ← `/opt/sitrep/backend/app/routers/auth.py`
- Create: `sitrep_lite/routers/__init__.py`

- [ ] **Step 1: Create deps.py — simplified, no per-server role check**

```python
"""FastAPI dependencies: auth + role gates.

Simplified from full panel: no per-server access matrix.
Global role is the only role.
"""
from __future__ import annotations

from typing import Any
from fastapi import HTTPException, Request

import jwt

from .repos import users_repo
from .services import auth_service
from .services.settings import settings


async def get_current_user(request: Request) -> dict[str, Any] | None:
    s = settings()
    if s.auth_disabled:
        return {"id": 0, "username": "owner", "email": "", "role": "owner", "disabled": 0}
    token = request.cookies.get("sitrep-access")
    if not token:
        return None
    try:
        payload = auth_service.decode_access_jwt(token, settings=s)
    except jwt.PyJWTError:
        return None
    try:
        uid = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return None
    user = users_repo.get(uid)
    if not user or user.get("disabled"):
        return None
    return user


def require_role(*allowed: str):
    async def dep(request: Request) -> dict[str, Any]:
        user = await get_current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="not_logged_in")
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="forbidden")
        return user
    return dep


def require_server_role(*allowed: str):
    """In Lite, this is identical to require_role — no per-server matrix.
    Kept as a separate function so router code stays close to the original."""
    async def dep(request: Request, instance_id: int) -> dict[str, Any]:
        user = await get_current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="not_logged_in")
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="forbidden")
        return user
    return dep


def get_client_ip(request: Request) -> str | None:
    return request.headers.get("CF-Connecting-IP") or (
        request.client.host if request.client else None
    )
```

- [ ] **Step 2: Fork auth router**

Copy `/opt/sitrep/backend/app/routers/auth.py` → `sitrep_lite/routers/auth.py`. Adjust imports:
- `from ..deps import ...` (same)
- `from ..repos import ...` (same)
- `from ..services import ...` (same)
- Remove any `user_server_access_repo` references

The auth router is the most complex piece (login, refresh, logout, 2FA, Discord OAuth, password reset, sessions). It should be copied largely as-is since all the auth logic is pure Python + SQLite.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: deps and auth router (simplified role checks)"
```

---

### Task 11: Server Router (The Key New File)

**Files:**
- Create: `sitrep_lite/routers/server.py`

This is the central router that replaces `/opt/sitrep/backend/app/routers/servers.py`. Instead of delegating to `AgentClient`, every endpoint calls `ServerEngine` directly.

- [ ] **Step 1: Write test for server status endpoint**

```python
# tests/test_server_router.py
from fastapi.testclient import TestClient

def test_server_status_unauthenticated():
    from sitrep_lite.main import app
    client = TestClient(app)
    resp = client.get("/api/servers/1/status")
    assert resp.status_code == 401
```

- [ ] **Step 2: Create routers/server.py**

This file replaces the full panel's `servers.py`. Key changes:
- No `AgentClient` dependency — calls engine functions directly
- No instance provisioning/deprovisioning routes
- No CPU affinity, memory, storage quota, network routes
- Keeps: status, start/stop/restart, config CRUD, mods, files, saves, backups, logs, RCON, admins, bans, players, diagnostics, startup params, install, process-stats

```python
"""/api/servers/* routes — calls ServerEngine directly."""
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

# The single ServerEngine instance, set in main.py lifespan
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
    inst = {
        "id": 1,
        "instance_id": 1,
        **st,
    }
    return {"instances": [inst]}


@router.get("/{instance_id}/status")
async def server_status(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    return _get_engine().lifecycle.status()


@router.post("/{instance_id}/start")
async def start_server(instance_id: int, user=Depends(require_server_role(*_OP_ROLES))) -> dict:
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
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: server router — all endpoints calling ServerEngine directly"
```

---

### Task 12: Remaining Routers (System, Users, Settings, Audit, Webhooks, Scheduler)

**Files:**
- Create: `sitrep_lite/routers/system.py`
- Fork: `sitrep_lite/routers/users.py` ← `/opt/sitrep/backend/app/routers/users.py`
- Copy: `sitrep_lite/routers/settings.py` ← `/opt/sitrep/backend/app/routers/settings.py`
- Copy: `sitrep_lite/routers/audit.py` ← `/opt/sitrep/backend/app/routers/audit.py`
- Create: `sitrep_lite/routers/webhooks.py`
- Create: `sitrep_lite/routers/scheduler.py`

- [ ] **Step 1: Create system router (no GPU)**

```python
"""/api/system/* — host-level metrics."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import require_role
from ..engine.metrics import system_metrics

router = APIRouter(prefix="/api/system", tags=["system"])

_READ_ROLES = ("owner", "head_admin", "admin", "moderator", "viewer", "demo")

@router.get("/metrics")
async def get_metrics(user=Depends(require_role(*_READ_ROLES))) -> dict:
    return system_metrics()
```

- [ ] **Step 2: Fork users router — remove per-server access matrix endpoints**

Copy `/opt/sitrep/backend/app/routers/users.py`, remove:
- `GET /api/users/{id}/access` — per-server access read
- `PUT /api/users/{id}/access` — per-server access write
- Any imports of `user_server_access_repo`

Keep everything else (CRUD, Discord link, profile edit, sessions).

- [ ] **Step 3: Copy settings and audit routers as-is**

Both are pure SQLite operations with no Linux dependencies.

- [ ] **Step 4: Create webhooks router**

```python
"""/api/servers/{instance_id}/webhooks — webhook CRUD via state.db."""
from __future__ import annotations

import json
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..db.state import get_conn, migrate
from ..deps import require_server_role

router = APIRouter(prefix="/api/servers/{instance_id}/webhooks", tags=["webhooks"])

_READ_ROLES = ("owner", "head_admin", "admin", "moderator", "viewer", "demo")
_ADMIN_ROLES = ("owner", "head_admin", "admin")


def _ensure_db():
    migrate()


@router.get("")
async def list_webhooks(instance_id: int, user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM webhooks ORDER BY created_at DESC").fetchall()
        webhooks = []
        for r in rows:
            wh = dict(r)
            wh["events"] = json.loads(wh.get("events", "[]"))
            webhooks.append(wh)
        return {"webhooks": webhooks}


@router.post("")
async def create_webhook(instance_id: int, payload: dict,
                         user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    name = payload.get("name", "")
    url = payload.get("url", "")
    kind = payload.get("kind", "discord")
    events = payload.get("events", [])
    if not name or not url:
        raise HTTPException(status_code=400, detail="name and url required")
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO webhooks (name,url,kind,events,created_at) VALUES (?,?,?,?,?)",
            (name, url, kind, json.dumps(events), int(time.time())),
        )
        return {"id": cur.lastrowid, "state": "created"}


@router.put("/{webhook_id}")
async def update_webhook(instance_id: int, webhook_id: int, payload: dict,
                         user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    fields = {}
    for key in ("name", "url", "kind", "enabled"):
        if key in payload:
            fields[key] = payload[key]
    if "events" in payload:
        fields["events"] = json.dumps(payload["events"])
    if not fields:
        raise HTTPException(status_code=400, detail="no fields to update")
    set_clause = ", ".join(f"{k}=?" for k in fields)
    with get_conn() as conn:
        conn.execute(f"UPDATE webhooks SET {set_clause} WHERE id=?",
                     (*fields.values(), webhook_id))
    return {"state": "updated"}


@router.delete("/{webhook_id}")
async def delete_webhook(instance_id: int, webhook_id: int,
                         user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        conn.execute("DELETE FROM webhooks WHERE id=?", (webhook_id,))
    return {"state": "deleted"}


@router.post("/{webhook_id}/test")
async def test_fire(instance_id: int, webhook_id: int,
                    user=Depends(require_server_role(*_ADMIN_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM webhooks WHERE id=?", (webhook_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="webhook not found")
    import httpx
    payload = {"content": f"SITREP Lite test fire from webhook '{row['name']}'"}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(row["url"], json=payload, timeout=10)
            status = resp.status_code
    except Exception as e:
        status = 0
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO webhook_log (webhook_id,event,status_code,fired_at) VALUES (?,?,?,?)",
            (webhook_id, "test", status, int(time.time())),
        )
    return {"status_code": status}


@router.get("/{webhook_id}/log")
async def webhook_log(instance_id: int, webhook_id: int, limit: int = 50,
                      user=Depends(require_server_role(*_READ_ROLES))) -> dict:
    _ensure_db()
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM webhook_log WHERE webhook_id=? ORDER BY fired_at DESC LIMIT ?",
            (webhook_id, limit),
        ).fetchall()
    return {"entries": [dict(r) for r in rows]}
```

- [ ] **Step 5: Create scheduler router** (same pattern — CRUD against state.db, APScheduler sync)

Similar structure to webhooks router: list/create/update/delete/run-now/log endpoints using `scheduler_jobs` and `scheduler_log` tables in state.db.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: system, users, settings, audit, webhooks, scheduler routers"
```

---

### Task 13: Main App Entry Point

**Files:**
- Create: `sitrep_lite/main.py`

- [ ] **Step 1: Create main.py**

```python
"""SITREP Lite — FastAPI application entry point."""
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
from .routers import auth, audit, scheduler, server, settings, system, users, webhooks

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


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": "1.0.0", "uptime_sec": round(time.time() - _BOOT_TS, 3)}


@app.get("/api/setup/status")
def setup_status() -> dict:
    from .repos import users_repo
    owner = users_repo.find_by_role("owner")
    return {"setup_complete": owner is not None, "has_owner": owner is not None}


@app.post("/api/setup/owner")
async def create_owner(payload: dict) -> dict:
    from .repos import users_repo
    from .services.password_hash import hash_password
    if users_repo.find_by_role("owner"):
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
    """CLI entry point — starts uvicorn and opens browser."""
    import uvicorn
    print("Starting SITREP Lite on http://localhost:8000")
    if sys.platform == "win32":
        webbrowser.open("http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")


if __name__ == "__main__":
    run()
```

- [ ] **Step 2: Run health check test**

Run: `cd /home/mark/sitrep-lite && uv run python -c "from fastapi.testclient import TestClient; from sitrep_lite.main import app; c=TestClient(app); r=c.get('/health'); print(r.json())"`
Expected: `{'status': 'ok', ...}`

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: main app entry point with lifespan, setup wizard endpoints"
```

---

### Task 14: Frontend Fork

**Files:**
- Copy entire `/home/mark/sitrep/frontend/` → `/home/mark/sitrep-lite/frontend/`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/constants.js`

- [ ] **Step 1: Copy frontend source**

```bash
cp -r /home/mark/sitrep/frontend/ /home/mark/sitrep-lite/frontend/
```

- [ ] **Step 2: Modify constants.js — remove scrapped tabs**

In `TABS` array, remove entries with ids: `network`, `aigm`, `tracker`.

In `ROLE_TABS`, remove `network`, `aigm`, `tracker` from every role's array.

- [ ] **Step 3: Modify App.jsx — bypass server picker, hardcode instance 1**

Key changes:
1. Remove `ServerPicker` import and usage
2. Remove `selectedInstance` state — always use `{id: 1, instance_id: 1, name: "Server"}`
3. Remove the "← Servers" back button
4. Remove `Network`, `AiGm`, `Tracker` imports and ROUTES entries
5. Change "SITREP" branding to "SITREP LITE"
6. On boot, check `/api/setup/status` — if no owner, show setup wizard instead of login

- [ ] **Step 4: Create SetupWizard component**

New file `frontend/src/auth/SetupWizard.jsx`:
- Step 1: Create owner account (username + password fields)
- Step 2: "Install Server" button that POSTs to `/api/servers/1/install`
- Step 3: Success → redirect to login

- [ ] **Step 5: Build frontend**

Run: `cd /home/mark/sitrep-lite/frontend && npm install && npm run build`
Expected: `dist/` directory created with compiled assets

- [ ] **Step 6: Test full stack locally**

Run: `cd /home/mark/sitrep-lite && uv run python -m sitrep_lite.main`
Open browser to `http://localhost:8000`, verify:
- Setup wizard appears (no owner yet)
- Can create owner account
- Redirected to login
- Can log in
- Dashboard loads (server not installed, but UI renders)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: frontend fork — single server, no workshop/tracker/network tabs, setup wizard"
```

---

### Task 15: PyInstaller Packaging

**Files:**
- Create: `build/sitrep-lite.spec`
- Create: `build/build.sh`

- [ ] **Step 1: Create PyInstaller spec**

```python
# build/sitrep-lite.spec
import os
block_cipher = None

a = Analysis(
    ['../sitrep_lite/main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('../sitrep_lite/db/migrations', 'sitrep_lite/db/migrations'),
        ('../frontend/dist', 'frontend/dist'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='sitrep-lite',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name='SitrepLite',
)
```

- [ ] **Step 2: Create build script**

```bash
#!/usr/bin/env bash
# build/build.sh — build the portable zip (run on Windows or via CI)
set -e
cd "$(dirname "$0")/.."

echo "Building frontend..."
cd frontend && npm ci && npm run build && cd ..

echo "Building exe..."
uv pip install pyinstaller
uv run pyinstaller build/sitrep-lite.spec --distpath build/out --workpath build/tmp --clean

echo "Creating zip..."
cd build/out
zip -r ../SitrepLite-v1.0.0.zip SitrepLite/
echo "Done: build/SitrepLite-v1.0.0.zip"
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: PyInstaller packaging spec and build script"
```

---

### Task 16: Integration Test and Polish

- [ ] **Step 1: Write integration test for the full auth flow**

```python
# tests/test_auth_flow.py
from fastapi.testclient import TestClient
from sitrep_lite.main import app

def test_setup_and_login_flow():
    client = TestClient(app)
    # Check setup status
    r = client.get("/api/setup/status")
    assert r.json()["setup_complete"] is False
    # Create owner
    r = client.post("/api/setup/owner", json={"username": "admin", "password": "test1234", "email": "a@b.com"})
    assert r.json()["username"] == "admin"
    # Setup now complete
    r = client.get("/api/setup/status")
    assert r.json()["setup_complete"] is True
    # Login
    r = client.post("/api/auth/login", json={"username": "admin", "password": "test1234"})
    assert r.status_code == 200
    # Access protected endpoint
    r = client.get("/api/servers/1/status")
    assert r.status_code == 200
```

- [ ] **Step 2: Run full test suite**

Run: `cd /home/mark/sitrep-lite && uv run pytest tests/ -v`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: integration tests for auth flow"
```

---

## Spec Coverage Verification

| Spec Section | Task(s) |
|---|---|
| Architecture (single process, no agent) | Tasks 1, 4, 13 |
| Data layout on disk | Task 1 (paths.py) |
| ServerEngine — lifecycle | Task 4 |
| ServerEngine — config | Task 4 |
| ServerEngine — steamcmd | Task 7 |
| ServerEngine — mods | Task 7 |
| ServerEngine — files | Task 6 |
| ServerEngine — logs | Task 6 |
| ServerEngine — saves/backups | Task 6 |
| ServerEngine — rcon | Task 5 |
| ServerEngine — bans | Task 8 |
| ServerEngine — players | Task 8 |
| ServerEngine — diagnostics | Task 8 |
| ServerEngine — startup_params | Task 8 |
| ServerEngine — metrics (no GPU) | Task 8 |
| Auth/RBAC (no per-server matrix) | Tasks 3, 10 |
| First-run setup wizard | Tasks 13, 14 |
| Frontend (remove workshop/tracker/network/aigm) | Task 14 |
| Scheduled jobs (APScheduler) | Task 12 |
| Webhooks | Task 12 |
| Crash detection | Task 4 (lifecycle monitors subprocess) |
| SteamCMD bootstrap | Task 7 |
| Packaging (PyInstaller portable zip) | Task 15 |
| Dependencies | Task 1 (pyproject.toml) |
