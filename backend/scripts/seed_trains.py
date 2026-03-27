#!/usr/bin/env python3
"""
Seed script: Indian Railways timetable data → PostgreSQL

Supports two Kaggle datasets (auto-detects columns):
  1. "Indian Railways - Full Journey Details" (Kaggle)
     CSV columns: train_no, train_name, source_stn_name, source_stn_code,
                  dest_stn_name, dest_stn_code, departure_time, arrival_time,
                  duration_h, duration_m, distance, avg_speed, type
     → Seeds TrainMaster + StationMaster (no per-stop schedule)

  2. "Indian Railways - Station and Timetable" (Kaggle)
     CSV: Train No., Train Name, SEQ, Station Code, Station Name,
          Arrival time, Departure Time, Distance, Source Station Code,
          Destination Station Code
     → Seeds TrainMaster + StationMaster + TripSchedule

Usage:
  # From the RailGram JSON export (recommended — trains + stations + schedules):
  python -m scripts.seed_trains --json /path/to/railgram_trains_db.json

  # Full dataset (trains + schedule) from Kaggle CSV:
  python -m scripts.seed_trains --schedule path/to/timetable.csv

  # Trains-only (no schedule):
  python -m scripts.seed_trains --trains path/to/trains.csv

  # Both together:
  python -m scripts.seed_trains --trains training.csv --schedule timetable.csv

  # Quick smoke test with bundled sample data:
  python -m scripts.seed_trains --sample

Download datasets:
  https://www.kaggle.com/datasets/rajmak/indian-railways-train-details
  https://www.kaggle.com/datasets/chethaninna/indian-rail-network-timetable
"""
import argparse
import asyncio
import csv
import sys
import uuid
from pathlib import Path
from typing import Optional

# ── ensure package root is on path ────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from api.database import AsyncSessionLocal, engine
from api.models import TrainMaster, StationMaster, TripSchedule   # noqa: F401


# ── helpers ───────────────────────────────────────────────────────────────────

def norm_time(raw: str) -> Optional[str]:
    """Normalise various time formats to HH:MM. Returns None if empty/invalid."""
    raw = (raw or "").strip()
    if not raw or raw in ("--", "None", "N/A", "HH:MM"):
        return None
    # strip seconds if present
    parts = raw.split(":")
    if len(parts) >= 2:
        h, m = parts[0].zfill(2), parts[1].zfill(2)
        return f"{h}:{m}"
    return None


def safe_int(value: str, default: int = 0) -> int:
    try:
        return int(float(str(value).strip()))
    except (ValueError, TypeError):
        return default


def detect_train_type(name: str) -> str:
    name_upper = name.upper()
    for keyword, label in [
        ("RAJDHANI", "Rajdhani"), ("SHATABDI", "Shatabdi"), ("DURONTO", "Duronto"),
        ("VANDE BHARAT", "Vande Bharat"), ("TEJAS", "Tejas"), ("GATIMAAN", "Gatimaan"),
        ("SUPERFAST", "SF Express"), ("SF EXP", "SF Express"),
        ("EXPRESS", "Express"), ("EXP", "Express"),
        ("MAIL", "Mail"), ("PASSENGER", "Passenger"), ("LOCAL", "Local"),
        ("EMU", "EMU"), ("MEMU", "MEMU"), ("DMU", "DMU"),
    ]:
        if keyword in name_upper:
            return label
    return "Express"


# ── seed stations ─────────────────────────────────────────────────────────────

MAJOR_STATION_CODES = {
    "SBC", "MAS", "NDLS", "HWH", "CSTM", "BCT", "BSB", "ADI", "SC", "LKO",
    "CNB", "PNBE", "GKP", "DDN", "JP", "ALD", "NZM", "AGC", "UMB", "BBS",
    "BZA", "PUNE", "NGP", "MDU", "CBE", "TVC", "ERS", "RPH", "BRC", "ST",
    "MTJ", "GWL", "JBP", "BPL", "ET", "KTE", "HBJ", "VSKP", "RJT", "AMD",
    "MLY", "TPTY", "MS", "MYS", "HAS", "UDZ", "RMM", "MS", "KRNT", "GNT",
}

async def seed_stations(session, rows: list[dict]) -> dict[str, uuid.UUID]:
    """
    Upsert stations from schedule rows.
    Returns mapping: station_code → uuid
    """
    station_map: dict[str, dict] = {}
    for row in rows:
        code = row.get("station_code", "").strip().upper()
        name = row.get("station_name", "").strip()
        if not code or not name:
            continue
        if code not in station_map:
            station_map[code] = {
                "id": uuid.uuid4(),
                "station_code": code,
                "station_name": name,
                "is_major": code in MAJOR_STATION_CODES,
            }

    if not station_map:
        return {}

    values = list(station_map.values())
    stmt = pg_insert(StationMaster).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["station_code"],
        set_={"station_name": stmt.excluded.station_name},
    )
    await session.execute(stmt)
    await session.commit()

    result = await session.execute(
        select(StationMaster.station_code, StationMaster.id).where(
            StationMaster.station_code.in_(list(station_map.keys()))
        )
    )
    return {code: sid for code, sid in result.all()}


# ── seed trains (trains-only CSV) ─────────────────────────────────────────────

async def seed_trains_csv(path: str):
    """Import TrainMaster from the trains-only Kaggle CSV."""
    rows = []
    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            train_no = str(row.get("train_no") or row.get("Train No.") or "").strip()
            name = (row.get("train_name") or row.get("Train Name") or "").strip()
            if not train_no or not name:
                continue

            origin = (row.get("source_stn_code") or row.get("Source Station Code") or "").strip().upper()
            dest = (row.get("dest_stn_code") or row.get("Destination Station Code") or "").strip().upper()
            dist = safe_int(row.get("distance") or row.get("Distance") or 0)
            dur_h = safe_int(row.get("duration_h") or 0)
            dur_m = safe_int(row.get("duration_m") or 0)

            rows.append({
                "id": uuid.uuid4(),
                "train_no": train_no,
                "name": name,
                "train_type": detect_train_type(name),
                "origin_code": origin or None,
                "destination_code": dest or None,
                "total_distance_km": dist or None,
                "duration_minutes": dur_h * 60 + dur_m or None,
            })

    if not rows:
        print("No rows found in trains CSV.")
        return

    async with AsyncSessionLocal() as session:
        # Upsert in batches of 500
        for i in range(0, len(rows), 500):
            batch = rows[i : i + 500]
            stmt = pg_insert(TrainMaster).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["train_no"],
                set_={"name": stmt.excluded.name, "train_type": stmt.excluded.train_type},
            )
            await session.execute(stmt)
            await session.commit()
            print(f"  [trains] Upserted {min(i + 500, len(rows))}/{len(rows)}")

    print(f"Done. {len(rows)} trains seeded.")


# ── seed schedule CSV ─────────────────────────────────────────────────────────

async def seed_schedule_csv(path: str):
    """
    Import TrainMaster + StationMaster + TripSchedule from the
    station-timetable Kaggle CSV.
    Expected columns (case-insensitive):
      Train No., Train Name, SEQ, Station Code, Station Name,
      Arrival time, Departure Time, Distance, Source Station Code,
      Destination Station Code
    """
    raw_rows = []
    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        # normalise header keys to lowercase with underscores
        for row in reader:
            raw_rows.append({k.strip().lower().replace(" ", "_"): v for k, v in row.items()})

    if not raw_rows:
        print("Empty CSV file.")
        return

    print(f"Loaded {len(raw_rows)} schedule rows from {path}")

    # Collect unique stations
    station_rows = []
    for row in raw_rows:
        code = (row.get("station_code") or "").strip().upper()
        name = (row.get("station_name") or "").strip()
        if code and name:
            station_rows.append({"station_code": code, "station_name": name})

    async with AsyncSessionLocal() as session:
        print("Seeding stations...")
        station_id_map = await seed_stations(session, station_rows)
        print(f"  {len(station_id_map)} stations upserted")

        # Build train info grouped by train_no
        from collections import defaultdict
        train_stops: dict[str, list[dict]] = defaultdict(list)
        train_info: dict[str, dict] = {}

        for row in raw_rows:
            train_no = str(row.get("train_no.") or row.get("train_no") or "").strip()
            if not train_no:
                continue
            name = (row.get("train_name") or "").strip()
            origin = (row.get("source_station_code") or "").strip().upper()
            dest = (row.get("destination_station_code") or "").strip().upper()
            station_code = (row.get("station_code") or "").strip().upper()
            seq = safe_int(row.get("seq") or row.get("sequence") or 0)
            arr = norm_time(row.get("arrival_time") or "")
            dep = norm_time(row.get("departure_time") or "")
            dist = safe_int(row.get("distance") or 0)

            if train_no not in train_info:
                train_info[train_no] = {
                    "train_no": train_no,
                    "name": name or train_no,
                    "train_type": detect_train_type(name),
                    "origin_code": origin or None,
                    "destination_code": dest or None,
                }

            if station_code and seq:
                train_stops[train_no].append({
                    "station_code": station_code,
                    "sequence": seq,
                    "arrival_time": arr,
                    "departure_time": dep,
                    "distance_km": dist,
                })

        # Upsert trains
        print(f"Seeding {len(train_info)} trains...")
        train_rows = [
            {"id": uuid.uuid4(), **info}
            for info in train_info.values()
        ]
        for i in range(0, len(train_rows), 500):
            batch = train_rows[i : i + 500]
            stmt = pg_insert(TrainMaster).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["train_no"],
                set_={
                    "name": stmt.excluded.name,
                    "origin_code": stmt.excluded.origin_code,
                    "destination_code": stmt.excluded.destination_code,
                },
            )
            await session.execute(stmt)
            await session.commit()
        print(f"  {len(train_rows)} trains upserted")

        # Fetch fresh train_no → id mapping
        result = await session.execute(
            select(TrainMaster.train_no, TrainMaster.id)
        )
        train_id_map = {tn: tid for tn, tid in result.all()}

        # Upsert schedules
        print("Seeding trip schedules...")
        schedule_rows = []
        for train_no, stops in train_stops.items():
            train_id = train_id_map.get(train_no)
            if not train_id:
                continue
            for stop in stops:
                sc = stop["station_code"]
                if sc not in station_id_map:
                    continue
                schedule_rows.append({
                    "id": uuid.uuid4(),
                    "train_id": train_id,
                    "station_code": sc,
                    "sequence": stop["sequence"],
                    "arrival_time": stop["arrival_time"],
                    "departure_time": stop["departure_time"],
                    "distance_km": stop["distance_km"],
                    "halt_minutes": 0,
                    "day": 1,
                })

        for i in range(0, len(schedule_rows), 1000):
            batch = schedule_rows[i : i + 1000]
            stmt = pg_insert(TripSchedule).values(batch)
            stmt = stmt.on_conflict_do_nothing()
            await session.execute(stmt)
            await session.commit()
            print(f"  [schedule] {min(i + 1000, len(schedule_rows))}/{len(schedule_rows)}")

    print(f"Done. {len(schedule_rows)} schedule stops seeded.")


# ── seed from RailGram JSON export ───────────────────────────────────────────

CATEGORY_MAP = {
    "rajdhani": "Rajdhani", "shatabdi": "Shatabdi", "duronto": "Duronto",
    "vande bharat": "Vande Bharat", "vande_bharat": "Vande Bharat",
    "tejas": "Tejas", "gatimaan": "Gatimaan",
    "superfast": "SF Express", "sf": "SF Express",
    "express": "Express", "mail": "Mail",
    "passenger": "Passenger", "local": "Local",
    "emu": "EMU", "memu": "MEMU", "dmu": "DMU",
    "special": "Special",
}


async def seed_from_json(path: str):
    """
    Seed TrainMaster + StationMaster + TripSchedule from the
    railgram_trains_db.json format:
      { "trains": [...], "stations": [...], "trip_schedules": [...] }
    """
    print(f"Loading {path} ...")
    with open(path, encoding="utf-8") as f:
        import json as _json
        data = _json.load(f)

    raw_trains = data.get("trains", [])
    raw_stations = data.get("stations", [])
    raw_schedules = data.get("trip_schedules", [])
    print(f"  {len(raw_trains)} trains | {len(raw_stations)} stations | {len(raw_schedules)} schedule stops")

    async with AsyncSessionLocal() as session:
        # ── 1. Stations ──────────────────────────────────────────────────────
        print("Seeding stations...")
        station_rows = []
        for s in raw_stations:
            code = (s.get("code") or "").strip().upper()
            name = (s.get("name") or "").strip()
            if not code or not name:
                continue
            station_rows.append({
                "id": uuid.uuid4(),
                "station_code": code,
                "station_name": name,
                "state": s.get("state"),
                "zone": s.get("zone"),
                "latitude": s.get("lat"),
                "longitude": s.get("lng"),
                "is_major": code in MAJOR_STATION_CODES,
            })

        for i in range(0, len(station_rows), 500):
            batch = station_rows[i : i + 500]
            stmt = pg_insert(StationMaster).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["station_code"],
                set_={
                    "station_name": stmt.excluded.station_name,
                    "latitude":     stmt.excluded.latitude,
                    "longitude":    stmt.excluded.longitude,
                    "state":        stmt.excluded.state,
                    "zone":         stmt.excluded.zone,
                    "is_major":     stmt.excluded.is_major,
                },
            )
            await session.execute(stmt)
            await session.commit()
        print(f"  {len(station_rows)} stations upserted")

        # ── 2. Trains ────────────────────────────────────────────────────────
        print("Seeding trains...")
        train_rows = []
        for t in raw_trains:
            train_no = str(t.get("train_number") or "").strip()
            name = (t.get("train_name") or "").strip()
            if not train_no or not name:
                continue
            cat_raw = (t.get("category") or "").lower().strip()
            train_type = CATEGORY_MAP.get(cat_raw) or detect_train_type(name)
            dist = t.get("total_distance_km")
            train_rows.append({
                "id": uuid.uuid4(),
                "train_no": train_no,
                "name": name,
                "train_type": train_type,
                "origin_code": (t.get("source_code") or "").strip().upper() or None,
                "destination_code": (t.get("destination_code") or "").strip().upper() or None,
                "total_distance_km": int(dist) if dist else None,
                "runs_on": t.get("days_runs"),
            })

        for i in range(0, len(train_rows), 500):
            batch = train_rows[i : i + 500]
            stmt = pg_insert(TrainMaster).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["train_no"],
                set_={
                    "name":             stmt.excluded.name,
                    "train_type":       stmt.excluded.train_type,
                    "origin_code":      stmt.excluded.origin_code,
                    "destination_code": stmt.excluded.destination_code,
                    "total_distance_km": stmt.excluded.total_distance_km,
                    "runs_on":          stmt.excluded.runs_on,
                },
            )
            await session.execute(stmt)
            await session.commit()
        print(f"  {len(train_rows)} trains upserted")

        # ── 3. Build lookup: train_no → uuid ─────────────────────────────────
        result = await session.execute(select(TrainMaster.train_no, TrainMaster.id))
        train_id_map = {tn: tid for tn, tid in result.all()}

        # ── 4. Build lookup: station_code set (validate FK) ──────────────────
        result = await session.execute(select(StationMaster.station_code))
        valid_stations = {row[0] for row in result.all()}

        # ── 5. Trip schedules ─────────────────────────────────────────────────
        print("Seeding trip schedules...")
        sched_rows = []
        skipped = 0
        for row in raw_schedules:
            train_no = str(row.get("train_number") or "").strip()
            sc = (row.get("station_code") or "").strip().upper()
            seq = safe_int(row.get("sequence") or 0)
            train_id = train_id_map.get(train_no)
            if not train_id or sc not in valid_stations or not seq:
                skipped += 1
                continue
            sched_rows.append({
                "id": uuid.uuid4(),
                "train_id": train_id,
                "station_code": sc,
                "sequence": seq,
                "arrival_time":   norm_time(row.get("sch_arr") or ""),
                "departure_time": norm_time(row.get("sch_dep") or ""),
                "distance_km": int(row["distance_km"]) if row.get("distance_km") else 0,
                "halt_minutes": safe_int(row.get("halt_mins") or 0),
                "day": 1,
            })

        for i in range(0, len(sched_rows), 1000):
            batch = sched_rows[i : i + 1000]
            stmt = pg_insert(TripSchedule).values(batch)
            stmt = stmt.on_conflict_do_nothing()
            await session.execute(stmt)
            await session.commit()
            if i % 10000 == 0 and i > 0:
                print(f"  [schedule] {i}/{len(sched_rows)}")

        print(f"  {len(sched_rows)} schedule stops upserted ({skipped} skipped — missing train/station FK)")

    print(f"\nDone. DB now has {len(train_rows)} trains, {len(station_rows)} stations, {len(sched_rows)} schedule stops.")


# ── built-in sample data ──────────────────────────────────────────────────────

SAMPLE_STATIONS = [
    {"station_code": "NDLS", "station_name": "New Delhi", "city": "New Delhi", "state": "Delhi", "zone": "NR", "latitude": 28.6421, "longitude": 77.2194, "is_major": True},
    {"station_code": "HWH",  "station_name": "Howrah Junction", "city": "Howrah", "state": "West Bengal", "zone": "ER", "latitude": 22.5851, "longitude": 88.3422, "is_major": True},
    {"station_code": "CSTM", "station_name": "Mumbai CSMT", "city": "Mumbai", "state": "Maharashtra", "zone": "CR", "latitude": 18.9401, "longitude": 72.8355, "is_major": True},
    {"station_code": "MAS",  "station_name": "Chennai Central", "city": "Chennai", "state": "Tamil Nadu", "zone": "SR", "latitude": 13.0827, "longitude": 80.2707, "is_major": True},
    {"station_code": "SBC",  "station_name": "KSR Bengaluru City Junction", "city": "Bengaluru", "state": "Karnataka", "zone": "SWR", "latitude": 12.9785, "longitude": 77.5704, "is_major": True},
    {"station_code": "SC",   "station_name": "Secunderabad Junction", "city": "Hyderabad", "state": "Telangana", "zone": "SCR", "latitude": 17.4340, "longitude": 78.5004, "is_major": True},
    {"station_code": "ADI",  "station_name": "Ahmedabad Junction", "city": "Ahmedabad", "state": "Gujarat", "zone": "WR", "latitude": 23.0225, "longitude": 72.5714, "is_major": True},
    {"station_code": "PUNE", "station_name": "Pune Junction", "city": "Pune", "state": "Maharashtra", "zone": "CR", "latitude": 18.5293, "longitude": 73.8743, "is_major": True},
    {"station_code": "JP",   "station_name": "Jaipur Junction", "city": "Jaipur", "state": "Rajasthan", "zone": "NWR", "latitude": 26.9220, "longitude": 75.7880, "is_major": True},
    {"station_code": "LKO",  "station_name": "Lucknow NR", "city": "Lucknow", "state": "Uttar Pradesh", "zone": "NR", "latitude": 26.8467, "longitude": 80.9462, "is_major": True},
    {"station_code": "PNBE", "station_name": "Patna Junction", "city": "Patna", "state": "Bihar", "zone": "ECR", "latitude": 25.6093, "longitude": 85.1376, "is_major": True},
    {"station_code": "BPL",  "station_name": "Bhopal Junction", "city": "Bhopal", "state": "Madhya Pradesh", "zone": "WCR", "latitude": 23.2599, "longitude": 77.4126, "is_major": True},
    {"station_code": "NGP",  "station_name": "Nagpur Junction", "city": "Nagpur", "state": "Maharashtra", "zone": "CR", "latitude": 21.1458, "longitude": 79.0882, "is_major": True},
    {"station_code": "BBS",  "station_name": "Bhubaneswar", "city": "Bhubaneswar", "state": "Odisha", "zone": "ECoR", "latitude": 20.2961, "longitude": 85.8245, "is_major": True},
    {"station_code": "VSKP", "station_name": "Visakhapatnam Junction", "city": "Visakhapatnam", "state": "Andhra Pradesh", "zone": "ECoR", "latitude": 17.6868, "longitude": 83.2185, "is_major": True},
    {"station_code": "ERS",  "station_name": "Ernakulam Junction", "city": "Kochi", "state": "Kerala", "zone": "SR", "latitude": 9.9816,  "longitude": 76.2999, "is_major": True},
    {"station_code": "TVC",  "station_name": "Thiruvananthapuram Central", "city": "Thiruvananthapuram", "state": "Kerala", "zone": "SR", "latitude": 8.4875,  "longitude": 76.9525, "is_major": True},
    {"station_code": "BSB",  "station_name": "Varanasi Junction", "city": "Varanasi", "state": "Uttar Pradesh", "zone": "NER", "latitude": 25.3176, "longitude": 82.9739, "is_major": True},
    {"station_code": "AGC",  "station_name": "Agra Cantt", "city": "Agra", "state": "Uttar Pradesh", "zone": "NCR", "latitude": 27.1484, "longitude": 78.0087, "is_major": True},
    {"station_code": "ALD",  "station_name": "Prayagraj Junction", "city": "Prayagraj", "state": "Uttar Pradesh", "zone": "NCR", "latitude": 25.4358, "longitude": 81.8463, "is_major": True},
    {"station_code": "CNB",  "station_name": "Kanpur Central", "city": "Kanpur", "state": "Uttar Pradesh", "zone": "NCR", "latitude": 26.4499, "longitude": 80.3319, "is_major": True},
    {"station_code": "GKP",  "station_name": "Gorakhpur Junction", "city": "Gorakhpur", "state": "Uttar Pradesh", "zone": "NER", "latitude": 26.7606, "longitude": 83.3732, "is_major": True},
    {"station_code": "BZA",  "station_name": "Vijayawada Junction", "city": "Vijayawada", "state": "Andhra Pradesh", "zone": "SCR", "latitude": 16.5193, "longitude": 80.6305, "is_major": True},
    {"station_code": "CBE",  "station_name": "Coimbatore Junction", "city": "Coimbatore", "state": "Tamil Nadu", "zone": "SR", "latitude": 11.0018, "longitude": 76.9674, "is_major": True},
    {"station_code": "MDU",  "station_name": "Madurai Junction", "city": "Madurai", "state": "Tamil Nadu", "zone": "SR", "latitude": 9.9195,  "longitude": 78.1193, "is_major": True},
]

SAMPLE_TRAINS = [
    {"train_no": "12301", "name": "Howrah Rajdhani Express", "train_type": "Rajdhani", "zone": "ER",  "origin_code": "HWH",  "destination_code": "NDLS", "total_distance_km": 1450, "duration_minutes": 1020, "runs_on": "1234567"},
    {"train_no": "12302", "name": "New Delhi Rajdhani Express", "train_type": "Rajdhani", "zone": "ER", "origin_code": "NDLS", "destination_code": "HWH", "total_distance_km": 1450, "duration_minutes": 1020, "runs_on": "1234567"},
    {"train_no": "12951", "name": "Mumbai Rajdhani Express", "train_type": "Rajdhani", "zone": "WR",  "origin_code": "NDLS", "destination_code": "BCT",  "total_distance_km": 1384, "duration_minutes": 945,  "runs_on": "1234567"},
    {"train_no": "12002", "name": "New Delhi Shatabdi Express", "train_type": "Shatabdi", "zone": "NR", "origin_code": "NDLS", "destination_code": "BSB",  "total_distance_km": 820,  "duration_minutes": 615,  "runs_on": "1234567"},
    {"train_no": "22221", "name": "Mumbai CSMT - Howrah Duronto", "train_type": "Duronto", "zone": "CR", "origin_code": "CSTM", "destination_code": "HWH",  "total_distance_km": 1968, "duration_minutes": 1185, "runs_on": "1357"},
]

SAMPLE_SCHEDULE = [
    # 12301 Howrah Rajdhani
    {"train_no": "12301", "station_code": "HWH",  "sequence": 1,  "arrival_time": None,    "departure_time": "16:55", "distance_km": 0,    "day": 1},
    {"train_no": "12301", "station_code": "ALD",  "sequence": 2,  "arrival_time": "02:00", "departure_time": "02:10", "distance_km": 793,  "day": 2},
    {"train_no": "12301", "station_code": "CNB",  "sequence": 3,  "arrival_time": "03:50", "departure_time": "03:55", "distance_km": 934,  "day": 2},
    {"train_no": "12301", "station_code": "NDLS", "sequence": 4,  "arrival_time": "10:05", "departure_time": None,    "distance_km": 1450, "day": 2},
    # 12951 Mumbai Rajdhani
    {"train_no": "12951", "station_code": "NDLS", "sequence": 1,  "arrival_time": None,    "departure_time": "16:25", "distance_km": 0,    "day": 1},
    {"train_no": "12951", "station_code": "BPL",  "sequence": 2,  "arrival_time": "23:20", "departure_time": "23:30", "distance_km": 702,  "day": 1},
    {"train_no": "12951", "station_code": "NGP",  "sequence": 3,  "arrival_time": "04:35", "departure_time": "04:45", "distance_km": 1069, "day": 2},
    {"train_no": "12951", "station_code": "PUNE", "sequence": 4,  "arrival_time": "13:00", "departure_time": "13:10", "distance_km": 1339, "day": 2},
    {"train_no": "12951", "station_code": "CSTM", "sequence": 5,  "arrival_time": "15:35", "departure_time": None,    "distance_km": 1384, "day": 2},
]


async def seed_sample():
    """Load built-in sample data for smoke-testing."""
    async with AsyncSessionLocal() as session:
        # Stations
        station_values = [{"id": uuid.uuid4(), **s} for s in SAMPLE_STATIONS]
        stmt = pg_insert(StationMaster).values(station_values)
        stmt = stmt.on_conflict_do_update(
            index_elements=["station_code"],
            set_={"station_name": stmt.excluded.station_name, "latitude": stmt.excluded.latitude, "longitude": stmt.excluded.longitude, "is_major": stmt.excluded.is_major},
        )
        await session.execute(stmt)
        await session.commit()
        print(f"  {len(station_values)} sample stations upserted")

        # Trains
        train_values = [{"id": uuid.uuid4(), **t} for t in SAMPLE_TRAINS]
        stmt = pg_insert(TrainMaster).values(train_values)
        stmt = stmt.on_conflict_do_update(
            index_elements=["train_no"],
            set_={"name": stmt.excluded.name},
        )
        await session.execute(stmt)
        await session.commit()
        print(f"  {len(train_values)} sample trains upserted")

        # Fetch train id map
        result = await session.execute(select(TrainMaster.train_no, TrainMaster.id))
        train_id_map = {tn: tid for tn, tid in result.all()}

        # Schedule
        sched_values = []
        for row in SAMPLE_SCHEDULE:
            tid = train_id_map.get(row["train_no"])
            if not tid:
                continue
            sched_values.append({
                "id": uuid.uuid4(),
                "train_id": tid,
                "station_code": row["station_code"],
                "sequence": row["sequence"],
                "arrival_time": row["arrival_time"],
                "departure_time": row["departure_time"],
                "distance_km": row["distance_km"],
                "day": row["day"],
                "halt_minutes": 0,
            })
        stmt = pg_insert(TripSchedule).values(sched_values)
        stmt = stmt.on_conflict_do_nothing()
        await session.execute(stmt)
        await session.commit()
        print(f"  {len(sched_values)} sample schedule stops upserted")

    print("Sample data loaded.")


# ── entrypoint ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed IR train data into RailGram DB")
    parser.add_argument("--json",     help="Path to railgram_trains_db.json (trains + stations + schedules)")
    parser.add_argument("--trains",   help="Path to trains-only CSV (Kaggle journey details)")
    parser.add_argument("--schedule", help="Path to timetable CSV (Kaggle station timetable)")
    parser.add_argument("--sample",   action="store_true", help="Load built-in sample data (no CSV required)")
    args = parser.parse_args()

    if not any([args.json, args.trains, args.schedule, args.sample]):
        parser.print_help()
        sys.exit(1)

    async def run():
        if args.sample:
            print("Loading built-in sample data...")
            await seed_sample()
        if args.json:
            await seed_from_json(args.json)
        if args.trains:
            print(f"Loading trains CSV: {args.trains}")
            await seed_trains_csv(args.trains)
        if args.schedule:
            print(f"Loading schedule CSV: {args.schedule}")
            await seed_schedule_csv(args.schedule)
        await engine.dispose()

    asyncio.run(run())


if __name__ == "__main__":
    main()
