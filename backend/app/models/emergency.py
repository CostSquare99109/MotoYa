"""Emergency log model for panic buttons and audio streaming."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from app.models.types import GeographyCompat, GUID

from app.database import Base


class EmergencyLog(Base):
    __tablename__ = "emergency_logs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    driver_id = Column(GUID, ForeignKey("drivers.id"))
    type = Column(String(20), nullable=False)  # panic_button, audio_stream, accident
    location = Column(GeographyCompat())
    audio_url = Column(Text)
    status = Column(String(20), default="active")  # active, resolved, false_alarm
    resolved_by = Column(GUID, ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
