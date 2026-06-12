"""Stability/leak hardening ported from the main SITREP panel."""
from __future__ import annotations

import hashlib
import json

import pytest
from fastapi.testclient import TestClient

from sitrep_lite.main import app


def _client_with_owner():
    client = TestClient(app, base_url="https://testserver")
    client.__enter__()
    client.post("/api/setup/owner", json={
        "username": "admin", "password": "test1234", "email": "a@b.com",
    })
    r = client.post("/api/auth/login", json={"username": "admin", "password": "test1234"})
    assert r.status_code == 200
    return client


# -- config wipe guard ---------------------------------------------------------


def _base_cfg(**over):
    cfg = {
        "bindPort": 2001,
        "a2s": {"port": 17777},
        "rcon": {"port": 19999, "password": "x"},
        "game": {"name": "Test", "scenarioId": "{X}Missions/foo.conf", "maxPlayers": 32, "mods": []},
    }
    cfg.update(over)
    return cfg


def test_wipe_guard_blocks_port_and_name_blanking(tmp_path):
    from sitrep_lite.engine.config import ConfigWipeError, write_config

    write_config(_base_cfg(), instance_id=1)
    bad = _base_cfg()
    del bad["bindPort"]
    bad["game"]["name"] = ""
    with pytest.raises(ConfigWipeError) as exc:
        write_config(bad, instance_id=1)
    reasons = " ".join(exc.value.reasons)
    assert "bindPort" in reasons
    assert "game.name" in reasons


def test_wipe_guard_allows_legit_changes_and_mod_clears():
    from sitrep_lite.engine.config import read_config, write_config

    write_config(_base_cfg(), instance_id=1)
    cfg = read_config(instance_id=1)
    cfg["bindPort"] = 2002
    cfg["game"]["mods"] = []
    cfg["game"]["name"] = "Renamed"
    write_config(cfg, instance_id=1)
    assert read_config(instance_id=1)["bindPort"] == 2002


def test_wipe_guard_blocks_cross_instance_port_collision():
    from sitrep_lite.engine.config import ConfigWipeError, read_config, write_config

    write_config(_base_cfg(), instance_id=1)
    write_config(
        _base_cfg(bindPort=2002, a2s={"port": 17778}, rcon={"port": 20000, "password": "x"}),
        instance_id=2,
    )
    cfg = read_config(instance_id=1)
    cfg["bindPort"] = 2002
    with pytest.raises(ConfigWipeError) as exc:
        write_config(cfg, instance_id=1)
    assert any("collides with instance 2" in r for r in exc.value.reasons)


def test_put_config_endpoint_returns_409_on_wipe():
    with _client_with_owner() as client:
        r = client.put("/api/servers/1/config", json=_base_cfg())
        assert r.status_code == 200
        bad = _base_cfg()
        del bad["bindPort"]
        r = client.put("/api/servers/1/config", json=bad)
        assert r.status_code == 409
        assert "blocked" in r.json()["detail"]


# -- bounded log tail ----------------------------------------------------------


def test_tail_logs_bounded_read():
    import sitrep_lite.paths as p
    from sitrep_lite.engine.logs import tail_logs

    log_dir = p.instance_profile(1) / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    (log_dir / "console.log").write_text(
        "\n".join(f"line {i}" for i in range(10_000)) + "\n"
    )
    out = tail_logs(100, instance_id=1)
    assert len(out["lines"]) == 100
    assert out["lines"][-1] == "line 9999"
    assert out["lines"][0] == "line 9900"
    assert out["truncated"] is True


def test_tail_logs_small_file_complete():
    import sitrep_lite.paths as p
    from sitrep_lite.engine.logs import tail_logs

    log_dir = p.instance_profile(1) / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    (log_dir / "console.log").write_text("a\nb\nc\n")
    out = tail_logs(100, instance_id=1)
    assert out["lines"] == ["a", "b", "c"]
    assert out["truncated"] is False


# -- lifecycle log handle ------------------------------------------------------


def test_lifecycle_stop_closes_console_log(monkeypatch):
    import sitrep_lite.paths as p
    from sitrep_lite.engine import lifecycle as lc

    exe = p.instance_server_exe(1)
    exe.parent.mkdir(parents=True, exist_ok=True)
    exe.write_text("")

    class FakeProc:
        pid = 4242

        def __init__(self):
            self._rc = None

        def poll(self):
            return self._rc

        def terminate(self):
            self._rc = 0

        def send_signal(self, sig):
            self._rc = 0

        def kill(self):
            self._rc = -9

        def wait(self, timeout=None):
            return self._rc

    monkeypatch.setattr(lc.subprocess, "Popen", lambda *a, **k: FakeProc())
    monkeypatch.setattr(
        "sitrep_lite.engine.startup_params.build_launch_args", lambda **k: []
    )
    life = lc.ServerLifecycle(1)
    assert life.start()["state"] == "started"
    handle = life._log_file
    assert handle is not None and not handle.closed
    assert life.stop()["state"] == "stopped"
    assert handle.closed
    assert life._log_file is None


# -- auth hardening ------------------------------------------------------------


def test_backup_codes_stored_hashed():
    from sitrep_lite.repos import users_repo

    with _client_with_owner() as client:
        r = client.get("/api/auth/2fa/setup")
        assert r.status_code == 200
        plaintext = r.json()["backup_codes"]
        assert len(plaintext) == 10

        user = users_repo.find_by_username("admin")
        stash = json.loads(user["totp_backup_codes"])
        stored = stash["pending_codes"]
        for code in plaintext:
            assert code not in stored
            assert hashlib.sha256(code.encode()).hexdigest() in stored


def test_consume_backup_code_matches_hash_and_legacy_plaintext():
    from sitrep_lite.services.totp_service import consume_backup_code, hash_backup_code

    hashed = [hash_backup_code("abcd1234")]
    remaining, ok = consume_backup_code(hashed, "ABCD-1234")
    assert ok and remaining == []

    legacy = ["abcd1234"]
    remaining, ok = consume_backup_code(legacy, "abcd1234")
    assert ok and remaining == []

    remaining, ok = consume_backup_code(hashed, "wrong000")
    assert not ok


def test_reset_token_stored_digested():
    from sitrep_lite.db.panel import get_conn
    from sitrep_lite.repos import password_resets_repo, users_repo

    with _client_with_owner():
        user = users_repo.find_by_username("admin")
        raw = password_resets_repo.create(user["id"])
        with get_conn() as c:
            row = c.execute("SELECT token FROM password_resets").fetchone()
        assert row["token"] != raw
        assert row["token"] == hashlib.sha256(raw.encode()).hexdigest()
        assert password_resets_repo.get(raw)["user_id"] == user["id"]
        password_resets_repo.mark_used(raw)
        assert password_resets_repo.get(raw) is None


def test_login_rate_limited():
    from sitrep_lite.services import rate_limit

    rate_limit.reset()
    with _client_with_owner() as client:
        statuses = []
        for _ in range(11):
            r = client.post("/api/auth/login", json={
                "username": "admin", "password": "wrong-password",
            })
            statuses.append(r.status_code)
        assert statuses[-1] == 429
        assert 401 in statuses
    rate_limit.reset()


# -- endpoint auth gaps --------------------------------------------------------


def test_packages_and_resources_require_auth():
    with TestClient(app, base_url="https://testserver") as client:
        assert client.get("/api/packages").status_code == 401
        assert client.get("/api/servers/1/storage").status_code == 401
        assert client.get("/api/servers/1/memory").status_code == 401
        assert client.get("/api/servers/1/cpu-affinity").status_code == 401
        assert client.put("/api/servers/1/memory", json={}).status_code == 401


# -- packages ------------------------------------------------------------------


def test_packages_create_list_delete_roundtrip():
    with _client_with_owner() as client:
        r = client.post("/api/packages", json={"instance_id": 1, "name": "My Pack"})
        assert r.status_code == 200
        pkg_id = r.json()["id"]
        names = [p["name"] for p in client.get("/api/packages").json()["packages"]]
        assert "My Pack" in names
        assert client.delete(f"/api/packages/{pkg_id}").status_code == 200
        names = [p["name"] for p in client.get("/api/packages").json()["packages"]]
        assert "My Pack" not in names


def test_packages_concurrent_creates_not_lost():
    import threading

    with _client_with_owner() as client:
        def fire(n):
            client.post("/api/packages", json={"instance_id": 1, "name": n})

        for rnd in range(10):
            threads = [
                threading.Thread(target=fire, args=(f"c{rnd}-{j}",)) for j in range(4)
            ]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
        names = {p["name"] for p in client.get("/api/packages").json()["packages"]}
        assert names >= {f"c{rnd}-{j}" for rnd in range(10) for j in range(4)}


def test_packages_errors_are_real_http_errors():
    with _client_with_owner() as client:
        assert client.post("/api/packages", json={"name": "  "}).status_code == 400
        r = client.post("/api/packages/999/apply", json={"instance_id": 1})
        assert r.status_code == 404
        r = client.post("/api/packages/1/apply", json={})
        assert r.status_code == 400


def test_packages_atomic_write_no_tmp_left():
    import sitrep_lite.paths as p

    with _client_with_owner() as client:
        client.post("/api/packages", json={"instance_id": 1, "name": "x"})
        data_dir = p.DATA_DIR
        assert (data_dir / "packages.json").exists()
        assert not (data_dir / "packages.tmp").exists()
