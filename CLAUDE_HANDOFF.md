# RailGram — Complete Project Handoff (Phase 8A DONE, Phase 8B Next)

## What Is RailGram?
Instagram-style social app for Indian Railways fans (railfans).
- Post train photos/videos with station/train tags
- Live train position tracking (GPS reports + crowd-sourced spotter reports)
- Truth Engine — merges GPS + spotter data to compute authoritative position
- Instagram-style 24hr Stories
- Real-time WebSocket chat (1:1 + group conversations)
- Gamification: Karma points, Badges, Daily streaks, Leaderboard
- Follow/unfollow users, private profiles, block system

**Owner:** Shobhit Singh | **Domain:** railgram.in | **AWS Region:** ap-south-1 (Mumbai)

---

## Complete Phase History — What Was Built When

### Phase 1 — Core Backend Foundation ✅
- FastAPI app skeleton, project structure set up
- PostgreSQL database with SQLAlchemy async (asyncpg driver)
- Alembic migrations setup
- `api/database.py` — single DB engine + Base
- `app/core/config.py` — pydantic-settings (env-based config)
- `app/core/security.py` — JWT auth (Bearer tokens, 30min expiry), bcrypt password hashing

### Phase 2 — User Auth & Social Graph ✅
- `api/models/user.py` — User, Follow, Block models
- `api/routes/auth.py` — Register, login, logout, JWT refresh, email verify, password reset
- `api/routes/users.py` — Profile, follow/unfollow, block, search users, private profile flag
- Email verification flow (token-based)
- Password reset flow (token-based)
- Security: rate limiting on auth endpoints (slowapi), security headers middleware

### Phase 3 — Posts, Stories, Feed ✅
- `api/models/social.py` — Post, Story, StoryView, Comment, Like, Bookmark
- `api/routes/posts.py` — Create post, feed (paginated), like, comment, bookmark, delete
- `api/routes/stories.py` — Create 24hr story, view story, story viewers list
- Posts tagged with train_no and station_code
- Privacy enforcement: private profile posts only visible to followers
- Feed algorithm: follows + public posts, sorted by time

### Phase 4 — Train Engine (Core Indian Railways Data) ✅
- `api/models/trains.py` — TrainMaster, StationMaster, TripSchedule
- `api/routes/trains.py` — CRUD for trains, stations, schedules
- Train number + name + type (express, superfast, etc.)
- Station code + name + lat/lng (GeoAlchemy2 for spatial queries)
- Trip schedule: train → station sequence with arrival/departure times

### Phase 5 — Live Train Tracking ✅
- `api/models/tracking.py` — GpsReport, SpotterReport, TrainPosition
- `api/routes/tracking.py` — Submit GPS, submit spotter report, get live position
- `app/services/truth_engine.py` — Weighted merge of GPS + spotter reports to compute position
- `app/services/interpolation.py` — Interpolate train position between schedule points (IST timezone)
- Background worker in `main.py` — refreshes active train positions every 60s
- MissingTrainLog — logs trains not reporting for >30min

### Phase 6 — Real-time Chat ✅
- `api/models/chat.py` — Conversation, ConvParticipant, Message
- `api/routes/chat.py` — WebSocket endpoint, create conversation, list messages
- `app/services/chat_manager.py` — In-memory WebSocket connection manager
- Redis pub/sub for multi-worker message fan-out
- 1:1 and group conversations
- **Bug fixed:** Subscribe to Redis channel BEFORE creating asyncio listener Task (else exits immediately)
- **Bug fixed:** SQLAlchemy relationships in WS handlers use `lazy="selectin"` (async-safe)

### Phase 7 — Gamification & Security Hardening ✅
- `api/models/gamification.py` — Badge, UserBadge, KarmaEvent, Streak
- `api/routes/gamification.py` — Leaderboard, karma history, badges, streaks
- `app/services/karma.py` — Award/deduct karma (post, like, spotter report, etc.)
- `app/services/badge.py` — Badge catalogue seeded on startup, auto-award on triggers
- `app/services/streak.py` — Track daily login streaks
- Security audit done:
  - Race conditions fixed (atomic SQL UPDATE instead of read-modify-write)
  - N+1 queries fixed (batch fetch with `in_()`)
  - Missing privacy checks added (is_private + follow check + block check)
  - Hardcoded secrets removed from test files
  - CSRF protection added (`app/core/csrf.py`)
- `app/core/cache.py` — Redis caching layer
- `app/core/limiter.py` — Rate limiting config
- `app/core/audit.py` — Audit log for admin actions

### Phase 7B — Frontend (React Web App) ✅
- React 18 + TypeScript + Vite + TailwindCSS v4
- `store/authStore.ts` — Zustand store for JWT + user state
- 10 pages built (Login, Register, Feed, Map, Trains, TrainDetail, Profile, ChatList, ChatRoom, Leaderboard)
- MapLibre GL for train map
- TanStack Query for all API calls
- Components: Layout, PostCard, RequireAuth
- Build fixed: removed unused `Search` import from Layout.tsx (TS6133 error)

### Phase 8A — AWS Production Deployment ✅
Step-by-step what was set up:
1. **VPC** — railgram-vpc
2. **Security Groups** — railgram-ec2-sg (ports 22, 80, 443 open)
3. **RDS** — PostgreSQL 17.6 on db.t3.micro (free tier), railgram-db
4. **ElastiCache** — Redis 7.1 on cache.t3.micro (free tier), railgram-redis
5. **S3** — railgram-media-prod bucket, CORS configured
6. **IAM Role** — railgram-ec2-role (S3FullAccess + SSMReadOnly) attached to EC2
7. **EC2** — t3.micro Ubuntu 24.04, Python venv, backend cloned
8. **Alembic migrations** — `alembic upgrade head` — 8 migrations run in production DB
9. **systemd service** — railgram.service, auto-restart on crash
10. **Frontend build** — `npm run build` → rsync to EC2
11. **Nginx** — reverse proxy + static SPA server
12. **Route 53** — Hosted zone for railgram.in, A records added
13. **GoDaddy** — Nameservers updated to AWS Route 53
14. **ACM** — SSL cert for railgram.in + *.railgram.in (DNS validated)
15. **Let's Encrypt** — Certbot installed, cert issued for nginx HTTPS
16. **HTTPS live** — https://railgram.in working with padlock ✅
17. **CloudFront** — Distribution dzdr0nfpn0f2c.cloudfront.net → railgram-media-prod S3
18. **media.py rewritten** — from Cloudflare R2 → AWS S3 + CloudFront (boto3 + IAM role)
19. **Resend email** — resend==2.10.0, email.py created with 3 templates
20. **Resend domain verified** — DNS records added to Route 53, railgram.in verified ✅

### Phase 8B — React Native Mobile App ✅ FULLY IMPLEMENTED & READY

**Location:** `/Users/kie/Documents/RailGram/mobile/`
**Run:** `cd mobile && npx expo start`
**Status:** All core features built + TypeScript zero errors ✅

#### Major Features Completed (This Session)

1. **WebSocket Real-Time Chat** ✅
   - `src/utils/websocket.ts` — ChatWebSocket class with auto-reconnect, message queuing, keep-alive
   - `src/screens/stack/ChatRoomScreen.tsx` — Full chat UI with optimistic updates, connection status
   - Message history + real-time reception
   - Auto-scroll to latest, disabled input when offline
   - Handles offline → online recovery gracefully

2. **Media Upload (S3 Presigned URLs)** ✅
   - `src/utils/media.ts` — Camera + gallery picker, S3 upload with presigned URLs
   - Functions: `pickImage()`, `takePhoto()`, `uploadMedia()`
   - Permission handling (iOS + Android)
   - File size validation, error recovery

3. **Story Creation Screen** ✅
   - `src/screens/stack/StoryCreationScreen.tsx` — Photo capture, preview, publish flow
   - Selection UI (take photo / pick from gallery)
   - Preview screen before publishing
   - S3 media upload + 24hr expiry
   - Integrated in ProfileScreen as "+ Create Story" button

4. **Push Notifications** ✅
   - `src/utils/notifications.ts` — Full Expo Notifications setup
   - Device token registration with backend
   - Foreground + background notification handling
   - Notification tap → deep link navigation
   - Types: like, comment, follow, message, mention, system

5. **Deep Linking** ✅
   - `src/navigation/linking.ts` — URL scheme handling
   - Supports: `railgram://...` and `https://railgram.in/...`
   - Routes: `/posts/:id`, `/trains/:trainNo`, `/profile/:username`, `/messages/:convId`, `/stories/create`, etc.
   - Notification tap automatically navigates to relevant screen
   - Integrated with React Navigation

#### Full Dependencies Installed
- React Navigation (native-stack + bottom-tabs)
- TanStack Query + @tanstack/react-query
- Zustand (state management)
- expo-secure-store (JWT storage)
- react-native-maps (live train tracking)
- expo-notifications (push notifications)
- expo-image-picker (camera/gallery)
- expo-file-system (file handling)
- expo-device (device info)
- expo-linking (deep linking)
- expo-constants (config)

#### Complete File Structure

| File | Lines | Purpose |
|---|---|---|
| `App.tsx` | 40 | QueryClient + Navigation + Notifications setup |
| `src/types/index.ts` | 120 | Shared types (User, Post, Story, Train, Message, etc.) |
| `src/api/client.ts` | 150 | API client with auto token refresh, SecureStore |
| `src/store/authStore.ts` | 80 | Zustand auth (login/register/logout/loadMe) |
| `src/utils/websocket.ts` | 180 | ChatWebSocket class + useWebSocket hook |
| `src/utils/media.ts` | 140 | Image picker + S3 upload utilities |
| `src/utils/notifications.ts` | 280 | Expo Notifications setup + device token registration |
| `src/navigation/types.ts` | 30 | TypeScript types for routes + params |
| `src/navigation/RootNavigator.tsx` | 60 | Auth-gated stack navigator |
| `src/navigation/TabNavigator.tsx` | 50 | Bottom tabs (Feed / TrainMap / Chat / Profile) |
| `src/navigation/linking.ts` | 180 | Deep linking configuration + URL parsing |
| `src/screens/auth/LoginScreen.tsx` | 120 | Email + password login |
| `src/screens/auth/RegisterScreen.tsx` | 140 | Registration form with validation |
| `src/screens/auth/ForgotPasswordScreen.tsx` | 100 | Password reset email flow |
| `src/screens/tabs/FeedScreen.tsx` | 150 | Infinite-scroll feed, like/comment/bookmark |
| `src/screens/tabs/TrainMapScreen.tsx` | 200 | Live train map + search + details |
| `src/screens/tabs/ChatScreen.tsx` | 120 | Conversations list with unread badges + navigate to ChatRoom |
| `src/screens/tabs/ProfileScreen.tsx` | 180 | Own profile + karma/badges/streak + "Create Story" button |
| `src/screens/stack/PostDetailScreen.tsx` | 150 | Post + comments + like/bookmark |
| `src/screens/stack/TrainDetailScreen.tsx` | 170 | Train info + live position + 30s auto-refresh |
| `src/screens/stack/UserProfileScreen.tsx` | 150 | Other user profile + follow + post grid |
| `src/screens/stack/StoriesScreen.tsx` | 130 | Instagram-style story viewer + progress bars |
| `src/screens/stack/ChatRoomScreen.tsx` | 280 | **NEW** — Full WebSocket chat with real-time updates |
| `src/screens/stack/StoryCreationScreen.tsx` | 200 | **NEW** — Photo capture + S3 upload + publish |
| `src/screens/stack/LeaderboardScreen.tsx` | 150 | Top railfans by karma (gold/silver/bronze) |

#### Features Status

| Feature | Status | Notes |
|---|---|---|
| Authentication | ✅ Complete | Login/register/logout/JWT storage |
| Feed | ✅ Complete | Infinite scroll, like/comment/bookmark |
| Chat (Real-time) | ✅ Complete | WebSocket + optimistic UI + offline support |
| Stories | ✅ Complete | Create + view + 24hr expiry |
| Posts | ✅ Complete | Create with train tags via story flow |
| Trains | ✅ Complete | Map view + live position + info panel |
| Push Notifications | ✅ Complete | Device token + foreground/background handling |
| Deep Linking | ✅ Complete | URL schemes + notification navigation |
| Media Upload | ✅ Complete | S3 presigned URLs + progress |
| Profile | ✅ Complete | Own + other users + karma/badges/streaks |
| TypeScript | ✅ Zero Errors | Full type safety |

#### Recent Key Additions

1. **ChatRoomScreen** — WebSocket listener + real-time message display
2. **StoryCreationScreen** — Camera/gallery picker + preview + S3 upload
3. **Media utilities** — S3 presigned URL handling + error recovery
4. **Notifications system** — Device token registration + notification routing
5. **Deep linking** — URL parsing + route resolution
6. **ProfileScreen update** — "+ Create Story" button + navigation integration

#### What's NOT Needed
- App icon + splash screen (low priority)
- EAS Build (optional, for app stores)
- Submission to Play Store/App Store (optional)

---

---

## Phase Status Summary

| Phase | What | Status |
|---|---|---|
| 1 | Core backend, DB, Auth foundation | ✅ |
| 2 | User auth, social graph (follow/block) | ✅ |
| 3 | Posts, Stories, Feed | ✅ |
| 4 | Train engine (TrainMaster/StationMaster/Schedule) | ✅ |
| 5 | Live train tracking (GPS + spotter + truth engine) | ✅ |
| 6 | Real-time WebSocket chat | ✅ |
| 7 | Gamification (karma/badges/streaks) + security hardening | ✅ |
| 7B | React web frontend | ✅ |
| 8A | AWS production deployment (EC2+RDS+Redis+S3+CF+SSL+Email) | ✅ |
| 8B | React Native mobile app (Expo) — Chat + Media + Story + Notifications + DeepLinks | ✅ |

---

## Phase 8A — FULLY COMPLETE ✅

## AWS Infrastructure

| Resource | Details | Status |
|---|---|---|
| EC2 | `railgram-server`, t3.micro, Ubuntu 24.04, IP: `13.234.19.98` | ✅ |
| SSH | `ssh -i ~/Downloads/railgram-key.pem ubuntu@13.234.19.98` | ✅ |
| RDS | PostgreSQL 17.6, `railgram-db.ct2qm8wugyr4.ap-south-1.rds.amazonaws.com:5432` | ✅ |
| ElastiCache | Redis 7.1, `railgram-redis.wqrl5k.ng.0001.aps1.cache.amazonaws.com:6379` | ✅ |
| S3 | `railgram-media-prod`, ap-south-1 | ✅ |
| CloudFront | `dzdr0nfpn0f2c.cloudfront.net` → S3 media bucket | ✅ |
| ACM | SSL cert for `railgram.in` + `*.railgram.in` (validated) | ✅ |
| Route 53 | `railgram.in` → `13.234.19.98`, `www` → redirect | ✅ |
| Resend Email | `noreply@railgram.in`, domain verified, API key set | ✅ |

## Domain
- `https://railgram.in` — LIVE with SSL ✅
- `www.railgram.in` → redirects to `railgram.in` ✅
- GoDaddy nameservers → AWS Route 53

## EC2 Server Config

### Backend service (`/etc/systemd/system/railgram.service`)
```
WorkingDirectory=/home/ubuntu/backend
ExecStart=/home/ubuntu/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
```
Commands: `sudo systemctl restart railgram` / `sudo systemctl status railgram`

### Nginx (`/etc/nginx/sites-available/railgram`)
- HTTP → HTTPS redirect
- `www` → apex redirect
- `/api/` → proxy to `127.0.0.1:8000`
- `/` → `/home/ubuntu/frontend/dist`
- SSL via Let's Encrypt (certbot, auto-renews)

### EC2 `.env` (`/home/ubuntu/backend/.env`) — CURRENT STATE
```
DATABASE_URL=postgresql+asyncpg://railgram:Itskie7910@railgram-db.ct2qm8wugyr4.ap-south-1.rds.amazonaws.com:5432/railgram
REDIS_URL=redis://railgram-redis.wqrl5k.ng.0001.aps1.cache.amazonaws.com:6379
AWS_S3_BUCKET=railgram-media-prod
AWS_REGION=ap-south-1
CLOUDFRONT_URL=https://dzdr0nfpn0f2c.cloudfront.net
SECRET_KEY=39671622c39d7321a902a7d69ae3bb7b2b1afe4647e1ba75847e51d9799d0b52
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
ENVIRONMENT=production
RESEND_API_KEY=re_HSYkjxSv_A67mMmfMooVDquRH9oN9KoND
EMAIL_FROM=noreply@railgram.in
```

## Local Codebase
- Backend: `/Users/kie/Documents/RailGram/backend/`
- Frontend: `/Users/kie/Documents/RailGram/frontend/`
- Deploy frontend: `cd frontend && npm run build` then rsync to EC2

### Key files changed recently
- `backend/app/services/media.py` — rewritten from Cloudflare R2 → AWS S3 + CloudFront
- `backend/app/services/email.py` — NEW, uses Resend SDK (3 templates: verify, reset, welcome)
- `backend/app/core/config.py` — added `resend_api_key`, `email_from` fields; `extra="ignore"`
- `backend/requirements.txt` — added `resend==2.10.0`

## Deploy Commands
```bash
# SSH to EC2
ssh -i ~/Downloads/railgram-key.pem ubuntu@13.234.19.98

# Deploy backend changes
scp -i ~/Downloads/railgram-key.pem -r /Users/kie/Documents/RailGram/backend/app/ ubuntu@13.234.19.98:/home/ubuntu/backend/
ssh -i ~/Downloads/railgram-key.pem ubuntu@13.234.19.98 "sudo systemctl restart railgram"

# Deploy frontend changes
cd /Users/kie/Documents/RailGram/frontend && npm run build
rsync -avz -e "ssh -i ~/Downloads/railgram-key.pem" dist/ ubuntu@13.234.19.98:/home/ubuntu/frontend/dist/

# Check backend logs
ssh -i ~/Downloads/railgram-key.pem ubuntu@13.234.19.98 "sudo journalctl -u railgram -n 50"
```

## Phase 8B — React Native Plan (START HERE)

```bash
cd /Users/kie/Documents/RailGram
npx create-expo-app RailGramMobile --template blank-typescript
```

Tech stack:
- Expo SDK (latest)
- React Navigation (stack + tab)
- TanStack Query (API calls)
- Zustand (auth state)
- Expo SecureStore (JWT storage)
- react-native-maps (train map)
- Expo Notifications (push)

API base: `https://railgram.in/api/v1`

Screens to build:
1. Auth: Login, Register, ForgotPassword
2. Main tabs: Feed, TrainMap, Chat, Profile
3. Stack screens: PostDetail, TrainDetail, UserProfile, Stories, Leaderboard

All backend endpoints ready — no backend changes needed.

---

## Backend Architecture

### Tech Stack
- FastAPI + Python 3.12 + asyncpg (async SQLAlchemy)
- PostgreSQL 17.6 (RDS)
- Redis 7.1 (ElastiCache) — caching + rate limiting
- uvicorn (2 workers in production)
- Pydantic v2 + pydantic-settings

### Entry Point: `backend/main.py`
- All routes mounted under `/api/v1`
- Background worker: refreshes live train positions every 60s
- Lifespan: seeds badge catalogue on startup, closes Redis/engine on shutdown
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, etc.)
- Rate limiting via slowapi
- CORS configured via `allowed_origins` env var

### API Routes (all prefixed `/api/v1`)

| File | Prefix | What it does |
|---|---|---|
| `api/routes/auth.py` | `/auth` | Register, login, logout, refresh token, email verify, password reset |
| `api/routes/trains.py` | `/trains` + `/stations` | CRUD train master, station master, trip schedules |
| `api/routes/posts.py` | `/posts` | Feed, create post, like, comment, bookmark |
| `api/routes/stories.py` | `/stories` | Create/view 24hr stories (Instagram-style) |
| `api/routes/users.py` | `/users` | Profile, follow/unfollow, block, search users |
| `api/routes/media.py` | `/media` | Presigned S3 upload URL, delete media |
| `api/routes/tracking.py` | `/trains` | GPS reports, spotter reports, live position |
| `api/routes/gamification.py` | (no prefix) | Karma, badges, streaks, leaderboard |
| `api/routes/chat.py` | (no prefix) | WebSocket chat, conversations, messages |
| `GET /health` | — | Health check (no auth needed) |

**NOTE:** Nginx strips `/api/` and passes to backend as-is, so backend sees `/api/v1/...` in full.

Actually: Nginx `proxy_pass http://127.0.0.1:8000/;` — the trailing slash means `/api/` is stripped. So browser sends `https://railgram.in/api/auth/login` → backend sees `POST /api/v1/auth/login`. Wait — confirm by checking nginx config. The correct rule: frontend calls `/api/v1/...`, nginx proxies → backend receives `/api/v1/...`.

### Database Models (`api/models/`)

```
User, Follow, Block            — user.py
TrainMaster, StationMaster,    — trains.py
  TripSchedule
Post, Story, StoryView,        — social.py
  Comment, Like, Bookmark
GpsReport, SpotterReport,      — tracking.py
  TrainPosition
Badge, UserBadge,              — gamification.py
  KarmaEvent, Streak
Conversation, ConvParticipant, — chat.py
  Message
```

### Services (`app/services/`)

| File | Purpose |
|---|---|
| `media.py` | AWS S3 presigned URLs + CloudFront CDN (`cdn_url(key)`) |
| `email.py` | Resend SDK — send_verification_email, send_password_reset_email, send_welcome_email |
| `chat_manager.py` | WebSocket connection manager (in-memory) |
| `truth_engine.py` | Compute authoritative train position from GPS + spotter reports |
| `interpolation.py` | Interpolate train position between known points (uses IST timezone) |
| `karma.py` | Award/deduct karma points |
| `badge.py` | Check + award badges, seed badge catalogue |
| `streak.py` | Track daily login/activity streaks |

### Schemas (`app/schemas/`)
auth.py, chat.py, gamification.py, social.py, tracking.py, trains.py

---

## Frontend Architecture

### Tech Stack
- React 18 + TypeScript + Vite
- TailwindCSS v4 (`@import "tailwindcss"` in index.css)
- React Router v6
- TanStack Query (data fetching)
- Zustand (`store/authStore`) — JWT token + user state
- MapLibre GL (train map)
- Lucide React (icons)
- date-fns (dates)

### Pages (`frontend/src/pages/`)
| File | Route |
|---|---|
| `LoginPage.tsx` | `/login` |
| `RegisterPage.tsx` | `/register` |
| `FeedPage.tsx` | `/` |
| `MapPage.tsx` | `/map` |
| `TrainsPage.tsx` | `/trains` |
| `TrainDetailPage.tsx` | `/trains/:trainNo` |
| `ProfilePage.tsx` | `/profile/:username` |
| `ChatListPage.tsx` | `/chat` |
| `ChatRoomPage.tsx` | `/chat/:id` |
| `LeaderboardPage.tsx` | `/leaderboard` |

### Components
- `Layout.tsx` — sidebar/navbar shell (note: `Search` import was removed — was unused)
- `PostCard.tsx` — feed post card with like/comment/bookmark
- `RequireAuth.tsx` — redirect to /login if no token

---

## IMPORTANT WARNINGS FOR CLAUDE CODE

1. **DO NOT change nginx config** — it's working perfectly
2. **DO NOT run `alembic downgrade`** — 8 migrations already in production DB
3. **DO NOT revert media.py** — it's AWS S3 + CloudFront, NOT Cloudflare R2
4. **DO NOT remove `extra="ignore"` from config.py** — crashes alembic without it
5. **API prefix is `/api/v1/`** — all frontend calls use this, don't change
6. **Production docs disabled** — FastAPI `/docs` and `/redoc` are disabled in production (environment=production)


