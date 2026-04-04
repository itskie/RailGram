"""Admin-only routes — requires is_admin=True on the authenticated user."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.database import get_db
from api.models.notification import Notification
from api.models.report import ContentReport
from api.models.social import Post, Comment
from api.models.reel import Reel
from api.models.user import User
from app.core.deps import get_admin_user

router = APIRouter(prefix="/admin", tags=["admin"])

# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_out(u: User) -> dict:
    return {
        "id": str(u.id),
        "username": u.username,
        "email": u.email,
        "display_name": u.display_name,
        "avatar_url": u.avatar_url,
        "is_active": u.is_active,
        "is_verified": u.is_verified,
        "is_email_verified": u.is_email_verified,
        "is_admin": u.is_admin,
        "karma": u.karma,
        "trains_spotted": u.trains_spotted,
        "created_at": u.created_at.isoformat(),
    }


def _report_out(r: ContentReport) -> dict:
    return {
        "id": str(r.id),
        "reporter_id": str(r.reporter_id),
        "reporter_username": r.reporter.username if r.reporter else None,
        "post_id": str(r.post_id) if r.post_id else None,
        "reel_id": str(r.reel_id) if r.reel_id else None,
        "reason": r.reason,
        "details": r.details,
        "status": r.status,
        "admin_note": r.admin_note,
        "created_at": r.created_at.isoformat(),
        "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
    }


# ── Dashboard stats ───────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    _admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar()
    active_users = (await db.execute(select(func.count()).select_from(User).where(User.is_active == True))).scalar()
    new_today = (await db.execute(select(func.count()).select_from(User).where(User.created_at >= day_ago))).scalar()
    new_week = (await db.execute(select(func.count()).select_from(User).where(User.created_at >= week_ago))).scalar()
    total_posts = (await db.execute(select(func.count()).select_from(Post))).scalar()
    total_reels = (await db.execute(select(func.count()).select_from(Reel))).scalar()
    total_comments = (await db.execute(select(func.count()).select_from(Comment))).scalar()
    pending_reports = (await db.execute(
        select(func.count()).select_from(ContentReport).where(ContentReport.status == "pending")
    )).scalar()
    total_reports = (await db.execute(select(func.count()).select_from(ContentReport))).scalar()

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "new_today": new_today,
            "new_this_week": new_week,
        },
        "content": {
            "total_posts": total_posts,
            "total_reels": total_reels,
            "total_comments": total_comments,
        },
        "reports": {
            "pending": pending_reports,
            "total": total_reports,
        },
    }


# ── User management ───────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    _admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
):
    q = select(User)
    if search:
        q = q.where(User.username.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
    if is_active is not None:
        q = q.where(User.is_active == is_active)
    q = q.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    users = result.scalars().all()

    total_q = select(func.count()).select_from(User)
    if search:
        total_q = total_q.where(User.username.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
    if is_active is not None:
        total_q = total_q.where(User.is_active == is_active)
    total = (await db.execute(total_q)).scalar()

    # Fetch post + reel counts per user in bulk
    user_ids = [u.id for u in users]
    post_counts: dict = {}
    reel_counts: dict = {}
    if user_ids:
        pc_rows = await db.execute(
            select(Post.user_id, func.count().label("cnt")).where(Post.user_id.in_(user_ids)).group_by(Post.user_id)
        )
        post_counts = {row.user_id: row.cnt for row in pc_rows}
        rc_rows = await db.execute(
            select(Reel.user_id, func.count().label("cnt")).where(Reel.user_id.in_(user_ids)).group_by(Reel.user_id)
        )
        reel_counts = {row.user_id: row.cnt for row in rc_rows}

    def _user_with_counts(u: User) -> dict:
        d = _user_out(u)
        d["post_count"] = post_counts.get(u.id, 0)
        d["reel_count"] = reel_counts.get(u.id, 0)
        return d

    return {"users": [_user_with_counts(u) for u in users], "total": total, "page": page, "per_page": per_page}


@router.put("/users/{user_id}/ban")
async def ban_user(
    user_id: uuid.UUID,
    admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
    return {"message": f"User {user.username} banned"}


@router.put("/users/{user_id}/unban")
async def unban_user(
    user_id: uuid.UUID,
    _admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    await db.commit()
    return {"message": f"User {user.username} unbanned"}


@router.put("/users/{user_id}/verify")
async def verify_user(
    user_id: uuid.UUID,
    _admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = True
    await db.commit()
    return {"message": f"User {user.username} verified"}


@router.put("/users/{user_id}/unverify")
async def unverify_user(
    user_id: uuid.UUID,
    _admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = False
    await db.commit()
    return {"message": f"User {user.username} unverified"}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()


# ── Karma management ──────────────────────────────────────────────────────────

class KarmaUpdate(BaseModel):
    delta: int  # positive = award, negative = deduct


@router.put("/users/{user_id}/karma")
async def update_karma(
    user_id: uuid.UUID,
    body: KarmaUpdate,
    _admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.karma = max(0, user.karma + body.delta)
    await db.commit()
    return {"karma": user.karma}


# ── Content moderation ────────────────────────────────────────────────────────

@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    _admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await db.delete(post)
    await db.commit()


@router.delete("/reels/{reel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reel(
    reel_id: uuid.UUID,
    _admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Reel).where(Reel.id == reel_id))
    reel = result.scalar_one_or_none()
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")
    await db.delete(reel)
    await db.commit()


# ── Reports queue ─────────────────────────────────────────────────────────────

@router.get("/reports")
async def list_reports(
    _admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    report_status: Optional[str] = Query(None, alias="status"),
):
    q = select(ContentReport).options(selectinload(ContentReport.reporter))
    if report_status:
        q = q.where(ContentReport.status == report_status)
    q = q.order_by(ContentReport.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    reports = result.scalars().all()

    total_q = select(func.count()).select_from(ContentReport)
    if report_status:
        total_q = total_q.where(ContentReport.status == report_status)
    total = (await db.execute(total_q)).scalar()

    return {"reports": [_report_out(r) for r in reports], "total": total, "page": page, "per_page": per_page}


class ReportUpdate(BaseModel):
    status: str  # "reviewed" | "resolved" | "dismissed"
    admin_note: Optional[str] = None


@router.put("/reports/{report_id}")
async def update_report(
    report_id: uuid.UUID,
    body: ReportUpdate,
    _admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    valid_statuses = {"reviewed", "resolved", "dismissed"}
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"status must be one of {valid_statuses}")

    result = await db.execute(
        select(ContentReport).options(selectinload(ContentReport.reporter)).where(ContentReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = body.status
    if body.admin_note is not None:
        report.admin_note = body.admin_note
    report.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    return _report_out(report)


# ── Broadcast notifications ───────────────────────────────────────────────────

class BroadcastBody(BaseModel):
    message: str
    notif_type: str = "system"


@router.post("/broadcast")
async def broadcast_notification(
    body: BroadcastBody,
    admin: Annotated[User, Depends(get_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if len(body.message) > 300:
        raise HTTPException(status_code=400, detail="Message too long (max 300 chars)")

    user_ids_result = await db.execute(select(User.id).where(User.is_active == True))
    user_ids = [row[0] for row in user_ids_result.all()]

    notifications = [
        Notification(
            user_id=uid,
            actor_id=admin.id,
            notif_type="mention",  # closest generic type supported by the model
            target_id=None,
        )
        for uid in user_ids
    ]
    db.add_all(notifications)
    await db.commit()
    return {"sent_to": len(notifications)}
