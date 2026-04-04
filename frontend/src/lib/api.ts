/**
 * Thin wrapper over fetch. All requests go through Vite's proxy at /api.
 * JWT tokens are stored in httpOnly cookies (secure, sameSite=lax).
 * CSRF protection via double-submit cookie pattern.
 */

const BASE = "/api/v1";

let csrfToken: string | null = null;
let csrfInitialized = false;

/**
 * Fetch CSRF token from backend and store in memory.
 * Call this once on app initialization.
 */
export async function initCSRF(): Promise<void> {
  if (csrfInitialized) return;
  
  try {
    const res = await fetch(`${BASE}/auth/csrf`, {
      method: "GET",
      credentials: "include",  // Include cookies
    });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrf_token;
      csrfInitialized = true;
    }
  } catch (err) {
    console.error("Failed to fetch CSRF token:", err);
  }
}

/**
 * Get CSRF token for headers.
 */
function getCSRFToken(): string | null {
  return csrfToken;
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",  // Send refresh token cookie
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": getCSRFToken() || "",
      },
    });
    if (!res.ok) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string,string>),
  };
  
  // Don't set Content-Type for FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add CSRF token for state-changing requests
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const csrf = getCSRFToken();
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }
  }

  let res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",  // Include auth cookies
  });

  // Handle 401 - try to refresh token
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(`${BASE}${path}`, {
        ...options,
        headers,
        credentials: "include",
      });
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
  deleteAccount: () => apiFetch("/auth/delete-account", { method: "DELETE" }),
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

// ── Posts ────────────────────────────────────────────────────────────────────
export const posts = {
  feed: (cursor?: string) =>
    apiFetch(`/posts/feed/discover${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
  unifiedFeed: (feedType: "for_you" | "following" = "for_you", cursor?: string) =>
    apiFetch(`/posts/feed/unified?feed_type=${feedType}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
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
  likes: (id: string, cursor?: number) =>
    apiFetch(`/posts/${id}/likes${cursor ? `?cursor=${cursor}` : ""}`),
};

// ── Stories ───────────────────────────────────────────────────────────────────
export const stories = {
  feed: () => apiFetch("/stories/feed"),
  create: (form: FormData) =>
    apiFetch("/stories", { method: "POST", body: form }),
};

// ── Users ────────────────────────────────────────────────────────────────────
export const users = {
  profile: (username: string) => apiFetch(`/users/${username}`),
  updateProfile: (data: any) => apiFetch('/users/me/profile', { method: 'PUT', body: JSON.stringify(data) }),
  /** Backend toggles follow on POST (no separate DELETE route). For private accounts, returns {pending: true} */
  follow: (username: string) =>
    apiFetch(`/users/${username}/follow`, { method: "POST" }),
  unfollow: (username: string) =>
    apiFetch(`/users/${username}/follow`, { method: "POST" }),
  block: (username: string) =>
    apiFetch(`/users/${username}/block`, { method: "POST" }),
  unblock: (username: string) =>
    apiFetch(`/users/${username}/block`, { method: "POST" }),
  getFollowRequests: () => apiFetch(`/users/requests`),
  getSentRequests: () => apiFetch(`/users/requests/sent`),
  cancelFollowRequest: (requestId: number) => apiFetch(`/users/requests/${requestId}`, { method: "DELETE" }),
  getBlockedUsers: () => apiFetch(`/users/blocked`),
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
  between: (from: string, to: string, date?: string, allDays?: boolean) => {
    const p = new URLSearchParams({ from_code: from, to_code: to });
    if (date) p.set("date", date);
    if (allDays) p.set("all_days", "true");
    return apiFetch(`/trains/between?${p.toString()}`);
  },
  get: (trainNo: string) => apiFetch(`/trains/${trainNo}`),
  livePosition: (trainNo: string, startDate?: string) =>
    apiFetch(`/trains/${trainNo}/live${startDate ? `?journey_date=${encodeURIComponent(startDate)}` : ""}`),
  trackHistory: (trainNo: string) =>
    apiFetch(`/trains/${trainNo}/track`),
  schedule: (trainNo: string) =>
    apiFetch(`/trains/${trainNo}/schedule`),
};

// ── Stations ──────────────────────────────────────────────────────────────────
export const stations = {
  search: (q: string) =>
    apiFetch(`/stations/search?q=${encodeURIComponent(q)}`),
  board: (code: string) =>
    apiFetch(`/stations/${encodeURIComponent(code)}/board?limit=200`),
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
  get: (id: string) => apiFetch<any>(`/reels/${id}`),

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
  unlike: (id: string) => apiFetch(`/reels/${id}/like`, { method: "POST" }),

  save: (id: string) => apiFetch(`/reels/${id}/save`, { method: "POST" }),
  unsave: (id: string) => apiFetch(`/reels/${id}/save`, { method: "POST" }),

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
  likes: (id: string, cursor?: number) =>
    apiFetch(`/reels/${id}/likes${cursor ? `?cursor=${cursor}` : ""}`),
  saved: (cursor?: string) =>
    apiFetch<ReelFeedResponse>(`/reels/saved${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
  user: (userId: string, cursor?: string) =>
    apiFetch<ReelFeedResponse>(`/reels/user/${userId}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reports = {
  create: (data: { post_id?: string; reel_id?: string; reason: string; details?: string }) =>
    apiFetch("/reports", { method: "POST", body: JSON.stringify(data) }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const admin = {
  stats: () => apiFetch<any>("/admin/stats"),
  users: (params?: { page?: number; search?: string; is_active?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.search) q.set("search", params.search);
    if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
    return apiFetch<any>(`/admin/users?${q}`);
  },
  banUser: (id: string) => apiFetch(`/admin/users/${id}/ban`, { method: "PUT" }),
  unbanUser: (id: string) => apiFetch(`/admin/users/${id}/unban`, { method: "PUT" }),
  verifyUser: (id: string) => apiFetch(`/admin/users/${id}/verify`, { method: "PUT" }),
  unverifyUser: (id: string) => apiFetch(`/admin/users/${id}/unverify`, { method: "PUT" }),
  deleteUser: (id: string) => apiFetch(`/admin/users/${id}`, { method: "DELETE" }),
  updateKarma: (id: string, delta: number) =>
    apiFetch(`/admin/users/${id}/karma`, { method: "PUT", body: JSON.stringify({ delta }) }),
  deletePost: (id: string) => apiFetch(`/admin/posts/${id}`, { method: "DELETE" }),
  deleteReel: (id: string) => apiFetch(`/admin/reels/${id}`, { method: "DELETE" }),
  reports: (params?: { page?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.status) q.set("status", params.status);
    return apiFetch<any>(`/admin/reports?${q}`);
  },
  updateReport: (id: string, data: { status: string; admin_note?: string }) =>
    apiFetch(`/admin/reports/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  broadcast: (message: string) =>
    apiFetch("/admin/broadcast", { method: "POST", body: JSON.stringify({ message }) }),
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

