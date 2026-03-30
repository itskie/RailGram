import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.social import Post
from api.models.user import Block, Follow, User
from app.core.deps import get_current_user, get_optional_user
from api.routes.posts import _viewer_flags, _viewer_follow_ids
from app.core.limiter import limiter
from app.schemas.social import AuthorBrief, FeedResponse, PostOut, UserProfileOut, ProfileUpdate
from app.services.notification_service import create_notification
from api.models.notification import NotificationType

router = APIRouter(prefix="/users", tags=["users"])


async def _get_by_username(db: AsyncSession, username: str) -> User:
    result = await db.execute(
        select(User).where(User.username == username, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/{username}", response_model=UserProfileOut)
async def get_profile(
    username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Optional[User] = Depends(get_optional_user),
):
    target = await _get_by_username(db, username)

    # Counts
    follower_count = (
        await db.execute(
            select(func.count()).select_from(Follow).where(Follow.followed_id == target.id)
        )
    ).scalar_one()
    following_count = (
        await db.execute(
            select(func.count()).select_from(Follow).where(Follow.follower_id == target.id)
        )
    ).scalar_one()
    post_count = (
        await db.execute(
            select(func.count()).select_from(Post).where(
                Post.user_id == target.id, Post.is_archived == False
            )
        )
    ).scalar_one()

    is_following = False
    is_blocked = False
    if current_user and target.id != current_user.id:
        follow_res = await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id, Follow.followed_id == target.id
            )
        )
        is_following = follow_res.scalar_one_or_none() is not None

        block_res = await db.execute(
            select(Block).where(
                Block.blocker_id == current_user.id, Block.blocked_id == target.id
            )
        )
        is_blocked = block_res.scalar_one_or_none() is not None

    return UserProfileOut(
        id=target.id,
        username=target.username,
        display_name=target.display_name,
        bio=target.bio,
        avatar_url=target.avatar_url,
        is_private=target.is_private,
        is_verified=target.is_verified,
        karma=target.karma,
        trains_spotted=target.trains_spotted,
        km_traveled=target.km_traveled,
        follower_count=follower_count,
        following_count=following_count,
        post_count=post_count,
        is_following=is_following,
        is_blocked=is_blocked,
        favourite_train=target.favourite_train,
        home_station=target.home_station,
        created_at=target.created_at,
    )


@router.put("/me/profile", response_model=UserProfileOut)
async def update_profile(
    data: ProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if data.display_name is not None:
        current_user.display_name = data.display_name
    if data.bio is not None:
        current_user.bio = data.bio
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    if data.favourite_train is not None:
        current_user.favourite_train = data.favourite_train
    if data.home_station is not None:
        current_user.home_station = data.home_station
    if data.is_private is not None:
        current_user.is_private = data.is_private

    await db.commit()
    await db.refresh(current_user)

    # Re-use get_profile logic or just return the updated user (simplified return for now)
    # To get full profile counts, we'd need more logic, but for a PUT response, 
    # the client usually just needs the confirmed values.
    return await get_profile(username=current_user.username, db=db, current_user=current_user)


# ── User posts ────────────────────────────────────────────────────────────────

@router.get("/{username}/posts", response_model=FeedResponse)
async def user_posts(
    username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Optional[User] = Depends(get_optional_user),
    cursor: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
):
    target = await _get_by_username(db, username)

    # Privacy gate
    if target.is_private and (not current_user or target.id != current_user.id):
        follow_ok = False
        if current_user:
            follow_res = await db.execute(
                select(Follow).where(
                    Follow.follower_id == current_user.id, Follow.followed_id == target.id
                )
            )
            follow_ok = follow_res.scalar_one_or_none() is not None
        if not follow_ok:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is private")

    query = (
        select(Post)
        .where(Post.user_id == target.id, Post.is_archived == False)
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

    liked_ids, bk_ids = set(), set()
    followed_author_ids = set()
    if current_user:
        post_ids = [p.id for p in items]
        liked_ids, bk_ids = await _viewer_flags(db, current_user.id, post_ids)
        author_ids = list({p.user_id for p in items})
        followed_author_ids = await _viewer_follow_ids(db, current_user.id, author_ids)

    from api.routes.posts import _post_to_out
    posts_out = [
        _post_to_out(p, p.id in liked_ids, p.id in bk_ids, p.user_id in followed_author_ids)
        for p in items
    ]
    return FeedResponse(
        posts=posts_out,
        next_cursor=items[-1].created_at.isoformat() if has_more else None,
    )


# ── Follow / unfollow ─────────────────────────────────────────────────────────

@router.post("/{username}/follow", status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
async def toggle_follow(
    request: Request,
    username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    target = await _get_by_username(db, username)
    if target.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself")

    existing = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id, Follow.followed_id == target.id
        )
    )
    follow = existing.scalar_one_or_none()

    if follow:
        await db.delete(follow)
        following = False
    else:
        # Check not blocked
        block_res = await db.execute(
            select(Block).where(
                Block.blocker_id == target.id, Block.blocked_id == current_user.id
            )
        )
        if block_res.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot follow this user")
        
        # If target is private, still follow (approval not implemented yet)
        # For now, private just means posts are hidden from non-followers
        db.add(Follow(follower_id=current_user.id, followed_id=target.id))
        following = True

        # Trigger Notification
        await create_notification(
            db,
            user_id=target.id,
            actor_id=current_user.id,
            notif_type=NotificationType.follow
        )

    await db.commit()
    return {"following": following}


# ── Block / unblock ───────────────────────────────────────────────────────────

@router.post("/{username}/block", status_code=status.HTTP_200_OK)
async def toggle_block(
    username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    target = await _get_by_username(db, username)
    if target.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot block yourself")

    existing = await db.execute(
        select(Block).where(
            Block.blocker_id == current_user.id, Block.blocked_id == target.id
        )
    )
    block = existing.scalar_one_or_none()

    if block:
        await db.delete(block)
        blocked = False
    else:
        db.add(Block(blocker_id=current_user.id, blocked_id=target.id))
        # Also unfollow each other
        await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id, Follow.followed_id == target.id
            )
        )
        for fk_pair in [
            (current_user.id, target.id),
            (target.id, current_user.id),
        ]:
            f = (
                await db.execute(
                    select(Follow).where(
                        Follow.follower_id == fk_pair[0], Follow.followed_id == fk_pair[1]
                    )
                )
            ).scalar_one_or_none()
            if f:
                await db.delete(f)
        blocked = True

    await db.commit()
    return {"blocked": blocked}


# ── Search users ──────────────────────────────────────────────────────────────

@router.get("", response_model=List[AuthorBrief])
async def search_users(
    q: str = Query(..., min_length=1, max_length=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=50),
):
    result = await db.execute(
        select(User)
        .where(
            User.is_active == True,
            (User.username.ilike(f"%{q}%") | User.display_name.ilike(f"%{q}%")),
        )
        .limit(limit)
    )
    users = result.scalars().all()
    return [
        AuthorBrief(
            id=u.id,
            username=u.username,
            display_name=u.display_name,
            avatar_url=u.avatar_url,
            karma=u.karma,
        )
        for u in users
    ]


# ── Followers / following lists ───────────────────────────────────────────────

@router.get("/{username}/followers", response_model=List[AuthorBrief])
async def get_followers(
    username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=100),
):
    target = await _get_by_username(db, username)

    result = await db.execute(
        select(User)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.followed_id == target.id)
        .limit(limit)
    )
    users = result.scalars().all()
    return [
        AuthorBrief(id=u.id, username=u.username, display_name=u.display_name, avatar_url=u.avatar_url)
        for u in users
    ]


@router.get("/{username}/following", response_model=List[AuthorBrief])
async def get_following(
    username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=100),
):
    target = await _get_by_username(db, username)

    result = await db.execute(
        select(User)
        .join(Follow, Follow.followed_id == User.id)
        .where(Follow.follower_id == target.id)
        .limit(limit)
    )
    users = result.scalars().all()
    return [
        AuthorBrief(id=u.id, username=u.username, display_name=u.display_name, avatar_url=u.avatar_url)
        for u in users
    ]
