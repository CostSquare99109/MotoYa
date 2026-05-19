"""Schemas Pydantic para el rol Worker (mototaxista)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from datetime import datetime

# ── Solicitud de viaje entrante que ve el conductor ──────────────────────────

class IncomingTripSchema(BaseModel):
    trip_id: str
    passenger_name: str
    passenger_phone: str
    pickup_address: str
    dropoff_address: str
    fare: float
    distance_km: float
    payment_method: str

    class Config:
        from_attributes = True


# ── Respuesta del conductor (aceptar / rechazar) ─────────────────────────────

class TripResponseSchema(BaseModel):
    action: str = Field(..., pattern="^(accept|reject)$")
    reject_reason: str | None = None


# ── Actualización de estado del viaje ────────────────────────────────────────

class TripStatusUpdateSchema(BaseModel):
    status: str = Field(
        ...,
        pattern="^(picked_up|in_progress|completed|cancelled)$"
    )
    notes: str | None = None


# ── Estado del conductor (online / offline) ──────────────────────────────────

class WorkerOnlineStatusSchema(BaseModel):
    is_online: bool


# ── Perfil y estadísticas del conductor ──────────────────────────────────────
# ✅ Campos extendidos para que coincidan con lo que espera el frontend

class WorkerStatsSchema(BaseModel):
    # Identificación
    full_name: str
    phone: str
    status: str
    is_online: bool
    profile_photo_url: str | None = None

    # Métricas core
    rating: float
    total_trips: int
    trips_today: int

    # Ganancias (el frontend pide los 3 períodos)
    earnings_today: float
    earnings_week: float
    earnings_month: float = 0.0   # ✅ antes faltaba

    # Gamificación (el frontend los renderiza en WorkerProfile)
    acceptance_rate: float = 100.0  # ✅ antes faltaba (porcentaje 0-100)
    points: int = 0                 # ✅ antes faltaba (para niveles)
    badges: list[str] = []          # ✅ antes faltaba

    class Config:
        from_attributes = True


# ── Viaje activo actual ───────────────────────────────────────────────────────

class ActiveTripSchema(BaseModel):
    id: str
    passenger_name: str
    passenger_phone: str
    pickup_address: str
    dropoff_address: str
    status: str
    fare: float
    distance_km: float
    payment_method: str
    created_at: datetime

    class Config:
        from_attributes = True
