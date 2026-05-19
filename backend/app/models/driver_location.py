"""Tabla de ubicacion en tiempo real del conductor (GPS live tracking)."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey

from app.database import Base
from app.models.types import GUID


class DriverLocation(Base):
    __tablename__ = "driver_locations"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)

    # Relaciones
    driver_id = Column(
        GUID,
        ForeignKey("drivers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    trip_id = Column(
        GUID,
        ForeignKey("trips.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Coordenadas
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    bearing = Column(Float, default=0.0)
    speed_kmh = Column(Float, default=0.0)
    accuracy_m = Column(Float, default=10.0)

    is_online = Column(Boolean, default=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
