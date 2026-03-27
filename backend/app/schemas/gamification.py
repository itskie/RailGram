from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel


class BadgeOut(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    rarity: str
    karma_bonus: int
    earned_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class KarmaEventOut(BaseModel):
    id: int
    delta: int
    reason: str
    ref_type: Optional[str] = None
    ref_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StreakOut(BaseModel):
    streak_type: str
    current_count: int
    best_count: int
    last_activity_date: datetime

    model_config = {"from_attributes": True}


class UserStatsOut(BaseModel):
    karma: int
    trains_spotted: int
    km_traveled: int
    badges: list[BadgeOut]
    streaks: list[StreakOut]
    karma_rank: Optional[int] = None   # position on leaderboard


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: uuid.UUID
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    karma: int
    trains_spotted: int


class CheckInOut(BaseModel):
    streak_type: str
    current_count: int
    best_count: int
    newly_granted_badges: list[str]
    karma_delta: int
