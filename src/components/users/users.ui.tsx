// tptech-frontend/src/components/users/users.ui.tsx
import React from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}

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
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
        {desc ? <div className="text-xs text-muted mt-0.5">{desc}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  wide,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className={cn(
          "relative w-full rounded-2xl border border-border bg-card shadow-soft",
          wide ? "max-w-6xl" : "max-w-4xl",
          "max-h-[85vh] flex flex-col"
        )}
      >
        <div className="p-6 pb-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="tp-btn" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>

        <div className="p-6 pt-4 overflow-y-auto tp-scroll">{children}</div>
      </div>
    </div>
  );
}

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

export function absUrl(u: string) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const API = base.replace(/\/+$/, "");
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API}${p}`;
}

/* =========================
   Tabs UI
========================= */
export type TabKey = "DATA" | "CONFIG";

export function Tabs({ value, onChange }: { value: TabKey; onChange: (v: TabKey) => void }) {
  return (
    <div className="tp-card p-1 flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange("DATA")}
        className={cn(
          "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
          value === "DATA"
            ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]"
            : "hover:bg-surface2"
        )}
      >
        Datos del usuario
      </button>
      <button
        type="button"
        onClick={() => onChange("CONFIG")}
        className={cn(
          "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
          value === "CONFIG"
            ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]"
            : "hover:bg-surface2"
        )}
      >
        Configuración del usuario
      </button>
    </div>
  );
}
