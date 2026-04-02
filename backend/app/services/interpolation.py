"""
Schedule-based interpolation service for WIMT (Where Is My Train).

Given a train's TripSchedule rows (with StationMaster loaded), computes
the train's current latitude/longitude by linearly interpolating between
adjacent schedule stops based on wall-clock time (IST).

Key design decisions:
- All schedule times are stored as "HH:MM" strings with a 1-based 'day' offset.
- We convert every stop to "absolute minutes from origin departure" for arithmetic.
- We try up to (max_day + 2) candidate origin dates so overnight / multi-day
  trains always resolve correctly.
- Confidence is always LOW (0.30) for schedule-only — the truth engine bumps it
  down further when it's the sole source.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

# Indian Standard Time = UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))


def _parse_hhmm(t: Optional[str]) -> Optional[int]:
    """Convert 'HH:MM' string → minutes from midnight.  Returns None if blank/invalid."""
    if not t:
        return None
    try:
        parts = t.strip().split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return None


@dataclass
class InterpolatedPosition:
    latitude: float
    longitude: float
    from_station_code: str
    to_station_code: str
    next_station_code: str
    next_station_eta: datetime      # timezone-aware IST
    delay_minutes: int
    confidence: float
    fraction: float                 # 0.0 = at from_station, 1.0 = at to_station


def interpolate_train_position(
    schedule: list,
    now: Optional[datetime] = None,
    delay_minutes: int = 0,
    origin_date: Optional[datetime] = None,
) -> Optional[InterpolatedPosition]:
    """
    Compute the current interpolated position along the schedule.

    Parameters
    ----------
    schedule      : ordered list of TripSchedule ORM rows; each must have
                    .station (StationMaster) pre-loaded (may be None if missing).
    now           : timezone-aware current datetime. Defaults to IST now.
    delay_minutes : uniform delay applied to all scheduled times (positive = late).

    Returns
    -------
    InterpolatedPosition if the train is currently running, else None.
    """
    if not schedule:
        return None

    if now is None:
        now = datetime.now(IST)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=IST)

    now_ist = now.astimezone(IST)

    # ── Build stop list with absolute minute offsets ──────────────────────────
    # abs_minutes = (day - 1) * 1440 + HH*60 + MM
    stops = []
    for stop in schedule:
        day_offset = (stop.day - 1) * 1440
        dep = _parse_hhmm(stop.departure_time)
        arr = _parse_hhmm(stop.arrival_time)
        stops.append({
            "station_code": stop.station_code,
            "station": getattr(stop, "station", None),
            "dep_abs": (day_offset + dep) if dep is not None else None,
            "arr_abs": (day_offset + arr) if arr is not None else None,
        })

    # Determine origin departure absolute minutes
    origin_dep_abs = stops[0]["dep_abs"] if stops[0]["dep_abs"] is not None else (stops[0]["arr_abs"] or 0)
    # Determine journey end absolute minutes
    last = stops[-1]
    journey_end_abs = last["arr_abs"] if last["arr_abs"] is not None else (last["dep_abs"] or origin_dep_abs)

    # How many days back might origin have been?
    max_days_back = max((s["dep_abs"] or s["arr_abs"] or 0) for s in stops) // 1440 + 2

    # ── Find the active run's origin midnight ─────────────────────────────────
    today_midnight = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    origin_midnight: Optional[datetime] = None

    if origin_date is not None:
        # Multi-day journey: pin to the given start date (Vivek Express fix)
        pinned_midnight = origin_date.astimezone(IST).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        origin_dt = pinned_midnight + timedelta(minutes=origin_dep_abs + delay_minutes)
        end_dt = pinned_midnight + timedelta(minutes=journey_end_abs + delay_minutes)
        # Accept with ±4-hour buffer for edge cases
        if (origin_dt - timedelta(hours=4)) <= now_ist <= (end_dt + timedelta(hours=4)):
            origin_midnight = pinned_midnight
    else:
        for days_ago in range(max_days_back + 1):
            candidate_midnight = today_midnight - timedelta(days=days_ago)
            origin_dt = candidate_midnight + timedelta(minutes=origin_dep_abs + delay_minutes)
            end_dt = candidate_midnight + timedelta(minutes=journey_end_abs + delay_minutes)

            # Allow ±30-min buffer so we report even slightly before/after the run
            if (origin_dt - timedelta(minutes=30)) <= now_ist <= (end_dt + timedelta(minutes=30)):
                origin_midnight = candidate_midnight
                break

    if origin_midnight is None:
        return None     # Train is not currently running

    # ── Compute absolute datetimes for all stops ──────────────────────────────
    for s in stops:
        s["dep_dt"] = (
            origin_midnight + timedelta(minutes=s["dep_abs"] + delay_minutes)
            if s["dep_abs"] is not None else None
        )
        s["arr_dt"] = (
            origin_midnight + timedelta(minutes=s["arr_abs"] + delay_minutes)
            if s["arr_abs"] is not None else None
        )

    # ── Find current segment ──────────────────────────────────────────────────
    for i in range(len(stops) - 1):
        seg_start = stops[i]["dep_dt"] or stops[i]["arr_dt"]
        seg_end = stops[i + 1]["arr_dt"] or stops[i + 1]["dep_dt"]

        if seg_start is None or seg_end is None:
            continue

        if seg_start <= now_ist <= seg_end:
            from_s = stops[i]
            to_s = stops[i + 1]

            seg_secs = (seg_end - seg_start).total_seconds()
            elapsed = (now_ist - seg_start).total_seconds()
            fraction = min(1.0, max(0.0, elapsed / seg_secs)) if seg_secs > 0 else 0.5

            lat, lng = _interpolate_coords(from_s["station"], to_s["station"], fraction)
            if lat is None:
                return None

            return InterpolatedPosition(
                latitude=lat,
                longitude=lng,
                from_station_code=from_s["station_code"],
                to_station_code=to_s["station_code"],
                next_station_code=to_s["station_code"],
                next_station_eta=seg_end,
                delay_minutes=delay_minutes,
                confidence=0.30,
                fraction=fraction,
            )

    # ── Edge-case: train just arrived at last station ─────────────────────────
    last_arr_dt = stops[-1]["arr_dt"] or stops[-1]["dep_dt"]
    if last_arr_dt and now_ist >= (last_arr_dt - timedelta(minutes=30)):
        st = stops[-1]["station"]
        if st and st.latitude and st.longitude:
            return InterpolatedPosition(
                latitude=st.latitude,
                longitude=st.longitude,
                from_station_code=stops[-1]["station_code"],
                to_station_code=stops[-1]["station_code"],
                next_station_code=stops[-1]["station_code"],
                next_station_eta=last_arr_dt,
                delay_minutes=delay_minutes,
                confidence=0.20,
                fraction=1.0,
            )

    return None


def _interpolate_coords(from_st, to_st, fraction: float):
    """Linear interpolation between two StationMaster objects. Returns (lat, lng) or (None, None)."""
    if (from_st and from_st.latitude and from_st.longitude
            and to_st and to_st.latitude and to_st.longitude):
        lat = from_st.latitude + fraction * (to_st.latitude - from_st.latitude)
        lng = from_st.longitude + fraction * (to_st.longitude - from_st.longitude)
        return lat, lng
    if from_st and from_st.latitude and from_st.longitude:
        return from_st.latitude, from_st.longitude
    if to_st and to_st.latitude and to_st.longitude:
        return to_st.latitude, to_st.longitude
    return None, None
