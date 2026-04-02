import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.social import Bookmark, Comment, CommentLike, Like, Post
from api.models.trains import StationMaster
from api.models.user import User, Follow, Block
from api.models.reel import Reel, ReelLike, ReelSave
from app.core.deps import get_current_user, get_optional_user
from app.core.limiter import limiter
from app.schemas.social import (
    AuthorBrief,
    CommentCreate,
    CommentOut,
    CommentsResponse,
    FeedResponse,
    PostCreate,
    PostOut,
    UnifiedFeedItem,
    UnifiedFeedResponse,
)
from app.services.notification_service import create_notification
from api.models.notification import NotificationType

router = APIRouter(prefix="/posts", tags=["posts"])


def _post_to_out(post: Post, liked: bool = False, bookmarked: bool = False, viewer_followed: bool = False) -> PostOut:
    return PostOut(
        id=post.id,
        post_type=post.post_type,
        caption=post.caption,
        media_keys=post.media_keys,
        thumbnail_key=post.thumbnail_key,
        location_name=post.location_name,
        latitude=post.latitude,
        longitude=post.longitude,
        train_no=post.train_no,
        station_code=post.station_code,
        loco_class=post.loco_class,
        loco_number=post.loco_number,
        loco_shed=post.loco_shed,
        loco_zone=post.loco_zone,
        like_count=post.like_count,
        comment_count=post.comment_count,
        bookmark_count=post.bookmark_count,
        is_archived=post.is_archived,
        created_at=post.created_at,
        author=post.author,
        liked=liked,
        bookmarked=bookmarked,
        viewer_followed=viewer_followed,
    )


async def _viewer_flags(
    db: AsyncSession,
    viewer_id: uuid.UUID,
    post_ids: list[uuid.UUID],
) -> tuple[set[uuid.UUID], set[uuid.UUID]]:
    """Return sets of liked post ids and bookmarked post ids for viewer."""
    liked_rows = await db.execute(
        select(Like.post_id).where(
            Like.user_id == viewer_id, Like.post_id.in_(post_ids)
        )
    )
    bk_rows = await db.execute(
        select(Bookmark.post_id).where(
            Bookmark.user_id == viewer_id, Bookmark.post_id.in_(post_ids)
        )
    )
    return (
        {r for (r,) in liked_rows.all()},
        {r for (r,) in bk_rows.all()},
    )


async def _viewer_follow_ids(
    db: AsyncSession,
    viewer_id: uuid.UUID,
    author_ids: list[uuid.UUID],
) -> set[uuid.UUID]:
    """Return set of author IDs that the viewer currently follows."""
    if not author_ids:
        return set()
    rows = await db.execute(
        select(Follow.followed_id).where(
            Follow.follower_id == viewer_id,
            Follow.followed_id.in_(author_ids),
        )
    )
    return {r for (r,) in rows.all()}


# ── Create post ───────────────────────────────────────────────────────────────

@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_post(
    request: Request,
    body: PostCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    post = Post(
        user_id=current_user.id,
        post_type=body.post_type,
        caption=body.caption,
        media_keys=body.media_keys,
        thumbnail_key=body.thumbnail_key,
        location_name=body.location_name,
        latitude=body.latitude,
        longitude=body.longitude,
        train_no=body.train_no,
        station_code=body.station_code,
        loco_class=body.loco_class,
        loco_number=body.loco_number,
        loco_shed=body.loco_shed,
        loco_zone=body.loco_zone,
    )
    db.add(post)
    await db.flush()

    # Gamification: karma + streak + badge check
    from app.services.karma import award_karma, KARMA
    from app.services.badge import check_and_grant_badges
    from app.services.streak import record_activity
    await award_karma(db, current_user.id, delta=KARMA["post_created"], reason="post_created", ref_type="post", ref_id=str(post.id))
    await record_activity(db, current_user.id, "daily_post")
    await check_and_grant_badges(db, current_user.id)

    await db.refresh(post, ["author"])
    await db.commit()
    return _post_to_out(post)


# ── Saved / Bookmarked posts ──────────────────────────────────────────────────

@router.get("/bookmarked", response_model=FeedResponse)
async def get_bookmarked_posts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(20, ge=1, le=50),
    cursor: Optional[str] = Query(None),
):
    """Return posts bookmarked by the current user."""
    query = (
        select(Post)
        .join(Bookmark, Bookmark.post_id == Post.id)
        .where(Bookmark.user_id == current_user.id)
        .order_by(Post.created_at.desc())
        .limit(limit + 1)
    )
    if cursor:
        from datetime import datetime
        try:
            ts = datetime.fromisoformat(cursor)
        except (ValueError, TypeError):
            # Invalid cursor format - ignore and fetch from latest
            import logging
            logging.warning(f"Invalid cursor format: {cursor}")
            pass
        else:
            query = query.where(Post.created_at < ts)

    rows = (await db.execute(query)).scalars().all()
    has_more = len(rows) > limit
    items = rows[:limit]

    for p in items:
        await db.refresh(p, ["author"])

    post_ids = [p.id for p in items]
    liked_ids, bk_ids = await _viewer_flags(db, current_user.id, post_ids)
    author_ids = list({p.user_id for p in items})
    followed_author_ids = await _viewer_follow_ids(db, current_user.id, author_ids)

    posts_out = [_post_to_out(p, p.id in liked_ids, p.id in bk_ids, p.user_id in followed_author_ids) for p in items]
    return FeedResponse(
        posts=posts_out,
        next_cursor=items[-1].created_at.isoformat() if has_more else None,
    )


# ── Get single post ───────────────────────────────────────────────────────────

@router.get("/{post_id}", response_model=PostOut)
async def get_post(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Optional[User] = Depends(get_optional_user),
):
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.is_archived == False)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # Lazy-load author
    await db.refresh(post, ["author"])

    # Check privacy: if author is private, viewer must follow unless same user
    if post.author.is_private:
        if not current_user or post.user_id != current_user.id:
            follow_ok = False
            if current_user:
                follow_result = await db.execute(
                    select(Follow).where(
                        Follow.follower_id == current_user.id,
                        Follow.followed_id == post.user_id,
                    )
                )
                follow_ok = follow_result.scalar_one_or_none() is not None
            if not follow_ok:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is private")

    liked_ids, bk_ids = set(), set()
    followed_ids = set()
    if current_user:
        liked_ids, bk_ids = await _viewer_flags(db, current_user.id, [post.id])
        followed_ids = await _viewer_follow_ids(db, current_user.id, [post.user_id])
    return _post_to_out(post, post.id in liked_ids, post.id in bk_ids, post.user_id in followed_ids)


# ── Delete post ───────────────────────────────────────────────────────────────

@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_post(
    request: Request,
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your post")
    await db.delete(post)
    await db.commit()


# ── Like / unlike ─────────────────────────────────────────────────────────────

@router.post("/{post_id}/like", status_code=status.HTTP_200_OK)
async def toggle_like(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Check post exists
    post_res = await db.execute(select(Post).where(Post.id == post_id))
    post = post_res.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # Use atomic INSERT ... ON CONFLICT for like, DELETE for unlike
    from sqlalchemy.dialects.postgresql import insert
    
    # Try to insert like (will fail if already exists)
    stmt = insert(Like).values(
        user_id=current_user.id,
        post_id=post_id
    ).on_conflict_do_nothing(
        index_elements=["user_id", "post_id"]
    )
    
    result = await db.execute(stmt)
    
    if result.rowcount > 0:
        # Insert succeeded - this is a LIKE
        await db.execute(
            update(Post)
            .where(Post.id == post_id)
            .values(like_count=Post.like_count + 1)
        )
        liked = True
        
        # Trigger Notification
        await create_notification(
            db,
            user_id=post.user_id,
            actor_id=current_user.id,
            notif_type=NotificationType.like_post,
            target_id=post.id
        )
    else:
        # Conflict - already liked, so UNLIKE
        await db.execute(
            delete(Like).where(
                Like.user_id == current_user.id,
                Like.post_id == post_id
            )
        )
        await db.execute(
            update(Post)
            .where(Post.id == post_id)
            .values(like_count=Post.like_count - 1)
        )
        liked = False

    await db.commit()
    # Refresh post to get updated like_count
    await db.refresh(post)
    return {"liked": liked, "like_count": post.like_count}


# ── Bookmark / unbookmark ─────────────────────────────────────────────────────

@router.post("/{post_id}/bookmark", status_code=status.HTTP_200_OK)
async def toggle_bookmark(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    post_res = await db.execute(select(Post).where(Post.id == post_id))
    post = post_res.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # Use atomic INSERT ... ON CONFLICT for bookmark
    from sqlalchemy.dialects.postgresql import insert
    
    stmt = insert(Bookmark).values(
        user_id=current_user.id,
        post_id=post_id
    ).on_conflict_do_nothing(
        index_elements=["user_id", "post_id"]
    )
    
    result = await db.execute(stmt)
    
    if result.rowcount > 0:
        # Insert succeeded - this is a BOOKMARK
        await db.execute(
            update(Post)
            .where(Post.id == post_id)
            .values(bookmark_count=Post.bookmark_count + 1)
        )
        bookmarked = True
    else:
        # Conflict - already bookmarked, so UNBOOKMARK
        await db.execute(
            delete(Bookmark).where(
                Bookmark.user_id == current_user.id,
                Bookmark.post_id == post_id
            )
        )
        await db.execute(
            update(Post)
            .where(Post.id == post_id)
            .values(bookmark_count=Post.bookmark_count - 1)
        )
        bookmarked = False

    await db.commit()
    # Refresh post to get updated bookmark_count
    await db.refresh(post)
    return {"bookmarked": bookmarked, "bookmark_count": post.bookmark_count}


# ── Comments ──────────────────────────────────────────────────────────────────

@router.get("/{post_id}/comments", response_model=CommentsResponse)
async def list_comments(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    cursor: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
):
    query = (
        select(Comment)
        .where(Comment.post_id == post_id, Comment.parent_id == None)
        .order_by(Comment.created_at.asc())
        .limit(limit + 1)
    )
    if cursor:
        from datetime import datetime, timezone
        try:
            ts = datetime.fromisoformat(cursor)
        except (ValueError, TypeError):
            # Invalid cursor format - ignore and fetch from latest
            import logging
            logging.warning(f"Invalid cursor format: {cursor}")
            pass
        else:
            query = query.where(Comment.created_at > ts)

    rows = (await db.execute(query)).scalars().all()
    has_more = len(rows) > limit
    items = rows[:limit]

    # Load authors
    for c in items:
        await db.refresh(c, ["author"])

    # Fetch reply counts
    reply_counts: dict[uuid.UUID, int] = {}
    if items:
        ids = [c.id for c in items]
        rc_rows = await db.execute(
            select(Comment.parent_id, func.count(Comment.id))
            .where(Comment.parent_id.in_(ids))
            .group_by(Comment.parent_id)
        )
        reply_counts = {pid: cnt for pid, cnt in rc_rows.all()}

    # Fetch viewer's like status for each comment
    viewer_liked: dict[uuid.UUID, bool] = {}
    if items:
        ids = [c.id for c in items]
        liked_rows = await db.execute(
            select(CommentLike.comment_id).where(
                CommentLike.comment_id.in_(ids), 
                CommentLike.user_id == current_user.id
            )
        )
        viewer_liked = {cid: True for cid in liked_rows.scalars().all()}

    out = []
    for c in items:
        out.append(CommentOut(
            id=c.id,
            post_id=c.post_id,
            body=c.body,
            like_count=c.like_count,
            liked=viewer_liked.get(c.id, False),
            parent_id=c.parent_id,
            created_at=c.created_at,
            author=c.author,
            reply_count=reply_counts.get(c.id, 0),
        ))

    return CommentsResponse(
        comments=out,
        next_cursor=items[-1].created_at.isoformat() if has_more else None,
    )


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def add_comment(
    request: Request,
    post_id: uuid.UUID,
    body: CommentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Verify post exists
    post_res = await db.execute(select(Post).where(Post.id == post_id))
    post = post_res.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # Validate parent (must be a root comment - no nested replies)
    parent = None
    if body.parent_id:
        parent_res = await db.execute(
            select(Comment).where(Comment.id == body.parent_id, Comment.post_id == post_id)
        )
        parent = parent_res.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent comment not found")
        # Enforce 1-level deep replies only
        if parent.parent_id is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only reply to root comments")

    comment = Comment(
        post_id=post_id,
        user_id=current_user.id,
        body=body.body,
        parent_id=body.parent_id,
    )
    db.add(comment)
    await db.execute(
        update(Post).where(Post.id == post_id).values(comment_count=Post.comment_count + 1)
    )
    await db.flush()
    await db.refresh(comment, ["author"])

    # Trigger Notification
    if body.parent_id and parent:
        # Reply to comment — notify the parent comment's author
        if parent.user_id != current_user.id:
            await create_notification(
                db,
                user_id=parent.user_id,
                actor_id=current_user.id,
                notif_type=NotificationType.reply_post,
                target_id=post.id,
            )
    elif post.user_id != current_user.id:
        await create_notification(
            db,
            user_id=post.user_id,
            actor_id=current_user.id,
            notif_type=NotificationType.comment_post,
            target_id=post.id,
        )

    await db.commit()

    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        body=comment.body,
        like_count=comment.like_count,
        parent_id=comment.parent_id,
        created_at=comment.created_at,
        author=comment.author,
    )


@router.post("/comments/{comment_id}/like", status_code=status.HTTP_200_OK)
async def toggle_comment_like(
    comment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    existing = await db.execute(
        select(CommentLike).where(CommentLike.user_id == current_user.id, CommentLike.comment_id == comment_id)
    )
    cl = existing.scalar_one_or_none()

    if cl:
        await db.delete(cl)
        await db.execute(update(Comment).where(Comment.id == comment_id).values(like_count=Comment.like_count - 1))
        liked = False
    else:
        db.add(CommentLike(user_id=current_user.id, comment_id=comment_id))
        await db.execute(update(Comment).where(Comment.id == comment_id).values(like_count=Comment.like_count + 1))
        liked = True

        # Notify comment author (skip if liking own comment)
        if comment.user_id != current_user.id:
            await create_notification(
                db,
                user_id=comment.user_id,
                actor_id=current_user.id,
                notif_type=NotificationType.like_comment,
                target_id=comment.post_id,
            )

    await db.commit()
    # Refresh comment to get updated like_count
    await db.refresh(comment)
    return {"liked": liked, "like_count": comment.like_count}


@router.get("/{post_id}/comments/{comment_id}/replies", response_model=CommentsResponse)
async def get_replies(
    post_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=100),
):
    """Get all nested replies for a comment (recursive tree structure)."""
    # Verify parent comment exists
    result = await db.execute(select(Comment).where(Comment.id == comment_id, Comment.post_id == post_id))
    parent = result.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    # Get all direct replies
    rows = (await db.execute(
        select(Comment)
        .where(Comment.parent_id == comment_id, Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
        .limit(limit)
    )).scalars().all()

    for c in rows:
        await db.refresh(c, ["author"])

    # Fetch viewer's like status for each reply
    viewer_liked: dict[uuid.UUID, bool] = {}
    if rows:
        ids = [c.id for c in rows]
        liked_rows = await db.execute(
            select(CommentLike.comment_id).where(
                CommentLike.comment_id.in_(ids), 
                CommentLike.user_id == current_user.id
            )
        )
        viewer_liked = {cid: True for cid in liked_rows.scalars().all()}

    out = [
        CommentOut(
            id=c.id,
            post_id=c.post_id,
            body=c.body,
            like_count=c.like_count,
            liked=viewer_liked.get(c.id, False),
            parent_id=c.parent_id,
            created_at=c.created_at,
            author=c.author,
        )
        for c in rows
    ]
    return CommentsResponse(comments=out, next_cursor=None)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your comment")

    # Cascade delete: Delete all replies first
    replies_result = await db.execute(
        select(Comment).where(Comment.parent_id == comment_id)
    )
    replies = replies_result.scalars().all()
    for reply in replies:
        await db.delete(reply)
    
    # Update post comment count (subtract 1 for this comment + all replies)
    total_deleted = 1 + len(replies)
    await db.execute(
        update(Post)
        .where(Post.id == comment.post_id)
        .values(comment_count=Post.comment_count - total_deleted)
    )
    
    await db.delete(comment)
    await db.commit()


# ── Feed (following) ──────────────────────────────────────────────────────────

@router.get("/feed/following", response_model=FeedResponse)
async def following_feed(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    cursor: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
):
    # Get list of followed user IDs
    follows_res = await db.execute(
        select(Follow.followed_id).where(Follow.follower_id == current_user.id)
    )
    followed_ids = [r for (r,) in follows_res.all()]
    # Include own posts
    followed_ids.append(current_user.id)

    query = (
        select(Post)
        .where(Post.user_id.in_(followed_ids), Post.is_archived == False)
        .order_by(Post.created_at.desc())
        .limit(limit + 1)
    )
    if cursor:
        from datetime import datetime
        try:
            ts = datetime.fromisoformat(cursor)
        except (ValueError, TypeError):
            # Invalid cursor format - ignore and fetch from latest
            import logging
            logging.warning(f"Invalid cursor format: {cursor}")
            pass
        else:
            query = query.where(Post.created_at < ts)

    rows = (await db.execute(query)).scalars().all()
    has_more = len(rows) > limit
    items = rows[:limit]

    for p in items:
        await db.refresh(p, ["author"])

    post_ids = [p.id for p in items]
    liked_ids, bk_ids = await _viewer_flags(db, current_user.id, post_ids)
    author_ids = list({p.user_id for p in items})
    followed_author_ids = await _viewer_follow_ids(db, current_user.id, author_ids)

    posts_out = [_post_to_out(p, p.id in liked_ids, p.id in bk_ids, p.user_id in followed_author_ids) for p in items]
    return FeedResponse(
        posts=posts_out,
        next_cursor=items[-1].created_at.isoformat() if has_more else None,
    )


# ── Discover (recent public posts) ────────────────────────────────────────────

@router.get("/feed/discover", response_model=FeedResponse)
async def discover_feed(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Optional[User] = Depends(get_optional_user),
    post_type: Optional[str] = None,
    train_no: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
):
    # Only show posts from public accounts
    public_user_ids_res = await db.execute(
        select(User.id).where(User.is_private == False, User.is_active == True)
    )
    public_ids = [r for (r,) in public_user_ids_res.all()]
    
    # If authenticated, exclude users who blocked current_user
    if current_user:
        blockers_res = await db.execute(
            select(Block.blocker_id).where(Block.blocked_id == current_user.id)
        )
        blocker_ids = [r[0] for r in blockers_res.all()]
        public_ids = [uid for uid in public_ids if uid not in blocker_ids]

    query = (
        select(Post)
        .where(Post.user_id.in_(public_ids), Post.is_archived == False)
        .order_by(Post.created_at.desc())
        .limit(limit + 1)
    )
    if post_type:
        query = query.where(Post.post_type == post_type)
    if train_no:
        query = query.where(Post.train_no == train_no)
    if cursor:
        from datetime import datetime
        try:
            ts = datetime.fromisoformat(cursor)
        except (ValueError, TypeError):
            # Invalid cursor format - ignore and fetch from latest
            import logging
            logging.warning(f"Invalid cursor format: {cursor}")
            pass
        else:
            query = query.where(Post.created_at < ts)

    rows = (await db.execute(query)).scalars().all()
    has_more = len(rows) > limit
    items = rows[:limit]

    for p in items:
        await db.refresh(p, ["author"])

    liked_ids, bk_ids = set(), set()
    followed_author_ids = set()
    if current_user:
        post_ids = [p.id for p in items]
        liked_ids, bk_ids = await _viewer_flags(db, current_user.id, post_ids)
        author_ids = list({p.user_id for p in items})
        followed_author_ids = await _viewer_follow_ids(db, current_user.id, author_ids)

    posts_out = [_post_to_out(p, p.id in liked_ids, p.id in bk_ids, p.user_id in followed_author_ids) for p in items]
    return FeedResponse(
        posts=posts_out,
        next_cursor=items[-1].created_at.isoformat() if has_more else None,
    )


# ── Unified Feed (Posts + Reels combined) ─────────────────────────────────────

def _post_to_unified_item(post: Post, viewer_liked: bool = False, viewer_bookmarked: bool = False, viewer_followed: bool = False, station_name: Optional[str] = None) -> UnifiedFeedItem:
    """Convert a Post to UnifiedFeedItem."""
    return UnifiedFeedItem(
        item_type="post",
        id=post.id,
        created_at=post.created_at,
        post_type=post.post_type,
        caption=post.caption,
        media_keys=post.media_keys,
        thumbnail_key=post.thumbnail_key,
        location_name=post.location_name,
        latitude=post.latitude,
        longitude=post.longitude,
        train_no=post.train_no,
        station_code=post.station_code,
        station_name=station_name,
        loco_class=post.loco_class,
        loco_number=post.loco_number,
        loco_shed=post.loco_shed,
        loco_zone=post.loco_zone,
        like_count=post.like_count,
        comment_count=post.comment_count,
        bookmark_count=post.bookmark_count,
        author=AuthorBrief(
            id=post.author.id,
            username=post.author.username,
            display_name=post.author.display_name,
            avatar_url=post.author.avatar_url,
            karma=post.author.karma,
        ),
        viewer_liked=viewer_liked,
        viewer_bookmarked=viewer_bookmarked,
        viewer_followed=viewer_followed,
    )


def _reel_to_unified_item(reel: Reel, viewer_liked: bool = False, viewer_saved: bool = False, viewer_followed: bool = False) -> UnifiedFeedItem:
    """Convert a Reel to UnifiedFeedItem."""
    from app.services.media import cdn_url
    
    return UnifiedFeedItem(
        item_type="reel",
        id=reel.id,
        created_at=reel.created_at,
        title=reel.title,
        description=reel.description,
        hls_url=cdn_url(reel.hls_key) if reel.hls_key else None,
        reel_thumbnail_url=cdn_url(reel.thumbnail_key) if reel.thumbnail_key else None,
        duration_secs=reel.duration_secs,
        views=reel.views,
        likes_count=reel.likes_count,
        comments_count=reel.comments_count,
        saves_count=reel.saves_count,
        author=AuthorBrief(
            id=reel.user.id,
            username=reel.user.username,
            display_name=reel.user.display_name,
            avatar_url=reel.user.avatar_url,
            karma=reel.user.karma,
        ),
        viewer_liked=viewer_liked,
        viewer_saved=viewer_saved,
        viewer_followed=viewer_followed,
    )


@router.get("/feed/unified", response_model=UnifiedFeedResponse)
async def unified_feed(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Optional[User] = Depends(get_optional_user),
    feed_type: str = Query("for_you", description="Either 'for_you' or 'following'"),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
):
    """
    Combined feed of posts and reels, sorted by created_at.
    
    - `for_you`: All public posts and reels from public accounts
    - `following`: Posts and reels from users you follow (plus your own)
    """
    # Get blocked user IDs if authenticated
    blocked_ids = []
    if current_user:
        block_res = await db.execute(
            select(Block.blocked_id).where(Block.blocker_id == current_user.id)
        )
        blocked_ids = [r for (r,) in block_res.all()]

    # Determine which user IDs to include based on feed_type
    if feed_type == "following" and current_user:
        # Get followed user IDs + own ID
        follows_res = await db.execute(
            select(Follow.followed_id).where(Follow.follower_id == current_user.id)
        )
        user_ids = [r for (r,) in follows_res.all()]
        user_ids.append(current_user.id)
    else:
        # For You - all public users
        public_users_res = await db.execute(
            select(User.id).where(User.is_private == False, User.is_active == True)
        )
        user_ids = [r for (r,) in public_users_res.all()]
        
        # Exclude users who blocked current_user
        if current_user:
            blockers_res = await db.execute(
                select(Block.blocker_id).where(Block.blocked_id == current_user.id)
            )
            blocker_ids = [r[0] for r in blockers_res.all()]
            user_ids = [uid for uid in user_ids if uid not in blocker_ids]

    # Exclude blocked users from feed
    user_ids = [uid for uid in user_ids if uid not in blocked_ids]

    if not user_ids:
        return UnifiedFeedResponse(items=[], next_cursor=None)

    # Fetch both posts and reels
    posts_query = (
        select(Post)
        .where(Post.user_id.in_(user_ids), Post.is_archived == False)
        .order_by(Post.created_at.desc())
        .limit(limit * 2)
    )
    
    reels_query = (
        select(Reel)
        .where(Reel.user_id.in_(user_ids), Reel.status == "READY", Reel.is_public == True)
        .order_by(Reel.created_at.desc())
        .limit(limit * 2)
    )

    # Apply cursor pagination
    if cursor:
        try:
            ts = datetime.fromisoformat(cursor)
            posts_query = posts_query.where(Post.created_at < ts)
            reels_query = reels_query.where(Reel.created_at < ts)
        except (ValueError, TypeError):
            # Invalid cursor format - ignore and fetch from latest
            import logging
            logging.warning(f"Invalid cursor format: {cursor}")
            pass

    # Execute queries
    posts_rows = (await db.execute(posts_query)).scalars().all()
    reels_rows = (await db.execute(reels_query)).scalars().all()

    # Refresh author relationships
    for p in posts_rows:
        await db.refresh(p, ["author"])
    for r in reels_rows:
        await db.refresh(r, ["user"])

    # Batch-lookup station names for all posts that have a station_code
    station_codes = list({p.station_code for p in posts_rows if p.station_code})
    station_name_map: dict = {}
    if station_codes:
        st_res = await db.execute(
            select(StationMaster).where(StationMaster.station_code.in_(station_codes))
        )
        station_name_map = {st.station_code: st.station_name for st in st_res.scalars().all()}

    # Convert to unified items
    post_items = [_post_to_unified_item(p, station_name=station_name_map.get(p.station_code) if p.station_code else None) for p in posts_rows]
    reel_items = [_reel_to_unified_item(r) for r in reels_rows]

    # Merge and sort by created_at (newest first)
    all_items = post_items + reel_items
    all_items.sort(key=lambda x: x.created_at, reverse=True)

    # Apply limit
    has_more = len(all_items) > limit
    items = all_items[:limit]

    # Get viewer states if authenticated
    if current_user:
        # Convert UUID strings to uuid.UUID objects (handle asyncpg UUID type)
        post_ids = [uuid.UUID(str(i.id)) for i in items if i.item_type == "post"]
        reel_ids = [uuid.UUID(str(i.id)) for i in items if i.item_type == "reel"]
        author_ids = list(set([i.author.id for i in items]))

        # Default empty sets so variables are always defined
        liked_post_ids: set = set()
        bookmarked_post_ids: set = set()
        liked_reel_ids: set = set()
        saved_reel_ids: set = set()

        # Get liked/bookmarked posts
        if post_ids:
            liked_posts_res = await db.execute(
                select(Like.post_id).where(Like.user_id == current_user.id, Like.post_id.in_(post_ids))
            )
            liked_post_ids = {r[0] for r in liked_posts_res.all()}

            bookmarked_posts_res = await db.execute(
                select(Bookmark.post_id).where(Bookmark.user_id == current_user.id, Bookmark.post_id.in_(post_ids))
            )
            bookmarked_post_ids = {r[0] for r in bookmarked_posts_res.all()}

        # Get liked/saved reels
        if reel_ids:
            liked_reels_res = await db.execute(
                select(ReelLike.reel_id).where(ReelLike.user_id == current_user.id, ReelLike.reel_id.in_(reel_ids))
            )
            liked_reel_ids = {r[0] for r in liked_reels_res.all()}

            saved_reels_res = await db.execute(
                select(ReelSave.reel_id).where(ReelSave.user_id == current_user.id, ReelSave.reel_id.in_(reel_ids))
            )
            saved_reel_ids = {r[0] for r in saved_reels_res.all()}

        # Get followed authors
        followed_authors_res = await db.execute(
            select(Follow.followed_id).where(Follow.follower_id == current_user.id, Follow.followed_id.in_(author_ids))
        )
        followed_author_ids = {r[0] for r in followed_authors_res.all()}

        # Normalize all ID sets to strings for safe comparison
        liked_post_ids_str = {str(x) for x in liked_post_ids}
        bookmarked_post_ids_str = {str(x) for x in bookmarked_post_ids}
        liked_reel_ids_str = {str(x) for x in liked_reel_ids}
        saved_reel_ids_str = {str(x) for x in saved_reel_ids}
        followed_author_ids_str = {str(x) for x in followed_author_ids}

        # Update items with viewer states
        for item in items:
            item.viewer_followed = str(item.author.id) in followed_author_ids_str
            if item.item_type == "post":
                item.viewer_liked = str(item.id) in liked_post_ids_str
                item.viewer_bookmarked = str(item.id) in bookmarked_post_ids_str
            else:  # reel
                item.viewer_liked = str(item.id) in liked_reel_ids_str
                item.viewer_saved = str(item.id) in saved_reel_ids_str

    return UnifiedFeedResponse(
        items=items,
        next_cursor=items[-1].created_at.isoformat() if has_more and items else None,
    )
