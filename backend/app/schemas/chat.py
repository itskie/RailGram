import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ConversationOut(BaseModel):
    id: uuid.UUID
    conv_type: str
    other_user_id: Optional[uuid.UUID] = None
    other_username: Optional[str] = None
    other_display_name: Optional[str] = None
    other_avatar_url: Optional[str] = None
    other_last_seen_at: Optional[datetime] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    msg_type: str = Field(default="text", pattern="^(text|image|train_card)$")
    body: Optional[str] = Field(None, max_length=4000)
    media_key: Optional[str] = Field(None, max_length=300)
    train_no: Optional[str] = Field(None, max_length=10)
    station_code: Optional[str] = Field(None, max_length=10)

    @field_validator("body")
    @classmethod
    def body_required_for_text(cls, v: Optional[str], info) -> Optional[str]:
        # Access via info.data for cross-field validation
        return v


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    msg_type: str
    body: Optional[str] = None
    media_key: Optional[str] = None
    train_no: Optional[str] = None
    station_code: Optional[str] = None
    is_deleted: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessagesResponse(BaseModel):
    messages: list[MessageOut]
    next_cursor: Optional[str] = None   # ISO datetime of oldest message returned


# ── WebSocket wire formats ────────────────────────────────────────────────────

class WSIncoming(BaseModel):
    """JSON the client sends over WebSocket."""
    type: str = Field(pattern="^(message|read|ping|typing)$")
    # For type="message"
    msg_type: Optional[str] = "text"
    body: Optional[str] = Field(None, max_length=4000)
    media_key: Optional[str] = None
    train_no: Optional[str] = None
    station_code: Optional[str] = None

class WSOutgoing(BaseModel):
    """JSON the server pushes over WebSocket."""
    type: str          # "message" | "read" | "pong" | "error"
    data: Optional[dict] = None
