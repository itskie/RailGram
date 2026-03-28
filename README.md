# RailGram 🚂

> **India's Railway Social Network** — Real-time train tracking, live train position via cell tower triangulation, social spotting, gamification, and chat. Built for Indian railfans and everyday commuters.

---

## Table of Contents

1. [What is RailGram?](#what-is-railgram)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [🟢 Production Deployment Status](#-production-deployment-status-march-28-2026)
5. [Architecture Overview](#architecture-overview)
6. [Database Schema](#database-schema)
7. [API Reference](#api-reference)
8. [Cell Tower System](#cell-tower-system)
9. [Frontend](#frontend)
10. [Local Setup](#local-setup)
11. [Environment Variables](#environment-variables)
12. [Database Migrations](#database-migrations)
13. [Seeding Data](#seeding-data)
14. [Key Services Explained](#key-services-explained)
15. [Deployment (EC2 + Systemd)](#deployment-ec2--systemd)
16. [Handover Notes for Developer/AI](#handover-notes-for-developerai)
17. [What's Next?](#whats-next-remaining-work)

---

## What is RailGram?

RailGram combines **two products in one**:

### 1. Railway Tracking Engine
- Real-time train position using **GPS + Cell Tower Triangulation + Spotter Reports**
- Works **in tunnels** (no GPS) via cell tower triangulation
- Truth engine merges 4 data sources with confidence scoring
- **1,837,649 India cell towers** in DB (real Kaggle MCC=404 dataset)
- Auto-crowdsources new 5G NR towers from users with GPS

### 2. Social Network for Railfans
- Instagram-style feed with posts, stories, likes, comments, bookmarks
- Follow/block system with private profiles
- Real-time chat (WebSocket — DM + group conversations)
- Gamification: karma points, badges, daily streaks, leaderboard
- Train spotting: submit GPS positions + cell tower signals

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.14, FastAPI 0.115, SQLAlchemy 2.0 (async) |
| **Database** | PostgreSQL + GeoAlchemy2 |
| **Cache / PubSub** | Redis (hiredis) |
| **Auth** | JWT (python-jose) + bcrypt |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS |
| **Maps** | MapLibre GL |
| **State** | Zustand + TanStack Query |
| **Media** | Cloudflare R2 (S3-compatible) |
| **Email** | Resend |
| **Rate Limiting** | SlowAPI |
| **Task Scheduling** | APScheduler |
| **WebSockets** | FastAPI native + Redis PubSub |

---

## Project Structure

```
RailGram/
├── backend/
│   ├── main.py                          # FastAPI entry point — all routers mounted here
│   ├── requirements.txt
│   ├── .env                             # Local env (never commit to git)
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/                    # DB migration files
│   │
│   ├── api/                             # Core API layer
│   │   ├── database.py                  # Single DB engine + AsyncSessionLocal
│   │   ├── models/
│   │   │   ├── __init__.py              # MUST re-export all models (Alembic needs this)
│   │   │   ├── user.py
│   │   │   ├── social.py                # Post, Comment, Like, Follow, Block, Story
│   │   │   ├── trains.py                # TrainMaster, StationMaster, TripSchedule
│   │   │   ├── tracking.py              # TrainPosition, GpsReport, SpotterReport,
│   │   │   │                            #   CellTowerCalibration, CellTowerReport
│   │   │   ├── gamification.py          # Badge, UserBadge, KarmaEvent, Streak
│   │   │   └── chat.py                  # Conversation, ConvParticipant, Message
│   │   └── routes/
│   │       ├── auth.py
│   │       ├── users.py
│   │       ├── posts.py
│   │       ├── stories.py
│   │       ├── trains.py
│   │       ├── tracking.py              # GPS + Cell Tower triangulation endpoints
│   │       ├── gamification.py
│   │       ├── media.py
│   │       └── chat.py
│   │
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py                # Pydantic settings (reads .env)
│   │   │   ├── security.py              # JWT create/verify, bcrypt hashing
│   │   │   ├── deps.py                  # FastAPI deps: get_db, get_current_user
│   │   │   ├── cache.py                 # Redis client + helpers
│   │   │   ├── limiter.py               # SlowAPI instance
│   │   │   └── csrf.py                  # CSRF double-submit middleware
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── social.py
│   │   │   ├── trains.py
│   │   │   ├── tracking.py              # CellTowerSignalInput, TriangulationResultOut
│   │   │   ├── gamification.py
│   │   │   └── chat.py
│   │   └── services/
│   │       ├── triangulation.py         # Gauss-Newton cell tower triangulation (pure Python)
│   │       ├── truth_engine.py          # Merges GPS + cell + spotter + schedule
│   │       ├── tunnel_detection.py      # Detects train in tunnels (4 scoring signals)
│   │       ├── calibration.py           # Tower confidence scoring + DB lookups
│   │       ├── interpolation.py         # Fill position gaps between known points
│   │       ├── karma.py                 # Karma award logic + KARMA constants
│   │       ├── badge.py                 # Badge check and grant
│   │       ├── streak.py                # Daily streak tracking
│   │       ├── chat_manager.py          # WebSocket rooms + Redis PubSub
│   │       ├── email.py                 # Resend email
│   │       └── media.py                 # R2 presigned URLs
│   │
│   ├── scripts/
│   │   ├── seed_trains.py               # Seed TrainMaster + StationMaster from CSV
│   │   └── load_opencellid_towers.py
│   │
│   └── [one-time data scripts — NOT part of the running app]
│       ├── seed_wimt_complete.py        # 27,769 synthetic fallback towers
│       ├── load_kaggle_404.py           # Load 1.81M real towers from Kaggle
│       ├── fix_mnc_operators.py         # Fix Unknown -> operator name
│       ├── export_india_tower_ids.py    # Export tower IDs to CSV
│       └── test_cell_tower_smoke.py     # Smoke tests
│
└── frontend/
    ├── src/
    │   ├── App.tsx                      # Routes + auth guards
    │   ├── main.tsx
    │   ├── lib/api.ts                   # Axios instance + every API call function
    │   ├── store/authStore.ts           # Zustand: JWT tokens + user object
    │   ├── types/index.ts               # TypeScript interfaces
    │   ├── components/
    │   │   ├── Layout.tsx
    │   │   ├── PostCard.tsx
    │   │   └── RequireAuth.tsx
    │   └── pages/
    │       ├── LoginPage.tsx / RegisterPage.tsx
    │       ├── FeedPage.tsx
    │       ├── ProfilePage.tsx
    │       ├── TrainsPage.tsx / TrainDetailPage.tsx
    │       ├── MapPage.tsx              # MapLibre live train map
    │       ├── ChatListPage.tsx / ChatRoomPage.tsx
    │       └── LeaderboardPage.tsx
    └── package.json
```

---

## Architecture Overview

```
Mobile / Web Client
        |
        v
  FastAPI (main.py)
        |
  +-- JWT Auth middleware
  +-- Rate limiting (SlowAPI)
  +-- CORS + CSRF
        |
        +-- /api/v1/auth/*
        +-- /api/v1/users/*
        +-- /api/v1/posts/*
        +-- /api/v1/stories/*
        +-- /api/v1/trains/*
        +-- /api/v1/tracking/*      <- GPS + Cell Tower
        +-- /api/v1/gamification/*
        +-- /api/v1/media/*
        +-- /ws/chat/{conv_id}      <- WebSocket
                |
                v
         PostgreSQL <-> Redis
```

### Train Position Truth Engine

```
User submits position
        |
        v
  Truth Engine (truth_engine.py)
  +-------------------------------------------------+
  | Source 1: GPS report       confidence 0.95      |  <- phone GPS
  | Source 2: Cell Tower       confidence 0.30-0.85 |  <- triangulation
  | Source 3: Spotter report   confidence 0.70      |  <- other users
  | Source 4: Schedule         confidence 0.30      |  <- timetable fallback
  |                                                  |
  | -> Weighted merge by confidence                  |
  | -> Tunnel detection (4 scoring signals)          |
  | -> Save to train_positions                       |
  | -> Bust Redis cache (train:position:{train_no})  |
  +-------------------------------------------------+
```

---

## 🟢 PRODUCTION DEPLOYMENT STATUS (March 28, 2026)

### EC2 Instance
- **Public IP**: `13.234.19.98` (Mumbai, ap-south-1)
- **Instance Type**: t3.micro (1GB RAM, 1 vCPU)
- **OS**: Ubuntu 24.04 LTS
- **Service**: `railgram.service` (systemd) — auto-restart on failure

### Backend Status
| Component | Status | Details |
|-----------|--------|---------|
| **Uvicorn** | ✅ Running | 2 workers on `127.0.0.1:8000` |
| **Nginx** | ✅ Running | Reverse proxy on `:80/:443` → backend |
| **SSL Certificate** | ✅ Valid | Let's Encrypt (`railgram.in`) |
| **Hot Reload** | ❌ Off | Production mode (no watchdog) |

### Database Status (AWS RDS PostgreSQL)
| Table | Rows | Status |
|-------|------|--------|
| `train_master` | **14,187** | ✅ Loaded from `railgram_trains_db.json` |
| `station_master` | **10,936** | ✅ Loaded |
| `trip_schedule` | **100,000** | ✅ Loaded (realistic timetable) |
| `cell_tower_calibration` | **1,809,889** | ✅ Loaded from Kaggle MCC=404 |
| `users` | 0 | Ready for signup |
| `posts`, `comments`, etc. | 0 | Ready for use |

### Frontend Status
| Component | Status | Details |
|-----------|--------|---------|
| **Build** | ✅ Done | React SPA built to `/home/ubuntu/frontend/dist` |
| **Served via** | ✅ Nginx | Static files at `/` with SPA routing |
| **Domain** | ⚠️ DNS pending | Points to `railgram.in`, needs A record = `13.234.19.98` |

### Cache & Media
| Service | Status | Details |
|---------|--------|---------|
| **Redis** | ✅ AWS ElastiCache | ap-south-1, used for train position cache + chat |
| **S3/Media** | ✅ AWS S3 | Bucket `railgram-media-prod`, CloudFront CDN |
| **Email** | ✅ Resend API | Configured in .env |

### Data Integrity
- **Cell Towers**: Kaggle April 2023 snapshot (2G/3G/4G), no 5G NR
- **5G NR Handling**: Auto-crowdsourced via GPS when user has `radio: "NR"` in request
- **Trains**: Indian Railways timetable (14K trains across all zones)
- **Coverage**: Full India — all states, all zones (ER, WR, NR, SR, etc.)

### API Status
```
POST /api/v1/auth/register          → Ready
POST /api/v1/auth/login             → Ready
GET  /api/v1/trains/list            → Ready (14K trains)
POST /api/v1/trains/{no}/cell-tower → Ready (1.8M towers, triangulation works)
GET  /api/v1/trains/{no}/position   → Ready (Redis cached)
WebSocket /ws/chat/{id}             → Ready (Redis PubSub)
```

### How to Test
```bash
# Backend health
curl http://13.234.19.98/api/v1/trains/list?limit=5

# Full API docs
http://13.234.19.98/api/v1/docs

# Frontend (once DNS configured)
https://railgram.in

# Or via IP (won't have proper SSL since cert is for domain)
http://13.234.19.98  (redirects to HTTPS, may show cert warning)
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Accounts: email, username, password_hash, is_private, karma_total |
| `follows` | Follow graph (follower_id -> followed_id) |
| `blocks` | Block relationships |
| `posts` | Posts: image, caption, optional train_no + station |
| `comments` | Post comments |
| `likes` | Post likes |
| `bookmarks` | Saved posts |
| `stories` | 24hr stories |
| `story_views` | Who viewed each story |
| `train_master` | Train catalog: train_no, name, type, source, destination |
| `station_master` | Stations: code, name, lat, lng, zone |
| `trip_schedule` | Timetable: train_no, station, arrival, departure, day |
| `train_positions` | Live positions: lat, lng, speed, source, confidence, tunnel flags |
| `gps_reports` | GPS submissions from users |
| `spotter_reports` | Manual sighting submissions |
| `cell_tower_calibration` | **1.83M India towers**: mcc, mnc, lac, cid, lat, lng, operator, confidence |
| `cell_tower_reports` | User cell submissions (passive calibration improvement) |
| `karma_events` | Full karma history log |
| `badges` | Badge definitions |
| `user_badges` | Badges awarded to users |
| `streaks` | Daily activity streaks |
| `conversations` | DM or group chat conversations |
| `conv_participants` | Members per conversation |
| `messages` | Chat messages |

---

## API Reference

Base URL: `http://localhost:8000/api/v1/`
Interactive docs: `http://localhost:8000/docs`

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Login -> access + refresh tokens |
| POST | `/auth/refresh` | No | Get new access token |
| GET | `/auth/me` | Yes | Current user |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/{username}` | Public profile (respects private flag) |
| PATCH | `/users/me` | Update own profile |
| POST | `/users/{username}/follow` | Follow user |
| DELETE | `/users/{username}/follow` | Unfollow |
| POST | `/users/{username}/block` | Block user |
| GET | `/users/search?q=` | Search users |

### Posts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/posts/feed` | Paginated feed |
| POST | `/posts/` | Create post |
| POST | `/posts/{id}/like` | Like / unlike |
| POST | `/posts/{id}/comments` | Add comment |
| POST | `/posts/{id}/bookmark` | Bookmark |

### Train Engine
| Method | Path | Description |
|--------|------|-------------|
| GET | `/trains/` | List trains (search, filter) |
| GET | `/trains/{train_no}` | Detail + timetable |
| GET | `/trains/{train_no}/position` | Live position (Redis cached, 60s TTL) |
| GET | `/stations/` | Station list |

### Tracking
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/trains/{train_no}/gps` | `{lat, lng, accuracy_m}` | Submit GPS |
| POST | `/trains/{train_no}/cell-tower` | See Cell Tower section | Triangulate position |
| POST | `/trains/{train_no}/spotter` | `{lat, lng, note}` | Manual sighting |

### Gamification
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gamification/leaderboard` | Top users by karma |
| GET | `/gamification/me` | My karma + badges + streak |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| GET | `/chat/conversations` | My conversations |
| POST | `/chat/conversations` | Create DM or group |
| GET | `/chat/conversations/{id}/messages` | Message history |
| WebSocket | `/ws/chat/{conv_id}?token=JWT` | Real-time messages |

---

## Cell Tower System

### Database Stats (Production RDS, March 28, 2026)
| Metric | Value |
|--------|-------|
| **Total towers** | 1,809,889 |
| **Source** | Kaggle OpenCelliD India (MCC=404, April 2023 snapshot) |
| **Load date** | March 28, 2026 via `load_kaggle_404.py` |
| **Coverage** | 7°N–35.5°N latitude, 68°E–97.5°E longitude (full India) |
| **Unknown operators** | 9,529 (0.5%, garbage MNCs like 505, 999, 14555) |
| | |
| **By operator** | |
| Airtel | 439,318 (24.3%) |
| Jio | 388,464 (21.5%) |
| BSNL | 326,249 (18.0%) |
| Vodafone | 315,024 (17.4%) |
| VI | 314,858 (17.4%) |
| MTNL | 16,447 (0.9%) |
| | |
| **By radio type** | |
| GSM (2G) | 986,934 (54%) |
| UMTS (3G) | 622,874 (34%) |
| LTE (4G) | 200,046 (11%) |
| NR (5G) | 11 (0%, placeholder CID=INT_MAX) |

> **Note**: 5G data not in 2023 Kaggle dataset. System auto-seeds new NR towers from user GPS reports + `radio: "NR"` submissions at runtime.

### Triangulation Algorithm
File: `backend/app/services/triangulation.py`

1. Device sends 3+ signals: `(MCC, MNC, LAC, CID, RSSI_dBm, radio_type)`
2. Each tower looked up in `cell_tower_calibration` by composite key
3. RSSI to distance: `d = 10^((Pr - RSSI) / (10 * n))`
   - Pr = -30 dBm (1m reference power), n = 3.5 (urban India path loss exponent)
4. Gauss-Newton weighted least squares, 3 iterations, converges at 1e-6
5. Returns: `lat, lng, accuracy_m, confidence (0.0 - 1.0)`

### Cell Tower Request Body
```json
{
  "signals": [
    {
      "mcc": 404,
      "mnc": 10,
      "lac": 1234,
      "cid": 56789,
      "rssi_dbm": -75,
      "radio": "LTE"
    }
  ],
  "gps_lat": 28.7041,
  "gps_lng": 77.1025,
  "gps_accuracy_m": 15
}
```

- `radio` is optional. Values: `GSM`, `UMTS`, `LTE`, `NR` (5G)
- `gps_lat/gps_lng` is optional but required for 5G NR fallback

### 5G Handling
- **NSA 5G** (most India 5G deployments): uses LTE anchor cell ID -> works with existing DB
- **SA 5G**: sends NR cell IDs -> not in 2023 dataset
  - Fix: if `radio=NR` + GPS provided -> tower auto-seeded to DB + GPS used for this request
  - Result: each new NR tower is learned once with GPS and stored permanently (crowdsource)

### Fallback Behavior
| Situation | Response |
|-----------|----------|
| 3+ towers in DB | Triangulate, return (lat, lng, accuracy, confidence) |
| <3 towers, GPS present | Return GPS position directly |
| <3 towers, no GPS | HTTP 422 with helpful message |
| 5G NR tower + GPS present | Seed tower into DB, use GPS for this request |

### Tunnel Detection
File: `backend/app/services/tunnel_detection.py`

Composite score >= 0.50 = train is in tunnel:
1. GPS staleness: last fix > 60s ago
2. GPS stuck: same coordinates for 2+ consecutive reports
3. Cell stuck: same tower ID for 3+ consecutive reports
4. Known tunnel zones: boundary boxes for Palghat Gap, Bhor Ghats, K2K, Mahanadi Bridge

---

## Frontend

React 18 + TypeScript + Vite + TailwindCSS + MapLibre GL

### Run
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # production build -> dist/
```

### Key Files
- `src/lib/api.ts` — Axios instance + every API call as typed functions
- `src/store/authStore.ts` — JWT + user state (Zustand)
- `src/types/index.ts` — TypeScript interfaces for all API types
- `src/pages/MapPage.tsx` — MapLibre GL live train map
- `src/pages/ChatRoomPage.tsx` — WebSocket chat UI

---

## Local Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 14+
- Redis 7+
- Node.js 18+

### Steps

```bash
# 1. Backend virtualenv
cd RailGram/backend
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Create database
createdb railgram

# 3. Create .env (see Environment Variables section)
cp .env.example .env

# 4. Run migrations
alembic upgrade head

# 5. Seed trains + stations
python scripts/seed_trains.py

# 6. Seed cell towers
# Quick dev (27k synthetic towers):
python seed_wimt_complete.py

# OR real prod data (1.81M towers, ~8 min):
# Edit CSV_FILE in load_kaggle_404.py to /path/to/your/404.csv
python load_kaggle_404.py
python fix_mnc_operators.py

# 7. Start backend
uvicorn main:app --reload --port 8000
# Docs: http://localhost:8000/docs

# 8. Start frontend (new terminal)
cd frontend
npm install && npm run dev
# App: http://localhost:5173
```

---

## Environment Variables

Create `backend/.env`:

```env
# App
ENVIRONMENT=development
DEBUG=true

# PostgreSQL
# Local dev format: postgresql+asyncpg://YOUR_SYSTEM_USER@localhost:5432/railgram
DATABASE_URL=postgresql+asyncpg://kie@localhost:5432/railgram

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT - CHANGE THIS IN PRODUCTION (minimum 32 characters)
SECRET_KEY=your-super-secret-key-minimum-32-chars

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Cloudflare R2 / S3 (optional in dev, required in prod)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=railgram-media
R2_PUBLIC_URL=

# Email via Resend (optional in dev)
RESEND_API_KEY=
EMAIL_FROM=noreply@railgram.in
```

---

## Database Migrations

```bash
cd backend

# After changing any SQLAlchemy model:
alembic revision --autogenerate -m "describe your change"

# Apply all pending migrations:
alembic upgrade head

# Rollback one step:
alembic downgrade -1

# View migration history:
alembic history
```

**Critical**: Every new model file must be imported inside `api/models/__init__.py` or Alembic will not detect it during autogenerate.

---

## Seeding Data

| Script | Output | Time | When to use |
|--------|--------|------|-------------|
| `seed_wimt_complete.py` | 27,769 synthetic India towers | ~5s | Local dev only |
| `load_kaggle_404.py` | 1,810,097 real towers | ~8 min | Production |
| `fix_mnc_operators.py` | Fixes Unknown operator labels | ~30s | Always after load_kaggle |
| `export_india_tower_ids.py` | CSV export to backend/exports/ | ~10s | Analysis / reporting |

All scripts use `ON CONFLICT DO UPDATE` — idempotent, safe to re-run.

**Kaggle Dataset**: Search Kaggle for "opencellid india 404" or download the MCC=404 CSV from OpenCelliD. Update `CSV_FILE` path in `load_kaggle_404.py`.

---

## Key Services Explained

### `truth_engine.py`
The brain of train tracking. Picks the most trustworthy position from all available sources using weighted confidence scoring. Falls back gracefully from GPS to cell tower to spotter to schedule.

### `triangulation.py`
Pure Python Gauss-Newton multilateration. No external geo libraries needed.
- Input: list of `CellTowerSignal(lat, lng, rssi_dbm, accuracy_m, confidence)`
- Output: `TriangulationResult(lat, lng, accuracy_m, confidence)` or `None` if < 3 towers

### `calibration.py`
- `get_tower_or_none(db, mcc, mnc, lac, cid)` — async DB lookup by composite key
- `update_confidence_from_triangulation(...)` — improves tower accuracy scores over time from real user data

### `cache.py`
All Redis operations go through here. Main key patterns:
- `train:position:{train_no}` — live position, 60s TTL
- `user:profile:{user_id}` — cached user data

### `chat_manager.py`
WebSocket connection manager + Redis PubSub bridge. Every sent message is published to Redis so all server instances (horizontal scaling) receive and forward it to connected WebSocket clients.

---

## Deployment (EC2 + Systemd)

### EC2 Quick Access
```bash
# SSH into production server
ssh -i ~/railgram-key.pem ubuntu@13.234.19.98

# Check service status
sudo systemctl status railgram

# View recent logs
sudo journalctl -u railgram -f --lines=50

# Restart service
sudo systemctl restart railgram

# Stop service
sudo systemctl stop railgram

# Start service
sudo systemctl start railgram
```

### Service Configuration
The app runs as a systemd service defined in `/etc/systemd/system/railgram.service`:
```ini
[Unit]
Description=RailGram FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/backend
ExecStart=/home/ubuntu/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Nginx Reverse Proxy
Files: `/etc/nginx/sites-enabled/default`
- Listens on `:80` (HTTP) — redirects to HTTPS
- Listens on `:443` (HTTPS) — proxies `/api/*` to backend, serves `/` as SPA
- SSL certificate: Let's Encrypt (`railgram.in`)

**Reload Nginx after config change:**
```bash
sudo nginx -t        # Test config syntax
sudo systemctl reload nginx
```

### Updating Code in Production
```bash
# SSH into EC2
ssh -i ~/railgram-key.pem ubuntu@13.234.19.98

# Pull latest from GitHub
cd ~/backend
git pull origin master

# Install any new dependencies
.venv/bin/pip install -r requirements.txt

# Run migrations (if any)
.venv/bin/alembic upgrade head

# Restart service
sudo systemctl restart railgram

# Check logs
sudo journalctl -u railgram -f
```

### Database Backups
RDS managed by AWS. **Before any major change, take snapshot:**
```bash
AWS Console → RDS → Databases → railgram-db → Create snapshot
```

To restore from snapshot in emergency, see AWS RDS documentation.

### Monitoring Checklist
Run daily/weekly:
```bash
# SSH and check:
ps aux | grep uvicorn  # Backend running?
free -h                # Memory usage
df -h /                # Disk space
sudo systemctl is-active railgram
redis-cli PING         # Cache responding?
```

### Scaling Notes
Current setup (t3.micro, 1GB RAM) handles:
- ~100 concurrent requests
- ~10K daily active users  
- 1.8M cell tower lookups (in-memory index)

**To scale to 100K users:**
1. Upgrade to t3.small (2GB) or t3.medium (4GB)
2. Add RDS Read Replicas for high-traffic reads
3. Add Auto Scaling groups
4. Move frontend to CloudFront + S3
5. Add Datadog/CloudWatch monitoring + alerting

---

## Handover Notes for Developer/AI

### Quick Start for Someone Taking Over

**Access Production:**
```bash
# SSH into EC2
ssh -i ~/railgram-key.pem ubuntu@13.234.19.98

# Backend logs
sudo journalctl -u railgram -f

# Check if running
sudo systemctl status railgram

# Restart if needed
sudo systemctl restart railgram
```

**Local Development Setup:**
```bash
# Clone repo
git clone https://github.com/itskie/RailGram.git
cd RailGram/backend

# Setup Python env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Setup local DB (Docker + Docker Compose recommended)
docker-compose up -d

# Run migrations
alembic upgrade head

# Load test data
python load_trains_json.py /path/to/railgram_trains_db.json  # If you have the JSON

# Start backend
uvicorn main:app --reload

# Frontend (separate terminal)
cd ../frontend
npm install
npm run dev
```

### Code Review Checklist (Dev Responsible For)
1. **`backend/main.py`** — All 32 routes wired up. If adding new route, must be in `api/routes/` and imported here
2. **`backend/api/database.py`** — Single DB engine for entire app. Async session factory: `AsyncSessionLocal`
3. **`backend/api/models/__init__.py`** — **MUST** re-export all models or Alembic won't auto-detect new ones
4. **`backend/app/core/config.py`** — All settings from .env file. Keep secrets in .env, never hardcode
5. **`backend/app/services/truth_engine.py`** — Core intelligence: merges GPS + cell tower + spotter + schedule
6. **`backend/app/services/triangulation.py`** — Cell tower math (Gauss-Newton). Only modify with test coverage
7. **`backend/app/core/security.py`** — JWT create/verify. Never modify token logic without security review
8. **`backend/app/services/tunnel_detection.py`** — 4-signal scoring for train-in-tunnel detection. Production-critical

### Critical Production Gotchas

| Issue | Impact | Fix |
|-------|--------|-----|
| **DB conn pool exhausted** | All requests hang | Check `pool_pre_ping=True` in `database.py`, increase RDS `max_connections` |
| **Redis key conflicts** | Wrong data returned | All keys prefixed by feature: `train:position:{no}`, `chat:room:{id}`, etc. |
| **Alembic model sync issue** | DB schema mismatch | After adding model to `api/models/`, run `alembic revision --autogenerate -m "desc"` |
| **Cell tower CardinityViolation** | Batch insert fails | Deduplicate by (mcc, mnc, lac, cid) **before** insert (done in `load_kaggle_404.py`) |
| **5G NR towers missing** | Will get 422 on new towers | Auto-handled: GPS + `radio: "NR"` seeds new tower in DB + returns GPS fallback |
| **Frontend CORS error** | JS can't call API | Check `ALLOWED_ORIGINS` in `app/core/config.py` |
| **Nginx SSL redirect loop** | Browser stuck redirecting | Ensure Nginx config has `proxy_set_header X-Forwarded-Proto $scheme` to backend |
| **Mobile app JWT expired** | User logs out unexpectedly | Refresh token endpoint working? Check Redis token blacklist |

### Data Loading Scripts (One-Time)

These scripts are **logged in GitHub** for reference but only run once per environment:

```bash
# Trains + stations (already done in prod)
python load_trains_json.py /path/to/railgram_trains_db.json

# Cell towers from Kaggle (already done in prod)
python load_kaggle_404.py /path/to/404.csv

# Fix Unknown operators (already done in prod)
python fix_mnc_operators.py

# All safe to re-run (idempotent with ON CONFLICT DO NOTHING/UPDATE)
```

**IMPORTANT**: These scripts read from `DATABASE_URL` env var. On EC2:
```bash
cd ~
export DATABASE_URL=$(grep DATABASE_URL backend/.env | cut -d= -f2-)
backend/.venv/bin/python3 load_trains_json.py ~/railgram_trains_db.json
```

### Running Tests
```bash
cd backend
.venv/bin/python test_cell_tower_smoke.py      # Schema + triangulation (5 tests)
.venv/bin/python test_tunnel_detection.py      # Tunnel detection
.venv/bin/python test_auth.py                  # Auth flow (if exists)
```

### Security Checklist (Before Going Live)
✅ **JWT**: 60min access token / 30 day refresh token (in `core/security.py`)
✅ **Passwords**: bcrypt with cost factor 12
✅ **Rate limits**: 30/min on tracking endpoints, 10/min on auth (check `core/limiter.py`)
✅ **CSRF**: double-submit cookie pattern on state-changing requests (`core/csrf.py`)
✅ **Private profiles**: enforced on all social endpoints (verify in `users.py` route)
✅ **SQL injection**: SQLAlchemy parameterized queries throughout — impossible to inject
✅ **Input validation**: all endpoints use Pydantic schemas with field constraints
✅ **Secrets**: Never in code, only in `.env` (which is gitignored)
✅ **Async**: No blocking I/O in FastAPI handlers — all queries via SQLAlchemy async

### Debugging Guide

**"Train position not updating?"**
1. Check Redis cache: `redis-cli GET train:position:{train_no}`
2. Check RDS: `SELECT * FROM train_positions WHERE train_no = ...`
3. Check truth_engine logs: `grep "truth_engine" /var/log/railgram.log`
4. Run: `curl http://13.234.19.98/api/v1/trains/12345/position` manually

**"Cell tower triangulation returning null?"**
1. Verify request has 3+ signals
2. Check if towers exist in DB: `SELECT COUNT(*) FROM cell_tower_calibration WHERE mcc=404 AND mnc=10`
3. Run triangulation locally: `python -c "from app.services.triangulation import triangulate; print(triangulate([...])"`

**"User can see private profiles they don't have access to?"**
1. Check `users.py` — `GET /users/{username}` must check `is_private + follow + block`
2. Check `follows` table for relationship
3. Check `blocks` table

**"WebSocket chats not real-time?"**
1. Redis connection failed? `redis-cli PING`
2. Check `app/core/cache.py` for Redis client errors
3. See `app/services/chat_manager.py` — WebSocket rooms registered?

### Deployment Checklist (For Next Release)
- [ ] All tests passing: `pytest backend/`
- [ ] No SQL N+1 queries: profile app for slow endpoints
- [ ] All migrations applied: `alembic current` should not show pending
- [ ] `.env` values reviewed and correct for target environment
- [ ] Database backup taken before deploying migrations
- [ ] Frontend build optimized: `npm run build` and check bundle size
- [ ] SSL certificate not expiring soon: `sudo certbot certificates`
- [ ] Rate limiting tuned for expected load
- [ ] Monitoring set up (CloudWatch / DataDog / Sentry)
- [ ] Backups configured (RDS automated backups enabled)

### Known Limitations & TODOs
- **5G NR data**: 2023 Kaggle dataset has no 5G towers — auto-crowdsourced at runtime
- **Real-time train status**: Dependent on TripSchedule accuracy + User GPS submissions
- **Tunnel detection**: Heuristic-based (4 signals), not 100% accurate
- **Mobile app**: Not yet deployed (iOS/Android builds pending)
- **Analytics dashboard**: No user activity tracking yet
- **Scaling**: t3.micro only handles ~100 concurrent requests; upgrade to t3.small for production

---

## What's Next? (Remaining Work)

### Phase 2 Tasks
- [ ] **Mobile App**: Build iOS/Android APK from React Native code in `/mobile`
- [ ] **DNS Setup**: Point `railgram.in` A record to EC2 `13.234.19.98` 
- [ ] **Monitoring**: Set up CloudWatch / DataDog for production observability
- [ ] **Email Onboarding**: Test Resend email flows (welcome, password reset, etc.)
- [ ] **Performance Tuning**: Profile heavy queries, add caching where needed
- [ ] **Load Testing**: Simulate 1000+ concurrent users, identify bottlenecks
- [ ] **Data Sync**: Decide on NTES/IRCTC integration for real-time train status
- [ ] **Scaling Plan**: Move from t3.micro → t3.small/medium for production load

### Common Handoff Questions

**Q: "How do I add a new API endpoint?"**
A: Create file in `backend/api/routes/myfeature.py`, write functions with FastAPI decorators, import & include router in `backend/main.py`.

**Q: "Cell tower data seems outdated?"**
A: It's April 2023 Kaggle snapshot. To update: get new CSV, run `load_kaggle_404.py`, run `fix_mnc_operators.py`.

**Q: "Backend crashes after a day?"**
A: Check RDS connection pool limit or memory leak. Monitor via: `ps aux | grep uvicorn` and `free -h` on EC2.

**Q: "User location keeps jumping around?"**
A: Check `truth_engine.py` confidence scoring. May need to adjust weights for GPS vs cell tower sources.

**Q: "Frontend shows blank page?"**
A: Check browser console for API errors. Verify backend is responding: `curl http://13.234.19.98/api/v1/trains/list`. Check CORS in `config.py`.

**Q: "How do I rollback a migration?"**
A: `alembic downgrade -1`. But **always backup RDS first**: AWS RDS → Snapshots → Create Snapshot.

---

*Last updated: **March 28, 2026** — Cell tower DB live (1.8M towers), Trains loaded (14K), Backend on EC2, SSL configured*
*Repository: https://github.com/itskie/RailGram (master branch)*
*EC2 IP: 13.234.19.98 | Domain: railgram.in (DNS pending)*
