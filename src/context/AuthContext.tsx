// FRONTEND
// tptech-frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

/* =========================
   TYPES
========================= */
export type User = { id: string; email: string; name?: string | null };
export type Jewelry = any;

type AuthState = {
  token: string | null;
  user: User | null;
  jewelry: Jewelry | null;
  loading: boolean;

  // ✅ nuevo: para casos como Login.tsx (guardar token y disparar sync en la misma pestaña)
  setTokenOnly: (token: string | null) => void;

  setSession: (payload: { token: string; user: User; jewelry?: Jewelry | null }) => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;

  clearSession: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/* =========================
   STORAGE KEYS
========================= */
const LS_TOKEN_KEY = "tptech_token";
const LS_LOGOUT_KEY = "tptech_logout";
const LS_AUTH_EVENT_KEY = "tptech_auth_event";

function emitAuthEvent(type: "LOGIN" | "LOGOUT") {
  localStorage.setItem(LS_AUTH_EVENT_KEY, JSON.stringify({ type, at: Date.now() }));
}

function clearStoredSession() {
  localStorage.removeItem(LS_TOKEN_KEY);
  localStorage.setItem(LS_LOGOUT_KEY, String(Date.now()));
  emitAuthEvent("LOGOUT");
}

/* =========================
   PROVIDER
========================= */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(LS_TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [jewelry, setJewelry] = useState<Jewelry | null>(null);
  const [loading, setLoading] = useState(true);

  /* -------------------------
     Multi-tab sync (storage)
  ------------------------- */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_TOKEN_KEY) {
        const newToken = localStorage.getItem(LS_TOKEN_KEY);
        setToken(newToken);
        if (!newToken) {
          setUser(null);
          setJewelry(null);
        }
      }

      if (e.key === LS_LOGOUT_KEY) {
        setToken(null);
        setUser(null);
        setJewelry(null);
      }

      if (e.key === LS_AUTH_EVENT_KEY && e.newValue) {
        try {
          const ev = JSON.parse(e.newValue);
          if (ev?.type === "LOGOUT") {
            setToken(null);
            setUser(null);
            setJewelry(null);
          }
          if (ev?.type === "LOGIN") {
            const newToken = localStorage.getItem(LS_TOKEN_KEY);
            setToken(newToken);
          }
        } catch {}
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* -------------------------
     Multi-tab sync (BroadcastChannel)
  ------------------------- */
  useEffect(() => {
    const bc = "BroadcastChannel" in window ? new BroadcastChannel("tptech_auth") : null;
    if (!bc) return;

    bc.onmessage = (ev) => {
      if (ev.data?.type === "LOGOUT") {
        setToken(null);
        setUser(null);
        setJewelry(null);
      }
      if (ev.data?.type === "LOGIN") {
        const newToken = localStorage.getItem(LS_TOKEN_KEY);
        setToken(newToken);
      }
    };

    return () => bc.close();
  }, []);

  function broadcast(type: "LOGIN" | "LOGOUT") {
    if (!("BroadcastChannel" in window)) return;
    const bc = new BroadcastChannel("tptech_auth");
    bc.postMessage({ type });
    bc.close();
  }

  /* -------------------------
     Session helpers
  ------------------------- */
  const clearSession = () => {
    clearStoredSession();
    setToken(null);
    setUser(null);
    setJewelry(null);
    broadcast("LOGOUT");
  };

  // ✅ nuevo: actualiza token en ESTA pestaña + notifica otras
  const setTokenOnly = (newToken: string | null) => {
    if (!newToken) {
      clearSession();
      return;
    }

    localStorage.setItem(LS_TOKEN_KEY, newToken);
    setToken(newToken);

    emitAuthEvent("LOGIN");
    broadcast("LOGIN");
  };

  const setSession = (payload: { token: string; user: User; jewelry?: Jewelry | null }) => {
    localStorage.setItem(LS_TOKEN_KEY, payload.token);
    setToken(payload.token);
    setUser(payload.user);
    setJewelry(payload.jewelry ?? null);

    emitAuthEvent("LOGIN");
    broadcast("LOGIN");
  };

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {}
    clearSession();
  };

  /* -------------------------
     /me loader
     ✅ apiFetch devuelve JSON o lanza Error
  ------------------------- */
  const refreshMe = async () => {
    const currentToken = localStorage.getItem(LS_TOKEN_KEY);

    if (!currentToken) {
      setUser(null);
      setJewelry(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch<{ user: User; jewelry?: Jewelry | null }>("/auth/me", {
        method: "GET",
      });

      setUser(data.user);
      setJewelry(data.jewelry ?? null);
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      jewelry,
      loading,
      setTokenOnly,
      setSession,
      refreshMe,
      logout,
      clearSession,
    }),
    [token, user, jewelry, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* =========================
   HOOK
========================= */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
