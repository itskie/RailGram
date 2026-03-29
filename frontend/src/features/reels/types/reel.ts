export interface ReelAuthor {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  viewer_followed: boolean;
}

export type ReelStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface Reel {
  id: string;
  user: ReelAuthor;
  title: string;
  description: string;
  train_number: string | null;
  train_name: string | null;
  station_tag: string | null;
  hls_url: string | null;
  thumbnail_url: string | null;
  duration_secs: number | null;
  status: ReelStatus;
  views: number;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  is_public: boolean;
  viewer_liked: boolean;
  viewer_saved: boolean;
  created_at: string;
}

export interface ReelFeedResponse {
  items: Reel[];
  next_cursor: string | null;
}

export interface ReelUploadUrlResponse {
  upload_url: string;
  s3_key: string;
}
