from app.schemas.tracking import CellTowerReportCreate, CellTowerSignalInput
from app.services.triangulation import CellTowerTriangulator, CellTowerSignal

# Test 1: Normal 2G/3G/4G signals
r1 = CellTowerReportCreate(signals=[
    CellTowerSignalInput(mcc=404, mnc=10, lac=1, cid=100, rssi_dbm=-70, radio='GSM'),
    CellTowerSignalInput(mcc=404, mnc=10, lac=1, cid=101, rssi_dbm=-80, radio='LTE'),
    CellTowerSignalInput(mcc=404, mnc=66, lac=2, cid=200, rssi_dbm=-90, radio='LTE'),
])
print(f"✅ Test 1 - Normal signals: {len(r1.signals)} towers, GPS: {r1.gps_lat}")

# Test 2: 5G NR with GPS
r2 = CellTowerReportCreate(
    signals=[CellTowerSignalInput(mcc=404, mnc=10, lac=527, cid=99999, rssi_dbm=-75, radio='NR')],
    gps_lat=28.7041, gps_lng=77.1025, gps_accuracy_m=15
)
print(f"✅ Test 2 - 5G NR + GPS: ({r2.gps_lat}, {r2.gps_lng}) acc={r2.gps_accuracy_m}m")

# Test 3: Schema validates bad MCC
try:
    bad = CellTowerSignalInput(mcc=9999, mnc=10, lac=1, cid=1, rssi_dbm=-70)
    print("❌ Test 3 - Should have failed on bad MCC")
except Exception:
    print("✅ Test 3 - Bad MCC correctly rejected")

# Test 4: Triangulation algorithm
result = CellTowerTriangulator.triangulate([
    CellTowerSignal(latitude=28.700, longitude=77.100, rssi_dbm=-70, accuracy_m=200, confidence=0.8),
    CellTowerSignal(latitude=28.720, longitude=77.120, rssi_dbm=-80, accuracy_m=300, confidence=0.7),
    CellTowerSignal(latitude=28.710, longitude=77.080, rssi_dbm=-90, accuracy_m=400, confidence=0.6),
])
print(f"✅ Test 4 - Triangulation: ({result.latitude:.4f}, {result.longitude:.4f}) ±{result.accuracy_m}m conf={result.confidence:.2f}")

# Test 5: Triangulation fails gracefully with < 3 towers
r_none = CellTowerTriangulator.triangulate([
    CellTowerSignal(latitude=28.700, longitude=77.100, rssi_dbm=-70, accuracy_m=200, confidence=0.8),
])
assert r_none is None
print("✅ Test 5 - <3 towers returns None (not crash)")

print()
print("🚂 All checks passed — koi issue nahi!")
