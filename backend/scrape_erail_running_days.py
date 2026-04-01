#!/usr/bin/env python3
"""
Erail.in scraper - Extract REAL running days for all Indian trains
erail.in uses official Indian Railways data via DATASOURCE_IR

Usage:
    python3 scrape_erail_running_days.py
"""

import os
import sys
import logging
import psycopg2
import requests
from time import sleep
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scrape_erail.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kie@localhost:5432/railgram")
DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

ERAIL_URL = "https://erail.in/rail/getTrains.aspx?TrainNo={}&DataType=TrainInfo&Language=0"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})


def fetch_running_days(train_no: str):
    """
    Fetch running days from erail.in
    Response format: ~~~^trainNo~name~...~runs_on~...
    runs_on is a 7-char string: SMTWTFS (1=runs, 0=doesnt)
    """
    try:
        url = ERAIL_URL.format(train_no)
        r = session.get(url, timeout=6)

        if r.status_code != 200 or not r.text or r.text.startswith('~~~~~'):
            # Empty or error response
            if '~' not in r.text:
                return None
            # May still have data - check below

        text = r.text.strip()
        if not text or text.count('~') < 5:
            return None

        # Parse: ~~~~~~timestamp~~~^trainNo~name~...~runs_on~...
        # Split by ^ to get train block
        if '^' not in text:
            return None

        train_block = text.split('^', 1)[1]
        parts = train_block.split('~')

        # Field index 11 is runs_on (7-char SMTWTFS string)
        # Format: trainNo~name~src_name~src~dst_name~dst~src_dep~dst_arr~duration~...~days~...
        if len(parts) < 12:
            return None

        runs_on = parts[11].strip()

        # Validate: must be 7 chars of 0/1
        if len(runs_on) == 7 and all(c in '01' for c in runs_on):
            return runs_on

        # Try other positions if not found at 11
        for i, part in enumerate(parts[:20]):
            part = part.strip()
            if len(part) == 7 and all(c in '01' for c in part):
                return part

        return None

    except requests.exceptions.Timeout:
        return None
    except Exception as e:
        logger.error(f"Train {train_no}: {str(e)[:60]}")
        return None


def main():
    logger.info("=" * 70)
    logger.info("Erail.in Running Days Scraper - Using Official IR Data")
    logger.info("=" * 70)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Get all trains
    cur.execute("SELECT id, train_no FROM train_master ORDER BY train_no ASC")
    trains = cur.fetchall()
    cur.close()

    logger.info(f"Total trains: {len(trains)}\n")

    updated = 0
    not_found = 0
    errors = 0

    for idx, (train_id, train_no) in enumerate(trains, 1):
        try:
            runs_on = fetch_running_days(train_no)

            if runs_on:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE train_master SET runs_on = %s WHERE id = %s",
                    (runs_on, train_id)
                )
                conn.commit()
                cur.close()
                updated += 1

                if idx % 50 == 0:
                    logger.info(f"[{idx}/{len(trains)}] Updated {updated} so far | Latest: {train_no} = {runs_on}")
            else:
                not_found += 1

            # Polite delay - dont hammer the server
            sleep(0.15)

        except Exception as e:
            errors += 1
            logger.error(f"[{idx}] {train_no}: {str(e)[:60]}")
            try:
                conn.rollback()
            except:
                pass

    conn.close()

    logger.info("\n" + "=" * 70)
    logger.info("DONE!")
    logger.info(f"  Updated:   {updated}")
    logger.info(f"  Not found: {not_found}")
    logger.info(f"  Errors:    {errors}")
    logger.info("=" * 70)


if __name__ == "__main__":
    main()
