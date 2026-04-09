"""
Badge Service — grant badges and seed the badge catalogue.

Badges are defined in BADGE_CATALOGUE (single source of truth).
`ensure_badges_seeded()` is called at app startup to upsert any new ones.
`check_and_grant_badges()` runs after qualifying actions to award newly
earned badges and the associated karma bonus.
"""
from typing import Optional
import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.gamification import Badge, UserBadge
from api.models.tracking import GpsReport
from api.models.social import Post
from api.models.user import User

# ── Badge catalogue ───────────────────────────────────────────────────────────
BADGE_CATALOGUE = [
    # Onboarding
    {"id": "welcome",         "name": "Welcome Aboard",       "icon": "🚂", "rarity": "common",    "karma_bonus": 10,  "description": "Joined RailGram"},
    {"id": "first_post",      "name": "First Post",           "icon": "📸", "rarity": "common",    "karma_bonus": 20,  "description": "Published your first post"},
    {"id": "first_spot",      "name": "First Spot",           "icon": "👁️", "rarity": "common",    "karma_bonus": 20,  "description": "Submitted your first train sighting"},
    {"id": "first_gps",       "name": "On Board",             "icon": "📡", "rarity": "common",    "karma_bonus": 15,  "description": "Submitted your first on-board GPS ping"},
    # Social milestones
    {"id": "posts_10",        "name": "Content Creator",      "icon": "🎬", "rarity": "common",    "karma_bonus": 30,  "description": "Published 10 posts"},
    {"id": "posts_100",       "name": "Prolific Poster",      "icon": "🌟", "rarity": "rare",      "karma_bonus": 100, "description": "Published 100 posts"},
    {"id": "followers_10",    "name": "Rising Star",          "icon": "⭐", "rarity": "common",    "karma_bonus": 25,  "description": "Gained 10 followers"},
    {"id": "followers_100",   "name": "Popular Railfan",      "icon": "💫", "rarity": "rare",      "karma_bonus": 75,  "description": "Gained 100 followers"},
    # Train utility
    {"id": "spots_10",        "name": "Station Watcher",      "icon": "🏭", "rarity": "common",    "karma_bonus": 40,  "description": "Filed 10 train sightings"},
    {"id": "spots_50",        "name": "Signal Master",        "icon": "🚦", "rarity": "rare",      "karma_bonus": 100, "description": "Filed 50 train sightings"},
    {"id": "spots_200",       "name": "Iron Spotter",         "icon": "🏆", "rarity": "epic",      "karma_bonus": 300, "description": "Filed 200 train sightings"},
    {"id": "gps_50",          "name": "GPS Traveller",        "icon": "🗺️", "rarity": "rare",      "karma_bonus": 80,  "description": "Submitted 50 GPS pings while travelling"},
    # Streaks
    {"id": "streak_7",        "name": "Weekly Railfan",       "icon": "📅", "rarity": "common",    "karma_bonus": 15,  "description": "7-day activity streak"},
    {"id": "streak_30",       "name": "Monthly Devotee",      "icon": "🗓️", "rarity": "rare",      "karma_bonus": 50,  "description": "30-day activity streak"},
    {"id": "streak_100",      "name": "Iron Railfan",         "icon": "⚙️", "rarity": "epic",      "karma_bonus": 150, "description": "100-day activity streak"},
    # Karma milestones
    {"id": "karma_500",       "name": "Karma Collector",      "icon": "✨", "rarity": "rare",      "karma_bonus": 0,   "description": "Reached 500 karma"},
    {"id": "karma_2000",      "name": "Karma Legend",         "icon": "👑", "rarity": "epic",      "karma_bonus": 0,   "description": "Reached 2,000 karma"},
    {"id": "karma_10000",     "name": "Railway Oracle",       "icon": "🔮", "rarity": "legendary", "karma_bonus": 0,   "description": "Reached 10,000 karma"},
]

_BADGE_MAP = {b["id"]: b for b in BADGE_CATALOGUE}


async def ensure_badges_seeded(db: AsyncSession) -> None:
    """Upsert all badges into the catalogue table. Called once at startup."""
    for b in BADGE_CATALOGUE:
        stmt = pg_insert(Badge).values(
            id=b["id"],
            name=b["name"],
            description=b["description"],
            icon=b["icon"],
            rarity=b["rarity"],
            karma_bonus=b["karma_bonus"],
        ).on_conflict_do_update(
            index_elements=["id"],
            set_={
                "name": b["name"],
                "description": b["description"],
                "icon": b["icon"],
                "rarity": b["rarity"],
                "karma_bonus": b["karma_bonus"],
            }
        )
        await db.execute(stmt)
    await db.commit()


async def grant_badge(
    db: AsyncSession,
    user_id: uuid.UUID,
    badge_id: str,
) -> bool:
    """
    Grant a badge to a user if not already earned.
    Also awards the badge's karma_bonus via KarmaEvent.
    Returns True if newly granted, False if already owned.
    """
    existing = await db.execute(
        select(UserBadge).where(
            UserBadge.user_id == user_id,
            UserBadge.badge_id == badge_id,
        )
    )
    if existing.scalar_one_or_none():
        return False

    ub = UserBadge(user_id=user_id, badge_id=badge_id)
    db.add(ub)

    bonus = _BADGE_MAP.get(badge_id, {}).get("karma_bonus", 0)
    if bonus:
        from app.services.karma import award_karma
        await award_karma(db, user_id, delta=bonus, reason="badge_earned", ref_type="badge", ref_id=badge_id)

    return True


async def check_and_grant_badges(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[str]:
    """
    Re-evaluate all badge conditions for this user and grant any newly eligible ones.
    Returns list of badge_ids just granted.
    """
    from sqlalchemy import func as sqlfunc

    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        return []

    newly_granted: list[str] = []

    async def _maybe_grant(badge_id: str, condition: bool) -> None:
        if condition:
            granted = await grant_badge(db, user_id, badge_id)
            if granted:
                newly_granted.append(badge_id)

    # Count helpers
    post_count_res = await db.execute(
        select(sqlfunc.count()).select_from(Post).where(
            Post.user_id == user_id, Post.is_archived == False  # noqa
        )
    )
    post_count = post_count_res.scalar() or 0

    spot_count = 0

    gps_count_res = await db.execute(
        select(sqlfunc.count()).select_from(GpsReport).where(GpsReport.user_id == user_id)
    )
    gps_count = gps_count_res.scalar() or 0

    from sqlalchemy import select as sel
    from api.models.user import Follow
    follower_count_res = await db.execute(
        select(sqlfunc.count()).select_from(Follow).where(Follow.followed_id == user_id)
    )
    follower_count = follower_count_res.scalar() or 0

    # Evaluate conditions
    await _maybe_grant("welcome",       True)                           # always on first check
    await _maybe_grant("first_post",    post_count >= 1)
    await _maybe_grant("posts_10",      post_count >= 10)
    await _maybe_grant("posts_100",     post_count >= 100)
    await _maybe_grant("first_spot",    spot_count >= 1)
    await _maybe_grant("spots_10",      spot_count >= 10)
    await _maybe_grant("spots_50",      spot_count >= 50)
    await _maybe_grant("spots_200",     spot_count >= 200)
    await _maybe_grant("first_gps",     gps_count >= 1)
    await _maybe_grant("gps_50",        gps_count >= 50)
    await _maybe_grant("followers_10",  follower_count >= 10)
    await _maybe_grant("followers_100", follower_count >= 100)
    await _maybe_grant("karma_500",     user.karma >= 500)
    await _maybe_grant("karma_2000",    user.karma >= 2000)
    await _maybe_grant("karma_10000",   user.karma >= 10000)

    return newly_granted
