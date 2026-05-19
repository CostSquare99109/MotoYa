"""Shipment (Moto-Envio) model with photo and voice command support."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Text
from app.models.types import GeographyCompat, ArrayJSON, GUID

from app.database import Base


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    driver_id = Column(GUID, ForeignKey("drivers.id"))
    sender_name = Column(String(100), nullable=False)
    sender_phone = Column(String(20), nullable=False)
    receiver_name = Column(String(100), nullable=False)
    receiver_phone = Column(String(20), nullable=False)
    pickup_location = Column(GeographyCompat(), nullable=False)
    pickup_address = Column(Text, nullable=False)
    delivery_location = Column(GeographyCompat(), nullable=False)
    delivery_address = Column(Text, nullable=False)
    description = Column(Text)
    weight_kg = Column(Numeric(6, 2))
    dimensions = Column(Text)
    status = Column(String(20), default="pending")  # pending, picked_up, in_transit, delivered, cancelled
    fare = Column(Numeric(10, 2))
    photos = Column(ArrayJSON, default=list)
    voice_commands = Column(ArrayJSON, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
