import React from "react";
import { cn } from "./tp";

export type TPTechPricingLoaderProps = {
  /** Si false, no renderiza nada (return null). */
  active: boolean;
  /** Texto opcional al lado del ícono. */
  label?: string;
  /** Tamaño del ícono. */
  size?: "sm" | "md";
  className?: string;
};

/**
 * TPTechPricingLoader — indicador inline de recálculo de pricing con
 * marca TPTech. Discreto, no bloquea pantalla, apto para cabeceras,
 * footers y zonas de validación.
 *
 * Composición visual: anillo rotando + iniciales "TP" en el centro.
 */
export function TPTechPricingLoader({
  active,
  label,
  size = "sm",
  className,
}: TPTechPricingLoaderProps) {
  if (!active) return null;
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const txt = size === "sm" ? "text-[7px]" : "text-[8px]";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-muted", className)}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Recalculando precios"}
    >
      <span className={cn("relative inline-flex items-center justify-center", dim)}>
        <span
          className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin"
          aria-hidden="true"
        />
        <span className={cn("font-bold leading-none text-primary", txt)} aria-hidden="true">
          TP
        </span>
      </span>
      {label ? <span className="text-[11px]">{label}</span> : null}
    </span>
  );
}

export default TPTechPricingLoader;
