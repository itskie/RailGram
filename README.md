# RailGram — Instagram for Indian Railway Enthusiasts

![Phase Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Backend](https://img.shields.io/badge/Backend-FastAPI-009485)
![Frontend Web](https://img.shields.io/badge/Frontend%20Web-React%2B Vite-61DAFB)
![Mobile](https://img.shields.io/badge/Mobile-React%20Native%2BExpo-000000)
![Database](https://img.shields.io/badge/Database-PostgreSQL-336791)
![Deployment](https://img.shields.io/badge/Deployment-AWS%20EC2-FF9900)

## Overview

**RailGram** is a full-stack social media platform designed for Indian Railway enthusiasts (railfans). Users can:

- 📸 **Post** train photos/videos with station and train tags
- 🗺️ **Track** live train positions using crowd-sourced GPS reports and spotter data
- 🎥 **Share** 24-hour Instagram-style stories
- 💬 **Chat** in real-time with other railfans
- 🏆 **Compete** with gamification (karma points, badges, daily streaks, leaderboard)
- 👥 **Follow** railfans, build private profiles, and block users

**Live:** [https://railgram.in](https://railgram.in)

---

## Technology Stack

### Backend
- **Framework:** FastAPI (Python 3.12)
- **Database:** PostgreSQL 17.6 (asyncpg, async SQLAlchemy)
- **Cache:** Redis 7.1 (ElastiCache)
- **Authentication:** JWT Bearer tokens (30min expiry)
- **Email:** Resend API
- **Storage:** AWS S3 + CloudFront CDN
- **Realtime:** WebSocket chat + Redis pub/sub

### Frontend (Web)
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** TailwindCSS v4
- **State:** Zustand + TanStack Query
- **Maps:** MapLibre GL

### Frontend (Mobile)
- **Framework:** React Native + Expo + TypeScript
- **Navigation:** React Navigation (stack + tabs)
- **State:** Zustand + TanStack Query
- **Notifications:** Expo Notifications
- **Maps:** react-native-maps

### Infrastructure
- **Region:** ap-south-1 (Mumbai)
- **Compute:** AWS EC2 t3.micro (Ubuntu 24.04)
- **Database:** AWS RDS (PostgreSQL)
- **Cache:** AWS ElastiCache (Redis)
- **CDN:** AWS CloudFront
- **DNS:** AWS Route 53
- **SSL:** Let's Encrypt + ACM

---

## Project Structure

```
RailGram/
├── backend/                    # FastAPI backend
│   ├── api/
│   │   ├── models/            # SQLAlchemy models (users, posts, stories, trains, chat, etc.)
│   │   ├── routes/            # API endpoints (10 route files)
│   │   └── database.py        # Async database connection
│   ├── app/
│   │   ├── core/              # Config, security, CSRF, rate limiting
│   │   ├── services/          # Email, media (S3), chat manager, trains, karma, etc.
│   │   └── schemas/           # Pydantic validation schemas
│   ├── alembic/               # Database migrations
│   ├── main.py                # FastAPI app entrypoint
│   └── requirements.txt        # Python dependencies
│
├── frontend/                   # React web app
│   ├── src/
│   │   ├── pages/             # 10 pages (login, feed, profile, chat, etc.)
│   │   ├── components/        # Reusable UI components
│   │   ├── store/             # Zustand auth store
│   │   ├── api/               # API client + hooks
│   │   └── App.tsx
│   ├── vite.config.ts
│   └── package.json
│
├── mobile/                     # React Native (Expo) app
│   ├── src/
│   │   ├── screens/           # Auth, tabs (Feed/Chat/Map/Profile), stack screens
│   │   ├── navigation/        # RootNavigator, TabNavigator, deep linking
│   │   ├── store/             # Zustand auth store
│   │   ├── api/               # API client with auto token refresh
│   │   ├── utils/             # WebSocket, media upload, notifications
│   │   └── types/             # TypeScript interfaces
│   ├── App.tsx
│   ├── app.json               # Expo config
│   └── package.json
│
├── CLAUDE_HANDOFF.md          # Complete project documentation
└── .gitignore
```

---

## Key Features

### 1. Real-Time Chat 💬
- WebSocket connection with auto-reconnect
- Message queuing (works offline)
- Optimistic UI updates
- Connection status indicator

### 2. Live Train Tracking 🚂
- GPS reports from railfans
- Crowd-sourced spotter data
- Truth Engine merges multiple data sources
- Real-time position on interactive map

### 3. Stories & Posts
- 24-hour auto-expiring stories
- Photo/video posts with train tags
- Like, comment, bookmark functionality
- Privacy controls (public/private profiles)

### 4. Gamification 🏆
- **Karma Points** — awarded for posts, comments, follows
- **Badges** — unlock for achievements
- **Daily Streaks** — consecutive activity tracking
- **Leaderboard** — rank by karma points

### 5. Mobile Experience
- Instant app startup with auth persistence
- Offline message queuing (chat)
- Camera + gallery media picker
- Push notifications with deep linking

---

## API Endpoints

**Base URL:** `https://railgram.in/api/v1`

### Auth Routes (`/auth`)
- `POST /register` — Create account
- `POST /login` — Get JWT token
- `POST /refresh` — Refresh expiring token
- `POST /verify-email` — Verify email address
- `POST /reset-password` — Reset password

### Social Routes
- `GET /posts/feed` — Infinite-scroll feed
- `POST /posts` — Create post
- `GET /stories` — List stories
- `POST /stories` — Create story
- `POST /posts/{id}/like` — Like post
- `GET /users/{username}` — User profile
- `POST /users/{id}/follow` — Follow user

### Trains Routes
- `GET /trains` — List trains
- `GET /trains/{trainNo}` — Train details
- `GET /trains/{trainNo}/position` — Live position
- `POST /tracking/gps-report` — Submit GPS report
- `GET /stations` — List stations

### Chat Routes
- `GET /conversations` — List conversations
- `POST /conversations/{convId}/messages` — Send message
- `WS /ws/conversations/{convId}?token=<jwt>` — Real-time chat

### Gamification Routes
- `GET /leaderboard` — Top users by karma
- `GET /gamification/me` — User stats (karma, badges, streak)

---

## Running Locally

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (Web)
```bash
cd frontend
npm install
npm run dev
```

### Frontend (Mobile)
```bash
cd mobile
npm install
npx expo start
```

---

## Database Schema

**Key Models:**
- `User` — Profile info, privacy settings, karma
- `Follow` — User relationships
- `Block` — Blocked users
- `Post` — Feed posts, train/station tags
- `Story` — 24hr expiring stories, view tracking
- `Comment` — Post comments
- `Like` — Post/comment likes
- `TrainMaster` — Train metadata (name, type, source, destination)
- `StationMaster` — Station info (code, name, lat/lng)
- `TripSchedule` — Train timing (arrival/departure per station)
- `GpsReport` — Crowd-sourced train position
- `Message` — Chat messages
- `Conversation` — 1:1 or group chats
- `Badge`, `UserBadge` — Gamification badges
- `KarmaEvent` — Karma point transactions
- `Streak` — Daily login streaks

---

## Deployment

### AWS Infrastructure
- **EC2:** `13.234.19.98` (Ubuntu 24.04, t3.micro)
- **RDS:** PostgreSQL 17.6
- **ElastiCache:** Redis 7.1
- **S3:** `railgram-media-prod`
- **CloudFront:** `dzdr0nfpn0f2c.cloudfront.net`

### Deploy Commands
```bash
# SSH to EC2
ssh -i ~/Downloads/railgram-key.pem ubuntu@13.234.19.98

# Deploy backend
scp -i ~/Downloads/railgram-key.pem -r backend/app/ ubuntu@13.234.19.98:/home/ubuntu/backend/
ssh -i ~/Downloads/railgram-key.pem ubuntu@13.234.19.98 "sudo systemctl restart railgram"

# Deploy frontend
cd frontend && npm run build
rsync -avz -e "ssh -i ~/Downloads/railgram-key.pem" dist/ ubuntu@13.234.19.98:/home/ubuntu/frontend/dist/
```

### Environment Variables (EC2)
See `CLAUDE_HANDOFF.md` for complete `.env` configuration.

---

## Development

### Project Phases

| Phase | Component | Status |
|-------|-----------|--------|
| 1-4 | Backend core features | ✅ Complete |
| 5 | Train tracking (GPS + spotter) | ✅ Complete |
| 6 | WebSocket chat | ✅ Complete |
| 7 | Gamification + security | ✅ Complete |
| 7B | React web frontend | ✅ Complete |
| 8A | AWS deployment | ✅ Live |
| 8B | React Native mobile | ✅ Complete |

### Testing
```bash
# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && npm run test

# Mobile tests
cd mobile && npm run test
```

---

## Documentation

- **[CLAUDE_HANDOFF.md](./CLAUDE_HANDOFF.md)** — Complete project history, infrastructure, deployment guides

---

## Owner

**Shobhit Singh** | [railgram.in](https://railgram.in)

---

## License

Proprietary — RailGram © 2026

---

## Future Roadmap

- [ ] Android/iOS app store submission
- [ ] AI-powered train delay predictions
- [ ] Video streaming for train journeys
- [ ] Augmented reality train tracking
- [ ] Community moderation tools
- [ ] Advanced analytics for railfans
