// tptech-frontend/src/lib/api.ts

const RAW_API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";

// normaliza: sin slash final
const API_URL = RAW_API_URL.replace(/\/+$/, "");

// ✅ legacy (si ya venías guardando token ahí)
export const LS_TOKEN_KEY = "tptech_token";

// ✅ NUEVO: token para DEV (Bearer) en sessionStorage (más seguro que localStorage)
export const SS_TOKEN_KEY = "tptech_access_token";

export const LS_LOGOUT_KEY = "tptech_logout";
export const LS_AUTH_EVENT_KEY = "tptech_auth_event";

type AuthEvent = { type: "LOGIN" | "LOGOUT"; at: number };

function emitAuthEvent(ev: AuthEvent) {
  try {
    // evento legacy (storage event)
    if (ev.type === "LOGOUT") localStorage.setItem(LS_LOGOUT_KEY, String(ev.at));

    // evento unificado (LOGIN/LOGOUT)
    localStorage.setItem(LS_AUTH_EVENT_KEY, JSON.stringify(ev));

    // BroadcastChannel (si existe)
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("tptech_auth");
      bc.postMessage(ev);
      bc.close();
    }
  } catch {
    // si localStorage está bloqueado, no rompemos la app
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

export function forceLogout() {
  // limpiamos tokens en ambos storage (DEV + legacy)
  try {
    sessionStorage.removeItem(SS_TOKEN_KEY);
  } catch {}

  try {
    localStorage.removeItem(LS_TOKEN_KEY);
  } catch {}

  emitAuthEvent({ type: "LOGOUT", at: Date.now() });
}

function joinUrl(base: string, path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Extensión de RequestInit que permite:
 * - body como objeto (lo serializa a JSON)
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

function isPlainObject(body: any) {
  if (!body) return false;
  if (typeof body !== "object") return false;
  if (Array.isArray(body)) return true; // arrays también se serializan
  // evita serializar cosas raras
  if (isFormData(body) || isURLSearchParams(body) || isBlob(body) || isArrayBuffer(body)) return false;
  return true;
}

/**
 * apiFetch
 * - default T = any (para que no te devuelva unknown)
 * - si options.body es objeto/array -> JSON.stringify
 * - si 401 -> forceLogout (multi-tab) + throw
 */
export async function apiFetch<T = any>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = getToken();

  const headers = new Headers(options.headers || {});

  // ✅ Bearer token (robusto)
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Body: si es objeto/array lo mandamos como JSON
  let bodyToSend: BodyInit | undefined = undefined;

  if (options.body !== undefined) {
    if (isFormData(options.body) || isURLSearchParams(options.body)) {
      bodyToSend = options.body;
      // no seteamos content-type: el browser lo hace solo
    } else if (typeof options.body === "string") {
      bodyToSend = options.body;
      if (!headers.has("Content-Type")) headers.set("Content-Type", "text/plain;charset=UTF-8");
    } else if (isBlob(options.body)) {
      bodyToSend = options.body;
      // no forzamos content-type
    } else if (isArrayBuffer(options.body)) {
      bodyToSend = options.body as any;
      // no forzamos content-type
    } else if (isPlainObject(options.body)) {
      bodyToSend = JSON.stringify(options.body);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    } else {
      // fallback: intentamos mandarlo tal cual
      bodyToSend = options.body as any;
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    }
  } else {
    // ✅ si no hay body y no hay content-type, NO lo forzamos.
  }

  const res = await fetch(joinUrl(API_URL, path), {
    ...options,
    headers,
    body: bodyToSend,
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
