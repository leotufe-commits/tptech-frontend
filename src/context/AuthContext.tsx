// tptech-frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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

/* =========================
   HELPERS (single source of truth for auth events)
========================= */
type AuthEvent = { type: "LOGIN" | "LOGOUT"; at: number };

function emitAuthEvent(ev: AuthEvent) {
  try {
    // Evento unificado
    localStorage.setItem(LS_AUTH_EVENT_KEY, JSON.stringify(ev));
    // Legacy para forzar storage event “simple” en otras pestañas
    if (ev.type === "LOGOUT") localStorage.setItem(LS_LOGOUT_KEY, String(ev.at));

    // BroadcastChannel (si existe)
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("tptech_auth");
      bc.postMessage(ev);
      bc.close();
    }
  } catch {
    // no romper si localStorage está bloqueado
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(LS_TOKEN_KEY);
  } catch {}
  emitAuthEvent({ type: "LOGOUT", at: Date.now() });
}

function readStoredToken() {
  try {
    return localStorage.getItem(LS_TOKEN_KEY);
  } catch {
    return null;
  }
}

/* =========================
   PROVIDER
========================= */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [jewelry, setJewelry] = useState<Jewelry | null>(null);
  const [loading, setLoading] = useState(true);

  // evita spam /me (solo 1 request activa)
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const lastTokenLoadedRef = useRef<string | null>(null);

  /* -------------------------
     Multi-tab sync (storage)
  ------------------------- */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_TOKEN_KEY) {
        const newToken = readStoredToken();
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
          const ev = JSON.parse(e.newValue) as AuthEvent;
          if (ev?.type === "LOGOUT") {
            setToken(null);
            setUser(null);
            setJewelry(null);
          }
          if (ev?.type === "LOGIN") {
            const newToken = readStoredToken();
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
    if (!("BroadcastChannel" in window)) return;

    const bc = new BroadcastChannel("tptech_auth");
    bc.onmessage = (msg) => {
      const ev = msg.data as AuthEvent | undefined;
      if (ev?.type === "LOGOUT") {
        setToken(null);
        setUser(null);
        setJewelry(null);
      }
      if (ev?.type === "LOGIN") {
        const newToken = readStoredToken();
        setToken(newToken);
      }
    };

    return () => bc.close();
  }, []);

  /* -------------------------
     Session helpers
  ------------------------- */
  const clearSession = () => {
    // una sola vez (no duplicar broadcast acá)
    clearStoredSession();
    setToken(null);
    setUser(null);
    setJewelry(null);
    setLoading(false);
  };

  // ✅ nuevo: actualiza token en ESTA pestaña + notifica otras
  const setTokenOnly = (newToken: string | null) => {
    if (!newToken) {
      clearSession();
      return;
    }

    try {
      localStorage.setItem(LS_TOKEN_KEY, newToken);
    } catch {}

    setToken(newToken);
    emitAuthEvent({ type: "LOGIN", at: Date.now() });
  };

  const setSession = (payload: { token: string; user: User; jewelry?: Jewelry | null }) => {
    try {
      localStorage.setItem(LS_TOKEN_KEY, payload.token);
    } catch {}

    setToken(payload.token);
    setUser(payload.user);
    setJewelry(payload.jewelry ?? null);

    emitAuthEvent({ type: "LOGIN", at: Date.now() });
  };

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {}
    clearSession();
  };

  /* -------------------------
     /me loader (anti-spam)
  ------------------------- */
  const refreshMe = async () => {
    const currentToken = readStoredToken();

    // sin token -> estado “logged out”
    if (!currentToken) {
      lastTokenLoadedRef.current = null;
      setUser(null);
      setJewelry(null);
      setLoading(false);
      return;
    }

    // si ya cargamos /me para este mismo token, no repitas
    if (lastTokenLoadedRef.current === currentToken && user) {
      setLoading(false);
      return;
    }

    // si ya hay un refresh en curso, reusalo
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    setLoading(true);

    const p = (async () => {
      try {
        const data = await apiFetch<{ user: User; jewelry?: Jewelry | null }>("/auth/me", {
          method: "GET",
        });

        lastTokenLoadedRef.current = currentToken;
        setUser(data.user);
        setJewelry(data.jewelry ?? null);
      } catch {
        // si falla /me => sesión inválida
        clearSession();
      } finally {
        setLoading(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = p;
    return p;
  };

  // ✅ solo reacciona a cambios reales del token
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
