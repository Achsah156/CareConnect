"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { User } from "./api";

interface AuthContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  setUser: () => {},
  loading: true,
});

const STORAGE_KEY = "pathparallel_user";

/**
 * The JWT itself lives in an httpOnly cookie we deliberately can't read
 * from JS (that's the whole point — XSS protection). This context just
 * tracks *who's currently logged in* for UI purposes, persisted to
 * sessionStorage so a page refresh doesn't flash a logged-out state.
 *
 * This is NOT the source of auth truth — the cookie is. If the cookie
 * expires, API calls will start 401ing and the relevant page should
 * redirect to /login; this context is just for rendering "Hi, Name".
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUserState(JSON.parse(stored));
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const setUser = (next: User | null) => {
    setUserState(next);
    if (next) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
