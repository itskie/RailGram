"""
Phase 4 – WIMT Tracking Routes

POST /trains/{train_no}/gps         — submit on-board GPS ping (auth required)
POST /trains/{train_no}/cell-tower  — submit cell tower signals for triangulation (auth required, 3+ towers)
POST /trains/{train_no}/spot        — spotter report at a station (auth required)
GET  /trains/{train_no}/live        — get current best-estimate position (public)
GET  /trains/{train_no}/track       — recent GPS trail, last 2 h (public)
"""
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.trains import StationMaster, TrainMaster
from api.models.tracking import GpsReport, SpotterReport, CellTowerReport, CellTowerCalibration
from api.models.user import User
from app.core.limiter import limiter
from app.core.deps import get_current_user
from app.schemas.tracking import (
    GpsReportCreate,
    GpsReportOut,
    SpotterReportCreate,
    SpotterReportOut,
    CellTowerReportCreate,
    CellTowerReportOut,
    TriangulationResultOut,
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


# ── Cell tower triangulation ──────────────────────────────────────────────────

@router.post(
    "/{train_no}/cell-tower",
    response_model=TriangulationResultOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit cell tower signals for train triangulation",
)
@limiter.limit("30/minute")
async def submit_cell_towers(
    request: Request,
    body: CellTowerReportCreate,
    train_no: Annotated[str, Path(min_length=1, max_length=10)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Submit cell tower signals (MCC/MNC/LAC/CID + RSSI) for triangulation.
    
    Requires 3+ tower signals. Works in tunnels and areas without GPS.
    Outputs interpolated position + confidence.
    
    Contributes to training tower calibration database passively.
    """
    # Validate train exists
    train_res = await db.execute(
        select(TrainMaster).where(TrainMaster.train_no == train_no)
    )
    if not train_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Train not found")

    # Fetch tower calibrations for triangulation
    from app.services.triangulation import CellTowerTriangulator, CellTowerSignal
    from app.services.calibration import CellTowerCalibrationService
    from api.models.tracking import CellTowerCalibration

    triangulation_signals = []
    unknown_nr_towers = []  # 5G/NR towers not yet in our DB

    for sig in body.signals:
        # Look up tower in calibration DB
        tower = await CellTowerCalibrationService.get_tower_or_none(
            db, sig.mcc, sig.mnc, sig.lac, sig.cid
        )

        if tower and tower.latitude and tower.longitude:
            confidence = tower.confidence_score if tower.confidence_score >= CellTowerCalibrationService.MIN_CONFIDENCE_FOR_USE else 0.2
            triangulation_signals.append(
                CellTowerSignal(
                    latitude=tower.latitude,
                    longitude=tower.longitude,
                    rssi_dbm=sig.rssi_dbm,
                    accuracy_m=tower.accuracy_m,
                    confidence=confidence,
                )
            )
        else:
            # Tower not in DB — track for crowdsourcing
            unknown_nr_towers.append(sig)

    # 5G NR crowdsourcing: if GPS present and unknown towers exist, seed them into DB
    if unknown_nr_towers and body.gps_lat and body.gps_lng:
        gps_accuracy = body.gps_accuracy_m or 50
        # Confidence proportional to GPS accuracy (50m → 0.85, 200m → 0.55)
        gps_confidence = max(0.40, min(0.85, 1.0 - (gps_accuracy / 300.0)))
        for sig in unknown_nr_towers:
            radio_type = (sig.radio or "NR").upper()
            operator_map = {
                10: "Airtel", 22: "Airtel", 40: "Airtel",
                60: "Jio", 66: "Jio", 78: "Jio",
                20: "Vodafone", 11: "Vodafone",
                45: "VI", 46: "VI",
                1: "BSNL", 5: "BSNL",
            }
            operator = operator_map.get(sig.mnc, "Unknown")
            new_tower = CellTowerCalibration(
                mcc=sig.mcc, mnc=sig.mnc, lac=sig.lac, cid=sig.cid,
                latitude=body.gps_lat, longitude=body.gps_lng,
                accuracy_m=gps_accuracy,
                confidence_score=gps_confidence,
                operator=operator,
                tower_name=f"{radio_type}-{sig.mcc}-{sig.mnc}-{sig.lac}-{sig.cid}",
                samples_count=1,
            )
            db.add(new_tower)
            # Also add it to this request's triangulation signals
            triangulation_signals.append(
                CellTowerSignal(
                    latitude=body.gps_lat,
                    longitude=body.gps_lng,
                    rssi_dbm=sig.rssi_dbm,
                    accuracy_m=gps_accuracy,
                    confidence=gps_confidence,
                )
            )

    # Perform triangulation if we have enough towers
    if len(triangulation_signals) < 3:
        # Graceful fallback: if GPS present, use it directly instead of failing
        if body.gps_lat and body.gps_lng:
            gps_accuracy = body.gps_accuracy_m or 100
            return TriangulationResultOut(
                latitude=body.gps_lat,
                longitude=body.gps_lng,
                accuracy_m=gps_accuracy,
                confidence=max(0.3, min(0.80, 1.0 - (gps_accuracy / 300.0))),
            )
        raise HTTPException(
            status_code=422,
            detail=f"Only {len(triangulation_signals)} calibrated tower(s) found (need 3+). "
                   f"Include gps_lat/gps_lng for 5G NR fallback or try again in better coverage.",
        )

    result = CellTowerTriangulator.triangulate(triangulation_signals)
    if not result:
        raise HTTPException(status_code=422, detail="Triangulation failed: towers not converging")

    # Store cell tower report for future calibration
    tower_ids_str = ",".join(f"{s.mcc},{s.mnc},{s.lac},{s.cid}" for s in body.signals)
    report = CellTowerReport(
        train_no=train_no,
        user_id=current_user.id,
        mcc=body.signals[0].mcc,
        mnc=body.signals[0].mnc,
        lac=body.signals[0].lac,
        cid=body.signals[0].cid,
        rssi_dbm=body.signals[0].rssi_dbm,
        tower_count=len(body.signals),
    )
    db.add(report)
    await db.flush()

    # Gamification: karma for cell tower submission
    from app.services.karma import award_karma, KARMA
    from app.services.badge import check_and_grant_badges
    from app.services.streak import record_activity
    await award_karma(db, current_user.id, delta=KARMA.get("cell_tower_submitted", 5), reason="cell_tower_submitted", ref_type="cell_tower", ref_id=str(report.id))
    await record_activity(db, current_user.id, "daily_spot")
    await check_and_grant_badges(db, current_user.id)

    # Update tower calibration based on successful triangulation
    await CellTowerCalibrationService.update_confidence_from_triangulation(
        db,
        result.latitude,
        result.longitude,
        result.accuracy_m,
        [(s.mcc, s.mnc, s.lac, s.cid) for s in body.signals],
    )

    await db.commit()

    # Bust position cache to reflect new triangulation
    from app.core.cache import get_redis
    redis = await get_redis()
    await redis.delete(f"train:position:{train_no}")

    return TriangulationResultOut(
        latitude=result.latitude,
        longitude=result.longitude,
        accuracy_m=result.accuracy_m,
        confidence=result.confidence,
    )


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


# ── Tower export (for mobile offline cache) ───────────────────────────────────

towers_router = APIRouter(prefix="/towers", tags=["towers"])


@towers_router.get(
    "/export",
    summary="Export cell tower calibration data for offline mobile use",
)
async def export_towers(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100_000,
    offset: int = 0,
):
    """
    Returns paginated cell tower calibration records for the mobile app to
    cache locally in SQLite — enabling offline triangulation.

    Only towers with confidence_score >= 0.3 and valid coordinates are included.
    Sorted by confidence_score DESC so the best towers come first.
    """
    safe_limit = min(limit, 200_000)
    result = await db.execute(
        select(
            CellTowerCalibration.mcc,
            CellTowerCalibration.mnc,
            CellTowerCalibration.lac,
            CellTowerCalibration.cid,
            CellTowerCalibration.latitude,
            CellTowerCalibration.longitude,
            CellTowerCalibration.accuracy_m,
            CellTowerCalibration.tower_name,
            CellTowerCalibration.operator,
            CellTowerCalibration.confidence_score,
        )
        .where(CellTowerCalibration.latitude.isnot(None))
        .where(CellTowerCalibration.longitude.isnot(None))
        .where(CellTowerCalibration.confidence_score >= 0.3)
        .order_by(desc(CellTowerCalibration.confidence_score))
        .limit(safe_limit)
        .offset(offset)
    )
    rows = result.all()
    towers = [
        {
            "mcc": r.mcc,
            "mnc": r.mnc,
            "lac": r.lac,
            "cid": r.cid,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "accuracy_m": r.accuracy_m,
            "tower_name": r.tower_name,
            "operator": r.operator,
            "confidence_score": r.confidence_score,
        }
        for r in rows
    ]
    return {"towers": towers, "count": len(towers), "offset": offset}
