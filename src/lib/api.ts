// tptech-frontend/src/lib/api.ts

const RAW_API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";

// normaliza: sin slash final
const API_URL = RAW_API_URL.replace(/\/+$/, "");

export const LS_TOKEN_KEY = "tptech_token";
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

export function forceLogout() {
  // si ya está deslogueado, igual emito evento para sincronizar pestañas
  try {
    localStorage.removeItem(LS_TOKEN_KEY);
  } catch {}

  emitAuthEvent({ type: "LOGOUT", at: Date.now() });
}

function joinUrl(base: string, path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = (() => {
    try {
      return localStorage.getItem(LS_TOKEN_KEY);
    } catch {
      return null;
    }
  })();

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // ✅ Bearer token (fallback/robusto)
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(joinUrl(API_URL, path), {
    ...options,
    headers,
    credentials: "include",
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
    } catch {}
  } else {
    try {
      payload = await res.text();
    } catch {}
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
