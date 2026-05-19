"""Database connection and session management."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.config import get_settings

settings = get_settings()

# Create async engine — use pooling only for PostgreSQL (SQLite doesn't support it)
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

_engine_kwargs = dict(echo=False)
if not _is_sqlite:
    _engine_kwargs.update(
        pool_size=20,
        max_overflow=30,
        pool_pre_ping=True,
        pool_recycle=300,
    )

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

# Base class for ORM models
Base = declarative_base()


async def get_db() -> AsyncSession:
    """Dependency to get DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def override_engine(new_engine, new_session_factory):
    """Replace the global engine and session factory (for testing)."""
    global engine, AsyncSessionLocal
    engine = new_engine
    AsyncSessionLocal = new_session_factory
