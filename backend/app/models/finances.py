"""Earnings model for driver finance tracking."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String
from app.models.types import GUID

from app.database import Base


class Earning(Base):
    __tablename__ = "earnings"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    driver_id = Column(GUID, ForeignKey("drivers.id"))
    trip_id = Column(GUID, ForeignKey("trips.id"))
    shipment_id = Column(GUID, ForeignKey("shipments.id"))
    gross_amount = Column(Numeric(10, 2), nullable=False)
    commission_amount = Column(Numeric(10, 2), default=0)
    fuel_cost = Column(Numeric(10, 2), default=0)
    net_amount = Column(Numeric(10, 2), nullable=False)
    period = Column(String(7), nullable=False)  # YYYY-MM format
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
