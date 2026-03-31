import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ── Auth user snippet (avoids circular import) ────────────────────────────────

class AuthorBrief(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    karma: int = 0

    model_config = {"from_attributes": True}


# ── Post ─────────────────────────────────────────────────────────────────────

class PostCreate(BaseModel):
    post_type: Literal["photo", "reel", "loco_spot", "offlink"] = "photo"
    caption: Optional[str] = Field(None, max_length=2200)
    media_keys: List[str] = Field(..., min_length=1, max_length=10)
    thumbnail_key: Optional[str] = None
    location_name: Optional[str] = Field(None, max_length=120)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    train_no: Optional[str] = Field(None, max_length=10)
    station_code: Optional[str] = Field(None, max_length=10)
    # Loco-spot fields
    loco_class: Optional[str] = Field(None, max_length=30)
    loco_number: Optional[str] = Field(None, max_length=20)
    loco_shed: Optional[str] = Field(None, max_length=60)
    loco_zone: Optional[str] = Field(None, max_length=10)

    @field_validator("media_keys")
    @classmethod
    def keys_not_empty(cls, v: List[str]) -> List[str]:
        if any(not k.strip() for k in v):
            raise ValueError("media_keys must not contain empty strings")
        return v


class PostOut(BaseModel):
    id: uuid.UUID
    post_type: str
    caption: Optional[str] = None
    media_keys: List[str]
    thumbnail_key: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    train_no: Optional[str] = None
    station_code: Optional[str] = None
    loco_class: Optional[str] = None
    loco_number: Optional[str] = None
    loco_shed: Optional[str] = None
    loco_zone: Optional[str] = None
    like_count: int
    comment_count: int
    bookmark_count: int
    is_archived: bool
    created_at: datetime
    author: AuthorBrief
    # Viewer-specific (populated in route)
    liked: bool = False
    bookmarked: bool = False
    viewer_followed: bool = False

    model_config = {"from_attributes": True}


class FeedResponse(BaseModel):
    posts: List[PostOut]
    next_cursor: Optional[str] = None  # ISO timestamp of oldest post for pagination


# ── Comment ──────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=1000)
    parent_id: Optional[uuid.UUID] = None


class CommentOut(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    body: str
    like_count: int
    parent_id: Optional[uuid.UUID] = None
    created_at: datetime
    author: AuthorBrief
    reply_count: int = 0

    model_config = {"from_attributes": True}


class CommentsResponse(BaseModel):
    comments: List[CommentOut]
    next_cursor: Optional[str] = None


# ── Story ────────────────────────────────────────────────────────────────────

class StoryCreate(BaseModel):
    media_key: str
    caption: Optional[str] = Field(None, max_length=300)


class StoryOut(BaseModel):
    id: uuid.UUID
    media_key: str
    caption: Optional[str] = None
    expires_at: datetime
    view_count: int
    created_at: datetime
    author: AuthorBrief
    viewed: bool = False  # has the current user viewed this

    model_config = {"from_attributes": True}


class StoryFeedItem(BaseModel):
    user: AuthorBrief
    stories: List[StoryOut]


# ── Media presign ─────────────────────────────────────────────────────────────

class PresignRequest(BaseModel):
    filename: str = Field(..., max_length=255)
    content_type: str = Field(..., max_length=100)
    purpose: Literal["post", "story", "avatar"] = "post"


class PresignResponse(BaseModel):
    key: str
    upload_url: str
    cdn_url: str
    expires_in: int  # seconds


# ── User public profile ───────────────────────────────────────────────────────

class UserProfileOut(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    bio: str
    avatar_url: Optional[str] = None
    favourite_train: Optional[str] = None
    home_station: Optional[str] = None
    is_private: bool
    is_verified: bool
    karma: int
    trains_spotted: int
    km_traveled: int
    follower_count: int
    following_count: int
    post_count: int
    is_following: bool = False
    is_blocked: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=60)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None
    favourite_train: Optional[str] = Field(None, max_length=100)
    home_station: Optional[str] = Field(None, max_length=100)
    is_private: Optional[bool] = None


# ── Unified Feed (Posts + Reels) ─────────────────────────────────────────────

class UnifiedFeedItem(BaseModel):
    """Represents either a post or a reel in the unified feed."""
    item_type: Literal["post", "reel"]
    id: uuid.UUID
    created_at: datetime
    # For posts
    post_type: Optional[str] = None
    caption: Optional[str] = None
    media_keys: Optional[List[str]] = None
    thumbnail_key: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    train_no: Optional[str] = None
    station_code: Optional[str] = None
    loco_class: Optional[str] = None
    loco_number: Optional[str] = None
    loco_shed: Optional[str] = None
    loco_zone: Optional[str] = None
    like_count: Optional[int] = None
    comment_count: Optional[int] = None
    bookmark_count: Optional[int] = None
    # For reels
    title: Optional[str] = None
    description: Optional[str] = None
    hls_url: Optional[str] = None
    reel_thumbnail_url: Optional[str] = None
    duration_secs: Optional[int] = None
    views: Optional[int] = None
    likes_count: Optional[int] = None
    comments_count: Optional[int] = None
    saves_count: Optional[int] = None
    # Common
    author: AuthorBrief
    viewer_liked: bool = False
    viewer_bookmarked: bool = False
    viewer_saved: bool = False
    viewer_followed: bool = False


class UnifiedFeedResponse(BaseModel):
    items: List[UnifiedFeedItem]
    next_cursor: Optional[str] = None
