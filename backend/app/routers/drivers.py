"""Driver CRUD router with selfie upload support."""

import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.drivers import Driver, DriverSelfie
from app.models.rankings import Ranking
from app.models.users import User
from app.routers.auth import get_current_admin, get_current_user, get_password_hash
from app.schemas.driver import DriverCreate, DriverLocationUpdate, DriverResponse, DriverUpdate

router = APIRouter(prefix="/drivers", tags=["drivers"])
settings = get_settings()

_ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def _ensure_upload_dir():
    """Crea el directorio de uploads solo cuando se necesita."""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


# ── GET /drivers ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[DriverResponse])
async def list_drivers(
    status: str | None = Query(None),
    is_online: bool | None = Query(None),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    # ✅ limit ampliado a 500 — LiveMap pedía 200 y recibía 422
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Driver)
    filters = []
    if status:
        filters.append(Driver.status == status)
    if is_online is not None:
        filters.append(Driver.is_online == is_online)
    if search:
        filters.append(or_(
            Driver.full_name.ilike(f"%{search}%"),
            Driver.phone.ilike(f"%{search}%"),
            Driver.document_id.ilike(f"%{search}%"),
        ))
    if filters:
        query = query.where(and_(*filters))
    query = query.order_by(Driver.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ── POST /drivers ─────────────────────────────────────────────────────────────

@router.post("", response_model=DriverResponse, status_code=201)
async def create_driver(
    data: DriverCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """
    Registra un nuevo conductor Y crea su cuenta de acceso (User) automáticamente.

    - Si se envía `password` se usa esa contraseña.
    - Si no se envía, se genera: 'motoya' + últimos 4 dígitos del teléfono.
      Ejemplo: teléfono 3001234567 → contraseña 'motoya4567'
    """
    # ── Verificar duplicados ──────────────────────────────────────────────────
    if (await db.execute(select(Driver).where(Driver.document_id == data.document_id))).scalar_one_or_none():
        raise HTTPException(409, detail=f"Ya existe un conductor con cédula {data.document_id}")

    if (await db.execute(select(Driver).where(Driver.phone == data.phone))).scalar_one_or_none():
        raise HTTPException(409, detail=f"Ya existe un conductor con teléfono {data.phone}")

    # ── Calcular contraseña ───────────────────────────────────────────────────
    raw_password = data.password or f"motoya{data.phone[-4:]}"

    # ── Crear User vinculado ──────────────────────────────────────────────────
    # Email: usa el del conductor si tiene, o genera uno interno no-colisionable
    email = data.email or f"driver_{data.phone}@motoya.local"

    # Si ya existe un User con ese email lo reutilizamos
    existing_user = (await db.execute(
        select(User).where(User.email == email)
    )).scalar_one_or_none()

    if existing_user:
        user = existing_user
        # Actualizar contraseña con la nueva
        user.password_hash = get_password_hash(raw_password)
    else:
        user = User(
            id=uuid.uuid4(),
            full_name=data.full_name,
            email=email,
            password_hash=get_password_hash(raw_password),
            role="worker",
            is_active=True,
        )
        db.add(user)

    await db.flush()  # obtener user.id antes de asignarlo al driver

    # ── Crear Driver ──────────────────────────────────────────────────────────
    driver_data = data.model_dump(exclude={"password"})
    driver = Driver(**driver_data, user_id=user.id)
    db.add(driver)

    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        err = str(e.orig).lower()
        if "document_id" in err:
            raise HTTPException(409, detail=f"Cédula {data.document_id} ya registrada")
        if "phone" in err:
            raise HTTPException(409, detail=f"Teléfono {data.phone} ya registrado")
        if "email" in err:
            raise HTTPException(409, detail=f"Email {data.email} ya registrado")
        raise HTTPException(409, detail="Datos duplicados — verifica cédula, teléfono o email")

    # ── Crear ranking inicial ─────────────────────────────────────────────────
    db.add(Ranking(driver_id=driver.id))

    await db.commit()
    await db.refresh(driver)

    # Log para el admin (visible en consola del servidor)
    print(f"✅ Conductor creado: {driver.full_name} | Tel: {driver.phone} | Pass: {raw_password}")

    return driver


# ── GET /drivers/{id} ─────────────────────────────────────────────────────────

@router.get("/{driver_id}", response_model=DriverResponse)
async def get_driver(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(404, detail="Conductor no encontrado")
    return driver


# ── PUT /drivers/{id} ────────────────────────────────────────────────────────

@router.put("/{driver_id}", response_model=DriverResponse)
async def update_driver(
    driver_id: uuid.UUID,
    data: DriverUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(404, detail="Conductor no encontrado")

    update_data = data.model_dump(exclude_unset=True, exclude={"password"})
    for field, value in update_data.items():
        setattr(driver, field, value)

    # ✅ Si se envía nueva contraseña, actualizar también el User vinculado
    if data.password and driver.user_id:
        user_result = await db.execute(select(User).where(User.id == driver.user_id))
        user = user_result.scalar_one_or_none()
        if user:
            user.password_hash = get_password_hash(data.password)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        err = str(e.orig).lower()
        if "document_id" in err:
            raise HTTPException(409, detail="Cédula ya registrada en otro conductor")
        if "phone" in err:
            raise HTTPException(409, detail="Teléfono ya registrado en otro conductor")
        raise HTTPException(409, detail="Datos duplicados")

    await db.refresh(driver)
    return driver


# ── DELETE /drivers/{id} ──────────────────────────────────────────────────────

@router.delete("/{driver_id}")
async def delete_driver(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(404, detail="Conductor no encontrado")
    driver.status = "inactive"
    driver.is_online = False
    await db.commit()
    return {"message": "Conductor desactivado"}


# ── POST /drivers/{id}/selfie ─────────────────────────────────────────────────

@router.post("/{driver_id}/selfie")
async def upload_selfie(
    driver_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _ensure_upload_dir()
    result = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(404, detail="Conductor no encontrado")

    file_ext = (os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg").lower()
    if file_ext not in _ALLOWED_IMAGE_EXT:
        raise HTTPException(400, detail=f"Extensión no permitida: {file_ext}. Use: {', '.join(sorted(_ALLOWED_IMAGE_EXT))}")
    filename = f"selfie_{driver_id}_{uuid.uuid4().hex}{file_ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    selfie = DriverSelfie(
        driver_id=driver_id,
        selfie_url=f"/uploads/{filename}",
        validation_status="pending",
    )
    db.add(selfie)
    await db.commit()
    return {"selfie_url": f"/uploads/{filename}", "validation_status": "pending"}


# ── PATCH /drivers/{id}/location ──────────────────────────────────────────────

@router.patch("/{driver_id}/location")
async def update_location(
    driver_id: uuid.UUID,
    data: DriverLocationUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(404, detail="Conductor no encontrado")

    from geoalchemy2 import WKTElement
    driver.current_location = WKTElement(
        f"POINT({data.longitude} {data.latitude})", srid=4326
    )
    driver.last_seen = func.now()
    await db.commit()
    return {"message": "Ubicación actualizada"}


# ── GET /drivers/{id}/selfies ─────────────────────────────────────────────────

@router.get("/{driver_id}/selfies")
async def get_selfies(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DriverSelfie)
        .where(DriverSelfie.driver_id == driver_id)
        .order_by(DriverSelfie.captured_at.desc())
    )
    return result.scalars().all()
