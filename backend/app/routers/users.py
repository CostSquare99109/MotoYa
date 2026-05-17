"""Users CRUD router — admin backoffice."""

import uuid
from typing import List, Optional
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from app.database import get_db
from app.models.users import User
from app.models.drivers import Driver
from app.models.rankings import Ranking
from app.routers.auth import get_current_admin, get_password_hash

router = APIRouter(prefix="/users", tags=["users"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class UserResponseOut(BaseModel):
    id: uuid.UUID
    email: Optional[str] = None
    full_name: str
    # ✅ FIX #3a: phone incluido en la respuesta — antes el frontend
    #             recibía phone=undefined y el campo aparecía vacío al editar
    phone: Optional[str] = None
    role: str
    status: str
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, u: User) -> "UserResponseOut":
        return cls(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            phone=u.phone,           # ← devuelve el teléfono real
            role=u.role,
            status="active" if u.is_active else "suspended",
            avatar_url=u.avatar_url,
            created_at=u.created_at or datetime.utcnow(),
        )


class UserCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None      # ✅ FIX #3b: ya no se ignora
    role: str = "client"
    status: str = "active"
    password: str = "motoya1234"


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    # ✅ FIX #3c: phone en el schema de update — antes no existía
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[UserResponseOut])
async def list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    query = select(User)
    if search:
        query = query.where(or_(
            User.full_name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
        ))
    if role:
        query = query.where(User.role == role)
    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()
    return [UserResponseOut.from_user(u) for u in users]


@router.post("", response_model=UserResponseOut, status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    if data.role in ("admin", "worker") and not data.email:
        raise HTTPException(400, detail="El email es obligatorio para este rol")

    if data.email:
        existing = await db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(409, detail=f"El email {data.email} ya está registrado")

    password = data.password or "motoya1234"
    user = User(
        full_name=data.full_name,
        email=data.email or f"user_{uuid.uuid4().hex[:8]}@motoya.local",
        password_hash=get_password_hash(password),
        phone=data.phone or None,    # ✅ FIX #3d: se guarda el teléfono
        role=data.role,
        is_active=(data.status != "suspended"),
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, detail="Email duplicado")

    # ✅ FIX #4: si el rol es "worker", crear automáticamente un registro
    # en la tabla drivers para que aparezca en el panel Conductores.
    # IMPORTANTE: Conductores y Usuarios son paneles separados con tablas
    # separadas (drivers vs users). Al crear un worker desde Usuarios hay
    # que sincronizar ambas tablas.
    if data.role == "worker":
        phone = data.phone or f"0000{uuid.uuid4().hex[:6]}"

        existing_driver = (await db.execute(
            select(Driver).where(Driver.phone == phone)
        )).scalar_one_or_none()

        if not existing_driver:
            uid_hex = uuid.uuid4().hex[:8]
            driver = Driver(
                user_id=user.id,
                full_name=data.full_name,
                phone=phone,
                email=data.email or f"driver_{phone}@motoya.local",
                # Placeholders — el admin los completa desde el panel Conductores
                document_id=f"PEND-{uid_hex}",
                license_number=f"PEND-{uid_hex}",
                license_expiry=date.today(),
                status="pending",
                is_online=False,
            )
            db.add(driver)
            await db.flush()
            db.add(Ranking(driver_id=driver.id))
        else:
            # ✅ FIX #5: Si ya existe un Driver con ese teléfono pero sin user_id
            # vinculado, enlazarlo con el nuevo usuario para que pueda iniciar sesión.
            if not existing_driver.user_id:
                existing_driver.user_id = user.id

    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, detail="Error al crear usuario — verifica los datos")

    return UserResponseOut.from_user(user)


@router.patch("/{user_id}", response_model=UserResponseOut)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, detail="Usuario no encontrado")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        user.email = data.email
    # ✅ FIX #3e: actualizar phone en la tabla users
    if data.phone is not None:
        user.phone = data.phone
    if data.role is not None:
        user.role = data.role
    if data.status is not None:
        user.is_active = (data.status == "active")
    if data.password:
        user.password_hash = get_password_hash(data.password)

    # ✅ FIX #4b: sincronizar nombre/teléfono en el Driver vinculado si existe
    driver_result = await db.execute(
        select(Driver).where(Driver.user_id == user_id)
    )
    linked_driver = driver_result.scalar_one_or_none()
    if linked_driver:
        if data.full_name is not None:
            linked_driver.full_name = data.full_name
        if data.phone is not None:
            linked_driver.phone = data.phone
        if data.status == "suspended":
            linked_driver.status = "inactive"
        elif data.status == "active" and linked_driver.status == "inactive":
            linked_driver.status = "active"

    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, detail="Email ya en uso por otro usuario")

    return UserResponseOut.from_user(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if str(user_id) == str(admin.id):
        raise HTTPException(400, detail="No puedes eliminar tu propia cuenta")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, detail="Usuario no encontrado")

    await db.delete(user)
    await db.commit()
    return {"message": "Usuario eliminado"}
