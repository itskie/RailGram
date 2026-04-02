/**
 * Offline Triangulation Hook for React Native
 *
 * Uses local tower database + triangulation algorithm to compute position offline.
 * No internet required (after initial tower DB download).
 *
 * Usage:
 *   const { triangulate, loading } = useOfflineTriangulation();
 *   const result = await triangulate(cellTowers);
 *   // result: { latitude, longitude, accuracy_m, confidence }
 */

import { useState, useCallback } from "react";
import { LocalTowerDatabase } from "./towerDatabase";

interface CellTowerSignal {
  mcc: number;
  mnc: number;
  lac: number;
  cid: number;
  rssi_dbm: number;
}

interface TriangulationResult {
  latitude: number;
  longitude: number;
  accuracy_m: number;
  confidence: number;
}

/**
 * Same triangulation algorithm as backend (Python -> TypeScript)
 * RSSI-based multilateration using Gauss-Newton
 */
class OfflineTriangulator {
  private static readonly REFERENCE_POWER_DBM = -30;
  private static readonly PATH_LOSS_EXPONENT = 3.5;
  private static readonly MIN_TOWERS = 3;

  /**
   * Convert RSSI to distance via free-space path loss model
   */
  static rssiToDistance(rssiDbm: number): number {
    if (rssiDbm >= this.REFERENCE_POWER_DBM) {
      return 10.0;
    }

    const distance = Math.pow(
      10,
      (this.REFERENCE_POWER_DBM - rssiDbm) / (10 * this.PATH_LOSS_EXPONENT)
    );

    return Math.max(10.0, Math.min(distance, 50000.0));
  }

  /**
   * Haversine distance between two lat/lng points (meters)
   */
  static haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.asin(Math.sqrt(a));

    return R * c;
  }

  /**
   * Triangulate position from 3+ cell towers
   */
  static triangulate(
    signals: Array<{
      latitude: number;
      longitude: number;
      rssi_dbm: number;
      accuracy_m: number;
      confidence: number;
    }>
  ): TriangulationResult | null {
    if (signals.length < this.MIN_TOWERS) {
      return null;
    }

    // Convert RSSI to distances
    const towers = signals.map((sig) => ({
      lat: sig.latitude,
      lon: sig.longitude,
      distance: this.rssiToDistance(sig.rssi_dbm),
      variance: (sig.accuracy_m ** 2) / (sig.confidence + 0.1),
      weight: 1.0 / ((sig.accuracy_m ** 2) / (sig.confidence + 0.1)),
      accuracy: sig.accuracy_m,
    }));

    // Weighted centroid as initial guess
    const totalWeight = towers.reduce((sum, t) => sum + t.weight, 0);
    let latEst =
      towers.reduce((sum, t) => sum + t.lat * t.weight, 0) / totalWeight;
    let lonEst =
      towers.reduce((sum, t) => sum + t.lon * t.weight, 0) / totalWeight;

    // Gauss-Newton iterations
    for (let iteration = 0; iteration < 3; iteration++) {
      let residualSq = 0;
      let totalWeightSum = 0;

      // Build jacobian + residuals
      const J: number[][] = [];
      const residuals: number[] = [];
      const weights: number[] = [];

      for (const tower of towers) {
        const dist = this.haversineDistance(latEst, lonEst, tower.lat, tower.lon);
        const residual = dist - tower.distance;
        residuals.push(residual);
        weights.push(tower.weight);

        const distSafe = Math.max(dist, 1);
        const dLat = ((tower.lat - latEst) / distSafe) * 111320;
        const dLon = ((tower.lon - lonEst) / distSafe) * 111320 * Math.cos((latEst * Math.PI) / 180);

        J.push([dLat, dLon]);
      }

      // Normal equations: (J^T W J)^-1 J^T W * residuals
      const JtWJ = [[0, 0], [0, 0]];
      const JtWr = [0, 0];

      for (let i = 0; i < J.length; i++) {
        const row = J[i];
        const w = weights[i];
        for (let j = 0; j < 2; j++) {
          for (let k = 0; k < 2; k++) {
            JtWJ[j][k] += w * row[j] * row[k];
          }
          JtWr[j] += w * row[j] * residuals[i];
        }
      }

      // Solve 2x2 system via Cramer's rule
      const det = JtWJ[0][0] * JtWJ[1][1] - JtWJ[0][1] * JtWJ[1][0];
      if (Math.abs(det) < 1e-9) break;

      const deltaLat =
        ((JtWr[0] * JtWJ[1][1] - JtWr[1] * JtWJ[0][1]) / det / 111320) * 0.5;
      const deltaLon =
        ((-JtWr[0] * JtWJ[1][0] + JtWr[1] * JtWJ[0][0]) /
          det /
          (111320 * Math.cos((latEst * Math.PI) / 180))) *
        0.5;

      latEst += deltaLat;
      lonEst += deltaLon;

      // Stop if converged
      if (Math.abs(deltaLat) < 1e-6 && Math.abs(deltaLon) < 1e-6) {
        break;
      }
    }

    // Compute accuracy
    let residualSq = 0;
    let totalWeightSum = 0;
    for (const tower of towers) {
      const dist = this.haversineDistance(latEst, lonEst, tower.lat, tower.lon);
      residualSq += tower.weight * (dist - tower.distance) ** 2;
      totalWeightSum += tower.weight;
    }

    const rmse = Math.sqrt(residualSq / totalWeightSum);
    const avgTowerAccuracy = towers.reduce((sum, t) => sum + t.accuracy, 0) / towers.length;
    const totalAccuracy = Math.max(
      100,
      Math.sqrt(rmse ** 2 + (avgTowerAccuracy / 2) ** 2)
    );

    const confidence = Math.min(
      1.0,
      (signals.length / 5.0) * (1.0 - Math.min(rmse / 1000, 0.5))
    );

    return {
      latitude: latEst,
      longitude: lonEst,
      accuracy_m: Math.round(totalAccuracy),
      confidence,
    };
  }
}

/**
 * React hook for offline triangulation
 * 
 * Usage:
 *   const { triangulate, loading, error } = useOfflineTriangulation(db);
 *   const result = await triangulate(cellTowers);
 */
export function useOfflineTriangulation(db: LocalTowerDatabase | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triangulate = useCallback(
    async (cellTowerIds: CellTowerSignal[]): Promise<TriangulationResult | null> => {
      if (!db) {
        setError("Database not initialized");
        return null;
      }

      if (cellTowerIds.length < 3) {
        setError(`Need 3+ towers, got ${cellTowerIds.length}`);
        return null;
      }

      try {
        setLoading(true);
        setError(null);

        // Look up tower calibrations from local DB
        const signals = [];
        for (const cellId of cellTowerIds) {
          const tower = await db.getTowerById(
            cellId.mcc,
            cellId.mnc,
            cellId.lac,
            cellId.cid
          );

          if (tower && tower.latitude && tower.longitude) {
            signals.push({
              latitude: tower.latitude,
              longitude: tower.longitude,
              rssi_dbm: cellId.rssi_dbm,
              accuracy_m: tower.accuracy_m || 500,
              confidence: tower.confidence_score || 0.5,
            });
          }
        }

        if (signals.length < 3) {
          setError(`Only ${signals.length} calibrated towers found (need 3+)`);
          return null;
        }

        // Perform triangulation
        const result = OfflineTriangulator.triangulate(signals);
        if (!result) {
          setError("Triangulation failed: towers not converging");
          return null;
        }

        // Update local tower confidences after successful triangulation
        for (const cellId of cellTowerIds) {
          const tower = await db.getTowerById(
            cellId.mcc,
            cellId.mnc,
            cellId.lac,
            cellId.cid
          );
          if (tower && tower.confidence_score) {
            const newConfidence = Math.min(
              1.0,
              tower.confidence_score + 0.05
            );
            await db.updateTowerConfidence(
              cellId.mcc,
              cellId.mnc,
              cellId.lac,
              cellId.cid,
              newConfidence
            );
          }
        }

        return result;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [db]
  );

  return { triangulate, loading, error };
}

/**
 * Standalone triangulation function (no hook)
 */
export async function triangulateOffline(
  cellTowerIds: CellTowerSignal[],
  db: LocalTowerDatabase
): Promise<TriangulationResult | null> {
  const signals = [];
  for (const cellId of cellTowerIds) {
    const tower = await db.getTowerById(
      cellId.mcc,
      cellId.mnc,
      cellId.lac,
      cellId.cid
    );

    if (tower && tower.latitude && tower.longitude) {
      signals.push({
        latitude: tower.latitude,
        longitude: tower.longitude,
        rssi_dbm: cellId.rssi_dbm,
        accuracy_m: tower.accuracy_m || 500,
        confidence: tower.confidence_score || 0.5,
      });
    }
  }

  if (signals.length < 3) {
    return null;
  }

  return OfflineTriangulator.triangulate(signals);
}
