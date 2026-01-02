// src/components/ui/TPTable.tsx
import type { ReactNode } from "react";
import { cn } from "./tp";

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

/** Header superior de la tabla (título/contador + acciones opcionales) */
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
        "flex flex-col gap-3 border-b border-border bg-surface2/30 px-5 py-4 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="text-sm font-medium text-text">{left}</div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function TPTableEl({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function TPThead({ children }: { children: ReactNode }) {
  return <thead className="bg-surface2 text-xs uppercase text-muted">{children}</thead>;
}

export function TPTbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TPTr({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={cn("hover:bg-surface2/40", className)}>{children}</tr>;
}

export function TPTh({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <th className={cn("px-5 py-3 font-semibold", className)}>{children}</th>;
}

export function TPTd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={cn("px-5 py-3", className)}>{children}</td>;
}

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
