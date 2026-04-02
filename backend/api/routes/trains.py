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
    """Search trains by number prefix or name substring (ILIKE)."""
    offset = (page - 1) * limit
    pattern = f"%{q}%"

    base = select(TrainMaster).where(
        or_(
            TrainMaster.train_no.ilike(pattern),
            TrainMaster.name.ilike(pattern),
        )
    )
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

    stmt = (
        select(TrainMaster, fs, ts)
        .join(fs, fs.train_id == TrainMaster.id)
        .join(ts, ts.train_id == TrainMaster.id)
        .where(fs.station_code == from_code.strip().upper())
        .where(ts.station_code == to_code.strip().upper())
        .where(fs.sequence < ts.sequence)
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
    limit: int = Query(20, ge=1, le=50),
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
        .order_by(
            func.coalesce(TripSchedule.arrival_time, TripSchedule.departure_time)
        )
        .limit(500)
    )
    stops = rows.all()

    # ── IST 12-hour window ────────────────────────────────────────────────────
    IST = ZoneInfo("Asia/Kolkata")
    now_ist = datetime.now(IST)
    window_end = now_ist + timedelta(hours=12)

    def effective_time(hhmm: str | None) -> datetime | None:
        """Parse HH:MM string into the next occurrence of that time (today or tomorrow)."""
        if not hhmm:
            return None
        try:
            h, m = map(int, hhmm.split(":"))
        except (ValueError, AttributeError):
            return None
        candidate = now_ist.replace(hour=h, minute=m, second=0, microsecond=0)
        # If more than 1 minute in the past, push to tomorrow
        if candidate < now_ist - timedelta(minutes=1):
            candidate += timedelta(days=1)
        return candidate

    def stop_effective_time(stop: TripSchedule) -> datetime | None:
        """Prefer arrival, fall back to departure."""
        return effective_time(stop.arrival_time) or effective_time(stop.departure_time)

    # Deterministic but hourly-rotating simulated status
    now = datetime.now(timezone.utc)
    hour_seed = now.hour
    entries: list[StationBoardEntry] = []
    for stop, train in stops:
        eff = stop_effective_time(stop)
        if eff is None:
            continue
        # Only include trains within the next 12-hour window
        if not (now_ist <= eff <= window_end):
            continue

        # ~20% trains delayed, changes each hour
        train_hash = sum(ord(c) for c in train.train_no)
        delayed = ((train_hash + hour_seed) % 5) == 0
        delay_min = ((train_hash * 3 + hour_seed * 7) % 30) + 5 if delayed else 0
        entries.append(StationBoardEntry(
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
        ))

    # Sort by effective arrival/departure time ascending, then apply limit
    entries.sort(key=lambda e: effective_time(e.arrival_time or e.departure_time) or window_end)
    entries = entries[:limit]

    return StationBoardResponse(
        station_code=station.station_code,
        station_name=station.station_name,
        entries=entries,
        as_of=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
