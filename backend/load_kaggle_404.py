#!/usr/bin/env python3
"""
Load 1.81M India cell towers from Kaggle MCC=404 dataset
Columns: radio,mcc,mnc,lac,cid,changeable_0,long,lat,range,sample,...
"""

import csv
import psycopg2
from psycopg2.extras import execute_values

# Database connection
conn = psycopg2.connect("dbname=railgram user=kie host=localhost")
cur = conn.cursor()

CSV_FILE = "/Users/kie/Downloads/404.csv"

# MNC → Operator mapping for India MCC=404
MNC_OPERATOR = {
    1: "BSNL", 2: "BSNL",
    4: "BSNL", 5: "BSNL",
    7: "BSNL",
    10: "Airtel", 14: "Airtel", 15: "Airtel",
    16: "Airtel", 17: "Airtel", 18: "Airtel",
    19: "Airtel", 20: "Vodafone", 27: "Vodafone",
    30: "Vodafone", 31: "Vodafone", 39: "Vodafone",
    20: "Vodafone",
    40: "Airtel", 45: "VI", 46: "VI",
    49: "VI",
    60: "Jio", 66: "Jio",
    67: "BSNL",
    68: "MTNL", 69: "MTNL",
    70: "Jio",
    71: "Airtel",
    72: "Airtel",
    73: "Airtel",
    74: "Airtel",
    75: "Airtel",
    76: "Airtel",
    77: "BSNL",
    78: "Jio",
    79: "Jio",
    80: "Jio",
    81: "Jio",
    82: "Jio",
    83: "Jio",
    84: "Jio",
    85: "Airtel",
    86: "VI",
    87: "VI",
    88: "VI",
    89: "VI",
    90: "Jio",
    92: "Jio",
    93: "BSNL",
    94: "BSNL",
    95: "Airtel",
    96: "Vodafone",
    97: "Airtel",
    98: "BSNL",
    99: "Airtel",
}

def load():
    print("\n" + "=" * 70)
    print("🚂 LOADING KAGGLE INDIA 404 DATASET → 1.81M TOWERS")
    print("=" * 70)

    towers = []
    inserted = 0
    skipped = 0
    total = 0

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            total += 1

            if total % 100000 == 0:
                print(f"  Processed: {total:>9,} | Inserted: {inserted:>7,} | Skipped: {skipped:,}")

            try:
                mcc = int(row['mcc'])
                mnc  = int(row['mnc'])
                lac  = int(row['lac'])
                cid  = int(row['cid'])
                lat  = float(row['lat'])
                lng  = float(row['long'])

                # Validate India bounds
                if lat < 6.5 or lat > 37.5 or lng < 66.5 or lng > 99.0:
                    skipped += 1
                    continue

                # Skip obviously bad CIDs
                if cid <= 0 or lac <= 0:
                    skipped += 1
                    continue

                samples = int(row.get('sample', 1)) or 1
                tower_range = int(row.get('range', 500)) or 500
                accuracy = min(tower_range, 5000)

                # Confidence: based on samples (0.50 base, up to 0.92)
                confidence = min(0.50 + (samples / 50.0 * 0.35), 0.92)

                operator = MNC_OPERATOR.get(mnc, "Unknown")
                radio = row.get('radio', 'GSM')

                towers.append((
                    mcc, mnc, lac, cid,
                    round(lat, 6), round(lng, 6),
                    accuracy, round(confidence, 3),
                    operator,
                    f"{radio}-{mcc}-{mnc}-{lac}-{cid}",
                    samples
                ))
                inserted += 1

                if len(towers) >= 10000:
                    flush(towers)
                    towers = []

            except (ValueError, KeyError):
                skipped += 1

    if towers:
        flush(towers)

    print(f"\n{'=' * 70}")
    print(f"✅ DONE! Total processed: {total:,}")
    print(f"   Inserted: {inserted:,}")
    print(f"   Skipped:  {skipped:,}")
    print(f"{'=' * 70}\n")

    verify()

def flush(towers):
    # Deduplicate within batch by (mcc, mnc, lac, cid) - keep best confidence
    seen = {}
    for t in towers:
        key = (t[0], t[1], t[2], t[3])  # mcc, mnc, lac, cid
        if key not in seen or t[7] > seen[key][7]:  # keep higher confidence
            seen[key] = t
    deduped = list(seen.values())

    sql = """
    INSERT INTO cell_tower_calibration
        (mcc, mnc, lac, cid, latitude, longitude, accuracy_m, confidence_score,
         operator, tower_name, samples_count)
    VALUES %s
    ON CONFLICT (mcc, mnc, lac, cid) DO UPDATE SET
        confidence_score = GREATEST(EXCLUDED.confidence_score,
                                    cell_tower_calibration.confidence_score),
        samples_count    = cell_tower_calibration.samples_count + EXCLUDED.samples_count,
        accuracy_m       = LEAST(EXCLUDED.accuracy_m, cell_tower_calibration.accuracy_m)
    """
    execute_values(cur, sql, deduped)
    conn.commit()

def verify():
    cur.execute("SELECT COUNT(*) FROM cell_tower_calibration WHERE mcc IN (404,405)")
    total = cur.fetchone()[0]

    cur.execute("""
        SELECT operator, COUNT(*) FROM cell_tower_calibration
        WHERE mcc IN (404,405)
        GROUP BY operator ORDER BY COUNT(*) DESC
    """)

    print(f"📊 FINAL DB STATE:")
    print(f"   Total India towers: {total:,}")
    print(f"\n   Operator breakdown:")
    for op, cnt in cur.fetchall():
        pct = cnt / total * 100
        print(f"     {op:12} {cnt:8,}  ({pct:.1f}%)")

    cur.execute("""
        SELECT MIN(latitude), MAX(latitude), MIN(longitude), MAX(longitude)
        FROM cell_tower_calibration WHERE mcc IN (404,405)
    """)
    s, n, w, e = cur.fetchone()
    print(f"\n   Coverage: {s:.2f}°N → {n:.2f}°N,  {w:.2f}°E → {e:.2f}°E")

if __name__ == "__main__":
    try:
        load()
    finally:
        cur.close()
        conn.close()
