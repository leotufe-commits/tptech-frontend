// src/components/sales/PriceFlowCards.tsx
// ============================================================================
// Fase 6 — "Flujo visual de construcción del precio".
//
// Reemplaza la sección "Impacto en precio de venta" + "Ajuste global de costo"
// + "Rentabilidad" del simulador y la composición editable de factura, por un
// flujo visual de 4 cards horizontales que explican paso a paso cómo se llega
// al precio final de venta.
//
// Layout:
//   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
//   │ 1. COSTO   │  │ 2. AJUSTES │  │ 3. PRECIO  │  │ 4. RENTAB. │
//   │   BASE     │→ │   GLOBALES │→ │   DE VENTA │  │            │
//   │  (azul)    │  │   (ámbar)  │  │  (verde)   │  │  (neutro)  │
//   └────────────┘  └────────────┘  └────────────┘  └────────────┘
//
//   Responsive: grid-cols-4 en md+, stack vertical en mobile.
//
// POLICY R4.1: cero matemática nueva. Todos los importes vienen del backend
// vía `pricingMeta`. El componente solo decide presentación.
//
// Reemplaza:
//   · SaleImpactBlock (Fase 2.7.b)
//   · CostAdjustmentBlock (Fase 2.5)
//   · RentabilidadBlock (Fase 2.1)
//
// Los 3 anteriores quedan en el codebase pero marcados @deprecated en su
// archivo origen para retirarlos en una iteración posterior cuando sea
// confirmado que ningún caller los usa.
// ============================================================================

import React from "react";
import { cn } from "../ui/tp";
import { formatMoneyDoc as fmtMoney, formatDecimal } from "../../lib/pricing/format";
import { Coins, ArrowLeftRight, TrendingUp, BarChart3 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export type PriceFlowCardsProps = {
  /** Cost-side per tipo (passthrough motor). */
  metalCost:        number | null;
  metalSale:        number | null;
  metalMarginPct:   number | null;
  hechuraCost:      number | null;
  hechuraSale:      number | null;
  hechuraMarginPct: number | null;
  /** Ajuste global de costo (`Article.manualAdjustment*`). */
  costAdjustment?: {
    kind:   "BONUS" | "SURCHARGE" | null;
    type:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
    value:  number | null;
    amount: number | null;
  } | null;
  /** Rentabilidad agregada per-unidad. */
  unitCost:      number | null;
  unitMargin:    number | null;
  marginPercent: number | null;
  /** Precio unitario base de venta (post-margen, pre-impuestos). */
  saleUnitPrice: number | null;
  /** Cantidad de la línea (para escalar costo/ganancia/venta a totales). */
  quantity:      number;
  /** Moneda del display (p. ej. "ARS"). */
  currency:      string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formato (solo presentación)
// ─────────────────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, currency: string): string {
  return v != null && Number.isFinite(v) ? fmtMoney(v, currency) : "—";
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.abs(v - Math.round(v)) < 0.05 ? `${formatDecimal(v, 0)}%` : `${formatDecimal(v, 1)}%`;
}

/** Tono semántico para porcentajes de margen (mismo criterio que el KPI). */
function marginTone(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "text-muted/60";
  if (pct >= 40) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 15) return "text-text";
  if (pct >  0)  return "text-amber-600 dark:text-amber-400";
  return "text-red-500";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes — 4 cards
// ─────────────────────────────────────────────────────────────────────────────

type CardShellProps = {
  title:    string;
  tone:     "cost" | "adjust" | "sale" | "neutral";
  icon:     React.ReactNode;
  children: React.ReactNode;
};

/** Shell común de los 4 cards. Mantiene jerarquía visual idéntica:
 *  header (icono + título uppercase) → contenido → total destacado.
 *  Fase 6 — `min-h-[148px]` garantiza altura uniforme cuando un card está
 *  en estado vacío (sin ajustes / sin margen). `min-w-0` en cada hijo permite
 *  que los importes largos hagan truncate sin romper el grid. */
function CardShell({ title, tone, icon, children }: CardShellProps) {
  const toneClasses = {
    cost:    "bg-sky-500/5 border-sky-500/20 dark:bg-sky-500/10",
    adjust:  "bg-amber-500/5 border-amber-500/20 dark:bg-amber-500/10",
    sale:    "bg-emerald-500/5 border-emerald-500/25 dark:bg-emerald-500/10",
    neutral: "bg-card border-border",
  }[tone];
  const iconTone = {
    cost:    "text-sky-600 dark:text-sky-400",
    adjust:  "text-amber-600 dark:text-amber-400",
    sale:    "text-emerald-600 dark:text-emerald-400",
    neutral: "text-muted",
  }[tone];
  return (
    <div className={cn(
      "rounded-lg border px-3 py-2.5 flex flex-col gap-2 min-w-0 min-h-[148px]",
      toneClasses,
    )}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn("inline-flex items-center justify-center shrink-0", iconTone)}>{icon}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted/80 truncate">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Fila estándar de detalle: label (truncate) + monto (tabular-nums, no-wrap).
 *  Patrón usado en los 4 cards para mantener consistencia visual. */
function DetailRow({
  label, value, valueClass,
}: {
  label:      React.ReactNode;
  value:      React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 min-w-0">
      <span className="text-muted truncate min-w-0">{label}</span>
      <span className={cn("tabular-nums whitespace-nowrap shrink-0", valueClass ?? "text-text/85")}>
        {value}
      </span>
    </div>
  );
}

/** Cierre destacado del card (label uppercase + monto grande).
 *  Fase 6 — uppercase con tracking-wide; monto en `text-[13px]` (más legible
 *  que el `text-sm`=14px previo cuando el importe es largo). */
function CardFooter({
  borderClass, labelClass, label, value, valueClass,
}: {
  borderClass: string;
  labelClass:  string;
  label:       string;
  value:       React.ReactNode;
  valueClass:  string;
}) {
  return (
    <div className={cn("border-t pt-1.5 mt-auto", borderClass)}>
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        <span className={cn("text-[10px] uppercase tracking-wide font-semibold truncate", labelClass)}>
          {label}
        </span>
        <span className={cn("tabular-nums font-bold text-[13px] whitespace-nowrap shrink-0", valueClass)}>
          {value}
        </span>
      </div>
    </div>
  );
}

/** Card 1 — Costo base del artículo. Metal + Hechura/Otros + Total. */
function CostBaseCard({
  metalCost, hechuraCost, totalCost, currency,
}: { metalCost: number | null; hechuraCost: number | null; totalCost: number | null; currency: string }) {
  const hasMetal   = metalCost   != null && metalCost   !== 0;
  const hasHechura = hechuraCost != null && hechuraCost !== 0;
  return (
    <CardShell title="Costo base del artículo" tone="cost" icon={<Coins size={11} />}>
      <div className="space-y-0.5 text-[11px]">
        {hasMetal && <DetailRow label="Metal" value={fmt(metalCost, currency)} />}
        {hasHechura && <DetailRow label="Hechura y otros" value={fmt(hechuraCost, currency)} />}
        {!hasMetal && !hasHechura && (
          <div className="text-[10px] italic text-muted/55">Sin componentes de costo.</div>
        )}
      </div>
      <CardFooter
        borderClass="border-sky-500/20"
        labelClass="text-sky-700 dark:text-sky-300"
        label="Costo total"
        value={fmt(totalCost, currency)}
        valueClass="text-sky-700 dark:text-sky-200"
      />
    </CardShell>
  );
}

/** Card 2 — Ajustes globales aplicados. Bonif/Recargo sobre el costo. */
function AdjustmentsCard({
  data, totalCostBase, totalCostAdjusted, currency,
}: {
  data: PriceFlowCardsProps["costAdjustment"];
  totalCostBase:     number | null;
  totalCostAdjusted: number | null;
  currency: string;
}) {
  const hasAdjustment = !!data && !!data.kind && data.amount != null && Number.isFinite(data.amount) && data.amount !== 0;
  const isBonus = data?.kind === "BONUS";
  // Tono del valor: verde para bonus (reduce), ámbar para recargo (aumenta).
  const amtToneCls = isBonus
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-700 dark:text-amber-400";
  const valuePart = data?.value != null && Number.isFinite(data.value)
    ? (data.type === "PERCENTAGE"
        ? fmtPct(data.value)
        : data.type === "FIXED_AMOUNT"
          ? fmtMoney(data.value, currency)
          : String(data.value))
    : null;
  return (
    <CardShell title="Ajustes globales aplicados" tone="adjust" icon={<ArrowLeftRight size={11} />}>
      <div className="space-y-0.5 text-[11px]">
        {hasAdjustment ? (
          <>
            <DetailRow
              label={
                <>
                  {isBonus ? "Bonificación" : "Recargo"}
                  {valuePart && <span className="ml-1 text-text/85">{valuePart}</span>}
                </>
              }
              value={`${isBonus ? "−" : "+"}${fmtMoney(Math.abs(data!.amount!), currency)}`}
              valueClass={cn("font-semibold", amtToneCls)}
            />
            <p className="text-[9px] text-muted/60 leading-tight">
              El ajuste modifica el costo antes de aplicar el margen.
            </p>
          </>
        ) : (
          <div className="text-[10px] italic text-muted/55">Sin ajustes globales configurados.</div>
        )}
      </div>
      <CardFooter
        borderClass="border-amber-500/20"
        labelClass="text-amber-700 dark:text-amber-300"
        label="Costo ajustado"
        value={fmt(totalCostAdjusted ?? totalCostBase, currency)}
        valueClass="text-amber-700 dark:text-amber-200"
      />
    </CardShell>
  );
}

/** Card 3 — Impacto en el precio de venta. Margen + ganancia + venta neta. */
function SaleImpactCard({
  metalMarginPct, hechuraMarginPct,
  totalCostAdjusted, totalGain, totalSale,
  currency,
}: {
  metalMarginPct:    number | null;
  hechuraMarginPct:  number | null;
  totalCostAdjusted: number | null;
  totalGain:         number | null;
  totalSale:         number | null;
  currency:          string;
}) {
  // Composición del margen visible: si los dos componentes tienen márgenes
  // distintos, mostramos ambos. Si solo uno, mostramos ese.
  const hasMetalM   = metalMarginPct   != null && Number.isFinite(metalMarginPct)   && metalMarginPct   > 0.005;
  const hasHechuraM = hechuraMarginPct != null && Number.isFinite(hechuraMarginPct) && hechuraMarginPct > 0.005;
  const sameMargin  = hasMetalM && hasHechuraM
                   && Math.abs((metalMarginPct as number) - (hechuraMarginPct as number)) < 0.05;
  return (
    <CardShell title="Impacto en el precio de venta" tone="sale" icon={<TrendingUp size={11} />}>
      <div className="space-y-0.5 text-[11px]">
        <DetailRow label="Costo ajustado" value={fmt(totalCostAdjusted, currency)} />
        {hasMetalM || hasHechuraM ? (
          sameMargin ? (
            // Fase 6 — label explícito: el margen se aplica SOBRE el costo
            // ajustado (no sobre la venta). Evita que el usuario interprete
            // el % como "margen sobre venta" (rentabilidad), que es lo que
            // muestra el card 4.
            <DetailRow
              label="Margen sobre costo"
              value={`+${fmtPct(metalMarginPct)}`}
              valueClass={cn("font-semibold", marginTone(metalMarginPct))}
            />
          ) : (
            <>
              {hasMetalM && (
                <DetailRow
                  label="Margen metal"
                  value={`+${fmtPct(metalMarginPct)}`}
                  valueClass={cn("font-semibold", marginTone(metalMarginPct))}
                />
              )}
              {hasHechuraM && (
                <DetailRow
                  label="Margen hechura"
                  value={`+${fmtPct(hechuraMarginPct)}`}
                  valueClass={cn("font-semibold", marginTone(hechuraMarginPct))}
                />
              )}
            </>
          )
        ) : (
          <div className="text-[10px] italic text-muted/55">Sin margen aplicado.</div>
        )}
        {totalGain != null && Number.isFinite(totalGain) && totalGain !== 0 && (
          <DetailRow
            label="Ganancia"
            value={`+${fmtMoney(Math.abs(totalGain), currency)}`}
            valueClass="font-semibold text-emerald-600 dark:text-emerald-400"
          />
        )}
      </div>
      <CardFooter
        borderClass="border-emerald-500/25"
        labelClass="text-emerald-700 dark:text-emerald-300"
        label="Valor de venta neto"
        value={fmt(totalSale, currency)}
        valueClass="text-emerald-700 dark:text-emerald-200"
      />
    </CardShell>
  );
}

/** Card 4 — Resumen de rentabilidad. KPIs compactos. */
function ProfitabilityCard({
  totalCost, totalGain, marginPercent, totalSale, currency,
}: {
  totalCost:     number | null;
  totalGain:     number | null;
  marginPercent: number | null;
  totalSale:     number | null;
  currency:      string;
}) {
  return (
    <CardShell title="Resumen de rentabilidad" tone="neutral" icon={<BarChart3 size={11} />}>
      <div className="space-y-0.5 text-[11px]">
        <DetailRow label="Costo total" value={fmt(totalCost, currency)} />
        <DetailRow
          label="Ganancia neta"
          value={totalGain != null && Number.isFinite(totalGain)
            ? `+${fmtMoney(Math.abs(totalGain), currency)}`
            : "—"}
          valueClass="text-emerald-600 dark:text-emerald-400 font-semibold"
        />
        {/* Fase 6 — label explícito: este margen es SOBRE LA VENTA (KPI clásico
            de rentabilidad), distinto del "Margen sobre costo" del card 3. */}
        <DetailRow
          label="Margen sobre venta"
          value={fmtPct(marginPercent)}
          valueClass={cn("font-semibold", marginTone(marginPercent))}
        />
      </div>
      <CardFooter
        borderClass="border-border/50"
        labelClass="text-muted"
        label="Venta final"
        value={fmt(totalSale, currency)}
        valueClass="text-text"
      />
    </CardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal — orquestador de los 4 cards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render principal: 4 cards en flujo horizontal explicando la construcción
 * del precio. Mismos datos que los bloques antiguos (`SaleImpactBlock`,
 * `CostAdjustmentBlock`, `RentabilidadBlock`) — solo presentación distinta.
 */
export default function PriceFlowCards(props: PriceFlowCardsProps): React.ReactElement | null {
  const {
    metalCost, metalSale, metalMarginPct,
    hechuraCost, hechuraSale, hechuraMarginPct,
    costAdjustment,
    unitCost, unitMargin, marginPercent,
    saleUnitPrice, quantity,
    currency,
  } = props;

  // Si no hay datos relevantes, ocultamos toda la sección (mantiene
  // comportamiento de los bloques previos).
  const anyData =
    (metalCost   != null && metalCost   !== 0) ||
    (metalSale   != null && metalSale   !== 0) ||
    (hechuraCost != null && hechuraCost !== 0) ||
    (hechuraSale != null && hechuraSale !== 0) ||
    (unitCost    != null && unitCost    !== 0) ||
    (saleUnitPrice != null && saleUnitPrice !== 0);
  if (!anyData) return null;

  // ── Derivaciones triviales (passthrough, sin matemática nueva) ────────────
  // Total costo base = metalCost + hechuraCost (suma de buckets emitidos por
  // el motor). Si solo uno está, totaliza ese.
  const totalCostBase = (() => {
    const m = metalCost   ?? 0;
    const h = hechuraCost ?? 0;
    if (m === 0 && h === 0) return null;
    return m + h;
  })();
  // Total costo "ajustado" después del ajuste global = totalCostBase + amount
  // (BONUS reduce, SURCHARGE aumenta; convención del motor: amount > 0 reduce).
  const totalCostAdjusted = (() => {
    if (totalCostBase == null) return null;
    if (!costAdjustment || !costAdjustment.kind || costAdjustment.amount == null) return totalCostBase;
    const amt = costAdjustment.amount;
    if (!Number.isFinite(amt)) return totalCostBase;
    return costAdjustment.kind === "BONUS" ? totalCostBase - amt : totalCostBase + amt;
  })();
  // Totales escalados por quantity (mismo patrón que RentabilidadBlock).
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const totalCost = unitCost != null && Number.isFinite(unitCost) ? unitCost * qty : totalCostBase;
  const totalGain = unitMargin != null && Number.isFinite(unitMargin) ? unitMargin * qty : null;
  const totalSale = saleUnitPrice != null && Number.isFinite(saleUnitPrice) ? saleUnitPrice * qty : null;
  void metalSale; void hechuraSale; // expuestos en props para futuro detail; cards actuales no los necesitan en agregado.

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted/75">
        Flujo de construcción del precio
      </div>
      {/* Grid responsivo:
          - mobile (<md): 1 columna (stack vertical).
          - tablet (md): 2 columnas.
          - notebook/desktop (lg+): 4 columnas. Bajamos el breakpoint a `lg`
            (1024px) en lugar de `xl` (1280px) para que en notebooks 1366px
            no queden 2 filas innecesarias. `gap-2` mantiene compactación. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <CostBaseCard
          metalCost={metalCost}
          hechuraCost={hechuraCost}
          totalCost={totalCostBase}
          currency={currency}
        />
        <AdjustmentsCard
          data={costAdjustment ?? null}
          totalCostBase={totalCostBase}
          totalCostAdjusted={totalCostAdjusted}
          currency={currency}
        />
        <SaleImpactCard
          metalMarginPct={metalMarginPct}
          hechuraMarginPct={hechuraMarginPct}
          totalCostAdjusted={totalCostAdjusted}
          totalGain={totalGain}
          totalSale={totalSale}
          currency={currency}
        />
        <ProfitabilityCard
          totalCost={totalCost}
          totalGain={totalGain}
          marginPercent={marginPercent}
          totalSale={totalSale}
          currency={currency}
        />
      </div>
    </div>
  );
}
