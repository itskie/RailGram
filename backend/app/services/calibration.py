"""
Cell Tower Calibration Service

Manages the cell tower database:
1. Bootstrap: Load from OpenCelliD India dataset (free, crowdsourced)
2. Passive updates: Learn from triangulation results

Score-based confidence: Higher scores = more reliable positions for triangulation
"""
import math
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from api.models.tracking import CellTowerCalibration, CellTowerReport


class CellTowerCalibrationService:
    """Manage cell tower database calibration."""

    # Confidence thresholds
    BOOTSTRAP_CONFIDENCE = 0.3  # Newly added from OpenCelliD
    MIN_CONFIDENCE_FOR_USE = 0.2  # Minimum to use in triangulation
    
    # Update scoring
    SAMPLE_WEIGHT = 0.05  # How much each new sample affects confidence (0.05 = 20 samples to converge)

    @staticmethod
    async def get_tower_or_none(
        db: AsyncSession,
        mcc: int,
        mnc: int,
        lac: int,
        cid: int,
    ) -> Optional[CellTowerCalibration]:
        """Fetch a single tower from DB."""
        result = await db.execute(
            select(CellTowerCalibration).where(
                (CellTowerCalibration.mcc == mcc)
                & (CellTowerCalibration.mnc == mnc)
                & (CellTowerCalibration.lac == lac)
                & (CellTowerCalibration.cid == cid)
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def add_or_update_tower(
        db: AsyncSession,
        mcc: int,
        mnc: int,
        lac: int,
        cid: int,
        latitude: float,
        longitude: float,
        accuracy_m: int = 500,
        tower_name: Optional[str] = None,
        operator: Optional[str] = None,
        confidence: float = BOOTSTRAP_CONFIDENCE,
    ) -> CellTowerCalibration:
        """
        Add or update a cell tower in the calibration database.
        
        Args:
            db: AsyncSession
            mcc, mnc, lac, cid: Cell tower IDs
            latitude, longitude: Tower location
            accuracy_m: Estimated accuracy radius
            tower_name: City/area name
            operator: Telecom operator
            confidence: Initial confidence score
        
        Returns:
            CellTowerCalibration object
        """
        existing = await CellTowerCalibrationService.get_tower_or_none(db, mcc, mnc, lac, cid)
        
        if existing:
            # Update existing tower
            existing.latitude = latitude
            existing.longitude = longitude
            existing.accuracy_m = accuracy_m
            if tower_name:
                existing.tower_name = tower_name
            if operator:
                existing.operator = operator
            existing.confidence_score = confidence
            existing.updated_at = datetime.utcnow()
            tower = existing
        else:
            # Create new tower
            tower = CellTowerCalibration(
                mcc=mcc,
                mnc=mnc,
                lac=lac,
                cid=cid,
                latitude=latitude,
                longitude=longitude,
                accuracy_m=accuracy_m,
                tower_name=tower_name,
                operator=operator,
                confidence_score=confidence,
                samples_count=1,
            )
            db.add(tower)
        
        await db.flush()
        return tower

    @staticmethod
    async def update_confidence_from_triangulation(
        db: AsyncSession,
        triangulated_lat: float,
        triangulated_lon: float,
        triangulated_accuracy: int,
        signals: list[tuple[int, int, int, int]],  # List of (mcc, mnc, lac, cid)
        sample_weight: float = SAMPLE_WEIGHT,
    ) -> None:
        """
        Update tower confidences based on successful triangulation.
        
        When triangulation succeeds (converges + low residual), boost confidence
        of towers that participated.
        
        Args:
            db: AsyncSession
            triangulated_lat, triangulated_lon: Result position
            triangulated_accuracy: Result accuracy (lower = better)
            signals: Towers that participated
            sample_weight: Learning rate (0.0-1.0)
        """
        for mcc, mnc, lac, cid in signals:
            tower = await CellTowerCalibrationService.get_tower_or_none(db, mcc, mnc, lac, cid)
            if not tower or tower.latitude is None or tower.longitude is None:
                continue
            
            # Distance from tower's calibrated location to triangulation result
            tower_error_m = CellTowerCalibrationService._haversine(
                tower.latitude, tower.longitude,
                triangulated_lat, triangulated_lon,
            )
            
            # If triangulation is good and tower's location is close, boost confidence
            if triangulated_accuracy < 500 and tower_error_m < 1000:
                # Boost: delta = positive (tower helped)
                delta = sample_weight * 0.1
                new_confidence = min(1.0, tower.confidence_score + delta)
            elif tower_error_m > 5000:
                # Penalize: tower location seems wrong
                delta = -sample_weight * 0.05
                new_confidence = max(CellTowerCalibrationService.MIN_CONFIDENCE_FOR_USE, tower.confidence_score + delta)
            else:
                # Neutral: small adjustment
                new_confidence = tower.confidence_score
            
            tower.confidence_score = new_confidence
            tower.samples_count += 1
            tower.updated_at = datetime.utcnow()
        
        await db.flush()

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine distance in meters."""
        R = 6371000
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        c = 2 * math.asin(math.sqrt(a))
        return R * c

    @staticmethod
    async def bootstrap_from_opencellid_sample(
        db: AsyncSession,
    ) -> int:
        """
        Bootstrap cell tower DB from OpenCelliD India sample.
        
        In production, this would load from:
          - CSV: https://www.opencellid.org/downloads.php (India slice)
          - Or PostgreSQL extension: PostGIS + opencellid data
        
        For now, return count as example.
        
        Args:
            db: AsyncSession
        
        Returns:
            Number of towers added/updated
        """
        # Example: India cell tower data (sample from OpenCelliD)
        # Real data: https://downloads.opencellid.org/full/latest/
        sample_towers = [
            # (mcc, mnc, lac, cid, lat, lon, accuracy, tower_name, operator)
            (404, 10, 1001, 50001, 28.7041, 77.1025, 500, "Delhi", "Airtel"),
            (404, 10, 1001, 50002, 28.7045, 77.1035, 500, "Delhi", "Airtel"),
            (404, 20, 1001, 60001, 28.7050, 77.1000, 600, "Delhi", "Vodafone"),
            (404, 5, 2001, 70001, 19.0760, 72.8777, 800, "Mumbai", "BSNL"),
            (404, 66, 2001, 80001, 19.0765, 72.8782, 500, "Mumbai", "Jio"),
        ]
        
        count = 0
        for mcc, mnc, lac, cid, lat, lon, acc, name, ops in sample_towers:
            await CellTowerCalibrationService.add_or_update_tower(
                db, mcc, mnc, lac, cid,
                latitude=lat,
                longitude=lon,
                accuracy_m=acc,
                tower_name=name,
                operator=ops,
                confidence=CellTowerCalibrationService.BOOTSTRAP_CONFIDENCE,
            )
            count += 1
        
        await db.commit()
        return count
