"""Schemas Pydantic para el rol Client (pasajero/cliente)."""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ── Registro de cliente ───────────────────────────────────────────────────────

class ClientRegisterSchema(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=7, max_length=20)
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=6)


# ── Login de cliente ──────────────────────────────────────────────────────────

class ClientLoginSchema(BaseModel):
    phone: str
    password: str


# ── Respuesta de auth del cliente ─────────────────────────────────────────────

class ClientAuthResponseSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    client: "ClientProfileSchema"


# ── Perfil del cliente ────────────────────────────────────────────────────────

class ClientProfileSchema(BaseModel):
    id: str
    full_name: str
    phone: str
    email: Optional[str] = None
    rating: float
    total_trips: int
    wallet_balance: float
    is_verified: bool
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


# ── Solicitud de viaje ────────────────────────────────────────────────────────

class TripRequestSchema(BaseModel):
    pickup_address: str = Field(..., min_length=5)
    pickup_lat: float
    pickup_lng: float
    dropoff_address: str = Field(..., min_length=5)
    dropoff_lat: float
    dropoff_lng: float
    payment_method: str = Field(default="cash", pattern="^(cash|wallet)$")
    notes: Optional[str] = None


# ── Estado del viaje para el cliente ─────────────────────────────────────────

class ClientTripStatusSchema(BaseModel):
    id: str
    status: str
    pickup_address: str
    dropoff_address: str
    fare: Optional[float] = None
    distance_km: Optional[float] = None
    payment_method: str
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_rating: Optional[float] = None
    driver_location: Optional[dict] = None  # {"lat": x, "lng": y}
    created_at: datetime
    estimated_arrival_min: Optional[int] = None

    class Config:
        from_attributes = True


# ── Calificación de viaje ─────────────────────────────────────────────────────

class TripRatingSchema(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
