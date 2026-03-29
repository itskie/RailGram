"""Reel-related SQLAlchemy models."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Index, Integer,
    String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base


class ReelStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


class Reel(Base):
    __tablename__ = "reels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Content metadata
    title: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    train_number: Mapped[str] = mapped_column(String(10), nullable=True)   # e.g. "12301"
    train_name: Mapped[str] = mapped_column(String(100), nullable=True)    # e.g. "Rajdhani Express"
    station_tag: Mapped[str] = mapped_column(String(100), nullable=True)   # e.g. "NDLS"

    # S3 keys
    raw_s3_key: Mapped[str] = mapped_column(String(512), nullable=True)    # uploads/raw/{user_id}/{uuid}.mp4
    hls_key: Mapped[str] = mapped_column(String(512), nullable=True)       # reels/hls/{id}/master.m3u8
    thumbnail_key: Mapped[str] = mapped_column(String(512), nullable=True) # reels/thumbnails/{id}.jpg

    # Video properties
    duration_secs: Mapped[int] = mapped_column(Integer, nullable=True)
    width: Mapped[int] = mapped_column(Integer, nullable=True)
    height: Mapped[int] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=True)

    # Processing status
    status: Mapped[ReelStatus] = mapped_column(
        Enum(ReelStatus, name="reel_status", values_callable=lambda x: [str(e.value) for e in x]),
        nullable=False,
        default=ReelStatus.PENDING,
    )

    # Counters (denormalized for fast reads)
    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    likes_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    saves_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="reels", lazy="selectin")
    likes = relationship("ReelLike", back_populates="reel", cascade="all, delete-orphan")
    comments = relationship("ReelComment", back_populates="reel", cascade="all, delete-orphan")
    saves = relationship("ReelSave", back_populates="reel", cascade="all, delete-orphan")

    __table_args__ = (
        # Feed: latest reels per user
        Index("idx_reels_user_created", "user_id", created_at.desc()),
        # Only index ready reels for feed
        Index("idx_reels_status_created", "status", created_at.desc()),
    )


class ReelLike(Base):
    __tablename__ = "reel_likes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reels.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    reel = relationship("Reel", back_populates="likes")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("reel_id", "user_id", name="uq_reel_like"),
        Index("idx_reel_likes_reel", "reel_id"),
        Index("idx_reel_likes_user", "user_id"),
    )


class ReelComment(Base):
    __tablename__ = "reel_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reels.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reel_comments.id", ondelete="CASCADE"), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    reel = relationship("Reel", back_populates="comments")
    user = relationship("User", lazy="selectin")
    replies = relationship("ReelComment", back_populates="parent", cascade="all, delete-orphan")
    parent = relationship("ReelComment", back_populates="replies", remote_side=[id])

    __table_args__ = (
        Index("idx_reel_comments_reel_parent", "reel_id", "parent_id"),
    )


class ReelSave(Base):
    __tablename__ = "reel_saves"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reels.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    reel = relationship("Reel", back_populates="saves")

    __table_args__ = (
        UniqueConstraint("reel_id", "user_id", name="uq_reel_save"),
        Index("idx_reel_saves_user", "user_id"),
    )


class ReelView(Base):
    __tablename__ = "reel_views"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reels.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # null = anonymous
    watched_secs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_reel_views_reel", "reel_id"),
    )
