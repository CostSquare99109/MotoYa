"""Pydantic schemas for driver endpoints."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.validators import validate_name, validate_phone


class DriverBase(BaseModel):
 full_name: str = Field(..., min_length=1, max_length=100)
 phone: str = Field(..., min_length=5, max_length=20)
 email: EmailStr | None = None
 document_id: str = Field(..., min_length=5, max_length=50)
 license_number: str = Field(..., min_length=5, max_length=50)
 license_expiry: date
 address: str | None = None
 emergency_contact: str | None = None
 emergency_phone: str | None = None

 _validate_name = field_validator('full_name')(validate_name)
 _validate_phone = field_validator('phone')(validate_phone)


class DriverCreate(DriverBase):
 # Contraseña para crear la cuenta de acceso del conductor automáticamente.
 # Si no se envía se genera una por defecto: "motoya" + últimos 4 dígitos del teléfono.
 password: str | None = Field(None, min_length=6, max_length=100)


class DriverUpdate(BaseModel):
 full_name: str | None = None
 phone: str | None = None
 email: EmailStr | None = None
 address: str | None = None
 emergency_contact: str | None = None
 emergency_phone: str | None = None
 status: str | None = None
 is_online: bool | None = None
 # Permite cambiar contraseña desde admin
 password: str | None = Field(None, min_length=6, max_length=100)

 _validate_phone = field_validator('emergency_phone')(validate_phone)


class DriverResponse(DriverBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None = None   # ✅ expuesto para que el frontend sepa si tiene cuenta
    status: str
    is_online: bool
    rating: float
    total_trips: int
    profile_photo_url: str | None = None
    current_location: dict | None = None
    last_seen: datetime | None = None
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
