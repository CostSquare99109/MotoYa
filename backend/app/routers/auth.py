"""Authentication router for JWT token management."""

from datetime import datetime, timedelta, date
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.users import User
from app.models.drivers import Driver
from app.models.rankings import Ranking
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── POST /auth/login — login admin/dispatcher (por email) ────────────────────

@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Autenticación para admin y dispatcher. El campo 'username' es el email."""
    result = await db.execute(
        select(User).where(User.email == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada",
        )

    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
    }


# ── POST /auth/worker/login — login conductores (por teléfono) ────────────────

@router.post("/worker/login")
async def worker_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Autenticación para conductores (workers).

    El campo 'username' es el teléfono del conductor.

    Flujo:
      1. Busca en la tabla drivers por teléfono  →  flujo completo con driver_id.
      2. Si no hay Driver, busca en users por teléfono + role='worker'
         (conductores creados desde el panel Usuarios antes de tener Driver).
         En ese caso crea el registro Driver automáticamente para sincronizar.
    """
    phone = form_data.username.strip()

    # ── CASO 1: conductor con registro en drivers ────────────────────────────
    driver_result = await db.execute(
        select(Driver).where(Driver.phone == phone)
    )
    driver = driver_result.scalar_one_or_none()

    if driver:
        if not driver.user_id:
            link_result = await db.execute(
                select(User).where(
                    User.phone == phone,
                    User.role == "worker",
                )
            )
            link_user = link_result.scalar_one_or_none()
            if link_user:
                driver.user_id = link_user.id
                await db.commit()
                await db.refresh(driver)
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Este conductor no tiene cuenta de acceso. Contacta al administrador.",
                )

        if driver.status not in ("active", "pending"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cuenta suspendida o inactiva (estado: {driver.status})",
            )

        user_result = await db.execute(
            select(User).where(User.id == driver.user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cuenta de usuario no encontrada. Contacta al administrador.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cuenta desactivada",
            )

        if not verify_password(form_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Contraseña incorrecta",
            )

        access_token = create_access_token({"sub": str(user.id)})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id":               str(user.id),
                "driver_id":        str(driver.id),
                "full_name":        driver.full_name,
                "phone":            driver.phone,
                "email":            driver.email or user.email,
                "role":             "worker",
                "rating":           float(driver.rating or 5.0),
                "total_trips":      driver.total_trips or 0,
                "profile_photo_url": driver.profile_photo_url,
            },
        }

    # ── CASO 2: conductor creado desde Usuarios ──────────────────────────────
    user_result = await db.execute(
        select(User).where(
            User.phone == phone,
            User.role == "worker",
        )
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe un conductor con ese número de teléfono",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada",
        )

    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta",
        )

    uid_hex = uuid.uuid4().hex[:8]
    new_driver = Driver(
        user_id=user.id,
        full_name=user.full_name,
        phone=phone,
        email=user.email,
        document_id=f"PEND-{uid_hex}",
        license_number=f"PEND-{uid_hex}",
        license_expiry=date.today(),
        status="active",
        is_online=False,
    )
    db.add(new_driver)
    try:
        await db.flush()
        db.add(Ranking(driver_id=new_driver.id))
        await db.commit()
        await db.refresh(new_driver)
    except IntegrityError:
        await db.rollback()
        driver_retry = await db.execute(
            select(Driver).where(Driver.user_id == user.id)
        )
        new_driver = driver_retry.scalar_one_or_none()
        if not new_driver:
            raise HTTPException(500, detail="Error al crear perfil de conductor")

    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id":               str(user.id),
            "driver_id":        str(new_driver.id),
            "full_name":        new_driver.full_name,
            "phone":            phone,
            "email":            user.email,
            "role":             "worker",
            "rating":           float(new_driver.rating or 5.0),
            "total_trips":      new_driver.total_trips or 0,
            "profile_photo_url": user.avatar_url,
        },
    }


# ── GET /auth/me ──────────────────────────────────────────────────────────────

@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    """Retorna la información del usuario actualmente autenticado."""
    return {
        "id":         str(current_user.id),
        "email":      current_user.email,
        "full_name":  current_user.full_name,
        "role":       current_user.role,
        "avatar_url": current_user.avatar_url,
    }


# ── POST /auth/client/quick-login — login exprés para pasajeros ──────────────

class ClientQuickLoginSchema(BaseModel):
    full_name: str
    phone: str


@router.post("/client/quick-login")
async def client_quick_login(
    data: ClientQuickLoginSchema,
    db: AsyncSession = Depends(get_db),
):
    """
    Login / registro exprés para clientes (pasajeros).
    Solo requiere nombre y teléfono — sin OTP, sin contraseña.

    Flujo:
      1. Busca User con phone == data.phone y role == 'client'.
      2. Si existe → actualiza nombre si cambió → devuelve token.
      3. Si no existe → crea User con role='client' y contraseña aleatoria
         (el cliente nunca la usa) → devuelve token.
    """
    phone = data.phone.strip()
    name  = data.full_name.strip()

    # ── 1. Buscar usuario existente ──────────────────────────────────────────
    result = await db.execute(
        select(User).where(User.phone == phone, User.role == "client")
    )
    user = result.scalar_one_or_none()

    if user:
        if user.full_name != name:
            user.full_name = name
            await db.commit()
            await db.refresh(user)
    else:
        # ── 2. Crear cliente nuevo ───────────────────────────────────────────
        fake_email = f"{phone.replace('+', '')}@motoya.client"
        random_pwd = get_password_hash(uuid.uuid4().hex)

        user = User(
            email         = fake_email,
            password_hash = random_pwd,
            full_name     = name,
            phone         = phone,
            role          = "client",
            is_active     = True,
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except IntegrityError:
            await db.rollback()
            retry = await db.execute(
                select(User).where(User.phone == phone, User.role == "client")
            )
            user = retry.scalar_one_or_none()
            if not user:
                raise HTTPException(status_code=500, detail="Error al crear cliente")

    # ── 3. Generar token ─────────────────────────────────────────────────────
    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type":   "bearer",
        "user": {
            "id":        str(user.id),
            "full_name": user.full_name,
            "phone":     user.phone,
            "role":      "client",
        },
    }
