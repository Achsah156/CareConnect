/**
 * Thin fetch wrapper for the PathParallel API.
 *
 * Auth is handled via an httpOnly cookie set by the backend, so every
 * call here passes credentials: "include" rather than juggling tokens
 * client-side — the browser handles attaching/clearing the cookie.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type Stage = "just_started" | "in_it" | "turning_point" | "resolved";

export interface SituationUpdate {
  id: string;
  stage: Stage;
  body_text: string;
  created_at: string;
}

export interface Situation {
  id: string;
  user_id: string;
  situation_type: string;
  stage: Stage;
  body_text: string;
  is_anonymous: boolean;
  outcome_text: string | null;
  created_at: string;
  updated_at: string;
  updates: SituationUpdate[];
}

export interface MatchedSituation extends Situation {
  match_score: number;
  similarity: number;
  stage_proximity: number;
  outcome_boost: number;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response wasn't JSON; fall back to statusText
    }
    throw new ApiError(res.status, detail);
  }

  // Some endpoints (e.g. logout) return no body
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export const api = {
  signup: (email: string, password: string, display_name: string) =>
    request<User>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name }),
    }),

  login: (email: string, password: string) =>
    request<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  googleAuth: (code: string, redirect_uri: string) =>
    request<User>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ code, redirect_uri }),
    }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  createSituation: (payload: {
    situation_type: string;
    stage: Stage;
    body_text: string;
    is_anonymous?: boolean;
    outcome_text?: string;
  }) =>
    request<Situation>("/situations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getSituation: (id: string) => request<Situation>(`/situations/${id}`),

  addUpdate: (id: string, payload: { stage: Stage; body_text: string }) =>
    request<SituationUpdate>(`/situations/${id}/updates`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMatches: (id: string, top_k = 10) =>
    request<MatchedSituation[]>(`/situations/${id}/matches?top_k=${top_k}`),

  react: (id: string, reaction_type: "been_there" | "rooting_for_you") =>
    request<{ detail: string }>(`/situations/${id}/react?reaction_type=${reaction_type}`, {
      method: "POST",
    }),

  follow: (id: string) =>
    request<{ detail: string }>(`/situations/${id}/follow`, { method: "POST" }),

  unfollow: (id: string) =>
    request<{ detail: string }>(`/situations/${id}/follow`, { method: "DELETE" }),

  getFeed: (limit = 20) => request<Situation[]>(`/feed?limit=${limit}`),
};

export { ApiError };
