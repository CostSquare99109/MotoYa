"""Trip and TripStatusHistory models with PostGIS location support."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from app.models.types import GeographyCompat, GUID

from app.database import Base


class Trip(Base):
    __tablename__ = "trips"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    driver_id = Column(GUID, ForeignKey("drivers.id"))
    passenger_name = Column(String(100))
    passenger_phone = Column(String(20))
    pickup_location = Column(GeographyCompat(), nullable=False)
    pickup_address = Column(Text, nullable=False)
    dropoff_location = Column(GeographyCompat(), nullable=False)
    dropoff_address = Column(Text, nullable=False)
    status = Column(String(20), default="pending")  # pending, assigned, picked_up, in_progress, completed, cancelled
    fare = Column(Numeric(10, 2))
    commission = Column(Numeric(10, 2))
    distance_km = Column(Numeric(6, 2))
    duration_min = Column(Integer)
    payment_method = Column(String(20), default="cash")  # cash, card, wallet
    rating = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class TripStatusHistory(Base):
    __tablename__ = "trip_status_history"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    trip_id = Column(GUID, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    changed_by = Column(GUID, ForeignKey("users.id"))
