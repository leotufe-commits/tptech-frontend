// src/components/sales/SaleCompositionEditableGrid/parts/_deprecated/SaleImpactBlock.tsx
// =============================================================================
// Fase 2.7.b — Bloque "Impacto en precio de venta".
//
// @deprecated Fase 6 — reemplazado por `<PriceFlowCards>`. Mantenido en el
// archivo por compatibilidad; ningún caller actual lo invoca. Candidato a
// eliminación tras 1-2 sprints de medición.
//
// Resumen agregado POR TIPO (Metal / Hechura) del pasaje de costo a venta.
// Usa exclusivamente los 6 campos canónicos de `pricingMeta`:
//   metalCost, metalSale, metalMarginPct
//   hechuraCost, hechuraSale, hechuraMarginPct
//
// Reglas:
//   · Cero matemática derivada — todos los números vienen del motor.
//   · Granularidad: tipo agregado, NO per cost-line (eso es Fase 2.7.d).
//   · Si los 4 valores Cost/Sale son null/0, el bloque se oculta.
//   · Para PRODUCT/SERVICE no hay sale-side per-tipo; el motor los funde
//     en hechura/extra según la lista — quedan fuera de este bloque.
// =============================================================================

import { cn } from "../../../../ui/tp";
import { formatByType, formatMoneyDoc as fmtMoney } from "../../../../../lib/pricing/format";

/** @deprecated Fase 6 — reemplazado por `<PriceFlowCards>`. */
export function SaleImpactBlock({
  metalCost, metalSale, metalMarginPct,
  hechuraCost, hechuraSale, hechuraMarginPct,
  currency,
}: {
  metalCost:        number | null;
  metalSale:        number | null;
  metalMarginPct:   number | null;
  hechuraCost:      number | null;
  hechuraSale:      number | null;
  hechuraMarginPct: number | null;
  currency:         string;
}) {
  const hasMetal   = (metalCost   != null && metalCost   !== 0) || (metalSale   != null && metalSale   !== 0);
  const hasHechura = (hechuraCost != null && hechuraCost !== 0) || (hechuraSale != null && hechuraSale !== 0);
  if (!hasMetal && !hasHechura) return null;

  const fmt = (v: number | null) =>
    v != null && Number.isFinite(v) ? fmtMoney(v, currency) : "—";
  const marginToneClass = (pct: number | null | undefined): string =>
    pct == null
      ? "text-muted/60"
      : pct >= 40 ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 15 ? "text-text"
      : pct >  0  ? "text-amber-600 dark:text-amber-400"
      :             "text-red-500";

  const Row = ({
    label, cost, sale, marginPct,
  }: {
    label:     string;
    cost:      number | null;
    sale:      number | null;
    marginPct: number | null;
  }) => (
    <div className="grid grid-cols-[80px_1fr_auto_1fr_auto_70px] items-baseline gap-x-2 text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="text-right tabular-nums text-text/85">{fmt(cost)}</span>
      <span className="text-muted/50">→</span>
      <span className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
        {fmt(sale)}
      </span>
      <span className="text-muted/50">·</span>
      <span className={cn("text-right tabular-nums font-semibold", marginToneClass(marginPct))}>
        {marginPct != null && Number.isFinite(marginPct) ? `${formatByType(marginPct, "MARGIN_PERCENT", { bare: true })}%` : "—"}
      </span>
    </div>
  );

  return (
    <div className="space-y-0.5 border-t border-border/30 pt-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/80">
        Impacto en precio de venta
      </div>
      {/* Header micro-columnas (alinea con las celdas de las filas). */}
      <div className="grid grid-cols-[80px_1fr_auto_1fr_auto_70px] gap-x-2 text-[8.5px] uppercase tracking-wide text-muted/55">
        <span aria-hidden />
        <span className="text-right">Costo</span>
        <span aria-hidden />
        <span className="text-right">Venta</span>
        <span aria-hidden />
        <span className="text-right">Margen</span>
      </div>
      {hasMetal && (
        <Row label="Metal" cost={metalCost} sale={metalSale} marginPct={metalMarginPct} />
      )}
      {hasHechura && (
        <Row label="Hechura" cost={hechuraCost} sale={hechuraSale} marginPct={hechuraMarginPct} />
      )}
    </div>
  );
}
