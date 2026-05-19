"""Trip management router."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2 import WKTElement
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.drivers import Driver
from app.models.rankings import Ranking
from app.models.trips import Trip, TripStatusHistory
from app.models.users import User
from app.routers.auth import get_current_user
from app.schemas.trip import TripCreate, TripResponse, TripStats, TripUpdate

# Comisión por defecto según tier del conductor
_TIER_COMMISSION = {"bronze": 0.15, "silver": 0.12, "gold": 0.10, "platinum": 0.08}
_DEFAULT_COMMISSION = 0.15

router = APIRouter(prefix="/trips", tags=["trips"])

# Estados que indican que un conductor ya está ocupado
_BUSY_STATUSES = {"pending", "assigned", "in_progress", "en_route"}


@router.get("", response_model=list[TripResponse])
async def list_trips(
    status: str | None = Query(None),
    driver_id: uuid.UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """List trips with filters."""
    query = select(Trip)
    filters = []
    if status:
        filters.append(Trip.status == status)
    if driver_id:
        filters.append(Trip.driver_id == driver_id)
    if filters:
        query = query.where(and_(*filters))
    query = query.order_by(Trip.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TripResponse, status_code=201)
async def create_trip(
    data: TripCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new trip request."""
    pickup_point = WKTElement(f"POINT({data.pickup_lng} {data.pickup_lat})", srid=4326)
    dropoff_point = WKTElement(f"POINT({data.dropoff_lng} {data.dropoff_lat})", srid=4326)

    trip = Trip(
        passenger_name=data.passenger_name,
        passenger_phone=data.passenger_phone,
        pickup_location=pickup_point,
        pickup_address=data.pickup_address,
        dropoff_location=dropoff_point,
        dropoff_address=data.dropoff_address,
        payment_method=data.payment_method,
        notes=data.notes,
        status="pending"
    )
    db.add(trip)
    await db.flush()

    history = TripStatusHistory(trip_id=trip.id, status="pending", changed_by=user.id)
    db.add(history)
    await db.commit()
    await db.refresh(trip)
    return trip


@router.get("/stats/summary", response_model=TripStats)
async def get_trip_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get trip statistics for dashboard."""
    today = datetime.now(UTC).date()
    today_start = datetime(today.year, today.month, today.day)

    total = await db.execute(select(func.count(Trip.id)))
    pending = await db.execute(select(func.count(Trip.id)).where(Trip.status == "pending"))
    completed_today = await db.execute(
        select(func.count(Trip.id)).where(
            and_(Trip.status == "completed", Trip.created_at >= today_start)
        )
    )
    cancelled_today = await db.execute(
        select(func.count(Trip.id)).where(
            and_(Trip.status == "cancelled", Trip.created_at >= today_start)
        )
    )
    avg_fare_result = await db.execute(
        select(func.avg(Trip.fare)).where(Trip.status == "completed")
    )
    revenue_today = await db.execute(
        select(func.coalesce(func.sum(Trip.fare), 0)).where(
            and_(Trip.status == "completed", Trip.created_at >= today_start)
        )
    )

    return TripStats(
        total_trips=total.scalar(),
        pending_trips=pending.scalar(),
        completed_today=completed_today.scalar(),
        cancelled_today=cancelled_today.scalar(),
        avg_fare=round(float(avg_fare_result.scalar() or 0), 2),
        total_revenue_today=round(float(revenue_today.scalar()), 2)
    )


@router.get("/latest/assignments")
async def get_latest_assignments(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get latest trip assignments for dashboard table."""
    result = await db.execute(
        select(Trip).order_by(Trip.created_at.desc()).limit(limit)
    )
    trips = result.scalars().all()

    assignments = []
    for trip in trips:
        pickup_coords = None
        if trip.pickup_location:
            loc_res = await db.execute(
                select(func.ST_X(trip.pickup_location), func.ST_Y(trip.pickup_location))
            )
            lng, lat = loc_res.first()
            pickup_coords = {"lat": float(lat), "lng": float(lng)}

        driver_name = None
        if trip.driver_id:
            d_res = await db.execute(
                select(Driver.full_name).where(Driver.id == trip.driver_id)
            )
            driver_name = d_res.scalar()

        assignments.append({
            "id": str(trip.id),
            "passenger_name": trip.passenger_name or "N/A",
            "driver_name": driver_name or "Sin asignar",
            "pickup_address": trip.pickup_address,
            "dropoff_address": trip.dropoff_address,
            "status": trip.status,
            "fare": float(trip.fare) if trip.fare else None,
            "pickup_location": pickup_coords,
            "created_at": trip.created_at.isoformat() if trip.created_at else None
        })

    return assignments


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get trip by ID."""
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    return trip


@router.patch("/{trip_id}/status")
async def update_trip_status(
    trip_id: uuid.UUID,
    data: TripUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update trip status."""
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    if data.status:
        trip.status = data.status
        history = TripStatusHistory(
            trip_id=trip_id,
            status=data.status,
            changed_by=user.id
        )
        db.add(history)

    if data.driver_id:
        trip.driver_id = data.driver_id

    if data.fare:
        trip.fare = data.fare
        # Buscar tier del conductor para comisión correcta
        if trip.driver_id:
            rank_res = await db.execute(
                select(Ranking).where(Ranking.driver_id == trip.driver_id)
            )
            rank = rank_res.scalar_one_or_none()
            tier = rank.tier if rank else "bronze"
            rate = _TIER_COMMISSION.get(tier, _DEFAULT_COMMISSION)
        else:
            rate = _DEFAULT_COMMISSION
        trip.commission = data.fare * rate

    if data.rating:
        trip.rating = data.rating

    await db.commit()
    return {"message": "Viaje actualizado", "trip_id": str(trip_id), "status": trip.status}


# ── POST /trips/request — solicitud de viaje desde el cliente ────────────────
# Crea el viaje y lo despacha automáticamente al conductor más cercano libre.
# Si el más cercano está ocupado, prueba el siguiente, y así hasta 10 intentos.

class ClientTripRequestSchema(BaseModel):
    passenger_name:  str
    passenger_phone: str
    pickup_lat:      float
    pickup_lng:      float
    pickup_address:  str
    dropoff_lat:     float
    dropoff_lng:     float
    dropoff_address: str
    payment_method:  str = "cash"
    notes:           str | None = None


@router.post("/request", status_code=201)
async def request_trip(
    data: ClientTripRequestSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Crea un viaje y lo despacha automáticamente al conductor disponible
    más cercano dentro de 5 km.

    Algoritmo:
      1. Crea el Trip con status='pending'.
      2. Obtiene hasta 10 conductores activos/online ordenados por distancia.
      3. Para cada conductor (del más cercano al más lejano):
           - Si tiene viaje activo (pending/assigned/in_progress/en_route) → saltar.
           - Si está libre → asignar y salir del loop.
      4. Si ninguno está libre → viaje queda 'pending' para asignación manual.
    """
    # ── 1. Crear viaje ───────────────────────────────────────────────────────
    pickup_pt  = WKTElement(f"POINT({data.pickup_lng}  {data.pickup_lat})",  srid=4326)
    dropoff_pt = WKTElement(f"POINT({data.dropoff_lng} {data.dropoff_lat})", srid=4326)

    trip = Trip(
        passenger_name   = data.passenger_name,
        passenger_phone  = data.passenger_phone,
        pickup_location  = pickup_pt,
        pickup_address   = data.pickup_address,
        dropoff_location = dropoff_pt,
        dropoff_address  = data.dropoff_address,
        payment_method   = data.payment_method,
        notes            = data.notes,
        status           = "pending",
    )
    db.add(trip)
    await db.flush()  # obtener trip.id sin hacer commit aún

    db.add(TripStatusHistory(trip_id=trip.id, status="pending", changed_by=user.id))

    # ── 2. Buscar conductores cercanos (hasta 10, radio 5 km) ─────────────────
    origin   = WKTElement(f"POINT({data.pickup_lng} {data.pickup_lat})", srid=4326)
    dist_col = func.ST_Distance(Driver.current_location, origin).label("dist")

    stmt = (
        select(Driver, dist_col)
        .where(
            and_(
                Driver.is_online.is_(True),
                Driver.status    == "active",
                func.ST_DWithin(Driver.current_location, origin, 5_000),
            )
        )
        .order_by(dist_col)
        .limit(10)
    )
    rows = (await db.execute(stmt)).all()

    assigned_driver = None

    # ── 3. Intentar asignar al primero que no esté ocupado ────────────────────
    for driver, _dist in rows:
        busy = await db.execute(
            select(Trip.id).where(
                and_(
                    Trip.driver_id == driver.id,
                    Trip.status.in_(_BUSY_STATUSES),
                )
            ).limit(1)
        )
        if busy.scalar_one_or_none() is not None:
            continue  # ocupado → probar el siguiente

        # ✅ Conductor libre encontrado
        trip.driver_id = driver.id
        trip.status    = "assigned"
        db.add(TripStatusHistory(trip_id=trip.id, status="assigned", changed_by=user.id))
        assigned_driver = driver
        break

    # ── 4. Confirmar en BD ───────────────────────────────────────────────────
    await db.commit()
    await db.refresh(trip)

    return {
        "id":              str(trip.id),
        "status":          trip.status,
        "pickup_address":  trip.pickup_address,
        "dropoff_address": trip.dropoff_address,
        "payment_method":  trip.payment_method,
        "driver": {
            "id":        str(assigned_driver.id),
            "full_name": assigned_driver.full_name,
            "phone":     assigned_driver.phone,
            "rating":    float(assigned_driver.rating or 5.0),
        } if assigned_driver else None,
        "message": (
            f"Conductor {assigned_driver.full_name} en camino"
            if assigned_driver
            else "Buscando conductor disponible…"
        ),
    }
