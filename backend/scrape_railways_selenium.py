#!/usr/bin/env python3
"""
Railway Scraper using Selenium + Cloudflare Bypass
Fetches train data from multiple railway sources where JavaScript rendering is needed
"""

import os
import sys
import json
import uuid
import time
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Try to import selenium - if not available, install
try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    print("Installing Selenium...")
    os.system("pip3 install selenium --quiet")
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.common.exceptions import TimeoutException, NoSuchElementException

# ────────────────────────────────────────────────────────────────────────────
# LOGGING SETUP
# ────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scrape_railways_selenium.log'),
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

# Railway websites to scrape
SOURCES = {
    "trainmytrip": "https://www.trainmytrip.com/train/",
    "railradar": "https://railradar.railyatri.in/",
    "trainjunction": "https://www.trainjunction.com/train-information/"
}

TRAIN_NO_START = 10000
TRAIN_NO_END = 99999
BATCH_SIZE = 100
REQUEST_TIMEOUT = 15

# ────────────────────────────────────────────────────────────────────────────
# SELENIUM DRIVER SETUP
# ────────────────────────────────────────────────────────────────────────────

def create_driver():
    """Create Selenium WebDriver with anti-detection settings."""
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    options.add_argument("--lang=en-US")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-web-resources")
    options.add_argument("--disable-extensions")
    
    # Try to use headless mode if display available
    try:
        driver = webdriver.Chrome(options=options)
    except:
        logger.warning("Chrome not available, trying Firefox...")
        options = webdriver.FirefoxOptions()
        options.add_argument("--headless")
        driver = webdriver.Firefox(options=options)
    
    return driver

# ────────────────────────────────────────────────────────────────────────────
# SCRAPING FUNCTIONS
# ────────────────────────────────────────────────────────────────────────────

def scrape_trainmytrip(driver, train_no: str) -> Optional[Dict]:
    """Scrape TrainMyTrip for train details."""
    try:
        url = f"{SOURCES['trainmytrip']}{train_no}"
        driver.get(url)
        
        # Wait for train info to load
        WebDriverWait(driver, REQUEST_TIMEOUT).until(
            EC.presence_of_element_located((By.CLASS_NAME, "train-name"))
        )
        
        # Extract train details
        train_name_elem = driver.find_element(By.CLASS_NAME, "train-name")
        train_name = train_name_elem.text if train_name_elem else None
        
        if not train_name:
            return None
        
        # Extract schedule table
        schedule_rows = []
        try:
            schedule_table = driver.find_element(By.CLASS_NAME, "schedule-table")
            rows = schedule_table.find_elements(By.TAG_NAME, "tr")[1:]  # Skip header
            
            for idx, row in enumerate(rows, 1):
                cols = row.find_elements(By.TAG_NAME, "td")
                if len(cols) >= 4:
                    schedule_rows.append({
                        'sequence': idx,
                        'station': cols[0].text,
                        'arrival': cols[1].text if len(cols) > 1 else None,
                        'departure': cols[2].text if len(cols) > 2 else None,
                        'day': int(idx / 20) + 1  # Rough estimation
                    })
        except:
            pass
        
        return {
            'train_no': train_no,
            'train_name': train_name,
            'source': 'trainmytrip',
            'stops': schedule_rows
        }
    
    except TimeoutException:
        return None
    except Exception as e:
        logger.warning(f"Error scraping {train_no} from TrainMyTrip: {e}")
        return None

def scrape_railradar(driver, train_no: str) -> Optional[Dict]:
    """Scrape RailRadar for train details."""
    try:
        url = f"{SOURCES['railradar']}trains/{train_no}"
        driver.get(url)
        
        # Wait for load
        WebDriverWait(driver, REQUEST_TIMEOUT).until(
            EC.presence_of_element_located((By.TAG_NAME, "h1"))
        )
        
        # Extract basic info
        try:
            title_elem = driver.find_element(By.TAG_NAME, "h1")
            title_text = title_elem.text
        except:
            return None
        
        return {
            'train_no': train_no,
            'train_name': title_text,
            'source': 'railradar'
        }
    
    except Exception as e:
        logger.warning(f"Error scraping {train_no} from RailRadar: {e}")
        return None

# ────────────────────────────────────────────────────────────────────────────
# DATABASE OPERATIONS
# ────────────────────────────────────────────────────────────────────────────

def load_trains_to_db(conn, trains_data: List[Dict]):
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
                train['train_no'],
                train.get('train_name', f"Train {train['train_no']}"),
                'Other',  # train_type
                None,  # train_category
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
                    updated_at = NOW()
            """, train_rows, page_size=100)
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
    logger.info("Railway Scraper (Selenium) Started")
    logger.info("=" * 80)
    
    start_time = datetime.now()
    
    # Connect to database
    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return
    
    # Initialize Selenium driver
    logger.info("Starting Selenium WebDriver...")
    try:
        driver = create_driver()
    except Exception as e:
        logger.error(f"Failed to create WebDriver: {e}")
        logger.info("\nInstalling ChromeDriver...")
        os.system("apt-get update -qq && apt-get install -y chromium-browser --quiet 2>/dev/null || brew install chromium 2>/dev/null")
        try:
            driver = create_driver()
        except:
            logger.error("ChromeDriver installation failed. Using headless Chrome only.")
            conn.close()
            return
    
    trains_found = 0
    trains_skipped = 0
    trains_batch = []
    
    try:
        # Scrape trains in batches
        for train_no in range(TRAIN_NO_START, TRAIN_NO_END + 1):
            try:
                if train_no % 100 == 0:
                    logger.info(f"Scraping trains {train_no}...")
                    if trains_batch:
                        loaded = load_trains_to_db(conn, trains_batch)
                        logger.info(f"Batch loaded: {loaded} trains")
                        trains_batch = []
                    time.sleep(0.5)
                
                # Try TrainMyTrip first
                train_data = scrape_trainmytrip(driver, str(train_no))
                
                if train_data:
                    trains_batch.append(train_data)
                    trains_found += 1
                else:
                    trains_skipped += 1
                
            except Exception as e:
                trains_skipped += 1
                logger.error(f"Error on train {train_no}: {e}")
        
        # Load remaining trains
        if trains_batch:
            loaded = load_trains_to_db(conn, trains_batch)
            logger.info(f"Final batch loaded: {loaded} trains")
        
        conn.close()
        driver.quit()
        
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info("=" * 80)
        logger.info("SCRAPING COMPLETE")
        logger.info(f"  Trains found: {trains_found}")
        logger.info(f"  Trains skipped: {trains_skipped}")
        logger.info(f"  Time elapsed: {elapsed:.2f}s")
        logger.info("=" * 80)
    
    except KeyboardInterrupt:
        logger.info("Scraper interrupted by user")
        driver.quit()
        conn.close()

if __name__ == "__main__":
    main()
