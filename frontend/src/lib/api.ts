/**
 * Thin wrapper over fetch. All requests go through Vite's proxy at /api.
 * Access token is stored in localStorage (SimpleAuth pattern — suitable for
 * a railfan hobby app; can upgrade to httpOnly cookie flow later).
 */

const BASE = "/api/v1";

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

async function refreshAccessToken(): Promise<string | null> {
  const rt = localStorage.getItem("refresh_token");
  if (!rt) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) { clearTokens(); return null; }
    const data = await res.json();
    saveTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      res = await fetch(`${BASE}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail?.detail ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  register: (body: { username: string; email: string; password: string; display_name?: string }) =>
    apiFetch<{ access_token: string; refresh_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; refresh_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => apiFetch("/auth/me"),
  logout: () => apiFetch("/auth/logout", { method: "POST" }),
  verifyEmail: (token: string) =>
    apiFetch<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  resendVerification: (email: string) =>
    apiFetch<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, new_password: string) =>
    apiFetch<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    }),
};

// ── Posts ─────────────────────────────────────────────────────────────────────
export const posts = {
  feed: (cursor?: string) =>
    apiFetch(`/posts/feed/discover${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
  bookmarked: (cursor?: string) =>
    apiFetch(`/posts/bookmarked${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
  get: (id: string) => apiFetch(`/posts/${id}`),
  create: (body: any) =>
    apiFetch("/posts", { method: "POST", body: JSON.stringify(body) }),
  like: (id: string) => apiFetch(`/posts/${id}/like`, { method: "POST" }),
  unlike: (id: string) => apiFetch(`/posts/${id}/like`, { method: "POST" }),
  bookmark: (id: string) => apiFetch(`/posts/${id}/bookmark`, { method: "POST" }),
  unbookmark: (id: string) => apiFetch(`/posts/${id}/bookmark`, { method: "POST" }),
  comments: (id: string) => apiFetch(`/posts/${id}/comments`),
  addComment: (id: string, body: string, parent_id?: string) =>
    apiFetch(`/posts/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, parent_id: parent_id ?? null }),
    }),
  likeComment: (commentId: string) =>
    apiFetch(`/posts/comments/${commentId}/like`, { method: "POST" }),
  getReplies: (postId: string, commentId: string) =>
    apiFetch(`/posts/${postId}/comments/${commentId}/replies`),
  delete: (id: string) => apiFetch(`/posts/${id}`, { method: "DELETE" }),
};

// ── Stories ───────────────────────────────────────────────────────────────────
export const stories = {
  feed: () => apiFetch("/stories/feed"),
  create: (form: FormData) =>
    apiFetch("/stories", { method: "POST", body: form }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = {
  profile: (username: string) => apiFetch(`/users/${username}`),
  updateProfile: (data: any) => apiFetch('/users/me/profile', { method: 'PUT', body: JSON.stringify(data) }),
  /** Backend toggles follow on POST (no separate DELETE route). For private accounts, returns {pending: true} */
  follow: (username: string) =>
    apiFetch(`/users/${username}/follow`, { method: "POST" }),
  unfollow: (username: string) =>
    apiFetch(`/users/${username}/follow`, { method: "POST" }),
  getFollowRequests: () => apiFetch(`/users/requests`),
  acceptFollowRequest: (requestId: number) => apiFetch(`/users/requests/${requestId}/accept`, { method: "POST" }),
  declineFollowRequest: (requestId: number) => apiFetch(`/users/requests/${requestId}/decline`, { method: "POST" }),
  search: (q: string) => apiFetch(`/users?q=${encodeURIComponent(q)}`),
  posts: (username: string) => apiFetch(`/users/${username}/posts`),
  followers: (username: string) => apiFetch(`/users/${username}/followers`),
  following: (username: string) => apiFetch(`/users/${username}/following`),
};

// ── Trains ────────────────────────────────────────────────────────────────────
export const trains = {
  search: (q: string) => apiFetch(`/trains/search?q=${encodeURIComponent(q)}`),
  get: (trainNo: string) => apiFetch(`/trains/${trainNo}`),
  livePosition: (trainNo: string) =>
    apiFetch(`/tracking/trains/${trainNo}/position`),
  trackHistory: (trainNo: string) =>
    apiFetch(`/tracking/trains/${trainNo}/history`),
};

// ── Stations ──────────────────────────────────────────────────────────────────
export const stations = {
  search: (q: string) =>
    apiFetch(`/stations/search?q=${encodeURIComponent(q)}`),
};

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chat = {
  list: () => apiFetch("/conversations"),
  start: (targetUsername: string) =>
    apiFetch(`/conversations?target_username=${targetUsername}`, { method: "POST" }),
  messages: (convId: string, before?: string) =>
    apiFetch(`/conversations/${convId}/messages${before ? `?before=${before}` : ""}`),
  send: (convId: string, body: string) =>
    apiFetch(`/conversations/${convId}/messages`, {
      method: "POST",
      body: JSON.stringify({ msg_type: "text", body }),
    }),
  markRead: (convId: string) =>
    apiFetch(`/conversations/${convId}/read`, { method: "POST" }),
};

// ── Gamification ──────────────────────────────────────────────────────────────
export const gamification = {
  stats: (username: string) => apiFetch(`/users/${username}/stats`),
  leaderboard: () => apiFetch("/leaderboard"),
  checkin: () => apiFetch("/karma/checkin", { method: "POST" }),
};

// ── Media ─────────────────────────────────────────────────────────────────────
export const media = {
  presign: (body: { filename: string; content_type: string; purpose: string }) =>
    apiFetch<{ key: string; upload_url: string; cdn_url: string }>(
      "/media/presign",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    ),
};

// ── Reels ─────────────────────────────────────────────────────────────────────
import type {
  Reel,
  ReelFeedResponse,
  ReelUploadUrlResponse,
} from "../features/reels/types/reel";

export const reels = {
  feed: (cursor?: string) =>
    apiFetch<ReelFeedResponse>(`/reels/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
  
  trending: () => apiFetch<ReelFeedResponse>("/reels/trending"),

  uploadUrl: (filename: string, content_type: string, file_size_bytes: number) =>
    apiFetch<ReelUploadUrlResponse>("/reels/upload-url", {
      method: "POST",
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
  }) => apiFetch<Reel>("/reels", { method: "POST", body: JSON.stringify(body) }),

  like: (id: string) => apiFetch(`/reels/${id}/like`, { method: "POST" }),
  unlike: (id: string) => apiFetch(`/reels/${id}/like`, { method: "DELETE" }),
  
  save: (id: string) => apiFetch(`/reels/${id}/save`, { method: "POST" }),
  unsave: (id: string) => apiFetch(`/reels/${id}/save`, { method: "DELETE" }),

  view: (id: string, watched_secs: number) =>
    apiFetch(`/reels/${id}/view`, { method: "POST", body: JSON.stringify({ watched_secs }) }),

  getComments: (id: string) => apiFetch<any[]>(`/reels/${id}/comments`),
  addComment: (id: string, body: string, parent_id?: string) =>
    apiFetch(`/reels/${id}/comments`, { method: "POST", body: JSON.stringify({ body, parent_id: parent_id ?? null }) }),
  deleteComment: (commentId: string) =>
    apiFetch(`/reels/comments/${commentId}`, { method: "DELETE" }),
  likeComment: (commentId: string) =>
    apiFetch(`/reels/comments/${commentId}/like`, { method: "POST" }),
  getReplies: (reelId: string, commentId: string) =>
    apiFetch<any[]>(`/reels/${reelId}/comments/${commentId}/replies`),
  delete: (id: string) => apiFetch(`/reels/${id}`, { method: "DELETE" }),
  saved: (cursor?: string) =>
    apiFetch<ReelFeedResponse>(`/reels/saved${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
  user: (userId: string, cursor?: string) =>
    apiFetch<ReelFeedResponse>(`/reels/user/${userId}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = {
  list: (limit = 30, before?: string) =>
    apiFetch<any[]>(`/notifications?limit=${limit}${before ? `&before=${before}` : ""}`),
  unreadCount: () =>
    apiFetch<{ unread_count: number }>("/notifications/unread-count"),
  readAll: () =>
    apiFetch("/notifications/read-all", { method: "PUT" }),
  readOne: (id: string) =>
    apiFetch(`/notifications/${id}/read`, { method: "PUT" }),
};

