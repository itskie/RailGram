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
  liked: boolean;
  bookmarked: boolean;
  created_at: string;
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
  train_name: string;
  source: "gps" | "spotter" | "schedule" | "unknown";
  confidence: number;
  latitude: number | null;
  longitude: number | null;
  current_station_code: string | null;
  current_station_name: string | null;
  next_station_code: string | null;
  next_station_name: string | null;
  delay_minutes: number;
  last_updated: string;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  conv_type: string;
  other_user_id: string | null;
  other_username: string | null;
  other_display_name: string | null;
  other_avatar_url: string | null;
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
