# SITREP Lite — Windows Arma Reforger Server Panel

**Date:** 2026-05-25
**Status:** Approved
**Source:** Derived from SITREP panel at /opt/sitrep (Approach C: fork backend, new ServerEngine)

## Overview

SITREP Lite is a single-server, Windows-native version of the SITREP panel for casual Arma Reforger hosts. It packages the full panel's auth, admin, and server management features into a portable folder that runs on a Windows PC with zero Linux dependencies.

**Target user:** Someone hosting a Reforger dedicated server on their Windows PC for a few friends.

## Decisions

| Decision | Choice |
|----------|--------|
| Name | SITREP Lite |
| Architecture | Approach C — fork backend, new ServerEngine class |
| Multi-instance | Scrapped — single server only |
| Workshop browser | Scrapped — mods added by GUID |
| Player/Camera tracker | Scrapped |
| CPU affinity / Memory management | Scrapped |
| Storage quotas | Scrapped |
| GPU metrics | Scrapped |
| Discord OAuth | Kept (optional integration) |
| SMTP/email | Kept (optional integration) |
| Packaging | Portable zip — unzip and run, no installer |
| SteamCMD | Auto-downloaded on first run |

## Architecture

Single Python process. No agent, no Unix sockets, no systemd, no cgroups.

```
sitrep-lite.exe
  └─ Embedded Python 3.12+
       └─ FastAPI (uvicorn)
            ├─ Routers (auth, users, server, files, mods, rcon, etc.)
            ├─ Services (auth, TOTP, SMTP, Discord OAuth)
            ├─ Repos (SQLite via panel.db)
            └─ ServerEngine
                 ├─ subprocess.Popen for Reforger server
                 ├─ subprocess for SteamCMD
                 ├─ direct file I/O for config/saves/logs/files
                 ├─ UDP RCON client (BattlEye protocol)
                 ├─ psutil for system metrics
                 └─ APScheduler for scheduled jobs
```

### Data layout on disk

```
SitrepLite/
├─ sitrep-lite.exe
├─ _internal/                (Python runtime + deps)
├─ frontend/
│   └─ dist/                 (pre-built React app)
├─ data/
│   ├─ panel.db              (users, sessions, audit, settings)
│   ├─ state.db              (webhooks, scheduler, bans, mods)
│   └─ backups/              (server backups as .zip)
├─ server/                   (Reforger DS, installed via SteamCMD)
│   └─ ArmaReforgerServer.exe
├─ profile/                  (server profile)
│   ├─ .save/
│   └─ logs/
├─ steamcmd/                 (auto-downloaded)
└─ config.json               (Reforger server config)
```

No `instance_id` in the data layout. Routers still accept it in URL paths for frontend API compatibility but hardcode it to `1` internally.

## ServerEngine

Replaces the AgentClient. Single class where all Windows-specific and server-interaction logic lives.

### lifecycle: start() / stop() / restart() / status()

- `subprocess.Popen` with `CREATE_NEW_PROCESS_GROUP` flag
- Tracks the `Popen` object directly — no PID file, no service manager
- `status()` polls `process.poll()` to check if alive
- Graceful stop via `CTRL_BREAK_EVENT`
- `restart()` = stop + start
- Tracks state enum: stopped / starting / running / stopping
- Tracks uptime from last successful start

### config: read() / write() / patch() / validate()

- Direct JSON file I/O on `config.json`
- `patch()` does read-modify-write with deep merge (same as existing agent_client)
- `validate()` checks JSON schema, required fields, port ranges

### steamcmd: install() / update() / ensure_steamcmd()

- Auto-downloads `steamcmd.zip` from Valve CDN on first run
- Extracts to `steamcmd/`, self-updates on first execution
- Server install: `steamcmd.exe +force_install_dir ../server +login anonymous +app_update 1874900 validate +quit`
- Force update option available
- Output logged for UI to tail

### mods: list() / add() / remove() / clear_all() / subscribe() / unsubscribe()

- `add/remove` modify the mods array in `config.json`
- `subscribe` runs SteamCMD: `+login anonymous +workshop_download_item 1874880 <guid> +quit`
- `unsubscribe` removes from config, optionally deletes downloaded files
- No Workshop browser — user pastes the mod GUID (hex string like `5965550E5B1B64F7`). The UI accepts either a raw GUID or a full Workshop URL and extracts the GUID.

### files: list() / read() / write() / delete() / mkdir()

- Scoped to `profile/` directory
- Path traversal protection via `os.path.realpath()` containment check
- No `openat2()` needed — single-user setup, realpath is sufficient

### logs: tail()

- Reads last N lines from `profile/logs/*.log`
- Returns most recent log file by default

### saves: list() / inspect() / purge() / backup() / restore()

- Operates on `profile/.save/` directory (dot-prefixed, shown by default)
- Backups as `.zip` into `data/backups/`
- Restore extracts backup zip over profile directory

### rcon: send() / say()

- BattlEye UDP protocol, extracted from existing agent code
- Portable, no OS dependencies

### bans: list() / add() / remove()

- JSON file in `data/`
- `add()` also fires RCON kick if server is running

### players: list()

- RCON `#players` command, parsed into structured data

### diagnostics: check() / apply_fix()

- Checks: config validity, required fields, binary presence, port conflicts, script modules
- Fixes: apply corrections with optional payloads

### startup_params: read() / write() / catalog()

- Manages launch arguments for the Reforger server
- Structured parameter catalog with types and defaults
- Custom launch params trailer for advanced users

### metrics: system_snapshot()

- CPU: overall %, per-core breakdown, core count (via psutil)
- RAM: used / total / percentage (via psutil)
- Disk: per-drive used / total / percentage (via psutil)
- Network: up/down Mbps rates with stateful deltas (via psutil)
- No GPU metrics

## Auth, RBAC, and User Management

Ported 1:1 from the full panel. Pure Python + SQLite, no Linux dependencies.

### Authentication

- JWT access tokens with configurable TTL
- Refresh token rotation with cookie-based sessions (httponly, secure, samesite)
- TOTP 2FA with QR provisioning and backup codes
- Password hashing via argon2
- Discord OAuth (optional, configured in Settings page)

### Roles

Global role hierarchy: **owner > head_admin > admin > moderator > viewer**

No per-server access matrix (only one server). Global role applies everywhere.

### User management

- Owner creates users directly (username + password) or via email invite (if SMTP configured)
- Users can: change password, edit profile (username, email), manage 2FA, view/revoke sessions
- Admins can: create/update/disable/delete users, assign roles
- Owner can: all of the above, plus link/unlink Discord accounts for other users

### Audit log

Every auth and admin action logged: login, logout, user CRUD, password changes, 2FA changes, Discord link/unlink, config changes, server lifecycle events. Filterable by actor. Owner-only access.

### Session management

- View active sessions with IP, user agent, creation time, last used
- Revoke individual sessions or all other sessions
- "Remember me" extends refresh token TTL

### First-run setup

On first launch with empty `panel.db`, the panel presents a setup wizard:
1. Create owner account (username + password)
2. Install server (one button — downloads SteamCMD + Reforger DS)
3. Drops into dashboard, ready to configure and start

## Frontend

Same React/Vite codebase from `/home/mark/sitrep/frontend/src/`, with targeted modifications.

### Removed

- Server picker page and `/servers` route — app boots into dashboard
- Workshop tab
- Tracker tab (player + camera)
- CPU Affinity tab
- Memory Management tab
- Storage Quota tab
- Network tab
- GPU metric card on dashboard

### Kept

- **Dashboard** — server status, system metrics (CPU, RAM, disk, network)
- **Config** — JSON config editor
- **Startup Params** — structured parameter editor
- **Mods** — add/remove by GUID, subscribe/unsubscribe via SteamCMD
- **Files** — file browser scoped to profile directory
- **Players** — live player list via RCON
- **Admins** — manage server admin list
- **Bans** — persistent ban list with RCON integration
- **Saves** — save file management with backup/restore
- **Backups** — create/restore/delete server backups
- **Webhooks** — Discord webhook configuration
- **Scheduler** — cron-based job scheduling
- **Diagnostics** — health checks and auto-fixes
- **Logs** — server log viewer
- **Console** — RCON command console
- **Profile** — user profile and settings
- **Users** — user management (admin)
- **Audit** — audit log (owner)
- **Settings** — Discord OAuth + SMTP integrations

### Added

- **Setup wizard** — first-run owner creation + server install

### API compatibility

Frontend hardcoded to use server ID `1`. Backend routers accept `instance_id` in URL paths (`/api/servers/1/...`) but ignore it internally. This avoids changing every API call.

### Build and distribution

Frontend built once with `npm run build`. The `dist/` folder ships inside the portable zip. FastAPI serves it as static files. Users never need Node installed.

## Scheduled Jobs

APScheduler running in-process alongside FastAPI, replacing the agent's croniter tick loop.

- Jobs stored in `state.db` (name, cron expression, action, payload, enabled)
- APScheduler loads all enabled jobs on startup, re-syncs on CRUD operations
- Supported actions: `restart`, `rcon_command`, `backup`, `broadcast`
- Execution log in `state.db`, viewable in UI
- "Run now" for immediate execution

## Webhooks

Fully portable, minimal changes from full panel.

- Definitions in `state.db` (name, URL, kind, events, enabled)
- Events: `server.start`, `server.stop`, `server.crash`, `player.join`, `player.leave`, `backup.created`, `scheduled_job.run`
- Player join/leave detected by polling RCON player list on short interval and diffing
- Discord rich embed format supported
- Test fire button, execution log with response codes

## Crash Detection

The engine monitors the server subprocess. If it exits unexpectedly:
1. State set to `stopped`, crash time recorded
2. `server.crash` webhook fired
3. Event logged in audit
4. Optional auto-restart (configurable in settings)

## SteamCMD Bootstrap

1. Panel checks for `steamcmd/steamcmd.exe`
2. If missing, downloads `steamcmd.zip` from Valve CDN
3. Extracts to `steamcmd/`, runs once to self-update
4. Progress reported to UI via status endpoint (frontend polls)

## Packaging

**Portable zip:**
```
SitrepLite-v1.0.0.zip
└─ SitrepLite/
    ├─ sitrep-lite.exe
    ├─ _internal/
    ├─ frontend/dist/
    └─ README.txt
```

Built with PyInstaller in one-dir mode. Embedded Python 3.12+ with all dependencies. No registry, no AppData, no admin rights needed.

**First-run flow:**
1. Unzip to any folder
2. Double-click `sitrep-lite.exe`
3. Console window: "Starting SITREP Lite on http://localhost:8000..."
4. Default browser opens automatically
5. Setup wizard: create owner, install server
6. Dashboard ready

**Ongoing launches:**
1. Double-click exe → browser opens → login
2. Close console window or Ctrl+C → graceful shutdown of panel + server

**Firewall:** Windows will prompt to allow Reforger server through firewall on first server start. Panel itself only needs localhost unless remote admin is desired (port 8000).

## Dependencies

| Package | Purpose | Cross-platform |
|---------|---------|----------------|
| fastapi | Web framework | Yes |
| uvicorn[standard] | ASGI server | Yes |
| pydantic[email] | Validation | Yes |
| httpx | HTTP client (webhooks, Discord OAuth, SteamCMD download) | Yes |
| psutil | System metrics | Yes |
| passlib[argon2] | Password hashing | Yes |
| PyJWT | JWT tokens | Yes |
| pyotp | TOTP/2FA | Yes |
| qrcode[pil] | QR code generation | Yes |
| aiosmtplib | SMTP (optional) | Yes |
| apscheduler | Scheduled jobs | Yes |
| pyinstaller | Packaging (build-time only) | Yes |

All dependencies are pure Python or have Windows wheels available.
