"""
Truth Engine — aggregates GPS reports, cell tower triangulation, spotter reports, 
and schedule interpolation to produce a single best-estimate position for a train.

Priority / confidence ladder
─────────────────────────────
 1. GPS  < 2 min old          → 0.95
 2. GPS  < 15 min old         → 0.70
 3. Cell triangulation < 10m  → 0.75  (works in tunnels!)
 4. Cell triangulation < 60m  → 0.55
 5. Spotter < 30 min          → 0.65  (uses schedule for coordinates, pins delay)
 6. Spotter < 4 h             → 0.35
 7. Schedule only             → 0.30

Results are cached in Redis for POSITION_CACHE_TTL seconds to avoid
hammering the DB on every /live request.
"""
import json
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.trains import StationMaster, TrainMaster, TripSchedule
from api.models.tracking import GpsReport, SpotterReport, CellTowerReport
from app.services.tunnel_detection import TunnelDetector, analyze_tunnel_at_position
from app.services.triangulation import CellTowerTriangulator, CellTowerSignal
from app.services.calibration import CellTowerCalibrationService
from app.core.cache import get_redis
from app.services.interpolation import IST, interpolate_train_position

POSITION_CACHE_TTL = 300        # seconds (5 min)

GPS_FRESH_CUTOFF    = timedelta(minutes=2)
GPS_WARM_CUTOFF     = timedelta(minutes=15)
CELL_TOWER_CUTOFF   = timedelta(minutes=10)  # Cell tower reports stay fresh for 10 min
SPOTTER_FRESH_CUTOFF = timedelta(minutes=30)
SPOTTER_STALE_CUTOFF = timedelta(hours=4)


# ── Tunnel detection integration ──────────────────────────────────────────────

async def _get_tunnel_info(train_no: str, lat: float, lng: float, db: AsyncSession, now: datetime) -> dict:
    """Detect if train is in a tunnel using GPS/cell anomalies.
    
    Returns dict with keys: tunnel_detected, tunnel_confidence, tunnel_start, estimated_tunnel_length_km
    """
    try:
        tunnel_info = await analyze_tunnel_at_position(
            train_no=train_no,
            lat=lat, 
            lng=lng,
            db=db,
            now=now,
        )
        if tunnel_info:
            return {
                "tunnel_detected": tunnel_info.get("tunnel_detected", False),
                "tunnel_confidence": tunnel_info.get("confidence", 0.0),
                "tunnel_start": tunnel_info.get("tunnel_start", "").isoformat() if tunnel_info.get("tunnel_start") else None,
                "estimated_tunnel_length_km": tunnel_info.get("estimated_length_km"),
            }
    except Exception as e:
        # Tunnel detection shouldn't crash position computation
        print(f"Tunnel detection error for {train_no}: {e}")
    
    return {}


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
    journey_date: Optional[str] = None,
) -> Optional[dict]:
    """
    Compute (or return cached) the best available position for a train.

    journey_date: YYYY-MM-DD (IST) — pin which instance of a multi-day train to track.
    Returns a dict matching TrainPositionOut, or None if the train is not running.
    Side-effects: writes result to Redis cache.
    """
    # Parse journey_date for multi-day journey pinning (Vivek Express fix)
    pinned_origin: Optional[datetime] = None
    if journey_date:
        try:
            from datetime import date as _date
            _d = _date.fromisoformat(journey_date)
            pinned_origin = datetime(_d.year, _d.month, _d.day, tzinfo=IST)
        except Exception:
            pass

    redis = await get_redis()
    cache_key = f"train:position:{train_no}:{journey_date or 'auto'}"

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
        sched_pos = interpolate_train_position(schedule, now=now, origin_date=pinned_origin)
        name_map = {stop.station_code: stop.station.station_name for stop in schedule if stop.station}
        
        # Check for tunnel
        tunnel_info = await _get_tunnel_info(train_no, lat, lng, db, now)

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
            tunnel_detected=tunnel_info.get("tunnel_detected"),
            tunnel_confidence=tunnel_info.get("tunnel_confidence"),
            tunnel_start=tunnel_info.get("tunnel_start"),
            estimated_tunnel_length_km=tunnel_info.get("estimated_tunnel_length_km"),
            station_names=name_map,
        )
        await redis.setex(cache_key, POSITION_CACHE_TTL, json.dumps(position))
        return position

    # ── 2.5. Cell tower triangulation (works in tunnels!) ─────────────────────
    cell_res = await db.execute(
        select(CellTowerReport)
        .where(CellTowerReport.train_no == train_no)
        .where(CellTowerReport.created_at >= now - CELL_TOWER_CUTOFF)
        .order_by(desc(CellTowerReport.created_at))
        .limit(20)
    )
    cell_reports = cell_res.scalars().all()

    if cell_reports:
        # Build triangulation signals by looking up calibrated tower positions
        triangulation_signals: list[CellTowerSignal] = []
        seen_towers: set[tuple] = set()

        for cell_report in cell_reports:
            tower_key = (cell_report.mcc, cell_report.mnc, cell_report.lac, cell_report.cid)
            if tower_key in seen_towers:
                continue
            seen_towers.add(tower_key)

            tower = await CellTowerCalibrationService.get_tower_or_none(
                db, cell_report.mcc, cell_report.mnc, cell_report.lac, cell_report.cid
            )
            if tower and tower.latitude and tower.longitude:
                confidence = (
                    tower.confidence_score
                    if tower.confidence_score >= CellTowerCalibrationService.MIN_CONFIDENCE_FOR_USE
                    else 0.2
                )
                triangulation_signals.append(
                    CellTowerSignal(
                        latitude=tower.latitude,
                        longitude=tower.longitude,
                        rssi_dbm=cell_report.rssi_dbm,
                        accuracy_m=tower.accuracy_m,
                        confidence=confidence,
                    )
                )

        tri_result = (
            CellTowerTriangulator.triangulate(triangulation_signals)
            if len(triangulation_signals) >= CellTowerTriangulator.MIN_TOWERS_FOR_TRIANGULATION
            else None
        )

        if tri_result:
            schedule = await _load_schedule(train_no, db)
            sched_pos = interpolate_train_position(schedule, now=now, origin_date=pinned_origin)
            name_map = {stop.station_code: stop.station.station_name for stop in schedule if stop.station}
            tunnel_info = await _get_tunnel_info(train_no, tri_result.latitude, tri_result.longitude, db, now)

            position = _build_position(
                train_no=train_no,
                source="cell_tower",
                lat=round(tri_result.latitude, 6),
                lng=round(tri_result.longitude, 6),
                speed_kmh=None,
                sched=sched_pos,
                delay=0,
                confidence=round(tri_result.confidence, 2),
                last_station=None,
                now=now,
                tunnel_detected=tunnel_info.get("tunnel_detected"),
                tunnel_confidence=tunnel_info.get("tunnel_confidence"),
                tunnel_start=tunnel_info.get("tunnel_start"),
                estimated_tunnel_length_km=tunnel_info.get("estimated_tunnel_length_km"),
                station_names=name_map,
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
    sched_pos = interpolate_train_position(schedule, now=now, delay_minutes=known_delay, origin_date=pinned_origin)
    name_map = {stop.station_code: stop.station.station_name for stop in schedule if stop.station}

    if latest_spot and sched_pos:
        age = now - _aware(latest_spot.created_at)
        confidence = 0.65 if age < SPOTTER_FRESH_CUTOFF else 0.35
        
        # Check for tunnel
        tunnel_info = await _get_tunnel_info(train_no, sched_pos.latitude, sched_pos.longitude, db, now)

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
            tunnel_detected=tunnel_info.get("tunnel_detected"),
            tunnel_confidence=tunnel_info.get("tunnel_confidence"),
            tunnel_start=tunnel_info.get("tunnel_start"),
            estimated_tunnel_length_km=tunnel_info.get("estimated_tunnel_length_km"),
            station_names=name_map,
        )
        await redis.setex(cache_key, POSITION_CACHE_TTL, json.dumps(position))
        return position

    # ── 4. Pure schedule interpolation ────────────────────────────────────────
    if not schedule:
        schedule = await _load_schedule(train_no, db)
    name_map = {stop.station_code: stop.station.station_name for stop in schedule if stop.station}
    sched_pos = interpolate_train_position(schedule, now=now, origin_date=pinned_origin)

    if sched_pos:
        # Check for tunnel
        tunnel_info = await _get_tunnel_info(train_no, sched_pos.latitude, sched_pos.longitude, db, now)
        
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
            tunnel_detected=tunnel_info.get("tunnel_detected"),
            tunnel_confidence=tunnel_info.get("tunnel_confidence"),
            tunnel_start=tunnel_info.get("tunnel_start"),
            estimated_tunnel_length_km=tunnel_info.get("estimated_tunnel_length_km"),
            station_names=name_map,
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
    tunnel_detected: Optional[bool] = None,
    tunnel_confidence: Optional[float] = None,
    tunnel_start: Optional[str] = None,
    estimated_tunnel_length_km: Optional[float] = None,
    station_names: Optional[dict] = None,
) -> dict:
    """Build the TrainPositionOut-compatible dict.
    
    Tunnel fields:
    - tunnel_detected: Whether in a tunnel (based on GPS/cell anomalies)
    - tunnel_confidence: Confidence of tunnel detection (0-1.0)
    - tunnel_start: ISO timestamp when tunnel likely started
    - estimated_tunnel_length_km: Estimated tunnel length
    """
    eta_iso = None
    if sched and sched.next_station_eta:
        eta_iso = sched.next_station_eta.isoformat()

    names = station_names or {}
    next_code = sched.next_station_code if sched else None
    from_code = sched.from_station_code if sched else None

    position_dict = {
        "train_no": train_no,
        "source": source,
        "latitude": lat,
        "longitude": lng,
        "speed_kmh": speed_kmh,
        "from_station_code": from_code,
        "from_station_name": names.get(from_code) if from_code else None,
        "to_station_code": sched.to_station_code if sched else None,
        "next_station_code": next_code,
        "next_station_name": names.get(next_code) if next_code else None,
        "next_station_eta": eta_iso,
        "delay_minutes": delay,
        "confidence": confidence,
        "last_known_station_code": last_station,
        "last_known_station_name": names.get(last_station) if last_station else None,
        "computed_at": now.isoformat(),
    }
    
    # Add tunnel detection fields if available
    if tunnel_detected is not None:
        position_dict["tunnel_detected"] = tunnel_detected
        position_dict["tunnel_confidence"] = tunnel_confidence or 0.0
        if tunnel_start:
            position_dict["tunnel_start"] = tunnel_start
        if estimated_tunnel_length_km:
            position_dict["estimated_tunnel_length_km"] = estimated_tunnel_length_km
    
    return position_dict
