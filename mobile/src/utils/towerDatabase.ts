/**
 * Local SQLite Tower Cache for Offline Triangulation
 *
 * Caches 50-100MB of tower data locally on device for offline use.
 * On first run, downloads tower data. Updates periodically in background.
 *
 * Usage:
 *   const db = await initTowerDatabase();
 *   const towers = await db.getTowersNearby(lat, lon, radiusKm);
 *   const tower = await db.getTowerById(mcc, mnc, lac, cid);
 */

import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";

const DB_NAME = "railgram_towers.db";
const DB_VERSION = 1;
const TOWERS_TABLE = "cell_tower_calibration";
const TOWERS_URL = "https://railgram.in/api/v1/towers/export";
const UPDATE_INTERVAL_DAYS = 7;

interface CellTowerData {
  mcc: number;
  mnc: number;
  lac: number;
  cid: number;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  tower_name?: string;
  operator?: string;
  confidence_score?: number;
}

export class LocalTowerDatabase {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;

  /**
   * Initialize tower database
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.createSchema();
      
      // Check if towers exist, if not download
      const count = await this.getTowerCount();
      if (count === 0) {
        console.log("📥 Downloading tower data for offline use...");
        await this.downloadTowers();
      }
      
      this.initialized = true;
      console.log("✅ Tower database ready");
    } catch (error) {
      console.error("Failed to initialize tower DB:", error);
      throw error;
    }
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    if (!this.db) return;

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${TOWERS_TABLE} (
        mcc INTEGER NOT NULL,
        mnc INTEGER NOT NULL,
        lac INTEGER NOT NULL,
        cid INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy_m INTEGER DEFAULT 500,
        tower_name TEXT,
        operator TEXT,
        confidence_score REAL DEFAULT 0.5,
        samples_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (mcc, mnc, lac, cid)
      );

      CREATE INDEX IF NOT EXISTS idx_location 
        ON ${TOWERS_TABLE}(latitude, longitude);
      
      CREATE INDEX IF NOT EXISTS idx_tower_id 
        ON ${TOWERS_TABLE}(mcc, mnc, lac, cid);
    `);
  }

  /**
   * Download towers from backend (compressed JSON array)
   */
  private async downloadTowers(): Promise<void> {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Fetch from backend
        const response = await fetch(`${TOWERS_URL}?limit=100000`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const towers: CellTowerData[] = data.towers || [];
        
        console.log(`📊 Downloaded ${towers.length} towers`);

        // Batch insert
        if (this.db && towers.length > 0) {
          await this.insertTowersBatch(towers);
        }
        
        return;
      } catch (error) {
        console.warn(`Download attempt ${attempt}/${maxRetries} failed:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }

  /**
   * Batch insert towers (for performance)
   */
  private async insertTowersBatch(towers: CellTowerData[]): Promise<void> {
    if (!this.db) return;

    const batchSize = 1000;
    for (let i = 0; i < towers.length; i += batchSize) {
      const batch = towers.slice(i, i + batchSize);
      
      const values = batch
        .map(
          (t) =>
            `(${t.mcc}, ${t.mnc}, ${t.lac}, ${t.cid}, ${t.latitude}, ${t.longitude}, ${t.accuracy_m || 500}, '${t.tower_name || ""}', '${t.operator || ""}', ${t.confidence_score || 0.5})`
        )
        .join(",");

      const sql = `
        INSERT OR REPLACE INTO ${TOWERS_TABLE} 
        (mcc, mnc, lac, cid, latitude, longitude, accuracy_m, tower_name, operator, confidence_score)
        VALUES ${values}
      `;

      try {
        await this.db.execAsync(sql);
      } catch (error) {
        console.error(`Failed to insert batch ${i / batchSize}:`, error);
      }
    }
  }

  /**
   * Get towers near a location (for triangulation)
   */
  async getTowersNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    limit: number = 20
  ): Promise<CellTowerData[]> {
    if (!this.db) throw new Error("Database not initialized");

    // Simple distance calculation (sqrt of lat/lon diff)
    // In reality, use proper haversine in SQL (PostGIS style)
    const latDelta = radiusKm / 111; // 1 degree ≈ 111 km
    const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

    const sql = `
      SELECT * FROM ${TOWERS_TABLE}
      WHERE latitude BETWEEN ${latitude - latDelta} AND ${latitude + latDelta}
        AND longitude BETWEEN ${longitude - lonDelta} AND ${longitude + lonDelta}
      ORDER BY 
        ((latitude - ${latitude})*(latitude - ${latitude}) 
         + (longitude - ${longitude})*(longitude - ${longitude}))
      LIMIT ${limit}
    `;

    try {
      const result = await this.db.allAsync(sql);
      return (result || []) as CellTowerData[];
    } catch (error) {
      console.error("Failed to query towers nearby:", error);
      return [];
    }
  }

  /**
   * Get specific tower by ID
   */
  async getTowerById(
    mcc: number,
    mnc: number,
    lac: number,
    cid: number
  ): Promise<CellTowerData | null> {
    if (!this.db) throw new Error("Database not initialized");

    const sql = `
      SELECT * FROM ${TOWERS_TABLE}
      WHERE mcc = ${mcc} AND mnc = ${mnc} AND lac = ${lac} AND cid = ${cid}
      LIMIT 1
    `;

    try {
      const result = (await this.db.allAsync(sql)) as CellTowerData[];
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error("Failed to get tower by ID:", error);
      return null;
    }
  }

  /**
   * Update tower confidence after successful triangulation
   */
  async updateTowerConfidence(
    mcc: number,
    mnc: number,
    lac: number,
    cid: number,
    newConfidence: number
  ): Promise<void> {
    if (!this.db) return;

    const sql = `
      UPDATE ${TOWERS_TABLE}
      SET confidence_score = ${newConfidence}, 
          samples_count = samples_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE mcc = ${mcc} AND mnc = ${mnc} AND lac = ${lac} AND cid = ${cid}
    `;

    try {
      await this.db.execAsync(sql);
    } catch (error) {
      console.error("Failed to update tower confidence:", error);
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    total_towers: number;
    last_update: string;
    db_size_mb: number;
  }> {
    const count = await this.getTowerCount();
    const path = `${FileSystem.documentDirectory}${DB_NAME}`;
    let size_mb = 0;

    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && info.size) {
        size_mb = info.size / (1024 * 1024);
      }
    } catch (error) {
      console.warn("Failed to get DB file size:", error);
    }

    return {
      total_towers: count,
      last_update: new Date().toISOString(),
      db_size_mb: parseFloat(size_mb.toFixed(2)),
    };
  }

  /**
   * Get tower count
   */
  private async getTowerCount(): Promise<number> {
    if (!this.db) return 0;

    try {
      const result = (await this.db.allAsync(
        `SELECT COUNT(*) as count FROM ${TOWERS_TABLE}`
      )) as any[];
      return result[0]?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Close database
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.initialized = false;
    }
  }
}

/**
 * React hook for tower database
 * 
 * Usage:
 *   const { db, loading } = useTowerDatabase();
 *   const towers = await db?.getTowersNearby(lat, lon);
 */
export function useTowerDatabase() {
  const [db, setDb] = useState<LocalTowerDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initDB = async () => {
      try {
        setLoading(true);
        const database = new LocalTowerDatabase();
        await database.init();
        setDb(database);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initDB();

    return () => {
      db?.close();
    };
  }, []);

  return { db, loading, error };
}
