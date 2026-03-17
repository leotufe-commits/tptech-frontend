// src/components/ui/TPCard.tsx
import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
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

  /** hace que el header sea clickeable y oculte/muestre el body */
  collapsible?: boolean;

  /** estado inicial cuando collapsible=true (default: true = expandido) */
  defaultOpen?: boolean;
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
  collapsible = false,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const hasHeader = Boolean(title || right);
  const isOpen = collapsible ? open : true;

  return (
    <div className={cn("rounded-2xl border border-border bg-card", className)}>
      {hasHeader ? (
        <div
          className={cn(
            "flex items-start justify-between gap-3 px-4 pt-4",
            divider || (collapsible && isOpen) ? "pb-3 border-b border-border" : "pb-0",
            collapsible && !isOpen && "pb-4",
            collapsible && "cursor-pointer select-none",
            headerClassName
          )}
          onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        >
          <div className={cn("min-w-0", titleClassName)}>
            {typeof title === "string" || typeof title === "number" ? (
              <div className="truncate text-sm font-semibold text-text">{title}</div>
            ) : (
              <div className="min-w-0">{title}</div>
            )}
          </div>

          <div className={cn("flex items-center gap-2 shrink-0")}>
            {right ? (
              <div className={cn("text-xs text-muted", rightClassName)}>{right}</div>
            ) : null}
            {collapsible && (
              <ChevronDown
                size={15}
                className={cn(
                  "text-muted transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            )}
          </div>
        </div>
      ) : null}

      {isOpen && (
        <div className={cn("p-4", hasHeader && !divider ? "pt-3" : "", bodyClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}

export default TPCard;