// tptech-frontend/src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
};

export type Jewelry = any;

export type Role = { id: string; name: string; isSystem?: boolean };

export type MeResponse = {
  user: User;
  jewelry?: Jewelry | null;
  roles?: Role[];
  permissions?: string[];
  favoriteWarehouse?: any | null;
  token?: string; // legacy si backend lo manda
  accessToken?: string; // nuevo estándar si backend lo manda
};

type AuthEvent = { type: "LOGIN" | "LOGOUT"; at: number };

type AuthState = {
  token: string | null;
  user: User | null;
  jewelry: Jewelry | null;

  roles: Role[];
  permissions: string[];

  loading: boolean;

  // setters controlados
  setTokenOnly: (token: string | null) => void;
  setSession: (payload: {
    token: string;
    user: User;
    jewelry?: Jewelry | null;
    roles?: Role[];
    permissions?: string[];
  }) => void;

  // acciones
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

/**
 * Emitimos un evento unificado (LOGIN/LOGOUT) para sincronizar pestañas.
 * (Además, mantenemos LS_LOGOUT_KEY como “legacy” por si algún lado lo escucha.)
 */
function emitAuthEvent(ev: AuthEvent) {
  try {
    // legacy: marca logout
    if (ev.type === "LOGOUT") localStorage.setItem(LS_LOGOUT_KEY, String(ev.at));

    // evento unificado
    localStorage.setItem(LS_AUTH_EVENT_KEY, JSON.stringify(ev));

    // BroadcastChannel (si existe)
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("tptech_auth");
      bc.postMessage(ev);
      bc.close();
    }
  } catch {
    // no romper si storage está bloqueado
  }
}

function clearStoredTokenOnly() {
  // borramos ambos (DEV + legacy)
  try {
    sessionStorage.removeItem(SS_TOKEN_KEY);
  } catch {}

  try {
    localStorage.removeItem(LS_TOKEN_KEY);
  } catch {}
}

function storeTokenEverywhere(token: string) {
  // ✅ DEV: sessionStorage
  try {
    sessionStorage.setItem(SS_TOKEN_KEY, token);
  } catch {}

  // ✅ legacy/multi-tab: localStorage
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
     Multi-tab sync (storage events)
  ------------------------- */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // si cambiaron token directo
      if (e.key === LS_TOKEN_KEY) {
        const newToken = readStoredToken();
        setToken(newToken);

        if (!newToken) {
          setUser(null);
          setJewelry(null);
          setRoles([]);
          setPermissions([]);
          setLoading(false);
        } else {
          // token nuevo => refrescar me
          refreshMe().catch(() => {});
        }
      }

      // legacy logout
      if (e.key === LS_LOGOUT_KEY) {
        setToken(null);
        setUser(null);
        setJewelry(null);
        setRoles([]);
        setPermissions([]);
        setLoading(false);
      }

      // evento unificado
      if (e.key === LS_AUTH_EVENT_KEY && e.newValue) {
        try {
          const ev = JSON.parse(e.newValue) as AuthEvent;

          if (ev?.type === "LOGOUT") {
            setToken(null);
            setUser(null);
            setJewelry(null);
            setRoles([]);
            setPermissions([]);
            setLoading(false);
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
  ------------------------- */
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;

    const bc = new BroadcastChannel("tptech_auth");
    bc.onmessage = (msg) => {
      const ev = msg.data as AuthEvent | undefined;
      if (!ev?.type) return;

      if (ev.type === "LOGOUT") {
        setToken(null);
        setUser(null);
        setJewelry(null);
        setRoles([]);
        setPermissions([]);
        setLoading(false);
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

  /* -------------------------
     Session helpers
  ------------------------- */
  const clearSession = () => {
    // ✅ esto limpia token + emite evento multi-tab desde api.ts
    // (pero igual emitimos un evento local por consistencia)
    try {
      forceLogout();
    } catch {
      clearStoredTokenOnly();
    }

    emitAuthEvent({ type: "LOGOUT", at: Date.now() });

    setToken(null);
    setUser(null);
    setJewelry(null);
    setRoles([]);
    setPermissions([]);
    setLoading(false);

    lastTokenLoadedRef.current = null;
  };

  const setTokenOnly = (newToken: string | null) => {
    if (!newToken) {
      clearSession();
      return;
    }

    // ✅ guardamos en sessionStorage (DEV) y localStorage (multi-tab)
    storeTokenEverywhere(newToken);

    setToken(newToken);
    emitAuthEvent({ type: "LOGIN", at: Date.now() });
  };

  const setSession = (payload: {
    token: string;
    user: User;
    jewelry?: Jewelry | null;
    roles?: Role[];
    permissions?: string[];
  }) => {
    // ✅ guardamos en sessionStorage (DEV) y localStorage (multi-tab)
    storeTokenEverywhere(payload.token);

    setToken(payload.token);
    setUser(payload.user);
    setJewelry(payload.jewelry ?? null);
    setRoles(payload.roles ?? []);
    setPermissions(payload.permissions ?? []);

    lastTokenLoadedRef.current = payload.token;

    emitAuthEvent({ type: "LOGIN", at: Date.now() });
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
        // si falla (401) apiFetch ya hace forceLogout(), pero igual limpiamos estado
        clearSession();
      } finally {
        setLoading(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = p;
    return p;
  };

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
