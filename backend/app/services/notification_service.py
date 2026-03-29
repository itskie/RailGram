import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from api.models.notification import Notification, NotificationType

async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    actor_id: uuid.UUID,
    notif_type: NotificationType,
    target_id: Optional[uuid.UUID] = None,
):
    """
    Creates a new notification if the recipient is NOT the actor.
    """
    if user_id == actor_id:
        return None

    # Optional: Prevent duplicate notifications (e.g., multiple likes on same post)
    # For now, we'll just create it. Most social apps do this.
    
    new_notif = Notification(
        user_id=user_id,
        actor_id=actor_id,
        notif_type=notif_type,
        target_id=target_id,
        is_read=False
    )
    db.add(new_notif)
    await db.flush() # Ensure ID is generated but don't commit yet (main route handles commit)
    return new_notif
