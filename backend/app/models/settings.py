"""PlatformSettings model - stores app configuration in the database."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, String
from app.models.types import GUID, JSONBCompat

from app.database import Base


class PlatformSettings(Base):
    __tablename__ = "platform_settings"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    # Una sola fila de configuración global (key = "global")
    key = Column(String(50), unique=True, nullable=False, default="global")
    general = Column(JSONBCompat, nullable=False, default=dict)
    notifications = Column(JSONBCompat, nullable=False, default=dict)
    security = Column(JSONBCompat, nullable=False, default=dict)
    dispatch = Column(JSONBCompat, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    updated_by = Column(GUID, nullable=True)
