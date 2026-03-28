"""
Cell Tower Triangulation Service

Multilateration algorithm (RSSI-based):
- Input: 3+ cell tower signals (lat/lng, RSSI dBm, accuracy)
- Output: estimated position (lat/lng, accuracy_m)

RSSI to distance conversion:
  distance = 10 ^ ((RSSI - reference_power) / (10 * path_loss_exponent))
  
  Reference: -30 dBm @ 1m (typical for India)
  Path Loss Exponent: 2-4 (2 = free space, 4 = urban with obstacles)
"""
import math
from typing import Optional
from dataclasses import dataclass


@dataclass
class CellTowerSignal:
    """One cell tower observation from device."""
    latitude: float
    longitude: float
    rssi_dbm: int
    accuracy_m: Optional[int] = None
    confidence: float = 0.5  # confidence in tower's calibration


@dataclass
class TriangulationResult:
    """Output: computed position + accuracy."""
    latitude: float
    longitude: float
    accuracy_m: int  # estimated error radius in meters
    confidence: float  # 0.0 - 1.0


class CellTowerTriangulator:
    """RSSI-based multilateration for cell towers."""

    # Calibration parameters for India urban areas
    REFERENCE_POWER_DBM = -30  # dBm @ 1 meter
    PATH_LOSS_EXPONENT = 3.5   # typical for urban with obstacles
    
    # Minimum towers required for triangulation
    MIN_TOWERS_FOR_TRIANGULATION = 3

    @staticmethod
    def rssi_to_distance(rssi_dbm: int, path_loss_exp: float = PATH_LOSS_EXPONENT) -> float:
        """
        Convert RSSI (signal strength) to distance via free-space path loss model.
        
        Args:
            rssi_dbm: Signal strength in dBm (e.g., -80)
            path_loss_exp: Path loss exponent (2-4)
        
        Returns:
            Estimated distance in meters
        """
        if rssi_dbm >= CellTowerTriangulator.REFERENCE_POWER_DBM:
            # Too close or invalid
            return 10.0
        
        distance = 10 ** (
            (CellTowerTriangulator.REFERENCE_POWER_DBM - rssi_dbm) / (10 * path_loss_exp)
        )
        return max(10.0, min(distance, 50000.0))  # Clamp: 10m - 50km

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate distance between two lat/lng points in meters (haversine formula).
        
        Args:
            lat1, lon1: First point latitude/longitude
            lat2, lon2: Second point latitude/longitude
        
        Returns:
            Distance in meters
        """
        R = 6371000  # Earth radius in meters
        
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c

    @staticmethod
    def triangulate(signals: list[CellTowerSignal]) -> Optional[TriangulationResult]:
        """
        Multilaterate position from 3+ cell tower signals.
        
        Uses weighted least-squares algorithm:
        - Converts RSSI to distances
        - Weights by tower confidence + signal strength
        - Solves 2D position via iterative refinement
        
        Args:
            signals: List of cell tower observations (min 3)
        
        Returns:
            TriangulationResult if successful, None if insufficient data
        """
        if len(signals) < CellTowerTriangulator.MIN_TOWERS_FOR_TRIANGULATION:
            return None
        
        # Convert RSSI to distances with variance
        towers = []
        for sig in signals:
            distance_m = CellTowerTriangulator.rssi_to_distance(sig.rssi_dbm)
            # Higher RSSI strength = better accuracy = lower variance
            variance = distance_m ** 2 / (sig.confidence + 0.1)
            towers.append({
                'lat': sig.latitude,
                'lon': sig.longitude,
                'distance': distance_m,
                'variance': variance,
                'weight': 1.0 / variance,
                'accuracy': sig.accuracy_m or 100,
            })
        
        # Weighted least squares: solve for (lat, lon)
        # Start with weighted centroid as initial guess
        lat_est = sum(t['lat'] * t['weight'] for t in towers) / sum(t['weight'] for t in towers)
        lon_est = sum(t['lon'] * t['weight'] for t in towers) / sum(t['weight'] for t in towers)
        
        # Gauss-Newton iterative refinement (3 iterations typically converges)
        for iteration in range(3):
            # Compute jacobian + residuals
            residuals = []
            weights_diag = []
            
            for tower in towers:
                # Distance from current estimate to this tower
                dist_to_est = CellTowerTriangulator.haversine_distance(
                    lat_est, lon_est, tower['lat'], tower['lon']
                )
                # Residual: predicted distance - observed distance
                residual = dist_to_est - tower['distance']
                residuals.append(residual)
                weights_diag.append(tower['weight'])
            
            # Build approximate jacobian (linear approximation)
            J = []
            for tower in towers:
                dist = CellTowerTriangulator.haversine_distance(
                    lat_est, lon_est, tower['lat'], tower['lon']
                )
                if dist < 1:
                    dist = 1
                
                # Partial derivatives (normalized by distance)
                d_lat = (tower['lat'] - lat_est) / dist * 111320  # deg to meters
                d_lon = (tower['lon'] - lon_est) / dist * 111320 * math.cos(math.radians(lat_est))
                J.append([d_lat, d_lon])
            
            # Weighted least squares: minimize sum(weights * residuals^2)
            # Normal equations: (J^T W J)^-1 J^T W * residuals
            JtWJ = [[0, 0], [0, 0]]
            JtWr = [0, 0]
            
            for i, (row, w) in enumerate(zip(J, weights_diag)):
                for j in range(2):
                    for k in range(2):
                        JtWJ[j][k] += w * row[j] * row[k]
                    JtWr[j] += w * row[j] * residuals[i]
            
            # Solve 2x2 symmetric system via Cramer's rule
            det = JtWJ[0][0] * JtWJ[1][1] - JtWJ[0][1] * JtWJ[1][0]
            if abs(det) < 1e-9:
                break  # Singular, stop
            
            delta_lat = (JtWr[0] * JtWJ[1][1] - JtWr[1] * JtWJ[0][1]) / det / 111320
            delta_lon = (-JtWr[0] * JtWJ[1][0] + JtWr[1] * JtWJ[0][0]) / det / (111320 * math.cos(math.radians(lat_est)))
            
            lat_est += delta_lat * 0.5  # Damping to avoid oscillation
            lon_est += delta_lon * 0.5
            
            # Stop if converged
            if abs(delta_lat) < 1e-6 and abs(delta_lon) < 1e-6:
                break
        
        # Compute final accuracy: weighted avg of RSSI-derived distances + tower calibration accuracy
        residual_sq = 0
        total_weight = 0
        for tower in towers:
            dist = CellTowerTriangulator.haversine_distance(
                lat_est, lon_est, tower['lat'], tower['lon']
            )
            residual_sq += tower['weight'] * (dist - tower['distance']) ** 2
            total_weight += tower['weight']
        
        rmse = math.sqrt(residual_sq / total_weight) if total_weight > 0 else 100
        
        # Combine calibration uncertainty + residual error
        avg_tower_accuracy = sum(t['accuracy'] for t in towers) / len(towers)
        total_accuracy = int(math.sqrt(rmse ** 2 + (avg_tower_accuracy / 2) ** 2))
        
        # Confidence: higher if more towers, better signals, lower residuals
        confidence = min(1.0, (len(signals) / 5.0) * (1.0 - min(rmse / 1000, 0.5)))
        
        return TriangulationResult(
            latitude=lat_est,
            longitude=lon_est,
            accuracy_m=max(100, total_accuracy),  # At least 100m
            confidence=confidence,
        )
