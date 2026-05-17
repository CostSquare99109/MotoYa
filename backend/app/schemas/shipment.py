"""Pydantic schemas for shipment (Moto-Envio) endpoints."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_validator


class ShipmentBase(BaseModel):
    sender_name:      str = Field(..., min_length=1, max_length=100)
    sender_phone:     str = Field(..., min_length=5,  max_length=20)
    receiver_name:    str = Field(..., min_length=1, max_length=100)
    receiver_phone:   str = Field(..., min_length=5,  max_length=20)
    pickup_address:   str = Field(..., min_length=1)
    delivery_address: str = Field(..., min_length=1)
    description:      Optional[str]   = None
    weight_kg:        Optional[float] = None
    dimensions:       Optional[str]   = None


class ShipmentCreate(ShipmentBase):
    pickup_lat:   float = Field(..., ge=-90,  le=90)
    pickup_lng:   float = Field(..., ge=-180, le=180)
    delivery_lat: float = Field(..., ge=-90,  le=90)
    delivery_lng: float = Field(..., ge=-180, le=180)


class ShipmentUpdate(BaseModel):
    status:    Optional[str]   = None
    driver_id: Optional[UUID]  = None
    fare:      Optional[float] = None


class ShipmentResponse(ShipmentBase):
    model_config = ConfigDict(from_attributes=True)

    id:                UUID
    driver_id:         Optional[UUID]  = None
    status:            str
    fare:              Optional[float] = None
    photos:            List[str]
    voice_commands:    List[str]
    pickup_location:   Optional[dict]  = None
    delivery_location: Optional[dict]  = None
    created_at:        datetime
    updated_at:        datetime

    # ✅ Convierte WKBElement (GeoAlchemy2) → {"lat": ..., "lng": ...}
    @field_validator("pickup_location", "delivery_location", mode="before")
    @classmethod
    def parse_geometry(cls, v):
        if v is None or isinstance(v, dict):
            return v
        try:
            from geoalchemy2.shape import to_shape
            point = to_shape(v)
            return {"lat": point.y, "lng": point.x}
        except Exception:
            return None


class VoiceCommandRequest(BaseModel):
    audio_text:  str           = Field(..., min_length=1)
    shipment_id: Optional[UUID] = None
