// tptech-frontend/src/pages/configuracion-sistema/catalogs.ui.tsx
import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* =========================
   UI: Pill / Badge
========================= */
export function Pill({ children, tone }: { children: React.ReactNode; tone?: "neutral" | "ok" | "off" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "off"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : "border-border bg-surface2 text-muted";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {children}
    </span>
  );
}

/* =========================
   UI: Modal (local)
========================= */
export function ModalShell({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40" onMouseDown={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-[9999] grid place-items-center p-4">
        <div
          className="w-full max-w-[520px] rounded-2xl border border-border bg-card shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">{title}</div>
              <div className="mt-0.5 text-xs text-muted">{subtitle || "Completá los campos y guardá."}</div>
            </div>

            <button
              type="button"
              className="tp-btn-secondary h-10 w-10 !p-0 grid place-items-center"
              onClick={onClose}
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-4">{children}</div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>
        </div>
      </div>
    </>,
    document.body
  );
}
