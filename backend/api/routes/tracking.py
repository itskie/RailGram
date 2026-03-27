"""
Phase 4 – WIMT Tracking Routes

POST /trains/{train_no}/gps    — submit on-board GPS ping (auth required)
POST /trains/{train_no}/spot   — spotter report at a station (auth required)
GET  /trains/{train_no}/live   — get current best-estimate position (public)
GET  /trains/{train_no}/track  — recent GPS trail, last 2 h (public)
"""
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.trains import StationMaster, TrainMaster
from api.models.tracking import GpsReport, SpotterReport
from api.models.user import User
from app.core.limiter import limiter
from app.core.deps import get_current_user
from app.schemas.tracking import (
    GpsReportCreate,
    GpsReportOut,
    SpotterReportCreate,
    SpotterReportOut,
    TrainPositionOut,
)
from app.services.interpolation import IST
from app.services.truth_engine import compute_position

router = APIRouter(prefix="/trains", tags=["tracking"])


# ── GPS report ────────────────────────────────────────────────────────────────

@router.post(
    "/{train_no}/gps",
    response_model=GpsReportOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit on-board GPS ping for a train",
)
@limiter.limit("60/minute")
async def submit_gps(
    request: Request,
    body: GpsReportCreate,
    train_no: Annotated[str, Path(min_length=1, max_length=10)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(TrainMaster).where(TrainMaster.train_no == train_no)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Train not found")

    report = GpsReport(
        train_no=train_no,
        user_id=current_user.id,
        latitude=body.latitude,
        longitude=body.longitude,
        accuracy_m=body.accuracy_m,
        speed_kmh=body.speed_kmh,
        altitude_m=body.altitude_m,
    )
    db.add(report)
    await db.flush()

    # Gamification: karma + streak + badge check
    from app.services.karma import award_karma, KARMA
    from app.services.badge import check_and_grant_badges
    from app.services.streak import record_activity
    await award_karma(db, current_user.id, delta=KARMA["gps_submitted"], reason="gps_submitted", ref_type="gps", ref_id=str(report.id))
    await record_activity(db, current_user.id, "daily_spot")
    await check_and_grant_badges(db, current_user.id)

    await db.commit()
    await db.refresh(report)

    # Invalidate stale cached position so next /live gets fresh data
    from app.core.cache import get_redis
    redis = await get_redis()
    await redis.delete(f"train:position:{train_no}")

    return report


# ── Spotter report ────────────────────────────────────────────────────────────

@router.post(
    "/{train_no}/spot",
    response_model=SpotterReportOut,
    status_code=status.HTTP_201_CREATED,
    summary="Report a train sighting at a station",
)
@limiter.limit("20/minute")
async def submit_spot(
    request: Request,
    body: SpotterReportCreate,
    train_no: Annotated[str, Path(min_length=1, max_length=10)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Validate train
    train_res = await db.execute(
        select(TrainMaster).where(TrainMaster.train_no == train_no)
    )
    if not train_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Train not found")

    # Validate station
    st_res = await db.execute(
        select(StationMaster).where(StationMaster.station_code == body.station_code)
    )
    if not st_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Station not found")

    report = SpotterReport(
        train_no=train_no,
        user_id=current_user.id,
        station_code=body.station_code,
        event_type=body.event_type,
        delay_minutes=body.delay_minutes,
        notes=body.notes,
    )
    db.add(report)
    await db.flush()

    # Gamification: karma + streak + badge check + trains_spotted counter
    from sqlalchemy import update as sqla_update
    from app.services.karma import award_karma, KARMA
    from app.services.badge import check_and_grant_badges
    from app.services.streak import record_activity
    await award_karma(db, current_user.id, delta=KARMA["spot_submitted"], reason="spot_submitted", ref_type="spot", ref_id=str(report.id))
    await db.execute(sqla_update(User).where(User.id == current_user.id).values(trains_spotted=User.trains_spotted + 1))
    await record_activity(db, current_user.id, "daily_spot")
    await check_and_grant_badges(db, current_user.id)

    await db.commit()
    await db.refresh(report)

    # Bust cache so /live reflects this report immediately
    from app.core.cache import get_redis
    redis = await get_redis()
    await redis.delete(f"train:position:{train_no}")

    return report


# ── Live position ─────────────────────────────────────────────────────────────

@router.get(
    "/{train_no}/live",
    response_model=TrainPositionOut,
    summary="Get current best-estimate position of a train",
)
async def get_live_position(
    train_no: Annotated[str, Path(min_length=1, max_length=10)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Returns the train's current position computed from (in priority order):
    1. On-board GPS pings (< 15 min old)
    2. Station spotter reports (< 4 h old) + schedule interpolation
    3. Pure schedule interpolation

    Confidence field indicates data freshness:  0.95 = live GPS, 0.30 = schedule only.
    A 503 is returned when the train is not running today or all stations lack coordinates.
    """
    train_res = await db.execute(
        select(TrainMaster).where(TrainMaster.train_no == train_no)
    )
    if not train_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Train not found")

    position = await compute_position(train_no, db)
    if not position:
        raise HTTPException(
            status_code=503,
            detail=(
                "Position unavailable — train may not be running today "
                "or schedule stations lack GPS coordinates"
            ),
        )
    return position


# ── GPS track history ─────────────────────────────────────────────────────────

@router.get(
    "/{train_no}/track",
    response_model=list[GpsReportOut],
    summary="Recent GPS pings for a train (last 2 hours)",
)
async def get_track_history(
    train_no: Annotated[str, Path(min_length=1, max_length=10)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
):
    cutoff = datetime.now(IST) - timedelta(hours=2)
    result = await db.execute(
        select(GpsReport)
        .where(GpsReport.train_no == train_no)
        .where(GpsReport.created_at >= cutoff)
        .order_by(desc(GpsReport.created_at))
        .limit(min(limit, 100))
    )
    return result.scalars().all()
