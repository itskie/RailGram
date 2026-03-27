import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.social import Story, StoryView
from api.models.user import Follow, User
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.schemas.social import AuthorBrief, StoryCreate, StoryFeedItem, StoryOut

router = APIRouter(prefix="/stories", tags=["stories"])


def _story_to_out(story: Story, viewed: bool = False) -> StoryOut:
    return StoryOut(
        id=story.id,
        media_key=story.media_key,
        caption=story.caption,
        expires_at=story.expires_at,
        view_count=story.view_count,
        created_at=story.created_at,
        author=story.author,
        viewed=viewed,
    )


# ── Create story ──────────────────────────────────────────────────────────────

@router.post("", response_model=StoryOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_story(
    request: Request,
    body: StoryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    story = Story(
        user_id=current_user.id,
        media_key=body.media_key,
        caption=body.caption,
        expires_at=expires_at,
    )
    db.add(story)
    await db.flush()
    await db.refresh(story, ["author"])
    await db.commit()
    return _story_to_out(story)


# ── Get feed (stories from following) ────────────────────────────────────────

@router.get("/feed", response_model=List[StoryFeedItem])
async def stories_feed(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    now = datetime.now(timezone.utc)

    # Get followed user IDs
    follows_res = await db.execute(
        select(Follow.followed_id).where(Follow.follower_id == current_user.id)
    )
    followed_ids = [r for (r,) in follows_res.all()]
    followed_ids.append(current_user.id)

    # Fetch active stories for followed users
    stories_res = await db.execute(
        select(Story)
        .where(Story.user_id.in_(followed_ids), Story.expires_at > now)
        .order_by(Story.user_id, Story.created_at.asc())
    )
    stories = stories_res.scalars().all()

    # Load authors
    for s in stories:
        await db.refresh(s, ["author"])

    # Get viewer's story views
    story_ids = [s.id for s in stories]
    viewed_ids: set[uuid.UUID] = set()
    if story_ids:
        views_res = await db.execute(
            select(StoryView.story_id).where(
                StoryView.story_id.in_(story_ids),
                StoryView.user_id == current_user.id,
            )
        )
        viewed_ids = {r for (r,) in views_res.all()}

    # Group by user
    user_map: dict[uuid.UUID, dict] = {}
    for s in stories:
        uid = s.user_id
        if uid not in user_map:
            user_map[uid] = {"user": s.author, "stories": []}
        user_map[uid]["stories"].append(_story_to_out(s, s.id in viewed_ids))

    return [
        StoryFeedItem(
            user=AuthorBrief(
                id=data["user"].id,
                username=data["user"].username,
                display_name=data["user"].display_name,
                avatar_url=data["user"].avatar_url,
            ),
            stories=data["stories"],
        )
        for data in user_map.values()
    ]


# ── View a story ──────────────────────────────────────────────────────────────

@router.get("/{story_id}", response_model=StoryOut)
async def view_story(
    story_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Story).where(Story.id == story_id, Story.expires_at > now)
    )
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found or expired")

    await db.refresh(story, ["author"])

    # Privacy check
    if story.author.is_private and story.user_id != current_user.id:
        follow_res = await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id,
                Follow.followed_id == story.user_id,
            )
        )
        if not follow_res.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is private")

    # Record view (upsert — ignore duplicate)
    existing_view = await db.execute(
        select(StoryView).where(
            StoryView.story_id == story_id,
            StoryView.user_id == current_user.id,
        )
    )
    already_viewed = existing_view.scalar_one_or_none() is not None
    if not already_viewed and story.user_id != current_user.id:
        db.add(StoryView(story_id=story_id, user_id=current_user.id))
        await db.execute(
            update(Story).where(Story.id == story_id).values(view_count=Story.view_count + 1)
        )
        await db.commit()

    return _story_to_out(story, viewed=already_viewed or story.user_id == current_user.id)


# ── Delete story ──────────────────────────────────────────────────────────────

@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    if story.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your story")
    await db.delete(story)
    await db.commit()
