// tptech-frontend/src/components/ui/TPSectionShell.tsx
import React from "react";
import { cn } from "./tp";

export type TPSectionShellProps = {
  title: string;

  /** Texto secundario (lo usás como subtitle en varias pantallas) */
  subtitle?: string;

  /** Compatibilidad con pantallas viejas */
  description?: string;

  /** Icono opcional a la izquierda del título */
  icon?: React.ReactNode;

  /** Contenido a la derecha del header (botones, acciones, etc.) */
  right?: React.ReactNode;

  children: React.ReactNode;
  className?: string;
};

export function TPSectionShell({
  title,
  subtitle,
  description,
  icon,
  right,
  children,
  className,
}: TPSectionShellProps) {
  const desc = subtitle ?? description;

  return (
    <div className={cn("space-y-4 w-full", className)}>
      {/* Header */}
      <div className="flex w-full items-start justify-between gap-4">
        {/* Título + descripción */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {icon ? <div className="text-muted">{icon}</div> : null}
            <h1 className="text-2xl font-semibold text-text">
              {title}
            </h1>
          </div>

          {desc ? (
            <p className="text-sm text-muted">
              {desc}
            </p>
          ) : null}
        </div>

        {/* Acciones a la derecha */}
        {right ? (
          <div className="flex items-center gap-2 shrink-0">
            {right}
          </div>
        ) : null}
      </div>

      {/* Contenido */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}

export default TPSectionShell;