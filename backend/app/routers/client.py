"""Router para el rol Client (pasajero / solicitante de servicio).

Usa el modelo Client (tabla clients), distinto del modelo User (backoffice).
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.database import get_db
from app.models.clients import Client
from app.models.drivers import Driver
from app.models.driver_location import DriverLocation
from app.models.trips import Trip, TripStatusHistory
from app.config import get_settings
from app.schemas.client import (
    ClientRegisterSchema,
    ClientLoginSchema,
    ClientAuthResponseSchema,
    ClientProfileSchema,
    TripRequestSchema,
    ClientTripStatusSchema,
    TripRatingSchema,
)
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID

router = APIRouter(prefix="/client", tags=["client"])
settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
client_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/client/login", auto_error=False)


# ── Auth helpers del cliente ──────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_client_token(client_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    return jwt.encode(
        {"sub": client_id, "type": "client", "exp": expire},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


async def get_current_client(
    token: str = Depends(client_oauth2),
    db: AsyncSession = Depends(get_db),
) -> Client:
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "client":
            raise HTTPException(status_code=401, detail="Token inválido para cliente")
        client_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client or not client.is_active:
        raise HTTPException(status_code=401, detail="Cliente no encontrado")
    return client


# ── POST /client/register ─────────────────────────────────────────────────────

@router.post("/register", response_model=ClientAuthResponseSchema)
async def register_client(
    payload: ClientRegisterSchema,
    db: AsyncSession = Depends(get_db),
):
    # Verificar teléfono único
    result = await db.execute(
        select(Client).where(Client.phone == payload.phone)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El teléfono ya está registrado")

    # Verificar email único si se proveyó
    if payload.email:
        result = await db.execute(
            select(Client).where(Client.email == payload.email)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="El correo ya está registrado")

    client = Client(
        full_name=payload.full_name,
        phone=payload.phone,
        email=payload.email,
        password_hash=_hash_password(payload.password),
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)

    token = _create_client_token(str(client.id))
    return ClientAuthResponseSchema(
        access_token=token,
        client=ClientProfileSchema.from_orm(client),
    )


# ── POST /client/login ────────────────────────────────────────────────────────

@router.post("/login")
async def login_client(
    payload: ClientLoginSchema,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client).where(Client.phone == payload.phone)
    )
    client = result.scalar_one_or_none()

    if not client or not _verify_password(payload.password, client.password_hash):
        raise HTTPException(status_code=401, detail="Teléfono o contraseña incorrectos")
    if not client.is_active:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")

    token = _create_client_token(str(client.id))
    return {
        "access_token": token,
        "token_type": "bearer",
        "client": {
            "id": str(client.id),
            "full_name": client.full_name,
            "phone": client.phone,
            "email": client.email,
            "rating": float(client.rating or 5.0),
            "total_trips": client.total_trips,
            "wallet_balance": float(client.wallet_balance or 0),
        },
    }


# ── GET /client/me ────────────────────────────────────────────────────────────

@router.get("/me", response_model=ClientProfileSchema)
async def get_client_profile(
    client: Client = Depends(get_current_client),
):
    return ClientProfileSchema.from_orm(client)


# ── POST /client/trip/request — solicitar viaje ───────────────────────────────

@router.post("/trip/request")
async def request_trip(
    payload: TripRequestSchema,
    client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    # Verificar que no tenga un viaje activo
    result = await db.execute(
        select(Trip).where(
            and_(
                Trip.passenger_phone == client.phone,
                Trip.status.in_(["pending", "assigned", "picked_up", "in_progress"]),
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Ya tienes un viaje activo en curso"
        )

    # Calcular distancia aproximada (Haversine simple)
    from math import radians, cos, sin, asin, sqrt
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
        return 2 * R * asin(sqrt(a))

    distance_km = haversine(
        payload.pickup_lat, payload.pickup_lng,
        payload.dropoff_lat, payload.dropoff_lng,
    )

    # Tarifa base: 2000 COP base + 1500 COP/km
    fare = 2000 + (distance_km * 1500)

    # Buscar conductor online más cercano (por driver_locations)
    nearest_driver_result = await db.execute(
        select(DriverLocation).where(
            and_(
                DriverLocation.is_online == True,
                DriverLocation.trip_id.is_(None),
            )
        ).limit(1)
    )
    nearest_location = nearest_driver_result.scalar_one_or_none()
    driver_id = nearest_location.driver_id if nearest_location else None

    # Crear el viaje
    trip = Trip(
        driver_id=driver_id,
        passenger_name=client.full_name,
        passenger_phone=client.phone,
        pickup_location=ST_SetSRID(
            ST_MakePoint(payload.pickup_lng, payload.pickup_lat), 4326
        ),
        pickup_address=payload.pickup_address,
        dropoff_location=ST_SetSRID(
            ST_MakePoint(payload.dropoff_lng, payload.dropoff_lat), 4326
        ),
        dropoff_address=payload.dropoff_address,
        fare=round(fare, 2),
        commission=round(fare * 0.15, 2),
        distance_km=round(distance_km, 2),
        payment_method=payload.payment_method,
        notes=payload.notes,
        status="pending",
    )
    db.add(trip)

    if driver_id:
        # Asignar si hay conductor disponible
        trip.driver_id = driver_id
        history = TripStatusHistory(
            trip_id=trip.id,
            status="pending",
        )
        db.add(history)
        # Marcar conductor como ocupado
        nearest_location.trip_id = trip.id

    await db.commit()
    await db.refresh(trip)

    return {
        "trip_id": str(trip.id),
        "status": trip.status,
        "fare": float(trip.fare),
        "distance_km": float(trip.distance_km),
        "driver_assigned": driver_id is not None,
        "estimated_arrival_min": 5 if driver_id else None,
        "message": "Viaje solicitado. Un conductor será asignado pronto." if not driver_id
                   else "¡Conductor encontrado! Está en camino.",
    }


# ── GET /client/trip/{trip_id} — estado del viaje ────────────────────────────

@router.get("/trip/{trip_id}", response_model=ClientTripStatusSchema)
async def get_trip_status(
    trip_id: str,
    client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    if trip.passenger_phone != client.phone:
        raise HTTPException(status_code=403, detail="No autorizado")

    driver_name = driver_phone = driver_rating = driver_loc = None

    if trip.driver_id:
        driver_res = await db.execute(
            select(Driver).where(Driver.id == trip.driver_id)
        )
        driver = driver_res.scalar_one_or_none()
        if driver:
            driver_name = driver.full_name
            driver_phone = driver.phone
            driver_rating = float(driver.rating or 5.0)

        loc_res = await db.execute(
            select(DriverLocation).where(DriverLocation.driver_id == trip.driver_id)
        )
        loc = loc_res.scalar_one_or_none()
        if loc:
            driver_loc = {"lat": loc.latitude, "lng": loc.longitude}

    return ClientTripStatusSchema(
        id=str(trip.id),
        status=trip.status,
        pickup_address=trip.pickup_address,
        dropoff_address=trip.dropoff_address,
        fare=float(trip.fare) if trip.fare else None,
        distance_km=float(trip.distance_km) if trip.distance_km else None,
        payment_method=trip.payment_method,
        driver_name=driver_name,
        driver_phone=driver_phone,
        driver_rating=driver_rating,
        driver_location=driver_loc,
        created_at=trip.created_at,
        estimated_arrival_min=3,
    )


# ── GET /client/trips — historial ─────────────────────────────────────────────

@router.get("/trips")
async def get_client_trips(
    limit: int = 20,
    offset: int = 0,
    client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Trip)
        .where(Trip.passenger_phone == client.phone)
        .order_by(Trip.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    trips = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "pickup_address": t.pickup_address,
            "dropoff_address": t.dropoff_address,
            "status": t.status,
            "fare": float(t.fare) if t.fare else None,
            "distance_km": float(t.distance_km) if t.distance_km else None,
            "payment_method": t.payment_method,
            "rating": t.rating,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in trips
    ]


# ── POST /client/trip/{trip_id}/cancel — cancelar viaje ──────────────────────

@router.post("/trip/{trip_id}/cancel")
async def cancel_trip(
    trip_id: str,
    client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    if trip.passenger_phone != client.phone:
        raise HTTPException(status_code=403, detail="No autorizado")
    if trip.status not in ("pending", "assigned"):
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden cancelar viajes pendientes o asignados"
        )

    trip.status = "cancelled"
    history = TripStatusHistory(trip_id=trip.id, status="cancelled")
    db.add(history)
    await db.commit()

    return {"trip_id": trip_id, "status": "cancelled"}


# ── POST /client/trip/{trip_id}/rate — calificar ─────────────────────────────

@router.post("/trip/{trip_id}/rate")
async def rate_trip(
    trip_id: str,
    payload: TripRatingSchema,
    client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    if trip.passenger_phone != client.phone:
        raise HTTPException(status_code=403, detail="No autorizado")
    if trip.status != "completed":
        raise HTTPException(status_code=400, detail="Solo se pueden calificar viajes completados")
    if trip.rating:
        raise HTTPException(status_code=400, detail="Este viaje ya fue calificado")

    trip.rating = payload.rating

    # Actualizar rating promedio del conductor
    if trip.driver_id:
        driver_res = await db.execute(
            select(Driver).where(Driver.id == trip.driver_id)
        )
        driver = driver_res.scalar_one_or_none()
        if driver:
            avg_res = await db.execute(
                select(func.avg(Trip.rating)).where(
                    and_(
                        Trip.driver_id == driver.id,
                        Trip.rating.isnot(None),
                    )
                )
            )
            new_avg = avg_res.scalar() or payload.rating
            driver.rating = round(float(new_avg), 1)

    await db.commit()
    return {"trip_id": trip_id, "rating": payload.rating}
