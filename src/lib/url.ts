export function absUrl(u?: string | null) {
  const raw = String(u || "").trim();
  if (!raw) return "";

  // ya absoluta
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const API = base.replace(/\/+$/, "");

  let cleaned = raw;

  // 🔥 FIX CLAVE
  // backend sirve archivos en /uploads, NUNCA en /api/uploads
  if (cleaned.startsWith("/api/")) {
    cleaned = cleaned.slice(4); // quita "/api"
  }

  // garantiza slash inicial
  if (!cleaned.startsWith("/")) {
    cleaned = `/${cleaned}`;
  }

  return `${API}${cleaned}`;
}
