// tptech-frontend/src/lib/api.ts

const RAW_API_URL =
  (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";

// normaliza: sin slash final
const API_URL = RAW_API_URL.replace(/\/+$/, "");

// ✅ legacy keys (por si en algún momento guardaste tokens)
export const LS_TOKEN_KEY = "tptech_token";
export const SS_TOKEN_KEY = "tptech_access_token";

// ✅ multi-tab events
export const LS_LOGOUT_KEY = "tptech_logout";
export const LS_AUTH_EVENT_KEY = "tptech_auth_event";

type AuthEvent = { type: "LOGIN" | "LOGOUT"; at: number };

/**
 * ✅ Dedupe de requests GET/HEAD en vuelo
 * Evita duplicados (muy común en dev por StrictMode o renders dobles).
 */
const inFlight = new Map<string, Promise<any>>();

/** Timeout default (ms) */
const DEFAULT_TIMEOUT_MS = 25_000;

function emitAuthEvent(ev: AuthEvent) {
  try {
    if (ev.type === "LOGOUT") localStorage.setItem(LS_LOGOUT_KEY, String(ev.at));
    localStorage.setItem(LS_AUTH_EVENT_KEY, JSON.stringify(ev));

    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("tptech_auth");
      bc.postMessage(ev);
      bc.close();
    }
  } catch {
    // si storage está bloqueado, no rompemos
  }
}

/**
 * Limpia tokens legacy (si existieran) y emite evento LOGOUT global (multi-tab).
 * ✅ Importante: aunque el backend use cookie, esto ayuda a limpiar estados viejos.
 */
export function forceLogout() {
  try {
    sessionStorage.removeItem(SS_TOKEN_KEY);
  } catch {}

  try {
    localStorage.removeItem(LS_TOKEN_KEY);
  } catch {}

  emitAuthEvent({ type: "LOGOUT", at: Date.now() });
}

function joinUrl(base: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Extensión de RequestInit que permite:
 * - body como objeto/array (lo serializa a JSON)
 * - body como string/FormData/etc (lo manda tal cual)
 */
export type ApiFetchOptions = Omit<RequestInit, "body" | "signal"> & {
  body?: any;

  /**
   * ✅ Timeout por request (ms)
   * - si no se pasa, usa DEFAULT_TIMEOUT_MS
   * - si querés desactivar, pasá timeoutMs: 0
   */
  timeoutMs?: number;

  /**
   * ✅ Deduplicación (solo aplica a GET/HEAD).
   * Default: true
   */
  dedupe?: boolean;

  /**
   * ✅ AbortSignal opcional (se combina con timeout)
   */
  signal?: AbortSignal;

  /**
   * ✅ Control de qué hacer ante 401
   * - "logout" (default): fuerza logout global + error "Sesión expirada"
   * - "throw": NO desloguea, solo lanza error (ideal para uploads como avatar)
   */
  on401?: "logout" | "throw";
};

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

/**
 * “JSON-serializable”: objetos y arrays (pero NO FormData/Blob/etc)
 */
function isJsonSerializable(body: any) {
  if (body === null || body === undefined) return false;
  if (typeof body !== "object") return false;
  if (Array.isArray(body)) return true;

  if (isFormData(body) || isURLSearchParams(body) || isBlob(body) || isArrayBuffer(body))
    return false;

  return true;
}

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

function tryParseJsonText(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * apiFetch
 * - ✅ Auth por COOKIE httpOnly (credentials: "include")
 * - ❌ NO agrega Authorization Bearer
 * - si options.body es objeto/array -> JSON.stringify
 * - si 401 -> (por default) forceLogout (multi-tab) + throw
 * - soporta FormData (avatar/logo/adjuntos) sin setear Content-Type
 *
 * ✅ IMPORTANTÍSIMO: GET por defecto va con cache:"no-store"
 * para evitar pantallas con datos viejos al navegar.
 *
 * ✅ Performance:
 * - dedupe GET/HEAD en vuelo (evita duplicados)
 * - timeout (AbortController)
 */
export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers as any);

  const method = String(options.method || "GET").toUpperCase();
  const allowBody = method !== "GET" && method !== "HEAD";

  let bodyToSend: BodyInit | undefined = undefined;

  if (allowBody && options.body !== undefined) {
    const b = options.body;

    if (isFormData(b) || isURLSearchParams(b)) {
      bodyToSend = b;
    } else if (typeof b === "string") {
      bodyToSend = b;
      if (!headers.has("Content-Type"))
        headers.set("Content-Type", "text/plain;charset=UTF-8");
    } else if (isBlob(b)) {
      bodyToSend = b;
    } else if (isArrayBuffer(b)) {
      bodyToSend = b as any;
    } else if (isJsonSerializable(b)) {
      bodyToSend = JSON.stringify(b);
      if (!headers.has("Content-Type"))
        headers.set("Content-Type", "application/json");
    } else {
      bodyToSend = b as any;
    }
  }

  const cacheOpt: RequestCache | undefined =
    options.cache !== undefined
      ? options.cache
      : method === "GET"
        ? "no-store"
        : undefined;

  const url = joinUrl(API_URL, path);

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutSignal = makeTimeoutSignal(timeoutMs);
  const signal = mergeSignals(options.signal, timeoutSignal);

  const canDedupe =
    (options.dedupe ?? true) &&
    (method === "GET" || method === "HEAD") &&
    bodyToSend === undefined;

  const key = canDedupe ? `${method}:${url}` : "";

  if (canDedupe) {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;
  }

  const run = (async () => {
    let res: Response;

    // ✅ Quitamos props custom para no pasarlas a fetch()
    const {
      body: _body,
      timeoutMs: _timeoutMs,
      dedupe: _dedupe,
      on401: _on401,
      ...fetchOpts
    } = options;

    try {
      res = await fetch(url, {
        ...fetchOpts,
        method,
        headers,
        body: bodyToSend,
        cache: cacheOpt,
        credentials: "include",
        signal,
      });
    } catch (err: any) {
      if (isAbortError(err)) {
        throw new Error("Tiempo de espera agotado. Revisá tu conexión e intentá de nuevo.");
      }
      throw new Error("Error de red. Revisá tu conexión e intentá de nuevo.");
    }

    if (res.status === 401) {
      const mode = options.on401 ?? "logout";
      if (mode === "logout") {
        forceLogout();
        throw new Error("Sesión expirada");
      }
      throw new Error("No autorizado (401)");
    }

    if (res.status === 204) return undefined as T;

    let payload: any = null;
    const ct = res.headers.get("content-type") || "";

    if (ct.includes("application/json")) {
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
    } else {
      try {
        const txt = await res.text();
        const maybeJson = tryParseJsonText(txt);
        payload = maybeJson ?? txt;
      } catch {
        payload = null;
      }
    }

    if (!res.ok) {
      const msg =
        (payload && typeof payload === "object" && payload.message) ||
        (typeof payload === "string" && payload) ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return payload as T;
  })();

  if (canDedupe) {
    inFlight.set(key, run);
    run.finally(() => inFlight.delete(key));
  }

  return run;
}
