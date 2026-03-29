import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.social import Bookmark, Comment, Like, Post
from api.models.user import User, Follow
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.schemas.social import (
    CommentCreate,
    CommentOut,
    CommentsResponse,
    FeedResponse,
    PostCreate,
    PostOut,
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


# ── Get single post ───────────────────────────────────────────────────────────

@router.get("/{post_id}", response_model=PostOut)
async def get_post(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
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
    if post.author.is_private and post.user_id != current_user.id:
        follow_result = await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id,
                Follow.followed_id == post.user_id,
            )
        )
        if not follow_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is private")

    liked_ids, bk_ids = await _viewer_flags(db, current_user.id, [post.id])
    followed_ids = await _viewer_follow_ids(db, current_user.id, [post.user_id])
    return _post_to_out(post, post.id in liked_ids, post.id in bk_ids, post.user_id in followed_ids)


# ── Delete post ───────────────────────────────────────────────────────────────

@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
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

    existing = await db.execute(
        select(Like).where(Like.user_id == current_user.id, Like.post_id == post_id)
    )
    like = existing.scalar_one_or_none()

    if like:
        # Unlike
        await db.delete(like)
        await db.execute(
            update(Post)
            .where(Post.id == post_id)
            .values(like_count=Post.like_count - 1)
        )
        liked = False
    else:
        # Like
        db.add(Like(user_id=current_user.id, post_id=post_id))
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

    await db.commit()
    return {"liked": liked}


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

    existing = await db.execute(
        select(Bookmark).where(Bookmark.user_id == current_user.id, Bookmark.post_id == post_id)
    )
    bk = existing.scalar_one_or_none()

    if bk:
        await db.delete(bk)
        await db.execute(
            update(Post)
            .where(Post.id == post_id)
            .values(bookmark_count=Post.bookmark_count - 1)
        )
        bookmarked = False
    else:
        db.add(Bookmark(user_id=current_user.id, post_id=post_id))
        await db.execute(
            update(Post)
            .where(Post.id == post_id)
            .values(bookmark_count=Post.bookmark_count + 1)
        )
        bookmarked = True

    await db.commit()
    return {"bookmarked": bookmarked}


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
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor")
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

    out = []
    for c in items:
        out.append(CommentOut(
            id=c.id,
            post_id=c.post_id,
            body=c.body,
            like_count=c.like_count,
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

    # Validate parent (must belong to same post, must be a root comment)
    if body.parent_id:
        parent_res = await db.execute(
            select(Comment).where(Comment.id == body.parent_id, Comment.post_id == post_id)
        )
        parent = parent_res.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent comment not found")
        if parent.parent_id is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reply to a reply")

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
    await create_notification(
        db,
        user_id=post.user_id,
        actor_id=current_user.id,
        notif_type=NotificationType.comment_post,
        target_id=post.id
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

    await db.execute(
        update(Post)
        .where(Post.id == comment.post_id)
        .values(comment_count=Post.comment_count - 1)
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
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor")
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
    current_user: Annotated[User, Depends(get_current_user)],
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
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor")
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
