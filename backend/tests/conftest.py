# Pytest configuration for MotoYa test suite
# Environment variables MUST be set before importing any app modules

import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["ENVIRONMENT"] = "test"

import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from app.database import Base, override_engine, get_db
import app.models  # noqa: F401 — register all models with Base.metadata

test_engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)

override_engine(test_engine, TestSessionLocal)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture(autouse=True)
async def setup_db():
    """Create all tables before each test, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    """Async test client with DB override."""
    from app.main import app
    from httpx import AsyncClient, ASGITransport

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def admin_user():
    """Create an admin user via direct DB insert."""
    from app.models.users import User
    from app.routers.auth import get_password_hash

    async with TestSessionLocal() as db:
        admin = User(
            email="admin@motoya.co",
            password_hash=get_password_hash("admin123"),
            full_name="Admin Test",
            phone="+573000000111",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        await db.commit()


@pytest.fixture
async def worker_user():
    """Create a worker user + driver (with all required fields)."""
    from app.models.users import User
    from app.models.drivers import Driver
    from app.routers.auth import get_password_hash
    from datetime import date

    async with TestSessionLocal() as db:
        worker = User(
            email="worker@motoya.co",
            password_hash=get_password_hash("worker123"),
            full_name="Carlos Conductor",
            phone="+573000000222",
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
            document_id="1234567890",
            license_number="ABC-12345",
            license_expiry=date(2028, 12, 31),
            status="active",
        )
        db.add(driver)
        await db.commit()

