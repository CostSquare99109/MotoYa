"""Dispatch engine — asignación manual, automática y notificaciones en tiempo real."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2 import WKTElement
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.drivers import Driver
from app.models.trips import Trip, TripStatusHistory
from app.models.users import User
from app.routers.auth import get_current_user
from app.schemas.driver import NearbyDriverQuery, NearbyDriverResponse

router = APIRouter(prefix="/dispatch", tags=["dispatch"])

# Import lazy para evitar circular imports
def _get_manager():
    from app.routers.location import manager
    return manager


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _build_trip_payload(trip: Trip, driver: Driver | None) -> dict:
    return {
        "type": "trip_update",
        "trip": {
            "id":              str(trip.id),
            "status":          trip.status,
            "pickup_address":  trip.pickup_address,
            "dropoff_address": trip.dropoff_address,
            "payment_method":  trip.payment_method,
            "driver": {
                "id":        str(driver.id),
                "full_name": driver.full_name,
                "phone":     driver.phone,
                "rating":    float(driver.rating or 5.0),
            } if driver else None,
        },
    }


async def _build_trip_request_payload(trip: Trip) -> dict:
    """Payload que se envía al conductor cuando le asignan un viaje."""
    return {
        "type": "trip_request",
        "trip": {
            "id":              str(trip.id),
            "passenger_name":  trip.passenger_name,
            "passenger_phone": trip.passenger_phone,
            "pickup_address":  trip.pickup_address,
            "dropoff_address": trip.dropoff_address,
            "payment_method":  trip.payment_method,
            "notes":           trip.notes,
        },
    }


# ── POST /dispatch/nearby ─────────────────────────────────────────────────────

@router.post("/nearby", response_model=list[NearbyDriverResponse])
async def find_nearby_drivers(
    query: NearbyDriverQuery,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Conductores disponibles en radio (default 3 km)."""
    point        = WKTElement(f"POINT({query.longitude} {query.latitude})", srid=4326)
    distance_col = func.ST_Distance(Driver.current_location, point).label("distance_meters")

    stmt = (
        select(Driver, distance_col)
        .where(
            and_(
                Driver.is_online.is_(True),
                Driver.status == "active",
                func.ST_DWithin(Driver.current_location, point, query.radius_km * 1000),
            )
        )
        .order_by(distance_col)
        .limit(query.limit)
    )
    rows = (await db.execute(stmt)).all()

    drivers = []
    for driver, distance in rows:
        loc_result = await db.execute(
            select(func.ST_X(driver.current_location), func.ST_Y(driver.current_location))
        )
        lng, lat = loc_result.first()
        drivers.append(
            NearbyDriverResponse(
                id=driver.id,
                full_name=driver.full_name,
                phone=driver.phone,
                status=driver.status,
                is_online=driver.is_online,
                rating=float(driver.rating),
                distance_meters=round(float(distance), 1),
                current_location={"lat": float(lat), "lng": float(lng)},
            )
        )
    return drivers


# ── POST /dispatch/assign ─────────────────────────────────────────────────────

@router.post("/assign")
async def assign_trip(
    trip_id:   uuid.UUID,
    driver_id: uuid.UUID,
    db:        AsyncSession = Depends(get_db),
    user:      User         = Depends(get_current_user),
):
    """
    Asignación manual desde el panel admin.
    1. Guarda en BD
    2. Notifica al cliente (ws/trip/{id}/track) via trip_update
    3. Notifica al conductor (ws/location/{driver_id}) via trip_request
    """
    trip_res = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip     = trip_res.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    if trip.status not in ("pending",):
        raise HTTPException(status_code=400, detail=f"El viaje ya está en estado '{trip.status}'")

    driver_res = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver     = driver_res.scalar_one_or_none()
    if not driver or not driver.is_online:
        raise HTTPException(status_code=400, detail="Conductor no disponible u offline")

    trip.driver_id = driver_id
    trip.status    = "assigned"
    db.add(TripStatusHistory(trip_id=trip_id, status="assigned", changed_by=user.id))
    await db.commit()
    await db.refresh(trip)

    # ── Notificaciones WebSocket ──────────────────────────────────────────────
    mgr = _get_manager()

    # 1. Notificar al cliente que sigue el viaje
    await mgr.broadcast_trip_event(str(trip_id), await _build_trip_payload(trip, driver))

    # 2. Notificar al conductor (modal de aceptar/rechazar)
    driver_notified = await mgr.send_to_driver(str(driver_id), await _build_trip_request_payload(trip))

    return {
        "message":          "Viaje asignado",
        "trip_id":          str(trip_id),
        "driver_id":        str(driver_id),
        "driver_name":      driver.full_name,
        "driver_notified":  driver_notified,   # True si el conductor está online en WS
    }


# ── POST /dispatch/auto ───────────────────────────────────────────────────────

@router.post("/auto")
async def auto_assign(
    trip_id: uuid.UUID,
    db:      AsyncSession = Depends(get_db),
    user:    User         = Depends(get_current_user),
):
    """
    Auto-asignación al conductor disponible más cercano (radio 5 km).
    Si el más cercano está ocupado, prueba el siguiente (hasta 10).
    """
    trip_res = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip     = trip_res.scalar_one_or_none()
    if not trip or trip.status != "pending":
        raise HTTPException(status_code=400, detail="El viaje no está disponible para asignación")

    pickup_coords = await db.execute(
        select(func.ST_X(trip.pickup_location), func.ST_Y(trip.pickup_location))
    )
    pickup_lng, pickup_lat = pickup_coords.first()

    point        = WKTElement(f"POINT({pickup_lng} {pickup_lat})", srid=4326)
    distance_col = func.ST_Distance(Driver.current_location, point).label("dist")

    stmt = (
        select(Driver, distance_col)
        .where(
            and_(
                Driver.is_online.is_(True),
                Driver.status    == "active",
                func.ST_DWithin(Driver.current_location, point, 5_000),
            )
        )
        .order_by(distance_col)
        .limit(10)
    )
    rows = (await db.execute(stmt)).all()

    assigned_driver = None
    for driver, _dist in rows:
        busy = await db.execute(
            select(Trip.id).where(
                and_(
                    Trip.driver_id == driver.id,
                    Trip.status.in_(["pending", "assigned", "in_progress", "en_route", "picked_up"]),
                )
            ).limit(1)
        )
        if busy.scalar_one_or_none():
            continue
        assigned_driver = driver
        break

    if not assigned_driver:
        raise HTTPException(status_code=404, detail="Sin conductores disponibles en 5 km")

    trip.driver_id = assigned_driver.id
    trip.status    = "assigned"
    db.add(TripStatusHistory(trip_id=trip_id, status="assigned (auto)", changed_by=user.id))
    await db.commit()
    await db.refresh(trip)

    # ── Notificaciones WebSocket ──────────────────────────────────────────────
    mgr = _get_manager()
    await mgr.broadcast_trip_event(str(trip_id), await _build_trip_payload(trip, assigned_driver))
    driver_notified = await mgr.send_to_driver(
        str(assigned_driver.id), await _build_trip_request_payload(trip)
    )

    return {
        "message":         "Viaje auto-asignado",
        "trip_id":         str(trip_id),
        "driver_id":       str(assigned_driver.id),
        "driver_name":     assigned_driver.full_name,
        "driver_notified": driver_notified,
    }


# ── GET /dispatch/heatmap ─────────────────────────────────────────────────────

@router.get("/heatmap")
async def get_heatmap_data(
    db: AsyncSession = Depends(get_db),
    _:  User         = Depends(get_current_user),
):
    result = await db.execute(
        select(
            func.ST_X(Trip.pickup_location).label("lng"),
            func.ST_Y(Trip.pickup_location).label("lat"),
            func.count(Trip.id).label("count"),
        )
        .where(Trip.status == "pending")
        .group_by(Trip.pickup_location)
    )
    heat_points = [
        {"lat": float(r.lat), "lng": float(r.lng), "intensity": int(r.count)}
        for r in result.all()
    ]

    drivers_result = await db.execute(
        select(
            func.ST_X(Driver.current_location).label("lng"),
            func.ST_Y(Driver.current_location).label("lat"),
        ).where(and_(Driver.is_online.is_(True), Driver.status == "active"))
    )
    driver_points = [
        {"lat": float(r.lat), "lng": float(r.lng)}
        for r in drivers_result.all()
    ]

    return {
        "demand_zones":    heat_points,
        "active_drivers":  driver_points,
        "total_pending":   len(heat_points),
        "total_active":    len(driver_points),
    }
