"""Trip and TripStatusHistory models with PostGIS location support."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Numeric, ForeignKey, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geography
from app.database import Base


class Trip(Base):
    __tablename__ = "trips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.id"))
    passenger_name = Column(String(100))
    passenger_phone = Column(String(20))
    pickup_location = Column(Geography("POINT", srid=4326), nullable=False)
    pickup_address = Column(Text, nullable=False)
    dropoff_location = Column(Geography("POINT", srid=4326), nullable=False)
    dropoff_address = Column(Text, nullable=False)
    status = Column(String(20), default="pending")  # pending, assigned, picked_up, in_progress, completed, cancelled
    fare = Column(Numeric(10, 2))
    commission = Column(Numeric(10, 2))
    distance_km = Column(Numeric(6, 2))
    duration_min = Column(Integer)
    payment_method = Column(String(20), default="cash")  # cash, card, wallet
    rating = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class TripStatusHistory(Base):
    __tablename__ = "trip_status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False)
    changed_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
