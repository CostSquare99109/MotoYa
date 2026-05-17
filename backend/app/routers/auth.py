"""Authentication router for JWT token management.

This router handles ONLY authentication (verify credentials, return tokens).
Driver creation and User-Driver linking is delegated to services/worker_sync.py.
Rate limiting is applied to all auth endpoints to prevent brute-force attacks.
"""

from datetime import datetime, timedelta
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models.users import User
from app.models.drivers import Driver
from app.config import get_settings
from app.schemas.validators import validate_phone, validate_name
from app.services.worker_sync import (
    get_driver_by_phone,
    get_user_by_phone,
    get_user_by_id,
    link_driver_to_user,
    ensure_driver_for_user,
    build_worker_response,
)

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

# ── Failed login tracking (in-memory, per-process) ───────────────────────────
# For production, replace with Redis-backed store.
_login_attempts: dict[str, list[datetime]] = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _check_lockout(key: str) -> None:
    """Raise 429 if the key has exceeded MAX_FAILED_ATTEMPTS in LOCKOUT_MINUTES."""
    attempts = _login_attempts.get(key, [])
    cutoff = datetime.utcnow() - timedelta(minutes=LOCKOUT_MINUTES)
    attempts = [t for t in attempts if t > cutoff]
    _login_attempts[key] = attempts
    if len(attempts) >= MAX_FAILED_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Demasiados intentos fallidos. Intenta de nuevo en {LOCKOUT_MINUTES} minutos.",
        )


def _record_failed_attempt(key: str) -> None:
    """Record a failed login attempt for lockout tracking."""
    if key not in _login_attempts:
        _login_attempts[key] = []
    _login_attempts[key].append(datetime.utcnow())


def _clear_failed_attempts(key: str) -> None:
    """Clear failed attempts after a successful login."""
    _login_attempts.pop(key, None)


# ── Helpers ──────────────────────────────────────────────────────────────────

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


def _authenticate_user(user: User, password: str) -> None:
    """Verify password and active status. Raises HTTPException on failure."""
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada",
        )
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta",
        )


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
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Autenticación para admin y dispatcher. El campo 'username' es el email."""
    lockout_key = f"login:{form_data.username}"
    _check_lockout(lockout_key)

    result = await db.execute(
        select(User).where(User.email == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        _record_failed_attempt(lockout_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada",
        )

    _clear_failed_attempts(lockout_key)
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
@limiter.limit("5/minute")
async def worker_login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Autenticación para conductores (workers).
    El campo 'username' es el teléfono del conductor.
    Rate limited to 5 attempts/minute per IP.
    """
    phone = form_data.username.strip()
    lockout_key = f"worker:{phone}"
    _check_lockout(lockout_key)

    # ── Paso 1: Buscar Driver por teléfono ──────────────────────────────────
    driver = await get_driver_by_phone(db, phone)

    if driver:
        if driver.status not in ("active", "pending"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cuenta suspendida o inactiva (estado: {driver.status})",
            )

        user = await link_driver_to_user(db, driver)
        try:
            _authenticate_user(user, form_data.password)
        except HTTPException:
            _record_failed_attempt(lockout_key)
            raise

        _clear_failed_attempts(lockout_key)
        access_token = create_access_token({"sub": str(user.id)})
        return build_worker_response(user, driver, access_token)

    # ── Paso 2: Buscar User con role=worker ─────────────────────────────────
    user = await get_user_by_phone(db, phone, role="worker")

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe un conductor con ese número de teléfono",
        )

    try:
        _authenticate_user(user, form_data.password)
    except HTTPException:
        _record_failed_attempt(lockout_key)
        raise

    _clear_failed_attempts(lockout_key)
    driver = await ensure_driver_for_user(db, user)
    access_token = create_access_token({"sub": str(user.id)})
    return build_worker_response(user, driver, access_token)


# ── GET /auth/me ──────────────────────────────────────────────────────────────

@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    """Retorna la información del usuario actualmente autenticado."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "avatar_url": current_user.avatar_url,
    }


# ── POST /auth/client/quick-login — login exprés para pasajeros ──────────────

class ClientQuickLoginSchema(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=7, max_length=20)

    _validate_name = field_validator('full_name')(validate_name)
    _validate_phone = field_validator('phone')(validate_phone)


@router.post("/client/quick-login")
@limiter.limit("10/minute")
async def client_quick_login(
    request: Request,
    data: ClientQuickLoginSchema,
    db: AsyncSession = Depends(get_db),
):
    """
    Login / registro exprés para clientes (pasajeros).
    Solo requiere nombre y teléfono — sin OTP, sin contraseña.
    Rate limited to 10 attempts/minute per IP.
    """
    phone = data.phone.strip()
    name = data.full_name.strip()

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
            email=fake_email,
            password_hash=random_pwd,
            full_name=name,
            phone=phone,
            role="client",
            is_active=True,
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
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "full_name": user.full_name,
            "phone": user.phone,
            "role": "client",
        },
    }
