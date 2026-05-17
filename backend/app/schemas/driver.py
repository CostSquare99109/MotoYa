"""Pydantic schemas for driver endpoints."""

from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class DriverBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=5, max_length=20)
    email: Optional[str] = None
    document_id: str = Field(..., min_length=5, max_length=50)
    license_number: str = Field(..., min_length=5, max_length=50)
    license_expiry: date
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None


class DriverCreate(DriverBase):
    # ✅ Contraseña para crear la cuenta de acceso del conductor automáticamente.
    # Si no se envía se genera una por defecto: "motoya" + últimos 4 dígitos del teléfono.
    password: Optional[str] = Field(None, min_length=6, max_length=100)


class DriverUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    status: Optional[str] = None
    is_online: Optional[bool] = None
    # ✅ Permite cambiar contraseña desde admin
    password: Optional[str] = Field(None, min_length=6, max_length=100)


class DriverResponse(DriverBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: Optional[UUID] = None   # ✅ expuesto para que el frontend sepa si tiene cuenta
    status: str
    is_online: bool
    rating: float
    total_trips: int
    profile_photo_url: Optional[str] = None
    current_location: Optional[dict] = None
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class DriverLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class NearbyDriverQuery(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=3.0, gt=0, le=50)
    limit: int = Field(default=10, ge=1, le=50)


class NearbyDriverResponse(BaseModel):
    id: UUID
    full_name: str
    phone: str
    status: str
    is_online: bool
    rating: float
    distance_meters: float
    current_location: dict
