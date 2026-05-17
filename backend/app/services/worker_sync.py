"""Service layer for user/driver synchronization.

Separates authentication logic from business logic.
The auth router should only verify credentials and return tokens.
Driver creation and User-Driver linking belongs here.
"""

from datetime import date
from typing import Optional
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import User
from app.models.drivers import Driver
from app.models.rankings import Ranking


async def get_driver_by_phone(db: AsyncSession, phone: str) -> Optional[Driver]:
    """Look up a driver by phone number."""
    result = await db.execute(select(Driver).where(Driver.phone == phone))
    return result.scalar_one_or_none()


async def get_user_by_phone(db: AsyncSession, phone: str, role: str = "worker") -> Optional[User]:
    """Look up a user by phone and role."""
    result = await db.execute(
        select(User).where(User.phone == phone, User.role == role)
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id) -> Optional[User]:
    """Look up a user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def link_driver_to_user(db: AsyncSession, driver: Driver) -> User:
    """
    If a Driver has no user_id, find a matching User (same phone, role=worker)
    and link them. Raises 403 if no matching User exists.
    """
    if driver.user_id:
        user = await get_user_by_id(db, driver.user_id)
        if user:
            return user

    # Try to find a matching user
    user = await get_user_by_phone(db, driver.phone, role="worker")
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este conductor no tiene cuenta de acceso. Contacta al administrador.",
        )

    driver.user_id = user.id
    await db.commit()
    await db.refresh(driver)
    return user


async def ensure_driver_for_user(db: AsyncSession, user: User) -> Driver:
    """
    Create a Driver record for a User that has role='worker' but no Driver.
    This handles the case where an admin created the user from the Users panel
    before the driver was registered in the Drivers panel.
    """
    # Check if driver already exists for this user
    existing = await db.execute(
        select(Driver).where(Driver.user_id == user.id)
    )
    driver = existing.scalar_one_or_none()
    if driver:
        return driver

    # Create a provisional driver record
    uid_hex = uuid.uuid4().hex[:8]
    new_driver = Driver(
        user_id=user.id,
        full_name=user.full_name,
        phone=user.phone,
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
        return new_driver
    except IntegrityError:
        await db.rollback()
        retry = await db.execute(
            select(Driver).where(Driver.user_id == user.id)
        )
        driver = retry.scalar_one_or_none()
        if not driver:
            raise HTTPException(
                status_code=500,
                detail="Error al crear perfil de conductor",
            )
        return driver


def build_worker_response(user: User, driver: Driver, access_token: str) -> dict:
    """Build the standardized response for worker login."""
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "driver_id": str(driver.id),
            "full_name": driver.full_name,
            "phone": driver.phone,
            "email": driver.email or user.email,
            "role": "worker",
            "rating": float(driver.rating or 5.0),
            "total_trips": driver.total_trips or 0,
            "profile_photo_url": driver.profile_photo_url,
        },
    }
