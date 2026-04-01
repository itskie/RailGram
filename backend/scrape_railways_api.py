#!/usr/bin/env python3
"""
Fast Railway Scraper - Direct HTTP + API approach
Scrapes train data from multiple railway sources without JavaScript rendering
"""

import os
import sys
import json
import uuid
import time
import logging
import random
from typing import Optional, Dict, List, Any
from datetime import datetime

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
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
        logging.FileHandler('scrape_railways_fast.log'),
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
BATCH_SIZE = 200
REQUEST_TIMEOUT = 5
RETRY_DELAY = 0.1

# User agents pool for rotation
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
]

# ────────────────────────────────────────────────────────────────────────────
# SESSION SETUP WITH RETRY STRATEGY
# ────────────────────────────────────────────────────────────────────────────

def create_session():
    """Create requests session with retry strategy."""
    session = requests.Session()
    
    # Retry strategy
    retry_strategy = Retry(
        total=2,
        status_forcelist=[429, 500, 502, 503, 504],
        method_whitelist=["HEAD", "GET", "OPTIONS"],
        backoff_factor=0.5
    )
    
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    # Random user agent
    session.headers.update({
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'application/json, text/html',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    })
    
    return session

session = create_session()

# ────────────────────────────────────────────────────────────────────────────
# RAILWAY SOURCES - Multiple API attempts
# ────────────────────────────────────────────────────────────────────────────

def fetch_from_trainradar_api(train_no: str) -> Optional[Dict]:
    """Fetch from TrainRadar API (no Cloudflare)."""
    try:
        # TrainRadar API endpoint
        url = f"https://api.railradar.in/v1/trains/{train_no}"
        response = session.get(url, timeout=REQUEST_TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                return data.get('data')
        return None
    except:
        return None

def fetch_from_trainspotter_api(train_no: str) -> Optional[Dict]:
    """Fetch from TrainSpotter API."""
    try:
        url = f"https://api.trainspotter.in/train/{train_no}"
        response = session.get(url, timeout=REQUEST_TIMEOUT)
        
        if response.status_code == 200:
            return response.json()
        return None
    except:
        return None

def fetch_from_cleartrip(train_no: str) -> Optional[Dict]:
    """Fetch from Cleartrip trains API."""
    try:
        # Cleartrip uses different format
        url = f"https://www.cleartrip.com/trains/search"
        params = {
            'from': 'delhi',
            'to': 'mumbai',
            'trainNo': train_no,
            'date': datetime.now().strftime('%d%m%Y')
        }
        
        response = session.get(url, params=params, timeout=REQUEST_TIMEOUT)
        
        if response.status_code == 200:
            # Parse response (Cleartrip may return HTML but contains JSON)
            try:
                data = response.json()
                return data
            except:
                # Try to extract from HTML
                if train_no in response.text:
                    return {'train_no': train_no, 'source': 'cleartrip'}
        return None
    except:
        return None

def fetch_from_indiarailways_json(train_no: str) -> Optional[Dict]:
    """Try cached/public railway data endpoints."""
    try:
        # Some public railway APIs
        urls = [
            f"https://www.data.gov.in/api/datastore/sql?sql=SELECT%20*%20FROM%20%22{train_no}%22",
            f"https://open.data.gov.in/railways/trains/{train_no}",
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

def fetch_train_data(train_no: str) -> Optional[Dict]:
    """Try multiple sources to fetch train data."""
    # Try in order of reliability
    data = fetch_from_trainradar_api(train_no)
    if data:
        return {**data, 'source': 'trainradar_api'}
    
    time.sleep(RETRY_DELAY)
    
    data = fetch_from_trainspotter_api(train_no)
    if data:
        return {**data, 'source': 'trainspotter_api'}
    
    time.sleep(RETRY_DELAY)
    
    data = fetch_from_cleartrip(train_no)
    if data:
        return {**data, 'source': 'cleartrip'}
    
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
            if not train or 'train_no' not in train:
                continue
            
            train_rows.append((
                str(uuid.uuid4()),
                str(train['train_no']),
                train.get('train_name') or train.get('name') or f"Train {train['train_no']}",
                train.get('train_type', 'Other'),
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
            logger.info(f"Loaded {len(train_rows)} trains to database")
        
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
        return
    
    trains_data = []
    trains_found = 0
    trains_skipped = 0
    
    try:
        # Scrape trains in batches
        for train_no in range(TRAIN_NO_START, TRAIN_NO_END + 1):
            try:
                if train_no % 100 == 0:
                    logger.info(f"Scraping trains {train_no}... (Found: {trains_found}, Skipped: {trains_skipped})")
                
                data = fetch_train_data(str(train_no))
                
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
    
    except KeyboardInterrupt:
        logger.info("Scraper interrupted by user")
        conn.close()
    except Exception as e:
        logger.error(f"Scraper error: {e}")
        conn.close()

if __name__ == "__main__":
    main()
