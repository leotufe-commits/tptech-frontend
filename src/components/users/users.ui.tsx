import React from "react";
import { cn } from "../ui/tp";
import { absUrl } from "../../lib/url";

// 👇 re-export de compatibilidad (MUY IMPORTANTE)
export { cn, absUrl };


/* =========================
   Sort arrows (como Roles)
========================= */
export function SortArrows({
  dir,
  active,
  className,
}: {
  dir?: "asc" | "desc";
  active?: boolean;
  className?: string;
}) {
  const isActive = !!active;
  const upOn = isActive && dir === "asc";
  const dnOn = isActive && dir === "desc";

  return (
    <span className={cn("inline-flex flex-col leading-none ml-1 -mt-0.5", className)} aria-hidden="true">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M5 2 L8 5 H2 Z" fill="currentColor" opacity={upOn ? 1 : 0.35} />
      </svg>
      <svg width="10" height="10" viewBox="0 0 10 10" className="-mt-1">
        <path d="M5 8 L2 5 H8 Z" fill="currentColor" opacity={dnOn ? 1 : 0.35} />
      </svg>
    </span>
  );
}

/* =========================
   Section wrapper
========================= */
export function Section({
  title,
  desc,
  right,
  children,
}: {
  title: React.ReactNode;
  desc?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="tp-card p-4 w-full">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">{title}</div>
          {right ? <div className="shrink-0 ml-auto">{right}</div> : null}
        </div>
        {desc ? <div className="text-xs text-muted mt-0.5">{desc}</div> : null}
      </div>
      {children}
    </div>
  );
}

/* =========================
   Helpers
========================= */
export function initialsFrom(label: string) {
  const clean = (label || "").trim();
  if (!clean) return "U";
  const parts = clean.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

/* =========================
   Labels
========================= */
export const ROLE_LABEL: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MANAGER: "Encargado",
  STAFF: "Empleado",
  READONLY: "Solo lectura",

  READ_ONLY: "Solo lectura",
  READ_ONLY_USER: "Solo lectura",
  VIEWER: "Solo lectura",
};

export const MODULE_LABEL: Record<string, string> = {
  USERS_ROLES: "Usuarios y roles",
  INVENTORY: "Inventario",
  MOVEMENTS: "Movimientos",
  CLIENTS: "Clientes",
  SALES: "Ventas",
  SUPPLIERS: "Proveedores",
  PURCHASES: "Compras",
  CURRENCIES: "Monedas",
  COMPANY_SETTINGS: "Configuración",
  REPORTS: "Reportes",
  WAREHOUSES: "Almacenes",
  PROFILE: "Perfil",
};

export const ACTION_LABEL: Record<string, string> = {
  VIEW: "Ver",
  CREATE: "Crear",
  EDIT: "Editar",
  DELETE: "Eliminar",
  EXPORT: "Exportar",
  ADMIN: "Administrar",
};

export function roleLabel(raw: unknown) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const looksLikeCode = /^[A-Za-z0-9_]+$/.test(s);
  if (!looksLikeCode) return s;
  const code = s.toUpperCase();
  return ROLE_LABEL[code] ?? s;
}

export function permLabelByModuleAction(module?: string, action?: string) {
  const m = String(module || "");
  const a = String(action || "");
  const mLabel = MODULE_LABEL[m] ?? m;
  const aLabel = ACTION_LABEL[a] ?? a;
  return `${mLabel} • ${aLabel}`;
}

export function effectLabel(e: "ALLOW" | "DENY") {
  return e === "ALLOW" ? "Permitir" : "Denegar";
}

/* =========================
   General helpers
========================= */
export function normalizeUsersResponse(resp: unknown) {
  const r = resp as any;
  if (r && typeof r === "object" && Array.isArray(r.users)) {
    return {
      users: r.users,
      total: Number(r.total ?? r.users.length ?? 0),
      page: Number(r.page ?? 1),
      limit: Number(r.limit ?? r.users.length ?? 30),
    };
  }
  if (Array.isArray(r)) return { users: r, total: r.length, page: 1, limit: r.length };
  return { users: [], total: 0, page: 1, limit: 30 };
}

export function assertImageFile(file: File) {
  if (!file) throw new Error("Seleccioná un archivo");
  if (!file.type?.startsWith("image/")) throw new Error("El archivo debe ser una imagen");

  const MAX = 5 * 1024 * 1024;
  if (file.size > MAX) throw new Error("La imagen supera el máximo permitido (5MB)");
}

export function getErrorMessage(e: unknown, fallback: string) {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || fallback;
  const maybe = e as { message?: unknown };
  if (typeof maybe?.message === "string") return maybe.message;
  return fallback;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function safeFileLabel(name: string) {
  return String(name || "").trim() || "Archivo";
}

/* =========================
   Tabs UI
========================= */
export type TabKey = "DATA" | "CONFIG";

export function Tabs({
  value,
  onChange,
  dataBadge,
  configBadge,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
  dataBadge?: string;
  configBadge?: string;
}) {
  const BadgePill = ({ label }: { label: string }) => (
    <span
      className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in oklab, var(--card) 85%, var(--bg))",
        color: "var(--muted)",
      }}
    >
      {label}
    </span>
  );

  return (
    <div className="tp-card p-1 flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange("DATA")}
        className={cn(
          "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors inline-flex items-center justify-center",
          value === "DATA" ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]" : "hover:bg-surface2"
        )}
      >
        Datos del usuario
        {dataBadge ? <BadgePill label={dataBadge} /> : null}
      </button>

      <button
        type="button"
        onClick={() => onChange("CONFIG")}
        className={cn(
          "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors inline-flex items-center justify-center",
          value === "CONFIG" ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]" : "hover:bg-surface2"
        )}
      >
        Configuración del usuario
        {configBadge ? <BadgePill label={configBadge} /> : null}
      </button>
    </div>
  );
}
