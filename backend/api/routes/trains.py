"""
Phase 2: Train Data Routes

GET  /trains/search          - search by train number or name
GET  /trains/{train_no}      - train brief (no schedule)
GET  /trains/{train_no}/schedule  - full timetable
GET  /stations               - search / list stations
GET  /stations/{code}        - station detail
GET  /stations/geojson       - all major stations as GeoJSON FeatureCollection
"""
from typing import Optional
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, aliased

from api.database import get_db
from api.models.trains import StationMaster, TripSchedule, TrainMaster
from app.schemas.trains import (
    ScheduleStop,
    StationBoardEntry,
    StationBoardResponse,
    StationDetail,
    StationGeoJSON,
    StationSearchResponse,
    TrainBetweenResult,
    TrainBrief,
    TrainSchedule,
    TrainSearchResponse,
)

router = APIRouter(prefix="/trains", tags=["trains"])
stations_router = APIRouter(prefix="/stations", tags=["stations"])


# ─────────────────────────── Trains ────────────────────────────────────────

@router.get("/search", response_model=TrainSearchResponse)
async def search_trains(
    q: str = Query(..., min_length=1, max_length=100, description="Train number or name"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search trains by number prefix or name substring (ILIKE), filtered to today's operational trains (IST)."""
    offset = (page - 1) * limit
    pattern = f"%{q}%"

    # Today's weekday in IST (0=Mon … 6=Sun); SQL SUBSTR is 1-indexed
    today_wd = datetime.now(ZoneInfo("Asia/Kolkata")).weekday()
    day_filter = or_(
        TrainMaster.runs_on.is_(None),
        func.length(TrainMaster.runs_on) < 7,
        func.substr(TrainMaster.runs_on, today_wd + 1, 1) == "1",
    )

    base = select(TrainMaster).where(
        or_(
            TrainMaster.train_no.ilike(pattern),
            TrainMaster.name.ilike(pattern),
        )
    ).where(day_filter)
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar_one()

    result = await db.execute(
        base.order_by(TrainMaster.train_no).offset(offset).limit(limit)
    )
    trains = result.scalars().all()
    return TrainSearchResponse(
        trains=[TrainBrief.model_validate(t) for t in trains],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/list", response_model=TrainSearchResponse)
async def list_trains(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List all trains (paginated)."""
    offset = (page - 1) * limit
    
    total_result = await db.execute(select(func.count()).select_from(TrainMaster))
    total = total_result.scalar_one()

    result = await db.execute(
        select(TrainMaster).order_by(TrainMaster.train_no).offset(offset).limit(limit)
    )
    trains = result.scalars().all()
    return TrainSearchResponse(
        trains=[TrainBrief.model_validate(t) for t in trains],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/between", response_model=list[TrainBetweenResult])
async def trains_between(
    from_code: str = Query(..., min_length=2, max_length=10, description="Origin station code"),
    to_code: str = Query(..., min_length=2, max_length=10, description="Destination station code"),
    db: AsyncSession = Depends(get_db),
):
    """Find all trains that stop at from_code before to_code in sequence."""

    def _hhmm_to_min(t: Optional[str]) -> Optional[int]:
        if not t:
            return None
        try:
            h, m = t.strip().split(":")
            return int(h) * 60 + int(m)
        except Exception:
            return None

    fs = aliased(TripSchedule, name="from_stop")
    ts = aliased(TripSchedule, name="to_stop")

    # Today's weekday in IST (0=Mon … 6=Sun); SQL SUBSTR is 1-indexed
    today_wd = datetime.now(ZoneInfo("Asia/Kolkata")).weekday()
    day_filter = or_(
        TrainMaster.runs_on.is_(None),
        func.length(TrainMaster.runs_on) < 7,
        func.substr(TrainMaster.runs_on, today_wd + 1, 1) == "1",
    )

    stmt = (
        select(TrainMaster, fs, ts)
        .join(fs, fs.train_id == TrainMaster.id)
        .join(ts, ts.train_id == TrainMaster.id)
        .where(fs.station_code == from_code.strip().upper())
        .where(ts.station_code == to_code.strip().upper())
        .where(fs.sequence < ts.sequence)
        .where(day_filter)
        .order_by(fs.departure_time)
        .limit(200)
    )
    result = await db.execute(stmt)
    rows = result.all()

    out: list[TrainBetweenResult] = []
    for row in rows:
        train_obj = row[0]
        from_s = row[1]
        to_s = row[2]

        dep_min = _hhmm_to_min(from_s.departure_time or from_s.arrival_time)
        arr_min = _hhmm_to_min(to_s.arrival_time or to_s.departure_time)
        duration: Optional[int] = None
        if dep_min is not None and arr_min is not None:
            duration = arr_min + (to_s.day - from_s.day) * 1440 - dep_min

        out.append(TrainBetweenResult(
            train_no=train_obj.train_no,
            name=train_obj.name,
            train_type=train_obj.train_type,
            runs_on=train_obj.runs_on,
            departure_time=from_s.departure_time or from_s.arrival_time,
            arrival_time=to_s.arrival_time or to_s.departure_time,
            duration_minutes=duration,
            from_day=from_s.day,
            to_day=to_s.day,
        ))
    return out


@router.get("/{train_no}", response_model=TrainBrief)
async def get_train(
    train_no: str,
    db: AsyncSession = Depends(get_db),
):
    """Get basic train info by train number."""
    result = await db.execute(
        select(TrainMaster).where(TrainMaster.train_no == train_no.strip())
    )
    train = result.scalar_one_or_none()
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")
    return TrainBrief.model_validate(train)


@router.get("/{train_no}/schedule", response_model=TrainSchedule)
async def get_train_schedule(
    train_no: str,
    db: AsyncSession = Depends(get_db),
):
    """Get full timetable for a train."""
    result = await db.execute(
        select(TrainMaster)
        .options(
            selectinload(TrainMaster.schedule).selectinload(TripSchedule.station)
        )
        .where(TrainMaster.train_no == train_no.strip())
    )
    train = result.scalar_one_or_none()
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")

    stops = [
        ScheduleStop(
            sequence=s.sequence,
            station_code=s.station_code,
            station_name=s.station.station_name if s.station else s.station_code,
            city=s.station.city if s.station else None,
            arrival_time=s.arrival_time,
            departure_time=s.departure_time,
            halt_minutes=s.halt_minutes,
            distance_km=s.distance_km,
            day=s.day,
            platform=s.platform,
        )
        for s in train.schedule
    ]
    return TrainSchedule(
        id=train.id,
        train_no=train.train_no,
        name=train.name,
        train_type=train.train_type,
        zone=train.zone,
        origin_code=train.origin_code,
        destination_code=train.destination_code,
        total_distance_km=train.total_distance_km,
        duration_minutes=train.duration_minutes,
        runs_on=train.runs_on,
        stops=stops,
    )


# ─────────────────────────── Stations ──────────────────────────────────────

@stations_router.get("/geojson")
async def stations_geojson(
    major_only: bool = Query(True, description="Return only major stations"),
    db: AsyncSession = Depends(get_db),
):
    """Return stations as GeoJSON FeatureCollection for map rendering."""
    query = select(StationMaster).where(StationMaster.latitude.isnot(None))
    if major_only:
        query = query.where(StationMaster.is_major.is_(True))

    result = await db.execute(query.order_by(StationMaster.station_code))
    stations = result.scalars().all()

    features = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [s.longitude, s.latitude],
            },
            "properties": {
                "code": s.station_code,
                "name": s.station_name,
                "city": s.city,
                "is_major": s.is_major,
            },
        }
        for s in stations
    ]
    return {"type": "FeatureCollection", "features": features}


@stations_router.get("/search", response_model=StationSearchResponse)
async def search_stations(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search stations by code or name."""
    pattern = f"%{q}%"
    result = await db.execute(
        select(StationMaster)
        .where(
            or_(
                StationMaster.station_code.ilike(pattern),
                StationMaster.station_name.ilike(pattern),
                StationMaster.city.ilike(pattern),
            )
        )
        .order_by(StationMaster.is_major.desc(), StationMaster.station_name)
        .limit(limit)
    )
    stations = result.scalars().all()
    return StationSearchResponse(
        stations=[StationDetail.model_validate(s) for s in stations],
        total=len(stations),
    )


@stations_router.get("/{code}", response_model=StationDetail)
async def get_station(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Get station by code."""
    result = await db.execute(
        select(StationMaster).where(
            StationMaster.station_code == code.upper().strip()
        )
    )
    station = result.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return StationDetail.model_validate(station)


@stations_router.get("/{code}/board", response_model=StationBoardResponse)
async def get_station_board(
    code: str,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Return scheduled trains passing through a station, with simulated live status."""
    code = code.upper().strip()

    # Verify station exists
    st_result = await db.execute(
        select(StationMaster).where(StationMaster.station_code == code)
    )
    station = st_result.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # Fetch scheduled stops for this station, joined with TrainMaster
    # Use a generous internal limit so Python-side filtering has enough rows to work with
    rows = await db.execute(
        select(TripSchedule, TrainMaster)
        .join(TrainMaster, TripSchedule.train_id == TrainMaster.id)
        .where(TripSchedule.station_code == code)
        .limit(500)
    )
    stops = rows.all()

    # ── IST 12-hour window with day-of-week filtering ─────────────────────────
    IST = ZoneInfo("Asia/Kolkata")
    now_ist = datetime.now(IST)
    window_end = now_ist + timedelta(hours=12)

    def train_runs_on_weekday(runs_on: str | None, weekday: int) -> bool:
        """
        runs_on is a 7-char bitmask: index 0=Monday … 6=Sunday (Python weekday()).
        Returns True if unknown/None (assume daily).
        """
        if not runs_on or len(runs_on) < 7:
            return True
        return runs_on[weekday] == "1"

    def resolve_stop_time(hhmm: str | None, runs_on: str | None) -> datetime | None:
        """
        Given an HH:MM string and a train's runs_on bitmask, return the earliest
        upcoming datetime (today or tomorrow in IST) when the stop actually falls
        within the [now_ist, window_end] window AND the train runs on that day.
        Returns None if no valid slot exists within the window.
        """
        if not hhmm:
            return None
        try:
            h, m = map(int, hhmm.split(":"))
        except (ValueError, AttributeError):
            return None

        for days_ahead in range(2):  # check today, then tomorrow
            candidate = (now_ist + timedelta(days=days_ahead)).replace(
                hour=h, minute=m, second=0, microsecond=0
            )
            if candidate < now_ist:
                continue  # already passed
            if candidate > window_end:
                break  # beyond our 12-hour window
            if train_runs_on_weekday(runs_on, candidate.weekday()):
                return candidate

        return None  # not within window or doesn't run on that day

    # Deterministic but hourly-rotating simulated status
    now = datetime.now(timezone.utc)
    hour_seed = now.hour
    entries: list[tuple[datetime, StationBoardEntry]] = []

    for stop, train in stops:
        # Prefer arrival_time, fall back to departure_time for the window check
        eff = (
            resolve_stop_time(stop.arrival_time, train.runs_on)
            or resolve_stop_time(stop.departure_time, train.runs_on)
        )
        if eff is None:
            continue

        # ~20% trains delayed, changes each hour
        train_hash = sum(ord(c) for c in train.train_no)
        delayed = ((train_hash + hour_seed) % 5) == 0
        delay_min = ((train_hash * 3 + hour_seed * 7) % 30) + 5 if delayed else 0

        entries.append((eff, StationBoardEntry(
            train_no=train.train_no,
            train_name=train.name,
            train_type=train.train_type,
            origin_code=train.origin_code,
            destination_code=train.destination_code,
            arrival_time=stop.arrival_time,
            departure_time=stop.departure_time,
            platform=stop.platform,
            status="Delayed" if delayed else "On Time",
            delay_minutes=delay_min,
        )))

    # Sort chronologically by effective stop time, then apply limit
    entries.sort(key=lambda t: t[0])
    final_entries = [e for _, e in entries[:limit]]

    return StationBoardResponse(
        station_code=station.station_code,
        station_name=station.station_name,
        entries=final_entries,
        as_of=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
