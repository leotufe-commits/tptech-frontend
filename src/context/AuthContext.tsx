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

  // ✅ NUEVO: actualizar joyería en memoria (sin /auth/me)
  setJewelryLocal: (next: Jewelry | null) => void;
  patchJewelryLocal: (partial: Partial<Jewelry>) => void;

  // ✅ ahora acepta force + silent
  refreshMe: (opts?: { force?: boolean; silent?: boolean }) => Promise<void>;
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
    refreshPromiseRef.current = null;
    resetStateOnly();
  };

  /* -------------------------
     Session helpers (con eventos)
  ------------------------- */
  const clearSession = () => {
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

    try {
      localStorage.setItem(
        LS_AUTH_EVENT_KEY,
        JSON.stringify({ type: "LOGIN", at: Date.now() } satisfies AuthEvent)
      );
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
      localStorage.setItem(
        LS_AUTH_EVENT_KEY,
        JSON.stringify({ type: "LOGIN", at: Date.now() } satisfies AuthEvent)
      );
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel("tptech_auth");
        bc.postMessage({ type: "LOGIN", at: Date.now() } satisfies AuthEvent);
        bc.close();
      }
    } catch {}
  };

  // ✅ NUEVO: actualización inmediata del estado de joyería en memoria
  const setJewelryLocal = (next: Jewelry | null) => {
    setJewelry(next ?? null);
  };

  // ✅ NUEVO: patch seguro (útil para logoUrl)
  const patchJewelryLocal = (partial: Partial<Jewelry>) => {
    setJewelry((prev) => ({ ...(prev ?? {}), ...(partial ?? {}) }));
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
     /auth/me loader (anti-spam + force)
  ------------------------- */
  const refreshMe = async (opts?: { force?: boolean; silent?: boolean }) => {
    const currentToken = readStoredToken();

    if (!currentToken) {
      clearSession();
      return;
    }

    const force = Boolean(opts?.force);
    const silent = Boolean(opts?.silent);

    // ✅ si no es force, mantenemos el cache anti-spam
    if (!force && lastTokenLoadedRef.current === currentToken && user) {
      setLoading(false);
      return;
    }

    // single-flight
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    // ✅ si ya tengo data y es silent, no hagas “pantalla cargando”
    if (!silent) setLoading(true);

    const p = (async () => {
      try {
        // ✅ cache-bust real + GET no-store
        const bust = force ? `?__t=${Date.now()}` : "";
        const data = await apiFetch<MeResponse>(`/auth/me${bust}`, {
          method: "GET",
          cache: "no-store",
        });

        lastTokenLoadedRef.current = currentToken;

        setUser(data.user ?? null);
        setJewelry(data.jewelry ?? null);
        setRoles(data.roles ?? []);
        setPermissions(data.permissions ?? []);
      } catch {
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
  ------------------------- */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_TOKEN_KEY) {
        const newToken = readStoredToken();
        setToken(newToken);

        if (!newToken) {
          resetStateAndCancelInFlight();
        } else {
          refreshMe({ force: true }).catch(() => {});
        }
      }

      if (e.key === LS_LOGOUT_KEY) {
        resetStateAndCancelInFlight();
      }

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
            refreshMe({ force: true }).catch(() => {});
          }
        } catch {}
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
        resetStateAndCancelInFlight();
        return;
      }

      if (ev.type === "LOGIN") {
        const newToken = readStoredToken();
        setToken(newToken);
        refreshMe({ force: true }).catch(() => {});
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

      // ✅ NUEVO
      setJewelryLocal,
      patchJewelryLocal,

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
