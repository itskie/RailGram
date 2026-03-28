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
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.database import get_db
from api.models.trains import StationMaster, TripSchedule, TrainMaster
from app.schemas.trains import (
    ScheduleStop,
    StationDetail,
    StationGeoJSON,
    StationSearchResponse,
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
