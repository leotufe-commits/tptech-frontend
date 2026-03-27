// src/components/ui/TPPagination.tsx
// Barra de paginación reutilizable — estilo TP.
// Incluye: selector de filas por página, rango visible y botones de navegación.

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "./tp";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../hooks/usePagination";

export interface TPPaginationProps {
  /** Página actual (1-indexed). */
  page: number;
  pageSize: number;
  /** Total de ítems (para calcular el rango y la última página). */
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
  /** Label opcional a la izquierda (ej: "12 vendedores"). */
  countLabel?: string;
  className?: string;
}

export function TPPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  countLabel,
  className,
}: TPPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
        "border-t border-border bg-card px-4 py-3 text-xs text-muted md:px-5",
        className
      )}
    >
      {/* ── Izquierda: label ─────────────────────────────────────────────── */}
      <div className="flex items-center">
        {countLabel && (
          <span className="font-medium text-text">{countLabel}</span>
        )}
      </div>

      {/* ── Derecha: selector + rango + navegación ────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {total === 0 ? "Sin resultados" : `${from}–${to} de ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <NavBtn
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            title="Primera página"
          >
            <ChevronsLeft size={13} />
          </NavBtn>
          <NavBtn
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            title="Página anterior"
          >
            <ChevronLeft size={13} />
          </NavBtn>
          <NavBtn
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            title="Página siguiente"
          >
            <ChevronRight size={13} />
          </NavBtn>
          <NavBtn
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            title="Última página"
          >
            <ChevronsRight size={13} />
          </NavBtn>
        </div>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          className={cn(
            "rounded-lg border border-border bg-surface2 px-2 py-1",
            "text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
          )}
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ── Botón de navegación interno ──────────────────────────────────────────── */
function NavBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg border border-border transition-colors",
        disabled
          ? "cursor-not-allowed opacity-35 bg-card"
          : "bg-card hover:bg-surface2 hover:text-text cursor-pointer"
      )}
    >
      {children}
    </button>
  );
}
