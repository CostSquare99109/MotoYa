"""User model for all roles: admin, dispatcher, worker, client."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(String(20), default="dispatcher")  # admin | dispatcher | worker | client
    avatar_url = Column(Text)
    is_active = Column(Boolean, default=True)
    # ── Client-specific fields (used when role='client') ────────────────────
    is_verified = Column(Boolean, default=False)
    rating = Column(Numeric(2, 1), default=5.0)
    total_trips = Column(Integer, default=0)
    wallet_balance = Column(Numeric(10, 2), default=0.00)
    preferred_payment = Column(String(20), default="cash")  # cash | wallet
    # ── Timestamps ──────────────────────────────────────────────────────────
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
