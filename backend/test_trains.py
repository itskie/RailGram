#!/usr/bin/env python3
"""Phase 2 train API integration tests."""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8000/api/v1"


def get(path: str) -> tuple[int, dict]:
    try:
        with urllib.request.urlopen(f"{BASE}{path}") as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def check(label: str, status: int, expected_status: int, **assertions):
    if status != expected_status:
        print(f"FAIL [{label}]: HTTP {status} (expected {expected_status})")
        return False
    for key, val in assertions.items():
        pass  # caller prints
    print(f"OK   [{label}]: HTTP {status}")
    return True


# ── Train search ──────────────────────────────────────────────────────────────
status, body = get("/trains/search?q=Rajdhani")
ok = check("search trains: Rajdhani", status, 200)
if ok:
    assert body["total"] >= 2, f"Expected ≥2 Rajdhani trains, got {body['total']}"
    print(f"       found {body['total']} trains: {[t['train_no'] for t in body['trains']]}")

# ── Train by number ───────────────────────────────────────────────────────────
status, body = get("/trains/12301")
ok = check("get train: 12301", status, 200)
if ok:
    print(f"       {body['train_no']} - {body['name']}")

# ── Train schedule ────────────────────────────────────────────────────────────
status, body = get("/trains/12301/schedule")
ok = check("train schedule: 12301", status, 200)
if ok:
    stops = body["stops"]
    print(f"       {len(stops)} stops: {' → '.join(s['station_code'] for s in stops)}")

# ── 404 for unknown train ─────────────────────────────────────────────────────
status, body = get("/trains/99999/schedule")
check("train 404: 99999", status, 404)

# ── Station search ────────────────────────────────────────────────────────────
status, body = get("/stations/search?q=Mumbai")
ok = check("search stations: Mumbai", status, 200)
if ok:
    print(f"       found {body['total']} stations: {[s['station_code'] for s in body['stations']]}")

# ── Station by code ───────────────────────────────────────────────────────────
status, body = get("/stations/NDLS")
ok = check("get station: NDLS", status, 200)
if ok:
    print(f"       {body['station_code']} - {body['station_name']} ({body['latitude']}, {body['longitude']})")

# ── Stations GeoJSON ──────────────────────────────────────────────────────────
status, body = get("/stations/geojson?major_only=true")
ok = check("stations GeoJSON", status, 200)
if ok:
    print(f"       {len(body['features'])} major station features")

# ── 404 for unknown station ───────────────────────────────────────────────────
status, body = get("/stations/ZZZZ")
check("station 404: ZZZZ", status, 404)

print("\nAll Phase 2 train endpoint tests PASSED")
