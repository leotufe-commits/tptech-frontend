// src/components/ui/TPCard.tsx
import React from "react";
import { cn } from "./tp";

type Props = {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;

  /** className del contenedor card */
  className?: string;

  /** className del header (fila título/derecha) */
  headerClassName?: string;

  /** className del wrapper del título */
  titleClassName?: string;

  /** className del wrapper del right */
  rightClassName?: string;

  /** className del body (zona children) */
  bodyClassName?: string;

  /** si querés separar header con línea */
  divider?: boolean;
};

export function TPCard({
  title,
  right,
  children,
  className,

  headerClassName,
  titleClassName,
  rightClassName,
  bodyClassName,

  divider = false,
}: Props) {
  const hasHeader = Boolean(title || right);

  return (
    <div className={cn("rounded-2xl border border-border bg-card", className)}>
      {hasHeader ? (
        <div
          className={cn(
            "flex items-start justify-between gap-3 px-4 pt-4",
            divider ? "pb-3 border-b border-border" : "pb-0",
            headerClassName
          )}
        >
          <div className={cn("min-w-0", titleClassName)}>
            {/* si title es JSX, no lo forzamos a text-sm/semibold acá (lo decide el caller) */}
            {typeof title === "string" || typeof title === "number" ? (
              <div className="truncate text-sm font-semibold text-text">{title}</div>
            ) : (
              <div className="min-w-0">{title}</div>
            )}
          </div>

          {right ? (
            <div className={cn("shrink-0 text-xs text-muted", rightClassName)}>{right}</div>
          ) : null}
        </div>
      ) : null}

      <div className={cn("p-4", hasHeader && !divider ? "pt-3" : "", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

export default TPCard;