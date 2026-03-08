// src/components/ui/TPTable.tsx
import type { ReactNode } from "react";
import { cn } from "./tp";

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
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={cn("transition hover:bg-surface2/40", className)}>{children}</tr>;
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
   TABLE WRAPPER
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
  return <thead className={cn("bg-surface2 text-xs uppercase tracking-wide text-muted", className)}>{children}</thead>;
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
  return <th style={style} className={cn("px-3 py-3 text-left font-semibold whitespace-nowrap md:px-5", className)}>{children}</th>;
}

/* =========================================================
   TD
========================================================= */
export function TPTd({
  children,
  className,
  colSpan,
  label,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
  label?: string;
}) {
  return (
    <td colSpan={colSpan} data-label={label || undefined} className={cn("px-3 py-3 align-middle md:px-5", className)}>
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
    <div className={cn("max-h-[320px] overflow-y-auto overscroll-y-contain touch-pan-y md:max-h-[420px]", className)} style={{ WebkitOverflowScrolling: "touch" as any }}>
      {children}
    </div>
  );
}

/* =========================================================
   WRAPPER PRINCIPAL
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
        // ✅ MOBILE: espacio para que se note card vs card + que la sombra no se corte
        "p-3 overflow-visible bg-surface2/10",
        // ✅ DESKTOP: como antes
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
  return <div className={cn("border-t border-border px-4 py-3 text-xs text-muted md:px-5", className)}>{children}</div>;
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
            // thead oculto en mobile
            "[&>thead]:hidden md:[&>thead]:table-header-group " +
            // sin líneas entre rows en mobile (evita “doble línea”)
            "[&>tbody]:divide-y-0 md:[&>tbody]:divide-y md:[&>tbody]:divide-border " +
            // rows como cards en mobile
            "[&>tbody>tr]:block md:[&>tbody>tr]:table-row " +
            "[&>tbody>tr]:rounded-2xl [&>tbody>tr]:border [&>tbody>tr]:border-border [&>tbody>tr]:bg-card " +
            "[&>tbody>tr]:mb-3 [&>tbody>tr:last-child]:mb-0 " +
            // sombra y separación bien marcada
            "[&>tbody>tr]:shadow-[0_10px_24px_rgba(0,0,0,0.12)] [&>tbody>tr]:ring-1 [&>tbody>tr]:ring-black/5 " +
            // padding del card (no del wrapper)
            "[&>tbody>tr]:px-3 [&>tbody>tr]:py-2 " +
            // desktop vuelve a normal
            "md:[&>tbody>tr]:mb-0 md:[&>tbody>tr]:rounded-none md:[&>tbody>tr]:border-0 md:[&>tbody>tr]:bg-transparent md:[&>tbody>tr]:shadow-none md:[&>tbody>tr]:ring-0 md:[&>tbody>tr]:px-0 md:[&>tbody>tr]:py-0 " +
            // celdas apiladas
            "[&>tbody>tr>td]:block md:[&>tbody>tr>td]:table-cell " +
            "[&>tbody>tr>td]:px-0 md:[&>tbody>tr>td]:px-5 " +
            "[&>tbody>tr>td]:py-2 md:[&>tbody>tr>td]:py-3 " +
            // label arriba en mobile
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