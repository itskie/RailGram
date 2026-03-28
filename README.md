# RailGram 🚂

> **India's Railway Social Network** — Real-time train tracking, live train position via cell tower triangulation, social spotting, gamification, and chat. Built for Indian railfans and everyday commuters.

---

## Table of Contents

1. [What is RailGram?](#what-is-railgram)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Architecture Overview](#architecture-overview)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Cell Tower System](#cell-tower-system)
8. [Frontend](#frontend)
9. [Local Setup](#local-setup)
10. [Environment Variables](#environment-variables)
11. [Database Migrations](#database-migrations)
12. [Seeding Data](#seeding-data)
13. [Key Services Explained](#key-services-explained)
14. [Deployment (EC2 + Docker)](#deployment-ec2--docker)
15. [Handover Notes](#handover-notes-for-developerai)

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

### Database Stats
| Metric | Value |
|--------|-------|
| Total towers | 1,837,649 |
| Source | Kaggle — OpenCelliD India (MCC=404, April 2023) |
| Coverage | 7N-35.5N latitude, 68E-97.5E longitude (full India) |
| Airtel | 446,506 (24.3%) |
| Jio | 395,560 (21.5%) |
| BSNL | 329,495 (17.9%) |
| Vodafone | 322,017 (17.5%) |
| VI | 318,095 (17.3%) |
| MTNL | 16,447 (0.9%) |
| GSM (2G) | 986,934 (54%) |
| UMTS (3G) | 622,874 (34%) |
| LTE (4G) | 200,046 (11%) |

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

## Deployment (EC2 + Docker)

```bash
# On your EC2 instance, inside the backend/ folder:
DOCKER_BUILDKIT=0 docker build -t railgram-backend-local .

docker stop railgram-backend && docker rm railgram-backend

docker run -d \
  --name railgram-backend \
  -p 8000:8000 \
  --env-file .env \
  railgram-backend-local
```

> Use `DOCKER_BUILDKIT=0` flag — avoids BuildKit issues on some EC2 AMIs.

---

## Handover Notes for Developer/AI

### Read These Files First (in order)
1. `backend/main.py` — see all routers and app wiring
2. `backend/api/database.py` — understand DB connection
3. `backend/api/models/__init__.py` — all models imported here
4. `backend/app/core/config.py` — every configurable setting
5. `backend/app/services/truth_engine.py` — core train tracking logic
6. `backend/app/services/triangulation.py` — cell tower math

### Critical Gotchas

| Issue | Detail |
|-------|--------|
| **DB username** | Local dev uses system user (`kie`), not `railgram`. Always set DATABASE_URL correctly |
| **Async vs sync** | App uses asyncpg (async SQLAlchemy). One-time scripts use psycopg2 (sync). Never mix them in the same file |
| **Alembic model detection** | New model -> must add import to `api/models/__init__.py` or autogenerate will miss it |
| **Cell tower deduplication** | Kaggle CSV has duplicate (mcc, mnc, lac, cid) combos across rows. Always deduplicate within a batch before `execute_values` insert or you get `CardinalityViolation` |
| **India MCC codes** | India has TWO MCC codes: 404 (primary) and 405 (alternate). Always filter `WHERE mcc IN (404, 405)` |
| **5G NR towers** | Not in 2023 Kaggle dataset. Runtime GPS crowdsourcing handles new 5G towers automatically |
| **Seeding scripts** | All use `ON CONFLICT DO UPDATE` — idempotent, safe to re-run anytime |

### Running Tests
```bash
cd backend
.venv/bin/python test_cell_tower_smoke.py    # Schema + triangulation
.venv/bin/python test_trains.py              # Train API
.venv/bin/python test_auth.py               # Auth flow
.venv/bin/python test_tunnel_detection.py    # Tunnel detection
```

### Security Checklist
- JWT: 60min access token / 30 day refresh token
- Passwords: bcrypt with cost factor 12
- Rate limits: 30/min on tracking endpoints, 10/min on auth
- CSRF: double-submit cookie pattern on state-changing requests
- Private profiles: enforced on all social endpoints (follow check + block check)
- SQL injection: impossible — SQLAlchemy parameterized queries throughout
- Input validation: all endpoints use Pydantic schemas with field constraints

---

*Last updated: March 28, 2026*
*Cell tower DB: 1,837,649 towers | 5G NR crowdsourcing: active*
