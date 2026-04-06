# RailGram Mobile App

React Native 0.84.1 bare workflow — iOS & Android.

---

## Tech Stack

| Library | Purpose |
|---|---|
| React Native 0.84.1 | Core framework |
| @react-navigation/native | Navigation |
| @react-navigation/bottom-tabs | Tab bar |
| @react-navigation/native-stack | Stack screens |
| @tanstack/react-query | Data fetching + caching |
| react-native-video | Video playback |
| react-native-image-picker | Photo/video picker |
| react-native-safe-area-context | Safe area insets |
| lucide-react-native | Icons |
| zustand | Auth state management |
| @react-native-async-storage/async-storage | Persistent token storage |
| axios | HTTP client |

---

## Project Structure

```
mobile/src/
├── api/
│   └── client.ts           # Axios instance + token management (AsyncStorage)
├── store/
│   └── authStore.ts        # Zustand auth store — user, token, login, logout, loadUser
├── utils/
│   └── upload.ts           # S3 presigned upload utility
├── navigation/
│   └── RootNavigator.tsx   # Auth stack + Tab navigator + Main stack
├── components/
│   ├── AutoImage.tsx        # Auto-height image (no black bars)
│   ├── CommentsSheet.tsx    # Unified bottom sheet for post + reel comments
│   └── StoriesRow.tsx       # Stories row in feed
└── screens/
    ├── auth/
    │   ├── LoginScreen.tsx
    │   └── RegisterScreen.tsx
    ├── tabs/
    │   ├── FeedScreen.tsx
    │   ├── ReelsScreen.tsx
    │   ├── TrainsScreen.tsx
    │   ├── TrainMapScreen.tsx
    │   └── ProfileScreen.tsx
    └── stack/
        ├── CreatePostScreen.tsx
        ├── CreateReelScreen.tsx
        ├── PostDetailScreen.tsx
        ├── NotificationsScreen.tsx
        ├── SearchScreen.tsx
        ├── TrainDetailScreen.tsx
        ├── UserProfileScreen.tsx
        ├── EditProfileScreen.tsx
        ├── FollowRequestsScreen.tsx
        ├── BlockedUsersScreen.tsx
        ├── LeaderboardScreen.tsx
        ├── ChatListScreen.tsx
        └── ChatRoomScreen.tsx
```

---

## Features Implemented

### Auth
- Login / Register screens
- **Persistent login** — token saved in AsyncStorage, restored on app start
- Auto-fetch `/auth/me` on startup — no login on every reload
- On 401 → clear token and redirect to login; on network error → stay logged in

### Feed (Home Tab)
- Unified feed — posts + reels mixed (`/posts/feed/unified`)
- **PostCard** — image carousel, like, comment, bookmark, share
- **ReelCard** — full-width video with overlays, like, comment, save
- Two completely separate card components (not shared)
- Infinite scroll with cursor-based pagination
- Pull to refresh
- Stories row at top
- **Top bar auto-hide** — scrolling down hides instantly, scroll up shows instantly
- **+ button** → bottom sheet with 2 options: New Post / New Reel
- **Heart icon** → Notifications
- Audio: only the visible reel plays audio, others muted
- Tab switch: Feed reels mute when switching to Reels tab and vice versa (`useIsFocused`)

### Reels Tab
- Full-screen vertical swipe (TikTok/Instagram style)
- `pagingEnabled` FlatList with snap
- Only active reel plays + has audio (`isActive && isFocused`)
- Like (toggle), Comment (CommentsSheet), Save (toggle), Share, Mute/Unmute
- Tab bar hides completely when on Reels tab (full screen experience)
- Top bar ("Reels" + upload button) fades out on swipe, fades back after 1.5s
- Infinite scroll — loads more reels on end reached
- **+ button** top right → navigate to CreateReel

### Create Post
- Pick up to 10 photos from gallery
- Carousel preview with prev/next arrows
- Remove individual photos
- Add more photos with + button
- Dot indicator for multi-photo
- Caption (up to 2200 chars)
- Train number, Station code
- **Locomotive specs** — Class, Road No, Shed, Zone (2x2 grid)
- Upload flow: `/media/presign` → PUT to S3 → `POST /posts`

### Create Reel
- Pick video from gallery (MP4/MOV)
- Video preview with play/pause tap
- **Custom seekbar** — drag to any frame
- **"Use as thumbnail"** — captures current frame timestamp
- **"From gallery"** — pick custom thumbnail image
- Thumbnail preview with remove option
- Title, Description, Train number, Station code
- Upload flow: `/reels/upload-url` → PUT to S3 → optional thumbnail → `POST /reels`
- Upload progress bar

### Profile Tab
- Avatar (image or initial letter)
- Stats: Posts, Followers, Following
- Display name, Bio, Karma pill
- **3 tabs**: Posts (grid), Reels (grid), Saved (posts + reels combined)
- 3-column grid with thumbnails
- Reel fallback: dark bg + clapperboard icon when no thumbnail
- **+ button** → Create Post
- **Messages icon** → ChatList
- **Settings icon** → action sheet: Edit Profile, Follow Requests, Blocked Users, Leaderboard, Messages
- Logout button

### Edit Profile Screen
- Change display name, bio, favourite train, home station
- Avatar picker via `react-native-image-picker` → S3 presign upload
- Private account toggle
- Delete account

### Follow Requests Screen
- Pending follow requests list
- Accept / Decline buttons
- Auto-refreshes every 10s

### Blocked Users Screen
- List of blocked users with Unblock button
- Confirmation alert before unblocking

### Leaderboard Screen
- My stats card (karma, rank, trains spotted)
- Daily check-in button (⚡ +karma)
- My badges grid with rarity colors
- Top 3 podium (crown + medals)
- Full ranked list below

### Chat (DMs)
- ChatList: conversation list with unread badges + timestamps
- ChatRoom: message bubbles, 3s polling, send message, keyboard avoiding

### Comments (CommentsSheet)
- Unified bottom sheet — works for both posts and reels
- Swipe down to close
- Post comments use `author` field; Reel comments use `user` field (normalized internally)
- Like/unlike comments (optimistic + rollback)
- Reply to comments (with @username prefill)
- View/hide replies per comment
- Delete own comments
- Comment count synced back to parent card via `onCommentCountChange`

### Post Detail Screen
- Full post view with image
- All comments with replies
- Like comments, reply, view replies
- Add comment / reply with send button
- Works for both posts and reels (`isReel` param)

### Search Screen
- Search users and posts

### Notifications Screen
- Activity feed

### Trains Tab
- Browse trains list
- Train detail screen with live info

### Train Map Tab
- Live train map

### User Profile Screen
- View other users' profiles
- Follow/unfollow

---

## API Conventions

- Base URL: configured in `src/api/client.ts`
- CDN: `https://dzdr0nfpn0f2c.cloudfront.net/`
- Auth: Bearer token in `Authorization` header
- All likes/saves/bookmarks are **toggle via POST** (no DELETE endpoint)
  - Post like: `POST /posts/{id}/like`
  - Reel like: `POST /reels/{id}/like`
  - Post bookmark: `POST /posts/{id}/bookmark`
  - Reel save: `POST /reels/{id}/save`
- Reel upload: `POST /reels/upload-url` → PUT to S3 → `POST /reels`
- Media upload: `POST /media/presign` → PUT to S3

---

## Navigation Structure

```
RootNavigator
├── AuthNavigator (if not logged in)
│   ├── Login
│   ├── Register
│   └── ForgotPassword
└── MainNavigator (if logged in)
    ├── MainTabs (TabNavigator)
    │   ├── Feed
    │   ├── Reels
    │   ├── Trains
    │   ├── TrainMap
    │   └── Profile
    ├── TrainDetail
    ├── PostDetail
    ├── CreatePost      (modal)
    ├── CreateReel      (modal)
    ├── Notifications
    ├── Search
    ├── UserProfile
    ├── EditProfile
    ├── FollowRequests
    ├── BlockedUsers
    ├── Leaderboard
    ├── ChatList
    └── ChatRoom
```

---

## Running the App

```bash
cd mobile
npm install
# iOS
npx pod-install ios
npx react-native run-ios
# Android
npx react-native run-android
```
