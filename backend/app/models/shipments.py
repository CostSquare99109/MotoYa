"""Shipment (Moto-Envio) model with photo and voice command support."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Numeric, ForeignKey, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geography
from app.database import Base


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.id"))
    sender_name = Column(String(100), nullable=False)
    sender_phone = Column(String(20), nullable=False)
    receiver_name = Column(String(100), nullable=False)
    receiver_phone = Column(String(20), nullable=False)
    pickup_location = Column(Geography("POINT", srid=4326), nullable=False)
    pickup_address = Column(Text, nullable=False)
    delivery_location = Column(Geography("POINT", srid=4326), nullable=False)
    delivery_address = Column(Text, nullable=False)
    description = Column(Text)
    weight_kg = Column(Numeric(6, 2))
    dimensions = Column(Text)
    status = Column(String(20), default="pending")  # pending, picked_up, in_transit, delivered, cancelled
    fare = Column(Numeric(10, 2))
    photos = Column(ARRAY(Text), default=list)
    voice_commands = Column(ARRAY(Text), default=list)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
