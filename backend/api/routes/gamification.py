"""
Phase 5 – Gamification Routes

GET  /users/{username}/stats       — karma, streaks, badges for a profile
GET  /users/{username}/badges      — badge list (with earned_at)
GET  /karma/history                — caller's karma event log (cursor-paginated)
POST /karma/checkin                — daily check-in (awards streak + karma)
GET  /leaderboard                  — top users by karma (public, cached 5 min)
"""
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.gamification import Badge, KarmaEvent, Streak, UserBadge
from api.models.user import User
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.schemas.gamification import (
    BadgeOut,
    CheckInOut,
    KarmaEventOut,
    LeaderboardEntry,
    StreakOut,
    UserStatsOut,
)
from app.services.badge import check_and_grant_badges
from app.services.karma import award_karma, KARMA
from app.services.streak import record_activity

router = APIRouter(tags=["gamification"])


# ── User stats ────────────────────────────────────────────────────────────────

@router.get("/users/{username}/stats", response_model=UserStatsOut)
async def get_user_stats(
    username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user_res = await db.execute(select(User).where(User.username == username))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Earned badges with earned_at
    ub_res = await db.execute(
        select(UserBadge, Badge)
        .join(Badge, UserBadge.badge_id == Badge.id)
        .where(UserBadge.user_id == user.id)
        .order_by(UserBadge.earned_at)
    )
    badges = [
        BadgeOut(
            id=b.id,
            name=b.name,
            description=b.description,
            icon=b.icon,
            rarity=b.rarity,
            karma_bonus=b.karma_bonus,
            earned_at=ub.earned_at,
        )
        for ub, b in ub_res.all()
    ]

    # Streaks
    streaks_res = await db.execute(
        select(Streak).where(Streak.user_id == user.id)
    )
    streaks = [StreakOut.model_validate(s) for s in streaks_res.scalars().all()]

    # Karma rank (position among all users sorted by karma desc)
    rank_res = await db.execute(
        select(func.count()).select_from(User).where(User.karma > user.karma)
    )
    karma_rank = (rank_res.scalar() or 0) + 1

    return UserStatsOut(
        karma=user.karma,
        trains_spotted=user.trains_spotted,
        km_traveled=user.km_traveled,
        badges=badges,
        streaks=streaks,
        karma_rank=karma_rank,
    )


# ── Badge list ────────────────────────────────────────────────────────────────

@router.get("/users/{username}/badges", response_model=list[BadgeOut])
async def get_user_badges(
    username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user_res = await db.execute(select(User).where(User.username == username))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ub_res = await db.execute(
        select(UserBadge, Badge)
        .join(Badge, UserBadge.badge_id == Badge.id)
        .where(UserBadge.user_id == user.id)
        .order_by(UserBadge.earned_at)
    )
    return [
        BadgeOut(
            id=b.id, name=b.name, description=b.description,
            icon=b.icon, rarity=b.rarity, karma_bonus=b.karma_bonus,
            earned_at=ub.earned_at,
        )
        for ub, b in ub_res.all()
    ]


# ── Karma event history ───────────────────────────────────────────────────────

@router.get("/karma/history", response_model=list[KarmaEventOut])
async def get_karma_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    before: Optional[str] = Query(None, description="ISO cursor for pagination"),
    limit: int = Query(50, ge=1, le=100),
):
    q = select(KarmaEvent).where(KarmaEvent.user_id == current_user.id)
    if before:
        try:
            cursor_dt = datetime.fromisoformat(before)
            q = q.where(KarmaEvent.created_at < cursor_dt)
        except ValueError:
            pass
    q = q.order_by(desc(KarmaEvent.created_at)).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


# ── Daily check-in ────────────────────────────────────────────────────────────

@router.post("/karma/checkin", response_model=CheckInOut, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def daily_checkin(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Daily check-in. Awards 2 karma + extends the daily_login streak.
    Returns streak info and any newly granted badges.
    Idempotent — calling twice on the same day returns current data without re-awarding.
    """
    new_count = await record_activity(db, current_user.id, "daily_login")

    if new_count is None:
        # Already checked in today — just return current state
        streak_res = await db.execute(
            select(Streak).where(
                Streak.user_id == current_user.id,
                Streak.streak_type == "daily_login",
            )
        )
        s = streak_res.scalar_one_or_none()
        return CheckInOut(
            streak_type="daily_login",
            current_count=s.current_count if s else 1,
            best_count=s.best_count if s else 1,
            newly_granted_badges=[],
            karma_delta=0,
        )

    karma_delta = 2
    await award_karma(db, current_user.id, delta=karma_delta, reason="daily_checkin", ref_type="streak")

    newly_granted = await check_and_grant_badges(db, current_user.id)
    await db.commit()

    streak_res = await db.execute(
        select(Streak).where(
            Streak.user_id == current_user.id,
            Streak.streak_type == "daily_login",
        )
    )
    s = streak_res.scalar_one_or_none()
    return CheckInOut(
        streak_type="daily_login",
        current_count=s.current_count if s else new_count,
        best_count=s.best_count if s else new_count,
        newly_granted_badges=newly_granted,
        karma_delta=karma_delta,
    )


# ── Leaderboard ───────────────────────────────────────────────────────────────

@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
):
    """Top users by karma. Cached in Redis for 5 minutes."""
    import json
    from app.core.cache import get_redis

    redis = await get_redis()
    cache_key = f"leaderboard:{limit}"
    cached = await redis.get(cache_key)
    if cached:
        raw = json.loads(cached)
        return [LeaderboardEntry(**r) for r in raw]

    result = await db.execute(
        select(User)
        .where(User.is_active == True)  # noqa
        .order_by(desc(User.karma))
        .limit(limit)
    )
    users = result.scalars().all()

    entries = [
        LeaderboardEntry(
            rank=i + 1,
            user_id=u.id,
            username=u.username,
            display_name=u.display_name,
            avatar_url=u.avatar_url,
            karma=u.karma,
            trains_spotted=u.trains_spotted,
        )
        for i, u in enumerate(users)
    ]

    await redis.setex(cache_key, 300, json.dumps([e.model_dump(mode="json") for e in entries]))
    return entries
