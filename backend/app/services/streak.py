"""
Streak Service — maintain daily activity streaks per user per streak type.

Call `record_activity(db, user_id, streak_type)` after any qualifying event.
  - If this is the first activity today → extend streak, check milestones.
  - If already recorded today → no-op (idempotent).
  - If previous activity was >1 day ago → streak resets to 1.
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.gamification import Streak
from app.services.interpolation import IST


def _date_only(dt: datetime) -> datetime:
    """Strip time, keep IST date."""
    ist = dt.astimezone(IST)
    return ist.replace(hour=0, minute=0, second=0, microsecond=0)


STREAK_MILESTONES = {7: "streak_7", 30: "streak_30", 100: "streak_100"}


async def record_activity(
    db: AsyncSession,
    user_id: uuid.UUID,
    streak_type: str = "daily_spot",
) -> Optional[int]:
    """
    Record qualifying activity and update the streak.

    Returns the new current_count if streak was extended, else None (already done today).
    Side effects: grants streak badges and awards karma at milestone boundaries.
    """
    now = datetime.now(IST)
    today = _date_only(now)

    result = await db.execute(
        select(Streak).where(
            Streak.user_id == user_id,
            Streak.streak_type == streak_type,
        ).with_for_update()
    )
    streak = result.scalar_one_or_none()

    if streak is None:
        # First-ever activity for this streak type
        streak = Streak(
            user_id=user_id,
            streak_type=streak_type,
            current_count=1,
            best_count=1,
            last_activity_date=now,
        )
        db.add(streak)
        await db.flush()
        return 1

    last_date = _date_only(streak.last_activity_date)

    if last_date == today:
        return None  # Already recorded today — idempotent

    if last_date == today - timedelta(days=1):
        # Consecutive day — extend
        streak.current_count += 1
        if streak.current_count > streak.best_count:
            streak.best_count = streak.current_count
    else:
        # Streak broken
        streak.current_count = 1

    streak.last_activity_date = now
    new_count = streak.current_count

    # Check milestone rewards
    milestone_badge = STREAK_MILESTONES.get(new_count)
    if milestone_badge:
        from app.services.karma import KARMA, award_karma
        from app.services.badge import grant_badge
        await grant_badge(db, user_id, milestone_badge)
        delta = KARMA.get(milestone_badge, 0)
        if delta:
            await award_karma(db, user_id, delta=delta, reason=milestone_badge, ref_type="streak")

    return new_count
