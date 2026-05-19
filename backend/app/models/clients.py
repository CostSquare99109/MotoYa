"""Modelo Cliente — pasajeros y solicitantes de envíos."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text
from app.models.types import GUID

from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(Text)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    rating = Column(Numeric(2, 1), default=5.0)
    total_trips = Column(Integer, default=0)
    wallet_balance = Column(Numeric(10, 2), default=0.00)
    preferred_payment = Column(String(20), default="cash")  # cash, wallet
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
