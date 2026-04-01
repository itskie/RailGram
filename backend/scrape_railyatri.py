#!/usr/bin/env python3
"""
RailYatri Scraper - Fetch all Indian trains with schedules
Scrapes 14k trains from RailYatri and loads into PostgreSQL

Usage:
    python3 scrape_railyatri.py
    
Environment:
    DATABASE_URL: postgres connection string
"""

import os
import sys
import json
import uuid
import time
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime

import requests
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# ────────────────────────────────────────────────────────────────────────────
# LOGGING SETUP
# ────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scrape_railyatri.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# CONFIG
# ────────────────────────────────────────────────────────────────────────────

load_dotenv()

RAILYATRI_BASE = "https://railyatri.in/api/v1"
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kie@localhost:5432/railgram")
DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

TRAIN_NO_START = 10000
TRAIN_NO_END = 99999
BATCH_SIZE = 100
REQUEST_TIMEOUT = 10
RETRY_ATTEMPTS = 3
RETRY_DELAY = 2  # seconds

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})

# ────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ────────────────────────────────────────────────────────────────────────────

def fetch_train_detail(train_no: str) -> Optional[Dict[str, Any]]:
    """Fetch train details from RailYatri API."""
    url = f"{RAILYATRI_BASE}/trains/{train_no}"
    
    for attempt in range(RETRY_ATTEMPTS):
        try:
            response = session.get(url, timeout=REQUEST_TIMEOUT)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                return None  # Train doesn't exist
            elif response.status_code == 429:
                # Rate limited
                logger.warning(f"Rate limited for {train_no}, waiting {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                logger.warning(f"Status {response.status_code} for train {train_no}")
                if attempt < RETRY_ATTEMPTS - 1:
                    time.sleep(RETRY_DELAY)
                    
        except requests.Timeout:
            logger.warning(f"Timeout fetching {train_no}, attempt {attempt + 1}/{RETRY_ATTEMPTS}")
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_DELAY)
        except Exception as e:
            logger.error(f"Error fetching {train_no}: {str(e)}")
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_DELAY)
    
    return None

# ────────────────────────────────────────────────────────────────────────────
# DATABASE OPERATIONS
# ────────────────────────────────────────────────────────────────────────────

def connect_db():
    """Connect to PostgreSQL."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        logger.info("Connected to database")
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        sys.exit(1)

def load_trains_and_schedules(conn, trains_data: List[Dict]) -> tuple[int, int, int]:
    """
    Load trains, stations, and trip schedules into database.
    
    Returns:
        (trains_loaded, stations_loaded, schedules_loaded)
    """
    cur = conn.cursor()
    trains_loaded = 0
    stations_loaded = 0
    schedules_loaded = 0
    
    try:
        # Prepare data structures
        train_rows = []
        station_data = {}  # station_code -> station info
        schedule_rows = []
        train_id_map = {}  # train_no -> uuid
        
        # Step 1: Extract all data
        for train_data in trains_data:
            if not train_data:
                continue
            
            try:
                train_no = train_data.get('train_number') or train_data.get('train_no')
                if not train_no:
                    continue
                
                train_id = str(uuid.uuid4())
                train_id_map[str(train_no)] = train_id
                
                # Train Master row
                train_rows.append((
                    train_id,
                    str(train_no),
                    train_data.get('train_name', str(train_no)),
                    train_data.get('category') or train_data.get('train_type'),
                    train_data.get('zone'),
                    train_data.get('runs_on') or train_data.get('days_runs'),
                    train_data.get('total_distance', train_data.get('total_distance_km')),
                    train_data.get('origin_code') or train_data.get('source_code'),
                    train_data.get('destination_code'),
                    train_data.get('duration') or train_data.get('duration_minutes'),
                ))
                
                # Process stops
                stops = train_data.get('stops', [])
                if stops:
                    for idx, stop in enumerate(stops, 1):
                        station_code = stop.get('station_code')
                        if not station_code:
                            continue
                        
                        # Collect station data
                        if station_code not in station_data:
                            station_data[station_code] = {
                                'station_code': station_code,
                                'station_name': stop.get('station_name', station_code),
                                'city': stop.get('city'),
                                'state': stop.get('state'),
                                'zone': stop.get('zone'),
                                'latitude': stop.get('latitude'),
                                'longitude': stop.get('longitude'),
                            }
                        
                        # Trip Schedule row
                        schedule_rows.append((
                            str(uuid.uuid4()),
                            train_id,
                            station_code,
                            idx,
                            stop.get('arrival_time'),
                            stop.get('departure_time'),
                            int(stop.get('halt_minutes', 0)),
                            int(stop.get('distance_from_origin', 0)),
                            int(stop.get('day', 1)),
                            stop.get('platform'),
                        ))
                
            except Exception as e:
                logger.error(f"Error processing train {train_no}: {str(e)}")
                continue
        
        # Step 2: Load Stations
        station_rows = [
            (
                str(uuid.uuid4()),
                row['station_code'],
                row['station_name'],
                row['city'],
                row['state'],
                row['zone'],
                row['latitude'],
                row['longitude'],
                None,  # elevation
                False,  # is_major
            )
            for row in station_data.values()
        ]
        
        if station_rows:
            execute_values(cur, """
                INSERT INTO station_master
                    (id, station_code, station_name, city, state, zone, latitude, longitude, elevation_m, is_major)
                VALUES %s
                ON CONFLICT (station_code) DO UPDATE SET
                    station_name = EXCLUDED.station_name,
                    city = EXCLUDED.city,
                    state = EXCLUDED.state,
                    zone = EXCLUDED.zone,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude
            """, station_rows, page_size=1000)
            conn.commit()
            stations_loaded = len(station_rows)
            logger.info(f"Loaded {stations_loaded} stations")
        
        # Step 3: Load Trains
        if train_rows:
            execute_values(cur, """
                INSERT INTO train_master
                    (id, train_no, name, train_type, zone, runs_on, total_distance_km, 
                     origin_code, destination_code, duration_minutes)
                VALUES %s
                ON CONFLICT (train_no) DO UPDATE SET
                    name = EXCLUDED.name,
                    train_type = EXCLUDED.train_type,
                    zone = EXCLUDED.zone,
                    runs_on = EXCLUDED.runs_on,
                    total_distance_km = EXCLUDED.total_distance_km,
                    origin_code = EXCLUDED.origin_code,
                    destination_code = EXCLUDED.destination_code,
                    duration_minutes = EXCLUDED.duration_minutes
            """, train_rows, page_size=1000)
            conn.commit()
            trains_loaded = len(train_rows)
            logger.info(f"Loaded {trains_loaded} trains")
        
        # Step 4: Load Trip Schedules
        if schedule_rows:
            execute_values(cur, """
                INSERT INTO trip_schedule
                    (id, train_id, station_code, sequence, arrival_time, departure_time, 
                     halt_minutes, distance_km, day, platform)
                VALUES %s
                ON CONFLICT (train_id, sequence) DO UPDATE SET
                    station_code = EXCLUDED.station_code,
                    arrival_time = EXCLUDED.arrival_time,
                    departure_time = EXCLUDED.departure_time,
                    halt_minutes = EXCLUDED.halt_minutes,
                    distance_km = EXCLUDED.distance_km,
                    day = EXCLUDED.day,
                    platform = EXCLUDED.platform
            """, schedule_rows, page_size=5000)
            conn.commit()
            schedules_loaded = len(schedule_rows)
            logger.info(f"Loaded {schedules_loaded} trip schedules")
        
        return trains_loaded, stations_loaded, schedules_loaded
        
    except Exception as e:
        logger.error(f"Error loading data: {str(e)}")
        conn.rollback()
        return 0, 0, 0
    finally:
        cur.close()

# ────────────────────────────────────────────────────────────────────────────
# MAIN SCRAPER
# ────────────────────────────────────────────────────────────────────────────

def main():
    """Main scraper logic."""
    logger.info("=" * 80)
    logger.info(f"RailYatri Scraper Started - Train range {TRAIN_NO_START}-{TRAIN_NO_END}")
    logger.info("=" * 80)
    
    start_time = datetime.now()
    conn = connect_db()
    
    trains_data = []
    trains_found = 0
    trains_skipped = 0
    trains_errors = 0
    
    try:
        # Scrape trains in batches
        for train_no in range(TRAIN_NO_START, TRAIN_NO_END + 1):
            try:
                if train_no % 500 == 0:
                    logger.info(f"Fetching trains {train_no}...")
                    time.sleep(0.5)  # Rate limiting
                
                data = fetch_train_detail(str(train_no))
                
                if data:
                    trains_data.append(data)
                    trains_found += 1
                elif data is None:
                    trains_skipped += 1
                
                # Load in batches
                if len(trains_data) >= BATCH_SIZE:
                    loaded, stations, schedules = load_trains_and_schedules(conn, trains_data)
                    logger.info(f"Batch: {loaded} trains, {stations} stations, {schedules} schedules")
                    trains_data = []
                
            except Exception as e:
                trains_errors += 1
                logger.error(f"Error on train {train_no}: {str(e)}")
        
        # Load remaining trains
        if trains_data:
            loaded, stations, schedules = load_trains_and_schedules(conn, trains_data)
            logger.info(f"Final batch: {loaded} trains, {stations} stations, {schedules} schedules")
        
        # Final stats
        conn.close()
        elapsed = (datetime.now() - start_time).total_seconds()
        
        logger.info("=" * 80)
        logger.info(f"SCRAPING COMPLETE")
        logger.info(f"  Trains found: {trains_found}")
        logger.info(f"  Trains skipped: {trains_skipped}")
        logger.info(f"  Trains errors: {trains_errors}")
        logger.info(f"  Time elapsed: {elapsed:.2f}s")
        logger.info("=" * 80)
        
    except KeyboardInterrupt:
        logger.info("Scraper interrupted by user")
        conn.close()
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        conn.close()
        sys.exit(1)

if __name__ == "__main__":
    main()
