// tptech-frontend/src/components/users/users.utils.ts

/* ======================================================
   Types
====================================================== */
export type SortCol = "USER" | "STATUS" | "PIN" | "ROLES" | "FAV";
export type SortDir = "asc" | "desc";

export type AttachmentItem = {
  id: string;
  url?: string;
  filename: string;
  mimeType?: string;
  size?: number;
  createdAt?: string | Date;
};

/* ======================================================
   Fecha
====================================================== */
export function formatDateTime(v?: string | Date | null) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ======================================================
   Sort helpers
====================================================== */
export function norm(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

export function userLabel(u: any) {
  return String(u?.name || u?.email || "").trim();
}

export function statusLabel(u: any) {
  const s = String(u?.status || "").toUpperCase();
  if (s === "ACTIVE") return "activo";
  if (s === "PENDING") return "pendiente";
  if (s === "BLOCKED") return "inactivo";
  return s ? s.toLowerCase() : "";
}

export function specialCount(u: any): number {
  const c = Number(u?.overridesCount ?? u?.permissionOverridesCount ?? NaN);
  if (Number.isFinite(c)) return c;

  if (typeof u?.hasSpecialPermissions === "boolean") return u.hasSpecialPermissions ? 1 : 0;
  if (Array.isArray(u?.permissionOverrides)) return u.permissionOverrides.length;

  return 0;
}

export function hasSpecial(u: any) {
  return specialCount(u) > 0;
}

/* ======================================================
   Attachments
====================================================== */
export type AttInfo = { has: boolean; count: number; items?: AttachmentItem[] };

export function attachmentsCount(u: any): number {
  const c = Number(u?.attachmentsCount ?? u?.attachmentCount ?? NaN);
  if (Number.isFinite(c)) return c;

  if (typeof u?.hasAttachments === "boolean") return u.hasAttachments ? 1 : 0;
  if (Array.isArray(u?.attachments)) return u.attachments.length;

  return 0;
}

export function formatBytes(n?: number) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let x = v;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2;
  return `${x.toFixed(digits)} ${units[i]}`;
}

/* ======================================================
   Role helpers
====================================================== */
export function isOwnerRole(r: any, roleLabelFn?: (r: any) => string) {
  const code = String(r?.code ?? "").trim().toUpperCase();
  const name = String(r?.name ?? "").trim().toUpperCase();
  if (code === "OWNER" || name === "OWNER") return true;

  const label = roleLabelFn ? String(roleLabelFn(r) || "") : "";
  const l = label.trim().toLowerCase();
  if (l.includes("propietario") || l.includes("owner")) return true;

  return false;
}

export function isAdminRole(r: any, roleLabelFn?: (r: any) => string) {
  const code = String(r?.code ?? "").trim().toUpperCase();
  const name = String(r?.name ?? "").trim().toUpperCase();
  if (code === "ADMIN" || name === "ADMIN") return true;

  const label = roleLabelFn ? String(roleLabelFn(r) || "") : "";
  const l = label.trim().toLowerCase();
  if (l.includes("admin")) return true;

  return false;
}

export function roleTone(r: any, roleLabelFn?: (r: any) => string) {
  if (isOwnerRole(r, roleLabelFn)) return "warning";
  if (isAdminRole(r, roleLabelFn)) return "info";
  return "neutral";
}
