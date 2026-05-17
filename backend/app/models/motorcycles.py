"""Motorcycle fleet management model."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Date, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Motorcycle(Base):
    __tablename__ = "motorcycles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.id", ondelete="SET NULL"))
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
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
