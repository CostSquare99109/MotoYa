"""Finance and earnings router."""

import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database import get_db
from app.models.finances import Earning
from app.models.drivers import Driver
from app.models.rankings import Ranking
from app.schemas.finance import EarningCreate, EarningResponse, FinanceSummary, DriverFinanceDetail
from app.routers.auth import get_current_user
from app.models.users import User

router = APIRouter(prefix="/finances", tags=["finances"])


@router.get("/summary", response_model=FinanceSummary)
async def get_finance_summary(
    period: Optional[str] = Query(None, description="YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get overall earnings summary."""
    if not period:
        period = datetime.utcnow().strftime("%Y-%m")

    result = await db.execute(
        select(
            func.coalesce(func.sum(Earning.gross_amount), 0).label("total_gross"),
            func.coalesce(func.sum(Earning.commission_amount), 0).label("total_commissions"),
            func.coalesce(func.sum(Earning.fuel_cost), 0).label("total_fuel"),
            func.coalesce(func.sum(Earning.net_amount), 0).label("total_net"),
            func.count(Earning.id).label("trip_count")
        ).where(Earning.period == period)
    )
    row = result.first()

    avg_per_trip = 0
    if row.trip_count > 0:
        avg_per_trip = round(float(row.total_net) / row.trip_count, 2)

    return FinanceSummary(
        total_gross=round(float(row.total_gross), 2),
        total_commissions=round(float(row.total_commissions), 2),
        total_fuel=round(float(row.total_fuel), 2),
        total_net=round(float(row.total_net), 2),
        trip_count=row.trip_count,
        avg_per_trip=avg_per_trip,
        period=period
    )


@router.get("/driver/{driver_id}", response_model=DriverFinanceDetail)
async def get_driver_finance(
    driver_id: uuid.UUID,
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get earnings breakdown for a specific driver."""
    if not period:
        period = datetime.utcnow().strftime("%Y-%m")

    # Get driver name
    driver_result = await db.execute(
        select(Driver.full_name).where(Driver.id == driver_id)
    )
    driver_name = driver_result.scalar()
    if not driver_name:
        raise HTTPException(status_code=404, detail="Driver not found")

    # Get earnings
    result = await db.execute(
        select(
            func.coalesce(func.sum(Earning.gross_amount), 0).label("gross"),
            func.coalesce(func.sum(Earning.commission_amount), 0).label("commission"),
            func.coalesce(func.sum(Earning.fuel_cost), 0).label("fuel"),
            func.coalesce(func.sum(Earning.net_amount), 0).label("net"),
            func.count(Earning.id).label("count")
        ).where(
            and_(Earning.driver_id == driver_id, Earning.period == period)
        )
    )
    row = result.first()

    # Get current tier
    tier_result = await db.execute(
        select(Ranking.tier).where(Ranking.driver_id == driver_id)
    )
    tier = tier_result.scalar() or "bronze"

    return DriverFinanceDetail(
        driver_id=driver_id,
        driver_name=driver_name,
        gross_amount=round(float(row.gross), 2),
        commission_amount=round(float(row.commission), 2),
        fuel_cost=round(float(row.fuel), 2),
        net_amount=round(float(row.net), 2),
        trip_count=row.count,
        current_tier=tier
    )


@router.post("/earnings", response_model=EarningResponse, status_code=201)
async def create_earning(
    data: EarningCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Record an earning entry with auto-calculated net amount."""
    # Auto-calculate commission based on tier
    tier_result = await db.execute(
        select(Ranking.tier).where(Ranking.driver_id == data.driver_id)
    )
    tier = tier_result.scalar() or "bronze"

    commission_rates = {"bronze": 0.15, "silver": 0.12, "gold": 0.10, "platinum": 0.08}
    rate = commission_rates.get(tier, 0.15)

    commission = data.gross_amount * rate
    net_amount = data.gross_amount - commission - data.fuel_cost

    period = datetime.utcnow().strftime("%Y-%m")

    earning = Earning(
        driver_id=data.driver_id,
        trip_id=data.trip_id,
        shipment_id=data.shipment_id,
        gross_amount=data.gross_amount,
        commission_amount=commission,
        fuel_cost=data.fuel_cost,
        net_amount=net_amount,
        period=period
    )
    db.add(earning)
    await db.commit()
    await db.refresh(earning)
    return earning


@router.get("/period", response_model=List[FinanceSummary])
async def get_period_report(
    start_period: str = Query(..., description="YYYY-MM"),
    end_period: str = Query(..., description="YYYY-MM"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get earnings report across multiple periods."""
    result = await db.execute(
        select(
            Earning.period,
            func.coalesce(func.sum(Earning.gross_amount), 0).label("gross"),
            func.coalesce(func.sum(Earning.commission_amount), 0).label("commission"),
            func.coalesce(func.sum(Earning.fuel_cost), 0).label("fuel"),
            func.coalesce(func.sum(Earning.net_amount), 0).label("net"),
            func.count(Earning.id).label("count")
        ).where(
            and_(Earning.period >= start_period, Earning.period <= end_period)
        ).group_by(Earning.period).order_by(Earning.period)
    )

    summaries = []
    for row in result.all():
        count = row.count
        net = float(row.net)
        summaries.append(FinanceSummary(
            total_gross=round(float(row.gross), 2),
            total_commissions=round(float(row.commission), 2),
            total_fuel=round(float(row.fuel), 2),
            total_net=round(net, 2),
            trip_count=count,
            avg_per_trip=round(net / count, 2) if count > 0 else 0,
            period=row.period
        ))

    return summaries
