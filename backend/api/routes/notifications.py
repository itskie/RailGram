import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.notification import Notification, NotificationType
from api.models.user import User
from app.core.deps import get_current_user
from app.schemas.notification import NotificationOut, UnreadCountOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("", response_model=List[NotificationOut])
async def get_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(30, ge=1, le=100),
    before: Optional[uuid.UUID] = None,
):
    """
    Get user notifications, paginated by cursor (before ID).
    """
    q = select(Notification).where(Notification.user_id == current_user.id).options(
        selectinload(Notification.actor)
    )

    if before:
        # Cursor-based pagination using notification ID
        # (Though using created_at is more standard, ID works if sorted)
        cursor_q = select(Notification.created_at).where(Notification.id == before)
        cursor_res = await db.execute(cursor_q)
        cursor_dt = cursor_res.scalar_one_or_none()
        if cursor_dt:
            q = q.where(Notification.created_at < cursor_dt)

    q = q.order_by(desc(Notification.created_at)).limit(limit)

    result = await db.execute(q)
    return result.scalars().unique().all()

@router.get("/unread-count", response_model=UnreadCountOut)
async def get_unread_count(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Get the number of unread notifications for the badge.
    """
    q = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )
    res = await db.execute(q)
    return UnreadCountOut(unread_count=res.scalar() or 0)

@router.put("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Mark all unread notifications as read.
    """
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return None

@router.put("/{notif_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_one_read(
    notif_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Mark a single notification as read.
    """
    res = await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.user_id == current_user.id
        )
    )
    n = res.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    n.is_read = True
    await db.commit()
    return None
