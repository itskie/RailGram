/**
 * Complete Integration Example: Cell Tower Triangulation in Action
 *
 * This example screen demonstrates the FULL workflow:
 * 1. Request permissions
 * 2. Get cell tower signals from device
 * 3. Fetch nearby towers from local cache
 * 4. Triangulate offline
 * 5. Send to backend when online
 * 6. Update train position
 *
 * Usage:
 *   <OfflineTriangulationExample />
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { getCellTowersInfo, useCellTowers, requestCellTowerPermissions } from "./cellTowerManager";
import { useTowerDatabase } from "./towerDatabase";
import { useOfflineTriangulation } from "./offlineTriangulation";

interface TriangulationState {
  status: "idle" | "collecting" | "triangulating" | "sending";
  detected_towers: number;
  cached_towers: number;
  position?: {
    latitude: number;
    longitude: number;
    accuracy_m: number;
    confidence: number;
  };
  error?: string;
}

export function OfflineTriangulationExample() {
  const [state, setState] = useState<TriangulationState>({
    status: "idle",
    detected_towers: 0,
    cached_towers: 0,
  });

  // Initialize tower database on mount
  const { db, loading: dbLoading } = useTowerDatabase();

  // Get cell towers with auto-refresh
  const { towers, loading: towersLoading } = useCellTowers({ interval: 2000 });

  // Triangulation hook
  const { triangulate, loading: triangulatingLoading } =
    useOfflineTriangulation(db);

  // Handle permission + triangulation workflow
  const handleTriangulate = async () => {
    try {
      setState((s) => ({ ...s, status: "collecting" }));

      // 1. Request permissions
      const hasPermission = await requestCellTowerPermissions();
      if (!hasPermission) {
        throw new Error("Cell tower permissions denied");
      }

      // 2. Get device cell towers
      const cellInfo = await getCellTowersInfo();
      if (cellInfo.towers.length === 0) {
        throw new Error("No cell towers detected");
      }

      setState((s) => ({
        ...s,
        detected_towers: cellInfo.towers.length,
      }));

      // 3. Check cached towers
      if (!db) {
        throw new Error("Tower database not ready");
      }

      let cached_count = 0;
      for (const tower of cellInfo.towers) {
        const cached = await db.getTowerById(
          tower.mcc,
          tower.mnc,
          tower.lac,
          tower.cid
        );
        if (cached) {
          cached_count++;
        }
      }

      setState((s) => ({
        ...s,
        cached_towers: cached_count,
      }));

      if (cached_count < 3) {
        throw new Error(
          `Only ${cached_count} calibrated towers (need 3+). Updating from server...`
        );
      }

      // 4. Triangulate offline
      setState((s) => ({ ...s, status: "triangulating" }));
      const result = await triangulate(cellInfo.towers);

      if (!result) {
        throw new Error("Triangulation failed");
      }

      setState((s) => ({
        ...s,
        status: "idle",
        position: result,
      }));

      // 5. Send to backend when online (if connected)
      await sendToBackend(cellInfo.towers, result);
    } catch (error: any) {
      setState((s) => ({
        ...s,
        status: "idle",
        error: error.message,
      }));
    }
  };

  // Send result to backend
  const sendToBackend = async (
    towers: any[],
    result: any
  ) => {
    try {
      const trainNo = "12951"; // Get from route params
      const response = await fetch(
        `https://api.railgram.in/v1/trains/${trainNo}/cell-tower`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${globalThis.userToken}`,
          },
          body: JSON.stringify({
            signals: towers.map((t) => ({
              mcc: t.mcc,
              mnc: t.mnc,
              lac: t.lac,
              cid: t.cid,
              rssi_dbm: t.rssi_dbm,
            })),
          }),
        }
      );

      if (!response.ok) {
        console.warn(`Backend sync failed: ${response.status}`);
        // Offline is OK, we already have local result
      }
    } catch (error) {
      console.log("Offline mode: skipping backend sync", error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🛰️ Offline Triangulation</Text>

      {/* Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status</Text>
        <Text style={styles.status}>{state.status.toUpperCase()}</Text>

        <View style={styles.row}>
          <Text>📡 Detected Towers:</Text>
          <Text style={styles.bold}>{state.detected_towers}</Text>
        </View>
        <View style={styles.row}>
          <Text>💾 Cached Towers:</Text>
          <Text style={styles.bold}>{state.cached_towers}</Text>
        </View>

        {state.error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {state.error}</Text>
          </View>
        )}
      </View>

      {/* Position Card */}
      {state.position && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Position</Text>
          <View style={styles.row}>
            <Text>Latitude:</Text>
            <Text style={styles.bold}>
              {state.position.latitude.toFixed(6)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text>Longitude:</Text>
            <Text style={styles.bold}>
              {state.position.longitude.toFixed(6)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text>Accuracy:</Text>
            <Text style={styles.bold}>±{state.position.accuracy_m}m</Text>
          </View>
          <View style={styles.row}>
            <Text>Confidence:</Text>
            <Text style={styles.bold}>
              {(state.position.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
      )}

      {/* Database Stats */}
      {db && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💾 Local Database</Text>
          <TouchableOpacity
            onPress={async () => {
              const stats = await db.getStats();
              alert(
                `Towers: ${stats.total_towers}\nSize: ${stats.db_size_mb}MB\nLast: ${stats.last_update}`
              );
            }}
          >
            <Text style={styles.link}>View Stats →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Button */}
      <TouchableOpacity
        style={[
          styles.button,
          triangulatingLoading && styles.buttonDisabled,
        ]}
        onPress={handleTriangulate}
        disabled={triangulatingLoading || dbLoading}
      >
        {triangulatingLoading ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.buttonText}>Triangulating...</Text>
          </>
        ) : (
          <Text style={styles.buttonText}>
            🛰️ Triangulate Position
          </Text>
        )}
      </TouchableOpacity>

      {/* Developer Info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>ℹ️ How it Works</Text>
        <Text style={styles.infoText}>
          1. Collects cell tower signals from device
          {"\n"}
          2. Looks up towers in local SQLite cache
          {"\n"}
          3. Triangulates position using RSSI multilateration
          {"\n"}
          4. Works OFFLINE (no internet needed!)
          {"\n"}
          5. Syncs to backend when online
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  status: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0066cc",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  bold: {
    fontWeight: "600",
  },
  errorBox: {
    backgroundColor: "#ffe6e6",
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  errorText: {
    color: "#cc0000",
  },
  button: {
    backgroundColor: "#0066cc",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    color: "#0066cc",
    textDecorationLine: "underline",
  },
  infoBox: {
    backgroundColor: "#e6f2ff",
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
  },
  infoTitle: {
    fontWeight: "600",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
