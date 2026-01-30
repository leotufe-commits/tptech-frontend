// tptech-frontend/src/lib/url.ts

/**
 * Convierte URLs relativas ("/uploads/...") en absolutas hacia el backend.
 * Si ya es "http/https", la deja igual.
 */
export function absUrl(u?: string | null) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";

  return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`;
}
