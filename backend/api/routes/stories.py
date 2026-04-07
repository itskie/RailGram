import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.social import Story, StoryView, StoryReaction, StoryHide, StoryHighlight, StoryHighlightItem
from api.models.user import Follow, User
from app.core.deps import get_current_user, get_optional_user
from app.core.limiter import limiter
from app.schemas.social import (
    AuthorBrief, StoryCreate, StoryFeedItem, StoryOut,
    StoryReactionCreate, StoryViewerOut,
    HighlightCreate, HighlightItemAdd, HighlightOut, HighlightDetailOut, HighlightItemOut,
)

router = APIRouter(prefix="/stories", tags=["stories"])

CDN = "https://dzdr0nfpn0f2c.cloudfront.net/"


def _story_to_out(story: Story, viewed: bool = False, viewer_reaction: Optional[str] = None) -> StoryOut:
    return StoryOut(
        id=story.id,
        media_key=story.media_key,
        media_type=story.media_type,
        duration_secs=story.duration_secs,
        thumbnail_key=story.thumbnail_key,
        caption=story.caption,
        expires_at=story.expires_at,
        view_count=story.view_count,
        reaction_count=story.reaction_count,
        created_at=story.created_at,
        author=story.author,
        viewed=viewed,
        viewer_reaction=viewer_reaction,
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
        media_type=body.media_type,
        duration_secs=body.duration_secs,
        thumbnail_key=body.thumbnail_key,
        caption=body.caption,
        expires_at=expires_at,
    )
    db.add(story)
    await db.flush()

    # Add hide_from entries
    if body.hide_from:
        users_res = await db.execute(
            select(User).where(User.username.in_(body.hide_from))
        )
        hidden_users = users_res.scalars().all()
        for u in hidden_users:
            db.add(StoryHide(story_id=story.id, hidden_user_id=u.id))

    await db.refresh(story, ["author"])
    from app.services.karma import award_karma, KARMA
    await award_karma(db, current_user.id, delta=KARMA["story_posted"], reason="story_posted", ref_type="story", ref_id=str(story.id))
    await db.commit()
    return _story_to_out(story)


# ── Get feed (stories from following + own) ───────────────────────────────────

@router.get("/feed", response_model=List[StoryFeedItem])
async def stories_feed(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    now = datetime.now(timezone.utc)

    follows_res = await db.execute(
        select(Follow.followed_id).where(Follow.follower_id == current_user.id)
    )
    followed_ids = [r for (r,) in follows_res.all()]
    followed_ids.append(current_user.id)

    # Stories hidden from current user
    hidden_res = await db.execute(
        select(StoryHide.story_id).where(StoryHide.hidden_user_id == current_user.id)
    )
    hidden_ids = {r for (r,) in hidden_res.all()}

    stories_res = await db.execute(
        select(Story)
        .where(Story.user_id.in_(followed_ids), Story.expires_at > now)
        .order_by(Story.user_id, Story.created_at.asc())
    )
    stories = [s for s in stories_res.scalars().all() if s.id not in hidden_ids]

    for s in stories:
        await db.refresh(s, ["author"])

    story_ids = [s.id for s in stories]
    viewed_ids: set[uuid.UUID] = set()
    reaction_map: dict[uuid.UUID, str] = {}

    if story_ids:
        views_res = await db.execute(
            select(StoryView.story_id).where(
                StoryView.story_id.in_(story_ids),
                StoryView.user_id == current_user.id,
            )
        )
        viewed_ids = {r for (r,) in views_res.all()}

        reactions_res = await db.execute(
            select(StoryReaction.story_id, StoryReaction.emoji).where(
                StoryReaction.story_id.in_(story_ids),
                StoryReaction.user_id == current_user.id,
            )
        )
        reaction_map = {row.story_id: row.emoji for row in reactions_res.all()}

    user_map: dict[uuid.UUID, dict] = {}
    for s in stories:
        uid = s.user_id
        if uid not in user_map:
            user_map[uid] = {"user": s.author, "stories": []}
        user_map[uid]["stories"].append(
            _story_to_out(s, s.id in viewed_ids, reaction_map.get(s.id))
        )

    return [
        StoryFeedItem(
            user=AuthorBrief(
                id=data["user"].id,
                username=data["user"].username,
                display_name=data["user"].display_name,
                avatar_url=data["user"].avatar_url,
                karma=data["user"].karma,
            ),
            stories=data["stories"],
        )
        for data in user_map.values()
    ]


# ── My stories ────────────────────────────────────────────────────────────────

@router.get("/me", response_model=List[StoryOut])
async def my_stories(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(Story)
        .where(Story.user_id == current_user.id, Story.expires_at > now)
        .order_by(Story.created_at.asc())
    )
    stories = res.scalars().all()
    for s in stories:
        await db.refresh(s, ["author"])
    return [_story_to_out(s, True) for s in stories]


@router.get("/me/archive", response_model=List[StoryOut])
async def my_story_archive(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Return all stories (active + expired) for highlight creation."""
    res = await db.execute(
        select(Story)
        .where(Story.user_id == current_user.id)
        .order_by(Story.created_at.desc())
    )
    stories = res.scalars().all()
    for s in stories:
        await db.refresh(s, ["author"])
    return [_story_to_out(s, True) for s in stories]


# ══════════════════════════════════════════════════════════════════════════════
# HIGHLIGHTS — must be before /{story_id} to avoid route conflict
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/highlights/me", response_model=List[HighlightOut])
async def my_highlights_early(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(
        select(StoryHighlight).where(StoryHighlight.user_id == current_user.id).order_by(StoryHighlight.created_at.desc())
    )
    highlights = res.scalars().all()
    result = []
    for h in highlights:
        await db.refresh(h, ["items"])
        result.append(HighlightOut(id=h.id, title=h.title, cover_key=h.cover_key, item_count=len(h.items), created_at=h.created_at))
    return result


@router.get("/highlights/user/{username}", response_model=List[HighlightOut])
async def user_highlights_early(
    username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Optional[User], Depends(get_optional_user)] = None,
):
    user_res = await db.execute(select(User).where(User.username == username))
    u = user_res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    res = await db.execute(
        select(StoryHighlight).where(StoryHighlight.user_id == u.id).order_by(StoryHighlight.created_at.desc())
    )
    highlights = res.scalars().all()
    result = []
    for h in highlights:
        await db.refresh(h, ["items"])
        result.append(HighlightOut(id=h.id, title=h.title, cover_key=h.cover_key, item_count=len(h.items), created_at=h.created_at))
    return result


@router.get("/highlights/{highlight_id}", response_model=HighlightDetailOut)
async def get_highlight_early(
    highlight_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Optional[User], Depends(get_optional_user)] = None,
):
    res = await db.execute(select(StoryHighlight).where(StoryHighlight.id == highlight_id))
    h = res.scalar_one_or_none()
    if not h:
        raise HTTPException(status_code=404, detail="Highlight not found")
    await db.refresh(h, ["items"])
    items = [HighlightItemOut(id=i.id, media_key=i.media_key, media_type=i.media_type, thumbnail_key=i.thumbnail_key, caption=i.caption, added_at=i.added_at) for i in h.items]
    return HighlightDetailOut(id=h.id, title=h.title, cover_key=h.cover_key, items=items, created_at=h.created_at)


@router.post("/highlights", response_model=HighlightOut, status_code=status.HTTP_201_CREATED)
async def create_highlight_early(
    body: HighlightCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    h = StoryHighlight(user_id=current_user.id, title=body.title, cover_key=body.cover_key)
    db.add(h)
    await db.commit()
    await db.refresh(h)
    return HighlightOut(id=h.id, title=h.title, cover_key=h.cover_key, item_count=0, created_at=h.created_at)


@router.post("/highlights/{highlight_id}/items", status_code=status.HTTP_201_CREATED)
async def add_to_highlight_early(
    highlight_id: uuid.UUID,
    body: HighlightItemAdd,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    h_res = await db.execute(select(StoryHighlight).where(StoryHighlight.id == highlight_id))
    h = h_res.scalar_one_or_none()
    if not h or h.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Highlight not found")
    s_res = await db.execute(select(Story).where(Story.id == body.story_id))
    story = s_res.scalar_one_or_none()
    if not story or story.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Story not found")
    existing = await db.execute(
        select(StoryHighlightItem).where(
            StoryHighlightItem.highlight_id == highlight_id,
            StoryHighlightItem.story_id == body.story_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"detail": "Already in highlight"}
    item = StoryHighlightItem(
        highlight_id=highlight_id, story_id=body.story_id,
        media_key=story.media_key, media_type=story.media_type,
        thumbnail_key=story.thumbnail_key, caption=story.caption,
    )
    db.add(item)
    await db.commit()
    return {"detail": "Added"}


@router.delete("/highlights/{highlight_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_highlight_early(
    highlight_id: uuid.UUID, item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    h_res = await db.execute(select(StoryHighlight).where(StoryHighlight.id == highlight_id))
    h = h_res.scalar_one_or_none()
    if not h or h.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Highlight not found")
    await db.execute(delete(StoryHighlightItem).where(StoryHighlightItem.id == item_id))
    await db.commit()


@router.delete("/highlights/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlight_early(
    highlight_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    h_res = await db.execute(select(StoryHighlight).where(StoryHighlight.id == highlight_id))
    h = h_res.scalar_one_or_none()
    if not h or h.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Highlight not found")
    await db.delete(h)
    await db.commit()


@router.patch("/highlights/{highlight_id}", response_model=HighlightOut)
async def update_highlight_early(
    highlight_id: uuid.UUID, body: HighlightCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    h_res = await db.execute(select(StoryHighlight).where(StoryHighlight.id == highlight_id))
    h = h_res.scalar_one_or_none()
    if not h or h.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Highlight not found")
    h.title = body.title
    if body.cover_key is not None:
        h.cover_key = body.cover_key
    await db.commit()
    await db.refresh(h, ["items"])
    return HighlightOut(id=h.id, title=h.title, cover_key=h.cover_key, item_count=len(h.items), created_at=h.created_at)


# ── View a story — MUST be after all static routes ────────────────────────────

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
        raise HTTPException(status_code=404, detail="Story not found or expired")

    await db.refresh(story, ["author"])

    if story.author.is_private and story.user_id != current_user.id:
        follow_res = await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id,
                Follow.followed_id == story.user_id,
            )
        )
        if not follow_res.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="This account is private")

    # Get viewer reaction
    reaction_res = await db.execute(
        select(StoryReaction.emoji).where(
            StoryReaction.story_id == story_id,
            StoryReaction.user_id == current_user.id,
        )
    )
    viewer_reaction = reaction_res.scalar_one_or_none()

    # Record view
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

    return _story_to_out(story, viewed=already_viewed or story.user_id == current_user.id, viewer_reaction=viewer_reaction)


# ── Story viewers (owner only) ────────────────────────────────────────────────

@router.get("/{story_id}/viewers", response_model=List[StoryViewerOut])
async def story_viewers(
    story_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    story_res = await db.execute(select(Story).where(Story.id == story_id))
    story = story_res.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your story")

    views_res = await db.execute(
        select(StoryView).where(StoryView.story_id == story_id).order_by(StoryView.viewed_at.desc())
    )
    views = views_res.scalars().all()

    # Get reactions map
    reactions_res = await db.execute(
        select(StoryReaction.user_id, StoryReaction.emoji).where(StoryReaction.story_id == story_id)
    )
    reaction_map = {row.user_id: row.emoji for row in reactions_res.all()}

    result = []
    for v in views:
        user_res = await db.execute(select(User).where(User.id == v.user_id))
        u = user_res.scalar_one_or_none()
        if u:
            result.append(StoryViewerOut(
                user=AuthorBrief(id=u.id, username=u.username, display_name=u.display_name, avatar_url=u.avatar_url, karma=u.karma),
                viewed_at=v.viewed_at,
                reaction=reaction_map.get(v.user_id),
            ))
    return result


# ── React to a story ──────────────────────────────────────────────────────────

@router.post("/{story_id}/react", status_code=status.HTTP_200_OK)
async def react_to_story(
    story_id: uuid.UUID,
    body: StoryReactionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    story_res = await db.execute(select(Story).where(Story.id == story_id))
    story = story_res.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    existing = await db.execute(
        select(StoryReaction).where(
            StoryReaction.story_id == story_id,
            StoryReaction.user_id == current_user.id,
        )
    )
    reaction = existing.scalar_one_or_none()

    if reaction:
        if reaction.emoji == body.emoji:
            # Toggle off — remove reaction
            await db.delete(reaction)
            await db.execute(update(Story).where(Story.id == story_id).values(reaction_count=Story.reaction_count - 1))
            await db.commit()
            return {"reacted": False, "emoji": None}
        else:
            # Change emoji
            reaction.emoji = body.emoji
            await db.commit()
            return {"reacted": True, "emoji": body.emoji}
    else:
        db.add(StoryReaction(story_id=story_id, user_id=current_user.id, emoji=body.emoji))
        await db.execute(update(Story).where(Story.id == story_id).values(reaction_count=Story.reaction_count + 1))
        await db.commit()
        return {"reacted": True, "emoji": body.emoji}


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
        raise HTTPException(status_code=404, detail="Story not found")
    if story.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your story")
    await db.delete(story)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# HIGHLIGHTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/highlights/me", response_model=List[HighlightOut])
async def my_highlights(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(
        select(StoryHighlight).where(StoryHighlight.user_id == current_user.id).order_by(StoryHighlight.created_at.desc())
    )
    highlights = res.scalars().all()
    result = []
    for h in highlights:
        await db.refresh(h, ["items"])
        result.append(HighlightOut(id=h.id, title=h.title, cover_key=h.cover_key, item_count=len(h.items), created_at=h.created_at))
    return result


@router.get("/highlights/user/{username}", response_model=List[HighlightOut])
async def user_highlights(
    username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Optional[User], Depends(get_optional_user)] = None,
):
    user_res = await db.execute(select(User).where(User.username == username))
    u = user_res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    res = await db.execute(
        select(StoryHighlight).where(StoryHighlight.user_id == u.id).order_by(StoryHighlight.created_at.desc())
    )
    highlights = res.scalars().all()
    result = []
    for h in highlights:
        await db.refresh(h, ["items"])
        result.append(HighlightOut(id=h.id, title=h.title, cover_key=h.cover_key, item_count=len(h.items), created_at=h.created_at))
    return result


@router.get("/highlights/{highlight_id}", response_model=HighlightDetailOut)
async def get_highlight(
    highlight_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Optional[User], Depends(get_optional_user)] = None,
):
    res = await db.execute(select(StoryHighlight).where(StoryHighlight.id == highlight_id))
    h = res.scalar_one_or_none()
    if not h:
        raise HTTPException(status_code=404, detail="Highlight not found")
    await db.refresh(h, ["items"])
    items = [HighlightItemOut(id=i.id, media_key=i.media_key, media_type=i.media_type, thumbnail_key=i.thumbnail_key, caption=i.caption, added_at=i.added_at) for i in h.items]
    return HighlightDetailOut(id=h.id, title=h.title, cover_key=h.cover_key, items=items, created_at=h.created_at)


@router.post("/highlights", response_model=HighlightOut, status_code=status.HTTP_201_CREATED)
async def create_highlight(
    body: HighlightCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    h = StoryHighlight(user_id=current_user.id, title=body.title, cover_key=body.cover_key)
    db.add(h)
    await db.commit()
    await db.refresh(h)
    return HighlightOut(id=h.id, title=h.title, cover_key=h.cover_key, item_count=0, created_at=h.created_at)


@router.post("/highlights/{highlight_id}/items", status_code=status.HTTP_201_CREATED)
async def add_to_highlight(
    highlight_id: uuid.UUID,
    body: HighlightItemAdd,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    h_res = await db.execute(select(StoryHighlight).where(StoryHighlight.id == highlight_id))
    h = h_res.scalar_one_or_none()
    if not h or h.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Highlight not found")

    # Story may have expired — fetch without expiry check for highlights
    s_res = await db.execute(select(Story).where(Story.id == body.story_id))
    story = s_res.scalar_one_or_none()
    if not story or story.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Story not found")

    # Upsert
    existing = await db.execute(
        select(StoryHighlightItem).where(
            StoryHighlightItem.highlight_id == highlight_id,
            StoryHighlightItem.story_id == body.story_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"detail": "Already in highlight"}

    item = StoryHighlightItem(
        highlight_id=highlight_id,
        story_id=body.story_id,
        media_key=story.media_key,
        media_type=story.media_type,
        thumbnail_key=story.thumbnail_key,
        caption=story.caption,
    )
    db.add(item)
    await db.commit()
    return {"detail": "Added"}


@router.delete("/highlights/{highlight_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_highlight(
    highlight_id: uuid.UUID,
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    h_res = await db.execute(select(StoryHighlight).where(StoryHighlight.id == highlight_id))
    h = h_res.scalar_one_or_none()
    if not h or h.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Highlight not found")
    await db.execute(delete(StoryHighlightItem).where(StoryHighlightItem.id == item_id))
    await db.commit()


@router.delete("/highlights/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlight(
    highlight_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    h_res = await db.execute(select(StoryHighlight).where(StoryHighlight.id == highlight_id))
    h = h_res.scalar_one_or_none()
    if not h or h.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Highlight not found")
    await db.delete(h)
    await db.commit()


@router.patch("/highlights/{highlight_id}", response_model=HighlightOut)
async def update_highlight(
    highlight_id: uuid.UUID,
    body: HighlightCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    h_res = await db.execute(select(StoryHighlight).where(StoryHighlight.id == highlight_id))
    h = h_res.scalar_one_or_none()
    if not h or h.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Highlight not found")
    h.title = body.title
    if body.cover_key is not None:
        h.cover_key = body.cover_key
    await db.commit()
    await db.refresh(h, ["items"])
    return HighlightOut(id=h.id, title=h.title, cover_key=h.cover_key, item_count=len(h.items), created_at=h.created_at)
