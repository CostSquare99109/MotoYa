"""Schemas Pydantic para el rol Client (pasajero/cliente)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.validators import validate_name, validate_phone

if TYPE_CHECKING:
 from datetime import datetime

# ── Registro de cliente ───────────────────────────────────────────────────────

class ClientRegisterSchema(BaseModel):
 full_name: str = Field(..., min_length=2, max_length=100)
 phone: str = Field(..., min_length=7, max_length=20)
 email: EmailStr | None = None
 password: str = Field(..., min_length=6)

 _validate_name = field_validator('full_name')(validate_name)
 _validate_phone = field_validator('phone')(validate_phone)


# ── Login de cliente ──────────────────────────────────────────────────────────

class ClientLoginSchema(BaseModel):
 phone: str = Field(..., min_length=7, max_length=20)
 password: str = Field(..., min_length=1)

 _validate_phone = field_validator('phone')(validate_phone)


# ── Respuesta de auth del cliente ─────────────────────────────────────────────

class ClientAuthResponseSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    client: ClientProfileSchema


# ── Perfil del cliente ────────────────────────────────────────────────────────

class ClientProfileSchema(BaseModel):
    id: str
    full_name: str
    phone: str
    email: str | None = None
    rating: float
    total_trips: int
    wallet_balance: float
    is_verified: bool
    avatar_url: str | None = None

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
    notes: str | None = None


# ── Estado del viaje para el cliente ─────────────────────────────────────────

class ClientTripStatusSchema(BaseModel):
    id: str
    status: str
    pickup_address: str
    dropoff_address: str
    fare: float | None = None
    distance_km: float | None = None
    payment_method: str
    driver_name: str | None = None
    driver_phone: str | None = None
    driver_rating: float | None = None
    driver_location: dict | None = None  # {"lat": x, "lng": y}
    created_at: datetime
    estimated_arrival_min: int | None = None

    class Config:
        from_attributes = True


# ── Calificación de viaje ─────────────────────────────────────────────────────

class TripRatingSchema(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None
