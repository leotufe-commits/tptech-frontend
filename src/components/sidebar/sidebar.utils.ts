// src/components/sidebar/sidebar.utils.ts
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Convierte URLs relativas ("/uploads/...") en absolutas hacia el backend.
 * Si ya es "http/https", la deja igual.
 */
export function absUrl(u: string) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const API = base.replace(/\/+$/, "");
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API}${p}`;
}

export function getInitials(name: string) {
  const s = String(name || "").trim();
  if (!s) return "TP";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "T";
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? "P") || "P";
  return (a + b).toUpperCase();
}

export const JEWELRY_LOGO_EVENT = "tptech:jewelry_logo_changed";
export const USER_AVATAR_EVENT = "tptech:user_avatar_changed";

export const COLLAPSED_W = 84;

export function isChildPathActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}
