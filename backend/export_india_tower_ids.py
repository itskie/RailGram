#!/usr/bin/env python3
"""
Export all cell tower IDs (MCC, MNC, LAC, CID) for complete India coverage
Used for railway network integration and cell tower reference system
"""

import psycopg2
import csv
from pathlib import Path
from datetime import datetime

# Database connection
conn = psycopg2.connect("dbname=railgram user=kie host=localhost")
cur = conn.cursor()

def export_tower_ids():
    """Export complete India cell tower database with IDs and metadata"""
    
    print("\n" + "=" * 80)
    print("🚂 RAILGRAM - INDIA CELL TOWER ID EXPORT")
    print("=" * 80)
    
    # Query all India towers
    query = """
    SELECT 
        mcc, mnc, lac, cid,
        latitude, longitude,
        accuracy_m, confidence_score,
        operator, tower_name, samples_count
    FROM cell_tower_calibration
    WHERE mcc IN (404, 405)
    ORDER BY operator, mcc, mnc, lac, cid
    """
    
    cur.execute(query)
    rows = cur.fetchall()
    
    if not rows:
        print("❌ No towers found in database!")
        return False
    
    # Create output file with timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_file = f"/Users/kie/Documents/RailGram/backend/exports/india_cell_tower_ids_{timestamp}.csv"
    
    # Create exports directory if needed
    Path("/Users/kie/Documents/RailGram/backend/exports").mkdir(parents=True, exist_ok=True)
    
    print(f"\n📝 Writing to: {output_file}")
    print(f"📊 Total towers: {len(rows):,}\n")
    
    # Write CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        
        # Header
        writer.writerow([
            'MCC', 'MNC', 'LAC', 'CID',
            'Latitude', 'Longitude',
            'Accuracy_m', 'Confidence_Score',
            'Operator', 'Tower_Name', 'Samples_Count'
        ])
        
        # Data rows
        for row in rows:
            writer.writerow(row)
    
    print(f"✅ Exported: {len(rows):,} towers")
    
    # Statistics
    cur.execute("""
    SELECT operator, COUNT(*) as count
    FROM cell_tower_calibration
    WHERE mcc IN (404, 405)
    GROUP BY operator
    ORDER BY count DESC
    """)
    
    print(f"\n📊 OPERATOR DISTRIBUTION:")
    total = len(rows)
    for op, cnt in cur.fetchall():
        pct = (cnt / total) * 100
        bar = "█" * int(pct // 5)
        print(f"  {op:12} │ {bar:<20} │ {cnt:6,} ({pct:5.1f}%)")
    
    # Geographic coverage
    cur.execute("""
    SELECT 
        MIN(latitude), MAX(latitude),
        MIN(longitude), MAX(longitude),
        COUNT(DISTINCT operator)
    FROM cell_tower_calibration
    WHERE mcc IN (404, 405)
    """)
    
    lat_min, lat_max, lon_min, lon_max, op_count = cur.fetchone()
    
    print(f"\n🗺️  GEOGRAPHIC COVERAGE:")
    print(f"  North: {lat_max:.4f}°N")
    print(f"  South: {lat_min:.4f}°N")
    print(f"  East:  {lon_max:.4f}°E")
    print(f"  West:  {lon_min:.4f}°E")
    print(f"  Area span: {lat_max - lat_min:.1f}° N-S × {lon_max - lon_min:.1f}° E-W")
    
    # Confidence distribution
    cur.execute("""
    SELECT 
        CASE WHEN confidence_score >= 0.8 THEN 'Excellent (≥0.8)'
             WHEN confidence_score >= 0.6 THEN 'Good (0.6-0.8)'
             WHEN confidence_score >= 0.4 THEN 'Fair (0.4-0.6)'
             ELSE 'Low (<0.4)'
        END as quality,
        COUNT(*) as count
    FROM cell_tower_calibration
    WHERE mcc IN (404, 405)
    GROUP BY quality
    ORDER BY quality DESC
    """)
    
    print(f"\n📈 SIGNAL QUALITY DISTRIBUTION:")
    for quality, cnt in cur.fetchall():
        pct = (cnt / total) * 100
        print(f"  {quality:20} │ {cnt:6,} ({pct:5.1f}%)")
    
    # State/region distribution (by geographic area)
    cur.execute("""
    SELECT 
        CASE 
            WHEN latitude > 30 AND longitude > 75 AND longitude < 95 THEN 'North India'
            WHEN latitude > 28 AND longitude > 76 AND longitude < 92 THEN 'Central India'
            WHEN latitude > 20 AND latitude <= 28 AND longitude > 68 AND longitude < 88 THEN 'West India'
            WHEN latitude >= 8 AND latitude <= 20 THEN 'South India'
            WHEN latitude > 25 AND longitude >= 88 AND longitude <= 97.5 THEN 'East India'
            WHEN latitude > 23 AND longitude > 85 THEN 'Northeast India'
            ELSE 'Other'
        END as region,
        COUNT(*) as count
    FROM cell_tower_calibration
    WHERE mcc IN (404, 405)
    GROUP BY region
    ORDER BY count DESC
    """)
    
    print(f"\n🗺️  REGIONAL DISTRIBUTION:")
    for region, cnt in cur.fetchall():
        pct = (cnt / total) * 100
        print(f"  {region:20} │ {cnt:6,} ({pct:5.1f}%)")
    
    print(f"\n" + "=" * 80)
    print(f"💾 CSV export ready for railway network integration!")
    print(f"   Location: {output_file}")
    print(f"=" * 80 + "\n")
    
    return True

def generate_tower_lookup_index():
    """Generate indexed JSON/CSV for quick tower lookups by region"""
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_file = f"/Users/kie/Documents/RailGram/backend/exports/tower_lookup_index_{timestamp}.txt"
    
    print(f"\n📑 Generating tower lookup index for rapid queries...")
    
    # Create lookup by MNC (operator)
    cur.execute("""
    SELECT DISTINCT mcc, mnc, operator
    FROM cell_tower_calibration
    WHERE mcc IN (404, 405)
    ORDER BY operator, mnc
    """)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("CELL TOWER ID LOOKUP INDEX FOR RAILGRAM\n")
        f.write("=" * 70 + "\n\n")
        
        f.write("OPERATOR → MCC/MNC MAPPING:\n")
        f.write("-" * 70 + "\n")
        
        for mcc, mnc, operator in cur.fetchall():
            tower_count = cur.execute(f"""
            SELECT COUNT(*) FROM cell_tower_calibration
            WHERE mcc = {mcc} AND mnc = {mnc}
            """) or 0
            
            f.write(f"  {operator:12} | MCC={mcc} MNC={mnc}\n")
        
        f.write("\n" + "-" * 70 + "\n")
        f.write("USAGE FOR RAILWAY NETWORK:\n")
        f.write("  1. When train enters area, get current cell tower (MCC/MNC/LAC/CID)\n")
        f.write("  2. Look up tower in exported CSV\n")
        f.write("  3. Get confidence score & accuracy\n")
        f.write("  4. Use for position triangulation & tunnel detection\n")
        f.write("\n")
    
    print(f"✅ Index created: {output_file}\n")

if __name__ == "__main__":
    try:
        export_tower_ids()
        generate_tower_lookup_index()
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        cur.close()
        conn.close()
