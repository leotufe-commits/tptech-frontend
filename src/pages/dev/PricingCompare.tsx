// src/pages/dev/PricingCompare.tsx
// ============================================================================
// PricingCompare — pantalla dev-only de QA del pricing-engine.
//
// Llama en paralelo a:
//   · `articlesApi.getPricingPreview`  (usado por el Simulador de Artículos)
//   · `salesApi.preview`               (usado por Factura Ventas)
//
// Con los MISMOS inputs (artículo, cliente, lista, canal, cupón, cantidad) y
// muestra una tabla concepto-por-concepto con diferencia y estado. Ambas
// pantallas productivas deben converger en el mismo motor; cuando no
// convergen, esta página marca exactamente dónde.
//
// La pantalla no recalcula precios: solo lee los campos crudos de cada
// respuesta y los pone uno al lado del otro. Si las cifras no coinciden,
// el bug está en uno de los dos endpoints o en cómo el frontend mapea
// la respuesta — nunca en este comparador.
//
// La ruta `/dev/pricing-compare` se registra solo cuando `import.meta.env.DEV`
// es true (ver `router.tsx`). En producción, la página redirecciona al
// dashboard.
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Beaker, Copy, Loader2, RefreshCw } from "lucide-react";

import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPCard } from "../../components/ui/TPCard";
import TPPriceCompositionKpis from "../../components/ui/TPPriceCompositionKpis";
import TPBalanceBreakdownKpis from "../../components/ui/TPBalanceBreakdownKpis";
import { TPCollapse } from "../../components/ui/TPCollapse";
import { TPField } from "../../components/ui/TPField";
import { TPButton } from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import TPNumberInput from "../../components/ui/TPNumberInput";
import TPSelect from "../../components/ui/TPSelect";
import TPComboFixed from "../../components/ui/TPComboFixed";
import { TPInfoCard } from "../../components/ui/TPInfoCard";
import ArticleSearchSelect from "../../components/ui/ArticleSearchSelect";
import EntitySearchSelect from "../../components/ui/EntitySearchSelect";
import { cn } from "../../components/ui/tp";
import { round2 } from "../../lib/document-helpers";
// Comparador: el dinero respeta la región del tenant (helper central
// config-aware con MISMA semántica que el fmtMoney de document-helpers).
import { formatMoneyDoc as fmtMoney, formatDecimalUpTo } from "../../lib/pricing/format";

import {
  articlesApi,
  type ArticleRow,
  type ArticleVariant,
  type PricingPreviewResult,
} from "../../services/articles";
import {
  salesApi,
  type SalePreviewInput,
  type SalePreviewResult,
} from "../../services/sales";
import { priceListsApi, type PriceListRow } from "../../services/price-lists";
import { salesChannelsApi, type SalesChannelRow } from "../../services/sales-channels";
import { paymentsApi, type PaymentMethodRow } from "../../services/payments";
import { shippingApi, type ShippingCarrierRow } from "../../services/shipping";
import { listCurrencies, type CurrencyRow } from "../../services/valuation";
import {
  commercialEntitiesApi,
  BALANCE_TYPE_LABELS,
  type EntityRow,
  type AccountStatement,
} from "../../services/commercial-entities";

// ── Fase 2A — Comparador sobre contrato unificado ──────────────────────────
//
// El comparador construye UN SOLO payload con `buildPricingPreviewPayload` y
// lo adapta a cada endpoint con `toArticlePricingPreviewArgs` y
// `toSalesPreviewArgs`. Las dos respuestas se normalizan vía
// `normalizeArticlePricingPreview` / `normalizeSalesPreview` para que las
// filas de comparación lean exactamente los mismos campos del lado del
// Simulador y del lado de Factura. Esto reemplaza el escalado manual
// per-unit → per-doc que vivía en `buildRows` y la lógica de ajuste por
// `applyOn` del redondeo.
import {
  toArticlePricingPreviewArgs,
  toSalesPreviewArgs,
  normalizeArticlePricingPreview,
  normalizeSalesPreview,
  type PricingPreviewPayload,
  type NormalizedPricingResult,
} from "../../lib/pricing";

const DEV_ONLY = import.meta.env.DEV;

// ─────────────────────────────────────────────────────────────────────────────
// Estados de comparación
// ─────────────────────────────────────────────────────────────────────────────

// Clasificación con `rounding` separado de `minor`. Idea: el redondeo es
// esperado y no debe llamar la atención; solo `minor` (>0.10) y `critical`
// (>1) cuentan como "algo a revisar".
//
// `expected`: diferencia conocida y prevista por arquitectura — típicamente
// el redondeo a nivel comprobante (TENANT_POLICY) que la Factura aplica y el
// Simulador no. NO cuenta como diferencia crítica; se rotula explícitamente
// para que el operador lo entienda.
type CompareStatus = "ok" | "rounding" | "expected" | "minor" | "critical" | "n/a";

const STATUS_TONE: Record<CompareStatus, string> = {
  ok:       "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  rounding: "bg-sky-500/10     text-sky-400     border-sky-500/25",
  expected: "bg-violet-500/10  text-violet-400  border-violet-500/25",
  minor:    "bg-amber-500/10   text-amber-500   border-amber-500/30",
  critical: "bg-red-500/10     text-red-500     border-red-500/30",
  "n/a":    "bg-muted/10       text-muted       border-border",
};

const STATUS_LABEL: Record<CompareStatus, string> = {
  ok:       "Coincide",
  rounding: "Redondeo",
  expected: "Esperado",
  minor:    "Diferencia a revisar",
  critical: "Diferencia crítica",
  "n/a":    "No comparable",
};

const STATUS_TOOLTIP: Record<CompareStatus, string> = {
  ok:       "Las dos fuentes devuelven exactamente el mismo importe (tolerancia de 0,01).",
  rounding: "Diferencia menor causada por redondeo o precisión decimal. No es un error.",
  expected: "Diferencia esperada por arquitectura. El simulador no aplica el redondeo por comprobante (TENANT_POLICY) — solo lo aplica la factura sobre el total final del documento.",
  minor:    "Diferencia mayor a la tolerancia de redondeo. Vale la pena revisar inputs y mapeos.",
  critical: "Diferencia importante. Indica un mapeo distinto o una falla real del motor.",
  "n/a":    "No se puede comparar: falta el dato en uno de los dos endpoints.",
};

function classifyDiff(sim: number | null, sale: number | null): {
  status: CompareStatus;
  diff:   number | null;
} {
  if (sim == null || sale == null) return { status: "n/a", diff: null };
  const diff = round2(sale - sim);
  const abs  = Math.abs(diff);
  if (abs <= 0.01) return { status: "ok",       diff };
  if (abs <= 0.10) return { status: "rounding", diff };
  if (abs <= 1)    return { status: "minor",    diff };
  return { status: "critical", diff };
}

function asNum(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción de filas de comparación
// ─────────────────────────────────────────────────────────────────────────────

type CompareRow = {
  concept:      string;
  sim:          number | null;
  sale:         number | null;
  diff:         number | null;
  status:       CompareStatus;
  sublabel?:    string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fase 2A — Comparación sobre resultados NORMALIZADOS
// ─────────────────────────────────────────────────────────────────────────────
//
// Ambos lados (Simulador y Factura) se exponen ya en escala per-doc dentro de
// `NormalizedPricingResult.documentTotals`. La función lee los mismos campos
// en los dos resultados y arma las filas sin escalar nada manualmente — el
// escalado per-unit → per-doc del Simulador lo hace el normalizador.
//
// El ajuste por `applyOn` del redondeo deja de ser necesario: ambos lados
// ya devuelven `taxableBase` con el redondeo absorbido en `lineTotal`.

function buildRowsNormalized(args: {
  sim:     NormalizedPricingResult | null;
  sale:    NormalizedPricingResult | null;
  /** Raws — Fase 2A.6. Necesarios para `metalHechuraBreakdown` que aún no
   *  vive en el contrato unificado. Se accede sólo en lectura, sin cálculos. */
  simRaw?:  PricingPreviewResult | null;
  saleRaw?: SalePreviewResult    | null;
}): CompareRow[] {
  const { sim, sale, simRaw, saleRaw } = args;
  const simDt   = sim?.documentTotals  ?? null;
  const saleDt  = sale?.documentTotals ?? null;
  const simL    = sim?.lines?.[0]  ?? null;
  const saleL   = sale?.lines?.[0] ?? null;

  // Paridad de `documentTotals` confirmada en el backend desde Fase 4:
  // `articles/pricing-preview` convierte ahora `documentTotals` con el mismo
  // helper `convertSaleDocumentTotalsInPlace` que `sales/preview`. El guard
  // de asimetría que vivía acá ya no es necesario — los aliases quedan por
  // compatibilidad con el resto del código que los referencia.
  const safeSimDt  = simDt;
  const safeSimBkS = simDt as any;

  // Tax breakdown agregado por (name|rate). Sumar a per-doc:
  // - Sim: línea 0 está per-unit → multiplicar × qty
  // - Sales: línea 0 está per-línea (ya × qty)
  const aggSim  = aggregateNormalizedTaxes(simL,  /*scaleByQty=*/true);
  const aggSale = aggregateNormalizedTaxes(saleL, /*scaleByQty=*/false);
  const taxKeys = new Set<string>([...aggSim.keys(), ...aggSale.keys()]);

  const rows: CompareRow[] = [];

  // 1 · Precio lista unitario
  rows.push(makeRow("Precio lista unitario", simL?.basePrice ?? null, saleL?.basePrice ?? null));

  // 2 · Cantidad
  rows.push(makeRow("Cantidad", simL?.quantity ?? null, saleL?.quantity ?? null));

  // 3 · Subtotal bruto (per-doc)
  rows.push(makeRow(
    "Subtotal bruto (lista × cant.)",
    safeSimDt?.subtotalBeforeDiscounts ?? null,
    saleDt?.subtotalBeforeDiscounts ?? null,
  ));

  // 4 · Descuento de cliente (derivado): lineDiscount − qtyDisc − promoDisc
  const simQtyDoc   = simL  ? round2((simL.quantityDiscountAmount  ?? 0) * (simL.quantity || 1)) : 0;
  const simPromoDoc = simL  ? round2((simL.promotionDiscountAmount ?? 0) * (simL.quantity || 1)) : 0;
  const saleQtyDoc  = saleL ? round2((saleL.quantityDiscountAmount ?? 0) * (saleL.quantity || 1)) : 0;
  const salePromoDoc= saleL ? round2((saleL.promotionDiscountAmount?? 0) * (saleL.quantity || 1)) : 0;
  // Cuando hay asimetría de moneda en `simDt`, esta derivación mezclaría
  // `lineDiscountAmount` (BASE) con `simQtyDoc / simPromoDoc` (convertidos)
  // y daría números falsos. `safeSimDt = null` → simCustDisc = null automático.
  const simCustDisc  = safeSimDt ? round2((safeSimDt.lineDiscountAmount ?? 0) - simQtyDoc  - simPromoDoc)  : null;
  const saleCustDisc = saleDt    ? round2((saleDt.lineDiscountAmount    ?? 0) - saleQtyDoc - salePromoDoc) : null;
  rows.push(makeRow("Descuento de cliente (derivado)", simCustDisc, saleCustDisc));

  // 5 · Canal de venta
  rows.push(makeRow(
    "Canal de venta (per-doc)",
    safeSimDt?.channelAdjustmentAmount  ?? null,
    saleDt?.channelAdjustmentAmount ?? null,
  ));

  // 6 · Promoción
  rows.push(makeRow(
    "Promoción",
    simPromoDoc  > 0 ? simPromoDoc  : null,
    salePromoDoc > 0 ? salePromoDoc : null,
    sim?.lines?.[0]?.appliedPromotionName ?? sale?.lines?.[0]?.appliedPromotionName ?? undefined,
  ));

  // 7 · Descuento por cantidad
  rows.push(makeRow(
    "Descuento por cantidad",
    simQtyDoc  > 0 ? simQtyDoc  : null,
    saleQtyDoc > 0 ? saleQtyDoc : null,
  ));

  // 8 · Cupón
  rows.push(makeRow(
    "Cupón (per-doc)",
    safeSimDt?.couponDiscountAmount  ?? null,
    saleDt?.couponDiscountAmount ?? null,
    sim?.coupon?.couponCode ?? sale?.coupon?.couponCode ?? undefined,
  ));

  // 9 · Subtotal neto antes de impuestos (taxableBase)
  rows.push(makeRow(
    "Subtotal neto antes de impuestos",
    safeSimDt?.taxableBase  ?? null,
    saleDt?.taxableBase ?? null,
  ));

  // 10 · Impuestos total
  rows.push(makeRow(
    "Impuestos (total)",
    safeSimDt?.taxAmount  ?? null,
    saleDt?.taxAmount ?? null,
  ));

  // 11 · Por nombre / %
  for (const key of Array.from(taxKeys).sort()) {
    const a = aggSim.get(key)  ?? null;
    const b = aggSale.get(key) ?? null;
    const label = a?.label ?? b?.label ?? "Impuesto";
    rows.push(makeRow(`   · ${label}`, a?.amount ?? null, b?.amount ?? null));
  }

  // 11.a · Margen % por componente (lectura directa del breakdown per-line).
  // Los importes per-doc viven en `documentTotals.{metal,hechura}{Cost,Sale}Subtotal`
  // y se renderizan más abajo (11.a.bis). Acá solo mostramos los porcentajes,
  // que NO se escalan por qty.
  const simMHB  = (simRaw  as any)?.metalHechuraBreakdown ?? null;
  const saleMHB = (saleRaw as any)?.lines?.[0]?.metalHechuraBreakdown ?? null;
  if (simMHB || saleMHB) {
    rows.push(makeRow(
      "Metal — margen %",
      simMHB?.metalMarginPct  ?? null,
      saleMHB?.metalMarginPct ?? null,
    ));
    rows.push(makeRow(
      "Hechura — margen %",
      simMHB?.hechuraMarginPct  ?? null,
      saleMHB?.hechuraMarginPct ?? null,
    ));
  }

  // 11.a.bis · Agregados Metal/Hechura a nivel documento (FASE 2 backend).
  // El motor `computeSaleDocumentTotals` ahora suma `metalCost` /
  // `hechuraCost` / `metalSale` / `hechuraSale` de cada línea y expone
  // los subtotales del documento. Misma fuente, más confiable que escalar
  // por línea — útil cuando hay multi-línea.
  // `safeSimBkS` queda null cuando hay asimetría de moneda → estas filas
  // se vuelven "n/a" en lugar de mostrar números cruzados.
  const simBkS  = safeSimBkS;
  const saleBkS = saleDt as any;
  const hasDocBreakdown =
    simBkS?.metalSaleSubtotal != null ||
    simBkS?.hechuraSaleSubtotal != null ||
    saleBkS?.metalSaleSubtotal != null ||
    saleBkS?.hechuraSaleSubtotal != null;
  if (hasDocBreakdown) {
    const simEstimated  = !!simBkS?.breakdownEstimated;
    const saleEstimated = !!saleBkS?.breakdownEstimated;
    const subSuffix = (simEstimated || saleEstimated)
      ? "Algún componente estimado por proporción de costo"
      : undefined;
    rows.push(makeRow(
      "Metal — venta subtotal (doc)",
      simBkS?.metalSaleSubtotal  ?? null,
      saleBkS?.metalSaleSubtotal ?? null,
      subSuffix,
    ));
    rows.push(makeRow(
      "Hechura — venta subtotal (doc)",
      simBkS?.hechuraSaleSubtotal  ?? null,
      saleBkS?.hechuraSaleSubtotal ?? null,
      subSuffix,
    ));
    rows.push(makeRow(
      "Metal — costo subtotal (doc)",
      simBkS?.metalCostSubtotal  ?? null,
      saleBkS?.metalCostSubtotal ?? null,
    ));
    rows.push(makeRow(
      "Hechura — costo subtotal (doc)",
      simBkS?.hechuraCostSubtotal  ?? null,
      saleBkS?.hechuraCostSubtotal ?? null,
    ));
  }

  // 11.b · Forma de pago — paymentAdjustment per-doc.
  // Sim: el normalizador escala × qty (Fase 2A.4 fix). Sale: viene per-doc.
  // Cuando ambos lados aplican la misma forma de pago, deben coincidir.
  rows.push(makeRow(
    "Forma de pago — ajuste (per-doc)",
    safeSimDt?.paymentAdjustmentAmount  ?? null,
    saleDt?.paymentAdjustmentAmount ?? null,
    sim?.payment?.installments
      ? `${sim.payment.installments} cuota${sim.payment.installments === 1 ? "" : "s"}`
      : sale?.payment?.installments
        ? `${sale.payment.installments} cuota${sale.payment.installments === 1 ? "" : "s"}`
        : undefined,
  ));

  // 11.c · Envío — per-doc. La Factura siempre lo expone en doctotals; el
  // Sim lo expone solo si shippingResult viene seteado.
  rows.push(makeRow(
    "Envío (per-doc)",
    safeSimDt?.shippingAmount  ?? null,
    saleDt?.shippingAmount ?? null,
    sim?.shipping?.mode ?? sale?.shipping?.mode ?? undefined,
  ));

  // 11.d · Redondeo por artículo / lista — INDEPENDIENTE del comprobante.
  // Fuente: Lista de precios. Si el motor lo aplicó en algún lado, hay
  // `appliedRounding` con `unitAdjustment` (per unit). Lo escalamos × qty
  // para verlo a nivel doc.
  //
  // Casos:
  //   · Lista sin redondeo activo en ambos → no agregamos la fila.
  //   · Aplicado en ambos → ok / rounding según diff (paridad esperada).
  //   · Suprimido en simulador por política doc (`appliedRoundingSuppressedByDocPolicy`)
  //     + factura con TENANT_POLICY → ambos suprimieron el redondeo de
  //     lista, fila marcada como "expected".
  //   · Diferencia inexplicada → sigue clasificación normal (critical/minor).
  const simAR    = simL?.appliedRounding  ?? null;
  const saleAR   = saleL?.appliedRounding ?? null;
  const simSuppressedByDocPolicy =
    !!(simRaw as any)?.appliedRoundingSuppressedByDocPolicy;
  const listMetaSim = (simRaw as any)?.listRoundingMeta ?? null;
  const docPolicyOnInvoice = sale?.roundingInfo?.source === "TENANT_POLICY";
  const listHasRoundingConfig =
    !!simAR || !!saleAR || simSuppressedByDocPolicy ||
    (listMetaSim && listMetaSim.target === "FINAL_PRICE" && listMetaSim.mode !== "NONE");
  if (listHasRoundingConfig) {
    const simQty  = simL?.quantity  || 1;
    const saleQty = saleL?.quantity || 1;
    const simListAdj  = simAR
      ? round2(Number(simAR.unitAdjustment ?? 0)  * simQty)
      : null;
    const saleListAdj = saleAR
      ? round2(Number(saleAR.unitAdjustment ?? 0) * saleQty)
      : null;
    const cfg = simAR ?? saleAR ?? listMetaSim;
    const sublabelParts: string[] = ["Fuente: Lista de precios"];
    if (cfg) {
      const applyOn = cfg.applyOn;
      const mode    = (cfg as any).mode;
      const direction = (cfg as any).direction;
      if (applyOn || mode || direction) {
        sublabelParts.push([applyOn, mode, direction].filter(Boolean).join(" · "));
      }
    }
    if (simSuppressedByDocPolicy && docPolicyOnInvoice) {
      // Ambos suprimieron el redondeo de lista por la política doc → es
      // diferencia esperada (ambos lados → 0/null) y NO es crítica.
      rows.push({
        concept:  "Redondeo por artículo / lista",
        sim:      null,
        sale:     saleListAdj,
        diff:     saleListAdj,
        status:   "expected",
        sublabel: `${sublabelParts.join(" · ")} · suprimido por redondeo de comprobante activo`,
      });
    } else if (simSuppressedByDocPolicy && !saleAR) {
      // Sim suprimido pero factura tampoco aplica redondeo de lista
      // (probablemente porque la política doc también la afectó).
      rows.push({
        concept:  "Redondeo por artículo / lista",
        sim:      null,
        sale:     null,
        diff:     null,
        status:   "expected",
        sublabel: `${sublabelParts.join(" · ")} · suprimido por política de comprobante`,
      });
    } else {
      rows.push(makeRow(
        "Redondeo por artículo / lista",
        simListAdj,
        saleListAdj,
        sublabelParts.join(" · "),
      ));
    }
  }

  // 12 · Redondeo (display delta).
  //   · Cuando source=TENANT_POLICY (política del tenant), el label es
  //     "Redondeo comprobante" y el delta SÍ afecta el total.
  //   · Cuando source=PRICE_LIST (lista de precios), el label es "Redondeo
  //     (lista de precios)" y el delta es display-only — el motor lo absorbió
  //     en cada línea.
  //   · Sin redondeo activo, fila tenue "n/a".
  //
  // Caso especial: el redondeo TENANT_POLICY solo lo aplica la Factura (es
  // por documento). Cuando aparece solo del lado de la factura, NO es un
  // bug de mapeo — es la diferencia esperada por arquitectura. La marcamos
  // con status="expected" y la excluimos del conteo de diferencias críticas.
  const simRound  = safeSimDt?.roundingAdjustment  ?? null;
  const saleRound = saleDt?.roundingAdjustment ?? null;
  const noRoundingActive = !sim?.roundingInfo && !sale?.roundingInfo;
  const docRoundingActive =
    sim?.roundingInfo?.source === "TENANT_POLICY" ||
    sale?.roundingInfo?.source === "TENANT_POLICY";
  /** Política doc activa SOLO en factura — caso "esperado" por diseño. */
  const docRoundingOnlyOnInvoice =
    sale?.roundingInfo?.source === "TENANT_POLICY" &&
    sim?.roundingInfo?.source  !== "TENANT_POLICY";

  if (noRoundingActive) {
    rows.push({
      concept:  "Redondeo",
      sim:      null,
      sale:     null,
      diff:     null,
      status:   "n/a",
      sublabel: "Sin redondeo configurado",
    });
  } else if (docRoundingOnlyOnInvoice) {
    // Sim: "No aplica" (el simulador no aplica redondeo por comprobante).
    // Sale: el delta del redondeo aplicado por la política tenant.
    // Diff: el saleRound (== sale - 0). status="expected" → no crítica.
    rows.push({
      concept:  "Redondeo comprobante",
      sim:      null,
      sale:     saleRound,
      diff:     saleRound,
      status:   "expected",
      sublabel: "El simulador no aplica redondeo por comprobante — solo se aplica al total final de la factura.",
    });
  } else {
    const applyOn = sim?.roundingInfo?.applyOn ?? sale?.roundingInfo?.applyOn ?? "";
    rows.push(makeRow(
      docRoundingActive ? "Redondeo comprobante" : "Redondeo (lista de precios)",
      simRound,
      saleRound,
      applyOn ? `applyOn=${applyOn}` : undefined,
    ));
  }

  // 13 · Total línea (con impuestos)
  rows.push(makeRow(
    "Total línea (con impuestos)",
    simL?.lineTotalWithTax  ?? null,
    saleL?.lineTotalWithTax ?? null,
  ));

  // 13.b · Total sin redondeo — solo cuando hay redondeo a nivel comprobante
  // (TENANT_POLICY). En ese caso el `total` viene redondeado y mostramos el
  // valor previo para que el operador vea el ajuste explícito.
  if (docRoundingActive) {
    // `simBefore` se deriva de `safeSimDt.total` para que en multimoneda con
    // gap quede null (no mezcla base con convertida).
    const simBefore = safeSimDt?.total != null && simRound != null
      ? round2(safeSimDt.total - simRound)
      : null;
    const saleBefore = saleDt?.total != null && saleRound != null
      ? round2(saleDt.total - saleRound)
      : null;
    rows.push(makeRow("Total sin redondeo", simBefore, saleBefore));
  }

  // 14 · Total documento (final, ya redondeado si aplica).
  // Cuando el redondeo doc solo aparece en factura, la diferencia entre
  // `sale.total` y `sim.total` debería coincidir con `saleRound` (el delta
  // que la política tenant aplicó). Si coincide → no es un bug, es esperado.
  const totalRow = makeRow(
    docRoundingActive ? "Total final" : "Total documento",
    safeSimDt?.total  ?? null,
    saleDt?.total ?? null,
  );
  if (
    docRoundingOnlyOnInvoice &&
    totalRow.diff != null &&
    saleRound    != null &&
    Math.abs(totalRow.diff - saleRound) <= 0.02
  ) {
    rows.push({
      ...totalRow,
      status:   "expected",
      sublabel: "Diferencia esperada por redondeo de comprobante.",
    });
  } else {
    rows.push(totalRow);
  }

  return rows;
}

function aggregateNormalizedTaxes(
  line: NormalizedPricingResult["lines"][number] | null,
  scaleByQty: boolean,
): Map<string, { label: string; amount: number }> {
  const out = new Map<string, { label: string; amount: number }>();
  if (!line) return out;
  const qty = scaleByQty ? (line.quantity || 1) : 1;
  for (const tb of line.taxBreakdown ?? []) {
    const name = tb.name ?? "Impuesto";
    const rate = tb.rate ?? null;
    const key  = taxKey(name, rate);
    const lbl  = rate != null ? `${name} ${rate}%` : name;
    const cur  = out.get(key);
    const inc  = round2(Number(tb.taxAmount ?? 0) * qty);
    if (cur) cur.amount = round2(cur.amount + inc);
    else out.set(key, { label: lbl, amount: inc });
  }
  return out;
}

/**
 * @deprecated Fase 2A — reemplazado por `buildRowsNormalized` que opera sobre
 *   resultados ya normalizados. Se preserva temporalmente para revertir si
 *   aparece una diferencia con el camino normalizado. Eliminar cuando el
 *   nuevo camino se valide manualmente y los tests de paridad estén verdes.
 *   TODO Fase 2A.4: borrar junto con `aggregateSimTaxes` y `aggregateSaleTaxes`.
 */
function buildRows(args: {
  sim:      PricingPreviewResult | null;
  sale:     SalePreviewResult    | null;
  quantity: number;
}): CompareRow[] {
  const { sim, sale, quantity } = args;
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

  // ── Semántica de cada endpoint (auditada en el código del motor) ───────────
  //
  //   `articlesApi.getPricingPreview` (Simulador)
  //     · `unitPrice`, `basePrice`, `taxAmount`, `totalWithTax`,
  //       `quantityDiscountAmount`, `promotionDiscountAmount` → PER UNIT
  //     · `channelResult.channelAmount`        → PER UNIT
  //       (articles.controller llama `applySalesChannelAdjustment(unitPrice, …)`)
  //     · `couponResult.discountAmount`        → PER UNIT
  //       (se aplica sobre el priceAfterChannel unitario)
  //     · `taxBreakdown[].taxAmount`           → PER UNIT
  //
  //   `salesApi.preview` (Factura Ventas)
  //     · `lines[i].basePrice`, `lines[i].unitPrice` → PER UNIT
  //     · `lines[i].quantityDiscountAmount`, `promotionDiscountAmount` → PER UNIT
  //     · `lines[i].lineTotal`, `lineTotalWithTax`, `lineTaxAmount` → PER LÍNEA (× qty)
  //     · `lines[i].taxBreakdown[].taxAmount`  → PER LÍNEA (× qty)
  //     · `documentTotals.channelAdjustmentAmount` → PER DOC (qty-aware)
  //     · `documentTotals.couponDiscountAmount`    → PER DOC (qty-aware)
  //     · `documentTotals.taxableBase`             → PER DOC, post-canal y post-cupón
  //     · `documentTotals.taxAmount`               → PER DOC
  //
  // Para que la comparación tenga sentido, todo se escala al mismo plano
  // (per-doc) antes de medir diferencia.

  // Sim → unitarios (string)
  const simBase       = asNum(sim?.basePrice);
  const simUnit       = asNum(sim?.unitPrice);          // post-list, pre-canal/cupón
  const simTaxUnit    = asNum(sim?.taxAmount);
  const simTotalUnit  = asNum(sim?.totalWithTax);       // unitPrice + taxAmount, sin canal/cupón
  const simQtyDiscUnit   = asNum(sim?.quantityDiscountAmount);
  const simPromoDiscUnit = asNum(sim?.promotionDiscountAmount);
  // Per-unit del simulador → escalo a per-doc.
  const simChannelPerUnit = sim?.channelResult?.channelAmount ?? null;
  const simCouponPerUnit  = sim?.couponResult?.applied ? (sim?.couponResult?.discountAmount ?? null) : null;
  const simChannelDoc     = simChannelPerUnit != null ? round2(simChannelPerUnit * qty) : null;
  const simCouponDoc      = simCouponPerUnit  != null ? round2(simCouponPerUnit  * qty) : null;

  // Sales → línea[0] + documentTotals
  const saleLine0 = sale?.lines?.[0] ?? null;
  const saleBase  = saleLine0?.basePrice ?? null;
  const saleUnit  = saleLine0?.unitPrice ?? null;
  const saleQtyDiscUnit   = saleLine0?.quantityDiscountAmount ?? null;
  const salePromoDiscUnit = saleLine0?.promotionDiscountAmount ?? null;
  const dt = sale?.documentTotals ?? null;

  // Helpers para subtotales escalados a `qty` desde valores unitarios del sim.
  const scale = (u: number | null) => (u == null ? null : round2(u * qty));

  // Tax breakdown agregado por (name|rate).
  const aggSimTaxes  = aggregateSimTaxes(sim, qty);
  const aggSaleTaxes = aggregateSaleTaxes(sale);
  const taxKeys = new Set<string>([...aggSimTaxes.keys(), ...aggSaleTaxes.keys()]);

  const rows: CompareRow[] = [];

  // 1 · Precio lista unitario
  rows.push(makeRow("Precio lista unitario", simBase, saleBase));

  // 2 · Cantidad (sanity check)
  rows.push(makeRow("Cantidad", qty, saleLine0?.quantity ?? null));

  // 3 · Subtotal bruto
  rows.push(makeRow(
    "Subtotal bruto (lista × cant.)",
    scale(simBase),
    dt?.subtotalBeforeDiscounts ?? null,
  ));

  // 4 · Descuento de cliente — derivado SIMÉTRICO en ambos endpoints:
  //     (basePrice − unitPrice − promo − qtyDisc) × qty
  //
  // Tanto simulador como factura devuelven `basePrice` y `unitPrice` SIN
  // absorber el redondeo de la lista en su diferencia (en factura, el
  // redondeo se absorbe en `lineTotal`, no en `unitPrice`). Por eso la
  // fórmula es la misma de ambos lados y NO hay que tocar el redondeo acá.
  //
  // El redondeo se muestra exclusivamente en la fila "Redondeo (lista de
  // precios)" más abajo (paso 12), usando el delta SIGNADO original.
  // `saleRoundingAbsorbed` queda definido por si se necesita en otra fila
  // futura, pero NO se usa para derivar descuentos.
  const saleRoundingAbsorbed = dt?.roundingInfo
    ? Math.max(0, -(dt.roundingAdjustment ?? 0))
    : 0;
  void saleRoundingAbsorbed;

  const simCustomerDiscPerUnit = (simBase != null && simUnit != null)
    ? (simBase - simUnit) - (simQtyDiscUnit ?? 0) - (simPromoDiscUnit ?? 0)
    : null;
  const simCustomerDisc = simCustomerDiscPerUnit != null
    ? round2(simCustomerDiscPerUnit * qty)
    : null;
  const saleCustomerDiscPerUnit = (saleBase != null && saleUnit != null)
    ? (saleBase - saleUnit) - (saleQtyDiscUnit ?? 0) - (salePromoDiscUnit ?? 0)
    : null;
  const saleCustomerDisc = saleCustomerDiscPerUnit != null
    ? round2(saleCustomerDiscPerUnit * qty)
    : null;
  rows.push(makeRow("Descuento de cliente (derivado)", simCustomerDisc, saleCustomerDisc));

  // 5 · Canal de venta — sim per-unit × qty vs sales doc-level
  rows.push(makeRow(
    "Canal de venta (per-doc)",
    simChannelDoc,
    dt?.channelAdjustmentAmount ?? null,
  ));

  // 6 · Promoción (ambos per-unit × qty)
  rows.push(makeRow(
    "Promoción",
    simPromoDiscUnit != null ? round2(simPromoDiscUnit * qty) : null,
    salePromoDiscUnit != null ? round2(salePromoDiscUnit * qty) : null,
    sim?.appliedPromotionName ?? saleLine0?.appliedPromotionName ?? undefined,
  ));

  // 7 · Descuento por cantidad
  rows.push(makeRow(
    "Descuento por cantidad",
    simQtyDiscUnit != null ? round2(simQtyDiscUnit * qty) : null,
    saleQtyDiscUnit != null ? round2(saleQtyDiscUnit * qty) : null,
  ));

  // 8 · Cupón — sim per-unit × qty vs sales doc-level
  rows.push(makeRow(
    "Cupón (per-doc)",
    simCouponDoc,
    dt?.couponDiscountAmount ?? null,
    sim?.couponResult?.couponCode ?? sale?.couponResult?.couponCode ?? undefined,
  ));

  // 9 · Subtotal neto antes de impuestos
  // sales.documentTotals.taxableBase = subtotalAfterLineDiscounts + channel − coupon
  // sim equivalente: (unitPrice × qty) + (channel × qty) − (coupon × qty)
  //
  // Ajuste por `applyOn` del redondeo de lista de precios. El motor expone
  // 3 modos:
  //   · PRICE  → redondea el precio de lista (antes de descuentos). Ambos
  //              endpoints lo absorben en `basePrice`/`unitPrice`, por lo que
  //              `taxableBase` queda alineado sin ajuste extra.
  //   · NET    → redondea el neto (post-descuentos). Factura lo absorbe en
  //              `lineTotal` → `taxableBase` lo refleja. Sim devuelve `unitPrice`
  //              SIN redondear, por lo que hay que sumar el delta para alinear.
  //   · TOTAL  → redondea el total con impuestos. La mecánica del motor lo
  //              descuenta del `lineTotal` (para que `lineTotal + tax = total
  //              redondeado`) y eso arrastra el `taxableBase`. Mismo ajuste
  //              que NET en simulador.
  const applyOn = (sim?.appliedRounding?.applyOn ?? dt?.roundingInfo?.applyOn ?? "") as "PRICE" | "NET" | "TOTAL" | "";
  const roundingDelta = sim?.appliedRounding?.unitAdjustment != null
    ? round2((sim.appliedRounding.unitAdjustment ?? 0) * qty)
    : (dt?.roundingAdjustment ?? 0);
  const taxableBaseRoundingAdj = (applyOn === "NET" || applyOn === "TOTAL")
    ? roundingDelta
    : 0;
  const simTaxableBase = simUnit != null
    ? round2((simUnit * qty) + (simChannelDoc ?? 0) - (simCouponDoc ?? 0) + taxableBaseRoundingAdj)
    : null;
  rows.push(makeRow(
    "Subtotal neto antes de impuestos",
    simTaxableBase,
    dt?.taxableBase ?? null,
  ));

  // 10 · Impuestos total — ambos per-doc
  rows.push(makeRow(
    "Impuestos (total)",
    simTaxUnit != null ? round2(simTaxUnit * qty) : null,
    dt?.taxAmount ?? null,
  ));

  // 11 · Impuestos por nombre / %
  for (const key of Array.from(taxKeys).sort()) {
    const a = aggSimTaxes.get(key)  ?? null;
    const b = aggSaleTaxes.get(key) ?? null;
    const label = a?.label ?? b?.label ?? "Impuesto";
    rows.push(makeRow(
      `   · ${label}`,
      a?.amount ?? null,
      b?.amount ?? null,
    ));
  }

  // 12 · Redondeo — ambos endpoints exponen el delta del redondeo aplicado
  // por la lista de precios. Sim: `appliedRounding.unitAdjustment × qty`.
  // Sales: `documentTotals.roundingAdjustment` (ya agregado).
  // Si la lista no tiene redondeo activo, ambos son null y la fila queda
  // como "No comparable", lo cual es correcto.
  const simRoundingDoc = sim?.appliedRounding?.unitAdjustment != null
    ? round2((sim.appliedRounding.unitAdjustment ?? 0) * qty)
    : null;
  const saleRoundingDoc = dt?.roundingInfo
    ? (dt.roundingAdjustment ?? 0)
    : null;
  // Si ninguno tiene rounding activo, mostramos N/A explícito.
  const noRoundingActive = sim?.appliedRounding == null && !dt?.roundingInfo;
  if (noRoundingActive) {
    rows.push({
      concept:  "Redondeo",
      sim:      null,
      sale:     null,
      diff:     null,
      status:   "n/a",
      sublabel: "La lista de precios seleccionada no tiene redondeo activo",
    });
  } else {
    const applyOnLabel = sim?.appliedRounding?.applyOn ?? dt?.roundingInfo?.applyOn ?? "";
    rows.push(makeRow(
      "Redondeo (lista de precios)",
      simRoundingDoc,
      saleRoundingDoc,
      applyOnLabel ? `applyOn=${applyOnLabel}` : undefined,
    ));
  }

  // 13 · Total línea
  rows.push(makeRow(
    "Total línea (con impuestos)",
    simTotalUnit != null ? round2(simTotalUnit * qty) : null,
    saleLine0?.lineTotalWithTax ?? null,
  ));

  // 14 · Total documento — sim aproxima como (totalUnit × qty) + canal_doc − cupón_doc
  // (canal y cupón ya escalados a per-doc; canal y cupón se aplican sobre la
  // base sin impuestos, así que sumarlos al totalWithTax × qty es equivalente
  // mientras la tasa de impuestos sea homogénea entre el motor y la factura).
  const simDocTotal = simTotalUnit != null
    ? round2((simTotalUnit * qty) + (simChannelDoc ?? 0) - (simCouponDoc ?? 0))
    : null;
  rows.push(makeRow("Total documento", simDocTotal, dt?.total ?? null));

  return rows;
}

function makeRow(
  concept: string,
  sim:     number | null,
  sale:    number | null,
  sublabel?: string,
): CompareRow {
  const { status, diff } = classifyDiff(sim, sale);
  return { concept, sim, sale, diff, status, sublabel };
}

/**
 * Clave normalizada por (nombre, tasa) para que el `Map` agregue el mismo
 * impuesto desde ambos endpoints. Sin esto, "IVA" rate=21 vs rate=21.0 caen
 * en buckets distintos y la fila aparece como "no comparable" aunque el
 * impuesto sea el mismo.
 */
function taxKey(name: string | null | undefined, rate: number | null | undefined): string {
  const n = (name ?? "").trim().toLowerCase();
  // Clave de Map, NO display: locale-independiente (siempre ".").
  const r = rate != null && Number.isFinite(rate) ? Number(rate).toFixed(4) : ""; // number-format:ignore
  return `${n}|${r}`;
}

function aggregateSimTaxes(
  sim: PricingPreviewResult | null,
  qty: number,
): Map<string, { label: string; amount: number }> {
  const out = new Map<string, { label: string; amount: number }>();
  for (const tb of sim?.taxBreakdown ?? []) {
    const name = (tb?.name ?? "Impuesto") as string;
    const rate = (tb?.rate ?? null) as number | null;
    const key  = taxKey(name, rate);
    const lbl  = rate != null ? `${name} ${rate}%` : name;
    const cur  = out.get(key);
    const inc  = round2(Number(tb?.taxAmount ?? 0) * qty);
    if (cur) cur.amount = round2(cur.amount + inc);
    else out.set(key, { label: lbl, amount: inc });
  }
  return out;
}

function aggregateSaleTaxes(
  sale: SalePreviewResult | null,
): Map<string, { label: string; amount: number }> {
  const out = new Map<string, { label: string; amount: number }>();
  for (const line of sale?.lines ?? []) {
    for (const tb of (line.taxBreakdown ?? [])) {
      const name = (tb?.name ?? "Impuesto") as string;
      const rate = (tb?.rate ?? null) as number | null;
      const key  = taxKey(name, rate);
      const lbl  = rate != null ? `${name} ${rate}%` : name;
      const cur  = out.get(key);
      const inc  = Number(tb?.taxAmount ?? 0);
      if (cur) cur.amount = round2(cur.amount + inc);
      else out.set(key, { label: lbl, amount: round2(inc) });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

export default function PricingCompare() {
  if (!DEV_ONLY) {
    return <Navigate to="/dashboard" replace />;
  }

  // Inputs
  const [article, setArticle]         = useState<ArticleRow | null>(null);
  const [variants, setVariants]       = useState<ArticleVariant[]>([]);
  const [variantId, setVariantId]     = useState<string | null>(null);
  const [client, setClient]           = useState<EntityRow | null>(null);
  const [priceLists, setPriceLists]   = useState<PriceListRow[]>([]);
  const [priceListId, setPriceListId] = useState<string>("");
  const [channels, setChannels]       = useState<SalesChannelRow[]>([]);
  const [channelId, setChannelId]     = useState<string>("");
  const [couponCode, setCouponCode]   = useState<string>("");
  const [quantity, setQuantity]       = useState<number | null>(1);

  // Forma de pago + cuotas (mismo modelo que el Simulador).
  const [paymentMethods, setPaymentMethods]   = useState<PaymentMethodRow[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [installmentsQty, setInstallmentsQty] = useState<number>(0);

  // Envío — cargamos carriers reales y derivamos `shippingMode/Value/Weight`
  // (protocolo del motor) en un useMemo, igual que el Simulador.
  const [shippingCarriers, setShippingCarriers]   = useState<ShippingCarrierRow[]>([]);
  const [shippingCarrierId, setShippingCarrierId] = useState<string>("");
  const [shippingRateId, setShippingRateId]       = useState<string>("");

  // Moneda — Fase 2A.4. La UI permite elegir la moneda y muestra el símbolo,
  // pero los endpoints actuales NO aceptan currencyId/currencyRate en el
  // preview: el motor opera en la moneda base del tenant. La selección viaja
  // en el `unifiedPayload` para que en Fase 4 (cuando el backend acepte
  // multi-moneda) ambos endpoints reciban exactamente lo mismo.
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [currencyId, setCurrencyId] = useState<string>("");
  const [currencyRate, setCurrencyRate] = useState<number | null>(null);
  // BUG 1 — state explícito de loading/error. Antes el placeholder leía
  // `currencies.length === 0` para decidir el label, lo que dejaba "Cargando…"
  // pegado cuando el endpoint devolvía array vacío o cuando el catch comía
  // el error en silencio.
  const [currenciesLoading, setCurrenciesLoading] = useState<boolean>(true);
  const [currenciesError,   setCurrenciesError]   = useState<boolean>(false);

  // ── Modo de saldo (display) ─────────────────────────────────────────────
  // "client" → resuelve dinámicamente al balanceType real del cliente.
  // "unified" / "breakdown" → fuerza la vista a ese modo.
  // NO afecta al pricing — sólo cambia cómo se renderiza el bloque "Saldo
  // del cliente". Sin recálculos en frontend.
  type BalanceModeUI = "client" | "unified" | "breakdown";
  const [balanceModeUI, setBalanceModeUI] = useState<BalanceModeUI>("client");

  // ── Vista del bloque Composición Metal/Hechura ──────────────────────────
  // Toggle compartido entre las dos columnas (Simulador / Factura) para que
  // siempre comparen el mismo aspecto (compra o venta).
  type CompositionView = "sale" | "cost";
  const [compositionView, setCompositionView] = useState<CompositionView>("sale");

  // ── Defaults del cliente (hidratación automática) ────────────────────────
  // Cuando se elige un cliente, los campos comerciales del Comparador se
  // pre-cargan con los del cliente. El operador puede overridearlos: cuando
  // el valor actual difiere del default original, mostramos badge "override".
  // Si se cambia de cliente, los defaults se reemplazan (el flag override
  // se recalcula contra el cliente nuevo).
  type ClientDefaults = {
    priceListId: string | null;
    currencyId:  string | null;
  };
  const [clientDefaults, setClientDefaults] = useState<ClientDefaults | null>(null);

  // Saldo del cliente — Fase 2A.6. Llamada paralela a /account-statement.
  // El endpoint devuelve balanceType + closingBalance (metal/hechura). NO se
  // recalcula nada en frontend.
  const [accountStatement, setAccountStatement] = useState<AccountStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  // Resultados crudos (raw — útiles para el panel "Respuesta cruda")
  const [simRes, setSimRes]   = useState<PricingPreviewResult | null>(null);
  const [saleRes, setSaleRes] = useState<SalePreviewResult    | null>(null);
  // Fase 2A — resultados normalizados que alimentan la tabla de comparación.
  const [simNorm,  setSimNorm]  = useState<NormalizedPricingResult | null>(null);
  const [saleNorm, setSaleNorm] = useState<NormalizedPricingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Bug C — snapshot del payload usado en la última corrida. Sirve para
  // invalidar visualmente la tabla cuando el usuario toca cualquier input
  // posterior sin volver a apretar "Comparar". Evita la confusión de "cambié
  // canal y veo los importes con el canal viejo".
  const [lastRunPayloadKey, setLastRunPayloadKey] = useState<string | null>(null);

  // Cargar listas y canales
  useEffect(() => {
    let cancelled = false;
    Promise.all([priceListsApi.list(), salesChannelsApi.list()])
      .then(([pls, chs]) => {
        if (cancelled) return;
        setPriceLists(pls);
        setChannels(chs);
      })
      .catch(() => { /* dev-only — silencio */ });
    return () => { cancelled = true; };
  }, []);

  // Cargar formas de pago activas
  useEffect(() => {
    let cancelled = false;
    paymentsApi.list()
      .then((rows) => { if (!cancelled) setPaymentMethods((rows ?? []).filter(p => p.isActive && !p.deletedAt)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Cargar carriers de envío activos
  useEffect(() => {
    let cancelled = false;
    shippingApi.list()
      .then((rows) => { if (!cancelled) setShippingCarriers((rows ?? []).filter(c => c.isActive && !c.deletedAt)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Cargar monedas activas. El endpoint devuelve `{ ok, rows }` — hay que
  // hacer unwrap. Antes asumía que era `CurrencyRow[]` directo; el TypeError
  // sincrónico (`rows.filter is not a function`) caía en un catch vacío y
  // dejaba el combo en error sin diagnóstico.
  //
  // Logs explícitos: la pantalla es DEV-only así que no contaminan producción.
  useEffect(() => {
    let cancelled = false;

    const loadCurrencies = async () => {
      setCurrenciesLoading(true);
      setCurrenciesError(false);
      try {
        // eslint-disable-next-line no-console
        console.log("[PricingCompare] Fetching /api/valuation/currencies …");
        const raw = await listCurrencies();
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.log("[PricingCompare] Currencies raw response:", raw);

        // Unwrap defensivo. El service no está tipado; el endpoint actual
        // devuelve `{ ok: true, rows: CurrencyRow[] }` pero conviene tolerar
        // también un array directo por si un día se simplifica.
        const list: CurrencyRow[] = Array.isArray(raw)
          ? (raw as CurrencyRow[])
          : Array.isArray((raw as any)?.rows)
            ? ((raw as any).rows as CurrencyRow[])
            : [];

        const active = list.filter((c) => c.isActive);
        setCurrencies(active);

        // Default: moneda base del tenant. Fallback: primera activa.
        const base = active.find((c) => c.isBase) ?? active[0] ?? null;
        if (base) setCurrencyId(base.id);
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error("[PricingCompare] Currencies fetch error:", err);
        setCurrenciesError(true);
      } finally {
        if (cancelled) return;
        setCurrenciesLoading(false);
      }
    };

    loadCurrencies();
    return () => { cancelled = true; };
  }, []);

  // Cuando cambia la moneda, sincronizar el rate con el último conocido.
  useEffect(() => {
    if (!currencyId) { setCurrencyRate(null); return; }
    const c = currencies.find(x => x.id === currencyId);
    setCurrencyRate(c?.latestRate ?? null);
  }, [currencyId, currencies]);

  // Cargar saldo del cliente cuando hay client.id. Fase 2A.6.
  // Sin from/to → el endpoint devuelve período por defecto (closingBalance
  // = saldo actual).
  useEffect(() => {
    if (!client?.id) { setAccountStatement(null); return; }
    let cancelled = false;
    setStatementLoading(true);
    commercialEntitiesApi.getAccountStatement(client.id, {})
      .then((s) => { if (!cancelled) setAccountStatement(s); })
      .catch(() => { if (!cancelled) setAccountStatement(null); })
      .finally(() => { if (!cancelled) setStatementLoading(false); });
    return () => { cancelled = true; };
  }, [client?.id]);

  // ── Hidratación de defaults del cliente ──────────────────────────────────
  // El selector de cliente devuelve `EntityRow` completo (priceListId,
  // currencyId, sellerId, paymentTerm, balanceType, reglas comerciales,
  // taxExempt, etc.). NO hace falta fetch del detalle.
  // Auto-aplica priceListId y currencyId si el cliente los tiene; si no,
  // deja los selects en su valor actual (el operador puede haber elegido).
  useEffect(() => {
    if (!client) {
      setClientDefaults(null);
      return;
    }
    const defaults: ClientDefaults = {
      priceListId: client.priceListId ?? null,
      currencyId:  client.currencyId  ?? null,
    };
    setClientDefaults(defaults);
    // Auto-apply — solo si el cliente tiene un valor concreto; nunca pisamos
    // con null (el operador podría haber elegido algo manualmente antes de
    // cambiar de cliente).
    if (defaults.priceListId) setPriceListId(defaults.priceListId);
    if (defaults.currencyId)  setCurrencyId(defaults.currencyId);
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fase MM — símbolo dinámico tomado del response del backend.
  // Si el backend convirtió, usa responseCurrencySymbol; si no, base.
  // Antes el símbolo era SIEMPRE el de la base; ahora respeta la conversión
  // efectiva que hizo el backend (por si la tasa no estaba o el target era
  // inválido y el backend cayó a base sin error).
  const selectedCurrency = useMemo(
    () => currencies.find(c => c.id === currencyId) ?? null,
    [currencies, currencyId],
  );
  void selectedCurrency;
  const baseCurrency = useMemo(() => currencies.find(c => c.isBase) ?? null, [currencies]);
  // Prioridad: lo que el backend reportó (si vino metadata) > base local.
  const displaySym =
    (saleRes as any)?.responseCurrencySymbol
    ?? (simRes as any)?.responseCurrencySymbol
    ?? baseCurrency?.symbol
    ?? "";

  // ── Override manual respecto del cliente ────────────────────────────────
  // Derivado: si hay defaults del cliente y el valor actual difiere → override.
  // No hace falta state extra; se computa en cada render.
  const priceListOverridesClient =
    !!client
    && !!clientDefaults
    && (priceListId || null) !== (clientDefaults.priceListId ?? null);
  const currencyOverridesClient =
    !!client
    && !!clientDefaults
    && (currencyId || null) !== (clientDefaults.currencyId ?? null);

  // ── Modo de saldo efectivo ──────────────────────────────────────────────
  // Resolución cuando el operador eligió "client": leer el balanceType real,
  // priorizando lo que sales/preview ya devuelve (Fase 2A.7) y cayendo a
  // accountStatement si no hay sales norm aún. Si el cliente no tiene
  // balanceType configurado, el fallback final es "UNIFIED" (default sano).
  const clientBalanceTypeRaw =
    (saleNorm?.clientBalanceType as string | null | undefined)
    ?? accountStatement?.entity?.balanceType
    ?? null;
  const effectiveBalanceMode: "UNIFIED" | "BREAKDOWN" =
    balanceModeUI === "unified"   ? "UNIFIED"
    : balanceModeUI === "breakdown" ? "BREAKDOWN"
    : (clientBalanceTypeRaw === "BREAKDOWN" ? "BREAKDOWN" : "UNIFIED");

  // Reset tarifa cuando cambia carrier (evita arrastrar id de otro carrier).
  useEffect(() => { setShippingRateId(""); }, [shippingCarrierId]);

  // Reset cuotas cuando cambia el método de pago.
  useEffect(() => { setInstallmentsQty(0); }, [paymentMethodId]);

  // Cargar variantes cuando cambia el artículo
  useEffect(() => {
    let cancelled = false;
    if (!article?.id) {
      setVariants([]);
      setVariantId(null);
      return;
    }
    articlesApi.getOne(article.id)
      .then((det) => {
        if (cancelled) return;
        const vs = (det as any).variants ?? [];
        setVariants(vs);
        setVariantId(vs[0]?.id ?? null);
      })
      .catch(() => { setVariants([]); setVariantId(null); });
    return () => { cancelled = true; };
  }, [article?.id]);

  // Traducción carrier → protocolo del motor (shippingMode/Value/Weight).
  // Misma lógica que `PricingSimulator` (mantener convergencia con el Simulador).
  // - PICKUP → FREE
  // - DELIVERY FIXED → mode=FIXED, value=fixedPrice
  // - DELIVERY BY_WEIGHT → mode=BY_WEIGHT, value=pricePerKg, weight=peso/1000 (kg) o 1
  // - BY_ZONE → no aplicable acá → FREE
  const shippingDerived = useMemo<{
    mode:   "" | "FIXED" | "BY_WEIGHT" | "FREE";
    value:  number | null;
    weight: number | null;
    /** Monto resuelto del envío para enviarlo a `salesApi.preview`
     *  (que solo acepta `shippingAmount` numérico). */
    amount: number | null;
  }>(() => {
    if (!shippingCarrierId) return { mode: "", value: null, weight: null, amount: null };
    const c = shippingCarriers.find(x => x.id === shippingCarrierId);
    if (!c) return { mode: "", value: null, weight: null, amount: null };
    if (c.type === "PICKUP") {
      return { mode: "FREE", value: null, weight: null, amount: 0 };
    }
    const activeRates = c.rates.filter(r => r.isActive);
    const rate = (shippingRateId
      ? (activeRates.find(r => (r.id ?? "") === shippingRateId)
        ?? activeRates[parseInt(shippingRateId, 10)]
        ?? null)
      : null) ?? activeRates[0] ?? null;
    if (!rate) return { mode: "FREE", value: null, weight: null, amount: 0 };
    if (rate.calculationMode === "FIXED") {
      const price = rate.fixedPrice != null ? parseFloat(rate.fixedPrice) : 0;
      return { mode: "FIXED", value: price, weight: null, amount: price };
    }
    if (rate.calculationMode === "BY_WEIGHT") {
      const ppk   = rate.pricePerKg != null ? parseFloat(rate.pricePerKg) : 0;
      const grams = (article as any)?.weight != null ? parseFloat(String((article as any).weight)) : 1000;
      const kg    = grams / 1000;
      return { mode: "BY_WEIGHT", value: ppk, weight: kg, amount: round2(ppk * kg) };
    }
    return { mode: "FREE", value: null, weight: null, amount: 0 };
  }, [shippingCarrierId, shippingRateId, shippingCarriers, article]);

  // Plan de cuotas seleccionado (si la forma de pago tiene planes).
  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find(p => p.id === paymentMethodId) ?? null,
    [paymentMethods, paymentMethodId],
  );
  const installmentPlans = useMemo(
    () => (selectedPaymentMethod?.installmentPlans ?? []).filter(p => p.isActive),
    [selectedPaymentMethod],
  );

  // Fase 2A — payload UNIFICADO. Se construye una sola vez; cada endpoint
  // recibe sus args vía adapter (`toArticlePricingPreviewArgs`,
  // `toSalesPreviewArgs`). Ambas pantallas (Simulador y Factura) deberían
  // compartir esta misma forma.
  const unifiedPayload: PricingPreviewPayload | null = useMemo(() => {
    if (!article?.id) return null;
    return {
      lines: [{
        articleId: article.id,
        variantId: variantId ?? null,
        quantity:  quantity ?? 1,
      }],
      clientId:        client?.id ?? null,
      priceListId:     priceListId || null,
      channelId:       channelId   || null,
      couponCode:      couponCode  || null,
      paymentMethodId: paymentMethodId || null,
      installmentsQty: installmentsQty || null,
      shipping: shippingDerived.mode
        ? {
            mode:   shippingDerived.mode,
            value:  shippingDerived.value,
            weight: shippingDerived.weight,
          }
        : null,
      // TODO Fase 4: los endpoints actuales NO leen estos campos. Cuando el
      // backend acepte multimoneda, los adapters los pasan automáticamente
      // (ya están en el contrato). Hoy viajan en el payload solo a efectos
      // de trazabilidad en el panel "Debug".
      currencyId:   currencyId   || null,
      currencyRate: currencyRate ?? null,
    };
  }, [article?.id, variantId, client?.id, priceListId, channelId, couponCode, quantity, paymentMethodId, installmentsQty, shippingDerived, currencyId, currencyRate]);

  // Payloads adaptados por endpoint — sólo para el panel "Debug — payload
  // enviado". Las llamadas reales construyen los args dentro de
  // `handleCompare` para garantizar que parten del mismo `unifiedPayload`.
  const simPayload = useMemo(
    () => unifiedPayload ? toArticlePricingPreviewArgs(unifiedPayload) : null,
    [unifiedPayload],
  );
  const salePayload: SalePreviewInput | null = useMemo(
    () => unifiedPayload ? toSalesPreviewArgs(unifiedPayload) as SalePreviewInput : null,
    [unifiedPayload],
  );

  const canCompare = !!article?.id && (quantity ?? 0) > 0 && !!unifiedPayload;

  async function handleCompare() {
    if (!canCompare || !article || !unifiedPayload || !simPayload || !salePayload) return;
    setLoading(true);
    setError(null);
    setSimRes(null);
    setSaleRes(null);
    setSimNorm(null);
    setSaleNorm(null);
    try {
      // Fase 2A — un solo payload, dos adapters, dos normalizadores.
      const [simRaw, saleRaw] = await Promise.all([
        articlesApi.getPricingPreview(simPayload.articleId, simPayload.opts as any),
        salesApi.preview(salePayload),
      ]);
      setSimRes(simRaw);
      setSaleRes(saleRaw);
      setSimNorm(normalizeArticlePricingPreview({
        result:    simRaw,
        articleId: article.id,
        variantId,
        quantity:  quantity ?? 1,
      }));
      setSaleNorm(normalizeSalesPreview(saleRaw));
      // Bug C — recordamos el payload con el que corrimos. Si el usuario
      // toca cualquier input después, la tabla se invalida hasta que vuelva
      // a apretar Comparar.
      setLastRunPayloadKey(JSON.stringify(unifiedPayload));
    } catch (e: any) {
      setError(e?.message || "Error al comparar.");
    } finally {
      setLoading(false);
    }
  }

  // Bug C — flag visual: el payload cambió respecto al de la última corrida.
  // No invalidamos datos (sería molesto perder la comparación previa); en su
  // lugar mostramos un banner y bajamos la opacidad de la tabla para indicar
  // que está stale hasta que el operador vuelva a apretar Comparar.
  const currentPayloadKey = useMemo(
    () => unifiedPayload ? JSON.stringify(unifiedPayload) : null,
    [unifiedPayload],
  );
  const inputsStale = lastRunPayloadKey != null
    && currentPayloadKey != null
    && lastRunPayloadKey !== currentPayloadKey;

  // Fase 2A — la tabla compara los dos resultados normalizados. Ya no escala
  // unit → doc localmente: ese trabajo lo hace el normalizador del Simulador.
  // Los `*Raw` se pasan sólo para alimentar las filas Metal/Hechura, que aún
  // no viven en el contrato unificado (Fase 2A.6).
  const rows = useMemo(() => buildRowsNormalized({
    sim:     simNorm,
    sale:    saleNorm,
    simRaw:  simRes,
    saleRaw: saleRes,
  }), [simNorm, saleNorm, simRes, saleRes]);

  const summary = useMemo(() => {
    let critical = 0, minor = 0, rounding = 0, expected = 0, ok = 0, na = 0;
    for (const r of rows) {
      if      (r.status === "critical") critical++;
      else if (r.status === "minor")    minor++;
      else if (r.status === "rounding") rounding++;
      else if (r.status === "expected") expected++;
      else if (r.status === "ok")       ok++;
      else                              na++;
    }
    return { critical, minor, rounding, expected, ok, na, total: rows.length };
  }, [rows]);

  // Banner global: redondeo NO eleva al estado. Solo se ve "amarillo" cuando
  // hay diferencias reales (>0,10) y rojo cuando hay diferencias críticas.
  const summaryLabel: { tone: string; icon: string; text: string } = !simRes && !saleRes
    ? { tone: "border-border bg-card text-muted",
        icon: "·",
        text: "Cargá un artículo y presioná Comparar." }
    : summary.critical > 0
      ? { tone: "border-red-500/40 bg-red-500/10 text-red-500",
          icon: "🔴",
          text: `Hay diferencias críticas (${summary.critical}).` }
      : summary.minor > 0
        ? { tone: "border-amber-500/40 bg-amber-500/10 text-amber-500",
            icon: "🟡",
            text: `Hay diferencias menores a revisar (${summary.minor}).` }
        : { tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
            icon: "🟢",
            text: summary.rounding > 0
              ? `Coincidencia total (${summary.rounding} fila${summary.rounding === 1 ? "" : "s"} con diferencia de redondeo, sin impacto).`
              : "Coincidencia total — todos los importes coinciden." };

  // Toggles para los collapses
  const [debugOpen, setDebugOpen] = useState(false);
  const [rawOpen,   setRawOpen]   = useState(false);
  const [debugInputsOpen, setDebugInputsOpen] = useState(false);

  function copyReport() {
    const lines: string[] = [];
    lines.push("=== Pricing Compare — Reporte ===");
    lines.push("");
    lines.push("Inputs:");
    // Fase 2A — los inputs vienen del unifiedPayload, no del shape adaptado.
    const inLine = unifiedPayload?.lines?.[0] ?? null;
    lines.push(`  · articleId:   ${inLine?.articleId ?? "—"}`);
    lines.push(`  · variantId:   ${inLine?.variantId ?? "—"}`);
    lines.push(`  · clientId:    ${unifiedPayload?.clientId    ?? "—"}`);
    lines.push(`  · priceListId: ${unifiedPayload?.priceListId ?? "—"}`);
    lines.push(`  · channelId:   ${unifiedPayload?.channelId   ?? "—"}`);
    lines.push(`  · couponCode:  ${unifiedPayload?.couponCode  ?? "—"}`);
    lines.push(`  · quantity:    ${inLine?.quantity ?? "—"}`);
    lines.push("");
    lines.push("Resumen:");
    lines.push(`  · Coincide: ${summary.ok}  ·  Redondeo: ${summary.rounding}  ·  Esperado: ${summary.expected}  ·  Revisar: ${summary.minor}  ·  Crítico: ${summary.critical}  ·  N/A: ${summary.na}`);
    lines.push("");
    lines.push("Tabla de comparación:");
    lines.push("  Concepto | Simulador | Factura | Diferencia | Estado");
    for (const r of rows) {
      lines.push(`  ${r.concept} | ${r.sim ?? "—"} | ${r.sale ?? "—"} | ${r.diff ?? "—"} | ${STATUS_LABEL[r.status]}`);
    }
    lines.push("");
    lines.push("documentTotals (sales):");
    lines.push(JSON.stringify(saleRes?.documentTotals ?? null, null, 2));
    lines.push("");
    lines.push("Pricing preview (articles):");
    lines.push(JSON.stringify({
      basePrice:    simRes?.basePrice,
      unitPrice:    simRes?.unitPrice,
      taxAmount:    simRes?.taxAmount,
      totalWithTax: simRes?.totalWithTax,
      taxBreakdown: simRes?.taxBreakdown,
      channelResult:simRes?.channelResult,
      couponResult: simRes?.couponResult,
    }, null, 2));
    navigator.clipboard?.writeText(lines.join("\n"));
  }

  return (
    <TPSectionShell
      title="Pricing Compare"
      subtitle="QA — compara articlesApi.getPricingPreview vs salesApi.preview"
      icon={<Beaker size={18} />}
    >
      <div className="space-y-3">
        {/* Banner dev-only */}
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-500">
          Pantalla solo de desarrollo. No aparece en sidebar y se bloquea en producción.
        </div>

        {/* Banner gap multimoneda — articles backend no convierte
            `documentTotals`. Cuando se detecta `currencyConverted=true` con
            rate≠1 en el response del simulador, las filas que leen
            `documentTotals` quedan en "n/a" para no comparar monedas
            distintas. Las filas per-line (`lines[].*`) siguen comparándose
            normalmente porque ambos endpoints sí las convierten. */}
        {(() => {
          const r: any = simRes;
          if (!r) return null;
          const rate = Number(r.currencyRate ?? 1);
          if (r.currencyConverted !== true || !Number.isFinite(rate) || rate === 1) return null;
          return (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-500">
              Filas que leen <code className="font-mono">documentTotals</code> del simulador están deshabilitadas
              (gap del backend articles: omite convertir el bloque <code className="font-mono">documentTotals</code>).
              Las filas per-line (precio unitario, total línea, taxBreakdown, descuentos por línea, márgenes %)
              siguen comparándose porque ambos endpoints sí las convierten.
            </div>
          );
        })()}

        {/* Banner multimoneda — Fase MM. Reporta el estado REAL devuelto por
            el backend (no se asume; se lee de responseCurrencyCode +
            currencyConverted). Cubre los 3 casos:
              · base seleccionada → no banner.
              · target con conversión aplicada → banner verde con tasa.
              · target sin conversión (sin tasa registrada o moneda inválida)
                → banner rojo "fallback a base". */}
        {(() => {
          const refRes: any = saleRes ?? simRes;
          if (!refRes) return null;
          const converted = refRes.currencyConverted === true;
          const respCode  = refRes.responseCurrencyCode;
          const baseCode  = refRes.baseCurrencyCode;
          const rate      = refRes.currencyRate;
          // Sin metadata (endpoint legacy) → no banner.
          if (!respCode || !baseCode) return null;
          if (converted && respCode !== baseCode) {
            return (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-500">
                Conversión aplicada por backend a <strong>{respCode}</strong>.
                Tasa: <strong>1 {respCode} = {formatDecimalUpTo(Number(rate), 4)} {baseCode}</strong>.
                Todos los importes mostrados están en {respCode}.
              </div>
            );
          }
          // Operador eligió target distinto a base, pero el backend NO
          // pudo convertir (sin tasa, moneda inactiva, etc.) y cayó a base.
          if (selectedCurrency && !selectedCurrency.isBase && !converted) {
            return (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-500">
                Pediste ver en <strong>{selectedCurrency.code}</strong> pero el
                backend cayó a moneda base ({baseCode}). Probable causa: la
                moneda no tiene tasa registrada o no está activa. Los importes
                visibles están en {baseCode}.
              </div>
            );
          }
          return null;
        })()}

        {/* Inputs */}
        <TPCard title="Inputs">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <TPField label="Artículo">
              <ArticleSearchSelect
                selected={article}
                onSelect={(row) => { setArticle(row); }}
                onClear={() => { setArticle(null); }}
              />
            </TPField>

            {variants.length > 0 && (
              <TPField label="Variante">
                <TPComboFixed
                  value={variantId ?? ""}
                  onChange={(v) => setVariantId(v || null)}
                  options={[
                    { value: "", label: "Sin variante" },
                    ...variants.map((v) => ({
                      value: v.id,
                      label: `${v.name || v.code}${v.sku ? ` · ${v.sku}` : ""}`,
                    })),
                  ]}
                />
              </TPField>
            )}

            <TPField label="Cliente">
              <EntitySearchSelect
                role="client"
                selected={client}
                onSelect={setClient}
                onClear={() => setClient(null)}
              />
            </TPField>

            <TPField label="Lista de precios">
              <TPSelect
                value={priceListId}
                onChange={(v) => setPriceListId(v)}
                options={[
                  { value: "", label: "Por defecto / favorita" },
                  ...priceLists.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              {/* Fase 2A.6 — badge "override" cuando lo elegido difiere de
                  lo aplicado por el motor. La "lista del cliente" no se
                  expone en el preview (Fase 2A.7 backend), así que sólo se
                  compara contra lo aplicado. */}
              {(simNorm?.lines?.[0]?.appliedPriceListName || saleNorm?.lines?.[0]?.appliedPriceListName) && (() => {
                const appliedId   = simNorm?.lines?.[0]?.appliedPriceListId   ?? saleNorm?.lines?.[0]?.appliedPriceListId   ?? null;
                const appliedName = simNorm?.lines?.[0]?.appliedPriceListName ?? saleNorm?.lines?.[0]?.appliedPriceListName ?? "—";
                const isOverride  = !!priceListId && appliedId != null && priceListId === appliedId;
                const motorIgnoredOverride = !!priceListId && appliedId != null && priceListId !== appliedId;
                return (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-muted">Aplicada por el motor:</span>
                    <span className="rounded border border-border bg-card px-1 py-px font-semibold">
                      {appliedName}
                    </span>
                    {isOverride && (
                      <span
                        className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px font-semibold uppercase tracking-wide text-amber-500"
                        title="Lista elegida manualmente, el motor la respetó."
                      >
                        Override
                      </span>
                    )}
                    {motorIgnoredOverride && (
                      <span
                        className="rounded border border-red-500/40 bg-red-500/10 px-1 py-px font-semibold uppercase tracking-wide text-red-500"
                        title="Elegiste una lista pero el motor terminó usando otra. Revisar vigencia o jerarquía."
                      >
                        Override ignorado
                      </span>
                    )}
                    {priceListOverridesClient && (
                      <span
                        className="rounded border border-sky-500/40 bg-sky-500/10 px-1 py-px font-semibold uppercase tracking-wide text-sky-400"
                        title="La lista elegida difiere de la habitual del cliente."
                      >
                        Override del cliente
                      </span>
                    )}
                  </div>
                );
              })()}
            </TPField>

            <TPField label="Canal de venta">
              <TPSelect
                value={channelId}
                onChange={(v) => setChannelId(v)}
                options={[
                  { value: "", label: "Sin canal" },
                  ...channels.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </TPField>

            <TPField label="Cupón">
              <TPInput
                value={couponCode}
                onChange={(v: string) => setCouponCode(v)}
                placeholder="Ej. TEST10"
              />
            </TPField>

            <TPField label="Cantidad">
              <TPNumberInput
                value={quantity}
                onChange={setQuantity}
                min={1}
                decimals={0}
              />
            </TPField>

            <TPField label="Modo de saldo">
              <TPSelect
                value={balanceModeUI}
                onChange={(v) => setBalanceModeUI((v as BalanceModeUI) || "client")}
                options={[
                  { value: "client",     label: "Según cliente" },
                  { value: "unified",    label: "Unificado" },
                  { value: "breakdown",  label: "Desglosado: Metal + Hechura" },
                ]}
              />
            </TPField>

            <TPField label="Moneda">
              <TPSelect
                value={currencyId}
                onChange={(v) => setCurrencyId(v)}
                disabled={currenciesLoading || currenciesError || currencies.length === 0}
                options={[
                  // Placeholder estable que cubre los 4 estados explícitos
                  // (loading / error / vacío terminal / hay items).
                  {
                    value: "",
                    label: currenciesLoading
                      ? "Cargando…"
                      : currenciesError
                        ? "No se pudieron cargar monedas"
                        : currencies.length === 0
                          ? "Sin monedas activas"
                          : "Seleccionar moneda…",
                  },
                  ...currencies.map((c) => ({
                    value: c.id,
                    label: `${c.code}${c.isBase ? " · base" : ""}${c.symbol ? ` (${c.symbol})` : ""}`,
                  })),
                ]}
              />
              {currencyOverridesClient && (
                <div className="mt-1 text-[10px]">
                  <span
                    className="rounded border border-sky-500/40 bg-sky-500/10 px-1 py-px font-semibold uppercase tracking-wide text-sky-400"
                    title="La moneda elegida difiere de la habitual del cliente."
                  >
                    Override del cliente
                  </span>
                </div>
              )}
            </TPField>

            <TPField label="Forma de pago">
              <TPSelect
                value={paymentMethodId}
                onChange={(v) => setPaymentMethodId(v)}
                options={[
                  { value: "", label: "Sin forma de pago" },
                  ...paymentMethods.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </TPField>

            {installmentPlans.length > 0 && (
              <TPField label="Cuotas">
                <TPSelect
                  value={String(installmentsQty || 0)}
                  onChange={(v) => setInstallmentsQty(parseInt(v, 10) || 0)}
                  options={[
                    { value: "0", label: "Sin cuotas" },
                    ...installmentPlans.map((p) => ({
                      value: String(p.installments),
                      label: `${p.installments} cuotas${parseFloat(p.interestRate) > 0 ? ` (+${parseFloat(p.interestRate)}%)` : ""}`,
                    })),
                  ]}
                />
              </TPField>
            )}

            <TPField label="Método de entrega">
              <TPSelect
                value={shippingCarrierId}
                onChange={(v) => setShippingCarrierId(v)}
                options={[
                  { value: "", label: "Sin envío" },
                  ...shippingCarriers.map((c) => ({
                    value: c.id,
                    label: c.type === "PICKUP" ? `${c.name} (Retiro)` : c.name,
                  })),
                ]}
              />
            </TPField>

            {(() => {
              const carrier = shippingCarriers.find((c) => c.id === shippingCarrierId);
              if (!carrier || carrier.type !== "DELIVERY") return null;
              const activeRates = carrier.rates.filter((r) => r.isActive);
              if (activeRates.length <= 1) return null;
              return (
                <TPField label="Tarifa de envío">
                  <TPSelect
                    value={shippingRateId}
                    onChange={(v) => setShippingRateId(v)}
                    options={[
                      { value: "", label: "Primera activa" },
                      ...activeRates.map((r, idx) => ({
                        value: r.id ?? String(idx),
                        label: r.name,
                      })),
                    ]}
                  />
                </TPField>
              );
            })()}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <TPButton
              variant="secondary"
              onClick={() => { setSimRes(null); setSaleRes(null); setSimNorm(null); setSaleNorm(null); setError(null); }}
              iconLeft={<RefreshCw size={14} />}
              disabled={loading}
            >
              Limpiar
            </TPButton>
            <TPButton
              variant="primary"
              onClick={handleCompare}
              disabled={!canCompare || loading}
              iconLeft={loading ? <Loader2 size={14} className="animate-spin" /> : <Beaker size={14} />}
            >
              {loading ? "Comparando…" : "Comparar"}
            </TPButton>
          </div>
        </TPCard>

        {/* Resumen global */}
        <div className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs",
          summaryLabel.tone,
        )}>
          <span aria-hidden className="text-base leading-none">{summaryLabel.icon}</span>
          <span className="font-semibold">{summaryLabel.text}</span>
          {(simRes || saleRes) && (
            <>
              <span className="ml-2 text-muted">·</span>
              <span>{summary.ok} Coincide</span>
              <span className="text-muted">·</span>
              <span>{summary.rounding} Redondeo</span>
              {summary.expected > 0 && (
                <>
                  <span className="text-muted">·</span>
                  <span className="text-violet-400">{summary.expected} Esperado</span>
                </>
              )}
              <span className="text-muted">·</span>
              <span>{summary.minor} Revisar</span>
              <span className="text-muted">·</span>
              <span>{summary.critical} Crítico</span>
              <span className="text-muted">·</span>
              <span>{summary.na} N/A</span>
              <span className="ml-auto" />
              <TPButton variant="secondary" onClick={copyReport} iconLeft={<Copy size={14} />}>
                Copiar reporte
              </TPButton>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-500">
            {error}
          </div>
        )}

        {/* Bloque debug "inputs efectivos vs respuesta del motor".
            Antes vivía expandido entre la tabla y la composición; ahora
            arranca colapsado para no romper el flujo Configuración →
            Resultado → Explicación. El operador lo abre cuando necesita
            diagnosticar.
            TODO: en una fase chica posterior, moverlo físicamente al final
            junto a "Debug — payload" y "Respuesta cruda" para agruparlos. */}
        {(simNorm || saleNorm) && (
          <TPCollapse
            open={debugInputsOpen}
            onToggle={() => setDebugInputsOpen(v => !v)}
            title="Debug — inputs efectivos vs respuesta del motor"
            description="Útil para diagnosticar diferencias entre lo elegido y lo aplicado por el motor."
          >
            {(() => {
          const fmtNum = (v: number | null | undefined) =>
            v == null ? "—" : formatDecimalUpTo(v, 4);
          const simAppliedPlId  = simNorm?.lines?.[0]?.appliedPriceListId   ?? null;
          const saleAppliedPlId = saleNorm?.lines?.[0]?.appliedPriceListId  ?? null;
          const simChannelDoc   = simNorm?.documentTotals?.channelAdjustmentAmount  ?? null;
          const saleChannelDoc  = saleNorm?.documentTotals?.channelAdjustmentAmount ?? null;
          // Fase 2.1 — los doc-level del cliente y de lista vienen ya en
          // `normalized` (sales) sin necesidad de tocar el raw.
          const priceListWasOverridden = saleNorm?.priceListWasOverridden ?? null;
          const requestedPriceListId   = saleNorm?.requestedPriceListId   ?? null;
          // Forma de pago — comparable per-doc en ambos lados (post fix).
          const simPay  = simNorm?.payment  ?? null;
          const salePay = saleNorm?.payment ?? null;
          const ok = (a: any, b: any) => (a != null && b != null && String(a) === String(b)) ? "✓" : "≠";
          // Igualdad numérica con tolerancia 0.01 (mismo umbral que la tabla).
          const okNum = (a: number | null | undefined, b: number | null | undefined) =>
            (a == null || b == null) ? "—" : (Math.abs(a - b) <= 0.01 ? "✓" : "≠");
          return (
            <TPCard title="Debug — inputs efectivos vs respuesta del motor">
              <div className="grid grid-cols-1 gap-2 text-[11px] md:grid-cols-2">
                <div className="rounded-md border border-border bg-card p-2">
                  <div className="mb-1 font-semibold uppercase tracking-wide text-muted">Inputs (state)</div>
                  <ul className="space-y-0.5 tabular-nums">
                    <li>priceListId (selected): <span className="font-mono">{priceListId || "—"}</span></li>
                    <li>currencyId / rate: <span className="font-mono">{currencyId || "—"}</span> / {fmtNum(currencyRate)}</li>
                    <li>channelId: <span className="font-mono">{channelId || "—"}</span></li>
                    <li>paymentMethodId: <span className="font-mono">{paymentMethodId || "—"}</span></li>
                    <li>installmentsQty: <span className="font-mono">{installmentsQty || 0}</span></li>
                    {/* Saldo */}
                    <li>selectedBalanceMode: <span className="font-mono">{balanceModeUI}</span> · effective: <span className="font-mono">{effectiveBalanceMode}</span></li>
                    <li>clientBalanceType (sales/account): <span className="font-mono">{clientBalanceTypeRaw ?? "—"}</span></li>
                  </ul>
                </div>
                <div className="rounded-md border border-border bg-card p-2">
                  <div className="mb-1 font-semibold uppercase tracking-wide text-muted">Respuesta del motor</div>
                  <ul className="space-y-0.5 tabular-nums">
                    <li>article appliedPriceListId: <span className="font-mono">{simAppliedPlId ?? "—"}</span></li>
                    <li>sales   appliedPriceListId: <span className="font-mono">{saleAppliedPlId ?? "—"}</span> {ok(simAppliedPlId, saleAppliedPlId)}</li>
                    {/* Modo de la lista (METAL_HECHURA / MARGIN_TOTAL) — Fase apml */}
                    {(() => {
                      const sMode = simNorm?.lines?.[0]?.appliedPriceListMode  ?? null;
                      const fMode = saleNorm?.lines?.[0]?.appliedPriceListMode ?? null;
                      return (
                        <>
                          <li>article appliedPriceListMode: <span className="font-mono">{sMode ?? "—"}</span></li>
                          <li>sales   appliedPriceListMode: <span className="font-mono">{fMode ?? "—"}</span> {ok(sMode, fMode)}</li>
                        </>
                      );
                    })()}
                    <li>article channelAdjustmentAmount (per-doc): {fmtNum(simChannelDoc)}</li>
                    <li>sales   channelAdjustmentAmount (per-doc): {fmtNum(saleChannelDoc)} {okNum(simChannelDoc, saleChannelDoc)}</li>
                    <li>requestedPriceListId (sales): <span className="font-mono">{requestedPriceListId ?? "—"}</span></li>
                    <li>priceListWasOverridden (sales): {priceListWasOverridden == null ? "—" : String(priceListWasOverridden)}</li>
                    {/* Metal/Hechura per-unit (raw del motor — los per-doc
                        están en la tabla principal). */}
                    {(() => {
                      const sm = (simRes  as any)?.metalHechuraBreakdown ?? null;
                      const ss = (saleRes as any)?.lines?.[0]?.metalHechuraBreakdown ?? null;
                      return (
                        <>
                          <li>article metalSale (per-unit): {fmtNum(sm?.metalSale ?? null)}</li>
                          <li>sales   metalSale (per-unit): {fmtNum(ss?.metalSale ?? null)} {okNum(sm?.metalSale ?? null, ss?.metalSale ?? null)}</li>
                          <li>article hechuraSale (per-unit): {fmtNum(sm?.hechuraSale ?? null)}</li>
                          <li>sales   hechuraSale (per-unit): {fmtNum(ss?.hechuraSale ?? null)} {okNum(sm?.hechuraSale ?? null, ss?.hechuraSale ?? null)}</li>
                        </>
                      );
                    })()}
                  </ul>
                </div>
              </div>

              {/* Forma de pago — desglose comparativo (Bug 2 / paymentAdjustment). */}
              {(simPay || salePay) && (
                <div className="mt-2 rounded-md border border-border bg-card p-2 text-[11px]">
                  <div className="mb-1 font-semibold uppercase tracking-wide text-muted">Forma de pago — desglose</div>
                  <table className="w-full tabular-nums">
                    <thead className="text-left text-muted">
                      <tr>
                        <th className="py-0.5 font-normal">Campo</th>
                        <th className="py-0.5 text-right font-normal">article</th>
                        <th className="py-0.5 text-right font-normal">sales</th>
                        <th className="py-0.5 text-right font-normal">match</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>installments</td>
                        <td className="text-right">{simPay?.installments ?? "—"}</td>
                        <td className="text-right">{salePay?.installments ?? "—"}</td>
                        <td className="text-right">{ok(simPay?.installments, salePay?.installments)}</td>
                      </tr>
                      <tr>
                        <td>baseAmount (per-doc)</td>
                        <td className="text-right">{fmtNum(simPay?.baseAmount  ?? null)}</td>
                        <td className="text-right">{fmtNum(salePay?.baseAmount ?? null)}</td>
                        <td className="text-right">{okNum(simPay?.baseAmount ?? null, salePay?.baseAmount ?? null)}</td>
                      </tr>
                      <tr>
                        <td>paymentAdjustment (per-doc)</td>
                        <td className="text-right">{fmtNum(simPay?.paymentAdjustment  ?? null)}</td>
                        <td className="text-right">{fmtNum(salePay?.paymentAdjustment ?? null)}</td>
                        <td className="text-right">{okNum(simPay?.paymentAdjustment ?? null, salePay?.paymentAdjustment ?? null)}</td>
                      </tr>
                      <tr>
                        <td>finalAmountAfterPayment (per-doc)</td>
                        <td className="text-right">{fmtNum(simPay?.finalAmountAfterPayment  ?? null)}</td>
                        <td className="text-right">{fmtNum(salePay?.finalAmountAfterPayment ?? null)}</td>
                        <td className="text-right">{okNum(simPay?.finalAmountAfterPayment ?? null, salePay?.finalAmountAfterPayment ?? null)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-1 text-[10px] italic text-muted/70">
                    Nota: <code>article.checkoutResult</code> se invoca con
                    <code> commercialAmount × quantity</code> en
                    <code> articles.controller</code>, así que ya viene per-doc
                    (no se escala otra vez en el normalizer).
                  </div>
                </div>
              )}
            </TPCard>
          );
        })()}
          </TPCollapse>
        )}

        {/* Bug C — banner cuando los inputs cambiaron desde la última corrida.
            La tabla queda mostrando datos viejos hasta que el operador
            aprete Comparar otra vez. */}
        {inputsStale && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-500">
            Cambiaste algún input desde la última comparación. Los importes
            mostrados corresponden al payload anterior — apretá <strong>Comparar</strong>
            {" "}para refrescar.
          </div>
        )}

        {/* Tabla comparativa */}
        {(simRes || saleRes) && (
          <TPCard title="Comparación concepto por concepto">
            <div className={cn("overflow-x-auto", inputsStale && "opacity-60")}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-2 py-1.5">Concepto</th>
                    <th className="px-2 py-1.5 text-right">Simulador</th>
                    <th className="px-2 py-1.5 text-right">Factura</th>
                    <th className="px-2 py-1.5 text-right">Diferencia</th>
                    <th className="px-2 py-1.5 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    // Tooltip por fila — incluye los tres valores crudos para
                    // que el usuario verifique al pasar el mouse sin tener que
                    // abrir Debug ni Respuesta cruda.
                    const rowTooltip = [
                      `Simulador: ${r.sim  != null ? fmtMoney(r.sim)  : "—"}`,
                      `Factura:   ${r.sale != null ? fmtMoney(r.sale) : "—"}`,
                      `Diferencia: ${r.diff != null ? fmtMoney(r.diff) : "—"}`,
                      "",
                      STATUS_TOOLTIP[r.status],
                    ].join("\n");

                    const diffTone = (() => {
                      if (r.diff == null)             return "text-muted/60 italic";
                      if (r.status === "ok")          return "text-muted";
                      if (r.status === "rounding")    return "text-sky-400";
                      if (r.status === "expected")    return "text-violet-400";
                      if (r.status === "minor")       return "text-amber-500";
                      if (r.status === "critical")    return "text-red-500 font-semibold";
                      return "text-muted";
                    })();

                    return (
                      <tr key={i} className="border-b border-border/40 hover:bg-surface2/30" title={rowTooltip}>
                        <td className="px-2 py-1.5">
                          <div className="text-text">{r.concept}</div>
                          {r.sublabel && (
                            <div className="text-[10px] italic text-muted/70">{r.sublabel}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.sim == null
                            ? <span className="italic text-muted/60">—</span>
                            : fmtMoney(r.sim, displaySym)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.sale == null
                            ? <span className="italic text-muted/60">—</span>
                            : fmtMoney(r.sale, displaySym)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.diff == null
                            ? <span className="italic text-muted/60">—</span>
                            : (
                              <span className="inline-flex items-center gap-1.5">
                                <span className={diffTone}>
                                  {fmtMoney(Math.abs(r.diff), displaySym)}
                                </span>
                                {r.status === "rounding" && (
                                  <span
                                    className="rounded border border-sky-500/30 bg-sky-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-400"
                                    title="Diferencia menor causada por redondeo o precisión decimal. No es un error."
                                  >
                                    Redondeo
                                  </span>
                                )}
                                {r.status === "expected" && (
                                  <span
                                    className="rounded border border-violet-500/30 bg-violet-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-violet-400"
                                    title={STATUS_TOOLTIP.expected}
                                  >
                                    Esperado
                                  </span>
                                )}
                              </span>
                            )}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <span
                            className={cn(
                              "inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              STATUS_TONE[r.status],
                            )}
                            title={STATUS_TOOLTIP[r.status]}
                          >
                            {STATUS_LABEL[r.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {summary.critical + summary.minor > 0 && (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-500">
                <strong>Antes de buscar el bug:</strong> primero revisar si los inputs efectivos
                son idénticos en ambas pantallas — cliente, lista de precios, canal, cupón,
                cantidad, moneda, impuestos del artículo y fecha de vigencia de la promoción.
                Los dos endpoints usan el mismo motor: las diferencias &le; 0,10 son redondeo
                esperado; por encima de eso, lo más probable es un input distinto o un mapeo
                que no apunta al mismo campo del backend.
              </div>
            )}
          </TPCard>
        )}

        {/* Sección "Condiciones comerciales del cliente" — todo viene del
            EntityRow del selector (no requiere fetch del detalle). Permite
            verificar de un vistazo qué defaults trajo el Comparador y qué
            está overridiando manualmente el operador. */}
        {client && (
          <TPCard title="Condiciones comerciales del cliente">
            {(() => {
              const plRow  = priceLists.find(p => p.id === (client.priceListId ?? "")) ?? null;
              const curRow = currencies.find(c => c.id === (client.currencyId  ?? "")) ?? null;
              const lblFlag = (truthy: boolean) => truthy
                ? <span className="ml-1 rounded border border-sky-500/40 bg-sky-500/10 px-1 py-px text-[9px] font-semibold uppercase text-sky-400">override</span>
                : null;
              return (
                <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                  <div className="rounded-md border border-border bg-card p-2 space-y-0.5">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Defaults comerciales</div>
                    <div className="flex justify-between">
                      <span className="text-muted">Lista habitual</span>
                      <span>{plRow?.name ?? (client.priceListId ? client.priceListId : <em className="italic text-muted/70">(sin lista)</em>)}{lblFlag(priceListOverridesClient)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Moneda habitual</span>
                      <span>{curRow ? `${curRow.code}${curRow.symbol ? ` (${curRow.symbol})` : ""}` : (client.currencyId ?? <em className="italic text-muted/70">(sin moneda)</em>)}{lblFlag(currencyOverridesClient)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Vendedor</span>
                      <span>{client.seller?.displayName ?? (client.sellerId ?? <em className="italic text-muted/70">(sin asignar)</em>)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Plazo de pago</span>
                      <span>{client.paymentTerm || <em className="italic text-muted/70">—</em>}</span>
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card p-2 space-y-0.5">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Reglas y fiscalidad</div>
                    <div className="flex justify-between">
                      <span className="text-muted">Balance</span>
                      <span className="rounded border border-border bg-card px-1 py-px text-[10px] font-semibold uppercase tracking-wide">
                        {client.balanceType || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Regla comercial</span>
                      <span>{client.commercialRuleType ?? <em className="italic text-muted/70">—</em>}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Valor regla</span>
                      <span>
                        {client.commercialValue != null && client.commercialValueType
                          ? `${client.commercialValue}${client.commercialValueType === "PERCENTAGE" ? "%" : ""}`
                          : <em className="italic text-muted/70">—</em>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Aplica sobre</span>
                      <span>{client.commercialApplyOn ?? <em className="italic text-muted/70">—</em>}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Condición fiscal</span>
                      <span>{client.ivaCondition || <em className="italic text-muted/70">—</em>}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Exento de impuestos</span>
                      <span>{client.taxExempt
                        ? <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[10px] font-semibold uppercase text-amber-500">Sí</span>
                        : <span className="text-muted">No</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Aplica impuestos sobre</span>
                      <span>{client.taxApplyOnOverride ?? <em className="italic text-muted/70">(default)</em>}</span>
                    </div>
                    {(client._count?.mermaOverrides ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted">Merma overrides</span>
                        <span>{client._count!.mermaOverrides} variante(s) con merma personalizada</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </TPCard>
        )}

        {/* Sección "Saldo del cliente" — Fase 2A.6.
            Llamada paralela a /account-statement. balanceType determina si
            se muestra como UNIFIED (un total) o BREAKDOWN (metal + hechura
            por moneda). El frontend NO calcula — sólo formatea. */}
        {client?.id && (
          <TPCard title="Saldo del cliente">
            {statementLoading && (
              <div className="text-xs italic text-muted">Cargando saldo…</div>
            )}
            {!statementLoading && !accountStatement && (
              <div className="text-xs italic text-muted/70">No se pudo cargar el saldo.</div>
            )}
            {!statementLoading && accountStatement && (() => {
              // Encabezado de contexto QA específico del Comparador (modo
              // elegido vs balanceType real). El render del saldo en sí lo
              // hace `TPBalanceBreakdownKpis`, que es reutilizable en Factura.
              const bt = accountStatement.entity.balanceType as keyof typeof BALANCE_TYPE_LABELS;
              const btLabel = BALANCE_TYPE_LABELS[bt] ?? accountStatement.entity.balanceType ?? "—";
              return (
                <div className="space-y-2 text-xs">
                  {/* Encabezado — modo elegido + balanceType real del cliente. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted">Modo:</span>
                    <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-400">
                      {balanceModeUI === "client"    ? "Según cliente"
                       : balanceModeUI === "unified" ? "Unificado (forzado)"
                       :                                "Desglosado (forzado)"}
                    </span>
                    <span className="text-muted">·</span>
                    <span className="text-muted">balanceType del cliente:</span>
                    <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {accountStatement.entity.balanceType || "—"}
                    </span>
                    <span className="text-muted">·</span>
                    <span>{btLabel}</span>
                    <span className="text-muted">·</span>
                    <span className="text-muted">vista efectiva:</span>
                    <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                      {effectiveBalanceMode}
                    </span>
                  </div>

                  {/* Reemplazado por el componente reutilizable
                      `TPBalanceBreakdownKpis` (mismo estilo que el Simulador,
                      reutilizable en Factura). Le pasamos:
                       · `balanceType` = `effectiveBalanceMode` (lo que el
                         operador eligió: client → resuelto, o forzado).
                       · `closingBalance` = directo del account-statement.
                       · `metalComposition` / `hechuraComposition` = del
                         lado SALES preferentemente (paridad con factura),
                         con fallback al SIM cuando aún no hay sales.
                       · `clientBalanceTypeRaw` para que el componente
                         muestre la nota ámbar si se fuerza un modo distinto.
                  */}
                  <TPBalanceBreakdownKpis
                    title="Saldo del cliente"
                    mode="invoice"
                    balanceType={effectiveBalanceMode}
                    closingBalance={accountStatement.closingBalance}
                    metalComposition={
                      saleNorm?.lines?.[0]?.composition?.metal
                      ?? simNorm?.lines?.[0]?.composition?.metal
                      ?? simRes?.composition?.metal
                      ?? null
                    }
                    hechuraComposition={
                      saleNorm?.lines?.[0]?.composition?.hechura
                      ?? simNorm?.lines?.[0]?.composition?.hechura
                      ?? simRes?.composition?.hechura
                      ?? null
                    }
                    currencySymbol={displaySym}
                    clientBalanceTypeRaw={clientBalanceTypeRaw}
                  />
                </div>
              );
            })()}
          </TPCard>
        )}

        {/* Sección "Composición Metal / Hechura" — KPIs reutilizables.
            Lado a lado: Simulador | Factura. Mismo componente
            `TPPriceCompositionKpis`, distintas fuentes de datos. El componente
            es presentacional puro — no recalcula nada. */}
        {(simNorm || saleNorm) && (
          <TPCard title="Composición Metal / Hechura">
            {/* Toggle Compra / Venta — compartido por ambas columnas. */}
            <div className="mb-3 flex items-center gap-2 text-[11px]">
              <span className="text-muted">Vista:</span>
              <div className="inline-flex overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setCompositionView("sale")}
                  className={cn(
                    "px-2 py-1 font-semibold uppercase tracking-wide transition-colors",
                    compositionView === "sale"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-card text-muted hover:bg-surface2/30",
                  )}
                >
                  Venta / Precio
                </button>
                <button
                  type="button"
                  onClick={() => setCompositionView("cost")}
                  className={cn(
                    "border-l border-border px-2 py-1 font-semibold uppercase tracking-wide transition-colors",
                    compositionView === "cost"
                      ? "bg-sky-500/15 text-sky-400"
                      : "bg-card text-muted hover:bg-surface2/30",
                  )}
                >
                  Compra / Costo
                </button>
              </div>
              <span className="text-[10px] italic text-muted/70">
                {compositionView === "sale"
                  ? "Métricas de precio (lo que cobra el motor)"
                  : "Métricas de costo (lo que paga la jewelry)"}
              </span>
            </div>

            {(() => {
              // Detectar mismatch entre las dos columnas — `mismatch=true`
              // sólo cuando la diferencia NO es esperada por arquitectura.
              // Caso esperado: el simulador no aplica redondeo a nivel
              // comprobante (TENANT_POLICY), pero la factura sí. La
              // diferencia entre `sim.total` y `factura.total` coincide
              // exactamente con `factura.roundingAdjustment` y no debe
              // marcarse como error.
              const sLine = simNorm?.lines?.[0] ?? null;
              const fLine = saleNorm?.lines?.[0] ?? null;
              const sTotal = compositionView === "sale"
                ? (simNorm?.documentTotals?.total ?? null)
                : (sLine?.costWithTax ?? null);
              const fTotal = compositionView === "sale"
                ? (saleNorm?.documentTotals?.total ?? null)
                : (fLine?.costWithTax ?? null);
              const rawDiff = (sTotal != null && fTotal != null)
                ? Math.abs(fTotal - sTotal)
                : 0;
              const docRoundingOnlyOnInvoice =
                saleNorm?.roundingInfo?.source === "TENANT_POLICY" &&
                simNorm?.roundingInfo?.source  !== "TENANT_POLICY";
              const expectedDelta = docRoundingOnlyOnInvoice
                ? Math.abs(saleNorm?.documentTotals?.roundingAdjustment ?? 0)
                : 0;
              const isExpectedDiff =
                docRoundingOnlyOnInvoice &&
                rawDiff > 0.01 &&
                Math.abs(rawDiff - expectedDelta) <= 0.02;
              const mismatch = !isExpectedDiff && rawDiff > 0.01;

              return (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {/* Lado Simulador */}
                  <TPPriceCompositionKpis
                    title="Simulador"
                    mode="compare"
                    view={compositionView}
                    composition={sLine?.composition ?? simRes?.composition ?? null}
                    metalHechuraBreakdown={sLine?.metalHechuraBreakdown ?? simRes?.metalHechuraBreakdown ?? null}
                    componentSaleBreakdown={sLine?.componentSaleBreakdown ?? simRes?.componentSaleBreakdown ?? null}
                    total={simNorm?.documentTotals?.total ?? null}
                    subtotal={simNorm?.documentTotals?.taxableBase ?? null}
                    taxAmount={simNorm?.documentTotals?.taxAmount ?? null}
                    costBase={sLine?.costBase ?? null}
                    costTaxAmount={sLine?.costTaxAmount ?? null}
                    costWithTax={sLine?.costWithTax ?? null}
                    costTaxBreakdown={sLine?.costTaxBreakdown}
                    marginPercent={sLine?.marginPercent ?? null}
                    currencySymbol={displaySym}
                    emptyText="Sin datos del lado simulador todavía."
                    mismatch={mismatch}
                    priceListMode={sLine?.appliedPriceListMode ?? null}
                  />

                  {/* Lado Factura */}
                  <TPPriceCompositionKpis
                    title="Factura"
                    mode="compare"
                    view={compositionView}
                    composition={fLine?.composition ?? null}
                    metalHechuraBreakdown={fLine?.metalHechuraBreakdown ?? null}
                    componentSaleBreakdown={fLine?.componentSaleBreakdown ?? null}
                    total={saleNorm?.documentTotals?.total ?? null}
                    subtotal={saleNorm?.documentTotals?.taxableBase ?? null}
                    taxAmount={saleNorm?.documentTotals?.taxAmount ?? null}
                    costBase={fLine?.costBase ?? null}
                    costTaxAmount={fLine?.costTaxAmount ?? null}
                    costWithTax={fLine?.costWithTax ?? null}
                    costTaxBreakdown={fLine?.costTaxBreakdown}
                    marginPercent={fLine?.marginPercent ?? null}
                    currencySymbol={displaySym}
                    emptyText="Sin datos del lado factura todavía."
                    mismatch={mismatch}
                    priceListMode={fLine?.appliedPriceListMode ?? null}
                  />
                </div>
              );
            })()}
          </TPCard>
        )}

        {/* Bloque legacy "Composición Metal / Hechura" eliminado — el
            componente nuevo `TPPriceCompositionKpis` lo reemplaza arriba con
            las dos columnas Simulador/Factura. Para ver el render anterior,
            consultar el historial de git de este archivo. */}
        {/* Resúmenes laterales — Fase 2A: leen de los normalizados, sin
            escalado manual unit→doc. */}
        {(simNorm || saleNorm) && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TPInfoCard
              label="Total simulador (estimado)"
              value={simNorm?.documentTotals?.total != null
                ? fmtMoney(simNorm.documentTotals.total, displaySym)
                : "—"}
            />
            <TPInfoCard
              label="Total factura (documentTotals.total)"
              value={saleNorm?.documentTotals?.total != null
                ? fmtMoney(saleNorm.documentTotals.total, displaySym)
                : "—"}
            />
            <TPInfoCard
              label="Diferencia total"
              value={(() => {
                const last = rows.find((r) => r.concept === "Total documento");
                return last?.diff != null ? fmtMoney(last.diff, displaySym) : "—";
              })()}
            />
          </div>
        )}

        {/* Debug — payload enviado */}
        <TPCollapse
          open={debugOpen}
          onToggle={() => setDebugOpen((v) => !v)}
          title="Debug — payload enviado a cada endpoint"
          description="Útil para verificar que los inputs efectivos son idénticos."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TPCard title="articlesApi.getPricingPreview">
              <pre className="max-h-[300px] overflow-auto rounded bg-card p-2 text-[10px] text-text">
                {JSON.stringify(simPayload, null, 2)}
              </pre>
            </TPCard>
            <TPCard title="salesApi.preview">
              <pre className="max-h-[300px] overflow-auto rounded bg-card p-2 text-[10px] text-text">
                {JSON.stringify(salePayload, null, 2)}
              </pre>
            </TPCard>
          </div>
        </TPCollapse>

        {/* Respuesta cruda */}
        <TPCollapse
          open={rawOpen}
          onToggle={() => setRawOpen((v) => !v)}
          title="Respuesta cruda de cada endpoint"
          description="Solo visible en dev. Útil para inspeccionar campos no comparados."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TPCard title="PricingPreviewResult (sim)">
              <pre className="max-h-[420px] overflow-auto rounded bg-card p-2 text-[10px] text-text">
                {JSON.stringify(simRes, null, 2)}
              </pre>
            </TPCard>
            <TPCard title="SalePreviewResult (factura)">
              <pre className="max-h-[420px] overflow-auto rounded bg-card p-2 text-[10px] text-text">
                {JSON.stringify(saleRes, null, 2)}
              </pre>
            </TPCard>
          </div>
        </TPCollapse>
      </div>
    </TPSectionShell>
  );
}
