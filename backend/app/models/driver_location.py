"""Tabla de ubicación en tiempo real del conductor (GPS live tracking)."""

import uuid
from datetime import datetime
from sqlalchemy import Column, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class DriverLocation(Base):
    __tablename__ = "driver_locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Relaciones
    driver_id = Column(
        UUID(as_uuid=True),
        ForeignKey("drivers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,   # un registro por conductor (se hace UPSERT)
        index=True,
    )
    trip_id = Column(
        UUID(as_uuid=True),
        ForeignKey("trips.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Coordenadas
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    bearing = Column(Float, default=0.0)   # grados 0-360 (rumbo)
    speed_kmh = Column(Float, default=0.0)
    accuracy_m = Column(Float, default=10.0)  # precisión GPS en metros

    is_online = Column(Boolean, default=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
