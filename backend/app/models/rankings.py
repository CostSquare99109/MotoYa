"""Ranking/gamification model for driver tiers and badges."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from app.models.types import ArrayJSON, GUID

from app.database import Base


class Ranking(Base):
    __tablename__ = "rankings"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    driver_id = Column(GUID, ForeignKey("drivers.id"), unique=True)
    tier = Column(String(20), default="bronze")  # bronze, silver, gold, platinum
    points = Column(Integer, default=0)
    weekly_trips = Column(Integer, default=0)
    monthly_trips = Column(Integer, default=0)
    acceptance_rate = Column(Numeric(5, 2), default=100.0)
    rating_avg = Column(Numeric(2, 1), default=5.0)
    streak_days = Column(Integer, default=0)
    badges = Column(ArrayJSON, default=list)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
