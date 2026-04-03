"""Public reports endpoint — authenticated users can report posts/reels."""
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.report import ContentReport
from api.models.social import Post
from api.models.reel import Reel
from app.core.deps import get_current_user
from api.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])

VALID_REASONS = {"spam", "hate", "violence", "nudity", "misinformation", "other"}


class ReportCreate(BaseModel):
    post_id: Optional[uuid.UUID] = None
    reel_id: Optional[uuid.UUID] = None
    reason: str
    details: Optional[str] = None

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if v not in VALID_REASONS:
            raise ValueError(f"reason must be one of {VALID_REASONS}")
        return v

    @field_validator("details")
    @classmethod
    def trim_details(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v[:500]
        return v


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_report(
    body: ReportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not body.post_id and not body.reel_id:
        raise HTTPException(status_code=400, detail="post_id or reel_id is required")
    if body.post_id and body.reel_id:
        raise HTTPException(status_code=400, detail="Provide either post_id or reel_id, not both")

    # Verify target exists
    if body.post_id:
        result = await db.execute(select(Post).where(Post.id == body.post_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Post not found")
    else:
        result = await db.execute(select(Reel).where(Reel.id == body.reel_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Reel not found")

    # Prevent duplicate reports from same user
    existing_q = select(ContentReport).where(
        ContentReport.reporter_id == current_user.id,
        ContentReport.post_id == body.post_id if body.post_id else ContentReport.reel_id == body.reel_id,
    )
    existing = (await db.execute(existing_q)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="You have already reported this content")

    report = ContentReport(
        reporter_id=current_user.id,
        post_id=body.post_id,
        reel_id=body.reel_id,
        reason=body.reason,
        details=body.details,
    )
    db.add(report)
    await db.commit()
    return {"message": "Report submitted"}
