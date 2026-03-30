import * as SecureStore from 'expo-secure-store';

const BASE = 'https://railgram.in/api/v1';

const ACCESS_KEY = 'rg_access_token';
const REFRESH_KEY = 'rg_refresh_token';

export async function getTokens() {
  const access = await SecureStore.getItemAsync(ACCESS_KEY);
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  return { access, refresh };
}

export async function saveTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = await getTokens();
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) { await clearTokens(); return null; }
    const data = await res.json();
    await saveTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    await clearTokens();
    return null;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { access } = await getTokens();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (access) headers['Authorization'] = `Bearer ${access}`;

  let res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((detail as { detail?: string })?.detail ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body: { username: string; email: string; password: string; display_name?: string }) =>
    apiFetch<{ access_token: string; refresh_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; refresh_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => apiFetch<import('../types').User>('/auth/me'),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    apiFetch('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyEmail: (token: string) =>
    apiFetch<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  resendVerification: (email: string) =>
    apiFetch<{ message: string }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, new_password: string) =>
    apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password }),
    }),
};

// ── Posts ─────────────────────────────────────────────────────────────────────
export const postsApi = {
  feed: (cursor?: string) =>
    apiFetch<{ items: import('../types').Post[]; next_cursor?: string }>(
      `/posts/feed/discover${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
    ),
  bookmarked: (cursor?: string) =>
    apiFetch<{ posts: import('../types').Post[]; next_cursor?: string }>(
      `/posts/bookmarked${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
    ),
  get: (id: string) => apiFetch<import('../types').Post>(`/posts/${id}`),
  create: (form: FormData) => apiFetch<import('../types').Post>('/posts', { method: 'POST', body: form }),
  like: (id: string) => apiFetch(`/posts/${id}/like`, { method: 'POST' }),
  unlike: (id: string) => apiFetch(`/posts/${id}/like`, { method: 'DELETE' }),
  comments: (id: string) => apiFetch<import('../types').Comment[]>(`/posts/${id}/comments`),
  addComment: (id: string, body: string) =>
    apiFetch<import('../types').Comment>(`/posts/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  likeComment: (commentId: string) =>
    apiFetch(`/posts/comments/${commentId}/like`, { method: 'POST' }),
  deleteComment: (commentId: string) =>
    apiFetch(`/posts/comments/${commentId}`, { method: 'DELETE' }),
  getReplies: (postId: string, commentId: string) =>
    apiFetch<import('../types').Comment[]>(`/posts/${postId}/comments/${commentId}/replies`),
  bookmark: (id: string) => apiFetch(`/posts/${id}/bookmark`, { method: 'POST' }),
  unbookmark: (id: string) => apiFetch(`/posts/${id}/bookmark`, { method: 'DELETE' }),
  delete: (id: string) => apiFetch(`/posts/${id}`, { method: 'DELETE' }),
};

// ── Stories ───────────────────────────────────────────────────────────────────
export const storiesApi = {
  feed: () => apiFetch<import('../types').StoryGroup[]>('/stories/feed'),
  view: (id: string) => apiFetch(`/stories/${id}/view`, { method: 'POST' }),
  create: (form: FormData) => apiFetch<import('../types').Story>('/stories', { method: 'POST', body: form }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  profile: (username: string) => apiFetch<import('../types').User>(`/users/${username}`),
  /** Backend toggles follow on POST (no DELETE route). */
  follow: (username: string) => apiFetch(`/users/${username}/follow`, { method: 'POST' }),
  unfollow: (username: string) => apiFetch(`/users/${username}/follow`, { method: 'POST' }),
  block: (username: string) => apiFetch(`/users/${username}/block`, { method: 'POST' }),
  unblock: (username: string) => apiFetch(`/users/${username}/block`, { method: 'POST' }),
  posts: (username: string) => apiFetch<import('../types').Post[]>(`/users/${username}/posts`),
  reels: (userId: string) => apiFetch<ReelFeedResponse>(`/reels/user/${userId}`),
  search: (q: string) => apiFetch<import('../types').User[]>(`/users/search?q=${encodeURIComponent(q)}`),
  followers: (username: string) => apiFetch<import('../types').User[]>(`/users/${username}/followers`),
  following: (username: string) => apiFetch<import('../types').User[]>(`/users/${username}/following`),
  updateProfile: (data: {
    display_name?: string;
    bio?: string;
    favourite_train?: string;
    home_station?: string;
    avatar_url?: string;
    is_private?: boolean;
  }) => apiFetch<import('../types').User>('/users/me/profile', { method: 'PUT', body: JSON.stringify(data) }),
};

// ── Trains ────────────────────────────────────────────────────────────────────
export const trainsApi = {
  search: (q: string) =>
    apiFetch<import('../types').TrainMaster[]>(`/trains/search?q=${encodeURIComponent(q)}`),
  get: (trainNo: string) => apiFetch<import('../types').TrainMaster>(`/trains/${trainNo}`),
  livePosition: (trainNo: string) =>
    apiFetch<import('../types').LivePosition>(`/tracking/trains/${trainNo}/position`),
  allLivePositions: () =>
    apiFetch<import('../types').LivePosition[]>('/tracking/trains/live'),
  trackHistory: (trainNo: string) =>
    apiFetch<import('../types').LivePosition[]>(`/tracking/trains/${trainNo}/history`),
};

// ── Stations ──────────────────────────────────────────────────────────────────
export const stationsApi = {
  search: (q: string) =>
    apiFetch<import('../types').StationMaster[]>(`/stations/search?q=${encodeURIComponent(q)}`),
};

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatApi = {
  list: () => apiFetch<import('../types').Conversation[]>('/conversations'),
  start: (targetUsername: string) =>
    apiFetch<import('../types').Conversation>(`/conversations?target_username=${targetUsername}`, { method: 'POST' }),
  messages: (convId: string, before?: string) =>
    apiFetch<import('../types').Message[]>(
      `/conversations/${convId}/messages${before ? `?before=${before}` : ''}`
    ),
  send: (convId: string, body: string) =>
    apiFetch<import('../types').Message>(`/conversations/${convId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ msg_type: 'text', body }),
    }),
  markRead: (convId: string) => apiFetch(`/conversations/${convId}/read`, { method: 'POST' }),
};

// ── Gamification ──────────────────────────────────────────────────────────────
export const gamificationApi = {
  stats: (username: string) => apiFetch<import('../types').KarmaStats>(`/users/${username}/stats`),
  leaderboard: () => apiFetch<import('../types').LeaderboardEntry[]>('/leaderboard'),
  checkin: () => apiFetch('/karma/checkin', { method: 'POST' }),
};

// ── Reels ─────────────────────────────────────────────────────────────────────
import type {
  Reel,
  ReelFeedResponse,
  ReelUploadUrlResponse,
} from '../features/reels/types/reel';

export const reelsApi = {
  feed: (cursor?: string) =>
    apiFetch<ReelFeedResponse>(`/reels/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  
  trending: () => apiFetch<ReelFeedResponse>('/reels/trending'),

  uploadUrl: (filename: string, content_type: string, file_size_bytes: number) =>
    apiFetch<ReelUploadUrlResponse>('/reels/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename, content_type, file_size_bytes }),
    }),

  create: (body: {
    s3_key: string;
    title: string;
    description: string;
    train_number?: string;
    train_name?: string;
    station_tag?: string;
    duration_secs?: number;
    width?: number;
    height?: number;
    file_size_bytes?: number;
    is_public?: boolean;
  }) => apiFetch<Reel>('/reels', { method: 'POST', body: JSON.stringify(body) }),

  like: (id: string) => apiFetch(`/reels/${id}/like`, { method: 'POST' }),
  unlike: (id: string) => apiFetch(`/reels/${id}/like`, { method: 'DELETE' }),

  save: (id: string) => apiFetch(`/reels/${id}/save`, { method: 'POST' }),
  unsave: (id: string) => apiFetch(`/reels/${id}/save`, { method: 'DELETE' }),

  saved: (cursor?: string) =>
    apiFetch<ReelFeedResponse>(`/reels/saved${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),

  user: (userId: string, cursor?: string) =>
    apiFetch<ReelFeedResponse>(`/reels/user/${userId}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),

  view: (id: string, watched_secs: number) =>
    apiFetch(`/reels/${id}/view`, { method: 'POST', body: JSON.stringify({ watched_secs }) }),
  delete: (id: string) => apiFetch(`/reels/${id}`, { method: 'DELETE' }),
  
  getComments: (reelId: string) =>
    apiFetch<import('../features/reels/types/reel').ReelComment[]>(`/reels/${reelId}/comments`),
  addComment: (reelId: string, body: string, parent_id?: string) =>
    apiFetch<import('../features/reels/types/reel').ReelComment>(`/reels/${reelId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, parent_id: parent_id ?? null }),
    }),
  likeComment: (commentId: string) =>
    apiFetch(`/reels/comments/${commentId}/like`, { method: 'POST' }),
  deleteComment: (commentId: string) =>
    apiFetch(`/reels/comments/${commentId}`, { method: 'DELETE' }),
  getReplies: (reelId: string, commentId: string) =>
    apiFetch<import('../features/reels/types/reel').ReelComment[]>(
      `/reels/${reelId}/comments/${commentId}/replies`
    ),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (limit = 30, before?: string) =>
    apiFetch<import('../types').Notification[]>(
      `/notifications?limit=${limit}${before ? `&before=${before}` : ''}`
    ),
  unreadCount: () =>
    apiFetch<{ unread_count: number }>('/notifications/unread-count'),
  readAll: () => apiFetch('/notifications/read-all', { method: 'PUT' }),
  readOne: (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'PUT' }),
};

// ── Media ─────────────────────────────────────────────────────────────────────
export const mediaApi = {
  presign: (body: { filename: string; content_type: string; purpose?: string }) =>
    apiFetch<{ upload_url: string; cdn_url: string; s3_key: string }>('/media/presign', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
