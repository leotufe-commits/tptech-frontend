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

export type Jewelry = Record<string, any>;
export type Role = { id: string; name: string; isSystem?: boolean };

export type MeResponse = {
  user: User;
  jewelry?: Jewelry | null;
  roles?: Role[];
  permissions?: string[];
  favoriteWarehouse?: any | null;

  // legacy / compat (si backend lo manda)
  token?: string;
  accessToken?: string;
};

type AuthEvent = { type: "LOGIN" | "LOGOUT"; at: number };

/* =========================
   PIN / QUICK SWITCH TYPES
========================= */
export type QuickUser = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;

  /** ✅ modelo pro */
  hasQuickPin: boolean;  // existe pin guardado (sin exponer hash)
  pinEnabled: boolean;   // permitido usar PIN
};

type QuickUsersResponse = { enabled: boolean; users: QuickUser[] };

/* =========================
   LOCK SETTINGS (frontend local)
========================= */
const LS_LOCK_TIMEOUT_MIN = "tptech_lock_timeout_min";
const LS_LOCK_ENABLED = "tptech_lock_enabled";

// defaults razonables para mostrador
const DEFAULT_LOCK_ENABLED = true;
const DEFAULT_LOCK_TIMEOUT_MIN = 5;

function readLockEnabled(): boolean {
  try {
    const v = localStorage.getItem(LS_LOCK_ENABLED);
    if (v === null) return DEFAULT_LOCK_ENABLED;
    return v === "1";
  } catch {
    return DEFAULT_LOCK_ENABLED;
  }
}

function readLockTimeoutMin(): number {
  try {
    const v = localStorage.getItem(LS_LOCK_TIMEOUT_MIN);
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_LOCK_TIMEOUT_MIN;
    return Math.max(1, Math.min(60, Math.floor(n)));
  } catch {
    return DEFAULT_LOCK_TIMEOUT_MIN;
  }
}

function writeLockEnabled(on: boolean) {
  try {
    localStorage.setItem(LS_LOCK_ENABLED, on ? "1" : "0");
  } catch {}
}

function writeLockTimeoutMin(n: number) {
  try {
    const safe = Math.max(1, Math.min(60, Math.floor(n)));
    localStorage.setItem(LS_LOCK_TIMEOUT_MIN, String(safe));
  } catch {}
}

export type AuthState = {
  token: string | null;

  user: User | null;
  jewelry: Jewelry | null;

  roles: Role[];
  permissions: string[];

  loading: boolean;

  // ✅ Lock screen (inactividad)
  locked: boolean;
  setLocked: (v: boolean) => void;

  // ✅ Config local (hasta que lo pasemos a DB)
  lockEnabled: boolean;
  lockTimeoutMinutes: number;
  setLockEnabledLocal: (v: boolean) => void;
  setLockTimeoutMinutesLocal: (minutes: number) => void;

  // ✅ Habilitado por empresa (desde endpoint PIN)
  quickSwitchEnabled: boolean;

  // PIN / quick switch calls
  pinSet: (pin4: string) => Promise<void>;
  pinDisable: (pin4: string) => Promise<void>;
  pinUnlock: (pin4: string) => Promise<void>;
  pinQuickUsers: () => Promise<QuickUsersResponse>;
  pinSwitchUser: (args: { targetUserId: string; pin4: string }) => Promise<void>;

  setTokenOnly: (token: string | null) => void;
  setSession: (payload: {
    token?: string | null;
    user: User;
    jewelry?: Jewelry | null;
    roles?: Role[];
    permissions?: string[];
  }) => void;

  setJewelryLocal: (next: Jewelry | null) => void;
  patchJewelryLocal: (partial: Partial<Jewelry>) => void;

  refreshMe: (opts?: { force?: boolean; silent?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/* =========================
   STORAGE HELPERS
========================= */
function readStoredToken() {
  try {
    const t = sessionStorage.getItem(SS_TOKEN_KEY);
    if (t) return t;
  } catch {}

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

function emitAuthEvent(ev: AuthEvent) {
  try {
    if (ev.type === "LOGOUT") localStorage.setItem(LS_LOGOUT_KEY, String(ev.at));
    localStorage.setItem(LS_AUTH_EVENT_KEY, JSON.stringify(ev));

    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("tptech_auth");
      bc.postMessage(ev);
      bc.close();
    }
  } catch {}
}

function assertPin4(pin: string) {
  const s = String(pin ?? "").trim();
  if (!/^\d{4}$/.test(s)) throw new Error("El PIN debe tener 4 dígitos.");
  return s;
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

  // ✅ lock screen
  const [locked, setLocked] = useState(false);

  // ✅ lock config local
  const [lockEnabled, setLockEnabled] = useState<boolean>(() => readLockEnabled());
  const [lockTimeoutMinutes, setLockTimeoutMinutes] = useState<number>(() =>
    readLockTimeoutMin()
  );

  // ✅ quick switch enabled (fuente real: /auth/me/pin/quick-users)
  const [quickSwitchEnabled, setQuickSwitchEnabled] = useState(false);

  const setLockEnabledLocal = (v: boolean) => {
    setLockEnabled(v);
    writeLockEnabled(v);
    if (!v) setLocked(false);
  };

  const setLockTimeoutMinutesLocal = (minutes: number) => {
    const safe = Math.max(1, Math.min(60, Math.floor(minutes)));
    setLockTimeoutMinutes(safe);
    writeLockTimeoutMin(safe);
  };

  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const lastSessionKeyLoadedRef = useRef<string | null>(null);

  const setTokenSafe = (next: string | null) => {
    setToken((prev) => (prev === next ? prev : next));
  };

  const resetStateOnly = () => {
    setTokenSafe(null);
    setUser(null);
    setJewelry(null);
    setRoles([]);
    setPermissions([]);
    setLocked(false);
    setLoading(false);
    setQuickSwitchEnabled(false);
    lastSessionKeyLoadedRef.current = null;
  };

  const resetStateAndCancelInFlight = () => {
    refreshPromiseRef.current = null;
    resetStateOnly();
  };

  const clearSession = () => {
    try {
      forceLogout();
    } catch {
      clearStoredTokenOnly();
      emitAuthEvent({ type: "LOGOUT", at: Date.now() });
    }
    resetStateAndCancelInFlight();
  };

  const setTokenOnly = (newToken: string | null) => {
    if (!newToken) {
      clearStoredTokenOnly();
      setTokenSafe(null);
    } else {
      storeTokenEverywhere(newToken);
      setTokenSafe(newToken);
    }
    emitAuthEvent({ type: "LOGIN", at: Date.now() });
  };

  const setSession = (payload: {
    token?: string | null;
    user: User;
    jewelry?: Jewelry | null;
    roles?: Role[];
    permissions?: string[];
  }) => {
    const t = payload.token ?? null;

    if (t) storeTokenEverywhere(t);
    setTokenSafe(t);

    setUser(payload.user);
    setJewelry(payload.jewelry ?? null);
    setRoles(payload.roles ?? []);
    setPermissions(payload.permissions ?? []);

    setLocked(false);
    lastSessionKeyLoadedRef.current = t || "cookie";

    emitAuthEvent({ type: "LOGIN", at: Date.now() });
  };

  const setJewelryLocal = (next: Jewelry | null) => setJewelry(next ?? null);

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

  const refreshMe = async (opts?: { force?: boolean; silent?: boolean }) => {
    const storedToken = readStoredToken();
    const sessionKey = storedToken || "cookie";

    const force = Boolean(opts?.force);
    const silent = Boolean(opts?.silent);

    if (!force && lastSessionKeyLoadedRef.current === sessionKey && user) {
      setLoading(false);
      return;
    }

    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    if (!silent) setLoading(true);

    const p = (async () => {
      try {
        const bust = force ? `?__t=${Date.now()}` : "";
        const data = await apiFetch<MeResponse>(`/auth/me${bust}`, {
          method: "GET",
          cache: "no-store",
        });

        const backendToken = data.accessToken || data.token || null;
        if (backendToken) {
          storeTokenEverywhere(backendToken);
          setTokenSafe(backendToken);
          lastSessionKeyLoadedRef.current = backendToken;
        } else {
          lastSessionKeyLoadedRef.current = storedToken || "cookie";
        }

        setUser(data.user ?? null);
        setJewelry(data.jewelry ?? null);
        setRoles(data.roles ?? []);
        setPermissions(data.permissions ?? []);

        // ✅ traer quickSwitchEnabled real (silencioso)
        try {
          const q = await apiFetch<QuickUsersResponse>("/auth/me/pin/quick-users", {
            method: "GET",
            cache: "no-store",
            timeoutMs: 8000,
          });
          setQuickSwitchEnabled(Boolean(q?.enabled));
        } catch {
          setQuickSwitchEnabled(false);
        }
      } catch (err: any) {
        console.warn("[Auth] refreshMe falló; se mantiene la sesión:", err);
      } finally {
        setLoading(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = p;
    return p;
  };

  /* =========================
     PIN / QUICK SWITCH CALLS
     (Auth endpoints: unlock/switch/list)
  ========================= */
  const pinSet = async (pin4: string) => {
    const clean = assertPin4(pin4);
    await apiFetch("/auth/me/pin/set", { method: "POST", body: { pin: clean } });
    await refreshMe({ force: true, silent: true });
  };

  const pinDisable = async (pin4: string) => {
    const clean = assertPin4(pin4);
    await apiFetch("/auth/me/pin/disable", { method: "POST", body: { pin: clean } });
    await refreshMe({ force: true, silent: true });
  };

  const pinUnlock = async (pin4: string) => {
    const clean = assertPin4(pin4);
    await apiFetch("/auth/me/pin/unlock", { method: "POST", body: { pin: clean } });
    setLocked(false);
  };

  const pinQuickUsers = async (): Promise<QuickUsersResponse> => {
    const data = await apiFetch<any>("/auth/me/pin/quick-users", {
      method: "GET",
      cache: "no-store",
    });

    const enabled = Boolean(data?.enabled);
    setQuickSwitchEnabled(enabled);

    const users: QuickUser[] = Array.isArray(data?.users)
      ? data.users.map((u: any) => {
          const hasQuickPin = Boolean(u.hasQuickPin ?? u.hasPin ?? u.hasQuick ?? false);
          const pinEnabled = Boolean(u.pinEnabled ?? (u.hasPin ?? false)); // compat
          return {
            id: String(u.id),
            email: String(u.email),
            name: u.name ?? null,
            avatarUrl: u.avatarUrl ?? null,
            hasQuickPin,
            pinEnabled,
          };
        })
      : [];

    return { enabled, users };
  };

  const pinSwitchUser = async (args: { targetUserId: string; pin4: string }) => {
    const clean = assertPin4(args.pin4);

    const data = await apiFetch<MeResponse>("/auth/me/pin/switch", {
      method: "POST",
      body: { targetUserId: args.targetUserId, pin: clean },
    });

    setSession({
      token: data.accessToken || data.token || null,
      user: data.user,
      jewelry: data.jewelry ?? null,
      roles: data.roles ?? [],
      permissions: data.permissions ?? [],
    });
  };

  /* -------------------------
     Auto-lock por inactividad
  ------------------------- */
  const lastActivityRef = useRef<number>(Date.now());
  const lockTimerRef = useRef<number | null>(null);

  const bumpActivity = () => {
    lastActivityRef.current = Date.now();
  };

  useEffect(() => {
    if (!user) return;

    if (!lockEnabled) {
      setLocked(false);
      return;
    }

    const onAny = () => bumpActivity();

    window.addEventListener("mousemove", onAny, { passive: true });
    window.addEventListener("mousedown", onAny, { passive: true });
    window.addEventListener("keydown", onAny);
    window.addEventListener("touchstart", onAny, { passive: true });
    window.addEventListener("scroll", onAny, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onAny);
      window.removeEventListener("mousedown", onAny);
      window.removeEventListener("keydown", onAny);
      window.removeEventListener("touchstart", onAny);
      window.removeEventListener("scroll", onAny);
    };
  }, [user, lockEnabled]);

  useEffect(() => {
    if (lockTimerRef.current) window.clearInterval(lockTimerRef.current);
    lockTimerRef.current = null;

    if (!user) return;
    if (!lockEnabled) return;

    const interval = window.setInterval(() => {
      if (!user) return;
      if (!lockEnabled) return;
      if (locked) return;

      const idleMs = Date.now() - lastActivityRef.current;
      const limitMs = lockTimeoutMinutes * 60 * 1000;

      if (idleMs >= limitMs) {
        setLocked(true);
      }
    }, 1000);

    lockTimerRef.current = interval;

    return () => {
      if (lockTimerRef.current) window.clearInterval(lockTimerRef.current);
      lockTimerRef.current = null;
    };
  }, [user, lockEnabled, lockTimeoutMinutes, locked]);

  /* -------------------------
     Multi-tab sync (storage)
  ------------------------- */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_TOKEN_KEY) {
        const newToken = readStoredToken();
        setTokenSafe(newToken);
        refreshMe({ force: true, silent: true }).catch(() => {});
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
            setTokenSafe(newToken);
            refreshMe({ force: true, silent: true }).catch(() => {});
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
        setTokenSafe(newToken);
        refreshMe({ force: true, silent: true }).catch(() => {});
      }
    };

    return () => bc.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------
     BOOTSTRAP
  ------------------------- */
  useEffect(() => {
    refreshMe({ force: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      jewelry,
      roles,
      permissions,
      loading,

      locked,
      setLocked,

      lockEnabled,
      lockTimeoutMinutes,
      setLockEnabledLocal,
      setLockTimeoutMinutesLocal,

      quickSwitchEnabled,

      pinSet,
      pinDisable,
      pinUnlock,
      pinQuickUsers,
      pinSwitchUser,

      setTokenOnly,
      setSession,
      setJewelryLocal,
      patchJewelryLocal,
      refreshMe,
      logout,
      clearSession,
    }),
    [
      token,
      user,
      jewelry,
      roles,
      permissions,
      loading,
      locked,
      lockEnabled,
      lockTimeoutMinutes,
      quickSwitchEnabled,
    ]
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
