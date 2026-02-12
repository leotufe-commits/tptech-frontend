// tptech-frontend/src/lib/api.ts

// ✅ DEV: usar proxy /api (evita problemas SameSite/CORS con cookie httpOnly)
const RAW_API_URL = (import.meta.env.VITE_API_URL as string) || "/api";

// =========================
// API URL NORMALIZATION
// - Si es absoluta (https://...), aseguramos que incluya /api
// - Si es relativa (/api), la dejamos
// =========================
function normalizeApiBase(raw: string) {
  const s = String(raw || "").trim();
  if (!s) return "/api";

  // relativa: "/api"
  if (s.startsWith("/")) return s.replace(/\/+$/, "");

  // absoluta: "https://host" o "https://host/api"
  if (/^https?:\/\//i.test(s)) {
    const noTrail = s.replace(/\/+$/, "");
    if (/(\/api)$/i.test(noTrail)) return noTrail;
    return `${noTrail}/api`;
  }

  return s.replace(/\/+$/, "");
}

// normaliza: sin slash final + asegura /api en absolutos
const API_URL = normalizeApiBase(RAW_API_URL);

// =========================
// LEGACY TOKEN KEYS (solo compat)
// =========================
export const LS_TOKEN_KEY = "tptech_token";
export const SS_TOKEN_KEY = "tptech_access_token";

// =========================
// MULTI-TAB EVENTS
// =========================
export const LS_LOGOUT_KEY = "tptech_logout";
export const LS_AUTH_EVENT_KEY = "tptech_auth_event";

type AuthEvent = { type: "LOGIN" | "LOGOUT"; at: number };

// =========================
// REQUEST DEDUPE (GET/HEAD)
// =========================
const inFlight = new Map<string, Promise<any>>();

// =========================
// DEFAULT TIMEOUT
// =========================
const DEFAULT_TIMEOUT_MS = 25_000;

// =========================
// AUTH EVENTS
// =========================
function emitAuthEvent(ev: AuthEvent) {
  try {
    if (ev.type === "LOGOUT") {
      localStorage.setItem(LS_LOGOUT_KEY, String(ev.at));
    }
    localStorage.setItem(LS_AUTH_EVENT_KEY, JSON.stringify(ev));

    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("tptech_auth");
      bc.postMessage(ev);
      bc.close();
    }
  } catch {
    // ignore
  }
}

export function emitLogin() {
  emitAuthEvent({ type: "LOGIN", at: Date.now() });
}

export function forceLogout() {
  try {
    sessionStorage.removeItem(SS_TOKEN_KEY);
    localStorage.removeItem(LS_TOKEN_KEY);
  } catch {}

  emitAuthEvent({ type: "LOGOUT", at: Date.now() });
}

/**
 * ✅ Legacy: guardar token + emitir LOGIN (compat con pantallas viejas).
 * - Si persist=true => localStorage
 * - Si persist=false (default) => sessionStorage
 */
export function storeTokenAndEmitLogin(token: string, opts?: { persist?: boolean }) {
  const t = String(token || "").trim();
  if (!t) return;

  const persist = !!opts?.persist;

  try {
    if (persist) {
      localStorage.setItem(LS_TOKEN_KEY, t);
      sessionStorage.removeItem(SS_TOKEN_KEY);
    } else {
      sessionStorage.setItem(SS_TOKEN_KEY, t);
      localStorage.removeItem(LS_TOKEN_KEY);
    }
  } catch {
    // ignore
  }

  emitLogin();
}

// =========================
// URL HELPERS
// =========================
function joinUrl(base: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

// =========================
// LEGACY TOKEN READ (solo si se fuerza Bearer)
// =========================
function readStoredToken(): string | null {
  try {
    const ss = sessionStorage.getItem(SS_TOKEN_KEY);
    if (ss && ss.trim()) return ss.trim();
  } catch {}

  try {
    const ls = localStorage.getItem(LS_TOKEN_KEY);
    if (ls && ls.trim()) return ls.trim();
  } catch {}

  return null;
}

// =========================
// TYPES
// =========================
export type ApiFetchOptions = Omit<RequestInit, "body" | "signal"> & {
  body?: any;
  timeoutMs?: number;
  dedupe?: boolean;
  signal?: AbortSignal;

  /**
   * 401 handling
   * - logout (default)
   * - throw
   */
  on401?: "logout" | "throw";

  /**
   * 🔑 IMPORTANTE
   * Bearer SOLO si se pide explícitamente
   */
  forceBearer?: boolean;
};

// =========================
// BODY HELPERS
// =========================
function isFormData(body: any): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}
function isURLSearchParams(body: any): body is URLSearchParams {
  return typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams;
}
function isBlob(body: any): body is Blob {
  return typeof Blob !== "undefined" && body instanceof Blob;
}
function isArrayBuffer(body: any): body is ArrayBuffer {
  return typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer;
}

function isJsonSerializable(body: any) {
  if (body === null || body === undefined) return false;
  if (typeof body !== "object") return false;
  if (Array.isArray(body)) return true;
  if (isFormData(body) || isURLSearchParams(body) || isBlob(body) || isArrayBuffer(body)) return false;
  return true;
}

// =========================
// SIGNAL / TIMEOUT
// =========================
function mergeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a) return b;
  if (!b) return a;

  const ctrl = new AbortController();
  const onAbort = () => {
    try {
      ctrl.abort();
    } catch {}
  };

  if (a.aborted || b.aborted) {
    onAbort();
    return ctrl.signal;
  }

  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });

  return ctrl.signal;
}

function makeTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (!timeoutMs || timeoutMs <= 0) return undefined;

  const ctrl = new AbortController();
  const t = window.setTimeout(() => {
    try {
      ctrl.abort();
    } catch {}
  }, timeoutMs);

  ctrl.signal.addEventListener(
    "abort",
    () => {
      window.clearTimeout(t);
    },
    { once: true }
  );

  return ctrl.signal;
}

function isAbortError(err: any) {
  return err?.name === "AbortError";
}

// =========================
// RESPONSE PARSE
// =========================
function tryParseJsonText(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function parsePayload(res: Response) {
  if (res.status === 204) return undefined;

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  try {
    const txt = await res.text();
    return tryParseJsonText(txt) ?? txt;
  } catch {
    return null;
  }
}

// =========================
// API ERROR
// =========================
export class ApiError extends Error {
  status: number;
  data: any;
  url?: string;
  method?: string;

  constructor(message: string, opts: { status: number; data?: any; url?: string; method?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.data = opts.data;
    this.url = opts.url;
    this.method = opts.method;
  }
}

// =========================
// apiFetch
// =========================
export async function apiFetch<T = any>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const method = String(options.method || "GET").toUpperCase();
  const allowBody = method !== "GET" && method !== "HEAD";

  // ✅ default SIEMPRE include (cookie httpOnly)
  const credentials: RequestCredentials = (options.credentials as any) ?? "include";
  const url = joinUrl(API_URL, path);

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signal = mergeSignals(options.signal, makeTimeoutSignal(timeoutMs));

  let bodyToSend: BodyInit | undefined;
  const headers = new Headers(options.headers as any);

  // BODY
  if (allowBody && options.body !== undefined) {
    const b = options.body;

    if (isFormData(b) || isURLSearchParams(b)) {
      bodyToSend = b;
    } else if (typeof b === "string") {
      bodyToSend = b;
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "text/plain;charset=UTF-8");
      }
    } else if (isBlob(b) || isArrayBuffer(b)) {
      bodyToSend = b as any;
    } else if (isJsonSerializable(b)) {
      bodyToSend = JSON.stringify(b);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    } else {
      bodyToSend = b as any;
    }
  }

  // 🔑 Bearer SOLO si se pide explícitamente
  if (options.forceBearer === true) {
    const token = readStoredToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // ✅ Dedupe (GET/HEAD)
  const dedupeKey = `${method}:${url}`;
  const shouldDedupe = options.dedupe ?? (method === "GET" || method === "HEAD");

  if (shouldDedupe && inFlight.has(dedupeKey)) {
    return (await inFlight.get(dedupeKey)) as T;
  }

  const doFetch = async () => {
    let res: Response;
    let payload: any;

    try {
      res = await fetch(url, {
        ...options,
        method,
        headers,
        body: bodyToSend,
        credentials,
        cache: method === "GET" ? "no-store" : options.cache,
        signal,
      });

      payload = await parsePayload(res);
    } catch (err: any) {
      if (isAbortError(err)) throw new Error("Tiempo de espera agotado.");
      throw new Error("Error de red.");
    }

    // 401
    if (res.status === 401) {
      const mode = options.on401 ?? "logout";

      if (mode === "logout") {
        forceLogout();
        throw new ApiError("Sesión expirada", { status: 401, data: payload, url, method });
      }

      throw new ApiError("No autorizado (401)", { status: 401, data: payload, url, method });
    }

    if (!res.ok) {
      const msg =
        (payload && typeof payload === "object" && payload.message) ||
        (typeof payload === "string" && payload) ||
        `HTTP ${res.status}`;

      throw new ApiError(msg, { status: res.status, data: payload, url, method });
    }

    return payload as T;
  };

  const p = doFetch();

  if (shouldDedupe) {
    inFlight.set(dedupeKey, p);
    try {
      const out = await p;
      return out;
    } finally {
      inFlight.delete(dedupeKey);
    }
  }

  return (await p) as T;
}
