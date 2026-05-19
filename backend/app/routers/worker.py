"""Router para el rol Worker (mototaxista).

Endpoints exclusivos del conductor autenticado con role='worker'.
Su user.id debe estar vinculado a un Driver via Driver.user_id.

Prefijos registrados:
  /api/worker   — ruta canónica
  /api/workers  — alias plural (compatibilidad con el frontend)
"""

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.drivers import Driver
from app.models.finances import Earning
from app.models.trips import Trip, TripStatusHistory
from app.models.users import User
from app.routers.auth import get_current_user
from app.schemas.worker import (
    ActiveTripSchema,
    IncomingTripSchema,
    TripResponseSchema,
    TripStatusUpdateSchema,
    WorkerOnlineStatusSchema,
    WorkerStatsSchema,
)

router = APIRouter(prefix="/worker", tags=["worker"])
router_plural = APIRouter(prefix="/workers", tags=["worker"])


# ── Dependencias ──────────────────────────────────────────────────────────────

async def get_current_worker(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role not in ("worker", "admin"):
        raise HTTPException(status_code=403, detail="Acceso solo para conductores")
    return current_user


async def get_driver_from_user(user: User, db: AsyncSession) -> Driver:
    result = await db.execute(select(Driver).where(Driver.user_id == user.id))
    driver = result.scalar_one_or_none()
    if not driver:
        # FIX 2: 404 interno cuando el User no tiene Driver vinculado.
        # Cambiado a 422 para diferenciarlo del 404 de ruta no encontrada
        # y facilitar el debug desde el frontend.
        raise HTTPException(
            status_code=422,
            detail="No hay un perfil de conductor vinculado a este usuario. "
                   "Ejecuta create_worker_account.py o vincula el Driver en BD.",
        )
    return driver


# ── Función de stats ──────────────────────────────────────────────────────────

async def _build_worker_stats(driver: Driver, db: AsyncSession) -> WorkerStatsSchema:
    today = date.today()
    week_start = today - timedelta(days=6)
    month_start = today.replace(day=1)

    trips_today = (await db.execute(
        select(func.count(Trip.id)).where(
            and_(Trip.driver_id == driver.id, Trip.status == "completed",
                 func.date(Trip.created_at) == today)
        )
    )).scalar() or 0

    def _earnings_query(since):
        return select(func.coalesce(func.sum(Earning.net_amount), 0)).where(
            and_(Earning.driver_id == driver.id, func.date(Earning.created_at) >= since)
        )

    earnings_today = float((await db.execute(_earnings_query(today))).scalar() or 0)
    earnings_week  = float((await db.execute(_earnings_query(week_start))).scalar() or 0)
    earnings_month = float((await db.execute(_earnings_query(month_start))).scalar() or 0)

    accepted = (await db.execute(
        select(func.count(Trip.id)).where(
            and_(Trip.driver_id == driver.id,
                 Trip.status != "cancelled",
                 func.date(Trip.created_at) >= today - timedelta(days=30))
        )
    )).scalar() or 0
    cancelled = (await db.execute(
        select(func.count(Trip.id)).where(
            and_(Trip.driver_id == driver.id,
                 Trip.status == "cancelled",
                 func.date(Trip.created_at) >= today - timedelta(days=30))
        )
    )).scalar() or 0
    total_requests = accepted + cancelled
    acceptance_rate = round((accepted / total_requests * 100) if total_requests > 0 else 100.0, 1)

    points = int(driver.total_trips * 10 + max(0, float(driver.rating or 5.0) - 3) * 50)

    badges: list[str] = []
    if driver.total_trips >= 100:
        badges.append("100 viajes")
    if driver.total_trips >= 500:
        badges.append("500 viajes")
    if float(driver.rating or 0) >= 4.8:
        badges.append("Mejor valorado")
    if acceptance_rate >= 90:
        badges.append("Alta aceptación")
    if earnings_month >= 2_000_000:
        badges.append("Top ganancias")

    return WorkerStatsSchema(
        full_name=driver.full_name,
        phone=driver.phone,
        status=driver.status,
        is_online=driver.is_online,
        rating=float(driver.rating or 5.0),
        total_trips=driver.total_trips,
        trips_today=trips_today,
        earnings_today=earnings_today,
        earnings_week=earnings_week,
        earnings_month=earnings_month,
        acceptance_rate=acceptance_rate,
        points=points,
        badges=badges,
        profile_photo_url=driver.profile_photo_url,
    )


# ── GET /worker/me y /workers/me ─────────────────────────────────────────────

@router.get("/me", response_model=WorkerStatsSchema)
@router_plural.get("/me", response_model=WorkerStatsSchema)
async def get_worker_profile(
    current_user: User = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db),
):
    driver = await get_driver_from_user(current_user, db)
    return await _build_worker_stats(driver, db)


@router_plural.get("/me/stats", response_model=WorkerStatsSchema)
async def get_worker_stats_alias(
    current_user: User = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db),
):
    driver = await get_driver_from_user(current_user, db)
    return await _build_worker_stats(driver, db)


# ── PATCH /worker/me/status y /workers/me/status ─────────────────────────────
# FIX 1: Ruta corregida de "/status" a "/me/status" para coincidir
# con lo que el frontend llama: PATCH /api/workers/me/status

@router.patch("/me/status")
@router_plural.patch("/me/status")
async def update_worker_status(
    payload: WorkerOnlineStatusSchema,
    current_user: User = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db),
):
    driver = await get_driver_from_user(current_user, db)
    driver.is_online = payload.is_online
    driver.last_seen = datetime.now(UTC)
    await db.commit()
    return {"is_online": driver.is_online, "message": "Estado actualizado"}


# ── GET /worker/trip/active ───────────────────────────────────────────────────

@router.get("/trip/active", response_model=ActiveTripSchema | None)
@router_plural.get("/trip/active", response_model=ActiveTripSchema | None)
async def get_active_trip(
    current_user: User = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db),
):
    driver = await get_driver_from_user(current_user, db)
    result = await db.execute(
        select(Trip).where(
            and_(Trip.driver_id == driver.id,
                 Trip.status.in_(["assigned", "picked_up", "in_progress"]))
        ).order_by(Trip.created_at.desc()).limit(1)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        return None
    return ActiveTripSchema(
        id=str(trip.id),
        passenger_name=trip.passenger_name or "Pasajero",
        passenger_phone=trip.passenger_phone or "",
        pickup_address=trip.pickup_address,
        dropoff_address=trip.dropoff_address,
        status=trip.status,
        fare=float(trip.fare or 0),
        distance_km=float(trip.distance_km or 0),
        payment_method=trip.payment_method,
        created_at=trip.created_at,
    )


# ── GET /worker/trip/pending ──────────────────────────────────────────────────

@router.get("/trip/pending", response_model=IncomingTripSchema | None)
@router_plural.get("/trip/pending", response_model=IncomingTripSchema | None)
async def get_pending_trip(
    current_user: User = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db),
):
    driver = await get_driver_from_user(current_user, db)
    result = await db.execute(
        select(Trip).where(
            and_(Trip.driver_id == driver.id, Trip.status == "pending")
        ).order_by(Trip.created_at.desc()).limit(1)
    )
    trip = result.scalar_one_or_none()
    if not trip:\
        return None
    return IncomingTripSchema(
        trip_id=str(trip.id),
        passenger_name=trip.passenger_name or "Pasajero",
        passenger_phone=trip.passenger_phone or "",
        pickup_address=trip.pickup_address,
        dropoff_address=trip.dropoff_address,
        fare=float(trip.fare or 0),
        distance_km=float(trip.distance_km or 0),
        payment_method=trip.payment_method,
    )


# ── POST /worker/trip/{id}/respond ───────────────────────────────────────────

@router.post("/trip/{trip_id}/respond")
@router_plural.post("/trip/{trip_id}/respond")
async def respond_to_trip(
    trip_id: str,
    payload: TripResponseSchema,
    current_user: User = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db),
):
    driver = await get_driver_from_user(current_user, db)
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    if str(trip.driver_id) != str(driver.id):
        raise HTTPException(status_code=403, detail="Este viaje no te pertenece")
    if trip.status != "pending":
        raise HTTPException(status_code=400,
                            detail=f"El viaje está en '{trip.status}', no se puede responder")

    if payload.action == "accept":
        trip.status = "assigned"
        new_status = "assigned"
    else:
        trip.status = "pending"
        trip.driver_id = None
        new_status = "pending"

    db.add(TripStatusHistory(trip_id=trip.id, status=new_status, changed_by=current_user.id))
    await db.commit()
    return {"action": payload.action, "trip_id": trip_id, "new_status": new_status}


# ── PATCH /worker/trip/{id}/status ───────────────────────────────────────────

@router.patch("/trip/{trip_id}/status")
@router_plural.patch("/trip/{trip_id}/status")
async def update_trip_status(
    trip_id: str,
    payload: TripStatusUpdateSchema,
    current_user: User = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db),
):
    driver = await get_driver_from_user(current_user, db)
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    if str(trip.driver_id) != str(driver.id):
        raise HTTPException(status_code=403, detail="Este viaje no te pertenece")

    valid_transitions = {
        "assigned":    ["picked_up", "cancelled"],
        "picked_up":   ["in_progress", "cancelled"],
        "in_progress": ["completed", "cancelled"],
    }
    if trip.status not in valid_transitions:
        raise HTTPException(status_code=400, detail=f"No se puede cambiar desde '{trip.status}'")
    if payload.status not in valid_transitions[trip.status]:
        raise HTTPException(status_code=400,
                            detail=f"Transición '{trip.status}' → '{payload.status}' no permitida")

    trip.status = payload.status
    if payload.notes:
        trip.notes = payload.notes
    if payload.status == "completed":
        driver.total_trips += 1
        trip.updated_at = datetime.now(UTC)

    db.add(TripStatusHistory(trip_id=trip.id, status=payload.status, changed_by=current_user.id))
    await db.commit()
    return {"trip_id": trip_id, "new_status": payload.status}


# ── GET /worker/trips ─────────────────────────────────────────────────────────

@router.get("/trips")
@router_plural.get("/trips")
async def get_worker_trips(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db),
):
    driver = await get_driver_from_user(current_user, db)
    result = await db.execute(
        select(Trip).where(Trip.driver_id == driver.id)
        .order_by(Trip.created_at.desc()).limit(limit).offset(offset)
    )
    trips = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "passenger_name": t.passenger_name,
            "pickup_address": t.pickup_address,
            "dropoff_address": t.dropoff_address,
            "status": t.status,
            "fare": float(t.fare or 0),
            "distance_km": float(t.distance_km or 0),
            "payment_method": t.payment_method,
            "rating": t.rating,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in trips
    ]
