import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict
from api.models.notification import NotificationType

class NotificationActor(BaseModel):
    id: uuid.UUID
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class NotificationOut(BaseModel):
    id: uuid.UUID
    notif_type: NotificationType
    actor: Optional[NotificationActor] = None
    target_id: Optional[uuid.UUID] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UnreadCountOut(BaseModel):
    unread_count: int
