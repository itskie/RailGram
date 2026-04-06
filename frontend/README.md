# RailGram Web Frontend

React 19 + TypeScript + Vite — Production at [railgram.in](https://railgram.in)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Routing | React Router DOM v7 |
| State | Zustand v5 |
| Server State | TanStack React Query v5 |
| Styling | TailwindCSS v4 |
| Icons | Lucide React |
| Maps | MapLibre GL |
| Video (Reels) | HLS.js |
| PWA | vite-plugin-pwa |

## Features Implemented

### Stories
- 24h expiry — stories auto-expire after 24 hours
- Story feed — following users' stories in tray (unseen first, seen last, muted at end)
- Story viewer — fullscreen via `createPortal`, progress bar (CSS `@keyframes`), hold to pause
- Blurred background — landscape photos get blurred bg + `object-contain` foreground (Instagram style)
- Emoji reactions — 8 emoji options, toggle off by re-tapping
- Reply — DM-style reply input in viewer
- Viewers list — bottom sheet showing who viewed (owner only)
- Delete story — trash icon in viewer (owner only)
- Mute story — right-click / long-press on story bubble → mute/unmute (stored in localStorage)
- Story create — photo/video upload with caption, drag & drop support
- Archive — all stories (active + expired) stored indefinitely in archive

### Highlights
- Create highlight — 2-step: select stories from archive → name + cover preview
- Edit highlight — rename, change cover photo (select from archive grid)
- Add stories to existing highlight — from options sheet
- Delete highlight — custom confirm dialog via `createPortal`
- Highlight viewer — fullscreen with progress bars, blurred background, tap to navigate
- No viewer tracking — highlights are anonymous (Instagram parity ✅)

### Feed
- Unified feed — "For You" + "Following" tabs combining posts and reels
- Infinite scroll — IntersectionObserver sentinel
- Stories row — inside sticky header above feed tabs
- Hide-on-scroll header — smooth translateY animation

### Legal Pages
- Privacy Policy (`/privacy-policy`) — data collection, storage, retention, user rights
- Terms of Service (`/terms-of-service`) — content rules, account rules, disclaimers
- Cookie Policy (`/cookie-policy`) — localStorage usage, no third-party tracking cookies
- About Us (`/about`) — mission, features overview, contact links

### Register Page
- Terms of Service + Privacy Policy checkbox — must agree before account creation
- Links open in new tab

### Footer
- All links operational: Features (scroll), Sign Up, Log In, Reels, Live Train Map, Leaderboard
- Company: About Us, Community (r/indianrailways), Contact (Instagram)
- Legal: Privacy Policy, Terms of Service, Cookie Policy

## Known Issues / TODO

- **Highlight viewer**: video stories don't play — viewer uses `<img>` tag only, needs `<video>` element for video stories
- **Story progress bar**: resets to 0 after pause/resume — CSS `animation` limitation, needs JS-based timer
- **Hide story from specific users**: backend supports `hide_from` array in `StoryCreate` but no frontend UI to select users
- **Highlights on mobile**: not yet implemented (web only)
- **Reorder highlights**: drag-to-arrange not implemented

---

### Deployment
```bash
# On EC2
cd /home/ubuntu/RailGram
git pull
cd frontend
npm run build
sudo cp -r dist/* /var/www/html/
sudo systemctl restart nginx
```

> ⚠️ Database: AWS RDS only. Never use local postgres.
> ⚠️ Redis: Local container on EC2 (ElastiCache removed).
