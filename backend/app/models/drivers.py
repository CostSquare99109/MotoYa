"""Driver and DriverSelfie models with PostGIS location support."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, ForeignKey, Integer, Date
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geography
from app.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
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
    current_location = Column(Geography("POINT", srid=4326))
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime(timezone=True))
    rating = Column(Numeric(2, 1), default=5.0)
    total_trips = Column(Integer, default=0)
    profile_photo_url = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class DriverSelfie(Base):
    __tablename__ = "driver_selfies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False)
    selfie_url = Column(Text, nullable=False)
    validation_status = Column(String(20), default="pending")  # pending, approved, rejected
    validation_confidence = Column(Numeric(5, 4))
    captured_at = Column(DateTime(timezone=True), default=datetime.utcnow)
