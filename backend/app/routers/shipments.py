"""Shipment (Moto-Envio) logistics router."""

import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from geoalchemy2 import WKTElement
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.shipments import Shipment
from app.models.users import User
from app.routers.auth import get_current_user
from app.schemas.shipment import (
    ShipmentCreate,
    ShipmentResponse,
    ShipmentUpdate,
    VoiceCommandRequest,
)

router = APIRouter(prefix="/shipments", tags=["shipments"])
settings = get_settings()

_ALLOWED_PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}

def _ensure_upload_dir():
    """Crea el directorio de uploads solo cuando se necesita."""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@router.get("", response_model=list[ShipmentResponse])
async def list_shipments(
    status: str | None = Query(None),
    driver_id: uuid.UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """List all shipments."""
    query = select(Shipment)
    filters = []
    if status:
        filters.append(Shipment.status == status)
    if driver_id:
        filters.append(Shipment.driver_id == driver_id)
    if filters:
        query = query.where(and_(*filters))
    query = query.order_by(Shipment.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=ShipmentResponse, status_code=201)
async def create_shipment(
    data: ShipmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Create a new Moto-Envio shipment."""
    pickup_point = WKTElement(f"POINT({data.pickup_lng} {data.pickup_lat})", srid=4326)
    delivery_point = WKTElement(f"POINT({data.delivery_lng} {data.delivery_lat})", srid=4326)

    shipment = Shipment(
        sender_name=data.sender_name,
        sender_phone=data.sender_phone,
        receiver_name=data.receiver_name,
        receiver_phone=data.receiver_phone,
        pickup_location=pickup_point,
        pickup_address=data.pickup_address,
        delivery_location=delivery_point,
        delivery_address=data.delivery_address,
        description=data.description,
        weight_kg=data.weight_kg,
        dimensions=data.dimensions,
        status="pending",
        photos=[],
        voice_commands=[]
    )
    db.add(shipment)
    await db.commit()
    await db.refresh(shipment)
    return shipment


@router.get("/{shipment_id}", response_model=ShipmentResponse)
async def get_shipment(
    shipment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get shipment by ID."""
    result = await db.execute(select(Shipment).where(Shipment.id == shipment_id))
    shipment = result.scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Envío no encontrado")
    return shipment


@router.patch("/{shipment_id}/status")
async def update_shipment_status(
    shipment_id: uuid.UUID,
    data: ShipmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Update shipment status."""
    result = await db.execute(select(Shipment).where(Shipment.id == shipment_id))
    shipment = result.scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Envío no encontrado")

    if data.status:
        shipment.status = data.status
    if data.driver_id:
        shipment.driver_id = data.driver_id
    if data.fare:
        shipment.fare = data.fare

    await db.commit()
    return {"message": "Envío actualizado", "status": shipment.status}


@router.post("/{shipment_id}/photos")
async def upload_photos(
    shipment_id: uuid.UUID,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Upload package photos for shipment tracking."""
    _ensure_upload_dir()
    result = await db.execute(select(Shipment).where(Shipment.id == shipment_id))
    shipment = result.scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Envío no encontrado")

    uploaded_urls = []
    for file in files:
        file_ext = (os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg").lower()
    if file_ext not in _ALLOWED_PHOTO_EXT:
        raise HTTPException(400, detail=f"Extensión no permitida: {file_ext}. Use: {', '.join(sorted(_ALLOWED_PHOTO_EXT))}")
        filename = f"shipment_{shipment_id}_{uuid.uuid4().hex}{file_ext}"
        filepath = os.path.join(settings.UPLOAD_DIR, filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        uploaded_urls.append(f"/uploads/{filename}")

    # Append to existing photos
    existing = shipment.photos or []
    shipment.photos = existing + uploaded_urls
    await db.commit()

    return {"message": f"{len(uploaded_urls)} fotos subidas", "photos": uploaded_urls}


@router.post("/voice")
async def process_voice_command(
    data: VoiceCommandRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Process voice command for shipment operations.

    Supported commands (Spanish):
        - "Aceptar viaje" / "aceptar envio" -> Assign to driver
    - "Completar entrega" / "entregado" -> Mark as delivered
    - "Emergencia" / "ayuda" -> Trigger emergency
    - "Estado" -> Get current status
    """
    command_text = data.audio_text.lower().strip()

    # Simple command parser
    action = None
    if any(word in command_text for word in ["aceptar", "tomar", "acepto"]):
        action = "accepted"
    elif any(word in command_text for word in ["completar", "entregado", "entregue", "listo"]):
        action = "delivered"
    elif any(word in command_text for word in ["emergencia", "ayuda", "auxilio"]):
        action = "emergency"
    elif any(word in command_text for word in ["estado", "status", "situacion"]):
        action = "status"
    else:
        action = "unknown"

    # Execute action if shipment_id provided
    if data.shipment_id and action in ["accepted", "delivered"]:
        result = await db.execute(select(Shipment).where(Shipment.id == data.shipment_id))
        shipment = result.scalar_one_or_none()
        if shipment:
            if action == "accepted":
                shipment.status = "picked_up"
            elif action == "delivered":
                shipment.status = "delivered"

            # Record voice command
            existing = shipment.voice_commands or []
            shipment.voice_commands = [*existing, data.audio_text]
            await db.commit()

    return {
        "command": data.audio_text,
        "action": action,
        "shipment_id": str(data.shipment_id) if data.shipment_id else None,
        "message": f"Comando '{action}' procesado exitosamente"
    }
