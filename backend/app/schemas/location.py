"""Schemas Pydantic para el sistema de ubicación en tiempo real."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from datetime import datetime

# ── Payload que envía el conductor por WebSocket ──────────────────────────────

class LocationUpdateSchema(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    bearing: float = Field(default=0.0, ge=0, le=360)
    speed_kmh: float = Field(default=0.0, ge=0)
    accuracy_m: float = Field(default=10.0, ge=0)


# ── Payload que recibe el Admin / Cliente por WebSocket ───────────────────────

class LocationBroadcastSchema(BaseModel):
    driver_id: str
    driver_name: str
    trip_id: str | None = None
    latitude: float
    longitude: float
    bearing: float
    speed_kmh: float
    is_online: bool
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Respuesta REST de ubicación actual de un conductor ────────────────────────

class DriverLocationResponseSchema(BaseModel):
    driver_id: str
    driver_name: str
    latitude: float
    longitude: float
    bearing: float
    speed_kmh: float
    is_online: bool
    trip_id: str | None = None
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Lista de todas las ubicaciones activas (para mapa admin) ──────────────────

class AllLocationsResponseSchema(BaseModel):
    drivers: list[DriverLocationResponseSchema]
    total_online: int
