import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base

class NotificationType(enum.Enum):
    follow = "follow"
    like_post = "like_post"
    comment_post = "comment_post"
    like_reel = "like_reel"
    comment_reel = "comment_reel"
    mention = "mention"

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Recipient of the notification
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Who triggered the notification
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    notif_type: Mapped[str] = mapped_column(
        String(32),
        CheckConstraint("notif_type IN ('follow', 'like_post', 'comment_post', 'like_reel', 'comment_reel', 'mention')", name="notifications_type_check"),
        nullable=False
    )
    
    # Optional ID of the related post/reel/comment
    target_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )

    # Relationships
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[user_id], back_populates="notifications"
    )
    actor: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[actor_id]
    )
