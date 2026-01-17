// src/components/ui/TPBadges.tsx
import { cn } from "./tp";
import type { TipoMov } from "../../context/InventoryContext";

type Size = "sm" | "md";

function sizeClass(size: Size) {
  return size === "sm" ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-xs";
}

/** Stock badge (0 gris / 1-5 primary / 6+ verde) */
export function TPStockBadge({ n, size = "md" }: { n: number; size?: Size }) {
  const base = cn("rounded-full font-semibold border", sizeClass(size));

  if (n === 0) {
    return <span className={cn(base, "bg-surface2 text-muted border-border")}>0</span>;
  }
  if (n <= 5) {
    return <span className={cn(base, "bg-primary/10 text-primary border-primary/20")}>{n}</span>;
  }
  return (
    <span className={cn(base, "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
      {n}
    </span>
  );
}

/** Stock “label” (Sin stock / Bajo (n) / n u.) */
export function TPStockLabelBadge({
  n,
  low = 2,
  size = "md",
}: {
  n: number;
  low?: number;
  size?: Size;
}) {
  const base = cn("rounded-full font-semibold border", sizeClass(size));

  if (n === 0) {
    return <span className={cn(base, "bg-surface2 text-muted border-border")}>Sin stock</span>;
  }
  if (n <= low) {
    return (
      <span className={cn(base, "bg-primary/10 text-primary border-primary/20")}>
        Bajo ({n})
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
      {n} u.
    </span>
  );
}

/** Activo / Inactivo */
export function TPActiveBadge({ active, size = "md" }: { active: boolean; size?: Size }) {
  const base = cn("rounded-full font-semibold border", sizeClass(size));
  return (
    <span
      className={cn(
        base,
        active
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-surface2 text-muted border-border"
      )}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

/**
 * ✅ Estado usuario (ACTIVE/PENDING/BLOCKED → Activo/Inactivo/Inactivo)
 * Requisito: en UI NO mostramos "Bloqueado".
 */
export function TPUserStatusBadge({
  status,
  size = "md",
}: {
  status: "ACTIVE" | "PENDING" | "BLOCKED";
  size?: Size;
}) {
  const base = cn("rounded-full font-semibold border", sizeClass(size));

  if (status === "ACTIVE") {
    return (
      <span className={cn(base, "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
        Activo
      </span>
    );
  }

  return <span className={cn(base, "bg-surface2 text-muted border-border")}>Inactivo</span>;
}

/** Tipo movimiento */
export function TPTipoMovBadge({ tipo, size = "md" }: { tipo: TipoMov; size?: Size }) {
  const base = cn("rounded-full font-semibold border", sizeClass(size));

  if (tipo === "Entrada") {
    return (
      <span className={cn(base, "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
        Entrada
      </span>
    );
  }
  if (tipo === "Salida") {
    return <span className={cn(base, "bg-red-500/10 text-red-400 border-red-500/20")}>Salida</span>;
  }
  return (
    <span className={cn(base, "bg-primary/10 text-primary border-primary/20")}>Ajuste</span>
  );
}
