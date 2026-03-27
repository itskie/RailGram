"""
Phase 5 – Gamification Models

Badge        : Catalogue of all available badges (seeded at startup).
UserBadge    : Junction — user ↔ badge, with earned-at timestamp.
KarmaEvent   : Append-only ledger entry every time karma changes.
Streak       : One row per (user, streak_type), tracks current & best streak.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, ForeignKey,
    Index, Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)   # e.g. "first_spot"
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(String(10), nullable=False, default="🏅")
    # "common" | "rare" | "epic" | "legendary"
    rarity: Mapped[str] = mapped_column(String(20), nullable=False, default="common")
    # Karma awarded when badge is first earned (one-time)
    karma_bonus: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    badge_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False
    )
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),
        Index("ix_user_badge_user", "user_id"),
    )


class KarmaEvent(Base):
    """Append-only ledger. Never update; balances are kept on User.karma."""
    __tablename__ = "karma_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    delta: Mapped[int] = mapped_column(Integer, nullable=False)   # + or −
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    # Optional reference to the object that triggered the event
    ref_type: Mapped[Optional[str]] = mapped_column(String(30))   # "post" | "spot" | "badge" | …
    ref_id: Mapped[Optional[str]] = mapped_column(String(50))     # UUID or string key
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class Streak(Base):
    """One row per (user_id, streak_type). Upserted on qualifying activity."""
    __tablename__ = "streaks"
    __table_args__ = (UniqueConstraint("user_id", "streak_type", name="uq_streak"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    # "daily_post" | "daily_spot" | "daily_login"
    streak_type: Mapped[str] = mapped_column(String(30), nullable=False)
    current_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    best_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_activity_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "streak_type", name="uq_streak"),
        Index("ix_streak_user", "user_id"),
    )
