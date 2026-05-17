"""Emergency log model for panic buttons and audio streaming."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geography
from app.database import Base


class EmergencyLog(Base):
    __tablename__ = "emergency_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.id"))
    type = Column(String(20), nullable=False)  # panic_button, audio_stream, accident
    location = Column(Geography("POINT", srid=4326))
    audio_url = Column(Text)
    status = Column(String(20), default="active")  # active, resolved, false_alarm
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
