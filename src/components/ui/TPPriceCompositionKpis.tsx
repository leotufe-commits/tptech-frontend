// src/components/ui/TPPriceCompositionKpis.tsx
// ============================================================================
// TPPriceCompositionKpis — KPIs de composición de precio Metal + Hechura.
//
// Componente PRESENTACIONAL puro. NO calcula importes monetarios, NO
// recalcula pricing, NO depende de hooks ni servicios. Solo recibe data ya
// normalizada y la formatea.
//
// 100% passthrough: lee `pureGramsBase`/`pureGramsSale` del ViewModel
// normalizado (`NormalizedCompositionMetal`). El cálculo físico (gramos ×
// pureza × factor merma × factor margen) vive en el normalizador, no acá.
//
// Layout estilo Simulador: header con título a la izquierda y valor principal
// a la derecha, separados por una línea fina. Cuerpo con cálculo línea por
// línea (no tabla densa).
//
// Reutilizable en:
//   - PricingSimulator (futuro)
//   - PricingCompare   (integrado)
//   - VentasFacturas   (Fase 3)
// ============================================================================

import React from "react";
import { cn } from "./tp";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export type TPMetalCompositionInput = {
  metalName?:        string | null;
  /** Símbolo químico (ej. "Au"). Backend hoy NO lo expone — TODO. */
  metalSymbol?:      string | null;
  purityLabel?:      string | null;
  purity?:           number | null;
  originalGrams?:    number | null;
  appliedGrams?:     number | null;
  gramsManual?:      boolean;
  originalMermaPct?: number | null;
  appliedMermaPct?:  number | null;
  mermaManual?:      boolean;
  /** Gramos puros base — viene del ViewModel normalizado. */
  pureGramsBase?:    number | null;
  /** Gramos puros venta — viene del ViewModel normalizado. */
  pureGramsSale?:    number | null;
} | null | undefined;

export type TPHechuraCompositionInput = {
  originalAmount?: number | null;
  appliedAmount?:  number | null;
  manual?:         boolean;
  appliesTo?:      string | null;
} | null | undefined;

export type TPCompositionTaxItemInput = {
  id?:        string;
  name?:      string;
  code?:      string;
  rate?:      number | null;
  appliesTo?: string;
  taxAmount?: number;
  manual?:    boolean;
};

export type TPCompositionInput = {
  metal?:   TPMetalCompositionInput;
  hechura?: TPHechuraCompositionInput;
  taxes?:   TPCompositionTaxItemInput[];
} | null | undefined;

export type TPMetalHechuraBreakdownInput = {
  metalCost?:         number | null;
  metalSale?:         number | null;
  metalMarginPct?:    number | null;
  hechuraCost?:       number | null;
  hechuraSale?:       number | null;
  hechuraMarginPct?:  number | null;
  metalGramsBase?:    number | null;
  metalGramsSale?:    number | null;
  metalPricePerGram?: number | null;
  // FASE 1 — el motor backend popula estos campos universalmente.
  metalSaleEstimated?:   boolean | null;
  hechuraSaleEstimated?: boolean | null;
  source?:               string | null;
} | null | undefined;

/** Tipo de capa que generó un ajuste sobre un componente. */
export type TPComponentAdjustmentKindInput =
  | "QUANTITY_DISCOUNT"
  | "PROMOTION"
  | "ENTITY_RULE"
  | "MANUAL_DISCOUNT";

/** Etiqueta default por kind. Se usa como FALLBACK cuando el backend no
 *  manda `label` específico. Si el backend manda label (ej. "Promoción
 *  Verano 30%", "Recargo cliente"), ese gana porque es más informativo. */
export const TP_LABEL_BY_KIND: Record<TPComponentAdjustmentKindInput, string> = {
  QUANTITY_DISCOUNT: "Desc. cantidad",
  PROMOTION:         "Promoción",
  ENTITY_RULE:       "Descuento cliente",
  MANUAL_DISCOUNT:   "Ajuste manual",
};

/** Resuelve la etiqueta a mostrar para un ajuste: prioriza el label del
 *  backend (más específico) y cae al mapa por kind si no viene. */
export function resolveAdjustmentLabel(adj: { kind: TPComponentAdjustmentKindInput; label?: string | null }): string {
  return (adj.label && adj.label.trim().length > 0)
    ? adj.label
    : (TP_LABEL_BY_KIND[adj.kind] ?? adj.kind);
}

export type TPComponentSaleAdjustmentInput = {
  kind:        TPComponentAdjustmentKindInput;
  label:       string;
  /** Positivo = reduce precio (descuento). Negativo = aumenta (recargo). */
  amount:      number;
  applyOn:     "METAL" | "HECHURA";
  /** Metadata opcional para mostrar la fórmula "Base × % = monto". */
  base?:       number | null;
  percentage?: number | null;
  valueType?:  "PERCENTAGE" | "FIXED_AMOUNT" | string | null;
  source?:     "CLIENT" | "GENERAL" | string | null;
};

export type TPComponentSaleBreakdownInput = {
  base:        number;
  adjustments: TPComponentSaleAdjustmentInput[];
  final:       number;
};

/** Desglose post-descuentos por componente — viene del backend (snapshot). */
export type TPComponentSaleDetailInput = {
  metal:   TPComponentSaleBreakdownInput;
  hechura: TPComponentSaleBreakdownInput;
} | null | undefined;

export type TPPriceCompositionKpisProps = {
  composition?: TPCompositionInput;
  metalHechuraBreakdown?: TPMetalHechuraBreakdownInput;
  /** Desglose post-descuentos por componente. Cuando está presente, los
   *  cards de Metal y Hechura renderizan `base + adjustments + final` en
   *  lugar del cálculo `cost × factor margen`. */
  componentSaleBreakdown?: TPComponentSaleDetailInput;
  total?:     number | null;
  subtotal?:  number | null;
  taxAmount?: number | null;
  costBase?:      number | null;
  costTaxAmount?: number | null;
  costWithTax?:   number | null;
  costTaxBreakdown?: Array<{
    taxId?:           string;
    name?:            string;
    calculationType?: string;
    rate?:            number | null;
    fixedAmount?:     number | null;
    taxAmount?:       number;
  }>;
  marginPercent?: number | null;
  view?: "sale" | "cost";
  currencySymbol?: string;
  mode?: "simulator" | "compare" | "invoice";
  showCostCard?: boolean;
  title?: string;
  emptyText?: string;
  /** Borde rojo cuando el caller detecta diferencia con otra columna. */
  mismatch?: boolean;
  /** Modo de la lista de precios efectivamente aplicada. Decide cómo
   *  renderizar el bloque metal/hechura:
   *   - "METAL_HECHURA": cards Metal y Hechura separadas con margen propio.
   *   - "MARGIN_TOTAL": una sola card "Margen unificado" con costo + ganancia
   *     unificada + total. Sin desglose de margen por componente.
   *   - null/undefined o desconocido: fallback heurístico (si viene
   *     metalHechuraBreakdown → desglosado; si no → unificado). */
  priceListMode?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Formato (puro)
// ─────────────────────────────────────────────────────────────────────────────

function fmtMoneyLocal(v: number | null | undefined, sym?: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const formatted = v.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return sym ? `${sym} ${formatted}` : formatted;
}

function fmtNum(v: number | null | undefined, decimals: number = 4): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes (estilo Simulador)
// ─────────────────────────────────────────────────────────────────────────────

/** Card estilo Simulador (`Composición del precio` / `Composición del costo`):
 *  fondo `bg-muted/15`, borde sutil, título principal grande uppercase a la
 *  izquierda, valor monetario/gramos a la derecha, divisor interno y body con
 *  fórmulas / origen / totales. Mismo look para vista venta y compra (la
 *  spec exige consistencia entre ambas vistas). */
function SimCard({
  heading, headingSub, value, valueSub, children, mismatch,
}: {
  heading: React.ReactNode;
  headingSub?: React.ReactNode;
  value: React.ReactNode;
  valueSub?: React.ReactNode;
  children?: React.ReactNode;
  mismatch?: boolean;
}) {
  // El badge "Difiere" del header del componente ya alerta sobre la
  // discrepancia. Acá el card mantiene el estilo neutro (mismo look del
  // simulador) — un borde ámbar sutil cuando mismatch=true es suficiente.
  return (
    <div className={cn(
      "rounded-lg border bg-muted/15 px-4 py-3 space-y-2 shadow-sm",
      mismatch ? "border-amber-500/40" : "border-border/40",
    )}>
      <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-2">
        <div className="min-w-0">
          <div className="text-base font-bold uppercase tracking-wider text-foreground/60 leading-none truncate">
            {heading}
          </div>
          {headingSub && (
            <div className="mt-1 text-[10px] italic text-foreground/45 truncate">{headingSub}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-bold tabular-nums text-foreground/90 leading-tight">
            {value}
          </div>
          {valueSub && (
            <div className="mt-0.5 text-[10px] text-foreground/45 tabular-nums">{valueSub}</div>
          )}
        </div>
      </div>
      {children && (
        <div className="mt-2 text-[11px] space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

/** Línea de cálculo: descripción a la izquierda, resultado a la derecha. */
function CalcLine({
  expr, result, sub,
}: {
  expr: React.ReactNode;
  result: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className="text-muted">{expr}</div>
      <div className="tabular-nums whitespace-nowrap">
        = {result}
        {sub && <span className="ml-1 text-[10px] text-muted/60">{sub}</span>}
      </div>
    </div>
  );
}

/** Línea fluida estilo Simulador: una sola línea sin caja gris. */
function FlowLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] text-muted/90 leading-snug">{children}</div>
  );
}

/** Factor multiplicativo estilo Simulador: 1 + pct/100, dos decimales. */
function fmtFactor(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return (1 + pct / 100).toFixed(2);
}

/** Línea simple "label .... value". */
function InfoLine({
  label, value, bold,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className={cn("text-muted", bold && "font-semibold text-text")}>{label}</div>
      <div className={cn("tabular-nums whitespace-nowrap", bold && "font-semibold text-text")}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function TPPriceCompositionKpis(props: TPPriceCompositionKpisProps) {
  const {
    composition,
    metalHechuraBreakdown,
    componentSaleBreakdown,
    total,
    subtotal,
    taxAmount,
    costBase,
    costTaxAmount,
    costWithTax,
    costTaxBreakdown,
    marginPercent,
    currencySymbol,
    mode = "simulator",
    title,
    emptyText = "Sin datos para mostrar.",
    view = "sale",
    mismatch,
    priceListMode,
  } = props;
  void mode; // disponible para futuras vistas.

  // ── Resolución del modo de la lista (Fase MARGIN_TOTAL) ─────────────────
  // Decisión efectiva:
  //   - explícito MARGIN_TOTAL  → unificado.
  //   - explícito METAL_HECHURA → desglosado.
  //   - null/desconocido        → fallback por presencia de mhb.
  const isMarginTotal = priceListMode === "MARGIN_TOTAL"
    || (priceListMode == null && !metalHechuraBreakdown);
  void isMarginTotal; // se usa más abajo para condicionar el render.

  const sym = currencySymbol ?? "";
  const money = (v: number | null | undefined) => fmtMoneyLocal(v, sym);

  const hasMetal     = !!composition?.metal;
  const hasHechura   = !!composition?.hechura;
  const hasMHB       = !!metalHechuraBreakdown;
  const hasTaxes     = Array.isArray(composition?.taxes) && composition!.taxes!.length > 0;
  void hasTaxes;
  const hasTotal     = total != null && Number.isFinite(total);
  const hasCost      = (costBase != null && Number.isFinite(costBase))
                    || (costWithTax != null && Number.isFinite(costWithTax));

  if (!hasMetal && !hasHechura && !hasMHB && !hasTotal && !hasCost && !hasTaxes) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-card/40 p-3 text-xs italic text-muted/70">
        {title && <div className="mb-1 not-italic font-semibold uppercase tracking-wide text-muted">{title}</div>}
        {emptyText}
      </div>
    );
  }

  // ── Gramos puros — passthrough del ViewModel normalizado ─────────────────
  // El cálculo físico (appliedGrams × purity × factor merma × factor margen)
  // vive en `normalizePricingPreviewResult.ts`. Acá solo se lee.
  const ag = composition?.metal?.appliedGrams     ?? null;
  const pu = composition?.metal?.purity           ?? null;
  const me = composition?.metal?.appliedMermaPct  ?? 0;

  const pureGramsBase = composition?.metal?.pureGramsBase ?? null;

  // ── Datos del backend — fuente única (FASE 1/2 del refactor BREAKDOWN) ──
  // El motor backend popula `metalHechuraBreakdown` UNIVERSALMENTE: con
  // `source` y flags `*Estimated` que indican si el valor es exacto
  // (METAL_HECHURA) o derivado por proporción (PROPORTIONAL_COST /
  // SERVICE_AS_HECHURA / MANUAL_AS_HECHURA / COMBO_COMPONENTS).
  // El frontend hace passthrough puro — CERO matemática comercial.
  const mhb = metalHechuraBreakdown ?? null;
  const metalSale          = mhb?.metalSale         ?? null;
  const hechuraSale        = mhb?.hechuraSale       ?? null;
  const metalGramsSale     = mhb?.metalGramsSale    ?? null;
  const metalMarginPct     = mhb?.metalMarginPct    ?? 0;
  const hechuraMarginPct   = mhb?.hechuraMarginPct  ?? 0;
  /** Algún componente vino derivado por proporción → mostrar badge "Estimado". */
  const breakdownEstimated = !!(mhb && (mhb.metalSaleEstimated || mhb.hechuraSaleEstimated));
  /** El motor no pudo armar el breakdown (cost null, datos faltantes, etc.). */
  const breakdownMissing   = !mhb || (mhb as { source?: string }).source === "NONE";

  // Gramos venta: preferir el del ViewModel normalizado; si no, caer al
  // `metalGramsSale` que el backend popula en `metalHechuraBreakdown`.
  const pureGramsSale = composition?.metal?.pureGramsSale ?? metalGramsSale;

  // ── Desglose post-descuentos por componente (snapshot) ────────────────
  // Si el backend lo provee, sus valores `base/final` son la fuente de verdad.
  // Cuando NO hay desglose, caemos al valor pre-descuento del backend
  // (`metalSale` / `hechuraSale`) — nunca recalculamos.
  const componentMetal   = componentSaleBreakdown?.metal   ?? null;
  const componentHechura = componentSaleBreakdown?.hechura ?? null;
  const metalSaleFinal   = componentMetal?.final   ?? metalSale;
  const hechuraSaleFinal = componentHechura?.final ?? hechuraSale;

  // Hero del card metal:
  //  - venta → gramos puros venta (con margen efectivo, sea explícito o inferido).
  //  - compra → costo total del metal en moneda.
  const metalHeroSale = pureGramsSale != null
    ? `${composition?.metal?.metalSymbol ? composition.metal.metalSymbol + " " : ""}${fmtNum(pureGramsSale, 2)} gr`
    : (metalHechuraBreakdown?.metalGramsSale != null
        ? `${fmtNum(metalHechuraBreakdown.metalGramsSale, 2)} gr`
        : "—");
  const metalHero = view === "sale"
    ? metalHeroSale
    : (metalHechuraBreakdown?.metalCost != null ? money(metalHechuraBreakdown.metalCost) : "—");

  // Hero hechura: en venta usar valor venta final post-descuentos cuando el
  // snapshot lo expone; si no, valor pre-descuento heredado.
  const hechuraHero = view === "cost"
    ? (metalHechuraBreakdown?.hechuraCost != null ? money(metalHechuraBreakdown.hechuraCost) : "—")
    : (hechuraSaleFinal != null ? money(hechuraSaleFinal) : "—");

  // Hero total producto.
  const totalHero = view === "sale"
    ? (total != null ? money(total) : "—")
    : (costWithTax != null ? money(costWithTax) : "—");

  // Layout: compare 1 col, otros md:2 cols.
  const gridCls = mode === "compare"
    ? "grid grid-cols-1 gap-3"
    : "grid grid-cols-1 gap-3 md:grid-cols-2";

  // Subtítulo del header de la card metal (ej. "Oro 18 Kilates · AU18K").
  const metalHeadingSub = (() => {
    if (!composition?.metal) return null;
    const parts: string[] = [];
    if (composition.metal.metalName && composition.metal.purityLabel) {
      parts.push(`${composition.metal.metalName} ${composition.metal.purityLabel}`);
    } else if (composition.metal.metalName) {
      parts.push(composition.metal.metalName);
    }
    return parts.join(" · ") || null;
  })();

  // Heading principal del card metal: "ORO (Au)" o solo "Metal".
  const metalHeading = composition?.metal?.metalName
    ? `${composition.metal.metalName.toUpperCase()}${composition.metal.metalSymbol ? ` (${composition.metal.metalSymbol})` : ""}`
    : "METAL";

  return (
    <div>
      {(title || breakdownEstimated || breakdownMissing) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {title && (
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {title}
            </div>
          )}
          {mismatch && (
            <span
              className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-500"
              title="La columna Simulador y la columna Factura difieren más allá de la tolerancia esperada por redondeo."
            >
              Difiere
            </span>
          )}
          {breakdownEstimated && !breakdownMissing && view === "sale" && (
            <span
              className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-500"
              title="Algunos componentes (metal/hechura) fueron derivados por proporción de costo. La suma sigue siendo exacta."
            >
              Estimado
            </span>
          )}
        </div>
      )}
      {/* Warning explícito cuando el motor NO pudo armar el breakdown.
          Indica problema de datos (composición de costo incompleta). */}
      {breakdownMissing && view === "sale" && (hasMetal || hasMHB || hasHechura) && (
        <div className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
          Sin breakdown disponible — verificá la composición de costo del artículo.
        </div>
      )}
      <div className={gridCls}>
        {/* ── Card METAL — siempre que haya datos.
            En MARGIN_TOTAL es DESGLOSE INFORMATIVO (no muestra margen por
            componente). En METAL_HECHURA es desglose real del cálculo. */}
        {(hasMetal || hasMHB) && (
          <SimCard
            heading={metalHeading}
            headingSub={metalHeadingSub}
            value={metalHero}
            valueSub={
              // En venta: valueSub = valor metal venta final (post descuentos
              // si el snapshot los expone, o pre-descuentos si no). Mismo
              // número que muestra el Simulador.
              view === "sale" && metalSaleFinal != null
                ? money(metalSaleFinal)
                : view === "cost" && pureGramsBase != null
                  ? `${fmtNum(pureGramsBase, 2)} gr puros`
                  : undefined}
            mismatch={mismatch}
          >
            {/* ── ORIGEN físico del metal ────────────────────────────────
                Información primaria visible siempre. */}
            {composition?.metal && (composition.metal.appliedGrams != null
              || composition.metal.purity != null
              || composition.metal.appliedMermaPct != null) && (
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-widest text-muted/70">Origen</div>
                <div className="text-[11px] text-muted/90 mt-0.5">
                  {fmtNum(composition.metal.appliedGrams)} gr físicos
                  {composition.metal.purity != null && <> · pureza {composition.metal.purity}</>}
                  {composition.metal.appliedMermaPct != null && <> · merma {fmtPct(composition.metal.appliedMermaPct)}</>}
                </div>
              </div>
            )}

            {/* ── Fórmulas PRINCIPALES (visibles siempre) ────────────────
                Vista venta:
                  L1 (físico): "1,30 gr × 0,825 = 1,07 gr"  (puros con merma)
                  L2 (sale gr — solo METAL_HECHURA): "1,07 gr × 1,10 = 1,18 gr"
                  L3 (monetario base): "1,07 gr × $X/gr = $Y"
                  L4 (sale $ — solo METAL_HECHURA): "$Y × 1,10 = $Z (+10%)"
                Vista compra: solo L3.                                       */}
            {/* Bloque de fórmulas — mismo layout para venta y compra.
                L1 (gramos puros) y L3 (gramos × precio = costo) se muestran
                en ambas vistas. L2 (gramos venta) y L4 (cost → sale) solo
                en venta — el simulador "Composición del costo" solo muestra
                L1 y L3 también. */}
            {(
              (ag != null && pu != null && pu > 0 && pureGramsBase != null) ||
              (metalHechuraBreakdown?.metalGramsBase != null
                 && metalHechuraBreakdown?.metalPricePerGram != null
                 && metalHechuraBreakdown?.metalCost != null)
            ) && (
              <div className="space-y-0.5 font-mono text-[11px]">
                {/* L1 — gramos físicos × pureza × merma = gramos puros base */}
                {ag != null && pu != null && pu > 0 && pureGramsBase != null && (
                  <FlowLine>
                    <span className="tabular-nums">{fmtNum(ag)} gr × {(pu * (1 + me / 100)).toFixed(3)}</span>
                    <span> = </span>
                    <span className="tabular-nums font-semibold text-text">{fmtNum(pureGramsBase, 2)} gr</span>
                    <span className="ml-1 text-muted/50">(puros con merma)</span>
                  </FlowLine>
                )}
                {/* L2 — gramos venta (sólo en vista venta + METAL_HECHURA exacto). */}
                {view === "sale" && pureGramsBase != null && pureGramsSale != null && metalMarginPct > 0.01 && (
                  <FlowLine>
                    <span className="tabular-nums">{fmtNum(pureGramsBase, 2)} gr × {fmtFactor(metalMarginPct)}</span>
                    <span> = </span>
                    <span className="tabular-nums font-semibold text-text">{fmtNum(pureGramsSale, 2)} gr</span>
                    <span className="ml-1 text-muted/50">(+{metalMarginPct.toFixed(2)}%)</span>
                  </FlowLine>
                )}
                {/* L3 — gramos base × precio/gr = costo metal. Visible en ambas vistas. */}
                {metalHechuraBreakdown?.metalGramsBase != null
                  && metalHechuraBreakdown?.metalPricePerGram != null
                  && metalHechuraBreakdown?.metalCost != null && (
                  <FlowLine>
                    <span className="tabular-nums">{fmtNum(metalHechuraBreakdown.metalGramsBase, 2)} gr × {money(metalHechuraBreakdown.metalPricePerGram)}/gr</span>
                    <span> = </span>
                    <span className="tabular-nums font-semibold text-text">{money(metalHechuraBreakdown.metalCost)}</span>
                  </FlowLine>
                )}
                {/* L4 — valor metal venta. Solo en vista venta. */}
                {view === "sale" && metalHechuraBreakdown?.metalCost != null
                  && metalSale != null
                  && Math.abs(metalSale - metalHechuraBreakdown.metalCost) > 0.005 && (
                  <FlowLine>
                    {metalMarginPct > 0.01 ? (
                      <>
                        <span className="tabular-nums">{money(metalHechuraBreakdown.metalCost)} × {fmtFactor(metalMarginPct)}</span>
                        <span> = </span>
                        <span className="tabular-nums font-semibold text-text">{money(metalSale)}</span>
                        <span className="ml-1 text-muted/50">(+{metalMarginPct.toFixed(2)}%)</span>
                      </>
                    ) : (
                      <>
                        <span className="tabular-nums">{money(metalHechuraBreakdown.metalCost)}</span>
                        <span> → </span>
                        <span className="tabular-nums font-semibold text-text">{money(metalSale)}</span>
                      </>
                    )}
                  </FlowLine>
                )}
              </div>
            )}

            {/* ── Ajustes post-margen del componente METAL ────────────────
                Render directo del snapshot (componentSaleBreakdown). Se
                muestra `base − Σajustes = final` cuando hay al menos un
                ajuste con applyOn=METAL. */}
            {view === "sale"
              && componentMetal
              && componentMetal.adjustments.length > 0 && (
              <div className="border-t border-border/40 pt-1.5 space-y-0.5">
                <InfoLine
                  label="Subtotal metal"
                  value={money(componentMetal.base)}
                />
                {componentMetal.adjustments.map((adj, i) => (
                  <InfoLine
                    key={`m-adj-${adj.kind}-${i}`}
                    label={resolveAdjustmentLabel(adj)}
                    value={
                      <span className={cn(
                        adj.amount > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      )}>
                        {adj.amount > 0 ? "−" : "+"}{money(Math.abs(adj.amount))}
                      </span>
                    }
                  />
                ))}
                <InfoLine
                  label="Metal final"
                  value={money(componentMetal.final)}
                  bold
                />
              </div>
            )}

            {/* FASE 3 — el split proporcional de impuestos por componente
                (gSF / splitTax) se eliminó. Los impuestos se muestran solo
                en el card "TOTAL PRODUCTO". Si el backend en el futuro
                expone `taxAmount` por componente exacto, se puede agregar
                acá sin recalcular. */}

            {/* ── Total componente metal (mismo layout para venta y compra) ──
                En venta: `metalSaleFinal` (post descuentos si hay
                componentSaleBreakdown, sino metalSale del backend).
                En compra: `metalCost` directo del backend. */}
            {view === "sale" && metalSaleFinal != null && (
              <div className="border-t border-border/40 pt-1.5">
                <InfoLine label="Total componente" value={money(metalSaleFinal)} bold />
              </div>
            )}
            {view === "cost" && metalHechuraBreakdown?.metalCost != null && (
              <div className="border-t border-border/40 pt-1.5">
                <InfoLine label="Total componente" value={money(metalHechuraBreakdown.metalCost)} bold />
              </div>
            )}

            {/* Nota MARGIN_TOTAL — sutil, debajo */}
            {view === "sale" && isMarginTotal && (
              <div className="text-[10px] italic text-muted/60 border-t border-border/30 pt-1">
                Lista unificada — el margen se aplica al total, no por componente
              </div>
            )}
          </SimCard>
        )}

        {/* ── Card HECHURA — siempre que haya datos.
            En MARGIN_TOTAL es DESGLOSE INFORMATIVO. */}
        {(hasHechura || hasMHB) && (
          <SimCard
            heading="HECHURA"
            headingSub={composition?.hechura?.appliesTo ? `Aplica a: ${composition.hechura.appliesTo}` : null}
            value={hechuraHero}
            mismatch={mismatch}
          >
            {/* ── ORIGEN ───────────────────────────────────────────────── */}
            {(composition?.hechura?.appliesTo
              || composition?.hechura?.appliedAmount != null
              || metalHechuraBreakdown?.hechuraCost != null) && (
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-widest text-muted/70">Origen</div>
                <div className="text-[11px] text-muted/90 mt-0.5">
                  {composition?.hechura?.appliesTo
                    ? <>Aplica a: <span className="font-medium">{composition.hechura.appliesTo}</span></>
                    : "Hechura / Mano de obra"}
                </div>
              </div>
            )}

            {/* ── Precio / Hechura (costo aplicado) ────────────────────── */}
            {(metalHechuraBreakdown?.hechuraCost != null
              || composition?.hechura?.appliedAmount != null) && (
              <InfoLine
                label="Precio / Hechura"
                value={money(metalHechuraBreakdown?.hechuraCost
                  ?? composition?.hechura?.appliedAmount ?? null)}
              />
            )}

            {/* ── Fórmula principal — passthrough del backend (sin gSF). ──
                Mostramos `hechuraCost → hechuraSale`. El "+%" sólo aparece
                en METAL_HECHURA exacto con margen > 0; en modos derivados
                (PROPORTIONAL_COST, etc.) el motor no expone margen explícito,
                así que omitimos el porcentaje. */}
            {view === "sale"
              && metalHechuraBreakdown?.hechuraCost != null
              && hechuraSale != null
              && Math.abs(hechuraSale - metalHechuraBreakdown.hechuraCost) > 0.005 && (
              <FlowLine>
                {hechuraMarginPct > 0.01 ? (
                  <>
                    <span className="font-mono tabular-nums">{money(metalHechuraBreakdown.hechuraCost)} × {fmtFactor(hechuraMarginPct)}</span>
                    <span className="font-mono"> = </span>
                    <span className="font-mono tabular-nums font-semibold text-text">{money(hechuraSale)}</span>
                    <span className="ml-1 text-[10px] text-muted/50">(+{hechuraMarginPct.toFixed(2)}%)</span>
                  </>
                ) : (
                  <>
                    <span className="font-mono tabular-nums">{money(metalHechuraBreakdown.hechuraCost)}</span>
                    <span className="font-mono"> → </span>
                    <span className="font-mono tabular-nums font-semibold text-text">{money(hechuraSale)}</span>
                  </>
                )}
              </FlowLine>
            )}

            {/* ── Ajustes post-margen del componente HECHURA ──────────────
                Render directo del snapshot del backend (componentSaleBreakdown).
                Cada ajuste fue aplicado por el motor con applyOn=HECHURA. NO
                se recalcula nada en frontend: solo se muestra `base − Σajustes
                = final`. Aparece sólo cuando hay al menos un ajuste imputado. */}
            {view === "sale"
              && componentHechura
              && componentHechura.adjustments.length > 0 && (
              <div className="border-t border-border/40 pt-1.5 space-y-0.5">
                <InfoLine
                  label="Subtotal hechura"
                  value={money(componentHechura.base)}
                />
                {componentHechura.adjustments.map((adj, i) => (
                  <InfoLine
                    key={`h-adj-${adj.kind}-${i}`}
                    label={resolveAdjustmentLabel(adj)}
                    value={
                      <span className={cn(
                        adj.amount > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      )}>
                        {adj.amount > 0 ? "−" : "+"}{money(Math.abs(adj.amount))}
                      </span>
                    }
                  />
                ))}
                <InfoLine
                  label="Hechura final"
                  value={money(componentHechura.final)}
                  bold
                />
              </div>
            )}

            {/* FASE 3 — el split proporcional de impuestos por componente
                se eliminó. Los impuestos se muestran solo en card "TOTAL
                PRODUCTO". */}

            {/* ── Total componente hechura (mismo layout para venta y compra). */}
            {view === "sale" && hechuraSaleFinal != null && (
              <div className="border-t border-border/40 pt-1.5">
                <InfoLine label="Total componente" value={money(hechuraSaleFinal)} bold />
              </div>
            )}
            {view === "cost" && metalHechuraBreakdown?.hechuraCost != null && (
              <div className="border-t border-border/40 pt-1.5">
                <InfoLine label="Total componente" value={money(metalHechuraBreakdown.hechuraCost)} bold />
              </div>
            )}

            {/* Nota MARGIN_TOTAL — sutil */}
            {view === "sale" && isMarginTotal && (
              <div className="text-[10px] italic text-muted/60 border-t border-border/30 pt-1">
                Lista unificada — el margen se aplica al total, no por componente
              </div>
            )}
          </SimCard>
        )}

        {/* ── Card TOTAL PRODUCTO ────────────────────────────────────────── */}
        {/* En MARGIN_TOTAL esta es la card PRINCIPAL: absorbe el margen
            unificado, ganancia/valor agregado y costo base, además del
            subtotal/impuestos/total. */}
        {(hasTotal || hasCost) && (
          <SimCard
            heading={view === "cost" ? "COSTO TOTAL" : "TOTAL PRODUCTO"}
            headingSub={view === "sale" && isMarginTotal && marginPercent != null
              ? `Margen unificado: ${marginPercent.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`
              : undefined}
            value={totalHero}
            mismatch={mismatch}
          >
            {view === "sale" && (
              <>
                {/* Bloque margen unificado — solo MARGIN_TOTAL. */}
                {isMarginTotal && costBase != null && (
                  <InfoLine label="Costo base" value={money(costBase)} />
                )}
                {isMarginTotal && marginPercent != null && (
                  <InfoLine
                    label="Margen unificado"
                    value={`${marginPercent.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`}
                  />
                )}
                {isMarginTotal && (() => {
                  // Ganancia/valor agregado = subtotal − costoBase (display).
                  // No es recálculo de pricing — son dos campos del backend
                  // restados para mostrar al operador cuánto suma el margen.
                  const ganancia = (subtotal != null && costBase != null)
                    ? subtotal - costBase
                    : null;
                  return ganancia != null
                    ? <InfoLine label="Ganancia / valor agregado" value={money(ganancia)} />
                    : null;
                })()}
                {isMarginTotal && (subtotal != null || marginPercent != null) && (
                  <div className="border-t border-border/40 my-1" />
                )}

                {subtotal != null && (
                  <InfoLine label="Subtotal" value={money(subtotal)} />
                )}
                {taxAmount != null && (
                  <InfoLine label="Impuestos" value={money(taxAmount)} />
                )}
                {total != null && (
                  <InfoLine label="Total con impuestos" value={money(total)} bold />
                )}
              </>
            )}
            {view === "cost" && (
              <>
                {costBase != null && (
                  <InfoLine label="Costo base" value={money(costBase)} />
                )}
                {costTaxAmount != null && (
                  <InfoLine label="Impuestos de compra" value={money(costTaxAmount)} />
                )}
                {costWithTax != null && (
                  <InfoLine label="Costo total con imp." value={money(costWithTax)} bold />
                )}
                {Array.isArray(costTaxBreakdown) && costTaxBreakdown.length > 0 && (
                  <div className="mt-2 border-t border-border/40 pt-1.5 space-y-0.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted">Detalle impuestos compra</div>
                    {costTaxBreakdown.map((t, i) => (
                      <InfoLine
                        key={`${t.taxId ?? t.name ?? "tax"}-${i}`}
                        label={<>{t.name ?? "Impuesto"}{t.rate != null && <span className="ml-1 text-muted/60">{t.rate}%</span>}</>}
                        value={money(t.taxAmount)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </SimCard>
        )}
      </div>
    </div>
  );
}
