# NTES Scraper — Technical Documentation

## Overview
Pure `requests`-based scraper for Indian Railways NTES (National Train Enquiry System).
No browser, no Playwright. FastAPI microservice running on port 8001.

- **Response time**: ~300ms
- **RAM usage**: ~5MB
- **Cache TTL**: 90 seconds (NTES updates every 30-40s via ISRO satellite)

---

## How NTES Works (Important)

NTES data comes from **ISRO satellite** — NOT station-based manual reporting.

```
Locomotive → ISRO NavIC/GAGAN satellite → CRIS Data Center → NTES server
```

- Each locomotive has RTIS/REMMLOT GPS device
- Updates every **30-40 seconds** automatically
- Data = last station, departure time, delay, journey %
- Between stations: NTES shows last known station — we interpolate position using schedule DB

---

## CSRF Token Flow (Critical)

NTES uses CSRF protection. Flow must be followed exactly:

```
Step 1: GET https://enquiry.indianrail.gov.in/mntes/
        → Establishes session + cookies

Step 2: GET https://enquiry.indianrail.gov.in/mntes/GetCSRFToken?t={timestamp}
        → Returns HTML with: name='<token_name>' value='<token_value>'
        → Parse with regex: r"name='([^']+)'.*?value='([^']+)'"

Step 3: POST https://enquiry.indianrail.gov.in/mntes/tr
        Body: opt=TrainRunning&subOpt=FindRunningInstance&trainNo=12301&lan=en&<token_name>=<token_value>
        → Returns HTML with train status
```

**If CSRF breaks**: Step 2 response won't contain `name='...' value='...'` pattern → raises `Exception("CSRF token not found")`

---

## HTML Parsing

Response is HTML — we parse with regex (no BeautifulSoup).

### Date Section Detection
NTES may return multiple date instances (e.g. yesterday's + today's train).
We try last 3 days and prefer the section containing:
- `"Departed from"` — train is currently running
- `"Current Position"` — train is mid-journey

```python
dates_to_try = [(now - timedelta(days=i)).strftime('%d-%b-%Y') for i in range(3)]
# e.g. ['09-Apr-2026', '08-Apr-2026', '07-Apr-2026']

# Find section: html.find(f'Start Date : {d}')
# Take next 25000 chars, strip HTML tags
```

### Key Regex Patterns

| Field | Regex | Example match |
|---|---|---|
| Last station | `r"Departed from ([^(]+)\(([A-Z]+)\)[^\d]*(\d{2}:\d{2} \d{2}-\w+)"` | `Departed from MIRZAPUR(MZP) 02:14 09-Apr` |
| Next station | `r'Upcoming Station ([^\(]+)\(([A-Z]+)\)'` | `Upcoming Station ALLAHABAD(ALD)` |
| Journey % | `r'(\d+)%'` | `50%` |
| Delay | `r'(\d+) Min'` | `11 Min` (takes last match) |
| Last updated | `r'Last Updates? On ([\d\-A-Za-z]+ [\d:]+)'` | `Last Updates On 09-Apr-2026 02:15` |

### Status Detection
```
"Yet to start"         → status: not_started
"Arrived at Destination" → status: completed
"Departed from" found  → status: running
Neither                → status: unknown
```

---

## Redis Cache

- **DB**: 2 (separate from main app which uses DB 0)
- **TTL**: 90 seconds
- **Key format**: `ntes:{train_no}:{date|'auto'}`
- **Primary host**: `172.18.0.2` (Docker container IP)
- **Fallback**: `localhost:6379`
- **If Redis unavailable**: scraper still works, just no caching

---

## Alert System

Sends email to `itskie7910@gmail.com` via Resend if scraper fails 3 consecutive times.

- **Counter key**: `ntes:alert:failures` (Redis, expires 1 hour)
- **Alert throttle**: `ntes:alert:sent` (Redis, expires 1 hour) — only 1 email per hour
- **Counter resets** on any successful scrape
- **RESEND_API_KEY** injected via systemd Environment variable

---

## EC2 Deployment

### Systemd Service
```
/etc/systemd/system/ntes-scraper.service
```
- Runs as `ubuntu` user
- Auto-restarts on crash (`Restart=always`, `RestartSec=10`)
- Starts on reboot (`WantedBy=multi-user.target`)

### Commands
```bash
sudo systemctl status ntes-scraper     # check status
sudo systemctl restart ntes-scraper    # restart
sudo journalctl -u ntes-scraper -f     # live logs
```

### Update/Deploy
```bash
# From local machine:
scp -i ~/Downloads/railgram-key.pem backend/ntes_scraper.py ubuntu@13.127.69.178:/home/ubuntu/RailGram/backend/ntes_scraper.py
ssh -i ~/Downloads/railgram-key.pem ubuntu@13.127.69.178 "sudo systemctl restart ntes-scraper"
```

---

## Integration with Truth Engine

File: `backend/app/services/truth_engine.py`

NTES is **Step 3** in the priority ladder:

```
1. GPS fresh       (confidence 0.95)
2. GPS stale       (confidence 0.70)
3. Cell tower      (confidence 0.75)
4. Cell stale      (confidence 0.55)
5. NTES ← HERE    (confidence 0.60)
6. Spotter fresh   (confidence 0.65)
7. Spotter stale   (confidence 0.35)
8. Schedule only   (confidence 0.30)
```

Truth engine calls: `GET http://172.18.0.1:8001/train/{train_no}/status`
(172.18.0.1 = Docker gateway → host machine → NTES scraper on port 8001)

NTES gives: `last_station_code` + `delay_minutes`
Truth engine does: `interpolate_train_position(schedule, now, delay, origin_date)` → lat/lng

---

## Known Risks

| Risk | Probability | Fix |
|---|---|---|
| NTES HTML structure changes | Low (govt site, rarely changes) | Update regex patterns in `fetch_and_parse()` |
| CSRF token flow changes | Low | Update Step 2/3 in `fetch_and_parse()` |
| IP block by Railways | Very Low (90s cache = ~40 req/hour) | Add delay or rotate User-Agent |
| NTES login wall added | Very Low (public service) | Would need new approach |

**When alert email arrives** → check `fetch_and_parse()` function → compare regex against current NTES HTML → fix and redeploy.

---

## API Endpoints

### GET /health
```json
{"status": "ok", "version": "3.0"}
```

### GET /train/{train_no}/status
```json
{
  "train_no": "12301",
  "scraped_at": "2026-04-09T02:15:00",
  "source": "NTES",
  "cached": false,
  "last_station_name": "MIRZAPUR",
  "last_station_code": "MZP",
  "last_event_time": "02:14 09-Apr",
  "last_event": "departed",
  "next_station_name": "ALLAHABAD",
  "next_station_code": "ALD",
  "status": "running",
  "journey_pct": 50,
  "delay_minutes": 11,
  "last_updated": "09-Apr-2026 02:15"
}
```
