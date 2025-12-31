const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("tptech_token"); // ✅ misma key que tu Login

  const headers = new Headers(options.headers || {});
  // Si ya te mandan content-type desde algún lado, no lo pises
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {}
    throw new Error(payload?.message || `HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}
