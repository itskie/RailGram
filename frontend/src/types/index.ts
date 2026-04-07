// ── Auth ──────────────────────────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  favourite_train: string | null;
  home_station: string | null;
  is_private: boolean;
  is_active: boolean;
  is_verified: boolean;
  is_email_verified?: boolean;
  is_admin?: boolean;
  karma: number;
  post_count: number;
  follower_count: number;
  following_count: number;
  created_at: string;
}

export interface UserProfileOut extends User {
  is_following: boolean;
  is_blocked: boolean;
}

// ── Posts & Stories ───────────────────────────────────────────────────────────
export interface Post {
  id: string;
  author_id: string;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null; is_verified?: boolean };
  caption: string | null;
  media_keys: string[];
  train_no: string | null;
  station_code: string | null;
  location_name: string | null;
  loco_class: string | null;
  loco_number: string | null;
  loco_shed: string | null;
  loco_zone: string | null;
  like_count: number;
  comment_count: number;
  bookmark_count: number;
  liked: boolean;
  bookmarked: boolean;
  viewer_followed: boolean;
  created_at: string;
}

export interface UserBrief {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  karma: number;
  is_verified?: boolean;
}

export interface Story {
  id: string;
  author_id: string;
  author: { username: string; display_name: string | null; avatar_url: string | null; is_verified?: boolean };
  media_key: string;
  train_no: string | null;
  station_code: string | null;
  view_count: number;
  expires_at: string;
  created_at: string;
}

export interface Comment {
  id: string;
  author_id: string;
  author: { username: string; display_name: string | null; avatar_url: string | null; is_verified?: boolean };
  body: string;
  created_at: string;
}

// ── Trains ────────────────────────────────────────────────────────────────────
export interface Train {
  id: string;
  train_no: string;
  train_name: string;
  train_type: string;
  from_station: string;
  to_station: string;
  departure_time: string;
  arrival_time: string;
  days_of_week: string[];
  distance_km: number | null;
  duration_mins: number | null;
}

export interface Station {
  id: string;
  station_code: string;
  station_name: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  is_major: boolean;
}

export interface LivePosition {
  train_no: string;
  train_name?: string;
  source: "gps" | "cell_tower" | "spotter" | "schedule" | "unknown";
  confidence: number;
  latitude: number | null;
  longitude: number | null;
  accuracy_m?: number | null;
  current_station_code?: string | null;   // alias kept for compat (may be undefined)
  current_station_name?: string | null;
  from_station_code?: string | null;      // last station the train departed from
  from_station_name?: string | null;
  next_station_code: string | null;       // next upcoming station
  next_station_name?: string | null;
  next_station_eta?: string | null;       // ISO datetime
  to_station_code?: string | null;
  delay_minutes: number;
  speed_kmh?: number | null;
  tunnel_detected?: boolean | null;
  tunnel_confidence?: number | null;
  computed_at?: string;
  last_updated?: string;
}

export interface TrainBetweenResult {
  train_no: string;
  name: string;
  train_type?: string | null;
  runs_on?: string | null;
  departure_time?: string | null;
  arrival_time?: string | null;
  duration_minutes?: number | null;
  from_day: number;
  to_day: number;
}

export interface ScheduleStop {
  sequence: number;
  station_code: string;
  station_name: string;
  city?: string | null;
  arrival_time?: string | null;
  departure_time?: string | null;
  halt_minutes: number;
  distance_km: number;
  day: number;
  platform?: string | null;
}

export interface TrainSchedule {
  train_no: string;
  name: string;
  train_type?: string | null;
  zone?: string | null;
  origin_code?: string | null;
  destination_code?: string | null;
  total_distance_km?: number | null;
  duration_minutes?: number | null;
  runs_on?: string | null;
  stops: ScheduleStop[];
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  conv_type: string;
  other_user_id: string | null;
  other_username: string | null;
  other_display_name: string | null;
  other_avatar_url: string | null;
  other_last_seen_at: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  msg_type: string;
  body: string | null;
  media_key: string | null;
  train_no: string | null;
  station_code: string | null;
  is_deleted: boolean;
  read_at: string | null;
  created_at: string;
}

// ── Gamification ──────────────────────────────────────────────────────────────
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  karma_bonus: number;
  earned_at: string | null;
}

export interface GamificationStats {
  karma: number;
  rank: number;
  badges: Badge[];
  streak: number | null;
  post_count: number;
  spot_count: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  karma: number;
  is_verified: boolean;
}

// ── Reels ─────────────────────────────────────────────────────────────────────
export interface Reel {
  id: string;
  user: UserBrief;
  title: string;
  description: string;
  train_number: string | null;
  train_name: string | null;
  station_tag: string | null;
  hls_url: string | null;
  thumbnail_url: string | null;
  duration_secs: number | null;
  status: string;
  views: number;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  is_public: boolean;
  viewer_liked: boolean;
  viewer_saved: boolean;
  viewer_followed: boolean;
  created_at: string;
}

export interface ReelFeedResponse {
  items: Reel[];
  next_cursor: string | null;
}

// ── Unified Feed (Posts + Reels) ─────────────────────────────────────────────
export interface UnifiedFeedItem {
  item_type: "post" | "reel";
  id: string;
  created_at: string;
  // Post fields
  post_type?: string;
  caption?: string | null;
  media_keys?: string[];
  thumbnail_key?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  train_no?: string | null;
  station_code?: string | null;
  loco_class?: string | null;
  loco_number?: string | null;
  loco_shed?: string | null;
  loco_zone?: string | null;
  like_count?: number;
  comment_count?: number;
  bookmark_count?: number;
  // Reel fields
  title?: string;
  description?: string;
  train_number?: string | null;
  train_name?: string | null;
  hls_url?: string | null;
  reel_thumbnail_url?: string | null;
  duration_secs?: number | null;
  views?: number;
  likes_count?: number;
  comments_count?: number;
  saves_count?: number;
  // Common
  author: UserBrief;
  viewer_liked: boolean;
  viewer_bookmarked: boolean;
  viewer_saved: boolean;
  viewer_followed: boolean;
}

export interface UnifiedFeedResponse {
  items: UnifiedFeedItem[];
  next_cursor: string | null;
}
