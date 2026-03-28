/**
 * Cell Tower Information Manager for React Native (Expo)
 *
 * Extracts MCC/MNC/LAC/CID from device cellular connection.
 * - Android: Uses TelephonyManager via react-native-telephony
 * - iOS: Limited access (requires app entitlements), fallback to basic info
 *
 * Installation:
 *   npm install react-native-device-info react-native-sim-card
 */

import { Platform, NativeModules } from "react-native";
import DeviceInfo from "react-native-device-info";
import { useEffect, useState } from "react";

interface CellTowerSignal {
  mcc: number;        // Mobile Country Code (404 = India)
  mnc: number;        // Mobile Network Code (10=Airtel, 20=Vodafone, 66=Jio, 5=BSNL)
  lac: number;        // Location Area Code
  cid: number;        // Cell ID
  rssi_dbm: number;   // Signal strength (-150 to -30 dBm)
  tower_name?: string;
  operator?: string;
}

interface CellInfoManagerResult {
  towers: CellTowerSignal[];
  count: number;
  error?: string;
  platform: "android" | "ios" | "unknown";
}

/**
 * Extract visible cell towers from device.
 * 
 * Android: Reads all neighboring cells + signal strength
 * iOS: Limited to serving cell only (no entitlement for all cells on free tier)
 */
export async function getCellTowersInfo(): Promise<CellInfoManagerResult> {
  const result: CellInfoManagerResult = {
    towers: [],
    count: 0,
    platform: Platform.OS as any,
  };

  try {
    if (Platform.OS === "android") {
      // Android: Use TelephonyManager to get all visible cells
      const towers = await getNativeModule().getNearbyCells();
      
      if (towers && Array.isArray(towers)) {
        result.towers = towers.map((t: any) => ({
          mcc: t.mcc || 404,  // Default India
          mnc: t.mnc || 0,
          lac: t.lac || 0,
          cid: t.cid || 0,
          rssi_dbm: t.rssi || -100,
          tower_name: t.tower_name,
          operator: getOperatorName(t.mnc),
        }));
      }
    } else if (Platform.OS === "ios") {
      // iOS: Limited access without entitlements
      // Try to get serving cell info
      const cell = await getNativeModule().getServingCell();
      
      if (cell) {
        result.towers = [
          {
            mcc: cell.mcc || 404,
            mnc: cell.mnc || 0,
            lac: cell.lac || 0,
            cid: cell.cid || 0,
            rssi_dbm: cell.rssi || -100,
            operator: getOperatorName(cell.mnc),
          },
        ];
      }
      
      result.error = "iOS limited to serving cell only (requires entitlements for neighbor cells)";
    }

    result.count = result.towers.length;
    return result;
  } catch (error: any) {
    result.error = `Failed to get cell towers: ${error.message}`;
    result.count = 0;
    return result;
  }
}

/**
 * Map MNC code to operator name
 */
export function getOperatorName(mnc: number): string {
  const operators: Record<number, string> = {
    10: "Airtel",
    20: "Vodafone",
    5: "BSNL",
    66: "Jio",
    15: "IDEA",
    40: "Uninor",
    53: "Telenor",
  };
  return operators[mnc] || `Operator${mnc}`;
}

/**
 * React hook for getting cell towers
 * 
 * Usage:
 *   const { towers, loading, error } = useCellTowers({ interval: 5000 });
 *   console.log(`Found ${towers.length} towers`);
 */
export function useCellTowers(options?: { interval?: number }) {
  const [towers, setTowers] = useState<CellTowerSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTowers = async () => {
      try {
        setLoading(true);
        const result = await getCellTowersInfo();
        setTowers(result.towers);
        if (result.error) {
          setError(result.error);
        } else {
          setError(null);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchTowers();

    // Set interval if specified
    const interval = options?.interval || 5000;
    const intervalId = setInterval(fetchTowers, interval);

    return () => clearInterval(intervalId);
  }, [options?.interval]);

  return { towers, loading, error };
}

/**
 * Get native module (Android TelephonyManager bridge)
 */
function getNativeModule() {
  if (Platform.OS === "android") {
    return NativeModules.CellTowerManager || {};
  } else if (Platform.OS === "ios") {
    return NativeModules.CellTowerManager || {};
  }
  return {};
}

/**
 * Request location permissions for cell tower access
 */
export async function requestCellTowerPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      // Android 10+: Requires ACCESS_FINE_LOCATION or ACCESS_COARSE_LOCATION
      const { PermissionsAndroid } = require("react-native");
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      ]);

      return (
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED ||
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    } else if (Platform.OS === "ios") {
      // iOS: Managed via app permissions
      return true;
    }
    return false;
  } catch (error) {
    console.error("Permission request failed:", error);
    return false;
  }
}
