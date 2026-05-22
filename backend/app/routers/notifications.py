"""Notification router — CRUD and real-time push for admin notifications."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select, update, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notifications import Notification
from app.models.users import User
from app.routers.auth import get_current_user
from app.routers.location import manager as ws_manager
from app.schemas.notification import NotificationCreate, NotificationResponse, NotificationSummary

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List notifications for the current admin (or broadcast=null)."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id.is_(None))
        .order_by(desc(Notification.created_at))
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/summary", response_model=NotificationSummary)
async def get_notification_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get unread count and total."""
    total_q = await db.execute(
        select(func.count(Notification.id)).where(Notification.user_id.is_(None))
    )
    unread_q = await db.execute(
        select(func.count(Notification.id)).where(
            and_(Notification.user_id.is_(None), Notification.read.is_(False))
        )
    )
    return NotificationSummary(total=total_q.scalar(), unread=unread_q.scalar())


@router.post("", response_model=NotificationResponse, status_code=201)
async def create_notification(
    data: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Create a new notification and push to admins via WebSocket."""
    notif = Notification(
        user_id=data.user_id,
        type=data.type,
        title=data.title,
        message=data.message,
        data=data.data,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)

    # Push en tiempo real a todos los admins conectados
    payload = {
        "type": "notification",
        "data": {
            "id": str(notif.id),
            "notification_type": notif.type,
            "title": notif.title,
            "message": notif.message,
            "created_at": notif.created_at.isoformat() if notif.created_at else None,
        },
    }
    await ws_manager._broadcast_to_admins(payload)

    return notif


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Mark a notification as read."""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    notif.read = True
    await db.commit()
    await db.refresh(notif)
    return notif


@router.patch("/read-all", response_model=dict)
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Mark all broadcast notifications as read."""
    await db.execute(
        update(Notification)
        .where(and_(Notification.user_id.is_(None), Notification.read.is_(False)))
        .values(read=True)
    )
    await db.commit()
    return {"message": "Todas las notificaciones marcadas como leídas"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Delete a notification."""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    await db.delete(notif)
    await db.commit()
    return {"message": "Notificación eliminada"}
