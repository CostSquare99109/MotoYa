"""Driver and DriverSelfie models with PostGIS location support."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from app.models.types import GeographyCompat, GUID

from app.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=True)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=False)
    email = Column(String(255))
    document_id = Column(String(50), unique=True, nullable=False)
    license_number = Column(String(50), unique=True, nullable=False)
    license_expiry = Column(Date, nullable=False)
    address = Column(Text)
    emergency_contact = Column(String(100))
    emergency_phone = Column(String(20))
    status = Column(String(20), default="pending")  # pending, active, suspended, inactive
    current_location = Column(GeographyCompat())
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime(timezone=True))
    rating = Column(Numeric(2, 1), default=5.0)
    total_trips = Column(Integer, default=0)
    profile_photo_url = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class DriverSelfie(Base):
    __tablename__ = "driver_selfies"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    driver_id = Column(GUID, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False)
    selfie_url = Column(Text, nullable=False)
    validation_status = Column(String(20), default="pending")  # pending, approved, rejected
    validation_confidence = Column(Numeric(5, 4))
    captured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
