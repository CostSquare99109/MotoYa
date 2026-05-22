"""Notification model — in-app notifications for admin/dispatcher."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from app.models.types import GUID, JSONBCompat

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=True)  # null = broadcast to admins
    type = Column(String(20), nullable=False, default="system")  # trip, emergency, system, dispatch
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    data = Column(JSONBCompat, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
