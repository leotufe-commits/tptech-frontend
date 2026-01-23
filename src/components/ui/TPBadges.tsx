// src/components/ui/TPBadges.tsx
import { cn } from "./tp";
import type { TipoMov } from "../../context/InventoryContext";

type Size = "sm" | "md";

function sizeClass(size: Size) {
  return size === "sm" ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-xs";
}

/* =========================
   ✅ Segmented Pills (GLOBAL) – DISEÑO MUY SUTIL
   - Sin contenedor
   - Activo: color (rojo / verde) sin relleno fuerte
   - Inactivo: gris secundario (NUNCA blanco)
   - Jerarquía visual clara
========================= */
export function TPSegmentedPills({
  value,
  onChange,
  disabled,
  labels = { off: "Deshabilitado", on: "Habilitado" },
  size = "md",
  className,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  labels?: { on: string; off: string };
  size?: Size;
  className?: string;
}) {
  const dis = !!disabled;

  const base = cn(
    "inline-flex items-center rounded-full font-semibold select-none transition-colors",
    "border",
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
    size === "sm" ? "px-3 py-1 text-xs" : "px-3 py-1.5 text-xs",
    dis && "opacity-50 cursor-not-allowed"
  );

  // OFF (activo cuando value=false)
  const offBtn = cn(
    base,
    !value
      ? "border-red-500/45 text-red-300 hover:bg-red-500/5"
      : "border-border/50 bg-surface2/60 text-muted/80 hover:bg-surface2/70"
  );

  // ON (activo cuando value=true)
  const onBtn = cn(
    base,
    value
      ? "border-emerald-500/45 text-emerald-300 hover:bg-emerald-500/5"
      : "border-border/50 bg-surface2/60 text-muted/80 hover:bg-surface2/70"
  );

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        disabled={dis}
        onClick={() => {
          if (!dis) onChange(false);
        }}
        className={offBtn}
        title={labels.off}
      >
        {labels.off}
      </button>

      <button
        type="button"
        disabled={dis}
        onClick={() => {
          if (!dis) onChange(true);
        }}
        className={onBtn}
        title={labels.on}
      >
        {labels.on}
      </button>
    </div>
  );
}

/** Stock badge (0 gris / 1-5 primary / 6+ verde) */
export function TPStockBadge({ n, size = "md" }: { n: number; size?: Size }) {
  const base = cn("rounded-full font-semibold border", sizeClass(size));

  if (n === 0) {
    return <span className={cn(base, "bg-surface2/80 text-text/70 border-border")}>0</span>;
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

/** Stock “label” */
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
    return <span className={cn(base, "bg-surface2/80 text-text/70 border-border")}>Sin stock</span>;
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
          : "bg-surface2/80 text-text/70 border-border"
      )}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

/** Estado usuario */
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

  return <span className={cn(base, "bg-surface2/80 text-text/70 border-border")}>Inactivo</span>;
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
  return <span className={cn(base, "bg-primary/10 text-primary border-primary/20")}>Ajuste</span>;
}
