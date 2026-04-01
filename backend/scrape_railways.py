#!/usr/bin/env python3
"""
Railway Data Scraper - Uses public Indian Railways datasets + API fallback
Combines: GitHub datasets + WayCare API + Direct railway sources
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
        logging.FileHandler('scrape_railways.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# CONFIG
# ────────────────────────────────────────────────────────────────────────────

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kie@localhost:5432/railgram")
DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

TRAIN_NO_START = 10000
TRAIN_NO_END = 99999
BATCH_SIZE = 500
REQUEST_TIMEOUT = 5
REQUEST_DELAY = 0.05

# Create session with proper headers
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/html',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
})

# ────────────────────────────────────────────────────────────────────────────
# RAILWAY DATA SOURCES
# ────────────────────────────────────────────────────────────────────────────

def fetch_from_waycare(train_no: str) -> Optional[Dict]:
    """Fetch from WayCare API - reliable Indian railways source."""
    try:
        # WayCare API for Indian train info
        url = f"https://api.waycare.in/v1/railways/trains/{train_no}"
        response = session.get(url, timeout=REQUEST_TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            if data and data.get('status') == 'success':
                return data.get('data')
        
        return None
    except:
        return None

def fetch_from_abhangu(train_no: str) -> Optional[Dict]:
    """Fetch from Abhangu API - crowd-sourced train data."""
    try:
        url = f"https://abhangu.railyatri.in/api/trains/{train_no}"
        response = session.get(url, timeout=REQUEST_TIMEOUT)
        
        if response.status_code == 200:
            return response.json()
        
        return None
    except:
        return None

def fetch_from_github_dataset() -> Optional[Dict]:
    """Fetch public Indian Railways dataset from GitHub."""
    try:
        logger.info("Fetching Indian Railways dataset from GitHub...")
        
        # Public dataset with Indian train information
        url = "https://raw.githubusercontent.com/deepakkarmania/indian-railways/main/trains.json"
        response = session.get(url, timeout=15)
        
        if response.status_code == 200:
            return response.json()
        
        logger.warning("GitHub dataset not available, trying backup...")
        
        # Backup source
        url2 = "https://raw.githubusercontent.com/itskie/RailGram/master/backend/data/trains.json"
        response = session.get(url2, timeout=15)
        
        if response.status_code == 200:
            return response.json()
        
        return None
    except Exception as e:
        logger.warning(f"Could not fetch GitHub dataset: {e}")
        return None

def fetch_from_postman_public_api(train_no: str) -> Optional[Dict]:
    """Try publicly available Postman APIs."""
    try:
        urls = [
            f"https://api.postman.com/collections?q=indian%20railways&train={train_no}",
            f"https://railways.postman.co/api/trains/{train_no}",
        ]
        
        for url in urls:
            try:
                response = session.get(url, timeout=REQUEST_TIMEOUT)
                if response.status_code == 200:
                    return response.json()
            except:
                continue
        
        return None
    except:
        return None

def fetch_train_smart(train_no: str) -> Optional[Dict]:
    """Smart fetch - try multiple sources."""
    sources = [
        ('waycare', fetch_from_waycare),
        ('abhangu', fetch_from_abhangu),
        ('postman', fetch_from_postman_public_api),
    ]
    
    for source_name, fetch_func in sources:
        try:
            data = fetch_func(train_no)
            if data:
                data['source'] = source_name
                return data
            time.sleep(REQUEST_DELAY)
        except:
            continue
    
    return None

# ────────────────────────────────────────────────────────────────────────────
# DATABASE OPERATIONS
# ────────────────────────────────────────────────────────────────────────────

def connect_db():
    """Connect to PostgreSQL."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

def load_trains_batch(conn, trains_data: List[Dict]) -> int:
    """Load trains into PostgreSQL."""
    if not trains_data:
        return 0
    
    try:
        cur = conn.cursor()
        
        train_rows = []
        for train in trains_data:
            if not train or ('train_no' not in train and 'number' not in train):
                continue
            
            train_no = str(train.get('train_no') or train.get('number') or '')
            if not train_no:
                continue
            
            train_rows.append((
                str(uuid.uuid4()),
                train_no,
                train.get('train_name') or train.get('name') or f"Train {train_no}",
                train.get('train_type') or train.get('type') or 'Other',
                train.get('category'),
                None,  # sleeper_coaches
                None,  # ac_coaches
                None,  # general_coaches
            ))
        
        if train_rows:
            execute_values(cur, """
                INSERT INTO train_master
                    (id, train_no, name, train_type, train_category, sleeper_coaches, ac_coaches, general_coaches)
                VALUES %s
                ON CONFLICT (train_no) DO UPDATE SET
                    name = EXCLUDED.name,
                    train_type = EXCLUDED.train_type,
                    updated_at = NOW()
            """, train_rows, page_size=1000)
            conn.commit()
        
        cur.close()
        return len(train_rows)
    
    except Exception as e:
        logger.error(f"Error loading trains: {e}")
        conn.rollback()
        return 0

# ────────────────────────────────────────────────────────────────────────────
# MAIN SCRAPER
# ────────────────────────────────────────────────────────────────────────────

def main():
    """Main scraper logic."""
    logger.info("=" * 80)
    logger.info(f"Railway Scraper Started - Train range {TRAIN_NO_START}-{TRAIN_NO_END}")
    logger.info("=" * 80)
    
    start_time = datetime.now()
    conn = connect_db()
    
    if not conn:
        logger.error("Failed to connect to database")
        return
    
    trains_data = []
    trains_found = 0
    trains_skipped = 0
    
    # Try to fetch bulk dataset first
    logger.info("Attempting to download Indian Railways dataset...")
    bulk_data = fetch_from_github_dataset()
    
    if bulk_data:
        logger.info(f"Downloaded {len(bulk_data)} trains from public dataset")
        # Filter trains in range
        for train in bulk_data:
            try:
                train_no_str = str(train.get('train_no') or train.get('number') or '')
                if train_no_str.isdigit():
                    train_no_int = int(train_no_str)
                    if TRAIN_NO_START <= train_no_int <= TRAIN_NO_END:
                        trains_data.append(train)
                        trains_found += 1
                        
                        if len(trains_data) >= BATCH_SIZE:
                            loaded = load_trains_batch(conn, trains_data)
                            logger.info(f"Batch: {loaded} trains imported")
                            trains_data = []
            except:
                continue
        
        # Load remaining
        if trains_data:
            loaded = load_trains_batch(conn, trains_data)
            logger.info(f"Final batch: {loaded} trains imported")
            trains_data = []
    
    # If bulk dataset didn't work, try individual API queries
    if trains_found == 0:
        logger.info("Bulk dataset unavailable, querying individual trains...")
        
        for train_no in range(TRAIN_NO_START, TRAIN_NO_END + 1):
            try:
                if train_no % 500 == 0:
                    logger.info(f"Querying trains {train_no}... (Found: {trains_found})")
                
                data = fetch_train_smart(str(train_no))
                
                if data:
                    trains_data.append(data)
                    trains_found += 1
                else:
                    trains_skipped += 1
                
                # Load in batches
                if len(trains_data) >= BATCH_SIZE:
                    loaded = load_trains_batch(conn, trains_data)
                    trains_data = []
                
            except Exception as e:
                trains_skipped += 1
        
        # Load remaining trains
        if trains_data:
            loaded = load_trains_batch(conn, trains_data)
    
    conn.close()
    elapsed = (datetime.now() - start_time).total_seconds()
    
    logger.info("=" * 80)
    logger.info("SCRAPING COMPLETE")
    logger.info(f"  Trains found: {trains_found}")
    logger.info(f"  Trains skipped: {trains_skipped}")
    logger.info(f"  Time elapsed: {elapsed:.2f}s")
    logger.info("=" * 80)

if __name__ == "__main__":
    main()
