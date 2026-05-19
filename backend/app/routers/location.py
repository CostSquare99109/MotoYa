"""Router de ubicación en tiempo real via WebSocket.

Canales:
  ws://.../ws/location/{driver_id}?token=<jwt>   → conductor envía GPS / recibe notificaciones
  ws://.../ws/admin/locations?token=<jwt>         → admin recibe todas las posiciones + eventos
  ws://.../ws/trip/{trip_id}/track?token=<jwt>    → cliente sigue su viaje en tiempo real
"""

import asyncio
import contextlib
import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.models.driver_location import DriverLocation
from app.models.drivers import Driver
from app.models.trips import Trip
from app.models.users import User
from app.schemas.location import LocationUpdateSchema

router = APIRouter(tags=["location"])
settings = get_settings()


# ─────────────────────────────────────────────────────────────────────────────
# Connection Manager  (in-memory, sin Redis)
# ─────────────────────────────────────────────────────────────────────────────

class LocationConnectionManager:
    def __init__(self):
        self.drivers:       dict[str, WebSocket]        = {}   # driver_id → WS
        self.admins:        list[WebSocket]             = []   # admin viewers
        self.trip_watchers: dict[str, list[WebSocket]]  = {}   # trip_id → [WS]
        self.last_locations: dict[str, dict]            = {}   # driver_id → last payload

    # ── Drivers ──────────────────────────────────────────────────────────────

    async def connect_driver(self, driver_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.drivers[driver_id] = ws

    def disconnect_driver(self, driver_id: str) -> None:
        self.drivers.pop(driver_id, None)

    async def send_to_driver(self, driver_id: str, data: dict) -> bool:
        """Envía un mensaje directo al conductor (p.ej. nueva solicitud de viaje)."""
        ws = self.drivers.get(driver_id)
        if not ws:
            return False
        try:
            await ws.send_json(data)
            return True
        except Exception:
            self.disconnect_driver(driver_id)
            return False

    # ── Admins ────────────────────────────────────────────────────────────────

    async def connect_admin(self, ws: WebSocket) -> None:
        await ws.accept()
        self.admins.append(ws)
        if self.last_locations:
            payload = list(self.last_locations.values())
            with contextlib.suppress(Exception):
                await ws.send_json({"type": "snapshot", "data": payload})

    def disconnect_admin(self, ws: WebSocket) -> None:
        if ws in self.admins:
            self.admins.remove(ws)

    async def _broadcast_to_admins(self, message: dict) -> None:
        dead = []
        for ws in list(self.admins):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_admin(ws)

    # ── Trip watchers ─────────────────────────────────────────────────────────

    async def connect_trip_watcher(self, trip_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.trip_watchers.setdefault(trip_id, []).append(ws)

    def disconnect_trip_watcher(self, trip_id: str, ws: WebSocket) -> None:
        watchers = self.trip_watchers.get(trip_id, [])
        if ws in watchers:
            watchers.remove(ws)
        if not watchers:
            self.trip_watchers.pop(trip_id, None)

    async def broadcast_trip_event(self, trip_id: str, data: dict) -> None:
        """
        Envía un evento de viaje (asignación, cambio de estado, ETA…)
        a todos los clientes que hacen tracking de ese viaje Y a los admins.
        """
        watchers = self.trip_watchers.get(str(trip_id), [])
        dead = []
        for ws in list(watchers):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_trip_watcher(str(trip_id), ws)

        # También notificar a admins para que actualicen el panel
        await self._broadcast_to_admins(data)

    # ── Location broadcast ────────────────────────────────────────────────────

    async def broadcast_location(self, driver_id: str, location_data: dict) -> None:
        """Difunde posición GPS a admins y watchers del viaje activo."""
        self.last_locations[driver_id] = location_data
        message = {"type": "location_update", "data": location_data}

        await self._broadcast_to_admins(message)

        trip_id = location_data.get("trip_id")
        if trip_id:
            watchers = self.trip_watchers.get(trip_id, [])
            dead = []
            for ws in list(watchers):
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect_trip_watcher(trip_id, ws)

    async def broadcast_driver_offline(self, driver_id: str) -> None:
        if driver_id in self.last_locations:
            self.last_locations[driver_id]["is_online"] = False
        await self._broadcast_to_admins(
            {"type": "driver_offline", "data": {"driver_id": driver_id}}
        )


manager = LocationConnectionManager()


# ─────────────────────────────────────────────────────────────────────────────
# Auth helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _verify_token(token: str) -> str | None:
    """Verifica cualquier JWT y retorna user_id. No requiere campo 'type'."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# REST: GET /api/locations
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/locations")
async def get_all_locations(db: AsyncSession = Depends(get_db)):
    """Snapshot actual de todos los conductores online."""
    result = await db.execute(
        select(DriverLocation, Driver)
        .join(Driver, Driver.id == DriverLocation.driver_id)
        .where(DriverLocation.is_online.is_(True))
    )
    rows = result.all()
    return {
        "drivers": [
            {
                "driver_id":   str(loc.driver_id),
                "driver_name": drv.full_name,
                "latitude":    loc.latitude,
                "longitude":   loc.longitude,
                "bearing":     loc.bearing,
                "speed_kmh":   loc.speed_kmh,
                "is_online":   loc.is_online,
                "trip_id":     str(loc.trip_id) if loc.trip_id else None,
                "updated_at":  loc.updated_at.isoformat() if loc.updated_at else None,
            }
            for loc, drv in rows
        ],
        "total_online": len(rows),
    }


# ─────────────────────────────────────────────────────────────────────────────
# WS: /ws/location/{driver_id} — conductor envía GPS y recibe notificaciones
# ─────────────────────────────────────────────────────────────────────────────

@router.websocket("/ws/location/{driver_id}")
async def ws_driver_location(
    driver_id: str,
    websocket: WebSocket,
    token: str = Query(...),
):
    user_id = await _verify_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Token inválido")
        return

    async with AsyncSessionLocal() as db:
        driver_res = await db.execute(
            select(Driver).where(
                and_(Driver.id == driver_id, Driver.user_id == user_id)
            )
        )
        driver = driver_res.scalar_one_or_none()
        if not driver:
            admin_res = await db.execute(
                select(User).where(and_(User.id == user_id, User.role == "admin"))
            )
            if not admin_res.scalar_one_or_none():
                await websocket.close(code=4003, reason="No autorizado")
                return

    await manager.connect_driver(driver_id, websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                # El conductor puede enviar ubicación o ACKs de eventos
                if "latitude" not in data:
                    continue
                loc = LocationUpdateSchema(**data)
            except Exception:
                await websocket.send_json({"error": "Payload inválido"})
                continue

            async with AsyncSessionLocal() as db:
                res = await db.execute(
                    select(DriverLocation).where(DriverLocation.driver_id == driver_id)
                )
                existing = res.scalar_one_or_none()

                trip_res = await db.execute(
                    select(Trip).where(
                        and_(
                            Trip.driver_id == driver_id,
                            Trip.status.in_(["assigned", "picked_up", "in_progress"]),
                        )
                    ).limit(1)
                )
                active_trip = trip_res.scalar_one_or_none()

                drv_res = await db.execute(select(Driver).where(Driver.id == driver_id))
                drv = drv_res.scalar_one_or_none()

                if existing:
                    existing.latitude   = loc.latitude
                    existing.longitude  = loc.longitude
                    existing.bearing    = loc.bearing
                    existing.speed_kmh  = loc.speed_kmh
                    existing.accuracy_m = loc.accuracy_m
                    existing.is_online  = True
                    existing.trip_id    = active_trip.id if active_trip else None
                    existing.updated_at = datetime.now(UTC)
                else:
                    db.add(DriverLocation(
                        driver_id  = driver_id,
                        latitude   = loc.latitude,
                        longitude  = loc.longitude,
                        bearing    = loc.bearing,
                        speed_kmh  = loc.speed_kmh,
                        accuracy_m = loc.accuracy_m,
                        is_online  = True,
                        trip_id    = active_trip.id if active_trip else None,
                    ))
                await db.commit()

                broadcast_payload = {
                    "driver_id":   driver_id,
                    "driver_name": drv.full_name if drv else "Conductor",
                    "latitude":    loc.latitude,
                    "longitude":   loc.longitude,
                    "bearing":     loc.bearing,
                    "speed_kmh":   loc.speed_kmh,
                    "is_online":   True,
                    "trip_id":     str(active_trip.id) if active_trip else None,
 "updated_at": datetime.now(UTC).isoformat(),
                }

            await manager.broadcast_location(driver_id, broadcast_payload)
            await websocket.send_json({"ok": True})

    except WebSocketDisconnect:
        manager.disconnect_driver(driver_id)
        await manager.broadcast_driver_offline(driver_id)
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(DriverLocation).where(DriverLocation.driver_id == driver_id)
            )
            loc_rec = res.scalar_one_or_none()
            if loc_rec:
                loc_rec.is_online = False
                await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# WS: /ws/admin/locations — admin ve todo en tiempo real
# ─────────────────────────────────────────────────────────────────────────────

@router.websocket("/ws/admin/locations")
async def ws_admin_locations(
    websocket: WebSocket,
    token: str = Query(...),
):
    user_id = await _verify_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Token inválido")
        return

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.id == user_id))
        user = res.scalar_one_or_none()
        if not user or user.role not in ("admin", "dispatcher", "supervisor"):
            await websocket.close(code=4003, reason="No autorizado")
            return

    await manager.connect_admin(websocket)
    try:
        while True:
            await asyncio.sleep(25)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect_admin(websocket)


# ─────────────────────────────────────────────────────────────────────────────
# WS: /ws/trip/{trip_id}/track — cliente sigue su viaje
# ─────────────────────────────────────────────────────────────────────────────

@router.websocket("/ws/trip/{trip_id}/track")
async def ws_trip_track(
    trip_id: str,
    websocket: WebSocket,
    token: str = Query(...),
):
    """
    Canal WebSocket para que el cliente haga tracking de su viaje.
    Recibe:
      - location_update  → posición del conductor en tiempo real
      - trip_update      → cambios de estado (assigned, picked_up, completed…)
      - ping             → keepalive
    """
    user_id = await _verify_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Token inválido")
        return

    # Verificar que el user tiene acceso a este viaje
    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).where(User.id == user_id))
        user = user_res.scalar_one_or_none()

        trip_res = await db.execute(select(Trip).where(Trip.id == trip_id))
        trip = trip_res.scalar_one_or_none()

        if not user or not trip:
            await websocket.close(code=4003, reason="No autorizado")
            return

        # El cliente debe coincidir por teléfono O ser admin/dispatcher
        if user.role not in ("admin", "dispatcher", "supervisor"):
            if trip.passenger_phone and trip.passenger_phone != user.phone:
                await websocket.close(code=4003, reason="No autorizado")
                return

    await manager.connect_trip_watcher(trip_id, websocket)

    # Enviar estado actual del viaje al conectar
    async with AsyncSessionLocal() as db:
        trip_res = await db.execute(select(Trip).where(Trip.id == trip_id))
        trip = trip_res.scalar_one_or_none()
        if trip:
            driver_info = None
            if trip.driver_id:
                drv_res = await db.execute(
                    select(Driver).where(Driver.id == trip.driver_id)
                )
                drv = drv_res.scalar_one_or_none()
                if drv:
                    driver_info = {
                        "id":        str(drv.id),
                        "full_name": drv.full_name,
                        "phone":     drv.phone,
                        "rating":    float(drv.rating or 5.0),
                    }
            with contextlib.suppress(Exception):
                await websocket.send_json({
                    "type": "trip_update",
                    "trip": {
                        "id":              str(trip.id),
                        "status":          trip.status,
                        "pickup_address":  trip.pickup_address,
                        "dropoff_address": trip.dropoff_address,
                        "driver":          driver_info,
                    },
                })

    # Enviar última posición conocida del conductor
    if trip and trip.driver_id:
        last = manager.last_locations.get(str(trip.driver_id))
        if last:
            with contextlib.suppress(Exception):
                await websocket.send_json({"type": "location_update", "data": last})

    try:
        while True:
            await asyncio.sleep(25)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect_trip_watcher(trip_id, websocket)
