"""Motorcycle fleet management router."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from datetime import date
import uuid

from app.database import get_db
from app.models.motorcycles import Motorcycle
from app.routers.auth import get_current_user, get_current_admin
from app.models.users import User

router = APIRouter(prefix="/motorcycles", tags=["motorcycles"])


# ── Schemas ────────────────────────────────────────────────────────────────

class MotorcycleCreate(BaseModel):
    plate: str
    brand: str
    model: str
    year: int
    color: Optional[str] = None
    engine_cc: Optional[int] = None
    mileage: Optional[int] = 0
    driver_id: Optional[str] = None


class MotorcycleUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None
    engine_cc: Optional[int] = None
    status: Optional[str] = None
    mileage: Optional[int] = None
    last_maintenance: Optional[date] = None
    next_maintenance: Optional[date] = None
    driver_id: Optional[str] = None


class MotorcycleResponse(BaseModel):
    id: str
    plate: str
    brand: str
    model: str
    year: int
    color: Optional[str] = None
    engine_cc: Optional[int] = None
    status: str
    mileage: int
    last_maintenance: Optional[date] = None
    next_maintenance: Optional[date] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None

    class Config:
        from_attributes = True


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("", response_model=List[MotorcycleResponse])
async def list_motorcycles(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all motorcycles, optionally filtered."""
    query = select(Motorcycle)
    filters = []
    if status:
        filters.append(Motorcycle.status == status)
    if search:
        search_pat = f"%{search}%"
        from sqlalchemy import or_
        filters.append(
            or_(
                Motorcycle.plate.ilike(search_pat),
                Motorcycle.brand.ilike(search_pat),
                Motorcycle.model.ilike(search_pat),
            )
        )
    if filters:
        query = query.where(and_(*filters))
    query = query.order_by(Motorcycle.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    motos = result.scalars().all()

    out = []
    for m in motos:
        item = MotorcycleResponse(
            id=str(m.id),
            plate=m.plate,
            brand=m.brand,
            model=m.model,
            year=m.year,
            color=m.color,
            engine_cc=m.engine_cc,
            status=m.status or "active",
            mileage=m.mileage or 0,
            last_maintenance=m.last_maintenance,
            next_maintenance=m.next_maintenance,
            driver_id=str(m.driver_id) if m.driver_id else None,
        )
        out.append(item)
    return out


@router.post("", response_model=MotorcycleResponse, status_code=201)
async def create_motorcycle(
    data: MotorcycleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Register a new motorcycle."""
    # Check plate uniqueness
    existing = await db.execute(
        select(Motorcycle).where(Motorcycle.plate == data.plate.upper())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe una moto con esa placa")

    moto = Motorcycle(
        plate=data.plate.upper(),
        brand=data.brand,
        model=data.model,
        year=data.year,
        color=data.color,
        engine_cc=data.engine_cc,
        mileage=data.mileage or 0,
        driver_id=uuid.UUID(data.driver_id) if data.driver_id else None,
        status="active",
    )
    db.add(moto)
    await db.commit()
    await db.refresh(moto)

    return MotorcycleResponse(
        id=str(moto.id),
        plate=moto.plate,
        brand=moto.brand,
        model=moto.model,
        year=moto.year,
        color=moto.color,
        engine_cc=moto.engine_cc,
        status=moto.status or "active",
        mileage=moto.mileage or 0,
        driver_id=str(moto.driver_id) if moto.driver_id else None,
    )


@router.get("/{motorcycle_id}", response_model=MotorcycleResponse)
async def get_motorcycle(
    motorcycle_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Motorcycle).where(Motorcycle.id == uuid.UUID(motorcycle_id))
    )
    moto = result.scalar_one_or_none()
    if not moto:
        raise HTTPException(status_code=404, detail="Motocicleta no encontrada")
    return MotorcycleResponse(
        id=str(moto.id),
        plate=moto.plate,
        brand=moto.brand,
        model=moto.model,
        year=moto.year,
        color=moto.color,
        engine_cc=moto.engine_cc,
        status=moto.status or "active",
        mileage=moto.mileage or 0,
        last_maintenance=moto.last_maintenance,
        next_maintenance=moto.next_maintenance,
        driver_id=str(moto.driver_id) if moto.driver_id else None,
    )


@router.patch("/{motorcycle_id}", response_model=MotorcycleResponse)
async def update_motorcycle(
    motorcycle_id: str,
    data: MotorcycleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(Motorcycle).where(Motorcycle.id == uuid.UUID(motorcycle_id))
    )
    moto = result.scalar_one_or_none()
    if not moto:
        raise HTTPException(status_code=404, detail="Motocicleta no encontrada")

    for field, value in data.model_dump(exclude_none=True).items():
        if field == "driver_id" and value:
            setattr(moto, field, uuid.UUID(value))
        else:
            setattr(moto, field, value)

    await db.commit()
    await db.refresh(moto)
    return MotorcycleResponse(
        id=str(moto.id),
        plate=moto.plate,
        brand=moto.brand,
        model=moto.model,
        year=moto.year,
        color=moto.color,
        engine_cc=moto.engine_cc,
        status=moto.status or "active",
        mileage=moto.mileage or 0,
        last_maintenance=moto.last_maintenance,
        next_maintenance=moto.next_maintenance,
        driver_id=str(moto.driver_id) if moto.driver_id else None,
    )


@router.delete("/{motorcycle_id}", status_code=204)
async def delete_motorcycle(
    motorcycle_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(Motorcycle).where(Motorcycle.id == uuid.UUID(motorcycle_id))
    )
    moto = result.scalar_one_or_none()
    if not moto:
        raise HTTPException(status_code=404, detail="Motocicleta no encontrada")
    await db.delete(moto)
    await db.commit()
