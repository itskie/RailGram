"""
Tunnel Detection Service

Detects when a train enters a tunnel by analyzing:
1. GPS signal loss (comparison with historical GPS data)
2. Cell tower consistency (towers stay same = static location = likely tunnel)
3. Time-distance mismatch (train should move X km in Y min but GPS stuck)

Outputs: tunnel_detected (bool), tunnel_start (UTC), tunnel_likely_length_km
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from math import radians, cos, sin, asin, sqrt

from api.models.tracking import GpsReport, CellTowerReport, TrainPosition
from api.models.trains import TrainMaster, TripSchedule
from app.services.interpolation import IST


class TunnelDetector:
    """Detect tunnel presence via GPS/cell tower anomaly analysis."""
    
    # Thresholds
    GPS_STALE_THRESHOLD_MIN = 3      # GPS not updated for 3 min = suspicious
    CELL_STUCK_THRESHOLD_MIN = 5     # Cell tower same for 5 min = likely static
    MAX_SPEED_KMPH = 120             # Max train speed
    STATIONARY_RADIUS_M = 200        # GPS within radius = stationary
    
    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Distance in meters between two points."""
        R = 6371000
        phi1 = radians(lat1)
        phi2 = radians(lat2)
        delta_phi = radians(lat2 - lat1)
        delta_lambda = radians(lon2 - lon1)
        a = sin(delta_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(delta_lambda / 2) ** 2
        c = 2 * asin(sqrt(a))
        return R * c

    @staticmethod
    async def detect_tunnel(
        train_no: str,
        db: AsyncSession,
        lookback_min: int = 30,  # Analyze last 30 min
    ) -> Optional[dict]:
        """
        Detect if a train is currently in a tunnel.
        
        Returns:
            {
                "tunnel_detected": bool,
                "confidence": 0.0-1.0,
                "tunnel_start": datetime,
                "gps_stale_min": int,
                "cell_tower_stuck_min": int,
                "likely_tunnel_length_km": float,
            }
            or None if insufficient data
        """
        now = datetime.now(IST)
        cutoff = now - timedelta(minutes=lookback_min)
        
        # Fetch recent GPS reports
        gps_res = await db.execute(
            select(GpsReport)
            .where(GpsReport.train_no == train_no)
            .where(GpsReport.created_at >= cutoff)
            .order_by(desc(GpsReport.created_at))
        )
        gps_reports = gps_res.scalars().all()
        
        # Fetch recent cell tower reports
        cell_res = await db.execute(
            select(CellTowerReport)
            .where(CellTowerReport.train_no == train_no)
            .where(CellTowerReport.created_at >= cutoff)
            .order_by(desc(CellTowerReport.created_at))
        )
        cell_reports = cell_res.scalars().all()
        
        if not gps_reports or len(gps_reports) < 2:
            return None  # Need at least 2 GPS points
        
        # Analyze GPS staleness
        latest_gps = gps_reports[0]
        oldest_gps = gps_reports[-1]
        gps_age_min = (now - latest_gps.created_at.replace(tzinfo=IST)).total_seconds() / 60
        
        # Analyze GPS movement
        gps_distance_m = TunnelDetector._haversine(
            oldest_gps.latitude, oldest_gps.longitude,
            latest_gps.latitude, latest_gps.longitude,
        )
        gps_time_diff_min = (latest_gps.created_at - oldest_gps.created_at).total_seconds() / 60
        
        # Check if GPS is stuck (low movement over time)
        gps_speed_kmph = 0
        if gps_time_diff_min > 0:
            gps_speed_kmph = (gps_distance_m / 1000) / (gps_time_diff_min / 60)
        
        tunnel_score = 0.0
        tunnel_start = None
        
        # SIGNAL 1: GPS hasn't updated recently
        if gps_age_min >= TunnelDetector.GPS_STALE_THRESHOLD_MIN:
            tunnel_score += 0.3
            tunnel_start = latest_gps.created_at
        
        # SIGNAL 2: GPS is stuck (distance < expected speed * time)
        expected_distance_m = TunnelDetector.MAX_SPEED_KMPH * (gps_time_diff_min / 60) * 1000
        if gps_distance_m < TunnelDetector.STATIONARY_RADIUS_M:
            # No movement = likely tunnel
            tunnel_score += 0.4
            if not tunnel_start:
                tunnel_start = oldest_gps.created_at
        elif gps_distance_m < expected_distance_m * 0.3:
            # Slow movement = tunnel/slow zone
            tunnel_score += 0.2
        
        # SIGNAL 3: Cell towers stuck on same IDs
        if len(cell_reports) >= 2:
            recent_cells = set()
            for rep in cell_reports[:5]:  # Last 5 reports
                recent_cells.add((rep.mcc, rep.mnc, rep.lac, rep.cid))
            
            if len(recent_cells) <= 1:
                # Same tower(s) = stuck location = tunnel likely
                tunnel_score += 0.25
        
        # Calculate tunnel length estimate
        tunnel_length_km = 0
        if tunnel_start:
            tunnel_age_min = (now - tunnel_start.replace(tzinfo=IST) if tunnel_start.tzinfo else tunnel_start.replace(tzinfo=IST)).total_seconds() / 60
            # Assume train moving at avg speed during tunnel
            avg_speed = min(gps_speed_kmph, TunnelDetector.MAX_SPEED_KMPH)
            tunnel_length_km = (avg_speed * tunnel_age_min / 60)
        
        # Determine if tunnel
        tunnel_detected = tunnel_score >= 0.5
        
        return {
            "tunnel_detected": tunnel_detected,
            "confidence": min(1.0, tunnel_score),
            "tunnel_start": tunnel_start,
            "gps_stale_min": int(gps_age_min),
            "cell_tower_stuck_min": int(gps_time_diff_min),
            "likely_tunnel_length_km": round(tunnel_length_km, 1),
        }

    @staticmethod
    async def get_tunnel_estimates(
        train_no: str,
        db: AsyncSession,
    ) -> Optional[dict]:
        """
        Get expected tunnel locations for a train based on route geometry.
        
        Queries major tunnels from route (e.g., Palghat Gap, Bhor Ghats, K2K tunnel).
        
        Returns:
            {
                "known_tunnels": [
                    {"name": "Palghat Gap", "start_km": 400, "end_km": 420, "length_km": 20},
                    ...
                ]
            }
        """
        # For now, hardcode some famous Indian railway tunnels
        known_tunnels_india = [
            {"name": "Palghat Gap", "route": "Erode-Shoranur", "start_km": 400, "end_km": 420, "length_km": 20},
            {"name": "Bhor Ghats", "route": "Pune-Miraj", "start_km": 80, "end_km": 110, "length_km": 30},
            {"name": "K2K Tunnel", "route": "Chennai-Bangalore", "start_km": 150, "end_km": 155, "length_km": 5},
            {"name": "Mahanadi Bridge", "route": "Bengaluru-Howrah", "start_km": 600, "end_km": 605, "length_km": 5},
        ]
        
        # Get train route
        result = await db.execute(
            select(TrainMaster).where(TrainMaster.train_no == train_no)
        )
        train = result.scalar_one_or_none()
        
        if not train:
            return None
        
        # Filter tunnels for this route (simple string match for demo)
        route_tunnels = [
            t for t in known_tunnels_india
            if (train.origin_code and train.origin_code.upper() in t.get("route", "").upper()) or
               (train.destination_code and train.destination_code.upper() in t.get("route", "").upper())
        ]
        
        return {
            "known_tunnels": route_tunnels,
        }


async def analyze_tunnel_at_position(
    train_no: str,
    db: AsyncSession,
) -> dict:
    """
    Complete tunnel analysis: detection + known tunnel lookup.
    
    Returns combined result with current tunnel status + expected tunnels.
    """
    detected = await TunnelDetector.detect_tunnel(train_no, db)
    expected = await TunnelDetector.get_tunnel_estimates(train_no, db)
    
    return {
        "current_status": detected,
        "expected_tunnels": expected,
    }
