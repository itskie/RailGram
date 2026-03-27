"""
Truth Engine — aggregates GPS reports, spotter reports, and schedule interpolation
to produce a single best-estimate position for a train.

Priority / confidence ladder
─────────────────────────────
 1. GPS  < 2 min old   → 0.95
 2. GPS  < 15 min old  → 0.70
 3. Spotter < 30 min   → 0.65  (uses schedule for coordinates, pins delay)
 4. Spotter < 4 h      → 0.35
 5. Schedule only      → 0.30

Results are cached in Redis for POSITION_CACHE_TTL seconds to avoid
hammering the DB on every /live request.
"""
import json
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.trains import StationMaster, TrainMaster, TripSchedule
from api.models.tracking import GpsReport, SpotterReport
from app.core.cache import get_redis
from app.services.interpolation import IST, interpolate_train_position

POSITION_CACHE_TTL = 300        # seconds (5 min)

GPS_FRESH_CUTOFF    = timedelta(minutes=2)
GPS_WARM_CUTOFF     = timedelta(minutes=15)
SPOTTER_FRESH_CUTOFF = timedelta(minutes=30)
SPOTTER_STALE_CUTOFF = timedelta(hours=4)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _load_schedule(train_no: str, db: AsyncSession) -> list:
    """Fetch full schedule for a train with StationMaster pre-loaded, sorted by sequence."""
    result = await db.execute(
        select(TripSchedule)
        .join(TrainMaster, TripSchedule.train_id == TrainMaster.id)
        .where(TrainMaster.train_no == train_no)
        .order_by(TripSchedule.sequence)
    )
    stops = result.scalars().all()
    if not stops:
        return []

    codes = [s.station_code for s in stops]
    st_result = await db.execute(
        select(StationMaster).where(StationMaster.station_code.in_(codes))
    )
    stations = {st.station_code: st for st in st_result.scalars().all()}
    for stop in stops:
        stop.station = stations.get(stop.station_code)
    return stops


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure a datetime is IST-aware (add IST tz if naive)."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=IST)


# ── Public API ────────────────────────────────────────────────────────────────

async def compute_position(
    train_no: str,
    db: AsyncSession,
    skip_cache: bool = False,
) -> Optional[dict]:
    """
    Compute (or return cached) the best available position for a train.

    Returns a dict matching TrainPositionOut, or None if the train is not running.
    Side-effects: writes result to Redis cache.
    """
    redis = await get_redis()
    cache_key = f"train:position:{train_no}"

    # ── 1. Redis cache ────────────────────────────────────────────────────────
    if not skip_cache:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

    now = datetime.now(IST)

    # ── 2. GPS reports ─────────────────────────────────────────────────────────
    gps_res = await db.execute(
        select(GpsReport)
        .where(GpsReport.train_no == train_no)
        .where(GpsReport.created_at >= now - GPS_WARM_CUTOFF)
        .order_by(desc(GpsReport.created_at))
        .limit(10)
    )
    gps_reports = gps_res.scalars().all()

    if gps_reports:
        latest = gps_reports[0]
        age = now - _aware(latest.created_at)
        confidence = 0.95 if age < GPS_FRESH_CUTOFF else 0.70

        # Weighted mean lat/lng — weight decays linearly with age
        total_w, w_lat, w_lng = 0.0, 0.0, 0.0
        for g in gps_reports:
            age_min = (now - _aware(g.created_at)).total_seconds() / 60
            w = max(0.05, 1.0 - age_min / 15.0)
            w_lat += g.latitude * w
            w_lng += g.longitude * w
            total_w += w
        lat = w_lat / total_w
        lng = w_lng / total_w

        # Pull schedule segment context for next-station metadata
        schedule = await _load_schedule(train_no, db)
        sched_pos = interpolate_train_position(schedule, now=now)

        position = _build_position(
            train_no=train_no,
            source="gps",
            lat=round(lat, 6),
            lng=round(lng, 6),
            speed_kmh=latest.speed_kmh,
            sched=sched_pos,
            delay=sched_pos.delay_minutes if sched_pos else 0,
            confidence=round(confidence, 2),
            last_station=None,
            now=now,
        )
        await redis.setex(cache_key, POSITION_CACHE_TTL, json.dumps(position))
        return position

    # ── 3. Spotter reports ────────────────────────────────────────────────────
    spot_res = await db.execute(
        select(SpotterReport)
        .where(SpotterReport.train_no == train_no)
        .where(SpotterReport.created_at >= now - SPOTTER_STALE_CUTOFF)
        .order_by(desc(SpotterReport.created_at))
        .limit(1)
    )
    latest_spot = spot_res.scalar_one_or_none()

    schedule = await _load_schedule(train_no, db)
    known_delay = (latest_spot.delay_minutes or 0) if latest_spot else 0
    sched_pos = interpolate_train_position(schedule, now=now, delay_minutes=known_delay)

    if latest_spot and sched_pos:
        age = now - _aware(latest_spot.created_at)
        confidence = 0.65 if age < SPOTTER_FRESH_CUTOFF else 0.35

        position = _build_position(
            train_no=train_no,
            source="spotter",
            lat=sched_pos.latitude,
            lng=sched_pos.longitude,
            speed_kmh=None,
            sched=sched_pos,
            delay=known_delay,
            confidence=round(confidence, 2),
            last_station=latest_spot.station_code,
            now=now,
        )
        await redis.setex(cache_key, POSITION_CACHE_TTL, json.dumps(position))
        return position

    # ── 4. Pure schedule interpolation ────────────────────────────────────────
    if not schedule:
        schedule = await _load_schedule(train_no, db)
    sched_pos = interpolate_train_position(schedule, now=now)

    if sched_pos:
        position = _build_position(
            train_no=train_no,
            source="schedule",
            lat=sched_pos.latitude,
            lng=sched_pos.longitude,
            speed_kmh=None,
            sched=sched_pos,
            delay=0,
            confidence=round(sched_pos.confidence, 2),
            last_station=None,
            now=now,
        )
        await redis.setex(cache_key, POSITION_CACHE_TTL, json.dumps(position))
        return position

    return None


def _build_position(
    train_no: str,
    source: str,
    lat: Optional[float],
    lng: Optional[float],
    speed_kmh: Optional[float],
    sched,
    delay: int,
    confidence: float,
    last_station: Optional[str],
    now: datetime,
) -> dict:
    """Build the TrainPositionOut-compatible dict."""
    eta_iso = None
    if sched and sched.next_station_eta:
        eta_iso = sched.next_station_eta.isoformat()

    return {
        "train_no": train_no,
        "source": source,
        "latitude": lat,
        "longitude": lng,
        "speed_kmh": speed_kmh,
        "from_station_code": sched.from_station_code if sched else None,
        "to_station_code": sched.to_station_code if sched else None,
        "next_station_code": sched.next_station_code if sched else None,
        "next_station_eta": eta_iso,
        "delay_minutes": delay,
        "confidence": confidence,
        "last_known_station_code": last_station,
        "computed_at": now.isoformat(),
    }
