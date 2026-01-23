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

/* =========================
   FAVICON (PUBLIC vs AUTH)
   - PUBLIC (login): TPT negro (default)
   - AUTH: logo de joyería o iniciales
========================= */
function toDataUri(svg: string) {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function ensureIconLink(): HTMLLinkElement {
  const head = document.head || document.getElementsByTagName("head")[0];
  let link =
    (head.querySelector("link[rel='icon']") as HTMLLinkElement | null) ||
    (head.querySelector("link[rel='shortcut icon']") as HTMLLinkElement | null);

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "icon");
    head.appendChild(link);
  }
  return link;
}

function pickPrimaryColor(): string {
  try {
    const cs = getComputedStyle(document.documentElement);
    const p = (cs.getPropertyValue("--primary") || "").trim();
    return p || "#f97316";
  } catch {
    return "#f97316";
  }
}

function buildSvgTextBadge(opts: {
  text: string;
  bg: string;
  fg?: string;
  rx?: number;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
}) {
  const text = (opts.text || "").trim();
  const bg = opts.bg || "#0b0b0d";
  const fg = opts.fg || "#ffffff";
  const rx = typeof opts.rx === "number" ? opts.rx : 18;
  const fontSize = typeof opts.fontSize === "number" ? opts.fontSize : 26;
  const fontWeight = typeof opts.fontWeight === "number" ? opts.fontWeight : 800;
  const letterSpacing = typeof opts.letterSpacing === "number" ? opts.letterSpacing : -1.2;

  return (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
    "<rect width='64' height='64' rx='" +
    rx +
    "' fill='" +
    bg +
    "'/>" +
    "<text x='32' y='40' text-anchor='middle' " +
    "font-family='system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' " +
    "font-size='" +
    fontSize +
    "' font-weight='" +
    fontWeight +
    "' letter-spacing='" +
    letterSpacing +
    "' fill='" +
    fg +
    "'>" +
    text +
    "</text>" +
    "</svg>"
  );
}

function buildPublicTptFaviconSvg() {
  return buildSvgTextBadge({
    text: "TPT",
    bg: "#0b0b0d",
    fg: "#ffffff",
    rx: 18,
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: -1.2,
  });
}

function setFaviconHref(href: string, type?: string) {
  try {
    const link = ensureIconLink();
    link.setAttribute("href", href);
    if (type) link.setAttribute("type", type);
  } catch {
    // ignore
  }
}

function normalizeLogoUrl(u: any): string {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  // Si viene "/uploads/..." o similar, lo hacemos absoluto al backend
  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const api = String(base).replace(/\/+$/, "");
  if (raw.startsWith("/")) return api + raw;
  return api + "/" + raw;
}

function initialsFromName(name: string): string {
  const s = String(name || "").trim();
  if (!s) return "";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[1]?.[0] || "" : (parts[0]?.[1] || "");
  const out = (a + b).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return out.slice(0, 2) || "";
}

function applyAppFavicon(args: { token?: string | null; user?: any; jewelry?: any }) {
  try {
    const token = String(args.token || "").trim();

    // ✅ Sin token -> PUBLIC favicon TPT negro
    if (!token) {
      setFaviconHref(toDataUri(buildPublicTptFaviconSvg()), "image/svg+xml");
      return;
    }

    const j = args.jewelry || null;
    const u = args.user || null;

    const logoUrl = normalizeLogoUrl(j?.logoUrl);
    if (logoUrl) {
      // ✅ si hay logo, lo ponemos directo
      // type se omite porque puede ser png/jpg/svg
      setFaviconHref(logoUrl);
      return;
    }

    // ✅ si no hay logo -> iniciales
    const nameSource =
      String(j?.name || "").trim() ||
      String(u?.name || "").trim() ||
      String(u?.email || "").trim();

    const initials = initialsFromName(nameSource) || "TP";
    const bg = "#0b0b0d";
    const svg = buildSvgTextBadge({
      text: initials,
      bg,
      fg: "#ffffff",
      rx: 18,
      fontSize: 28,
      fontWeight: 900,
      letterSpacing: -1.1,
    });
    setFaviconHref(toDataUri(svg), "image/svg+xml");
  } catch {
    // ignore
  }
}

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

// ✅ limpiar lock persistido (evita que tras login quede pidiendo PIN por un lock viejo)
function clearLockedPersisted() {
  try {
    sessionStorage.removeItem(SS_LOCKED);
  } catch {
    // ignore
  }
}

function hasPossibleSession(): boolean {
  try {
    const p = (window.location.pathname || "").toLowerCase();
    if (
      p.startsWith("/login") ||
      p.startsWith("/register") ||
      p.startsWith("/forgot-password") ||
      p.startsWith("/reset-password")
    ) {
      const tSS = sessionStorage.getItem(SS_TOKEN_KEY);
      const tLS = localStorage.getItem(LS_TOKEN_KEY);
      return Boolean(tSS || tLS);
    }
    return true;
  } catch {
    return false;
  }
}

export type User = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;

  // ✅ para cache-bust del avatar en Sidebar
  updatedAt?: string | null;
  avatarUpdatedAt?: string | null;
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
  roles?: Role[] | Array<{ id?: string; name?: string }> | string[];
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

  locked: boolean;
  setLocked: (v: boolean) => void;

  /** ✅ bloquear manualmente (candado del topbar) */
  lockNow: () => void;

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

function clearStoredToken() {
  try {
    sessionStorage.removeItem(SS_TOKEN_KEY);
  } catch {}
  try {
    localStorage.removeItem(LS_TOKEN_KEY);
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

  // ✅ inicia con el lock persistido (para que F5 NO saltee el lock)
  const [locked, setLockedState] = useState<boolean>(() => readLockedPersisted());

  const [lockEnabledLocal, setLockEnabledLocalState] = useState(readLockEnabledLocal);
  const [lockTimeoutMinutesLocal, setLockTimeoutMinutesLocalState] =
    useState(readLockTimeoutMinLocal);

  const [quickSwitchEnabled, setQuickSwitchEnabled] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<number | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const lastQuickUsersAtRef = useRef<number>(0);

  const effectiveLock = useMemo(() => {
    const server = getServerLockFromJewelry(jewelry);
    return {
      enabled: typeof server.enabled === "boolean" ? server.enabled : lockEnabledLocal,
      timeoutMin:
        typeof server.timeoutMin === "number" ? server.timeoutMin : lockTimeoutMinutesLocal,
      requireOnUserSwitch:
        typeof server.requireOnUserSwitch === "boolean" ? server.requireOnUserSwitch : true,
      quickSwitchEnabled:
        typeof server.quickSwitchEnabled === "boolean" ? server.quickSwitchEnabled : false,
    };
  }, [jewelry, lockEnabledLocal, lockTimeoutMinutesLocal]);

  // ✅ setLocked con persistencia
  const setLocked = useCallback((v: boolean) => {
    setLockedState(v);
    writeLockedPersisted(v);
  }, []);

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  /** ✅ bloqueo manual (candado topbar)
   *  FIX: si está activo el bypass DEV, lo apagamos para que el candado funcione.
   */
  const lockNow = useCallback(() => {
    if (DEV) clearDevLockBypass();
    setLocked(true);
  }, [setLocked]);

  const clearSession = useCallback(() => {
    forceLogout();
    clearStoredToken();
    if (DEV) clearDevLockBypass();

    // ✅ asegurar que no quede un lock viejo persistido
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
    setQuickSwitchEnabled(false);
    setLoading(false);

    // ✅ volver a favicon público (TPT negro)
    applyAppFavicon({ token: null, user: null, jewelry: null });
  }, [setLocked]);

  const setTokenOnly = useCallback((t: string | null) => {
    if (!t) {
      clearStoredToken();
      setToken(null);
      emitAuthEvent({ type: "LOGOUT", at: Date.now() });

      // ✅ volver a favicon público
      applyAppFavicon({ token: null, user: null, jewelry: null });
      return;
    }
    storeTokenEverywhere(t);
    setToken(t);
    emitAuthEvent({ type: "LOGIN", at: Date.now() });

    // Nota: el favicon final (logo/iniciales) se setea cuando llega /me (setSession/refreshMe)
  }, []);

  const setSession = useCallback(
    (p: {
      token?: string | null;
      user: User;
      jewelry?: Jewelry | null;
      roles?: Role[];
      permissions?: string[];
    }) => {
      let nextToken: string | null = token;

      if (p.token) {
        storeTokenEverywhere(p.token);
        setToken(p.token);
        nextToken = p.token;
      }

      setUser(p.user);
      setJewelry(p.jewelry ?? null);
      setRoles(p.roles ?? []);
      setPermissions(p.permissions ?? []);

      try {
        if (p.user?.id) localStorage.setItem("tptech_current_user_id", String(p.user.id));
      } catch {}

      // ✅ al iniciar sesión/switch, nunca heredar un lock persistido viejo
      clearLockedPersisted();
      setLocked(false);

      bumpActivity();
      emitAuthEvent({ type: "LOGIN", at: Date.now() });

      // ✅ favicon AUTH (logo o iniciales)
      applyAppFavicon({ token: nextToken, user: p.user, jewelry: p.jewelry ?? null });
    },
    [bumpActivity, setLocked, token]
  );

  const refreshMe = useCallback(
    async (opts?: { force?: boolean; silent?: boolean }) => {
      if (refreshPromiseRef.current) return refreshPromiseRef.current;
      const silent = Boolean(opts?.silent);
      if (!silent) setLoading(true);

      const p = (async () => {
        try {
          const data = await apiFetch<MeResponse>("/auth/me", {
            method: "GET",
            cache: "no-store",
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

          // quickSwitch viene del jewelry (source of truth)
          const serverFlags = getServerLockFromJewelry(data.jewelry);
          const qs =
            typeof serverFlags.quickSwitchEnabled === "boolean"
              ? serverFlags.quickSwitchEnabled
              : false;
          setQuickSwitchEnabled(Boolean(qs));

          // ✅ si hay bypass activo, nunca dejamos locked true
          if (hasDevLockBypass()) setLocked(false);

          // ✅ si el PIN global está deshabilitado, no dejamos persistido el lock
          const pinEnabled =
            typeof serverFlags.enabled === "boolean" ? serverFlags.enabled : readLockEnabledLocal();
          if (!pinEnabled) setLocked(false);

          // ✅ favicon AUTH (logo o iniciales)
          const t = backendToken || readStoredToken();
          applyAppFavicon({ token: t, user: data.user, jewelry: data.jewelry ?? null });

          // ✅ (opcional) ping quick-users cada tanto (no pisa flags locales)
          const now = Date.now();
          if (now - lastQuickUsersAtRef.current > 10_000) {
            lastQuickUsersAtRef.current = now;
            try {
              await apiFetch("/auth/me/pin/quick-users", {
                method: "GET",
                cache: "no-store",
                timeoutMs: 8000,
              });
            } catch {
              // ignore
            }
          }
        } finally {
          setLoading(false);
          refreshPromiseRef.current = null;
        }
      })();

      refreshPromiseRef.current = p;
      return p;
    },
    [setLocked]
  );

  const logout = useCallback(
  async () => {
    // ✅ 1. Cambiar favicon INMEDIATAMENTE (evita flash del logo viejo)
    applyAppFavicon({ token: null, user: null, jewelry: null });

    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {}

    clearSession();
    emitAuthEvent({ type: "LOGOUT", at: Date.now() });
  },
  [clearSession]
);


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
          // ✅ normalizar roles para UI
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

      const maybePin = args.pin4 ?? args.pin;
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

  const setPinLockSettingsForJewelry = useCallback(
    async (args: {
      enabled: boolean;
      timeoutMinutes: number;
      requireOnUserSwitch: boolean;
      quickSwitchEnabled: boolean;
    }) => {
      const timeoutMinutes = clamp(Math.floor(Number(args.timeoutMinutes) || 1), 1, 60 * 12);

      await apiFetch("/auth/company/security/pin-lock", {
        method: "PATCH",
        body: {
          quickSwitchEnabled: Boolean(args.quickSwitchEnabled),
          pinLockEnabled: Boolean(args.enabled),
          pinLockTimeoutSec: timeoutMinutes * 60,
          pinLockRequireOnUserSwitch: Boolean(args.requireOnUserSwitch),
        } as any,
        timeoutMs: 10_000,
      });

      await refreshMe({ silent: true, force: true } as any);

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

  /* -------------------------
     AUTO LOCK
  ------------------------- */
  useEffect(() => {
    if (!user || !effectiveLock.enabled) return;

    const onVisibility = () => bumpActivity();

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
  }, [user, effectiveLock.enabled, bumpActivity]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!user || !effectiveLock.enabled) return;

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
  }, [user, effectiveLock.enabled, effectiveLock.timeoutMin, locked, setLocked]);

  /* -------------------------
     BOOT
  ------------------------- */
  useEffect(() => {
    if (!hasPossibleSession()) {
      setLoading(false);
      // ✅ en rutas públicas, asegurar favicon público
      applyAppFavicon({ token: null, user: null, jewelry: null });
      return;
    }
    refreshMe({ force: true } as any).catch(() => setLoading(false));
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
      lockNow,

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

      quickSwitchEnabled,

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
      locked,
      setLocked,
      lockNow,
      effectiveLock.enabled,
      effectiveLock.timeoutMin,
      effectiveLock.requireOnUserSwitch,
      quickSwitchEnabled,
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
