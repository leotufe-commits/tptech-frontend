// tptech-frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  apiFetch,
  LS_TOKEN_KEY,
  SS_TOKEN_KEY,
  LS_LOGOUT_KEY,
  LS_AUTH_EVENT_KEY,
  forceLogout,
} from "../lib/api";

/* =========================
   TYPES
========================= */
export type User = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  // updatedAt?: string;
};

export type Jewelry = any;

export type Role = { id: string; name: string; isSystem?: boolean };

export type MeResponse = {
  user: User;
  jewelry?: Jewelry | null;
  roles?: Role[];
  permissions?: string[];
  favoriteWarehouse?: any | null;
  token?: string; // legacy
  accessToken?: string; // nuevo estándar si backend lo manda
};

type AuthEvent = { type: "LOGIN" | "LOGOUT"; at: number };

export type AuthState = {
  token: string | null;
  user: User | null;
  jewelry: Jewelry | null;

  roles: Role[];
  permissions: string[];

  loading: boolean;

  setTokenOnly: (token: string | null) => void;
  setSession: (payload: {
    token: string;
    user: User;
    jewelry?: Jewelry | null;
    roles?: Role[];
    permissions?: string[];
  }) => void;

  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/* =========================
   STORAGE HELPERS
========================= */
function readStoredToken() {
  // 1) DEV: sessionStorage (prioridad)
  try {
    const t = sessionStorage.getItem(SS_TOKEN_KEY);
    if (t) return t;
  } catch {}

  // 2) legacy / multi-tab: localStorage
  try {
    const t = localStorage.getItem(LS_TOKEN_KEY);
    if (t) return t;
  } catch {}

  return null;
}

function clearStoredTokenOnly() {
  try {
    sessionStorage.removeItem(SS_TOKEN_KEY);
  } catch {}

  try {
    localStorage.removeItem(LS_TOKEN_KEY);
  } catch {}
}

function storeTokenEverywhere(token: string) {
  try {
    sessionStorage.setItem(SS_TOKEN_KEY, token);
  } catch {}

  try {
    localStorage.setItem(LS_TOKEN_KEY, token);
  } catch {}
}

/* =========================
   PROVIDER
========================= */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [jewelry, setJewelry] = useState<Jewelry | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);

  // evita spam de /auth/me (single-flight)
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  // para evitar re-cargar /me si ya lo cargamos con el mismo token
  const lastTokenLoadedRef = useRef<string | null>(null);

  /* -------------------------
     Helpers internos
  ------------------------- */
  const resetStateOnly = () => {
    setToken(null);
    setUser(null);
    setJewelry(null);
    setRoles([]);
    setPermissions([]);
    setLoading(false);
    lastTokenLoadedRef.current = null;
  };

  const resetStateAndCancelInFlight = () => {
    // no podemos cancelar fetch, pero limpiamos el "single-flight"
    refreshPromiseRef.current = null;
    resetStateOnly();
  };

  /* -------------------------
     Session helpers (con eventos)
  ------------------------- */
  const clearSession = () => {
    // ✅ fuerza logout global (multi-tab) y limpia storages
    // forceLogout() YA emite eventos (storage + broadcast)
    try {
      forceLogout();
    } catch {
      clearStoredTokenOnly();
    }

    resetStateAndCancelInFlight();
  };

  const setTokenOnly = (newToken: string | null) => {
    if (!newToken) {
      clearSession();
      return;
    }

    storeTokenEverywhere(newToken);
    setToken(newToken);

    // ✅ emitimos LOGIN usando el mismo mecanismo que el resto:
    // guardando en localStorage dispara "storage" en otras tabs.
    // (api.ts no tiene "forceLogin", así que lo hacemos aquí simple)
    try {
      localStorage.setItem(LS_AUTH_EVENT_KEY, JSON.stringify({ type: "LOGIN", at: Date.now() } satisfies AuthEvent));
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel("tptech_auth");
        bc.postMessage({ type: "LOGIN", at: Date.now() } satisfies AuthEvent);
        bc.close();
      }
    } catch {}
  };

  const setSession = (payload: {
    token: string;
    user: User;
    jewelry?: Jewelry | null;
    roles?: Role[];
    permissions?: string[];
  }) => {
    storeTokenEverywhere(payload.token);

    setToken(payload.token);
    setUser(payload.user);
    setJewelry(payload.jewelry ?? null);
    setRoles(payload.roles ?? []);
    setPermissions(payload.permissions ?? []);

    lastTokenLoadedRef.current = payload.token;

    try {
      localStorage.setItem(LS_AUTH_EVENT_KEY, JSON.stringify({ type: "LOGIN", at: Date.now() } satisfies AuthEvent));
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel("tptech_auth");
        bc.postMessage({ type: "LOGIN", at: Date.now() } satisfies AuthEvent);
        bc.close();
      }
    } catch {}
  };

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      clearSession();
    }
  };

  /* -------------------------
     /auth/me loader (anti-spam)
  ------------------------- */
  const refreshMe = async () => {
    const currentToken = readStoredToken();

    if (!currentToken) {
      clearSession();
      return;
    }

    // si ya cargamos /me para este token y tenemos user => no re-spamear
    if (lastTokenLoadedRef.current === currentToken && user) {
      setLoading(false);
      return;
    }

    // single-flight
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    setLoading(true);

    const p = (async () => {
      try {
        const data = await apiFetch<MeResponse>("/auth/me", { method: "GET" });

        lastTokenLoadedRef.current = currentToken;

        setUser(data.user ?? null);
        setJewelry(data.jewelry ?? null);
        setRoles(data.roles ?? []);
        setPermissions(data.permissions ?? []);
      } catch {
        // si falla (401) apiFetch ya hace forceLogout()
        clearSession();
      } finally {
        setLoading(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = p;
    return p;
  };

  /* -------------------------
     Multi-tab sync (storage events)
     (IMPORTANTE: acá NO emitimos eventos, solo reflejamos estado)
  ------------------------- */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // token cambiado (otra pestaña)
      if (e.key === LS_TOKEN_KEY) {
        const newToken = readStoredToken();
        setToken(newToken);

        if (!newToken) {
          resetStateAndCancelInFlight();
        } else {
          refreshMe().catch(() => {});
        }
      }

      // legacy logout (por compatibilidad)
      if (e.key === LS_LOGOUT_KEY) {
        resetStateAndCancelInFlight();
      }

      // evento unificado
      if (e.key === LS_AUTH_EVENT_KEY && e.newValue) {
        try {
          const ev = JSON.parse(e.newValue) as AuthEvent;

          if (ev?.type === "LOGOUT") {
            resetStateAndCancelInFlight();
            return;
          }

          if (ev?.type === "LOGIN") {
            const newToken = readStoredToken();
            setToken(newToken);
            refreshMe().catch(() => {});
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------
     Multi-tab sync (BroadcastChannel)
     (IMPORTANTE: acá NO emitimos eventos, solo reflejamos estado)
  ------------------------- */
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;

    const bc = new BroadcastChannel("tptech_auth");
    bc.onmessage = (msg) => {
      const ev = msg.data as AuthEvent | undefined;
      if (!ev?.type) return;

      if (ev.type === "LOGOUT") {
        resetStateAndCancelInFlight();
        return;
      }

      if (ev.type === "LOGIN") {
        const newToken = readStoredToken();
        setToken(newToken);
        refreshMe().catch(() => {});
      }
    };

    return () => bc.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // bootstrap al montar y cuando cambia token
  useEffect(() => {
    refreshMe().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      jewelry,
      roles,
      permissions,
      loading,
      setTokenOnly,
      setSession,
      refreshMe,
      logout,
      clearSession,
    }),
    [token, user, jewelry, roles, permissions, loading]
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
