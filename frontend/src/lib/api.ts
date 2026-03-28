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
  get: (id: string) => apiFetch(`/posts/${id}`),
  create: (form: FormData) =>
    apiFetch("/posts", { method: "POST", body: form }),
  like: (id: string) => apiFetch(`/posts/${id}/like`, { method: "POST" }),
  unlike: (id: string) => apiFetch(`/posts/${id}/like`, { method: "DELETE" }),
  comments: (id: string) => apiFetch(`/posts/${id}/comments`),
  addComment: (id: string, body: string) =>
    apiFetch(`/posts/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
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
  follow: (username: string) =>
    apiFetch(`/users/${username}/follow`, { method: "POST" }),
  unfollow: (username: string) =>
    apiFetch(`/users/${username}/follow`, { method: "DELETE" }),
  posts: (username: string) => apiFetch(`/users/${username}/posts`),
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
