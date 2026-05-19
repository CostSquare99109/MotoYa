"""Emergency router for panic button and audio streaming."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from geoalchemy2 import WKTElement
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.emergency import EmergencyLog
from app.models.users import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/emergency", tags=["emergency"])

# Active WebSocket connections for emergency streaming
emergency_connections = {}


@router.post("/trigger")
async def trigger_emergency(
    driver_id: uuid.UUID,
    type: str = "panic_button",
    latitude: float | None = None,
    longitude: float | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Trigger an emergency alert from a driver."""
    location = None
    if latitude and longitude:
        location = WKTElement(f"POINT({longitude} {latitude})", srid=4326)

    emergency = EmergencyLog(
        driver_id=driver_id,
        type=type,
        location=location,
        status="active"
    )
    db.add(emergency)
    await db.commit()
    await db.refresh(emergency)

    return {
        "message": "Emergencia activada",
        "emergency_id": str(emergency.id),
        "status": "active",
        "timestamp": emergency.created_at.isoformat()
    }


@router.get("/active")
async def get_active_emergencies(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get all active emergencies."""
    result = await db.execute(
        select(EmergencyLog)
        .where(EmergencyLog.status == "active")
        .order_by(desc(EmergencyLog.created_at))
    )
    emergencies = result.scalars().all()

    active_list = []
    for e in emergencies:
        coords = None
        if e.location:
            loc_res = await db.execute(
                select(func.ST_X(e.location), func.ST_Y(e.location))
            )
            lng, lat = loc_res.first()
            coords = {"lat": float(lat), "lng": float(lng)}

        active_list.append({
            "id": str(e.id),
            "driver_id": str(e.driver_id),
            "type": e.type,
            "location": coords,
            "audio_url": e.audio_url,
            "status": e.status,
            "created_at": e.created_at.isoformat() if e.created_at else None
        })

    return active_list


@router.patch("/{emergency_id}/resolve")
async def resolve_emergency(
    emergency_id: uuid.UUID,
    notes: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Resolve an emergency."""
    result = await db.execute(
        select(EmergencyLog).where(EmergencyLog.id == emergency_id)
    )
    emergency = result.scalar_one_or_none()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergencia no encontrada")

    emergency.status = "resolved"
    emergency.resolved_by = user.id
    emergency.resolved_at = datetime.now(UTC)
    if notes:
        emergency.notes = notes

    await db.commit()
    return {"message": "Emergencia resuelta", "emergency_id": str(emergency_id)}


@router.websocket("/audio/{emergency_id}")
async def emergency_audio_websocket(
    websocket: WebSocket,
    emergency_id: uuid.UUID
):
    """WebSocket for real-time emergency audio streaming."""
    await websocket.accept()

    if emergency_id not in emergency_connections:
        emergency_connections[emergency_id] = []
    emergency_connections[emergency_id].append(websocket)

    try:
        while True:
            # Receive audio chunks
            data = await websocket.receive_bytes()
            # Broadcast to all listeners for this emergency
            for conn in emergency_connections.get(emergency_id, []):
                if conn != websocket:
                    await conn.send_bytes(data)
    except WebSocketDisconnect:
        emergency_connections[emergency_id].remove(websocket)
        if not emergency_connections[emergency_id]:
            del emergency_connections[emergency_id]
