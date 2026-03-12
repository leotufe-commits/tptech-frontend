// src/components/ui/TPStatusPill.tsx
import { cn } from "./tp";

/**
 * Pill de estado Activo / Inactivo para usar en tablas y modales.
 * Reemplaza las definiciones locales de StatusPill en cada pantalla.
 */
export function TPStatusPill({
  active,
  activeLabel = "Activo",
  inactiveLabel = "Inactivo",
  className,
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        active
          ? "bg-green-500/15 text-green-600 dark:text-green-400"
          : "bg-red-500/10 text-red-500 dark:text-red-400",
        className
      )}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export default TPStatusPill;
