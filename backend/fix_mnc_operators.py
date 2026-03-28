#!/usr/bin/env python3
"""
Fix all 'Unknown' operator assignments using complete TRAI/GSMA India MNC mapping
"""

import os
import psycopg2

db_url = os.environ.get("DATABASE_URL", "postgresql://kie@localhost:5432/railgram")
db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Complete India MCC=404/405 MNC → Operator mapping
# Source: TRAI/GSMA official assignments + circle-wise allocations
COMPLETE_MNC_MAP = {
    # BSNL
    1: "BSNL", 2: "BSNL", 4: "BSNL", 5: "BSNL", 7: "BSNL",
    28: "BSNL", 43: "BSNL", 67: "BSNL", 77: "BSNL",
    93: "BSNL", 94: "BSNL", 98: "BSNL",

    # MTNL (Mumbai + Delhi)
    3: "MTNL", 68: "MTNL", 69: "MTNL",

    # Airtel
    10: "Airtel", 12: "Airtel", 14: "Airtel", 15: "Airtel",
    16: "Airtel", 17: "Airtel", 18: "Airtel", 19: "Airtel",
    22: "Airtel", 34: "Airtel", 36: "Airtel", 40: "Airtel",
    51: "Airtel", 71: "Airtel", 72: "Airtel", 73: "Airtel",
    74: "Airtel", 75: "Airtel", 76: "Airtel", 85: "Airtel",
    95: "Airtel", 97: "Airtel", 99: "Airtel",

    # Vodafone (includes old Hutch circles)
    11: "Vodafone", 13: "Vodafone", 20: "Vodafone", 24: "Vodafone",
    27: "Vodafone", 30: "Vodafone", 31: "Vodafone", 39: "Vodafone",
    42: "Vodafone", 44: "Vodafone", 96: "Vodafone",

    # Vodafone Idea (VI)
    45: "VI", 46: "VI", 49: "VI",
    86: "VI", 87: "VI", 88: "VI", 89: "VI",

    # Reliance Jio (incl. absorbed Aircel spectrum circles)
    52: "Jio", 53: "Jio", 54: "Jio", 55: "Jio",
    56: "Jio", 57: "Jio", 58: "Jio", 59: "Jio",
    60: "Jio", 62: "Jio", 64: "Jio", 66: "Jio",
    70: "Jio", 78: "Jio", 79: "Jio", 80: "Jio",
    81: "Jio", 82: "Jio", 83: "Jio", 84: "Jio",
    90: "Jio", 91: "Jio", 92: "Jio",

    # Aircel (defunct 2018, spectrum absorbed by Jio in most circles)
    25: "Jio", 38: "Jio", 41: "Jio",

    # Idea (merged into VI)
    21: "VI",
}

def fix_unknown_operators():
    print("\n" + "=" * 65)
    print("🔧 FIXING UNKNOWN OPERATORS — COMPLETE MNC MAPPING")
    print("=" * 65)

    # Get current unknowns grouped by MNC
    cur.execute("""
        SELECT mnc, COUNT(*) as cnt
        FROM cell_tower_calibration
        WHERE operator = 'Unknown' AND mcc IN (404, 405)
        GROUP BY mnc ORDER BY cnt DESC
    """)
    unknowns = cur.fetchall()

    total_unknown = sum(cnt for _, cnt in unknowns)
    print(f"\n📊 Total unknown towers before fix: {total_unknown:,}")
    print(f"   Unique unknown MNCs: {len(unknowns)}\n")

    fixed = 0
    still_unknown = 0

    for mnc, cnt in unknowns:
        if mnc in COMPLETE_MNC_MAP:
            operator = COMPLETE_MNC_MAP[mnc]
            cur.execute("""
                UPDATE cell_tower_calibration
                SET operator = %s
                WHERE mnc = %s AND operator = 'Unknown' AND mcc IN (404, 405)
            """, (operator, mnc))
            rows = cur.rowcount
            fixed += rows
            print(f"  MNC {mnc:3d} → {operator:12}  updated {rows:7,} towers")
        else:
            still_unknown += cnt
            print(f"  MNC {mnc:3d} → ??? (no mapping)  {cnt:,} towers remain Unknown")

    conn.commit()

    print(f"\n{'=' * 65}")
    print(f"✅ Fixed:          {fixed:,} towers")
    print(f"⚠️  Still unknown:  {still_unknown:,} towers (rare/unmapped MNCs)")
    print(f"{'=' * 65}")

    # Final breakdown
    cur.execute("""
        SELECT operator, COUNT(*) as count
        FROM cell_tower_calibration
        WHERE mcc IN (404, 405)
        GROUP BY operator ORDER BY count DESC
    """)
    rows = cur.fetchall()
    total = sum(c for _, c in rows)

    print(f"\n📊 FINAL OPERATOR BREAKDOWN ({total:,} total towers):")
    for op, cnt in rows:
        pct = cnt / total * 100
        bar = "█" * int(pct // 3)
        print(f"  {op:12} │ {bar:<33} │ {cnt:8,}  ({pct:.1f}%)")

if __name__ == "__main__":
    try:
        fix_unknown_operators()
    finally:
        cur.close()
        conn.close()
