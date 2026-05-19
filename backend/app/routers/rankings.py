"""Gamification and ranking router."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.drivers import Driver
from app.models.rankings import Ranking
from app.models.users import User
from app.routers.auth import get_current_user
from app.schemas.ranking import LeaderboardEntry, RankingResponse, TierConfig

router = APIRouter(prefix="/rankings", tags=["rankings"])

TIER_CONFIGS = [
    TierConfig(tier="bronze", min_points=0, commission_rate=0.15, benefits=["Acceso basico"]),
    TierConfig(tier="silver", min_points=500, commission_rate=0.12, benefits=["Comision reducida", "Soporte prioritario"]),
    TierConfig(tier="gold", min_points=1500, commission_rate=0.10, benefits=["Comision baja", "Despacho prioritario"]),
    TierConfig(tier="platinum", min_points=3000, commission_rate=0.08, benefits=["Comision minima", "Despacho VIP", "Bonificaciones"]),
]

BADGE_DEFINITIONS = {
    "primer_viaje": "Primer viaje completado",
    "100_viajes": "100 viajes completados",
    "500_viajes": "500 viajes completados",
    "rating_perfecto": "50 viajes con 5 estrellas",
    "streak_7": "7 dias consecutivos activo",
    "streak_30": "30 dias consecutivos activo",
    "aceptacion_90": "90% tasa de aceptacion",
    "rapido": "Promedio de respuesta < 2 min",
}


def get_tier_from_points(points: int) -> str:
    if points >= 3000:
        return "platinum"
    elif points >= 1500:
        return "gold"
    elif points >= 500:
        return "silver"
    return "bronze"


@router.get("", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get driver leaderboard sorted by points."""
    result = await db.execute(
        select(Ranking, Driver.full_name)
        .join(Driver, Ranking.driver_id == Driver.id)
        .order_by(desc(Ranking.points))
        .limit(limit)
    )

    entries = []
    rank = 1
    for ranking, driver_name in result.all():
        entries.append(LeaderboardEntry(
            rank=rank,
            driver_id=ranking.driver_id,
            driver_name=driver_name,
            tier=ranking.tier,
            points=ranking.points,
            monthly_trips=ranking.monthly_trips,
            rating_avg=float(ranking.rating_avg),
            badges=ranking.badges or []
        ))
        rank += 1

    return entries


@router.get("/{driver_id}", response_model=RankingResponse)
async def get_driver_ranking(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get ranking details for a specific driver."""
    result = await db.execute(
        select(Ranking).where(Ranking.driver_id == driver_id)
    )
    ranking = result.scalar_one_or_none()
    if not ranking:
        raise HTTPException(status_code=404, detail="Ranking no encontrado")

    # Get driver name
    name_result = await db.execute(
        select(Driver.full_name).where(Driver.id == driver_id)
    )
    driver_name = name_result.scalar()

    return RankingResponse(
        id=ranking.id,
        driver_id=ranking.driver_id,
        driver_name=driver_name,
        tier=ranking.tier,
        points=ranking.points,
        weekly_trips=ranking.weekly_trips,
        monthly_trips=ranking.monthly_trips,
        acceptance_rate=float(ranking.acceptance_rate),
        rating_avg=float(ranking.rating_avg),
        streak_days=ranking.streak_days,
        badges=ranking.badges or [],
        updated_at=ranking.updated_at
    )


@router.post("/recalculate")
async def recalculate_rankings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Recalculate all driver tiers and points."""
    result = await db.execute(select(Ranking))
    rankings = result.scalars().all()

    updated = 0
    for ranking in rankings:
        new_tier = get_tier_from_points(ranking.points)
        if ranking.tier != new_tier:
            ranking.tier = new_tier
            updated += 1

    await db.commit()
    return {"message": f"Rankings recalculados. {updated} tiers actualizados."}


@router.get("/tiers/config")
async def get_tier_config(
    _: User = Depends(get_current_user)
):
    """Get tier configuration and benefits."""
    return TIER_CONFIGS


@router.post("/add-points/{driver_id}")
async def add_points(
    driver_id: uuid.UUID,
    points: int,
    badge: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Add points to a driver (called after trip completion)."""
    result = await db.execute(
        select(Ranking).where(Ranking.driver_id == driver_id)
    )
    ranking = result.scalar_one_or_none()

    if not ranking:
        # Create new ranking
        ranking = Ranking(driver_id=driver_id, points=points)
        db.add(ranking)
    else:
        ranking.points += points
        ranking.monthly_trips += 1
        ranking.weekly_trips += 1

        # Add badge if provided
        if badge:
            existing = ranking.badges or []
            if badge not in existing:
                ranking.badges = [*existing, badge]

    # Recalculate tier
    ranking.tier = get_tier_from_points(ranking.points)

    await db.commit()
    return {
        "driver_id": str(driver_id),
        "points_added": points,
        "total_points": ranking.points,
        "tier": ranking.tier
    }
