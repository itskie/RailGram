"""
Karma Service — award / deduct karma and write to the KarmaEvent ledger.

All mutations are atomic:
  - User.karma is updated with a SQL += / -= expression (no read-modify-write)
  - KarmaEvent row is inserted in the same transaction

Usage (inside any route, pass the open AsyncSession directly):

    from app.services.karma import award_karma
    await award_karma(db, user_id, delta=10, reason="post_liked", ref_type="post", ref_id=str(post_id))

"""
from typing import Optional
import uuid

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.gamification import KarmaEvent
from api.models.user import User

# ── Karma delta catalogue ─────────────────────────────────────────────────────
KARMA = {
    # Social actions
    "post_created":      5,
    "post_liked":        2,    # given to post owner when their post is liked
    "comment_posted":    1,    # given to commenter
    "comment_received":  1,    # given to post owner when someone comments
    "first_post":       20,
    "reel_created":      8,    # reels take more effort
    "reel_liked":        2,    # given to reel owner when their reel is liked
    "story_posted":      2,
    # Train utility
    "gps_submitted":     3,
    "spot_submitted":    5,
    "spot_verified":    10,   # future: when multiple spotters confirm
    # Streaks
    "streak_7":         15,
    "streak_30":        50,
    "streak_100":      150,
    # Badges (per badge karma_bonus)
    "badge_earned":      0,   # placeholder — actual delta comes from Badge.karma_bonus
    # Penalties
    "post_removed":    -10,
    "report_confirmed": -20,
}


async def award_karma(
    db: AsyncSession,
    user_id: uuid.UUID,
    delta: int,
    reason: str,
    ref_type: Optional[str] = None,
    ref_id: Optional[str] = None,
) -> None:
    """
    Award (or deduct if delta < 0) karma to a user and log the event.
    Runs inside the caller's transaction — no commit here.
    """
    if delta == 0:
        return

    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(karma=User.karma + delta)
    )

    event = KarmaEvent(
        user_id=user_id,
        delta=delta,
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
    )
    db.add(event)
