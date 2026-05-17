"""PlatformSettings model - stores app configuration in the database."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class PlatformSettings(Base):
    __tablename__ = "platform_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Una sola fila de configuración global (key = "global")
    key = Column(String(50), unique=True, nullable=False, default="global")
    general = Column(JSONB, nullable=False, default=dict)
    notifications = Column(JSONB, nullable=False, default=dict)
    security = Column(JSONB, nullable=False, default=dict)
    dispatch = Column(JSONB, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
