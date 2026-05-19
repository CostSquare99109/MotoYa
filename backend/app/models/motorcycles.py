"""Motorcycle fleet management model."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from app.models.types import GUID

from app.database import Base


class Motorcycle(Base):
    __tablename__ = "motorcycles"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    driver_id = Column(GUID, ForeignKey("drivers.id", ondelete="SET NULL"))
    plate = Column(String(20), unique=True, nullable=False)
    brand = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    color = Column(String(30))
    engine_cc = Column(Integer)
    status = Column(String(20), default="active")  # active, maintenance, retired
    last_maintenance = Column(Date)
    next_maintenance = Column(Date)
    mileage = Column(Integer, default=0)
    photo_url = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
