// tptech-frontend/src/context/AuthContext.tsx
import React, {
  createContext,
  useCallback,
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

import { applyAppFavicon, applyAuthFaviconOverrideLogo } from "./auth.favicon";
import {
  JEWELRY_LOGO_EVENT,
  readLogoFromEvent,
  USER_AVATAR_EVENT,
  readAvatarFromEvent,
  QUICK_SWITCH_OPEN_EVENT,
  emitOpenQuickSwitch,
  OPEN_PIN_FLOW_EVENT,
  emitOpenPinFlow,
  PIN_EVENT,
  readPinEvent,
} from "./auth.events";

export { USER_AVATAR_EVENT, QUICK_SWITCH_OPEN_EVENT, emitOpenQuickSwitch };

/* =========================
   DEV LOCK BYPASS
========================= */
const DEV = import.meta.env.DEV;

const SS_LOCK_BYPASS = "tptech_lock_bypass";
export function setDevLockBypass(on: boolean) {
  try {
    if (!DEV) return;
    if (on) sessionStorage.setItem(SS_LOCK_BYPASS, "1");
    else sessionStorage.removeItem(SS_LOCK_BYPASS);
  } catch {}
}

function hasDevLockBypass(): boolean {
  if (!DEV) return false;
  try {
    return sessionStorage.getItem(SS_LOCK_BYPASS) === "1";
  } catch {
    return false;
  }
}

function clearDevLockBypass() {
  try {
    if (!DEV) return;
    sessionStorage.removeItem(SS_LOCK_BYPASS);
  } catch {}
}

/* =========================
   LOCK PERSIST (F5 FIX)
========================= */
const SS_LOCKED = "tptech_locked";

function readLockedPersisted(): boolean {
  try {
    return sessionStorage.getItem(SS_LOCKED) === "1";
  } catch {
    return false;
  }
}

function writeLockedPersisted(v: boolean) {
  try {
    if (v) sessionStorage.setItem(SS_LOCKED, "1");
    else sessionStorage.removeItem(SS_LOCKED);
  } catch {
    // ignore
  }
}

function clearLockedPersisted() {
  try {
    sessionStorage.removeItem(SS_LOCKED);
  } catch {
    // ignore
  }
}

/**
 * ✅ Con cookie httpOnly, NO podemos “ver” la sesión desde JS.
 * Nuevo enfoque:
 * - En boot NO llamamos /auth/me (evita ruido en /login).
 * - La validación se hace al entrar a rutas protegidas (ProtectedRoute).
 */
export type User = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;

  // ✅ para cache-bust del avatar en Sidebar
  updatedAt?: string | null;
  avatarUpdatedAt?: string | null;

  // ✅ IMPORTANTÍSIMO: para flujos PIN
  hasQuickPin?: boolean;
  pinEnabled?: boolean;
  quickPinEnabled?: boolean;
};

export type Jewelry = Record<string, any>;
export type Role = { id: string; name: string; isSystem?: boolean };

export type MeResponse = {
  user: User;
  jewelry?: Jewelry | null;
  roles?: Role[];
  permissions?: string[];
  token?: string;
  accessToken?: string;
};

type AuthEvent = { type: "LOGIN" | "LOGOUT"; at: number };

/* =========================
   QUICK SWITCH
========================= */
export type QuickUser = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  hasQuickPin: boolean;
  pinEnabled: boolean;

  // ✅ roles (para LockScreen)
  roles?: Role[] | Array<{ id?: string; name?: string }> | string[]; // tolerante
  roleNames?: string[];
  roleLabel?: string;
  role?: string;
  roleName?: string;
};

export type QuickUsersResponse = {
  enabled: boolean;
  users: QuickUser[];
};

/* =========================
   LOCK LOCAL FALLBACK
========================= */
const LS_LOCK_TIMEOUT_MIN = "tptech_lock_timeout_min";
const LS_LOCK_ENABLED = "tptech_lock_enabled";

// ✅ IMPORTANTE: default false para que NO bloquee si nunca configuraste PIN en la joyería
const DEFAULT_LOCK_ENABLED = false;

// ✅ tu UI permite hasta 720 (12h)
const DEFAULT_LOCK_TIMEOUT_MIN = 5;

function readLockEnabledLocal(): boolean {
  try {
    const v = localStorage.getItem(LS_LOCK_ENABLED);
    if (v === null) return DEFAULT_LOCK_ENABLED;
    return v === "1";
  } catch {
    return DEFAULT_LOCK_ENABLED;
  }
}

function readLockTimeoutMinLocal(): number {
  try {
    const n = Number(localStorage.getItem(LS_LOCK_TIMEOUT_MIN));
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_LOCK_TIMEOUT_MIN;
    return Math.max(1, Math.min(720, Math.floor(n)));
  } catch {
    return DEFAULT_LOCK_TIMEOUT_MIN;
  }
}

function writeLockEnabledLocal(v: boolean) {
  try {
    localStorage.setItem(LS_LOCK_ENABLED, v ? "1" : "0");
  } catch {}
}

function writeLockTimeoutMinLocal(n: number) {
  try {
    localStorage.setItem(LS_LOCK_TIMEOUT_MIN, String(n));
  } catch {}
}

/* =========================
   AUTH STATE
========================= */
type PinArg = string | { pin4?: string; pin?: string };

export type AuthState = {
  token: string | null;
  user: User | null;
  jewelry: Jewelry | null;
  roles: Role[];
  permissions: string[];
  loading: boolean;

  /** ✅ ya intentamos validar sesión al menos 1 vez (para evitar flash /login) */
  bootstrapped: boolean;

  locked: boolean;
  setLocked: (v: boolean) => void;

  /** ✅ bloquear manualmente (candado del topbar) */
  lockNow: () => void;

  /** ✅ abrir UI de Quick Switch (LockScreen/Modal) */
  openQuickSwitch: () => void;

  /** lock efectivo (server si existe, sino local) */
  lockEnabled: boolean;
  lockTimeoutMinutes: number;

  /** ✅ alias para que LockScreen y settings sean claros */
  pinLockEnabled: boolean;
  pinLockTimeoutMinutes: number;
  pinLockRequireOnUserSwitch: boolean;

  setLockEnabledLocal: (v: boolean) => void;
  setLockTimeoutMinutesLocal: (n: number) => void;

  quickSwitchEnabled: boolean;

  pinSet: (pin: PinArg) => Promise<void>;
  pinRemove: (pin: PinArg) => Promise<void>;

  pinUnlock: (pin: PinArg) => Promise<void>;
  pinQuickUsers: () => Promise<QuickUsersResponse>;

  pinSwitchUser: (args: { targetUserId: string; pin4?: string; pin?: string }) => Promise<void>;

  setPinLockSettingsForJewelry: (args: {
    enabled: boolean;
    timeoutMinutes: number;
    requireOnUserSwitch: boolean;
    quickSwitchEnabled: boolean;
  }) => Promise<void>;

  setPinLockSettings: (args: {
    enabled: boolean;
    timeoutMinutes: number;
    requireOnUserSwitch: boolean;
    quickSwitchEnabled: boolean;
  }) => Promise<void>;

  setTokenOnly: (token: string | null) => void;
  setSession: (p: {
    token?: string | null;
    user: User;
    jewelry?: Jewelry | null;
    roles?: Role[];
    permissions?: string[];
  }) => void;

  refreshMe: (opts?: { force?: boolean; silent?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/* =========================
   HELPERS
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizePinArg(arg: PinArg): string {
  if (typeof arg === "string") return assertPin4(arg);
  const maybe = arg?.pin4 ?? arg?.pin ?? "";
  return assertPin4(maybe);
}

function getServerLockFromJewelry(j: any): {
  enabled?: boolean;
  timeoutMin?: number;
  requireOnUserSwitch?: boolean;
  quickSwitchEnabled?: boolean;
} {
  if (!j || typeof j !== "object") return {};

  const enabledRaw = (j as any).pinLockEnabled;
  const timeoutSecRaw = (j as any).pinLockTimeoutSec;
  const requireRaw = (j as any).pinLockRequireOnUserSwitch;
  const quickRaw = (j as any).quickSwitchEnabled;

  const out: {
    enabled?: boolean;
    timeoutMin?: number;
    requireOnUserSwitch?: boolean;
    quickSwitchEnabled?: boolean;
  } = {};

  if (typeof enabledRaw === "boolean") out.enabled = enabledRaw;

  const sec = Number(timeoutSecRaw);
  if (Number.isFinite(sec) && sec > 0) {
    const safeSec = clamp(Math.trunc(sec), 10, 60 * 60 * 12);
    const min = Math.max(1, Math.round(safeSec / 60));
    out.timeoutMin = clamp(min, 1, 60 * 12);
  }

  if (typeof requireRaw === "boolean") out.requireOnUserSwitch = requireRaw;
  if (typeof quickRaw === "boolean") out.quickSwitchEnabled = quickRaw;

  return out;
}

function userHasQuickPin(u: any): boolean {
  if (!u) return false;
  if (typeof u.hasQuickPin === "boolean") return u.hasQuickPin;
  if (typeof u.quickPinEnabled === "boolean") return u.quickPinEnabled;
  if (typeof u.pinEnabled === "boolean") return u.pinEnabled;
  if (u.quickPinHash) return true;
  if (u.pinHash) return true;
  return false;
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

  // ✅ en vez de “bloquear” la app al boot, arrancamos público y validamos en ProtectedRoute
  const [loading, setLoading] = useState(false);

  // ✅ para evitar flash de Login: cuando ProtectedRoute llama refreshMe por 1ra vez, esto pasa a true
  const [bootstrapped, setBootstrapped] = useState(false);

  // ✅ inicia con el lock persistido (F5 NO saltea el lock)
  const [locked, setLockedState] = useState<boolean>(() => readLockedPersisted());

  const [lockEnabledLocal, setLockEnabledLocalState] = useState(readLockEnabledLocal);
  const [lockTimeoutMinutesLocal, setLockTimeoutMinutesLocalState] = useState(readLockTimeoutMinLocal);

  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<number | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  /* =========================
     LOCK EFECTIVO (SERVER > LOCAL)
  ========================= */
  const effectiveLock = useMemo(() => {
    const server = getServerLockFromJewelry(jewelry);
    return {
      enabled: typeof server.enabled === "boolean" ? server.enabled : lockEnabledLocal,
      timeoutMin: typeof server.timeoutMin === "number" ? server.timeoutMin : lockTimeoutMinutesLocal,
      requireOnUserSwitch: typeof server.requireOnUserSwitch === "boolean" ? server.requireOnUserSwitch : true,
      quickSwitchEnabled: typeof server.quickSwitchEnabled === "boolean" ? server.quickSwitchEnabled : false,
    };
  }, [jewelry, lockEnabledLocal, lockTimeoutMinutesLocal]);

  const canLockThisUser = Boolean(user && userHasQuickPin(user));

  /* =========================
     LOCK STATE
  ========================= */
  const setLocked = useCallback((v: boolean) => {
    setLockedState(v);
    writeLockedPersisted(v);
  }, []);

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  /** 🔒 Bloqueo manual (candado topbar)
   *  - Si no hay PIN en el usuario actual: NO bloquear, abrir flujo PIN
   */
  const lockNow = useCallback(() => {
    if (DEV) clearDevLockBypass();

    const meId = String((user as any)?.id || "");
    if (effectiveLock.enabled && meId && !userHasQuickPin(user)) {
      emitOpenPinFlow(meId);
      return;
    }

    setLocked(true);
  }, [setLocked, user, effectiveLock.enabled]);

  /** 👥 Abrir Quick Switch / Lock UI
   *  - Limpia bypass DEV para forzar UI real
   */
  const openQuickSwitch = useCallback(() => {
    if (DEV) clearDevLockBypass();
    emitOpenQuickSwitch();
  }, []);

  /* =========================
     LIMPIEZA DE SESIÓN
  ========================= */

  /**
   * Limpia estado LOCAL sin emitir logout global.
   * - Evita loops multi-tab
   */
  const clearSessionLocalOnly = useCallback(() => {
    try {
      sessionStorage.removeItem(SS_TOKEN_KEY);
    } catch {}
    try {
      localStorage.removeItem(LS_TOKEN_KEY);
    } catch {}

    if (DEV) clearDevLockBypass();

    // asegurar que no quede un lock viejo persistido
    clearLockedPersisted();

    try {
      localStorage.removeItem("tptech_current_user_id");
    } catch {}

    setToken(null);
    setUser(null);
    setJewelry(null);
    setRoles([]);
    setPermissions([]);
    setLocked(false);
    setLoading(false);

    // ✅ si quedamos “público”, el próximo ProtectedRoute debe re-chequear
    setBootstrapped(false);

    // favicon público (TPT negro)
    applyAppFavicon({ user: null, jewelry: null });
  }, [setLocked]);

  /**
   * Limpia sesión FULL + emite logout global
   */
  const clearSession = useCallback(() => {
    forceLogout();
    clearSessionLocalOnly();
  }, [clearSessionLocalOnly]);

  /* =========================
     TOKEN / SESSION
  ========================= */

  const setTokenOnly = useCallback((t: string | null) => {
    if (!t) {
      forceLogout();
      setToken(null);
      applyAppFavicon({ user: null, jewelry: null });
      return;
    }

    storeTokenEverywhere(t);
    setToken(t);
    emitAuthEvent({ type: "LOGIN", at: Date.now() });
    // Nota: el favicon final se setea con setSession/refreshMe
  }, []);

  const setSession = useCallback(
    (p: { token?: string | null; user: User; jewelry?: Jewelry | null; roles?: Role[]; permissions?: string[] }) => {
      if (p.token) {
        storeTokenEverywhere(p.token);
        setToken(p.token);
      }

      setUser(p.user);
      setJewelry(p.jewelry ?? null);
      setRoles(p.roles ?? []);
      setPermissions(p.permissions ?? []);

      try {
        if (p.user?.id) localStorage.setItem("tptech_current_user_id", String(p.user.id));
      } catch {}

      clearLockedPersisted();
      setLocked(false);

      bumpActivity();
      emitAuthEvent({ type: "LOGIN", at: Date.now() });

      // ✅ ya tenemos una sesión válida
      setBootstrapped(true);

      applyAppFavicon({ user: p.user, jewelry: p.jewelry ?? null, loading: false });
    },
    [bumpActivity, setLocked]
  );

  const refreshMe = useCallback(
    async (opts?: { force?: boolean; silent?: boolean }) => {
      const force = Boolean(opts?.force);
      const silent = Boolean(opts?.silent);

      if (refreshPromiseRef.current && !force) return refreshPromiseRef.current;
      if (force) refreshPromiseRef.current = null;

      if (!silent) setLoading(true);

      const p = (async () => {
        try {
          const data = await apiFetch<MeResponse>("/auth/me", {
            method: "GET",
            cache: "no-store",
            on401: "throw",
            // ✅ aunque sea force, podemos dedupear GET si StrictMode dispara doble
            dedupe: true,
          });

          const backendToken = data.accessToken || data.token || null;
          if (backendToken) {
            storeTokenEverywhere(backendToken);
            setToken(backendToken);
          }

          setUser(data.user);
          setJewelry(data.jewelry ?? null);
          setRoles(data.roles ?? []);
          setPermissions(data.permissions ?? []);

          try {
            if (data.user?.id) localStorage.setItem("tptech_current_user_id", String(data.user.id));
          } catch {}

          const serverFlags = getServerLockFromJewelry(data.jewelry);

          if (hasDevLockBypass()) setLocked(false);

          // si el server apagó el pin lock, salimos del lock sí o sí
          if (serverFlags.enabled === false) setLocked(false);

          applyAppFavicon({ user: data.user, jewelry: data.jewelry ?? null, loading: false });
        } catch (e: any) {
          const status = Number(e?.status || 0);
          const msg = String(e?.message || "");

          if (status === 401 || msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
            clearSessionLocalOnly();
            return;
          }

          throw e;
        } finally {
          setLoading(false);
          refreshPromiseRef.current = null;

          // ✅ importantísimo: ya intentamos validar sesión al menos 1 vez
          setBootstrapped(true);
        }
      })();

      refreshPromiseRef.current = p;
      return p;
    },
    [setLocked, clearSessionLocalOnly]
  );

  /* =========================
     ✅ ESCUCHAR EVENTO PIN ACTUALIZADO
     - actualiza AuthContext.user al instante (clave para SystemPinSettings)
  ========================= */
  useEffect(() => {
  const onPinUpdated = async (ev: Event) => {
    try {
      const { userId, hasQuickPin, pinEnabled } = readPinEvent(ev);
      if (!userId) return;

      setUser((prev) => {
        if (!prev) return prev;
        if (String(prev.id) !== String(userId)) return prev;

        const next: any = { ...prev };
        if (typeof hasQuickPin === "boolean") next.hasQuickPin = hasQuickPin;
        if (typeof pinEnabled === "boolean") {
          next.pinEnabled = pinEnabled;
          next.quickPinEnabled = pinEnabled;
        }

        return next;
      });

      // 🔥 CLAVE: refrescamos joyería y flags reales del backend
      await refreshMe({ silent: true, force: true });

    } catch {
      // ignore
    }
  };

  window.addEventListener(PIN_EVENT, onPinUpdated as any);
  return () => window.removeEventListener(PIN_EVENT, onPinUpdated as any);
}, [refreshMe]);


  /* =========================
     ✅ ESCUCHAR EVENTO LOGO CAMBIADO
     - al borrar logo en Perfil Joyeria, favicon vuelve a iniciales INSTANTE
  ========================= */
  useEffect(() => {
    const onLogoChanged = (ev: Event) => {
      try {
        if (!user) return;
        const nextLogo = readLogoFromEvent(ev);

        setJewelry((prev) => ({ ...(prev || {}), logoUrl: nextLogo }));

        applyAuthFaviconOverrideLogo({
          user,
          jewelry: { ...(jewelry || {}), logoUrl: nextLogo },
          logoUrl: nextLogo,
        });
      } catch {
        // ignore
      }
    };

    window.addEventListener(JEWELRY_LOGO_EVENT, onLogoChanged as any);
    return () => window.removeEventListener(JEWELRY_LOGO_EVENT, onLogoChanged as any);
  }, [user, jewelry]);

  /* =========================
     ✅ ESCUCHAR EVENTO AVATAR CAMBIADO
     - actualiza AuthContext.user al instante
     - IMPORTANTÍSIMO para que el Sidebar re-renderice con el avatar nuevo
  ========================= */
  useEffect(() => {
    const onUserAvatarChanged = (ev: Event) => {
      try {
        const { userId, avatarUrl, updatedAt } = readAvatarFromEvent(ev);
        if (!userId) return;

        setUser((prev) => {
          if (!prev) return prev;
          if (String(prev.id) !== String(userId)) return prev;

          const nowIso = new Date().toISOString();
          const bustIso = updatedAt || nowIso;

          return {
            ...prev,
            avatarUrl: avatarUrl || null,
            // ✅ forzamos bust para que el Sidebar no quede pegado al cache
            avatarUpdatedAt: bustIso,
            updatedAt: bustIso,
          };
        });
      } catch {
        // ignore
      }
    };

    window.addEventListener(USER_AVATAR_EVENT, onUserAvatarChanged as any);
    return () => window.removeEventListener(USER_AVATAR_EVENT, onUserAvatarChanged as any);
  }, []);

  /* =========================
     PIN API
     ✅ FIX: endpoints correctos (CON /auth/me)
  ========================= */
  const pinSet = useCallback(
    async (pin: PinArg) => {
      const p = normalizePinArg(pin);
      await apiFetch("/auth/me/pin/set", { method: "POST", body: { pin: p } as any });
      await refreshMe({ silent: true });
    },
    [refreshMe]
  );

  const pinRemove = useCallback(
    async (pin: PinArg) => {
      const p = normalizePinArg(pin);
      await apiFetch("/auth/me/pin/disable", { method: "POST", body: { pin: p } as any });
      await refreshMe({ silent: true });
      setLocked(false);
    },
    [refreshMe, setLocked]
  );

  const pinUnlock = useCallback(
    async (pin: PinArg) => {
      const p = normalizePinArg(pin);
      await apiFetch("/auth/me/pin/unlock", { method: "POST", body: { pin: p } as any });
      setLocked(false);
      bumpActivity();
    },
    [bumpActivity, setLocked]
  );

  const pinQuickUsers = useCallback(async (): Promise<QuickUsersResponse> => {
    const data = await apiFetch<any>("/auth/me/pin/quick-users", {
      method: "GET",
      cache: "no-store",
      timeoutMs: 8000,
    });

    const users: QuickUser[] = Array.isArray(data?.users)
      ? data.users.map((u: any) => {
          const rawRoles = u?.roles;

          const roleNames =
            Array.isArray(u?.roleNames) && u.roleNames.length
              ? u.roleNames
              : Array.isArray(rawRoles)
              ? rawRoles
                  .map((r: any) => (typeof r === "string" ? r : r?.name))
                  .filter((x: any) => typeof x === "string" && x.trim())
                  .map((x: string) => x.trim())
              : [];

          const roleLabel =
            (typeof u?.roleLabel === "string" && u.roleLabel.trim() ? u.roleLabel.trim() : "") ||
            (roleNames.length ? roleNames.join(" • ") : "") ||
            (typeof u?.roleName === "string" ? u.roleName : "") ||
            (typeof u?.role === "string" ? u.role : "") ||
            "";

          return {
            id: String(u.id),
            email: String(u.email),
            name: u.name ?? null,
            avatarUrl: u.avatarUrl ?? null,
            hasQuickPin: Boolean(u.hasQuickPin ?? u.hasPin),
            pinEnabled: Boolean(u.pinEnabled ?? u.quickPinEnabled ?? u.hasPin),

            roles: rawRoles,
            roleNames,
            roleLabel,
            role: u?.role,
            roleName: u?.roleName,
          };
        })
      : [];

    return { enabled: Boolean(data?.enabled), users };
  }, []);

  const pinSwitchUser = useCallback(
    async (args: { targetUserId: string; pin4?: string; pin?: string }) => {
      const body: any = { targetUserId: args.targetUserId };

      // ✅ si viene vacío, NO mandar pin (así funciona el switch sin PIN)
      const maybePin = String(args.pin4 ?? args.pin ?? "").trim();
      if (maybePin) body.pin = assertPin4(maybePin);

      const data = await apiFetch<MeResponse>("/auth/me/pin/switch", {
        method: "POST",
        body,
        timeoutMs: 8000,
      });

      setSession({
        token: data.accessToken || data.token || null,
        user: data.user,
        jewelry: data.jewelry ?? null,
        roles: data.roles ?? [],
        permissions: data.permissions ?? [],
      });

      bumpActivity();
    },
    [setSession, bumpActivity]
  );

  /* =========================
     PIN LOCK SETTINGS (JOYERÍA)
     ✅ AHORA USA EL ENDPOINT NUEVO:
        PATCH /company/settings/security
     ✅ Traduce minutos → segundos (backend usa pinLockTimeoutSec)
  ========================= */
  const setPinLockSettingsForJewelry = useCallback(
    async (args: {
      enabled: boolean;
      timeoutMinutes: number;
      requireOnUserSwitch: boolean;
      quickSwitchEnabled: boolean;
    }) => {
      const timeoutMinutes = clamp(Math.floor(Number(args.timeoutMinutes) || 1), 1, 60 * 12);

      const payload = {
        quickSwitchEnabled: Boolean(args.quickSwitchEnabled),
        pinLockEnabled: Boolean(args.enabled),
        pinLockTimeoutSec: timeoutMinutes * 60,
        pinLockRequireOnUserSwitch: Boolean(args.requireOnUserSwitch),
      };

      await apiFetch("/company/settings/security", {
        method: "PATCH",
        body: payload as any,
        timeoutMs: 10_000,
      });

      await refreshMe({ silent: true, force: true } as any);

      // si se apaga el pin, salir sí o sí del lock
      if (!args.enabled) setLocked(false);
    },
    [refreshMe, setLocked]
  );

  const setPinLockSettings = useCallback(
    async (args: {
      enabled: boolean;
      timeoutMinutes: number;
      requireOnUserSwitch: boolean;
      quickSwitchEnabled: boolean;
    }) => {
      await setPinLockSettingsForJewelry(args);
    },
    [setPinLockSettingsForJewelry]
  );

  /* =========================
     MULTI-TAB / GLOBAL AUTH EVENTS
  ========================= */
  const lastCrossTabAtRef = useRef<number>(0);

  useEffect(() => {
    const shouldIgnore = (at?: number) => {
      const t = Number(at || 0);
      if (!Number.isFinite(t) || t <= 0) return false;
      if (t <= lastCrossTabAtRef.current) return true;
      lastCrossTabAtRef.current = t;
      return false;
    };

    const handleLogin = async (at?: number) => {
      if (shouldIgnore(at)) return;
      try {
        await refreshMe({ silent: true, force: true } as any);
      } catch {
        // queda público
      }
    };

    const handleLogout = (at?: number) => {
      if (shouldIgnore(at)) return;
      clearSessionLocalOnly();
    };

    const onStorage = (e: StorageEvent) => {
      try {
        if (e.key === LS_LOGOUT_KEY) {
          const at = Number(e.newValue || 0) || Date.now();
          handleLogout(at);
          return;
        }

        if (e.key === LS_AUTH_EVENT_KEY && typeof e.newValue === "string" && e.newValue.trim()) {
          const ev = JSON.parse(e.newValue) as AuthEvent;
          if (ev?.type === "LOGOUT") {
            handleLogout(ev.at);
            return;
          }
          if (ev?.type === "LOGIN") {
            void handleLogin(ev.at);
            return;
          }
        }

        if (e.key === LS_TOKEN_KEY) {
          if (!e.newValue) {
            handleLogout(Date.now());
            return;
          }
          void handleLogin(Date.now());
        }
      } catch {
        // ignore
      }
    };

    let bc: BroadcastChannel | null = null;

    const onBC = (msg: MessageEvent) => {
      try {
        const ev = msg?.data as AuthEvent;
        if (ev?.type === "LOGOUT") handleLogout(ev.at);
        if (ev?.type === "LOGIN") void handleLogin(ev.at);
      } catch {
        // ignore
      }
    };

    window.addEventListener("storage", onStorage);

    try {
      if ("BroadcastChannel" in window) {
        bc = new BroadcastChannel("tptech_auth");
        bc.addEventListener("message", onBC as any);
      }
    } catch {
      bc = null;
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      try {
        if (bc) {
          bc.removeEventListener("message", onBC as any);
          bc.close();
        }
      } catch {
        // ignore
      }
    };
  }, [clearSessionLocalOnly, refreshMe]);

  /* =========================
     AUTO LOCK (INACTIVIDAD)
     ✅ NO bloquear si el usuario no tiene PIN (evita “encerrado”)
  ========================= */
  useEffect(() => {
    if (!user || !effectiveLock.enabled) return;
    if (!canLockThisUser) return;

    const onVisibility = () => {
      if (document.visibilityState === "visible") bumpActivity();
    };

    window.addEventListener("mousemove", bumpActivity, { passive: true });
    window.addEventListener("keydown", bumpActivity);
    window.addEventListener("mousedown", bumpActivity);
    window.addEventListener("touchstart", bumpActivity, { passive: true });
    window.addEventListener("scroll", bumpActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("mousemove", bumpActivity);
      window.removeEventListener("keydown", bumpActivity);
      window.removeEventListener("mousedown", bumpActivity);
      window.removeEventListener("touchstart", bumpActivity);
      window.removeEventListener("scroll", bumpActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, effectiveLock.enabled, bumpActivity, canLockThisUser]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!user || !effectiveLock.enabled) return;
    if (!canLockThisUser) return;

    timerRef.current = window.setInterval(() => {
      if (locked) return;
      if (hasDevLockBypass()) return;

      const idle = Date.now() - lastActivityRef.current;
      if (idle >= effectiveLock.timeoutMin * 60_000) {
        setLocked(true);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [user, effectiveLock.enabled, effectiveLock.timeoutMin, locked, setLocked, canLockThisUser]);

  /* =========================
     BOOT
  ========================= */
  useEffect(() => {
    // ✅ siempre arrancamos con favicon público
    applyAppFavicon({ user: null, jewelry: null });

    // ✅ NO hacemos /auth/me acá (evita ruido en /login)
    // La validación pasa por ProtectedRoute (cuando corresponde).
  }, []);

  const logout = useCallback(async () => {
    applyAppFavicon({ user: null, jewelry: null });
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {}
    clearSession();
  }, [clearSession]);

  /* =========================
     CONTEXT VALUE
  ========================= */
  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      jewelry,
      roles,
      permissions,
      loading,

      bootstrapped,

      locked,
      setLocked,
      lockNow,
      openQuickSwitch,

      lockEnabled: effectiveLock.enabled,
      lockTimeoutMinutes: effectiveLock.timeoutMin,

      pinLockEnabled: effectiveLock.enabled,
      pinLockTimeoutMinutes: effectiveLock.timeoutMin,
      pinLockRequireOnUserSwitch: effectiveLock.requireOnUserSwitch,

      setLockEnabledLocal: (v) => {
        setLockEnabledLocalState(v);
        writeLockEnabledLocal(v);
        if (!v) setLocked(false);
      },
      setLockTimeoutMinutesLocal: (n) => {
        const safe = clamp(Math.floor(Number(n) || 1), 1, 720);
        setLockTimeoutMinutesLocalState(safe);
        writeLockTimeoutMinLocal(safe);
      },

      // ✅ SIEMPRE consistente con servidor/local (evita des-sync)
      quickSwitchEnabled: effectiveLock.quickSwitchEnabled,

      pinSet,
      pinRemove,
      pinUnlock,
      pinQuickUsers,
      pinSwitchUser,

      setPinLockSettingsForJewelry,
      setPinLockSettings,

      setTokenOnly,
      setSession,

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
      bootstrapped,
      locked,
      lockNow,
      openQuickSwitch,
      effectiveLock,
      pinSet,
      pinRemove,
      pinUnlock,
      pinQuickUsers,
      pinSwitchUser,
      setPinLockSettingsForJewelry,
      setPinLockSettings,
      setTokenOnly,
      setSession,
      refreshMe,
      logout,
      clearSession,
      setLocked,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* =========================
   HOOK
========================= */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
