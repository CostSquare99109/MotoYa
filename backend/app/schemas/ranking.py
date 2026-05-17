"""Pydantic schemas for ranking/gamification endpoints."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class RankingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    driver_id: UUID
    driver_name: Optional[str] = None
    tier: str
    points: int
    weekly_trips: int
    monthly_trips: int
    acceptance_rate: float
    rating_avg: float
    streak_days: int
    badges: List[str]
    updated_at: datetime


class TierConfig(BaseModel):
    tier: str
    min_points: int
    commission_rate: float
    benefits: List[str]


class LeaderboardEntry(BaseModel):
    rank: int
    driver_id: UUID
    driver_name: str
    tier: str
    points: int
    monthly_trips: int
    rating_avg: float
    badges: List[str]
