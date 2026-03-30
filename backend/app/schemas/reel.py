"""Pydantic schemas for the Reels module."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Upload ─────────────────────────────────────────────────────────────────────

class ReelUploadUrlRequest(BaseModel):
    filename: str = Field(..., description="Original filename e.g. my_reel.mp4")
    content_type: str = Field(..., description="MIME type e.g. video/mp4")
    file_size_bytes: int = Field(..., gt=0, le=1_073_741_824, description="Max 1 GB")


class ReelUploadUrlResponse(BaseModel):
    upload_url: str
    s3_key: str
    fields: dict = {}   # For pre-signed POST form fields (empty for PUT)


# ── Create / Update ────────────────────────────────────────────────────────────

class ReelCreate(BaseModel):
    s3_key: str
    title: str = Field("", max_length=100)
    description: str = Field("", max_length=2200)
    train_number: Optional[str] = Field(None, max_length=10)
    train_name: Optional[str] = Field(None, max_length=100)
    station_tag: Optional[str] = Field(None, max_length=100)
    duration_secs: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_bytes: Optional[int] = None
    is_public: bool = True


class ReelUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=2200)
    train_number: Optional[str] = Field(None, max_length=10)
    train_name: Optional[str] = Field(None, max_length=100)
    station_tag: Optional[str] = Field(None, max_length=100)
    is_public: Optional[bool] = None


# ── Response ───────────────────────────────────────────────────────────────────

class ReelAuthor(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    viewer_followed: bool = Field(False, description="Whether the current viewer is following this author")

    model_config = {"from_attributes": True}


class ReelOut(BaseModel):
    id: uuid.UUID
    user: ReelAuthor
    title: str
    description: str
    train_number: Optional[str]
    train_name: Optional[str]
    station_tag: Optional[str]
    hls_url: Optional[str]       # CloudFront HLS master playlist URL
    thumbnail_url: Optional[str] # CloudFront thumbnail URL
    duration_secs: Optional[int]
    status: str
    views: int
    likes_count: int
    comments_count: int
    saves_count: int
    is_public: bool
    # Viewer-specific state (requires auth)
    viewer_liked: bool = False
    viewer_saved: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class ReelFeedResponse(BaseModel):
    items: list[ReelOut]
    next_cursor: Optional[str] = None


# ── Comments ───────────────────────────────────────────────────────────────────

class ReelCommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=1000)
    parent_id: Optional[uuid.UUID] = None


class ReelCommentOut(BaseModel):
    id: uuid.UUID
    reel_id: uuid.UUID
    user: ReelAuthor
    parent_id: Optional[uuid.UUID]
    body: str
    like_count: int = 0
    reply_count: int = 0
    created_at: datetime
    replies: list["ReelCommentOut"] = []

    model_config = {"from_attributes": True}


# ── Status update (webhook / Lambda callback) ──────────────────────────────────

class ReelStatusUpdate(BaseModel):
    reel_id: uuid.UUID
    status: str          # "ready" | "failed"
    hls_key: Optional[str] = None
    thumbnail_key: Optional[str] = None
    duration_secs: Optional[int] = None


# ── View recording ─────────────────────────────────────────────────────────────

class ReelViewRecord(BaseModel):
    watched_secs: int = Field(..., ge=0)
