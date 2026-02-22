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
   HEADER SUPERIOR (título + acciones)
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
        "flex flex-col gap-3 border-b border-border bg-surface2/30 px-5 py-4",
        "md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="text-sm font-medium text-text">{left}</div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
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
export function TPTableEl({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
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
}: {
  children: ReactNode;
  className?: string;
}) {
  return <th className={cn("px-5 py-3 font-semibold whitespace-nowrap", className)}>{children}</th>;
}

/* =========================================================
   THEAD (gris sistema + sticky listo)
   ✅ Por defecto NO es sticky (no todas las tablas lo necesitan)
   ✅ Para sticky: pasás className="sticky top-0 z-20"
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
   TD
========================================================= */
export function TPTd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={cn("px-5 py-3 align-middle", className)}>{children}</td>;
}

/* =========================================================
   WRAP CON SCROLL VERTICAL (para tablas con max-h)
   ✅ Este es el contenedor que debe tener el overflow-y-auto
   ✅ Mantiene el recorte (rounded) y permite sticky header
========================================================= */
export function TPTableScrollY({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("max-h-[420px] overflow-y-auto", className)}>{children}</div>;
}

/* =========================================================
   WRAP PRINCIPAL
   ✅ Volvemos a overflow-hidden para corregir vértices/bordes
   ✅ Sticky NO se rompe si el scroll vertical NO vive acá por defecto
      (para scroll vertical usás TPTableScrollY de abajo)
========================================================= */
export function TPTableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      {children}
    </div>
  );
}
