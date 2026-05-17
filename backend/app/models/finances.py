"""Earnings model for driver finance tracking."""

import uuid
from datetime import datetime
from sqlalchemy import Column, Numeric, ForeignKey, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Earning(Base):
    __tablename__ = "earnings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.id"))
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"))
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.id"))
    gross_amount = Column(Numeric(10, 2), nullable=False)
    commission_amount = Column(Numeric(10, 2), default=0)
    fuel_cost = Column(Numeric(10, 2), default=0)
    net_amount = Column(Numeric(10, 2), nullable=False)
    period = Column(String(7), nullable=False)  # YYYY-MM format
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
