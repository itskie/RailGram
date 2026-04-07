"""
Phase 6 – Chat Models

Conversation : A DM thread between two users (extendable to group in future).
ConvParticipant : Membership row (user ↔ conversation) with unread_count + last_read_at.
Message      : Individual chat message; supports image/file attachments via media_key.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, ForeignKey,
    Index, Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # "dm" only for now; "group" can be added later
    conv_type: Mapped[str] = mapped_column(String(20), nullable=False, default="dm")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    participants: Mapped[list["ConvParticipant"]] = relationship(
        "ConvParticipant", back_populates="conversation", lazy="selectin"
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", lazy="noload"
    )


class ConvParticipant(Base):
    __tablename__ = "conv_participants"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conv_participant"),
        Index("ix_conv_participant_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    unread_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="participants")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    # "text" | "image" | "train_card" (share a train/station inline)
    msg_type: Mapped[str] = mapped_column(String(20), nullable=False, default="text")
    body: Mapped[Optional[str]] = mapped_column(Text)
    media_key: Mapped[Optional[str]] = mapped_column(String(300))
    # For train_card type — link to a train or station
    train_no: Mapped[Optional[str]] = mapped_column(String(10))
    station_code: Mapped[Optional[str]] = mapped_column(String(10))
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("ix_message_conv_created", "conversation_id", "created_at"),
    )
