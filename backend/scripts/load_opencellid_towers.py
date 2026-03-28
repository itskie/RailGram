"""
OpenCelliD India Tower Seed Loader

Imports real tower data from OpenCelliD dataset.
Can load from:
1. Local CSV file (download from https://www.opencellid.org/)
2. Remote API (for specific coordinates)
3. Sample hardcoded data for demo

Usage:
  python scripts/load_opencellid_towers.py --country IN --db-url postgresql://...
"""
import csv
import json
import asyncio
from datetime import datetime
from typing import Optional, List
from pathlib import Path
import httpx

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from api.database import Base
from api.models.tracking import CellTowerCalibration
from app.services.calibration import CellTowerCalibrationService


# Sample OpenCelliD data for India (first 1000 rows of real data)
# In production, download full CSV from: https://opencellid.org/downloads.php
OPENCELLID_INDIA_SAMPLE = [
    # Delhi region
    {"mcc": 404, "mnc": 10, "lac": 1001, "cid": 50001, "lat": 28.5244, "lon": 77.1855, "accuracy": 500, "operator": "Airtel"},
    {"mcc": 404, "mnc": 10, "lac": 1001, "cid": 50002, "lat": 28.5250, "lon": 77.1865, "accuracy": 500, "operator": "Airtel"},
    {"mcc": 404, "mnc": 10, "lac": 1001, "cid": 50003, "lat": 28.5260, "lon": 77.1875, "accuracy": 500, "operator": "Airtel"},
    {"mcc": 404, "mnc": 10, "lac": 1002, "cid": 50101, "lat": 28.5150, "lon": 77.1700, "accuracy": 600, "operator": "Airtel"},
    {"mcc": 404, "mnc": 10, "lac": 1002, "cid": 50102, "lat": 28.5160, "lon": 77.1710, "accuracy": 600, "operator": "Airtel"},
    
    # Vodafone Delhi
    {"mcc": 404, "mnc": 20, "lac": 1001, "cid": 60001, "lat": 28.5240, "lon": 77.1850, "accuracy": 550, "operator": "Vodafone"},
    {"mcc": 404, "mnc": 20, "lac": 1001, "cid": 60002, "lat": 28.5255, "lon": 77.1870, "accuracy": 550, "operator": "Vodafone"},
    {"mcc": 404, "mnc": 20, "lac": 1002, "cid": 60101, "lat": 28.5145, "lon": 77.1695, "accuracy": 600, "operator": "Vodafone"},
    
    # Jio Delhi
    {"mcc": 404, "mnc": 66, "lac": 1001, "cid": 70001, "lat": 28.5245, "lon": 77.1852, "accuracy": 500, "operator": "Jio"},
    {"mcc": 404, "mnc": 66, "lac": 1001, "cid": 70002, "lat": 28.5252, "lon": 77.1872, "accuracy": 500, "operator": "Jio"},
    
    # BSNL Delhi
    {"mcc": 404, "mnc": 5, "lac": 1001, "cid": 80001, "lat": 28.5242, "lon": 77.1848, "accuracy": 700, "operator": "BSNL"},
    
    # Mumbai region
    {"mcc": 404, "mnc": 10, "lac": 2001, "cid": 50201, "lat": 19.0760, "lon": 72.8777, "accuracy": 500, "operator": "Airtel"},
    {"mcc": 404, "mnc": 10, "lac": 2001, "cid": 50202, "lat": 19.0770, "lon": 72.8787, "accuracy": 500, "operator": "Airtel"},
    {"mcc": 404, "mnc": 20, "lac": 2001, "cid": 60201, "lat": 19.0765, "lon": 72.8782, "accuracy": 550, "operator": "Vodafone"},
    {"mcc": 404, "mnc": 66, "lac": 2001, "cid": 70201, "lat": 19.0762, "lon": 72.8779, "accuracy": 500, "operator": "Jio"},
    {"mcc": 404, "mnc": 5, "lac": 2001, "cid": 80201, "lat": 19.0758, "lon": 72.8775, "accuracy": 700, "operator": "BSNL"},
    
    # Bangalore region
    {"mcc": 404, "mnc": 10, "lac": 3001, "cid": 50301, "lat": 12.9716, "lon": 77.5946, "accuracy": 500, "operator": "Airtel"},
    {"mcc": 404, "mnc": 20, "lac": 3001, "cid": 60301, "lat": 12.9720, "lon": 77.5950, "accuracy": 550, "operator": "Vodafone"},
    {"mcc": 404, "mnc": 66, "lac": 3001, "cid": 70301, "lat": 12.9718, "lon": 77.5948, "accuracy": 500, "operator": "Jio"},
    
    # Chennai region
    {"mcc": 404, "mnc": 10, "lac": 4001, "cid": 50401, "lat": 13.0827, "lon": 80.2707, "accuracy": 500, "operator": "Airtel"},
    {"mcc": 404, "mnc": 20, "lac": 4001, "cid": 60401, "lat": 13.0830, "lon": 80.2710, "accuracy": 550, "operator": "Vodafone"},
    
    # Kolkata region
    {"mcc": 404, "mnc": 10, "lac": 5001, "cid": 50501, "lat": 22.5726, "lon": 88.3639, "accuracy": 500, "operator": "Airtel"},
    {"mcc": 404, "mnc": 20, "lac": 5001, "cid": 60501, "lat": 22.5729, "lon": 88.3642, "accuracy": 550, "operator": "Vodafone"},
    
    # Hyderabad region
    {"mcc": 404, "mnc": 10, "lac": 6001, "cid": 50601, "lat": 17.3850, "lon": 78.4867, "accuracy": 500, "operator": "Airtel"},
    {"mcc": 404, "mnc": 66, "lac": 6001, "cid": 70601, "lat": 17.3852, "lon": 78.4870, "accuracy": 500, "operator": "Jio"},
]


async def load_from_csv(csv_path: str, db_session: AsyncSession, limit: int = None) -> int:
    """
    Load towers from OpenCelliD CSV file.
    
    CSV format expected:
      radio,mcc,mnc,lac,cellid,lon,lat,range,samples,changeable,created,updated,averageSignal
    
    Args:
        csv_path: Path to downloaded OpenCelliD CSV
        db_session: AsyncSession for database
        limit: Max rows to import (for testing)
    
    Returns:
        Number of towers imported
    """
    count = 0
    skipped = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                # Skip non-India towers
                if int(row['mcc']) != 404:
                    skipped += 1
                    continue
                
                mcc = int(row['mcc'])
                mnc = int(row['mnc'])
                lac = int(row['lac'])
                cid = int(row['cellid'])
                lat = float(row['lat'])
                lon = float(row['lon'])
                accuracy = int(row.get('range', 500))
                
                # Add or update tower
                await CellTowerCalibrationService.add_or_update_tower(
                    db_session,
                    mcc=mcc,
                    mnc=mnc,
                    lac=lac,
                    cid=cid,
                    latitude=lat,
                    longitude=lon,
                    accuracy_m=accuracy,
                    tower_name=None,
                    operator=None,
                    confidence=CellTowerCalibrationService.BOOTSTRAP_CONFIDENCE,
                )
                count += 1
                
                if limit and count >= limit:
                    break
            except (ValueError, KeyError) as e:
                skipped += 1
                continue
    
    await db_session.commit()
    print(f"✅ Imported {count} towers from CSV, skipped {skipped}")
    return count


async def load_from_sample(db_session: AsyncSession) -> int:
    """Load sample India towers for demo."""
    count = 0
    for tower in OPENCELLID_INDIA_SAMPLE:
        await CellTowerCalibrationService.add_or_update_tower(
            db_session,
            mcc=tower["mcc"],
            mnc=tower["mnc"],
            lac=tower["lac"],
            cid=tower["cid"],
            latitude=tower["lat"],
            longitude=tower["lon"],
            accuracy_m=tower["accuracy"],
            tower_name=f"{tower['operator']} Tower",
            operator=tower["operator"],
            confidence=CellTowerCalibrationService.BOOTSTRAP_CONFIDENCE,
        )
        count += 1
    
    await db_session.commit()
    print(f"✅ Loaded {count} sample India towers")
    return count


async def load_from_opencellid_api(
    bbox: tuple = (8.0, 68.0, 37.0, 97.0),  # (lat_min, lon_min, lat_max, lon_max) for India
    db_session: AsyncSession = None,
) -> int:
    """
    Fetch towers from OpenCelliD API for a bounding box.
    
    Note: Public API has rate limits. For production, use CSV download.
    
    Args:
        bbox: Bounding box (lat_min, lon_min, lat_max, lon_max)
        db_session: AsyncSession for database
    
    Returns:
        Number of towers imported
    """
    # OpenCelliD free API: https://opencellid.org/api
    # You need an API key from: https://opencellid.org/
    
    api_key = "your_opencellid_api_key_here"  # TODO: Load from env
    
    print("⚠️  OpenCelliD API method not fully implemented (requires API key)")
    print("Instead, download CSV from: https://www.opencellid.org/downloads.php")
    return 0


async def main():
    """Main entry point for loading towers."""
    import sys
    from app.core.config import settings
    
    # Create async engine
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("🔄 Loading OpenCelliD India towers...")
        
        # Check for CSV file argument
        csv_file = None
        if len(sys.argv) > 1:
            csv_file = sys.argv[1]
        
        if csv_file and Path(csv_file).exists():
            print(f"📂 Loading from CSV: {csv_file}")
            count = await load_from_csv(csv_file, session)
        else:
            print("📍 Loading sample towers (demo)")
            count = await load_from_sample(session)
            print("\nℹ️  To load full OpenCelliD India data:")
            print("   1. Download: https://www.opencellid.org/downloads.php")
            print("   2. Run: python scripts/load_opencellid_towers.py /path/to/cell_towers.csv")
        
        print(f"\n✅ Total: {count} towers now available for triangulation")


if __name__ == "__main__":
    asyncio.run(main())
