#!/usr/bin/env python3
"""
Load trains, stations, and trip_schedules from railgram_trains_db.json into RDS.
Usage: DATABASE_URL=... python3 load_trains_json.py /path/to/railgram_trains_db.json
"""

import json
import os
import sys
import uuid
import psycopg2
from psycopg2.extras import execute_values

JSON_FILE = sys.argv[1] if len(sys.argv) > 1 else "/Users/kie/Desktop/railgram_trains_db.json"

db_url = os.environ.get("DATABASE_URL", "postgresql://kie@localhost:5432/railgram")
db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

print(f"Connecting to DB...")
conn = psycopg2.connect(db_url)
conn.autocommit = False
cur = conn.cursor()

print(f"Loading {JSON_FILE}...")
with open(JSON_FILE, "r") as f:
    data = json.load(f)

trains = data["trains"]
stations = data["stations"]
trip_schedules = data["trip_schedules"]

print(f"  trains: {len(trains):,}")
print(f"  stations: {len(stations):,}")
print(f"  trip_schedules: {len(trip_schedules):,}")

# ─── 1. Load Stations ────────────────────────────────────────────────────────
print("\n[1/3] Loading stations...")
station_rows = []
for s in stations:
    station_rows.append((
        str(uuid.uuid4()),
        s["code"],
        s["name"] or s["code"],
        None,           # city
        s.get("state"),
        s.get("zone"),
        s.get("lat"),
        s.get("lng"),
        None,           # elevation_m
        False,          # is_major
    ))

execute_values(cur, """
    INSERT INTO station_master
        (id, station_code, station_name, city, state, zone, latitude, longitude, elevation_m, is_major)
    VALUES %s
    ON CONFLICT (station_code) DO NOTHING
""", station_rows, page_size=1000)
conn.commit()
cur.execute("SELECT COUNT(*) FROM station_master")
print(f"  Done. station_master now has {cur.fetchone()[0]:,} rows.")

# ─── 2. Load Trains ──────────────────────────────────────────────────────────
print("\n[2/3] Loading trains...")
train_rows = []
train_id_map = {}  # train_number → uuid

for t in trains:
    tid = str(uuid.uuid4())
    train_id_map[t["train_number"]] = tid
    train_rows.append((
        tid,
        t["train_number"],
        t["train_name"] or t["train_number"],
        t.get("category"),          # train_type
        None,                       # zone
        t.get("days_runs"),         # runs_on
        int(t["total_distance_km"]) if t.get("total_distance_km") else None,
        t.get("source_code"),       # origin_code
        t.get("destination_code"),  # destination_code
        None,                       # duration_minutes
    ))

execute_values(cur, """
    INSERT INTO train_master
        (id, train_no, name, train_type, zone, runs_on, total_distance_km, origin_code, destination_code, duration_minutes)
    VALUES %s
    ON CONFLICT (train_no) DO UPDATE SET
        name = EXCLUDED.name,
        train_type = EXCLUDED.train_type,
        runs_on = EXCLUDED.runs_on,
        total_distance_km = EXCLUDED.total_distance_km,
        origin_code = EXCLUDED.origin_code,
        destination_code = EXCLUDED.destination_code
""", train_rows, page_size=1000)
conn.commit()

# Rebuild map from DB (handles conflicts where UUID may differ)
cur.execute("SELECT train_no, id FROM train_master")
train_id_map = {row[0]: row[1] for row in cur.fetchall()}
print(f"  Done. train_master now has {len(train_id_map):,} rows.")

# ─── 3. Load Trip Schedules ──────────────────────────────────────────────────
print("\n[3/3] Loading trip schedules (100K rows, batched)...")

BATCH = 5000
total = 0
skipped = 0
batch = []

# Get valid station codes
cur.execute("SELECT station_code FROM station_master")
valid_stations = {row[0] for row in cur.fetchall()}

for ts in trip_schedules:
    train_id = train_id_map.get(ts["train_number"])
    if not train_id:
        skipped += 1
        continue
    if ts["station_code"] not in valid_stations:
        skipped += 1
        continue

    batch.append((
        str(uuid.uuid4()),
        train_id,
        ts["station_code"],
        ts["sequence"],
        ts.get("sch_arr"),          # arrival_time
        ts.get("sch_dep"),          # departure_time
        ts.get("halt_mins") or 0,   # halt_minutes
        int(ts.get("distance_km") or 0),  # distance_km
        1,                          # day default
        None,                       # platform
    ))

    if len(batch) >= BATCH:
        execute_values(cur, """
            INSERT INTO trip_schedule
                (id, train_id, station_code, sequence, arrival_time, departure_time,
                 halt_minutes, distance_km, day, platform)
            VALUES %s
            ON CONFLICT (train_id, sequence) DO NOTHING
        """, batch, page_size=BATCH)
        conn.commit()
        total += len(batch)
        print(f"  {total:,} / {len(trip_schedules):,} ...", flush=True)
        batch = []

# Last batch
if batch:
    execute_values(cur, """
        INSERT INTO trip_schedule
            (id, train_id, station_code, sequence, arrival_time, departure_time,
             halt_minutes, distance_km, day, platform)
        VALUES %s
        ON CONFLICT (train_id, sequence) DO NOTHING
    """, batch, page_size=BATCH)
    conn.commit()
    total += len(batch)

cur.execute("SELECT COUNT(*) FROM trip_schedule")
print(f"  Done. trip_schedule now has {cur.fetchone()[0]:,} rows. Skipped: {skipped:,}")

# ─── Summary ─────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("DONE")
cur.execute("SELECT COUNT(*) FROM train_master"); print(f"  train_master:   {cur.fetchone()[0]:,}")
cur.execute("SELECT COUNT(*) FROM station_master"); print(f"  station_master: {cur.fetchone()[0]:,}")
cur.execute("SELECT COUNT(*) FROM trip_schedule"); print(f"  trip_schedule:  {cur.fetchone()[0]:,}")
print("="*60)

cur.close()
conn.close()
