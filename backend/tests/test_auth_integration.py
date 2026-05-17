"""Integration tests for authentication endpoints.

Tests the three login flows and client registration using an in-memory
SQLite database with the full FastAPI app.
"""

import pytest
import asyncio
from httpx import AsyncClient, ASGITransport

# ── Test database setup ──────────────────────────────────────────────────────
# We override the database dependency to use SQLite in-memory for fast,
# isolated tests without needing PostgreSQL.

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from app.models import Base

TEST_DATABASE_URL = "sqlite+aiosqlite:///file::memory:?cache=shared&uri=true"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def setup_db():
    """Create all tables before each test and drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    """Async test client with DB override."""
    from app.main import app
    from app.database import get_db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def admin_user(client: AsyncClient):
    """Create an admin user directly in DB for login tests."""
    from app.models.users import User
    from app.routers.auth import get_password_hash

    async with TestSessionLocal() as db:
        admin = User(
            email="admin@motoya.co",
            password_hash=get_password_hash("admin123"),
            full_name="Admin Test",
            phone="+573001111111",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        await db.commit()


@pytest.fixture
async def worker_user(client: AsyncClient):
    """Create a worker user + driver for login tests."""
    from app.models.users import User
    from app.models.drivers import Driver
    from app.routers.auth import get_password_hash

    async with TestSessionLocal() as db:
        worker = User(
            email="worker@motoya.co",
            password_hash=get_password_hash("worker123"),
            full_name="Carlos Conductor",
            phone="+573002222222",
            role="worker",
            is_active=True,
        )
        db.add(worker)
        await db.commit()
        await db.refresh(worker)

        driver = Driver(
            user_id=worker.id,
            full_name=worker.full_name,
            phone=worker.phone,
            status="active",
        )
        db.add(driver)
        await db.commit()


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
            data={"username": "admin@motoya.co", "password": "wrong"},
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
            data={"username": "+573002222222", "password": "worker123"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["user"]["role"] == "worker"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, worker_user):
        resp = await client.post(
            "/api/auth/worker/login",
            data={"username": "+573002222222", "password": "wrong"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_phone(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/worker/login",
            data={"username": "+573009999999", "password": "whatever"},
        )
        assert resp.status_code == 404


# ── Test: Client quick-login ─────────────────────────────────────────────────

class TestClientQuickLogin:
    @pytest.mark.asyncio
    async def test_new_client_creates_user(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/client/quick-login",
            json={"full_name": "Ana Pasajera", "phone": "+573003333333"},
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
            json={"full_name": "Luis Rider", "phone": "+573004444444"},
        )
        # Second login with same phone updates name
        resp = await client.post(
            "/api/auth/client/quick-login",
            json={"full_name": "Luis Alberto Rider", "phone": "+573004444444"},
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["full_name"] == "Luis Alberto Rider"

    @pytest.mark.asyncio
    async def test_invalid_phone_rejected(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/client/quick-login",
            json={"full_name": "Bad Phone", "phone": "abc"},
        )
        assert resp.status_code == 422  # Pydantic validation error

    @pytest.mark.asyncio
    async def test_invalid_name_rejected(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/client/quick-login",
            json={"full_name": "X", "phone": "+573005555555"},
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
                "phone": "+573006666666",
                "password": "secure123",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body

        # Login with phone + password
        resp = await client.post(
            "/api/client/login",
            json={"phone": "+573006666666", "password": "secure123"},
        )
        assert resp.status_code == 200
        assert resp.json()["client"]["phone"] == "+573006666666"

    @pytest.mark.asyncio
    async def test_register_duplicate_phone_fails(self, client: AsyncClient):
        data = {
            "full_name": "Dup One",
            "phone": "+573007777777",
            "password": "secure123",
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
