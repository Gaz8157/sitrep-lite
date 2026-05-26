from fastapi.testclient import TestClient
from sitrep_lite.main import app


def test_setup_and_login_flow():
    with TestClient(app, base_url="https://testserver") as client:
        r = client.get("/api/setup/status")
        assert r.json()["setup_complete"] is False

        r = client.post("/api/setup/owner", json={
            "username": "admin", "password": "test1234", "email": "a@b.com",
        })
        assert r.json()["username"] == "admin"

        r = client.get("/api/setup/status")
        assert r.json()["setup_complete"] is True

        r = client.post("/api/auth/login", json={
            "username": "admin", "password": "test1234",
        })
        assert r.status_code == 200
        assert "user" in r.json()

        r = client.get("/api/servers/1/status")
        assert r.status_code == 200
        assert r.json()["state"] == "stopped"

        r = client.get("/api/system/metrics")
        assert r.status_code == 200
        assert "cpu" in r.json()

        r = client.get("/api/servers/1/diagnostics")
        assert r.status_code == 200
        assert len(r.json()["checks"]) >= 2

        r = client.get("/api/servers")
        assert r.status_code == 200
        assert len(r.json()["instances"]) == 1


def test_unauthenticated_rejected():
    with TestClient(app, base_url="https://testserver") as client:
        r = client.get("/api/servers/1/status")
        assert r.status_code == 401


def test_health():
    with TestClient(app, base_url="https://testserver") as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
