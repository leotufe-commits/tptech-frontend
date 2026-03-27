// src/components/ui/TPTable.tsx
import React, { useMemo, useEffect, type ReactNode } from "react";
import { cn } from "./tp";
import { TPPagination } from "./TPPagination";
import { usePagination, type PaginationConfig } from "../../hooks/usePagination";

/* =========================================================
   EMPTY ROW
========================================================= */
export function TPEmptyRow({
  colSpan,
  text = "No hay resultados.",
}: {
  colSpan: number;
  text?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-muted">
        {text}
      </td>
    </tr>
  );
}

/* =========================================================
   HEADER SUPERIOR
========================================================= */
export function TPTableHeader({
  left,
  right,
  className,
}: {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border bg-surface2/30 px-4 py-4",
        "md:flex-row md:items-center md:justify-between md:px-5",
        className
      )}
    >
      <div className="text-sm font-medium text-text">{left}</div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* =========================================================
   ROW
========================================================= */
export function TPTr({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLTableRowElement>;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition hover:bg-surface2/40",
        onClick && "cursor-pointer hover:bg-primary/5 active:bg-primary/10",
        className
      )}
    >
      {children}
    </tr>
  );
}

/* =========================================================
   SCROLL HORIZONTAL
========================================================= */
export function TPTableXScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-card to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-card to-transparent" />
      <div
        className="w-full max-w-full overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent"
        style={{ WebkitOverflowScrolling: "touch" as any }}
      >
        {children}
      </div>
    </div>
  );
}

/* =========================================================
   TABLE WRAPPER (div interno)
========================================================= */
export function TPTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("w-full min-w-0 max-w-full", className)}>{children}</div>;
}

/* =========================================================
   THEAD
========================================================= */
export function TPThead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <thead className={cn("bg-surface2 text-xs uppercase tracking-wide text-muted", className)}>
      {children}
    </thead>
  );
}

/* =========================================================
   TBODY
========================================================= */
export function TPTbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

/* =========================================================
   TH
========================================================= */
export function TPTh({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={style}
      className={cn("px-3 py-3 text-left font-semibold whitespace-nowrap md:px-5", className)}
    >
      {children}
    </th>
  );
}

/* =========================================================
   TD
========================================================= */
export function TPTd({
  children,
  className,
  colSpan,
  label,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
  label?: string;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
}) {
  return (
    <td
      colSpan={colSpan}
      data-label={label || undefined}
      onClick={onClick}
      className={cn("px-3 py-3 align-middle md:px-5", className)}
    >
      {children}
    </td>
  );
}

/* =========================================================
   SCROLL VERTICAL
========================================================= */
export function TPTableScrollY({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-h-[320px] overflow-y-auto overscroll-y-contain touch-pan-y md:max-h-[420px]",
        className
      )}
      style={{ WebkitOverflowScrolling: "touch" as any }}
    >
      {children}
    </div>
  );
}

/* =========================================================
   WRAPPER PRINCIPAL (card exterior)
========================================================= */
export function TPTableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-2xl border border-border bg-card",
        "p-3 overflow-visible bg-surface2/10",
        "md:p-0 md:overflow-hidden md:bg-card",
        className
      )}
    >
      {children}
    </div>
  );
}

/* =========================================================
   FOOTER
========================================================= */
export function TPTableFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-border px-4 py-3 text-xs text-muted md:px-5", className)}>
      {children}
    </div>
  );
}

/* =========================================================
   TABLE ELEMENT
========================================================= */
type ResponsiveMode = "scroll" | "stack";

export function TPTableElBase({
  children,
  className,
  responsive = "scroll",
}: {
  children: ReactNode;
  className?: string;
  responsive?: ResponsiveMode;
}) {
  const isStack = responsive === "stack";

  return (
    <table
      className={cn(
        "w-full text-sm",

        !isStack && "min-w-[720px] md:min-w-0",

        isStack &&
          "min-w-0 " +
            "[&>thead]:hidden md:[&>thead]:table-header-group " +
            "[&>tbody]:divide-y-0 md:[&>tbody]:divide-y md:[&>tbody]:divide-border " +
            "[&>tbody>tr]:block md:[&>tbody>tr]:table-row " +
            "[&>tbody>tr]:rounded-2xl [&>tbody>tr]:border [&>tbody>tr]:border-border [&>tbody>tr]:bg-card " +
            "[&>tbody>tr]:mb-3 [&>tbody>tr:last-child]:mb-0 " +
            "[&>tbody>tr]:shadow-[0_10px_24px_rgba(0,0,0,0.12)] [&>tbody>tr]:ring-1 [&>tbody>tr]:ring-black/5 " +
            "[&>tbody>tr]:px-3 [&>tbody>tr]:py-2 " +
            "md:[&>tbody>tr]:mb-0 md:[&>tbody>tr]:rounded-none md:[&>tbody>tr]:border-0 md:[&>tbody>tr]:bg-transparent md:[&>tbody>tr]:shadow-none md:[&>tbody>tr]:ring-0 md:[&>tbody>tr]:px-0 md:[&>tbody>tr]:py-0 " +
            "[&>tbody>tr>td]:block md:[&>tbody>tr>td]:table-cell " +
            "[&>tbody>tr>td]:px-0 md:[&>tbody>tr>td]:px-5 " +
            "[&>tbody>tr>td]:py-2 md:[&>tbody>tr>td]:py-3 " +
            "[&>tbody>tr>td[data-label]::before]:content-[attr(data-label)] " +
            "[&>tbody>tr>td[data-label]::before]:text-xs " +
            "[&>tbody>tr>td[data-label]::before]:uppercase " +
            "[&>tbody>tr>td[data-label]::before]:tracking-wide " +
            "[&>tbody>tr>td[data-label]::before]:text-muted " +
            "[&>tbody>tr>td[data-label]::before]:block " +
            "[&>tbody>tr>td[data-label]::before]:mb-1",

        className
      )}
    >
      {children}
    </table>
  );
}

/* =========================================================
   ALIAS COMPATIBILIDAD
========================================================= */
export const TPTableEl = TPTable;

/* =========================================================
   TABLA PAGINADA AUTÓNOMA
   Uso: para pantallas que usan los primitivos directamente
   y quieren añadir paginación sin migrar a TPTableKit.
   ─────────────────────────────────────────────────────────
   <TPTablePaginated
     rows={rows}
     renderHead={() => <tr><TPTh>Nombre</TPTh></tr>}
     renderRow={(row) => <TPTr key={row.id}><TPTd>{row.name}</TPTd></TPTr>}
     colSpan={1}
     pagination
   />
========================================================= */
type TPTablePaginatedProps<T> = {
  rows: T[];
  /** Renderiza los <tr> del <thead>. Si se omite, no hay encabezado. */
  renderHead?: () => ReactNode;
  /** Renderiza cada fila. */
  renderRow: (row: T, index: number) => ReactNode;
  /** colSpan de la fila de "sin resultados". Default: 1. */
  colSpan?: number;
  emptyText?: string;
  loading?: boolean;
  /**
   * Label del footer.
   * - string → prefijado con el conteo: "3 vendedores"
   * - función → control total: (n) => `${n} vendedor${n !== 1 ? "es" : ""}`
   */
  countLabel?: string | ((n: number) => string);
  /**
   * Activa paginación local.
   * - `true`           → pageSize=25 por defecto
   * - `PaginationConfig` → configuración personalizada o modo controlado
   */
  pagination?: boolean | PaginationConfig;
  /** Nodo a la izquierda del header (ej: buscador). Omitir para ocultar header. */
  headerLeft?: ReactNode;
  /** Nodo a la derecha del header (ej: botón "Nuevo"). */
  actions?: ReactNode;
  /** Nodo entre el header y la tabla (ej: filtros). */
  belowHeader?: ReactNode;
  responsive?: "scroll" | "stack";
  className?: string;
};

export function TPTablePaginated<T>({
  rows,
  renderHead,
  renderRow,
  colSpan = 1,
  emptyText = "No hay resultados.",
  loading = false,
  countLabel,
  pagination,
  headerLeft,
  actions,
  belowHeader,
  responsive = "scroll",
  className,
}: TPTablePaginatedProps<T>) {
  const pag = usePagination(pagination);

  // ── Cálculos de paginación ───────────────────────────────────────────────
  const totalItems  = pag.enabled ? (pag.totalItems ?? rows.length) : rows.length;
  const totalPages  = pag.enabled ? Math.max(1, Math.ceil(totalItems / pag.pageSize)) : 1;
  // Clampear la página activa para evitar mostrar una página vacía
  const currentPage = pag.enabled ? Math.min(pag.page, totalPages) : 1;

  // Sincronizar estado después del render si la página quedó fuera de rango
  useEffect(() => {
    if (pag.enabled && pag.page > totalPages) {
      pag.setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const pageRows = useMemo(() => {
    if (!pag.enabled) return rows;
    if (pag.totalItems !== undefined) return rows; // controlado: el padre ya manda la página
    const start = (currentPage - 1) * pag.pageSize;
    return rows.slice(start, start + pag.pageSize);
  }, [rows, pag.enabled, pag.totalItems, currentPage, pag.pageSize]);

  // ── Texto del footer ─────────────────────────────────────────────────────
  const count = rows.length;
  const countStr =
    typeof countLabel === "function"
      ? countLabel(count)
      : countLabel
      ? `${count} ${countLabel}`
      : `${count} ${count === 1 ? "registro" : "registros"}`;

  const showHeader = !!(headerLeft || actions);

  return (
    <TPTableWrap className={className}>
      {showHeader && <TPTableHeader left={headerLeft} right={actions} />}
      {belowHeader}

      <TPTable>
        <TPTableXScroll>
          <TPTableElBase responsive={responsive}>
            {renderHead && <TPThead>{renderHead()}</TPThead>}
            <TPTbody>
              {loading ? (
                <TPEmptyRow colSpan={colSpan} text="Cargando…" />
              ) : pageRows.length === 0 ? (
                <TPEmptyRow colSpan={colSpan} text={emptyText} />
              ) : (
                pageRows.map((row, i) => renderRow(row, i))
              )}
            </TPTbody>
          </TPTableElBase>
        </TPTableXScroll>
      </TPTable>

      {pag.enabled ? (
        <TPPagination
          page={currentPage}
          pageSize={pag.pageSize}
          total={totalItems}
          onPageChange={pag.setPage}
          onPageSizeChange={pag.setPageSize}
          pageSizeOptions={pag.pageSizeOptions}
          countLabel={countStr}
        />
      ) : (
        <TPTableFooter>
          <span>{countStr}</span>
        </TPTableFooter>
      )}
    </TPTableWrap>
  );
}
