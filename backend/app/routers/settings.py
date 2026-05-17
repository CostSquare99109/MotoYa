"""Settings router - GET and PUT platform configuration stored in PostgreSQL."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.settings import PlatformSettings
from app.schemas.settings import PlatformSettingsIn, PlatformSettingsOut
from app.routers.auth import get_current_admin

router = APIRouter(prefix="/settings", tags=["settings"])

# Valores por defecto
DEFAULT_GENERAL = {
    "platformName": "MotoYa",
    "city": "Carepa",
    "department": "Antioquia",
    "timezone": "america_bogota",
    "currency": "cop",
    "darkMode": False,
}
DEFAULT_NOTIFICATIONS = {
    "newTrips": True,
    "emergencies": True,
    "maintenance": True,
    "dailyReports": False,
}
DEFAULT_SECURITY = {
    "selfieValidation": True,
    "emergencyStream": True,
}
DEFAULT_DISPATCH = {
    "searchRadius": 3,
    "maxResponseTime": 5,
    "autoAssign": True,
    "voiceCommands": True,
}


async def _get_or_create(db: AsyncSession) -> PlatformSettings:
    """Obtiene la fila de settings o la crea con valores por defecto."""
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.key == "global")
    )
    row = result.scalar_one_or_none()
    if not row:
        row = PlatformSettings(
            key="global",
            general=DEFAULT_GENERAL,
            notifications=DEFAULT_NOTIFICATIONS,
            security=DEFAULT_SECURITY,
            dispatch=DEFAULT_DISPATCH,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("", response_model=PlatformSettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Devuelve la configuración actual de la plataforma."""
    row = await _get_or_create(db)
    return PlatformSettingsOut(
        general=row.general,
        notifications=row.notifications,
        security=row.security,
        dispatch=row.dispatch,
    )


@router.put("", response_model=PlatformSettingsOut)
async def update_settings(
    payload: PlatformSettingsIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Guarda la configuración de la plataforma en la base de datos."""
    row = await _get_or_create(db)

    # General
    row.general = payload.general.model_dump()

    # Notificaciones
    row.notifications = payload.notifications.model_dump()

    # Seguridad
    row.security = payload.security.model_dump()

    # Despacho
    row.dispatch = payload.dispatch.model_dump()

    row.updated_by = current_user.id

    # SQLAlchemy JSONB necesita flag_modified para detectar cambios en dicts
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(row, "general")
    flag_modified(row, "notifications")
    flag_modified(row, "security")
    flag_modified(row, "dispatch")

    await db.commit()
    await db.refresh(row)

    return PlatformSettingsOut(
        general=row.general,
        notifications=row.notifications,
        security=row.security,
        dispatch=row.dispatch,
    )
