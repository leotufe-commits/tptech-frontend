// tptech-frontend/src/lib/api.ts

const RAW_API_URL =
  (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";

// normaliza: sin slash final
const API_URL = RAW_API_URL.replace(/\/+$/, "");

// ✅ legacy (si ya venías guardando token ahí)
export const LS_TOKEN_KEY = "tptech_token";

// ✅ NUEVO: token para DEV (Bearer) en sessionStorage (más seguro que localStorage)
export const SS_TOKEN_KEY = "tptech_access_token";

// ✅ multi-tab events
export const LS_LOGOUT_KEY = "tptech_logout";
export const LS_AUTH_EVENT_KEY = "tptech_auth_event";

type AuthEvent = { type: "LOGIN" | "LOGOUT"; at: number };

function emitAuthEvent(ev: AuthEvent) {
  try {
    // legacy: marca logout (para listeners antiguos)
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
    // si storage está bloqueado, no rompemos la app
  }
}

function getToken(): string | null {
  // 1) DEV: sessionStorage
  try {
    const t = sessionStorage.getItem(SS_TOKEN_KEY);
    if (t) return t;
  } catch {}

  // 2) legacy: localStorage
  try {
    const t = localStorage.getItem(LS_TOKEN_KEY);
    if (t) return t;
  } catch {}

  return null;
}

/**
 * Limpia tokens y emite evento LOGOUT global (multi-tab).
 * OJO: si desde AuthContext también emitís evento, vas a duplicar.
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
  // si ya viene absoluta, la dejamos
  if (/^https?:\/\//i.test(path)) return path;

  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Extensión de RequestInit que permite:
 * - body como objeto/array (lo serializa a JSON)
 * - body como string/FormData/etc (lo manda tal cual)
 */
export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: any;
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

/**
 * apiFetch
 * - default T = any
 * - si options.body es objeto/array -> JSON.stringify
 * - si 401 -> forceLogout (multi-tab) + throw
 * - soporta FormData (avatar) sin setear Content-Type
 *
 * ✅ IMPORTANTÍSIMO: GET por defecto va con cache:"no-store"
 * para evitar pantallas con datos viejos al navegar.
 */
export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const token = getToken();

  const headers = new Headers(options.headers as any);

  // ✅ Bearer token (si no está ya seteado)
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // ⚠️ GET/HEAD no deberían llevar body
  const method = String(options.method || "GET").toUpperCase();
  const allowBody = method !== "GET" && method !== "HEAD";

  let bodyToSend: BodyInit | undefined = undefined;

  if (allowBody && options.body !== undefined) {
    const b = options.body;

    if (isFormData(b) || isURLSearchParams(b)) {
      bodyToSend = b;
      // ✅ NO setear Content-Type: el browser lo hace (boundary)
    } else if (typeof b === "string") {
      bodyToSend = b;
      if (!headers.has("Content-Type")) headers.set("Content-Type", "text/plain;charset=UTF-8");
    } else if (isBlob(b)) {
      bodyToSend = b;
      // no forzar content-type
    } else if (isArrayBuffer(b)) {
      bodyToSend = b as any;
      // no forzar content-type
    } else if (isJsonSerializable(b)) {
      bodyToSend = JSON.stringify(b);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    } else {
      // fallback: mandarlo tal cual, PERO sin inventar content-type
      bodyToSend = b as any;
    }
  }

  // ✅ Evitar datos viejos al navegar: GET sin cache por defecto
  const cacheOpt: RequestCache | undefined =
    options.cache !== undefined ? options.cache : method === "GET" ? "no-store" : undefined;

  const res = await fetch(joinUrl(API_URL, path), {
    ...options,
    method,
    headers,
    body: bodyToSend,
    cache: cacheOpt,
    credentials: "include", // ✅ prod cookie; local no molesta
  });

  // ✅ sesión inválida → logout global (multi-tab)
  if (res.status === 401) {
    forceLogout();
    throw new Error("Sesión expirada");
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
      payload = await res.text();
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
}
