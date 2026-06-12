from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def isolated_data(tmp_path, monkeypatch):
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
    monkeypatch.setattr(p, "INSTANCES_DIR", tmp_path / "instances")
    p.ensure_dirs()

    from sitrep_lite.engine import instance_manager
    instance_manager._engines.clear()

    from sitrep_lite.services import rate_limit
    rate_limit.reset()
