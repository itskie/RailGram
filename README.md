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

RailGram combines **four major products in one**:

### 1. 🗺️ Railway Tracking Engine
- Real-time train position using **GPS + Cell Tower Triangulation + Spotter Reports**
- Works **in tunnels** via cell tower triangulation (Gauss-Newton optimization)
- Truth engine merges 4 data sources with confidence scoring
- Crowdsources 5G NR/LTE towers from users with GPS

### 2. 📸 Pro Social Network for Railfans
- **Rich Media Carousels**: Multi-photo posts (up to 10 photos) with Framer Motion sliders.
- **Verified Railfans**: Tiered verification (Blue/Orange) for official and top-tier contributors. ☑️
- **Technical Spotting Reports**: Specialized metadata for locomotives (Class, Road No, Shed, Zone). 🚂
- **Real-time Notifications**: Instant alerts for follows, follow requests, likes, and comments with unread badges. 🔔
- **Public Access**: Browse feed, reels, and profiles without login. Like/Comment/Follow require auth. 🔓
- **Private Accounts**: Toggle private profile, posts/reels hidden from non-followers. 🔒
- **Follow Requests**: When following private accounts, request is sent for approval. Accept/Decline from notifications. ✅
- **Block System**: Block/unblock users with complete invisibility (Instagram-style strict block). 🚫
  - Blocked users **CANNOT** find you in search
  - Blocked users **CANNOT** visit your profile (404)
  - Blocked users **CANNOT** see your posts/reels in feeds
  - Blocked users **CANNOT** follow you or send requests
- **Blocked Users List**: Manage all blocked users from dedicated page with one-click unblock. 📋
- **Delete Account**: Permanently delete account and all data from Edit Profile. ⚠️
- Instagram-style feed with threaded comments and bookmarks.

### 3. 🎬 Reels (Short Video) Engine
- **Multipart S3 Uploads**: Tunnel-proof resumable uploads direct to S3.
- **Serverless Transcoding**: 100% offloaded to AWS Lambda + FFmpeg (HLS 720p).
- HLS adaptive bitrate streaming via CloudFront CDN.

### 4. 🏆 Gamification & Leaderboard
- **Karma System**: Points awarded for spotting, travels, and quality content.
- **Pro Leaderboard**: Global rankings of rail enthusiasts with verified status.
- **Custom Badges**: Unlockable rail-themed badges (Loco Master, High-Speed, etc.).

---

## 📅 Development Roadmap (Milestones)

The project followed a disciplined **14-Phase** execution to build a scalable and premium social ecosystem.

- [x] **Phase 1-2**: Backend Foundation, JWT Auth, and JWT Reset flows.
- [x] **Phase 3**: User Profiles, Avatars, and personal Railfan metadata.
- [x] **Phase 4-5**: Social Engine (Likes, Comments) and Cursor-based Real-time Feed.
- [x] **Phase 6**: Reels (Short Video Engine) + AWS Lambda Transcoding.
- [x] **Phase 7**: Gamification (Karma, Badges, Global Leaderboard).
- [x] **Phase 8**: Real-time Notification Center (WebSocket/Polling alerts).
- [x] **Phase 9**: Rich Media Integration (10-photo Carousel slider).
- [x] **Phase 10**: Specialized Railfan Data (Verified Badges & Loco Spotting Specs).
- [x] **Phase 11**: Premium Background Upload System (Instagram-style "Zero-Wait" UX).
- [x] **Phase 12**: Public Access — Browse Feed, Reels, Profiles without login. Interactive features (Like, Comment, Follow) redirect to login.
- [x] **Phase 13**: Privacy & Safety — Private Account with Follow Request System, Block/Unblock Users, Blocked Users List, Delete Account.
- [x] **Phase 14**: Mobile Parity — All web features implemented in React Native mobile app (Block, Follow Requests, Delete Account).
- [x] **Phase 15**: Strict Block System — Instagram-style complete invisibility (blocked users can't search, view profile, or see content).
- [x] **Phase 16**: Unified Feed — Twitter/X style "For You" and "Following" tabs combining posts and reels in single scrollable feed.

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
| **PWA** | vite-plugin-pwa | Installable app + service worker |
| **Image Optimization** | CloudFront Functions | Auto width/quality/format |

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
| **Compute** | EC2 t3.small | Elastic IP: `13.127.69.178` |
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
│       │   └── reels/                  # ✅ Phase 11 Optimized
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
│           └── reels/                  # ✅ Phase 11 Optimized
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
| **Cloud Optimization** | ✅ Live (Phase 11) |
| Follow button on Posts (web + mobile) | ✅ Live |
| Followers / Following list (web + mobile) | ✅ Live |
| Consistent avatars with initials fallback everywhere | ✅ Live |
| Clickable username/avatar → profile everywhere | ✅ Live |
| Comment like (root + reply) — Posts & Reels | ✅ Live (Mobile + Web) |
| **Notifications** (mobile) | ✅ Live |
| **Search / User Discovery** (mobile) | ✅ Live |
| **Edit Profile** (mobile) | ✅ Live |
| **Verify Email flow** (mobile) | ✅ Live |
| **Reset Password flow** (mobile) | ✅ Live |
| **Unified Feed (For You + Following tabs)** | ✅ Live (Phase 16 — Web + Mobile) |

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

### 🚀 Frontend: Premium Background Uploads (Zero-Wait UX)
RailGram uses a decoupled background architecture to match the experience of top-tier social apps like Instagram.

1. **Decoupled Handoff**: When a user clicks "Share", the `CreatePostModal` or `CreateReelModal` immediately hands the payload (Files + Metadata) to the global `uploadStore` and **closes instantly**.
2. **Global Background Manager**: The `UploadBackgroundManager` is a persistent component mounted in the root `Layout`. It monitors the store and executes the upload pipeline even if the user navigates to other pages.
3. **Byte-Level Progress Tracking**: Unlike standard `fetch`, we utilize `XMLHttpRequest` (XHR) for S3 uploads to capture granular `onprogress` events, providing real-time percentage updates to the user.
4. **Cloud-Optimized Data (RDS)**: To ensure 100% stability on AWS RDS with `asyncpg`, all status/type fields are standardized as **validated Strings** (e.g., `"READY"`, `"PENDING"`) instead of rigid native Enums, eliminating driver-level serialization overhead.
5. **Session-Safe Persistence**: Uploads continue as long as the SPA session is active. If a user moves from the Feed to the Live Map, the upload remains uninterrupted.

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
    H->>A: 8. Update DB Status & CDN URLs
    A-->>C: 9. Feed Refresh (CloudFront)
```

**Key Optimization:** The EC2 instance **never** touches the video bytes. Browsers/App stream directly to S3, and Lambda handles the heavy lifting. This keeps the t3.small server fast even with 1000s of uploads.

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
       avatar_url, favourite_train, home_station, is_private, is_active, 
       is_verified(☑️), karma, trains_spotted, km_traveled, created_at, updated_at
```

### Social & Specialized Reports
```
posts: id, user_id, type(photo/reel/loco_spot), caption, media_keys[], 
       train_no, station_code, location_name,
       loco_class, loco_number, loco_shed, loco_zone,
       like_count, comment_count, created_at
stories: id, user_id, media_key, view_count, expires_at
comments: id, post_id, user_id, body, created_at
likes: post_id, user_id  [UNIQUE]
bookmarks: post_id, user_id  [UNIQUE]
follows: follower_id, followed_id  [UNIQUE]
```

### Notifications (🔔 NEW)
```
notifications: id, user_id, sender_id, type(String - follow/like/comment/alert),
               post_id, body, is_read, created_at
```

### Rails / Reels (🎬)
```
reels: id, user_id, title, description, train_number, train_name, station_tag,
       raw_s3_key, hls_key, thumbnail_key, duration_secs, width, height,
       status(String - PENDING/READY/FAILED), views, likes_count,
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

### Unified Feed (NEW — Phase 16)

**Twitter/X-style "For You" and "Following" tabs** — A single scrollable feed that combines **posts + reels** in chronological order, with intelligent tab switching.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/posts/feed/unified?feed_type=for_you` | Optional | Combined posts + reels from all public accounts (algorithmic discovery) |
| GET | `/api/v1/posts/feed/unified?feed_type=following` | ✅ | Combined posts + reels from followed users only |

**Response Format:**
```json
{
  "items": [
    {
      "item_type": "post",
      "id": "uuid",
      "created_at": "2026-03-31T12:00:00Z",
      "author": { "id": "uuid", "username": "railfan123", ... },
      "caption": "Spotting report...",
      "media_keys": ["s3-key-1"],
      "like_count": 42,
      "viewer_liked": false,
      "viewer_followed": true
    },
    {
      "item_type": "reel",
      "id": "uuid",
      "created_at": "2026-03-31T11:00:00Z",
      "author": { "id": "uuid", "username": "trainlover", ... },
      "title": "WAP7 Haul",
      "hls_url": "https://cdn.railgram.in/reel/playlist.m3u8",
      "likes_count": 128,
      "viewer_liked": true,
      "viewer_followed": false
    }
  ],
  "next_cursor": "2026-03-31T10:00:00Z"
}
```

**UI Features:**
- **Tab Switching**: Sticky header with "For You" and "Following" pills (orange underline indicator)
- **Infinite Scroll**: Auto-loads more content via intersection observer sentinel
- **Empty States**: Custom illustrations for each tab when no content available
- **Unified Cards**: `UnifiedFeedCard` component renders both post and reel items with consistent styling
- **Optimistic Loading**: Instant tab switching with cached data while background refresh occurs

**Implementation:**
| Platform | File |
|---|---|
| **Web** | `frontend/src/pages/FeedPage.tsx` |
| **Component** | `frontend/src/components/UnifiedFeedCard.tsx` |

### Posts
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/posts` | ✅ | Create new post (photo/carousel/loco_spot) |
| GET | `/api/v1/posts/{id}` | Optional | Get single post by ID |
| DELETE | `/api/v1/posts/{id}` | ✅ | Delete your own post |
| POST | `/api/v1/posts/{id}/like` | ✅ | Like a post (toggle) |
| POST | `/api/v1/posts/{id}/bookmark` | ✅ | Bookmark/save a post (toggle) |
| GET | `/api/v1/posts/bookmarked` | ✅ | Get your bookmarked posts |
| GET | `/api/v1/posts/{id}/comments` | — | Get post comments (threaded) |
| POST | `/api/v1/posts/{id}/comments` | ✅ | Add comment or reply |
| POST | `/api/v1/posts/comments/{comment_id}/like` | ✅ | Like a comment (toggle) |
| GET | `/api/v1/posts/{id}/comments/{comment_id}/replies` | — | Get replies to a comment |
| DELETE | `/api/v1/posts/comments/{comment_id}` | ✅ | Delete your comment |
| GET | `/api/v1/posts/feed/discover` | Optional | Discover feed (all public posts) |
| GET | `/api/v1/posts/feed/following` | ✅ | Following feed (posts from followed users) |

### Stories
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/stories` | ✅ | Create new story |
| GET | `/api/v1/stories/feed` | ✅ | Get stories from followed users |
| GET | `/api/v1/stories/{story_id}` | ✅ | Get single story |
| DELETE | `/api/v1/stories/{story_id}` | ✅ | Delete your story |

### Users
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/users` | — | Search users (query param: `?q=`) |
| GET | `/api/v1/users/me` | ✅ | Get current user profile |
| PUT | `/api/v1/users/me/profile` | ✅ | Update your profile |
| GET | `/api/v1/users/{username}` | Optional | Get user profile by username |
| GET | `/api/v1/users/{username}/posts` | Optional | Get user's posts grid |
| GET | `/api/v1/users/{username}/followers` | — | Get followers list |
| GET | `/api/v1/users/{username}/following` | — | Get following list |
| POST | `/api/v1/users/{username}/follow` | ✅ | Follow/unfollow or send request (toggle) |
| POST | `/api/v1/users/{username}/block` | ✅ | Block a user |
| POST | `/api/v1/users/{username}/unblock` | ✅ | Unblock a user |
| GET | `/api/v1/users/blocked` | ✅ | Get your blocked users list |
| GET | `/api/v1/users/requests` | ✅ | Get pending follow requests (incoming) |
| GET | `/api/v1/users/requests/sent` | ✅ | Get sent follow requests (outgoing) |
| DELETE | `/api/v1/users/requests/{id}` | ✅ | Cancel a sent follow request |
| POST | `/api/v1/users/requests/{id}/accept` | ✅ | Accept a follow request |
| POST | `/api/v1/users/requests/{id}/decline` | ✅ | Decline a follow request |

---

## Reels Module

### 📽️ High-Definition Video Pipeline (up to 500MB)
RailGram's AWS infrastructure supports massive, long-form train spotting runs (500MB) without compromising visual quality or crushing the server.

### How Upload Works (Server-Safe)
```
1. Client  →  POST /api/v1/reels/upload-url
             { filename, content_type, file_size_bytes }
             ↓
2. Backend  →  boto3.generate_presigned_url("put_object")
               Returns: { upload_url, s3_key }
             ↓
3. Client uploads VIDEO directly to S3 PUT URL
   EC2 never receives video bytes ← key for t3.small safety

4. Client  →  POST /api/v1/reels
             { s3_key, title, train_number, ... }
             ↓
5. Backend saves metadata, status = PENDING

7. S3 ObjectCreated event → Lambda (reels-transcoder) → FFmpeg
   - **Source Code**: [transcoder_lambda.py](file:///Users/kie/Documents/RailGram/backend/scripts/transcoder_lambda.py)
   - **Deployment Guide**: [deploy_lambda.md](file:///Users/kie/Documents/RailGram/backend/scripts/deploy_lambda.md)
   - **Web Uploader UI**: `CreateReelModal.tsx` handles client-side Direct-to-AWS `.mp4` pipe bypassing FastAPI parsing.
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

### Reels viewer UI — Follow / Following (Instagram-style creator row)

While watching a reel, the **bottom-left overlay** shows the uploader: avatar, **username** on the first line (Instagram-style), optional **display name**, and **`@username`**. If the viewer is **logged in** and the reel is **not their own**, a **pill button** appears next to the handle:

| Button | Meaning | API |
|--------|---------|-----|
| **Follow** | You are not following this creator yet | `POST /api/v1/users/{username}/follow` (toggle **on**) |
| **Following** | You already follow them; tap to unfollow | Same **`POST`** URL — the backend **toggles** follow (no separate `DELETE` route) |

Feed and related reel endpoints populate **`viewer_followed`** on each reel’s `user` (`ReelAuthor`) when the request includes a valid **JWT**. The button is **hidden** for your **own** reels (same behaviour people expect from Instagram Reels). The client uses **`useReelActions`** (`toggleFollow`) with optimistic cache updates, then invalidates the reels query so lists stay in sync.

| Platform | Implementation |
|----------|------------------|
| **Web** | `frontend/src/features/reels/components/ReelOverlay.tsx` + `frontend/src/features/reels/hooks/useReelActions.ts` |
| **Mobile** | `mobile/src/features/reels/components/ReelOverlay.tsx` + `mobile/src/features/reels/hooks/useReelActions.ts` |

---

### Posts Feed — Follow / Following (Instagram-style author row)

Every post in the feed now also shows a **Follow / Following** pill next to the author’s name — same UX as Reels, no need to visit a profile page.

| Button | Meaning | API |
|--------|---------|-----|
| **Follow** | Not following this author yet | `POST /api/v1/users/{username}/follow` |
| **Following** | Already following; tap to unfollow | Same `POST` URL (toggle) |

The post feed endpoints (`/posts/feed/discover`, `/posts/feed/following`, `/users/{username}/posts`) now return `viewer_followed: bool` on every `PostOut` object when a valid JWT is present. Uses **optimistic cache updates** — the button flips instantly with no loading lag.

| Platform | Implementation |
|----------|------------------|
| **Web** | `frontend/src/components/PostCard.tsx` |
| **Mobile** | `mobile/src/screens/tabs/FeedScreen.tsx` (PostCard component) |

---

### Followers / Following Lists

Tap the **Followers** or **Following** count on any profile to see the full list. Each entry is tappable and navigates directly to that user’s profile.

| Platform | Implementation |
|----------|------------------|
| **Web** | `frontend/src/pages/ProfilePage.tsx` — inline modal (bottom-sheet style on mobile, centered on desktop) |
| **Mobile** | `mobile/src/screens/stack/UserProfileScreen.tsx` — native `Modal` bottom sheet |

**API Endpoints (already live):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/{username}/followers` | List of users who follow `{username}` |
| GET | `/api/v1/users/{username}/following` | List of users that `{username}` follows |

The mobile `UserProfileScreen` was also fixed to read `is_following` directly from the backend response instead of relying on unreliable local state — so the Follow/Following button is always accurate after a refresh.

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
EC2 t3.small (ap-south-1, Elastic IP: 13.127.69.178)
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

## 📅 Reels Development Roadmap & Technical Decisions

This module was built in 4 disciplined phases to ensure the **EC2 t3.small** remains stable and the user experience feels "Premium".

### 🏗️ Technical Decisions
- **FFmpeg Strategy**: Chosen **Option A (AWS Lambda + Custom Static Layer)**. This keeps costs at $0.00 (within free tier) and moves 100% of CPU-intensive transcoding away from the main server.
- **Upload Protocol**: Used **S3 Multipart Upload**. This handles HD video payloads **up to 500MB**, providing tunnel-proof, fast AWS routing without the overhead of a dedicated Tus server.
- **Transcoding Quality**: Standardized to **720p 9:16 HLS**. The AWS Cloud Lambda compresses the huge 500MB 4K files down into optimized stream chunks, retaining visual fidelity for 4G/5G Indian mobile networks without bottlenecking the main EC2 instance.

### 📋 Phase-wise Execution
- **Phase 1 (Backend Core)**: Implemented SQL schemas (Reels, Likes, Comments, Saves) and Presigned URL logic.
- **Phase 2 (Web Integration)**: Built the `hls.js` vertical feed and direct S3 upload handlers.
- **Phase 3 (Mobile Integration)**: Implemented `@shopify/flash-list` for smooth 60FPS scrolling and `expo-file-system` for memory-safe background uploads.
- **Phase 4 (Serverless Engine)**: Deployed the Lambda transcoder, FFmpeg layer, S3 triggers, and secure status webhooks.
- **Phase 11 (Stability & UX)**: Implemented "Zero-Wait" background uploads on Web/Mobile and standardized RDS schema for high-availability cloud operations.

### 🛡️ Security & Verification
- **Webhook Protection**: Every status update from Lambda requires a `WEBHOOK_SECRET` validation.
- **Verification**: Manually verified via CloudFront HLS endpoints and mobile app testing.

---

### 📱 Mobile App Status (March 30, 2026)

**Verified: FeedScreen.tsx - All Instagram-style Features Complete**

| Feature | Status | Details |
|---|---|---|
| **Like/Comment Counts** | ✅ Complete | Inline display (line 165-173) |
| **Timestamp in Header** | ✅ Complete | Relative time (e.g., "• 2h", "• 3d") next to display name |
| **Image Aspect Ratio** | ✅ Complete | 4:5 portrait (Instagram style) - `aspectRatio: 4 / 5` |
| **Round Corners** | ✅ Complete | 16px border radius on cards |
| **Dark Mode** | ✅ Complete | Default theme (#09090b background, #18181b cards) |

**File:** `mobile/src/screens/tabs/FeedScreen.tsx`

---

### 🌐 Web Frontend Optimizations (March 30, 2026)

**PWA + Performance Optimization Complete**

| Optimization | Status | Impact |
|---|---|---|
| **PWA Support** | ⚠️ Temporarily Disabled | Service worker caching issue (will re-enable) |
| **Service Worker** | ⚠️ Disabled | CloudFront image caching caused 503 errors |
| **Image Optimization** | ❌ Disabled | CloudFront Function removed (direct S3 URLs working) |
| **Code Splitting** | ✅ Complete | Lazy load 15 pages (70% faster initial load) |
| **Offline Detection** | ✅ Complete | Banner shows when network unavailable |

**Current Status (Working):**
- ✅ Images load directly from CloudFront (no optimization)
- ✅ No service worker cache issues
- ✅ Code splitting active
- ⏳ PWA/Image optimization will be re-enabled after fix

**Issue Encountered:**
CloudFront Function (`ImageOptimization`) was adding query params (`?width=800&quality=80`) which caused HTTP 503 errors. Function removed from distribution.

**Solution:**
- Removed image optimization query params from frontend code
- Disabled service worker temporarily
- Images now load directly from CloudFront without transformation

**Files Modified:**
- `frontend/vite.config.ts` - PWA plugin commented out
- `frontend/src/components/MediaCarousel.tsx` - Direct CloudFront URLs
- `frontend/src/components/Avatar.tsx` - Direct avatar URLs

**To Re-enable Optimization (Future):**
1. Fix CloudFront Function code (return `request` not `response`)
2. Re-associate with distribution
3. Re-enable PWA in vite.config.ts

---

### What's Next?
- [ ] **Push Notifications** 📲: Real-time push alerts via Expo Notifications.
- [ ] **Direct Messaging (DM)** 👋: Private encrypted chats between railfans with photo sharing.
- [ ] **Train Chatrooms** 🚉: Real-time discussion rooms for passengers on the same train.
- [ ] **Advanced Explore** 🔍: Trending trains, station reports, and popular spotting locations.

### Future Features
- [ ] **Live Location Overlay**: Real-time GPS/speed data overlay on video Reels.
- [ ] **Train Zone Filtering**: View feed and reels specifically by Zonal Railway (NR, WR, SR, etc.).
- [ ] **EAS Build**: Official standalone iOS + Android application bundles.
- [ ] **Analytics for Creators**: Watch-time and engagement heatmaps for top spotters.

---

### 🖥️ Infrastructure Updates

**March 30, 2026** — EC2 instance upgraded from **t3.micro** to **t3.small** for improved performance and headroom.

| Component | Instance Type | Status |
|---|---|---|
| **EC2 (Compute)** | t3.small (2 vCPU, 2GB RAM) | ✅ Upgraded |
| **RDS (Database)** | db.t3.micro (Free Tier) | ✅ Same |
| **ElastiCache (Redis)** | cache.t3.micro (Free Tier) | ✅ Same |

---

### 🐛 Bug Fixes (March 30, 2026)

**Post Comments (Web)**
- Comment button on feed posts was navigating to `/posts/:id/comments` which had no route — bounced back to `/` silently
- Added `PostCommentsPage` + registered route `/posts/:postId/comments` (protected, requires auth)
- Full comments page: list of comments + add comment input with optimistic updates

**Reels Comments Showing Empty**
- Reels had comments (count showed 2) but drawer always displayed "No comments yet"
- Root cause: backend returns a plain array `[]` but frontend was reading `data.items` (always `undefined`)
- Fixed `ReelComments.tsx` + `api.ts` to handle the array response correctly

**Bookmark Not Working**
- Unbookmark was calling `DELETE /posts/:id/bookmark` — backend has no DELETE route (toggle-only `POST`)
- Fixed `api.ts` `unbookmark` to use `POST` — backend toggles on every call

**Build Errors Fixed**
- Removed dead imports (`getOptimizedImageUrl` in Avatar + MediaCarousel, `VitePWA` in vite.config.ts) left over from PWA disable — were blocking TypeScript build

---

### 📱 Mobile App Status (March 30, 2026)

**Instagram-Style Profile + Comment Features Complete**

| Feature | Status | Details |
|---|---|---|
| **Profile Tabs** | ✅ Complete | Posts | Reels | Saved (Instagram-style tabs) |
| **Posts Grid** | ✅ Complete | 3-column grid with like/comment overlays |
| **Reels Grid** | ✅ Complete | 3-column grid with view count overlays |
| **Saved Tab** | ✅ Complete | Shows both saved posts AND saved reels |
| **Post Comments** | ✅ Complete | Comment likes, replies, threaded comments |
| **Reel Comments** | ✅ Complete | Full-screen modal with likes & replies |
| **Reply Tagging** | ✅ Complete | @username mentions in replies |
| **Collapsible Replies** | ✅ Complete | View/hide reply threads |

**Profile Screen Features:**
- **Posts Tab**: Grid layout with overlay showing ❤️ like count and 💬 comment count
- **Reels Tab**: Grid layout with overlay showing 👁️ view count
- **Saved Tab**: Combined view of saved posts and saved reels
- Click post → Opens PostDetailScreen with full post view
- Click reel → Navigates to Reels tab

**Comment Features (Posts + Reels):**
- ❤️ **Like comments** - Heart icon with optimistic updates
- 💬 **Reply to comments** - Reply button with @mention tagging
- 🔽 **Collapsible replies** - Show/hide reply threads
- 📊 **Reply counts** - See number of replies per comment

**Files:**
- `mobile/src/screens/tabs/ProfileScreen.tsx` - Complete redesign
- `mobile/src/screens/stack/PostDetailScreen.tsx` - Comment likes + replies
- `mobile/src/features/reels/components/ReelCommentsModal.tsx` - New modal
- `mobile/src/features/reels/components/ReelCard.tsx` - Integrated comments modal
- `mobile/src/api/client.ts` - New API functions

---

### ✨ Latest Features (March 30, 2026) — Saved Posts & Notification Fixes

**Instagram-style Saved Posts + Fixed Notification Navigation**

| Feature | Status | Details |
|---|---|---|
| **Saved Posts Tab** | ✅ Complete | New tab on own profile: `Posts | Reels | Saved` |
| **Bookmarked Posts API** | ✅ Complete | `GET /posts/bookmarked` endpoint |
| **Saved Reels** | ✅ Complete | `GET /reels/saved` endpoint + UI |
| **Reels Tab** | ✅ Complete | User's own reels grid on profile |
| **Notification Navigation** | ✅ Fixed | Correct routes for like/comment/follow/reel notifications |

**Backend Changes:**
- New endpoint: `GET /posts/bookmarked` — Returns authenticated user's bookmarked posts
- New endpoint: `GET /reels/saved` — Returns authenticated user's saved reels
- New endpoint: `GET /reels/user/{user_id}` — User's reels grid (already existed, documented now)
- Cursor-based pagination support on all endpoints

**Frontend Changes:**
- `ProfilePage.tsx`:
  - Added tabs: `Posts` | `Reels` | `Saved` on own profile
  - Reels tab shows user's uploaded reels
  - Saved tab shows both bookmarked posts AND saved reels
- `PostCard.tsx`:
  - Fixed bookmark mutation to invalidate `saved-posts` query
  - Bookmark now properly updates profile saved tab
- `useReelActions.ts`:
  - Fixed save mutation to invalidate `saved-reels` query
  - Save now properly updates profile saved tab
- `api.ts`:
  - Added `reels.saved()` function
  - Added `reels.user(userId)` function

**Files Modified:**
- Backend: `backend/api/routes/posts.py`, `backend/api/routes/reels.py`
- Frontend: `frontend/src/lib/api.ts`, `frontend/src/pages/ProfilePage.tsx`, `frontend/src/components/PostCard.tsx`, `frontend/src/features/reels/hooks/useReelActions.ts`

---

### ✨ Latest Features (March 30, 2026) — Comment Likes & Replies

**Full Instagram-style threaded comments for Posts + Reels**

| Feature | Status | Details |
|---|---|---|
| **Comment Likes** | ✅ Complete | `CommentLike` + `ReelCommentLike` models, `like_count` on comments |
| **Reply to Comments** | ✅ Complete | Threaded replies (parent_id), collapsible UI |
| **Reply Notifications** | ✅ Complete | New types: `reply_post`, `reply_reel`, `like_comment` |
| **Heart Button UI** | ✅ Complete | Like heart + reply button in both drawers |
| **Optimistic Updates** | ✅ Complete | Instant UI feedback, background sync |

**Backend Changes:**
- Models: `CommentLike`, `ReelCommentLike` (with `like_count` on `reel_comments`)
- Migration: `add_comment_likes_and_reel_comment_like_count`
- New notification types: `reply_post`, `reply_reel`, `like_comment`
- Endpoints:
  - `POST /posts/{id}/comments/{comment_id}/like` — Toggle like on post comment
  - `GET /posts/{id}/comments/{comment_id}/replies` — Get threaded replies (posts)
  - `POST /reels/{id}/comments/{comment_id}/like` — Toggle like on reel comment
  - `GET /reels/{id}/comments/{comment_id}/replies` — Get threaded replies (reels)
- Self-interaction suppression: No notification if you like/reply to your own comment

**Frontend Changes:**
- `PostComments.tsx` + `ReelComments.tsx`:
  - Heart icon with like count
  - Reply button per comment
  - Collapsible reply threads
  - Optimistic cache updates
- `NotificationsPage.tsx`: Handles new notification types with correct navigation

**Files Modified:**
- Backend: `backend/api/models/social.py`, `backend/api/models/reel.py`, `backend/api/routes/posts.py`, `backend/api/routes/reels.py`
- Frontend: `frontend/src/components/PostComments.tsx`, `frontend/src/features/reels/components/ReelComments.tsx`, `frontend/src/lib/api.ts`, `frontend/src/pages/NotificationsPage.tsx`

---

---

### 📱 Mobile App Status (March 30, 2026) — Full Feature Parity Update

**All major missing mobile features implemented. Mobile now matches web feature set.**

#### New Screens Added

| Screen | Access Point | Features |
|---|---|---|
| **NotificationsScreen** | Feed header 🔔 (with unread badge) | 9 notification types, mark all/single read, tap → navigate to post/profile |
| **SearchScreen** | Feed header 🔍 | Debounced user search, karma chips, tap → UserProfile |
| **EditProfileScreen** | Profile → Edit Profile button | Avatar S3 upload, display name, bio, favourite train, home station |
| **VerifyEmailScreen** | Auth flow | Token verification + resend email flow |
| **ResetPasswordScreen** | Auth flow | Token + new password with confirmation |

#### New API Endpoints (mobile)

| API | Endpoint |
|---|---|
| `notificationsApi.list/unreadCount/readAll/readOne` | `/notifications` |
| `usersApi.updateProfile` | `PUT /users/me/profile` |
| `authApi.verifyEmail / resendVerification / resetPassword` | `/auth/verify-email` etc. |
| `trainsApi.trackHistory` | `/tracking/trains/{no}/history` |
| `mediaApi.presign` | `/media/presign` |

#### Comment Delete (Posts + Reels)
- ~~Removed~~ — Comment delete feature removed globally (web + mobile)

#### Types Updated
- `User`: added `favourite_train`, `home_station`
- `Comment`: added `parent_id`, `reply_count`, `like_count`
- `ReelComment`: added `parent_id`
- New: `Notification`, `NotifActor`

---

## 🔒 Privacy & Safety Features (Latest)

### **Private Account System**

Toggle your account to private in **Edit Profile** → **Private Account**.

| Feature | Behavior |
|---|---|
| **Follow Button** | Shows "Request to Follow" instead of "Follow" |
| **Pending Requests** | Stored in database until accepted/declined |
| **Accept Request** | User becomes your follower, can see all posts/reels |
| **Decline Request** | Request rejected, user remains non-follower |
| **Cancel Request** | Sender can cancel pending request anytime |

**Endpoints:**
- `POST /api/v1/users/{username}/follow` — Send follow request (private) or follow (public)
- `GET /api/v1/users/requests` — Get pending follow requests for current user
- `GET /api/v1/users/requests/sent` — Get sent follow requests by current user
- `DELETE /api/v1/users/requests/{id}` — Cancel a pending follow request
- `POST /api/v1/users/requests/{id}/accept` — Accept a follow request
- `POST /api/v1/users/requests/{id}/decline` — Decline a follow request

**Notifications:**
- 🟠 *"X requested to follow you"* — When someone sends follow request
- 🔵 *"X started following you"* — When request is accepted

---

### **Block System (Instagram-Style Strict Block)**

Block users to make yourself completely invisible to them.

| Action | Blocked User Experience |
|---|---|
| **Search** | ❌ Cannot find you in search results |
| **Profile Visit** | ❌ Gets 404 "User not found" |
| **Feed Posts** | ❌ Your posts don't appear in their feed |
| **Reels** | ❌ Your reels don't appear in their feed |
| **Follow** | ❌ Cannot follow you or send requests |
| **Direct URL** | ❌ `/profile/yourusername` shows 404 |

**To Block:**
1. Go to user's profile
2. Click **3-dots menu** (⋮) in top-right
3. Click **Block**
4. Confirm

**To Unblock:**
1. Go to **Settings** → **Blocked Users** (`/blocked-users`)
2. Find user in list
3. Click **Unblock** button
4. User can now find and interact with you again

**Endpoints:**
- `POST /api/v1/users/{username}/block` — Block a user
- `POST /api/v1/users/{username}/unblock` — Unblock a user (same endpoint toggles)
- `GET /api/v1/users/blocked` — Get list of users you've blocked

---

### **Delete Account**

Permanently delete your account and all associated data.

**Location:** Edit Profile → **Delete Account** button (bottom)

**Warning:** This action is **permanent** and cannot be undone!
- All posts deleted
- All reels deleted
- All comments deleted
- All likes/bookmarks removed
- Profile permanently removed

**Endpoint:** `DELETE /api/v1/auth/delete-account`

---

### **Pages & Routes**

| Page | Route | Access |
|---|---|---|
| **Follow Requests** | `/follow-requests` | Authenticated users with pending requests |
| **Blocked Users** | `/blocked-users` | All authenticated users |
| **Edit Profile** | `/profile/edit` | Account owner only |
| **Notifications** | `/notifications` | All authenticated users |

---

## 📱 Mobile App Update (March 30, 2026) — Reel Comments Collapsible Replies

**Reel Comments modal now has full feature parity with Post Comments.**

| Feature | Status | Details |
|---|---|---|
| **Collapsible Replies** | ✅ Complete | "View N replies" / "Hide replies" toggle on each root comment |
| **Reply Fetch** | ✅ Complete | `GET /reels/{id}/comments/{comment_id}/replies` on demand |
| **Reply Like** | ✅ Complete | Heart icon with like count on each reply |
| **Reply Delete** | ~~Removed~~ | Feature removed globally |
| **Avatar Fallback** | ✅ Fixed | Initials shown when `avatar_url` is null (no broken image) |
| **Reply Threading** | ✅ Fixed | `addComment` now sends `parent_id` correctly to backend |

**Files Modified:**
- `mobile/src/features/reels/components/ReelCommentsModal.tsx` — Full rewrite with `ReelReplyItem` component
- `mobile/src/api/client.ts` — Added `reelsApi.getReplies(reelId, commentId)`, `addComment` now accepts `parent_id`

---

## 📱 Mobile App Update (March 31, 2026) — Unified Feed (For You + Following)

**Twitter/X-style unified feed now live on mobile with full feature parity with web.**

| Feature | Status | Details |
|---|---|---|
| **For You Tab** | ✅ Complete | Discover feed showing posts + reels from all public accounts |
| **Following Tab** | ✅ Complete | Feed showing posts + reels from followed users only |
| **Tab Switching** | ✅ Complete | Sticky header with orange underline indicator |
| **Infinite Scroll** | ✅ Complete | Auto-load more content via FlatList pagination |
| **Unified Cards** | ✅ Complete | `UnifiedFeedCard` component renders both posts and reels |
| **Empty States** | ✅ Complete | Custom messages for each tab when no content |
| **Pull to Refresh** | ✅ Complete | Refresh control on both tabs |
| **Follow Button** | ✅ Complete | Inline follow/unfollow on both post and reel cards |
| **Like/Bookmark** | ✅ Complete | Quick actions on post cards |
| **Like/Save** | ✅ Complete | Quick actions on reel cards |

**API Endpoints Used:**
- `GET /api/v1/posts/feed/unified?feed_type=for_you` — Discover feed
- `GET /api/v1/posts/feed/unified?feed_type=following` — Following feed

**Files Modified:**
- `mobile/src/screens/tabs/FeedScreen.tsx` — Complete rewrite with unified feed logic, tab switching, `UnifiedFeedCard` component
- `mobile/src/types/index.ts` — Added `UnifiedFeedItem` type definition
- `mobile/src/api/client.ts` — Added `postsApi.unifiedFeed(feedType, cursor)` function

**Implementation Details:**
- Uses `@tanstack/react-query` `useInfiniteQuery` for pagination
- FlatList with `onEndReached` for infinite scroll
- Optimistic cache updates for follow/like/save actions
- Tab state persisted across navigation

---

*Last updated: March 31, 2026 — RailGram v1.2.0*
*Maintained by [itskie](https://github.com/itskie)*
