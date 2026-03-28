# RailGram 🚂

> **India's Railway Social Network** — Real-time train tracking, short video Reels, live train position via cell tower triangulation, social spotting, gamification, and chat. Built for Indian railfans and everyday commuters.

[![Production](https://img.shields.io/badge/Production-Live-brightgreen)](https://railgram.in)
[![Platform](https://img.shields.io/badge/Platform-AWS%20ap--south--1-orange)](https://aws.amazon.com)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python%203.12-blue)](https://fastapi.tiangolo.com)
[![Mobile](https://img.shields.io/badge/Mobile-React%20Native%20%2B%20Expo%2055-blueviolet)](https://expo.dev)

---

## Table of Contents

1. [What is RailGram?](#what-is-railgram)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [🟢 Production Status](#-production-status)
5. [Architecture Overview](#architecture-overview)
6. [Database Schema](#database-schema)
7. [API Reference](#api-reference)
8. [Reels Module](#reels-module)
9. [Cell Tower System](#cell-tower-system)
10. [Local Setup](#local-setup)
11. [Environment Variables](#environment-variables)
12. [Database Migrations](#database-migrations)
13. [Deployment (EC2 + Docker)](#deployment-ec2--docker)
14. [What's Next?](#whats-next)

---

## What is RailGram?

RailGram combines **three products in one**:

### 1. 🗺️ Railway Tracking Engine
- Real-time train position using **GPS + Cell Tower Triangulation + Spotter Reports**
- Works **in tunnels** (no GPS) via cell tower triangulation
- Truth engine merges 4 data sources with confidence scoring
- **1,837,649 India cell towers** in DB (real Kaggle MCC=404 dataset)
- Auto-crowdsources new 5G NR towers from users with GPS

### 2. 📸 Social Network for Railfans
- Instagram-style feed with posts, stories, likes, comments, bookmarks
- **Short video Reels** (TikTok-style) with train/station overlay tags
- Follow/block system with private profiles
- Real-time chat (WebSocket — DM + group conversations)
- Gamification: karma points, badges, daily streaks, leaderboard

### 3. 🎬 Reels (Short Video) Engine
- Direct S3 upload (EC2 never handles video bytes)
- S3 Multipart resumable uploads (tunnel-proof)
- HLS adaptive bitrate streaming via CloudFront CDN
- FFmpeg transcoding pipeline (AWS Lambda)
- Like, comment, save, share with optimistic UI

---

## Tech Stack

### ⚙️ Backend
| Layer | Technology |
|---|---|
| **Framework** | FastAPI + Python 3.12, Uvicorn (2 workers) |
| **Database** | PostgreSQL (AWS RDS ap-south-1) |
| **Cache / PubSub** | Redis (AWS ElastiCache) |
| **Auth** | JWT (python-jose) + bcrypt (12 rounds) |
| **Validation** | Pydantic v2 |
| **ORM** | SQLAlchemy 2.0 (async) |
| **Migrations** | Alembic |
| **Media SDK** | boto3 (AWS S3 + IAM role) |
| **Email** | Resend (`noreply@railgram.in`) |
| **Rate Limiting** | SlowAPI |
| **WebSockets** | FastAPI native + Redis PubSub |
| **Scheduling** | APScheduler |

### 🌐 Web Frontend
| Layer | Technology |
|---|---|
| **Framework** | React 19 + TypeScript |
| **Build** | Vite 8 |
| **Routing** | React Router DOM v7 |
| **State** | Zustand v5 |
| **Server State** | TanStack React Query v5 |
| **Styling** | TailwindCSS v4 |
| **Icons** | Lucide React |
| **Maps** | MapLibre GL |
| **Video (Reels)** | HLS.js |

### 📱 Mobile App
| Layer | Technology |
|---|---|
| **Framework** | React Native 0.83 + TypeScript |
| **Platform** | Expo SDK 55 |
| **Navigation** | React Navigation v7 (Stack + Bottom Tabs) |
| **State** | Zustand v5 |
| **Server State** | TanStack React Query v5 |
| **Maps** | React Native Maps |
| **Video (Reels)** | react-native-video (HLS native) |
| **Media Picker** | expo-image-picker |
| **Secure Storage** | expo-secure-store |
| **Push Notifications** | expo-notifications |

### ☁️ Infrastructure (100% AWS — Mumbai ap-south-1)
| Service | Product | Details |
|---|---|---|
| **Compute** | EC2 t3.micro | Elastic IP: `13.127.69.178` |
| **Database** | RDS PostgreSQL | Auto-backups enabled |
| **Cache** | ElastiCache Redis | Sub-ms latency |
| **Storage** | S3 `railgram-media-prod` | Photos + videos + reels |
| **CDN** | CloudFront | `dzdr0nfpn0f2c.cloudfront.net` |
| **IAM** | EC2 Instance Role | No hardcoded credentials |
| **Proxy** | Nginx | Reverse proxy + SSL |
| **Domain** | `railgram.in` | Route 53 + GoDaddy |
| **Email** | Resend | Transactional (non-AWS) |

---

## Project Structure

```
RailGram/
├── backend/
│   ├── main.py                          # FastAPI entry — all routers mounted here
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .dockerignore                    # Excludes .venv (saves ~1.5GB build context)
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/                   # DB migrations (chronological)
│   │
│   ├── api/                            # Core API layer
│   │   ├── database.py                 # Single async engine + AsyncSessionLocal
│   │   ├── models/
│   │   │   ├── __init__.py             # Re-exports all models (Alembic needs this)
│   │   │   ├── user.py                 # User, Follow, Block, EmailToken
│   │   │   ├── social.py               # Post, Comment, Like, Story, Bookmark
│   │   │   ├── reel.py                 # Reel, ReelLike, ReelComment, ReelSave, ReelView
│   │   │   ├── trains.py               # TrainMaster, StationMaster, TripSchedule
│   │   │   ├── tracking.py             # TrainPosition, GpsReport, SpotterReport
│   │   │   ├── gamification.py         # Badge, UserBadge, KarmaEvent, Streak
│   │   │   └── chat.py                 # Conversation, ConvParticipant, Message
│   │   └── routes/
│   │       ├── auth.py                 # Register, login, verify email, reset password
│   │       ├── users.py
│   │       ├── posts.py
│   │       ├── stories.py
│   │       ├── reels.py                # ← NEW: Full reels CRUD + social + S3 upload URL
│   │       ├── trains.py
│   │       ├── tracking.py             # GPS + cell tower triangulation
│   │       ├── gamification.py
│   │       ├── media.py                # Generic presigned upload URL
│   │       └── chat.py
│   │
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py               # Pydantic Settings (reads .env)
│   │   │   ├── security.py             # JWT create/verify, bcrypt hashing
│   │   │   ├── deps.py                 # FastAPI deps: get_db, get_current_user
│   │   │   ├── cache.py                # Redis client + helpers
│   │   │   └── limiter.py              # SlowAPI instance
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── social.py
│   │   │   ├── reel.py                 # ← NEW: Reel schemas (upload, create, feed, comments)
│   │   │   ├── trains.py
│   │   │   ├── tracking.py
│   │   │   ├── gamification.py
│   │   │   └── chat.py
│   │   └── services/
│   │       ├── email.py                # Resend — dark premium HTML templates
│   │       ├── media.py                # AWS S3 presigned URLs via IAM role
│   │       ├── triangulation.py        # Gauss-Newton cell tower triangulation
│   │       ├── truth_engine.py         # Merges GPS + cell + spotter + schedule
│   │       ├── tunnel_detection.py
│   │       ├── karma.py
│   │       ├── badge.py
│   │       ├── streak.py
│   │       └── chat_manager.py         # WebSocket rooms + Redis PubSub
│   │
│   └── scripts/
│       ├── seed_trains.py
│       └── load_opencellid_towers.py
│
├── frontend/                           # React 19 + Vite web app
│   └── src/
│       ├── App.tsx                     # Routes + auth guards
│       ├── lib/api.ts                  # Axios + all API calls
│       ├── store/authStore.ts
│       ├── features/
│       │   └── reels/                  # ← Phase 2 (in progress)
│       ├── pages/
│       │   ├── LoginPage.tsx / RegisterPage.tsx
│       │   ├── FeedPage.tsx
│       │   ├── ProfilePage.tsx
│       │   ├── TrainsPage.tsx
│       │   ├── MapPage.tsx
│       │   ├── ChatListPage.tsx / ChatRoomPage.tsx
│       │   ├── VerifyEmailPage.tsx     # ← Email verification flow
│       │   ├── ForgotPasswordPage.tsx  # ← Password reset request
│       │   └── ResetPasswordPage.tsx  # ← Set new password
│       └── package.json
│
├── mobile/                             # React Native + Expo SDK 55
│   └── src/
│       └── features/
│           └── reels/                  # ← Phase 3 (in progress)
│
├── docker-compose.yml                  # Local dev
├── docker-compose.prod.yml             # Production
└── README.md
```

---

## 🟢 Production Status

**Live at: [https://railgram.in](https://railgram.in)**

| Feature | Status |
|---|---|
| User registration + JWT auth | ✅ Live |
| Email verification (Resend) | ✅ Live |
| Forgot / Reset password | ✅ Live |
| Posts feed (photos) | ✅ Live |
| Stories | ✅ Live |
| Live train map (MapLibre) | ✅ Live |
| Real-time chat (WebSocket) | ✅ Live |
| Cell tower triangulation | ✅ Live |
| Gamification (karma, badges) | ✅ Live |
| AWS S3 media upload | ✅ Live (IAM role) |
| CloudFront CDN | ✅ Live |
| **Reels API (backend)** | ✅ Live (Phase 1) |
| Reels Web UI | ✅ Live (Phase 2) |
| Reels Mobile UI | ✅ Live (Phase 3) |
| FFmpeg HLS transcoding | ✅ Live (Phase 4) |

---

## Architecture Overview

### System Architecture
```mermaid
graph TD
    Client[Mobile/Web Client] -->|HTTPS| Nginx[Nginx SSL Termination]
    Nginx -->|Proxy| FastAPI[FastAPI Docker on EC2]
    FastAPI -->|JWT/Auth| DB[(Postgres RDS)]
    FastAPI <-->|State/PubSub| Redis[(ElastiCache)]
    FastAPI -->|Presigned URL| S3[S3 railgram-media-prod]
    S3 -->|CloudFront| Client
```

---

### Reels Video Lifecycle (Serverless Pipeline)
This module uses an asynchronous, event-driven architecture to handle heavy video processing without slowing down the main API.

```mermaid
sequenceDiagram
    participant C as Mobile/Web Client
    participant A as FastAPI Backend
    participant S as S3 (raw/)
    participant L as AWS Lambda (FFmpeg)
    participant W as S3 (processed/)
    participant H as Webhook Handler

    C->>A: 1. Request Upload URL
    A-->>C: 2. Presigned PUT URL
    C->>S: 3. Direct Binary Upload (1GB max)
    S->>L: 4. ObjectCreated Event Trigger
    Note over L: 5. FFmpeg Transcoding (720p HLS)
    L->>W: 6. Save .m3u8 + .ts segments
    L->>H: 7. POST Status: READY (Webkey Sec)
    H->>A: 8. Update DB Status & CDM URLs
    A-->>C: 9. Feed Refresh (CloudFront)
```

**Key Optimization:** The EC2 instance **never** touches the video bytes. Browsers/App stream directly to S3, and Lambda handles the heavy lifting. This keeps the $5 t3.micro server fast even with 1000s of uploads.

### Train Position Truth Engine

```
User submits position
        |
        v
  Truth Engine (truth_engine.py)
  +-------------------------------------------------+
  | Source 1: GPS report       confidence 0.95      |  <- phone GPS
  | Source 2: Cell Tower       confidence 0.30-0.85 |  <- triangulation
  | Source 3: Spotter report   confidence 0.70      |  <- community spot
  | Source 4: Schedule         confidence 0.20      |  <- NTES fallback
  +-------------------------------------------------+
        |
        v
   Weighted merge -> best lat/lng -> Redis cache (30s TTL)
```

---

## Database Schema

### Users
```
users: id(uuid), username, email, hashed_password, display_name, bio,
       avatar_url, is_private, is_active, is_verified,
       karma, trains_spotted, km_traveled, created_at, updated_at
```

### Social
```
posts: id, user_id, type(photo/reel), caption, media_url, train_number, station_tag, ...
stories: id, user_id, media_url, expires_at, view_count
comments: id, post_id, user_id, parent_id(threaded), body
likes: post_id, user_id  [UNIQUE]
bookmarks: post_id, user_id  [UNIQUE]
follows: follower_id, followed_id  [UNIQUE]
```

### Reels (NEW)
```
reels: id, user_id, title, description, train_number, train_name, station_tag,
       raw_s3_key, hls_key, thumbnail_key, duration_secs, width, height,
       status(PENDING/PROCESSING/READY/FAILED), views, likes_count,
       comments_count, saves_count, is_public, created_at

reel_likes:    reel_id, user_id  [UNIQUE]
reel_comments: id, reel_id, user_id, parent_id(threaded), body
reel_saves:    reel_id, user_id  [UNIQUE]
reel_views:    reel_id, user_id, watched_secs
```

### Tracking
```
train_positions: train_number, lat, lng, speed, confidence, source, timestamp
gps_reports: user_id, train_number, lat, lng, accuracy, timestamp
spotter_reports: user_id, train_number, station_code, timestamp
cell_tower_reports: user_id, mcc, mnc, lac, cell_id, signal_strength, lat, lng
```

### Auth
```
email_tokens: user_id, token(urlsafe_32), type(verification/password_reset),
              expires_at, used_at
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register + send verification email |
| POST | `/api/v1/auth/login` | Login → JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/verify-email` | Verify email with token |
| POST | `/api/v1/auth/resend-verification` | Resend verification email |
| POST | `/api/v1/auth/forgot-password` | Send password reset email |
| POST | `/api/v1/auth/reset-password` | Set new password with token |

### Reels (NEW)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/reels/upload-url` | ✅ | Get S3 presigned PUT URL (1GB max) |
| POST | `/api/v1/reels` | ✅ | Save reel metadata after upload |
| GET | `/api/v1/reels/feed` | Optional | Paginated feed (cursor-based) |
| GET | `/api/v1/reels/trending` | Optional | Top reels last 7 days |
| GET | `/api/v1/reels/{id}` | Optional | Single reel detail |
| POST | `/api/v1/reels/{id}/like` | ✅ | Like reel |
| DELETE | `/api/v1/reels/{id}/like` | ✅ | Unlike reel |
| POST | `/api/v1/reels/{id}/save` | ✅ | Save reel to collection |
| DELETE | `/api/v1/reels/{id}/save` | ✅ | Unsave reel |
| GET | `/api/v1/reels/{id}/comments` | — | Get threaded comments |
| POST | `/api/v1/reels/{id}/comments` | ✅ | Add comment / reply |
| POST | `/api/v1/reels/{id}/view` | Optional | Record view + watch time |
| GET | `/api/v1/reels/user/{user_id}` | Optional | User profile reels grid |

### Posts, Stories, Users, Chat
> See existing API reference sections (unchanged).

---

## Reels Module

### How Upload Works (Server-Safe)
```
1. Client  →  POST /api/v1/reels/upload-url
             { filename, content_type, file_size_bytes }
             ↓
2. Backend  →  boto3.generate_presigned_url("put_object")
               Returns: { upload_url, s3_key }
             ↓
3. Client uploads VIDEO directly to S3 PUT URL
   EC2 never receives video bytes ← key for t3.micro safety

4. Client  →  POST /api/v1/reels
             { s3_key, title, train_number, ... }
             ↓
5. Backend saves metadata, status = PENDING

7. S3 ObjectCreated event → Lambda (reels-transcoder) → FFmpeg
   - **Source Code**: [transcoder_lambda.py](file:///Users/kie/Documents/RailGram/backend/scripts/transcoder_lambda.py)
   - **Deployment Guide**: [deploy_lambda.md](file:///Users/kie/Documents/RailGram/backend/scripts/deploy_lambda.md)
   - Transcodes to 720p 9:16 HLS segments (.m3u8 + .ts)
   - Extracts 540x960 thumbnail @ 1s
   - Calls POST /api/v1/reels/webhook/status with `X-Webhook-Secret`

8. Backend updates DB status = READY + S3 keys.
9. Reel appears in feed via CloudFront CDN (dzdr...cloudfront.net).
```

### FFmpeg HLS Command
```bash
ffmpeg -i input.mp4 \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:-1:-1" \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k \
  -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename "segments/seg_%03d.ts" \
  -master_pl_name "master.m3u8" \
  output/playlist.m3u8

# Thumbnail at 1 second
ffmpeg -i input.mp4 -ss 00:00:01 -vframes 1 \
  -vf "scale=540:960" thumbnail.jpg
```

### DB Indexes (Performance)
```sql
-- Feed: latest reels per user
CREATE INDEX idx_reels_user_created ON reels(user_id, created_at DESC);

-- Only show READY reels
CREATE INDEX idx_reels_status_created ON reels(status, created_at DESC);

-- Like/save lookups
CREATE INDEX idx_reel_likes_reel ON reel_likes(reel_id);
CREATE INDEX idx_reel_saves_user ON reel_saves(user_id);

-- Threaded comments
CREATE INDEX idx_reel_comments_reel_parent ON reel_comments(reel_id, parent_id);
```

---

## Cell Tower System

```
User in tunnel (no GPS)
        |
        v
  Phone scans nearby cell towers
  Sends: [ { mcc, mnc, lac, cell_id, signal_strength } ]
        |
        v
  /api/v1/tracking/cell-report
        |
        v
  triangulation.py (Gauss-Newton algorithm)
  Looks up towers in cell_tower_master (1.83M towers)
  Returns weighted lat/lng + confidence 0.30-0.85
        |
        v
  truth_engine.py merges with other sources
        |
        v
  Redis cache (30s TTL) → broadcast to train map
```

**Dataset:** [Kaggle OpenCellID India (MCC=404)](https://www.kaggle.com) — 1,837,649 real towers.

---

## Local Setup

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Python 3.12+ (optional — only for local scripts)

### Quick Start
```bash
git clone https://github.com/itskie/RailGram.git
cd RailGram

# Copy env templates
cp backend/.env.example backend/.env
# Fill in .env with your values

# Start backend + database
docker compose up --build

# Frontend dev server
cd frontend && npm install && npm run dev

# Mobile app
cd mobile && npm install && npx expo start
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/railgram

# Cache
REDIS_URL=redis://host:6379

# Auth
SECRET_KEY=your-256-bit-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# AWS (auto-detected via IAM Instance Role on EC2 — no keys needed)
AWS_S3_BUCKET=railgram-media-prod
AWS_REGION=ap-south-1
CLOUDFRONT_URL=https://your-distribution.cloudfront.net
# Only needed for local development (not on EC2 with IAM role):
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...

# Email
RESEND_API_KEY=re_your_key
EMAIL_FROM=noreply@railgram.in

# Webhook Security
WEBHOOK_SECRET=super-secret-lambda-webhook-key-change-in-prod

# Environment
ENVIRONMENT=production
```

---

## Database Migrations

```bash
# Inside the Docker container
docker exec railgram_backend alembic upgrade head

# Generate a new migration (after model changes)
docker exec railgram_backend alembic revision --autogenerate -m "description"

# Check current migration version
docker exec railgram_backend alembic current
```

### Migration History
| Revision | Description |
|---|---|
| `a1b2c3d4e5f6` | Add email_tokens table |
| `b1c2d3e4f5a6` | Add reels tables (5 tables + 7 indexes) |

---

## Deployment (EC2 + Docker)

### Architecture
```
EC2 t3.micro (ap-south-1, Elastic IP: 13.127.69.178)
  └── systemd service: railgram
       └── docker compose -f docker-compose.prod.yml up --build
            └── railgram_backend container
                 └── uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

### Deploy New Changes
```bash
# On your local machine — push to GitHub
git add -A && git commit -m "your message" && git push origin master

# SSH to EC2 and pull + restart
ssh -i ~/Downloads/railgram-key.pem ubuntu@13.127.69.178
cd ~/RailGram && git pull origin master && sudo systemctl restart railgram

# Monitor
sudo docker logs railgram_backend -f
sudo docker ps
```

### S3 Access (No Keys Required)
EC2 has `railgram-ec2-role` IAM Instance Role attached with `AmazonS3FullAccess`.  
`boto3` auto-discovers credentials via instance metadata — **no `AWS_ACCESS_KEY_ID` in `.env` needed on production**.

---

## What's Next?

## 📅 Reels Development Roadmap & Technical Decisions

This module was built in 4 disciplined phases to ensure the **EC2 t3.micro** remains stable and the user experience feels "Premium".

### 🏗️ Technical Decisions
- **FFmpeg Strategy**: Chosen **Option A (AWS Lambda + Custom Static Layer)**. This keeps costs at $0.00 (within free tier) and moves 100% of CPU-intensive transcoding away from the main server.
- **Upload Protocol**: Used **S3 Multipart Upload**. This provides tunnel-proof, resumable uploads without the overhead of a dedicated Tus server.
- **Transcoding Quality**: Standardized to **720p 9:16 HLS**. Balances visual quality with high-speed delivery on 4G/5G Indian networks.

### 📋 Phase-wise Execution
- **Phase 1 (Backend Core)**: Implemented SQL schemas (Reels, Likes, Comments, Saves) and Presigned URL logic.
- **Phase 2 (Web Integration)**: Built the `hls.js` vertical feed and direct S3 upload handlers.
- **Phase 3 (Mobile Integration)**: Implemented `@shopify/flash-list` for smooth 60FPS scrolling and `expo-file-system` for memory-safe background uploads.
- **Phase 4 (Serverless Engine)**: Deployed the Lambda transcoder, FFmpeg layer, S3 triggers, and secure status webhooks.

### 🛡️ Security & Verification
- **Webhook Protection**: Every status update from Lambda requires a `WEBHOOK_SECRET` validation.
- **Verification**: Manually verified via CloudFront HLS endpoints and mobile app testing.

---

### What's Next?
- [ ] **Search:** Find reels by train number or station tag
- [ ] **Analytics:** Watch-time heatmaps for creators
- [ ] **Collaborations:** Tag other railfans in reels

### Future Features
- [ ] Unverified user banner on dashboard
- [ ] Train zone filtering for reels feed
- [ ] "Live Location" label overlay on reels using tracking data
- [ ] Push notifications (expo-notifications) for new followers, comments
- [ ] Explore / Discover page
- [ ] iOS + Android builds via EAS Build

---

*Last updated: March 2026 — RailGram v1.0.0 (Reels Milestone)*  
*Maintained by [itskie](https://github.com/itskie)*
