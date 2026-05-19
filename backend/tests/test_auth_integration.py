# Integration tests for authentication endpoints
# Tests login flows and client registration using in-memory SQLite

import pytest
from httpx import AsyncClient


# ── Test: Admin login ────────────────────────────────────────────────────────

class TestAdminLogin:
    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, admin_user):
        resp = await client.post(
            "/api/auth/login",
            data={"username": "admin@motoya.co", "password": "admin123"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["user"]["role"] == "admin"
        assert body["user"]["email"] == "admin@motoya.co"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, admin_user):
        resp = await client.post(
            "/api/auth/login",
            data={"username": "admin@motoya.co", "password": "wrongpass"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/login",
            data={"username": "noone@motoya.co", "password": "whatever"},
        )
        assert resp.status_code == 401


# ── Test: Worker login ───────────────────────────────────────────────────────

class TestWorkerLogin:
    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, worker_user):
        resp = await client.post(
            "/api/auth/worker/login",
            data={"username": "+573000000222", "password": "worker123"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["user"]["role"] == "worker"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, worker_user):
        resp = await client.post(
            "/api/auth/worker/login",
            data={"username": "+573000000222", "password": "wrongpass"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_phone(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/worker/login",
            data={"username": "+5730000009999", "password": "whatever"},
        )
        assert resp.status_code == 404


# ── Test: Client quick-login ─────────────────────────────────────────────────

class TestClientQuickLogin:
    @pytest.mark.asyncio
    async def test_new_client_creates_user(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/client/quick-login",
            json={"full_name": "Ana Pasajera", "phone": "+573000000333"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["user"]["role"] == "client"
        assert body["user"]["full_name"] == "Ana Pasajera"

    @pytest.mark.asyncio
    async def test_existing_client_updates_name(self, client: AsyncClient):
        # First login creates the user
        await client.post(
            "/api/auth/client/quick-login",
            json={"full_name": "Luis Rider", "phone": "+573000000444"},
        )
        # Second login with same phone updates name
        resp = await client.post(
            "/api/auth/client/quick-login",
            json={"full_name": "Luis Alberto Rider", "phone": "+573000000444"},
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["full_name"] == "Luis Alberto Rider"

    @pytest.mark.asyncio
    async def test_invalid_phone_rejected(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/client/quick-login",
            json={"full_name": "Bad Phone", "phone": "abc"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_name_rejected(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/client/quick-login",
            json={"full_name": "X", "phone": "+573000000555"},
        )
        assert resp.status_code == 422


# ── Test: Client register + login (with password) ────────────────────────────

class TestClientRegisterAndLogin:
    @pytest.mark.asyncio
    async def test_register_and_login(self, client: AsyncClient):
        # Register
        resp = await client.post(
            "/api/client/register",
            json={
                "full_name": "Pedro Registro",
                "phone": "+573000000666",
                "password": "securepass1",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body

        # Login with phone + password
        resp = await client.post(
            "/api/client/login",
            json={"phone": "+573000000666", "password": "securepass1"},
        )
        assert resp.status_code == 200
        assert resp.json()["client"]["phone"] == "+573000000666"

    @pytest.mark.asyncio
    async def test_register_duplicate_phone_fails(self, client: AsyncClient):
        data = {
            "full_name": "Dup One",
            "phone": "+573000000777",
            "password": "securepass1",
        }
        resp1 = await client.post("/api/client/register", json=data)
        assert resp1.status_code == 200

        data["full_name"] = "Dup Two"
        resp2 = await client.post("/api/client/register", json=data)
        assert resp2.status_code == 400


# ── Test: /auth/me ───────────────────────────────────────────────────────────

class TestAuthMe:
    @pytest.mark.asyncio
    async def test_me_with_valid_token(self, client: AsyncClient, admin_user):
        login = await client.post(
            "/api/auth/login",
            data={"username": "admin@motoya.co", "password": "admin123"},
        )
        token = login.json()["access_token"]

        resp = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "admin@motoya.co"

    @pytest.mark.asyncio
    async def test_me_without_token(self, client: AsyncClient):
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_me_with_invalid_token(self, client: AsyncClient):
        resp = await client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert resp.status_code == 401
