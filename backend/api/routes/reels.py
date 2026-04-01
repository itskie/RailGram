"""Reels API routes — upload, feed, social interactions."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, desc, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.reel import Reel, ReelLike, ReelComment, ReelCommentLike, ReelSave, ReelView, ReelStatus
from api.models.user import User, Block
from app.core.deps import get_current_user
from app.core.security import decode_token
from app.schemas.reel import (
    ReelUploadUrlRequest, ReelUploadUrlResponse,
    ReelCreate, ReelUpdate, ReelOut, ReelFeedResponse,
    ReelCommentCreate, ReelCommentOut,
    ReelStatusUpdate, ReelViewRecord,
    ReelAuthor,
)
from app.services.media import get_presigned_upload_url, cdn_url, build_key
from app.core.config import get_settings
from app.services.notification_service import create_notification
from api.models.notification import NotificationType

settings = get_settings()

router = APIRouter(prefix="/reels", tags=["reels"])

_ALLOWED_VIDEO = {"video/mp4", "video/quicktime", "video/webm", "video/x-m4v"}
_bearer = HTTPBearer(auto_error=False)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Returns current user if authenticated, None if not (for public endpoints)."""
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        return None
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return None
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    return result.scalar_one_or_none()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _reel_to_out(
    reel: Reel,
    viewer_liked: bool = False,
    viewer_saved: bool = False,
    viewer_followed: bool = False,
) -> ReelOut:
    return ReelOut(
        id=reel.id,
        user=ReelAuthor(
            id=reel.user.id,
            username=reel.user.username,
            display_name=reel.user.display_name,
            avatar_url=cdn_url(reel.user.avatar_url) if reel.user.avatar_url else None,
            viewer_followed=viewer_followed,
        ),
        title=reel.title,
        description=reel.description,
        train_number=reel.train_number,
        train_name=reel.train_name,
        station_tag=reel.station_tag,
        hls_url=cdn_url(reel.hls_key) if reel.hls_key else None,
        thumbnail_url=cdn_url(reel.thumbnail_key) if reel.thumbnail_key else None,
        duration_secs=reel.duration_secs,
        status=reel.status,
        views=reel.views,
        likes_count=reel.likes_count,
        comments_count=reel.comments_count,
        saves_count=reel.saves_count,
        is_public=reel.is_public,
        viewer_liked=viewer_liked,
        viewer_saved=viewer_saved,
        created_at=reel.created_at,
    )


async def _get_viewer_states(
    db: AsyncSession,
    reel_ids: list[uuid.UUID],
    viewer_id: uuid.UUID,
) -> tuple[set[uuid.UUID], set[uuid.UUID]]:
    """Return sets of liked and saved reel IDs for the current viewer."""
    likes_q = await db.execute(
        select(ReelLike.reel_id).where(
            ReelLike.user_id == viewer_id,
            ReelLike.reel_id.in_(reel_ids),
        )
    )
    saves_q = await db.execute(
        select(ReelSave.reel_id).where(
            ReelSave.user_id == viewer_id,
            ReelSave.reel_id.in_(reel_ids),
        )
    )
    return set(likes_q.scalars()), set(saves_q.scalars())


async def _get_viewer_follow_states(
    db: AsyncSession,
    author_ids: list[uuid.UUID],
    viewer_id: uuid.UUID,
) -> set[uuid.UUID]:
    """Return set of followed author IDs for the current viewer."""
    from api.models.user import Follow
    q = await db.execute(
        select(Follow.followed_id).where(
            Follow.follower_id == viewer_id,
            Follow.followed_id.in_(author_ids),
        )
    )
    return set(q.scalars())


# ── 1. Generate S3 pre-signed upload URL ──────────────────────────────────────

@router.post("/upload-url", response_model=ReelUploadUrlResponse)
async def get_upload_url(
    body: ReelUploadUrlRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Returns a pre-signed S3 PUT URL valid for 5 minutes.
    Client uploads the raw video directly to S3 — EC2 never receives video bytes.
    Max file size: 1 GB.
    """
    if body.content_type not in _ALLOWED_VIDEO:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported type. Allowed: {_ALLOWED_VIDEO}",
        )

    key = build_key("uploads/raw", current_user.id, body.filename)
    upload_url = get_presigned_upload_url(key, body.content_type)

    if not upload_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Media storage not configured.",
        )

    return ReelUploadUrlResponse(upload_url=upload_url, s3_key=key)


# ── 2. Create reel metadata (called after successful S3 upload) ────────────────

@router.post("", response_model=ReelOut, status_code=status.HTTP_201_CREATED)
async def create_reel(
    body: ReelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reel = Reel(
        user_id=current_user.id,
        raw_s3_key=body.s3_key,
        hls_key=body.s3_key, # Instantly map raw file for instant unblocked playback
        title=body.title,
        description=body.description,
        train_number=body.train_number,
        train_name=body.train_name,
        station_tag=body.station_tag,
        duration_secs=body.duration_secs,
        width=body.width,
        height=body.height,
        file_size_bytes=body.file_size_bytes,
        is_public=body.is_public,
        status=ReelStatus.READY, 
    )
    db.add(reel)
    await db.commit()
    await db.refresh(reel)
    return _reel_to_out(reel)


# ── 3. Feed (paginated, cursor-based) ─────────────────────────────────────────

@router.get("/feed", response_model=ReelFeedResponse)
async def get_feed(
    cursor: Optional[str] = Query(None, description="ISO datetime cursor for pagination"),
    limit: int = Query(10, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Returns READY public reels, latest first. Cursor-based pagination."""
    # Get blocked user IDs if authenticated
    blocked_ids = []
    if current_user:
        block_res = await db.execute(
            select(Block.blocked_id).where(Block.blocker_id == current_user.id)
        )
        blocked_ids = [r for (r,) in block_res.all()]
    
    q = (
        select(Reel)
        .where(Reel.status == "READY", Reel.is_public == True)
        .where(Reel.user_id.notin_(blocked_ids))  # Filter out reels from blocked users
        .order_by(desc(Reel.created_at))
    )
    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            q = q.where(Reel.created_at < cursor_dt)
        except (ValueError, TypeError):
            # Invalid cursor format - ignore and fetch from latest
            pass

    q = q.limit(limit + 1)
    result = await db.execute(q)
    reels = list(result.scalars())

    next_cursor = None
    if len(reels) > limit:
        reels = reels[:limit]
        next_cursor = reels[-1].created_at.isoformat()

    liked_ids: set = set()
    saved_ids: set = set()
    followed_ids: set = set()
    if current_user and reels:
        reel_ids = [r.id for r in reels]
        author_ids = [r.user_id for r in reels]
        liked_ids, saved_ids = await _get_viewer_states(db, reel_ids, current_user.id)
        followed_ids = await _get_viewer_follow_states(db, author_ids, current_user.id)

    return ReelFeedResponse(
        items=[
            _reel_to_out(
                r, 
                r.id in liked_ids, 
                r.id in saved_ids,
                r.user_id in followed_ids
            ) for r in reels
        ],
        next_cursor=next_cursor,
    )


# ── 4. Trending feed ──────────────────────────────────────────────────────────

@router.get("/trending", response_model=ReelFeedResponse)
async def get_trending(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Top reels by likes in the last 7 days."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    q = (
        select(Reel)
        .where(
            Reel.status == "READY",
            Reel.is_public == True,
            Reel.created_at >= cutoff,
        )
        .order_by(desc(Reel.likes_count))
        .limit(limit)
    )
    result = await db.execute(q)
    reels = list(result.scalars())

    liked_ids: set = set()
    saved_ids: set = set()
    followed_ids: set = set()
    if current_user and reels:
        reel_ids = [r.id for r in reels]
        author_ids = [r.user_id for r in reels]
        liked_ids, saved_ids = await _get_viewer_states(db, reel_ids, current_user.id)
        followed_ids = await _get_viewer_follow_states(db, author_ids, current_user.id)

    return ReelFeedResponse(
        items=[
            _reel_to_out(
                r, 
                r.id in liked_ids,
                r.id in saved_ids,
                r.user_id in followed_ids
            ) for r in reels
        ],
    )


# ── 12. Saved reels ───────────────────────────────────────────────────────────

@router.get("/saved", response_model=ReelFeedResponse)
async def get_saved_reels(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(12, ge=1, le=30),
    cursor: Optional[str] = Query(None),
):
    """Return reels saved by the current user."""
    q = (
        select(Reel)
        .join(ReelSave, ReelSave.reel_id == Reel.id)
        .where(ReelSave.user_id == current_user.id, Reel.status == "READY")
    )

    if cursor:
        try:
            q = q.where(Reel.created_at < datetime.fromisoformat(cursor))
        except (ValueError, TypeError):
            # Invalid cursor format - ignore and fetch from latest
            pass

    q = q.order_by(desc(Reel.created_at)).limit(limit + 1)
    result = await db.execute(q)
    reels = list(result.scalars())

    next_cursor = None
    if len(reels) > limit:
        reels = reels[:limit]
        next_cursor = reels[-1].created_at.isoformat()

    reel_ids = [r.id for r in reels]
    liked_ids, saved_ids = await _get_viewer_states(db, reel_ids, current_user.id)
    author_ids = [r.user_id for r in reels]
    followed_ids = await _get_viewer_follow_states(db, author_ids, current_user.id)

    return ReelFeedResponse(
        items=[
            _reel_to_out(
                r,
                r.id in liked_ids,
                r.id in saved_ids,
                r.user_id in followed_ids,
            )
            for r in reels
        ],
        next_cursor=next_cursor,
    )


# ── 5. Single reel ────────────────────────────────────────────────────────────

@router.get("/{reel_id}", response_model=ReelOut)
async def get_reel(
    reel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    reel = await db.get(Reel, reel_id)
    if not reel or (not reel.is_public and (not current_user or reel.user_id != current_user.id)):
        raise HTTPException(status_code=404, detail="Reel not found")

    liked, saved, followed = False, False, False
    if current_user:
        liked_ids, saved_ids = await _get_viewer_states(db, [reel_id], current_user.id)
        followed_ids = await _get_viewer_follow_states(db, [reel.user_id], current_user.id)
        liked = reel_id in liked_ids
        saved = reel_id in saved_ids
        followed = reel.user_id in followed_ids

    return _reel_to_out(reel, liked, saved, followed)


# ── 6. Like / Unlike ─────────────────────────────────────────────────────────

@router.post("/{reel_id}/like", status_code=status.HTTP_200_OK)
async def toggle_reel_like(
    reel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reel = await db.get(Reel, reel_id)
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")

    from sqlalchemy.dialects.postgresql import insert

    stmt = insert(ReelLike).values(
        reel_id=reel_id,
        user_id=current_user.id
    ).on_conflict_do_nothing(
        index_elements=["reel_id", "user_id"]
    )

    result = await db.execute(stmt)

    if result.rowcount > 0:
        # Newly liked
        await db.execute(
            update(Reel).where(Reel.id == reel_id).values(likes_count=Reel.likes_count + 1)
        )
        await create_notification(
            db,
            user_id=reel.user_id,
            actor_id=current_user.id,
            notif_type=NotificationType.like_reel,
            target_id=reel.id
        )
        await db.commit()
        return {"liked": True}
    else:
        # Already liked — toggle to unlike
        del_result = await db.execute(
            delete(ReelLike).where(
                ReelLike.reel_id == reel_id,
                ReelLike.user_id == current_user.id
            )
        )
        if del_result.rowcount > 0:
            await db.execute(
                update(Reel).where(Reel.id == reel_id).values(likes_count=Reel.likes_count - 1)
            )
        await db.commit()
        return {"liked": False}


@router.delete("/{reel_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def unlike_reel_legacy(
    reel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy endpoint kept for backward compat — use POST /like (toggle) instead."""
    result = await db.execute(
        delete(ReelLike).where(
            ReelLike.reel_id == reel_id,
            ReelLike.user_id == current_user.id
        )
    )
    if result.rowcount > 0:
        await db.execute(
            update(Reel).where(Reel.id == reel_id).values(likes_count=Reel.likes_count - 1)
        )
        await db.commit()


@router.delete("/{reel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reel(
    reel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reel = await db.get(Reel, reel_id)
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")
    if reel.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your reel")
    await db.delete(reel)
    await db.commit()


@router.delete("/{reel_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def unlike_reel(
    reel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use atomic DELETE with rowcount check to prevent race conditions
    result = await db.execute(
        delete(ReelLike).where(
            ReelLike.reel_id == reel_id,
            ReelLike.user_id == current_user.id
        )
    )
    
    # Only decrement counter if a like was actually deleted
    if result.rowcount > 0:
        await db.execute(
            update(Reel)
            .where(Reel.id == reel_id)
            .values(likes_count=Reel.likes_count - 1)
        )
        await db.commit()
    # If rowcount == 0, user already unliked - idempotent, no-op


# ── 7. Save / Unsave ──────────────────────────────────────────────────────────

@router.post("/{reel_id}/save", status_code=status.HTTP_200_OK)
async def toggle_reel_save(
    reel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reel = await db.get(Reel, reel_id)
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")

    from sqlalchemy.dialects.postgresql import insert

    stmt = insert(ReelSave).values(
        reel_id=reel_id,
        user_id=current_user.id
    ).on_conflict_do_nothing(
        index_elements=["reel_id", "user_id"]
    )

    result = await db.execute(stmt)

    if result.rowcount > 0:
        await db.execute(
            update(Reel).where(Reel.id == reel_id).values(saves_count=Reel.saves_count + 1)
        )
        await db.commit()
        return {"saved": True}
    else:
        # Already saved — toggle to unsave
        del_result = await db.execute(
            delete(ReelSave).where(
                ReelSave.reel_id == reel_id,
                ReelSave.user_id == current_user.id
            )
        )
        if del_result.rowcount > 0:
            await db.execute(
                update(Reel).where(Reel.id == reel_id).values(saves_count=Reel.saves_count - 1)
            )
        await db.commit()
        return {"saved": False}


@router.delete("/{reel_id}/save", status_code=status.HTTP_204_NO_CONTENT)
async def unsave_reel_legacy(
    reel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy endpoint — use POST /save (toggle) instead."""
    result = await db.execute(
        delete(ReelSave).where(
            ReelSave.reel_id == reel_id,
            ReelSave.user_id == current_user.id
        )
    )
    if result.rowcount > 0:
        await db.execute(
            update(Reel).where(Reel.id == reel_id).values(saves_count=Reel.saves_count - 1)
        )
        await db.commit()


# ── 8. Comments ───────────────────────────────────────────────────────────────

@router.get("/{reel_id}/comments", response_model=list[ReelCommentOut])
async def list_comments(
    reel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReelComment)
        .where(ReelComment.reel_id == reel_id, ReelComment.parent_id == None)
        .order_by(desc(ReelComment.created_at))
        .limit(50)
    )
    comments = list(result.scalars())

    # Fetch reply counts
    from sqlalchemy import func as sqlfunc
    reply_counts: dict[uuid.UUID, int] = {}
    if comments:
        ids = [c.id for c in comments]
        rc_rows = await db.execute(
            select(ReelComment.parent_id, sqlfunc.count(ReelComment.id))
            .where(ReelComment.parent_id.in_(ids))
            .group_by(ReelComment.parent_id)
        )
        reply_counts = {pid: cnt for pid, cnt in rc_rows.all()}

    return [
        ReelCommentOut(
            id=c.id, reel_id=c.reel_id, parent_id=c.parent_id, body=c.body,
            like_count=c.like_count, reply_count=reply_counts.get(c.id, 0),
            created_at=c.created_at,
            user=ReelAuthor(
                id=c.user.id, username=c.user.username,
                display_name=c.user.display_name, avatar_url=c.user.avatar_url,
            ),
        )
        for c in comments
    ]


@router.post("/{reel_id}/comments", response_model=ReelCommentOut, status_code=status.HTTP_201_CREATED)
async def add_comment(
    reel_id: uuid.UUID,
    body: ReelCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reel = await db.get(Reel, reel_id)
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")

    # Validate parent comment if replying
    parent_comment = None
    if body.parent_id:
        parent_res = await db.execute(
            select(ReelComment).where(ReelComment.id == body.parent_id, ReelComment.reel_id == reel_id)
        )
        parent_comment = parent_res.scalar_one_or_none()
        if not parent_comment:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent_comment.parent_id is not None:
            raise HTTPException(status_code=400, detail="Cannot reply to a reply")

    comment = ReelComment(
        reel_id=reel_id,
        user_id=current_user.id,
        parent_id=body.parent_id,
        body=body.body,
    )
    db.add(comment)
    reel.comments_count += 1
    await db.flush()
    await db.refresh(comment)

    # Trigger Notification
    if parent_comment and parent_comment.user_id != current_user.id:
        await create_notification(
            db,
            user_id=parent_comment.user_id,
            actor_id=current_user.id,
            notif_type=NotificationType.reply_reel,
            target_id=reel.id,
        )
    elif not parent_comment and reel.user_id != current_user.id:
        await create_notification(
            db,
            user_id=reel.user_id,
            actor_id=current_user.id,
            notif_type=NotificationType.comment_reel,
            target_id=reel.id,
        )

    await db.commit()

    return ReelCommentOut(
        id=comment.id, reel_id=comment.reel_id, parent_id=comment.parent_id,
        body=comment.body, like_count=0, reply_count=0, created_at=comment.created_at,
        user=ReelAuthor(
            id=current_user.id, username=current_user.username,
            display_name=current_user.display_name, avatar_url=current_user.avatar_url,
        ),
    )


# ── 8b. Comment like toggle ───────────────────────────────────────────────────

@router.post("/comments/{comment_id}/like", status_code=status.HTTP_200_OK)
async def toggle_reel_comment_like(
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ReelComment).where(ReelComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = await db.execute(
        select(ReelCommentLike).where(
            ReelCommentLike.user_id == current_user.id,
            ReelCommentLike.comment_id == comment_id,
        )
    )
    cl = existing.scalar_one_or_none()

    if cl:
        await db.delete(cl)
        await db.execute(
            sa_update(ReelComment).where(ReelComment.id == comment_id).values(like_count=ReelComment.like_count - 1)
        )
        liked = False
    else:
        db.add(ReelCommentLike(user_id=current_user.id, comment_id=comment_id))
        await db.execute(
            sa_update(ReelComment).where(ReelComment.id == comment_id).values(like_count=ReelComment.like_count + 1)
        )
        liked = True
        if comment.user_id != current_user.id:
            reel = await db.get(Reel, comment.reel_id)
            await create_notification(
                db,
                user_id=comment.user_id,
                actor_id=current_user.id,
                notif_type=NotificationType.like_comment,
                target_id=comment.reel_id,
            )

    await db.commit()
    return {"liked": liked}


# ── 8b. Delete reel comment ───────────────────────────────────────────────────

@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reel_comment(
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ReelComment).where(ReelComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your comment")

    # Cascade delete: Delete all replies first
    replies_result = await db.execute(
        select(ReelComment).where(ReelComment.parent_id == comment_id)
    )
    replies = replies_result.scalars().all()
    for reply in replies:
        await db.delete(reply)
    
    # Update reel comment count
    total_deleted = 1 + len(replies)
    reel = await db.get(Reel, comment.reel_id)
    if reel and reel.comments_count >= total_deleted:
        reel.comments_count -= total_deleted
    
    await db.delete(comment)
    await db.commit()


# ── 8c. Get reel comment replies ──────────────────────────────────────────────

@router.get("/{reel_id}/comments/{comment_id}/replies", response_model=list[ReelCommentOut])
async def get_reel_comment_replies(
    reel_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ReelComment).where(ReelComment.id == comment_id, ReelComment.reel_id == reel_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Comment not found")

    rows = (await db.execute(
        select(ReelComment)
        .where(ReelComment.parent_id == comment_id)
        .order_by(ReelComment.created_at.asc())
        .limit(50)
    )).scalars().all()

    return [
        ReelCommentOut(
            id=c.id, reel_id=c.reel_id, parent_id=c.parent_id, body=c.body,
            like_count=c.like_count, reply_count=0, created_at=c.created_at,
            user=ReelAuthor(
                id=c.user.id, username=c.user.username,
                display_name=c.user.display_name, avatar_url=c.user.avatar_url,
            ),
        )
        for c in rows
    ]


# ── 9. Record view ────────────────────────────────────────────────────────────

@router.post("/{reel_id}/view", status_code=status.HTTP_204_NO_CONTENT)
async def record_view(
    reel_id: uuid.UUID,
    body: ReelViewRecord,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    reel = await db.get(Reel, reel_id)
    if not reel:
        return

    db.add(ReelView(
        reel_id=reel_id,
        user_id=current_user.id if current_user else None,
        watched_secs=body.watched_secs,
    ))
    reel.views += 1
    await db.commit()


# ── 10. Status webhook (called by Lambda after transcoding) ───────────────────

@router.post("/webhook/status", include_in_schema=False)
async def update_status(
    body: ReelStatusUpdate,
    x_webhook_secret: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not x_webhook_secret or x_webhook_secret != settings.webhook_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")
        
    """Internal endpoint — called by the Lambda transcoder when HLS is ready."""
    reel = await db.get(Reel, body.reel_id)
    if not reel:
        raise HTTPException(status_code=404)

    reel.status = body.status.upper() if body.status else "READY"
    if body.hls_key:
        reel.hls_key = body.hls_key
    if body.thumbnail_key:
        reel.thumbnail_key = body.thumbnail_key
    if body.duration_secs:
        reel.duration_secs = body.duration_secs

    await db.commit()
    return {"ok": True}


# ── 11. User's own reels grid ─────────────────────────────────────────────────

@router.get("/user/{user_id}", response_model=ReelFeedResponse)
async def get_user_reels(
    user_id: uuid.UUID,
    limit: int = Query(12, ge=1, le=30),
    cursor: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    is_own = current_user and current_user.id == user_id
    q = select(Reel).where(
        Reel.user_id == user_id,
        Reel.status == "READY",
    )
    if not is_own:
        q = q.where(Reel.is_public == True)

    if cursor:
        try:
            q = q.where(Reel.created_at < datetime.fromisoformat(cursor))
        except (ValueError, TypeError):
            # Invalid cursor format - ignore and fetch from latest
            pass

    q = q.order_by(desc(Reel.created_at)).limit(limit + 1)
    result = await db.execute(q)
    reels = list(result.scalars())

    next_cursor = None
    if len(reels) > limit:
        reels = reels[:limit]
        next_cursor = reels[-1].created_at.isoformat()

    followed = False
    if current_user and not is_own:
        followed_ids = await _get_viewer_follow_states(db, [user_id], current_user.id)
        followed = user_id in followed_ids

    return ReelFeedResponse(
        items=[_reel_to_out(r, viewer_followed=followed) for r in reels],
        next_cursor=next_cursor,
    )

