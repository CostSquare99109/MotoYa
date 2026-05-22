"""Pydantic schemas for notification endpoints."""

from datetime import datetime
from uuid import UUID
from typing import Any

from pydantic import BaseModel, ConfigDict


class NotificationCreate(BaseModel):
    type: str = "system"  # trip, emergency, system, dispatch
    title: str
    message: str
    user_id: UUID | None = None  # null = broadcast to admins
    data: dict[str, Any] | None = None


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None = None
    type: str
    title: str
    message: str
    read: bool
    data: dict[str, Any] | None = None
    created_at: datetime


class NotificationSummary(BaseModel):
    total: int
    unread: int
