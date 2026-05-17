"""Pydantic schemas for trip endpoints."""

from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_validator


def _wkb_to_dict(value: Any) -> Optional[dict]:
    """
    Convierte un WKBElement de PostGIS (o WKTElement) a {"lat": float, "lng": float}.
    Si ya es dict o None, lo devuelve tal cual.
    """
    if value is None:
        return None
    if isinstance(value, dict):
        return value

    # ── Intentar con geoalchemy2.shape (requiere shapely) ──────────────────
    try:
        from geoalchemy2.shape import to_shape
        point = to_shape(value)
        return {"lat": point.y, "lng": point.x}
    except Exception:
        pass

    # ── Fallback: parsear el hex WKB manualmente ────────────────────────────
    # WKB POINT little-endian: 01 01000000 <lng:8bytes> <lat:8bytes>
    try:
        import struct
        raw = value.desc if hasattr(value, "desc") else str(value)
        # desc puede ser bytes o hex-string
        if isinstance(raw, (bytes, bytearray)):
            data = raw
        else:
            # strip prefixes like \x
            hex_str = raw.replace("\\x", "").replace("0x", "")
            data = bytes.fromhex(hex_str)

        # byte 0: endianness (01 = little-endian)
        # bytes 1-4: geometry type
        # bytes 5-12: X (longitude), bytes 13-20: Y (latitude)
        endian = "<" if data[0] == 1 else ">"
        lng, lat = struct.unpack_from(f"{endian}dd", data, offset=5)
        return {"lat": lat, "lng": lng}
    except Exception:
        pass

    # No pudimos parsear — devolvemos None para no romper la respuesta
    return None


class TripBase(BaseModel):
    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None
    pickup_address: str = Field(..., min_length=1)
    dropoff_address: str = Field(..., min_length=1)
    payment_method: str = "cash"
    notes: Optional[str] = None


class TripCreate(TripBase):
    pickup_lat:  float = Field(..., ge=-90,  le=90)
    pickup_lng:  float = Field(..., ge=-180, le=180)
    dropoff_lat: float = Field(..., ge=-90,  le=90)
    dropoff_lng: float = Field(..., ge=-180, le=180)


class TripUpdate(BaseModel):
    status:    Optional[str]   = None
    driver_id: Optional[UUID]  = None
    fare:      Optional[float] = None
    rating:    Optional[int]   = Field(None, ge=1, le=5)
    notes:     Optional[str]   = None


class TripResponse(TripBase):
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    id:               UUID
    driver_id:        Optional[UUID]  = None
    status:           str
    fare:             Optional[float] = None
    commission:       Optional[float] = None
    distance_km:      Optional[float] = None
    duration_min:     Optional[int]   = None
    pickup_location:  Optional[dict]  = None
    dropoff_location: Optional[dict]  = None
    rating:           Optional[int]   = None
    created_at:       datetime
    updated_at:       datetime

    @field_validator("pickup_location", "dropoff_location", mode="before")
    @classmethod
    def parse_geo(cls, v: Any) -> Optional[dict]:
        return _wkb_to_dict(v)


class TripStats(BaseModel):
    total_trips:        int
    pending_trips:      int
    completed_today:    int
    cancelled_today:    int
    avg_fare:           float
    total_revenue_today: float
