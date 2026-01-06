// FRONTEND
// tptech-frontend/src/lib/api.ts

const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";

const LS_TOKEN_KEY = "tptech_token";
const LS_LOGOUT_KEY = "tptech_logout";
const LS_AUTH_EVENT_KEY = "tptech_auth_event";

function forceLogout() {
  localStorage.removeItem(LS_TOKEN_KEY);

  // evento legacy (storage event)
  localStorage.setItem(LS_LOGOUT_KEY, String(Date.now()));

  // evento unificado (LOGIN/LOGOUT)
  localStorage.setItem(LS_AUTH_EVENT_KEY, JSON.stringify({ type: "LOGOUT", at: Date.now() }));

  // BroadcastChannel (si existe)
  if ("BroadcastChannel" in window) {
    const bc = new BroadcastChannel("tptech_auth");
    bc.postMessage({ type: "LOGOUT" });
    bc.close();
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(LS_TOKEN_KEY);

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // ✅ Bearer token (fallback/robusto)
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include", // compatible con cookies ahora o futuro
  });

  // ✅ sesión inválida → logout global (multi-tab)
  if (res.status === 401) {
    forceLogout();
    throw new Error("Sesión expirada");
  }

  if (res.status === 204) {
    return undefined as T;
  }

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
