// src/components/sales/SalePricingPanel.tsx
// ============================================================================
// SalePricingPanel — panel de validación de pricing para Factura de Ventas V1.
//
// Recibe el resultado crudo de `salesApi.preview` y lo pasa por
// `normalizeSalesPreview` para mostrar tres bloques alineados con el Simulador:
//
//   1) documentTotals       → tabla de totales del documento.
//   2) metalHechuraBreakdown → reusando `<TPPriceCompositionKpis>` por línea.
//   3) taxBreakdown          → impuestos agregados a nivel documento.
//
// Reglas (acordadas en plan paso 7 — Factura V1):
//   - 100% passthrough del ViewModel. CERO matemática comercial acá.
//   - No usa `line.products` / `line.services` (todavía no expuestos por
//     `sales/preview` — quedan para una versión futura).
//   - Reutilizable: pensado para Factura, pero también NC, Presupuesto, etc.
//
// Objetivo: que para el mismo input comercial muestre los mismos números que
// el Simulador. Si difieren → bug en la pipeline (no acá).
// ============================================================================

import React from "react";
import { formatMoneyDoc, formatByType } from "../../lib/pricing/format";
import type { SalePreviewResult } from "../../services/sales";
import { normalizeSalesPreview } from "../../lib/pricing/normalizePricingPreviewResult";
import type { NormalizedPricingResult, NormalizedPricingLine } from "../../lib/pricing/contract";
import TPPriceCompositionKpis from "../ui/TPPriceCompositionKpis";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export type SalePricingPanelProps = {
  /** Resultado crudo del backend. null mientras no haya preview o si falló. */
  result?: SalePreviewResult | null;
  /** Símbolo de moneda a mostrar (default vacío). */
  currencySymbol?: string;
  /** Texto a mostrar cuando `result` es null (default genérico). */
  emptyText?: string;
  /** Cuando se pasa, oculta el bloque metal/hechura aunque haya datos. Útil
   *  para flujos que ya muestran la composición en otro lado. */
  hideComposition?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Formato puro
// ─────────────────────────────────────────────────────────────────────────────

// Region-aware vía motor central (Configuración → Formato numérico).
function fmtMoney(v: number | null | undefined, sym?: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const formatted = formatMoneyDoc(v);
  return sym ? `${sym} ${formatted}` : formatted;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${formatByType(v, "PERCENT", { bare: true })}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function Row({
  label, value, bold, muted,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={
      "flex items-baseline justify-between gap-2 text-[12px] " +
      (muted ? "text-muted/70" : "")
    }>
      <span className={bold ? "font-semibold text-text" : "text-muted"}>{label}</span>
      <span className={
        "tabular-nums whitespace-nowrap " +
        (bold ? "font-bold text-text" : "")
      }>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 1 — documentTotals
// ─────────────────────────────────────────────────────────────────────────────

/** Desglose de `lineDiscountAmount` por origen.
 *
 *  Sprint 2 / POLICY.md §4 R4.3 — antes acá se calculaba
 *    customerDisc = max(0, lineDiscountAmount − qtyDisc − promoDisc)
 *  Eso era recálculo, no display: violaba la regla "lector puro".
 *
 *  Ahora:
 *    · `qty` y `promo` son agregación honesta (Σ valor_backend × qty).
 *    · `customer` queda como `null` hasta que el motor exponga
 *      `customerDiscountAmount` per-línea (Sprint 1 ya agregó el campo
 *      nullable al snapshot; el motor todavía no lo computa). La UI
 *      muestra "—" para ese caso (R4.4). */
function splitLineDiscounts(norm: NormalizedPricingResult): {
  qty: number;
  promo: number;
  customer: number | null;
  total: number;
} {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  let qty = 0;
  let promo = 0;
  for (const l of norm.lines) {
    qty   += (l.quantityDiscountAmount  ?? 0) * (l.quantity ?? 0);
    promo += (l.promotionDiscountAmount ?? 0) * (l.quantity ?? 0);
  }
  qty   = round2(qty);
  promo = round2(promo);
  const total    = norm.documentTotals.lineDiscountAmount ?? 0;
  const customer = null;  // POLICY.md R4.3 — no derivar.
  return { qty, promo, customer, total };
}

function DocumentTotalsBlock({
  norm, sym,
}: { norm: NormalizedPricingResult; sym: string }) {
  const dt = norm.documentTotals;
  const disc = splitLineDiscounts(norm);

  // Si el desglose en 3 partes da 0 pero el agregado es > 0 (caso defensivo:
  // datos legacy sin `quantityDiscountAmount`/`promotionDiscountAmount` por
  // línea), caemos al total agregado para no perder visibilidad.
  // `disc.customer` puede ser null — Sprint 2 lo dejó null hasta que el
  // motor lo emita; sumamos 0 para el cálculo del flag, la UI lo dibuja "—".
  const showSplit = (disc.qty + disc.promo + (disc.customer ?? 0)) > 0 || disc.total === 0;

  // Orden: subtotal lista → desc qty/promo/cliente → subtotal post-línea →
  // canal → cupón → pago → envío → descuento global → base imponible →
  // impuestos → redondeo doc → total.
  return (
    <div className="rounded-md border border-border/60 bg-surface/40 px-3 py-2 space-y-1">
      <SectionTitle>Totales del documento</SectionTitle>
      <Row label="Subtotal (lista)"             value={fmtMoney(dt.subtotalBeforeDiscounts, sym)} />
      {showSplit ? (
        <>
          <Row label="Descuento por cantidad"    value={fmtMoney(-disc.qty,      sym)} muted={disc.qty      === 0} />
          <Row label="Promoción"                 value={fmtMoney(-disc.promo,    sym)} muted={disc.promo    === 0} />
          <Row
            label="Descuento de cliente"
            value={disc.customer == null ? "—" : fmtMoney(-disc.customer, sym)}
            muted={disc.customer == null || disc.customer === 0}
          />
        </>
      ) : (
        <Row label="Descuentos de línea"        value={fmtMoney(-dt.lineDiscountAmount, sym)} muted={dt.lineDiscountAmount === 0} />
      )}
      <Row label="Subtotal post-descuentos"     value={fmtMoney(dt.subtotalAfterLineDiscounts, sym)} />
      <Row label="Ajuste por canal"             value={fmtMoney(dt.channelAdjustmentAmount, sym)} muted={dt.channelAdjustmentAmount === 0} />
      <Row label="Descuento por cupón"          value={fmtMoney(-dt.couponDiscountAmount, sym)} muted={dt.couponDiscountAmount === 0} />
      <Row label="Recargo / descuento de pago"  value={fmtMoney(dt.paymentAdjustmentAmount, sym)} muted={dt.paymentAdjustmentAmount === 0} />
      <Row label="Envío"                        value={fmtMoney(dt.shippingAmount, sym)} muted={dt.shippingAmount === 0} />
      <Row label="Descuento global"             value={fmtMoney(-dt.globalDiscountAmount, sym)} muted={dt.globalDiscountAmount === 0} />
      <div className="border-t border-border/40 my-1" />
      <Row label="Base imponible"               value={fmtMoney(dt.taxableBase, sym)} />
      <Row label="Impuestos"                    value={fmtMoney(dt.taxAmount, sym)} />
      <Row label="Ajuste de redondeo"           value={fmtMoney(dt.roundingAdjustment, sym)} muted={dt.roundingAdjustment === 0} />
      <div className="border-t border-border/40 my-1" />
      <Row label="Total"                        value={fmtMoney(dt.total, sym)} bold />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 2 — metalHechuraBreakdown por línea
// ─────────────────────────────────────────────────────────────────────────────

function MetalHechuraBlock({
  norm, sym,
}: { norm: NormalizedPricingResult; sym: string }) {
  // Filtra solo líneas con MHB poblado. Si ninguna, no renderiza el bloque.
  const linesWithMHB = norm.lines
    .map((l, idx) => ({ line: l, idx }))
    .filter(x => x.line.metalHechuraBreakdown != null);
  if (linesWithMHB.length === 0) return null;

  return (
    <div className="space-y-2">
      <SectionTitle>Composición Metal / Hechura</SectionTitle>
      <div className="space-y-3">
        {linesWithMHB.map(({ line, idx }) => (
          <LineCompositionCard key={`${line.articleId}-${line.variantId ?? "p"}-${idx}`}
            line={line} idx={idx} sym={sym} />
        ))}
      </div>
    </div>
  );
}

function LineCompositionCard({
  line, idx, sym,
}: { line: NormalizedPricingLine; idx: number; sym: string }) {
  // Header simple por línea (qty + unitPrice). El detalle visual lo arma
  // `TPPriceCompositionKpis`, que ya recibe los mismos campos que el Simulador.
  return (
    <div className="rounded-md border border-border/60 bg-surface/40 px-3 py-2">
      <div className="mb-2 flex items-baseline justify-between text-[11px] text-muted">
        <span className="font-semibold text-text">
          Línea {idx + 1}
        </span>
        <span className="tabular-nums">
          qty {line.quantity} · unit {fmtMoney(line.unitPrice, sym)}
        </span>
      </div>
      <TPPriceCompositionKpis
        composition={line.composition ?? undefined}
        metalHechuraBreakdown={line.metalHechuraBreakdown ?? undefined}
        componentSaleBreakdown={line.componentSaleBreakdown ?? undefined}
        total={line.lineTotalWithTax ?? null}
        subtotal={line.lineTotal ?? null}
        taxAmount={line.lineTaxAmount ?? null}
        marginPercent={line.marginPercent ?? null}
        priceListMode={line.appliedPriceListMode ?? undefined}
        currencySymbol={sym}
        mode="invoice"
        view="sale"
        emptyText="Sin desglose disponible para esta línea."
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 3 — taxBreakdown agregado a nivel documento
// ─────────────────────────────────────────────────────────────────────────────

type TaxAgg = { name: string; rate: number | null; baseAmount: number; taxAmount: number };

/** Agrupa el `taxBreakdown` de TODAS las líneas por taxId. Solo suma — no
 *  recalcula nada que el motor no haya emitido. */
function aggregateTaxBreakdown(norm: NormalizedPricingResult): TaxAgg[] {
  const acc = new Map<string, TaxAgg>();
  for (const line of norm.lines) {
    for (const tb of line.taxBreakdown ?? []) {
      const key = tb.taxId || tb.name;
      const cur = acc.get(key);
      if (cur) {
        cur.baseAmount += tb.baseAmount;
        cur.taxAmount  += tb.taxAmount;
      } else {
        acc.set(key, {
          name: tb.name,
          rate: tb.rate ?? null,
          baseAmount: tb.baseAmount,
          taxAmount:  tb.taxAmount,
        });
      }
    }
  }
  return Array.from(acc.values());
}

function TaxBreakdownBlock({
  norm, sym,
}: { norm: NormalizedPricingResult; sym: string }) {
  const items = aggregateTaxBreakdown(norm);
  if (items.length === 0) {
    // Sin impuestos: mostrar la fila para confirmar que no es por falta de
    // datos sino porque el motor resolvió 0.
    return (
      <div className="rounded-md border border-border/60 bg-surface/40 px-3 py-2 space-y-1">
        <SectionTitle>Impuestos</SectionTitle>
        <Row label="Sin impuestos aplicados" value="—" muted />
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border/60 bg-surface/40 px-3 py-2 space-y-1">
      <SectionTitle>Impuestos</SectionTitle>
      {items.map((t, i) => (
        <Row
          key={`${t.name}-${i}`}
          label={
            <>
              {t.name}
              {t.rate != null && <span className="ml-1 text-muted/60">{fmtPct(t.rate)}</span>}
            </>
          }
          value={fmtMoney(t.taxAmount, sym)}
        />
      ))}
      <div className="border-t border-border/40 my-1" />
      <Row
        label="Total impuestos"
        value={fmtMoney(norm.documentTotals.taxAmount, sym)}
        bold
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function SalePricingPanel(props: SalePricingPanelProps) {
  const {
    result,
    currencySymbol = "",
    emptyText = "Aún no hay un preview del backend para mostrar.",
    hideComposition = false,
  } = props;

  if (!result) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-card/40 p-3 text-xs italic text-muted/70">
        {emptyText}
      </div>
    );
  }

  // Try/catch defensivo: si el normalizer falla por shape inesperado, no
  // tumba la pantalla — mostramos un mensaje y el operador puede seguir.
  let norm: NormalizedPricingResult;
  try {
    norm = normalizeSalesPreview(result);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[SalePricingPanel] normalizeSalesPreview falló:", e);
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
        No se pudo normalizar el preview del backend. Revisar la consola para
        más detalle. Los totales del documento siguen funcionando con la fuente
        original — este panel es solo de validación.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DocumentTotalsBlock norm={norm} sym={currencySymbol} />
      {!hideComposition && <MetalHechuraBlock norm={norm} sym={currencySymbol} />}
      <TaxBreakdownBlock norm={norm} sym={currencySymbol} />
    </div>
  );
}
