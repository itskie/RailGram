export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  is_private: boolean;
  karma_points: number;
  follower_count: number;
  following_count: number;
  created_at: string;
}

export interface Post {
  id: string;
  author: User;
  caption?: string;
  media_urls: string[];
  train_no?: string;
  station_code?: string;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  author: User;
  body: string;
  created_at: string;
}

export interface Story {
  id: string;
  author: User;
  media_url: string;
  media_type: 'image' | 'video';
  viewed: boolean;
  expires_at: string;
  created_at: string;
}

export interface StoryGroup {
  user: User;
  stories: Story[];
  has_unseen: boolean;
}

export interface TrainMaster {
  train_no: string;
  train_name: string;
  train_type: string;
  source_station: string;
  destination_station: string;
}

export interface StationMaster {
  station_code: string;
  station_name: string;
  lat?: number;
  lng?: number;
  zone?: string;
}

export interface LivePosition {
  train_no: string;
  lat: number;
  lng: number;
  speed?: number;
  delay_minutes?: number;
  last_station?: string;
  next_station?: string;
  confidence: number;
  updated_at: string;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  title?: string;
  participants: User[];
  last_message?: Message;
  unread_count: number;
  updated_at: string;
}

export interface Message {
  id: string;
  sender: User;
  msg_type: 'text' | 'image';
  body: string;
  created_at: string;
}

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_url?: string;
  earned_at?: string;
}

export interface LeaderboardEntry {
  rank: number;
  user: User;
  karma_points: number;
  badge_count: number;
}

export interface KarmaStats {
  total: number;
  streak_days: number;
  badges: Badge[];
}
