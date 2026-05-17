"""MotoYa — FastAPI main application entry point."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.database import engine, Base
from app.routers import (
    auth,
    drivers,
    dispatch,
    trips,
    shipments,
    finances,
    rankings,
    emergency,
    motorcycles,
)
from app.routers import settings as settings_router
from app.routers import worker
from app.routers import client as client_router
from app.routers import location as location_router
from app.routers import users as users_router

settings = get_settings()

# ── Rate limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="MotoYa API",
    description="Plataforma Omni-MotoTaxy — Gestión de flota de mototaxis",
    version="2.0.0",
    lifespan=lifespan,
)

# ── Rate limit error handler ─────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(worker.router, prefix="/api")
app.include_router(worker.router_plural, prefix="/api")
app.include_router(drivers.router, prefix="/api", tags=["drivers"])
app.include_router(dispatch.router, prefix="/api", tags=["dispatch"])
app.include_router(trips.router, prefix="/api", tags=["trips"])
app.include_router(shipments.router, prefix="/api", tags=["shipments"])
app.include_router(finances.router, prefix="/api", tags=["finances"])
app.include_router(rankings.router, prefix="/api", tags=["rankings"])
app.include_router(emergency.router, prefix="/api", tags=["emergency"])
app.include_router(settings_router.router, prefix="/api", tags=["settings"])
app.include_router(motorcycles.router, prefix="/api", tags=["motorcycles"])
app.include_router(client_router.router, prefix="/api", tags=["client"])
app.include_router(location_router.router, prefix="/api", tags=["location"])
app.include_router(location_router.router, tags=["websocket"])
app.include_router(users_router.router, prefix="/api", tags=["users"])

uploads_dir = settings.UPLOAD_DIR
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
