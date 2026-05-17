"""Pydantic schemas for finance endpoints."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class EarningCreate(BaseModel):
    driver_id: UUID
    trip_id: Optional[UUID] = None
    shipment_id: Optional[UUID] = None
    gross_amount: float
    commission_amount: float = 0
    fuel_cost: float = 0


class EarningResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    driver_id: UUID
    trip_id: Optional[UUID] = None
    shipment_id: Optional[UUID] = None
    gross_amount: float
    commission_amount: float
    fuel_cost: float
    net_amount: float
    period: str
    created_at: datetime


class FinanceSummary(BaseModel):
    total_gross: float
    total_commissions: float
    total_fuel: float
    total_net: float
    trip_count: int
    avg_per_trip: float
    period: str


class DriverFinanceDetail(BaseModel):
    driver_id: UUID
    driver_name: str
    gross_amount: float
    commission_amount: float
    fuel_cost: float
    net_amount: float
    trip_count: int
    current_tier: str
