// src/components/sales/TotalDelComprobanteCard/parts/MonetarySummary.tsx
// =============================================================================
// Etapa UX-Tax — Desglose monetario reorganizado en 4 secciones conceptuales.
//
// Antes (pila plana):
//   HECHURA / PRODUCT / TAX / DISCOUNT / SHIPPING / CHANNEL / COUPON / ...
//   todo en una sola columna, sin distinguir qué entra a la base imponible
//   y qué se suma después.
//
// Ahora (POLICY §Tax.1):
//   A. Construcción comercial          (HECHURA, PRODUCT)
//      └─ "Subtotal comercial"         passthrough de subtotalAfterLineDiscounts
//   B. Ajustes a la base imponible     (CHANNEL, COUPON, BONUS, DISCOUNT, SURCHARGE)
//      └─ "BASE IMPONIBLE"             passthrough de documentTotals.taxableBase
//   C. Impuestos                       (TAX)
//   D. Adicionales financieros         (SHIPPING, PAYMENT, ROUNDING, ADJUSTMENT)
//      └─ caption "No afectan el IVA"
//
// Cero matemática nueva — sigue siendo PASSTHROUGH. Lo que cambió es:
//   · la AGRUPACIÓN visual (via `categorizeGroupsForDisplay`, helper puro).
//   · dos filas síntesis nuevas que vienen como props del backend
//     (`subtotalCommercial`, `taxableBase`) y se muestran sin recalcular.
//
// La fila final "Total" se omite acá porque el card maestro ya la muestra
// grande en el header (regla histórica: no duplicar el Total).
// =============================================================================

import type { ReactElement, ReactNode } from "react";
import { formatByType } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import { OriginTooltip } from "./OriginTooltip";
import { TraceTooltipBody } from "./TraceTooltipBody";
import type { ComponentTrace } from "../traceability";
import {
  groupLabel,
  categorizeGroupsForDisplay,
  type GroupedComponents,
  type DisplaySection,
} from "../helpers";

/** Summary del rounding aplicado al comprobante (passthrough EXACTO de
 *  `documentTotals.documentRoundingApplied`, Etapa 1B + capa 16 PHYSICAL).
 *  Usado para discriminar visualmente "Redondeo del comprobante" (modifica
 *  el total) vs "Redondeo de lista" (ya incluido en las líneas), y para
 *  mostrar el detalle por metal padre cuando el dominio es PHYSICAL. */
export interface DocumentRoundingAppliedSummary {
  scope?:           "UNIFIED" | "BREAKDOWN" | "BOTH" | string;
  totalAdjustment?: number;
  unified?:         { mode?: string; direction?: string; adjustment?: number } | null;
  breakdown?:       {
    metal?:   { mode?: string; direction?: string; adjustment?: number } | null;
    hechura?: { mode?: string; direction?: string; adjustment?: number } | null;
    // Etapa D — dominio del metal en BREAKDOWN. "PHYSICAL" activa el detalle
    // por metal padre. POLICY §R-Rounding-14 contrato canónico DESGLOSADO.
    metalDomain?:   "MONETARY" | "PHYSICAL" | string | null;
    metalPhysical?: {
      metals?: ReadonlyArray<{
        metalParentId?:     string | null;
        metalParentName?:   string;
        preGrams?:          number;
        postGrams?:         number;
        deltaGrams?:        number | null;
        metalPricePerGram?: number;
        monetaryEquivalent?: number;
        mode?:              string;
        direction?:         string;
        source?:            string;
        fallback?:          string | null;
      } | null | undefined>;
      metalMonetaryEquivalent?: number | null;
      fallback?: string | null;
    } | null;
  } | null;
  fallback?: string | null;
}

export interface MonetarySummaryProps {
  groups:          GroupedComponents[];
  displayCurrency: string;
  /** Fila "Subtotal comercial" — passthrough EXACTO de
   *  `documentTotals.subtotalAfterLineDiscounts`. Si null/undefined, se omite. */
  subtotalCommercial?: number | null;
  /** Fila "BASE IMPONIBLE" — passthrough EXACTO de `documentTotals.taxableBase`
   *  (POLICY §Tax.1 paso 11). Si null/undefined, se omite. */
  taxableBase?: number | null;
  /** POLICY §R-Rounding-1 — discriminador para el render del ROUNDING_MONETARY.
   *   · !=null → "Redondeo del comprobante" (modifica el total, prominente).
   *   · null   → "Redondeo de lista" (ya incluido en subtotal, secundario). */
  documentRoundingApplied?: DocumentRoundingAppliedSummary | null;
  /** Fila final "Resultado monetario" — passthrough EXACTO de
   *  `balanceBreakdown.monetaryBalance.amount` (autoridad backend, ya
   *  convertido a moneda del documento). El frontend NUNCA suma components
   *  para derivar este valor. Pasalo solo en BREAKDOWN — en UNIFIED
   *  duplicaría el Total maestro. */
  monetaryResult?: number | null;
  /** Etapa UX-Saldo (2026-05-29) — Σ `valuationMonetary` de los metales
   *  resueltos para el bloque "Patrimonio Metálico". Cuando se provee y
   *  hay `totalDocument`, el cuerpo expandido agrega dos filas síntesis
   *  al pie:
   *    1. "Menos patrimonio metálico"  −Σ valuation
   *    2. "Saldo monetario"             totalDocument − Σ valuation
   *  Cero matemática comercial — derivación de display de dos passthroughs
   *  (totalDocument + monetaryAmount por metal padre). Si `null`/undefined
   *  o si `totalDocument` falta, esas dos filas se omiten (degradación
   *  segura). Solo se renderizan en modo BREAKDOWN; el caller pasa
   *  `null` en UNIFIED para preservar el comportamiento histórico. */
  metalsValuationSum?: number | null;
  /** Total final del comprobante (passthrough). El header del card también
   *  lo muestra; aquí va como cierre del desglose cuando está expandido. */
  totalDocument?:  number | null;
  /** F1 — Detalles del redondeo COMERCIAL PHYSICAL aplanados por línea
   *  (passthrough del backend, ver TotalDelComprobanteCardProps.commercialPhysicalRoundedMetals).
   *  Cuando hay entries con deltaGrams != 0, MonetarySummary renderiza un
   *  bloque adicional "Redondeo comercial" análogo al financiero pero con
   *  label distintivo. Si está vacío/undefined, el bloque no se renderiza. */
  commercialPhysicalMetals?: ReadonlyArray<PhysicalMetalEntry | null | undefined>;
  /** Etapa 2F — modo de saldo del documento. En UNIFICADO (`false`) se OCULTA
   *  la sección COMMERCIAL ("Composición": Hechura/Productos): no hay
   *  composición metal/monetario, el detalle se enfoca en la cuenta monetaria
   *  (ajustes / impuestos / redondeos / ajuste manual). Default `true`
   *  (BREAKDOWN) para back-compat con callers que no lo pasan. */
  isBreakdown?: boolean;
  /** Layout PLANO del detalle financiero, independiente del modo de saldo.
   *  Cuando es `true`, el detalle se renderiza como una lista plana (sin
   *  encabezados de sección, sin sub-encabezados de grupo, sin "Base imponible",
   *  separadores mínimos) — idéntico al look UNIFICADO — pero CONSERVANDO el
   *  contenido propio del modo (en BREAKDOWN sigue mostrando la Composición).
   *  Permite que el detalle financiero del DESGLOSADO se vea como el del
   *  UNIFICADO. Sin él, el layout se deriva de `isBreakdown` (back-compat). */
  flatDetail?: boolean;
  /** Trazabilidad de auditoría por `type` de componente (cupón, canal, IVA,
   *  envío, descuento global, promociones, redondeo, ajuste). Cuando existe un
   *  trace para una fila, su tooltip ⓘ reconstruye la cuenta completa
   *  (Origen · Base × regla · Impacto) vía `TraceTooltipBody`. Si falta, la
   *  fila cae al tooltip minimalista legacy (back-compat). Passthrough puro. */
  componentTraces?: Readonly<Record<string, ComponentTrace>>;
}

function amountColorClass(amount: number): string {
  if (amount < 0) return vt.colors.discount;
  if (amount > 0) return vt.colors.text;
  return vt.colors.label;
}

/** Renderiza una fila de componente (label + amount). Display-only.
 *
 *  `tier` controla la jerarquía visual:
 *    · "premium" → filas "principales" de la sección COMMERCIAL
 *      (Hechura, Productos, Servicios). Tipografía `text-sm font-medium`
 *      para el label y `font-semibold` para el monto, padding `py-1`.
 *      Acompaña la apariencia premium del bloque "Total hechura".
 *    · "detail"  → filas del expand interno (ajustes, impuestos, post-tax).
 *      Tipografía compacta del DS (`vt.text.label` / `vt.text.rowAmount`).
 */
// ──────────────────────────────────────────────────────────────────────────
// Etapa UX.30 (2026-05-30) — Helpers para el contenido de OriginTooltip por
// type de component. Cero matemática — solo arma JSX explicativo a partir
// de datos que ya están en mano (label, type, amount, contexto del rounding).
// ──────────────────────────────────────────────────────────────────────────

/** Etapa UX.33-final — tooltips de calculadora: SOLO cuenta matemática.
 *  Sin texto narrativo, sin explicaciones, sin referencias técnicas. */
function TooltipRow({
  label, amount, currency, neg, bold,
}: { label: string; amount: number; currency: string; neg?: boolean; bold?: boolean }): ReactElement {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted/80">{label}</span>
      <span className={`tabular-nums ${neg && amount > 0 ? "text-red-500" : "text-text"}`}>
        {neg ? "−" : ""}{currency} {formatByType(Math.abs(amount), "MONEY")}
      </span>
    </div>
  );
}

function TooltipDivider(): ReactElement {
  return <div className="my-1 border-t border-border/30" />;
}

function buildRoundingOriginBody(
  dra: DocumentRoundingAppliedSummary | null | undefined,
  displayCurrency: string,
  amount: number,
): ReactNode {
  const physical = dra?.breakdown?.metalPhysical?.metals?.find((m) => m && m.deltaGrams !== 0);
  if (physical && displayCurrency) {
    return (
      <>
        <TooltipRow label="Antes" amount={Number(physical.preGrams)} currency="g" />
        <TooltipRow label="Después" amount={Number(physical.postGrams)} currency="g" />
        {physical.metalPricePerGram != null && (
          <TooltipRow label="Cotización" amount={Number(physical.metalPricePerGram)} currency={`${displayCurrency}/g`} />
        )}
        <TooltipDivider />
        <TooltipRow label="Diferencia" amount={amount} currency={displayCurrency} bold />
      </>
    );
  }
  if (!displayCurrency) return null;
  return <TooltipRow label="Redondeo" amount={amount} currency={displayCurrency} bold />;
}

/** Etapa UX.33 (2026-05-30) — Contexto extra para que el tooltip muestre
 *  no solo el "Origen" sino también la "Cuenta" (fórmula con números reales)
 *  cuando hay datos suficientes. Cero matemática nueva: la división
 *  `amount / base` para inferir alícuota es display puro. */
interface BuildOriginContextCtx {
  subtotalCommercial?: number | null;
  taxableBase?:        number | null;
}

function fmtMoneyDisplay(currency: string, value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}${currency} ${formatByType(Math.abs(value), "MONEY")}`;
}

/** Etapa UX.33-final (2026-05-30) — tooltips minimalistas: SOLO cuenta
 *  matemática (sin texto narrativo). Estilo calculadora comercial. */
function buildOriginBodyFor(
  type:   string,
  label:  string,
  amount: number,
  displayCurrency: string,
  ctx:    BuildOriginContextCtx = {},
): { title: string; body: ReactNode } | null {
  if (!displayCurrency) return null;
  switch (type) {
    case "HECHURA":
    case "PRODUCT":
    case "SERVICE":
      return {
        title: "Hechura",
        body: <TooltipRow label="Hechura" amount={amount} currency={displayCurrency} bold />,
      };
    case "TAX": {
      const base = ctx.taxableBase;
      if (base != null && Number.isFinite(base) && base > 0.005) {
        const pct = (amount / base) * 100;
        return {
          title: label || "Impuesto",
          body: (
            <>
              <TooltipRow label="Base imponible" amount={base} currency={displayCurrency} />
              <TooltipRow label="Alícuota" amount={pct} currency="%" />
              <TooltipDivider />
              <TooltipRow label={label || "IVA"} amount={amount} currency={displayCurrency} bold />
            </>
          ),
        };
      }
      return {
        title: label || "Impuesto",
        body: <TooltipRow label={label || "IVA"} amount={amount} currency={displayCurrency} bold />,
      };
    }
    case "DISCOUNT_QTY":
      // C (2026-06) — label genérico claro (el footer no recibe el nombre de
      // la promo, que vive per-línea). Solo display.
      return {
        title: "Promociones y descuentos",
        body: <TooltipRow label="Total" amount={amount} currency={displayCurrency} neg bold />,
      };
    case "DISCOUNT_MANUAL": {
      const base = ctx.subtotalCommercial;
      if (base != null && Number.isFinite(base) && base > 0.005) {
        const pct = (Math.abs(amount) / base) * 100;
        return {
          title: "Descuento global",
          body: (
            <>
              <TooltipRow label="Subtotal" amount={base} currency={displayCurrency} />
              <TooltipRow label="Descuento" amount={pct} currency="%" />
              <TooltipDivider />
              <TooltipRow label="Total" amount={amount} currency={displayCurrency} neg bold />
            </>
          ),
        };
      }
      return {
        title: "Descuento global",
        body: <TooltipRow label="Total" amount={amount} currency={displayCurrency} neg bold />,
      };
    }
    case "COUPON":
      return {
        title: label || "Cupón",
        body: <TooltipRow label={label || "Cupón"} amount={amount} currency={displayCurrency} neg bold />,
      };
    case "CHANNEL":
      return {
        title: label || "Canal",
        body: <TooltipRow label={label || "Canal"} amount={amount} currency={displayCurrency} bold />,
      };
    case "SHIPPING":
      return {
        title: "Envío",
        body: <TooltipRow label="Envío" amount={amount} currency={displayCurrency} bold />,
      };
    case "PAYMENT":
      return {
        title: label || "Forma de pago",
        body: <TooltipRow label={label || "Forma de pago"} amount={amount} currency={displayCurrency} bold />,
      };
    case "MANUAL_ADJUSTMENT":
      return {
        title: "Ajuste manual",
        body: <TooltipRow label="Ajuste manual" amount={amount} currency={displayCurrency} bold />,
      };
    case "BONUS":
      return {
        title: label || "Bonificación",
        body: <TooltipRow label={label || "Bonificación"} amount={amount} currency={displayCurrency} bold />,
      };
    case "SURCHARGE":
      return {
        title: label || "Recargo",
        body: <TooltipRow label={label || "Recargo"} amount={amount} currency={displayCurrency} bold />,
      };
    default:
      return null;
  }
}

/** Origen VISIBLE en pantalla (subtítulo) por tipo de componente. Resume de
 *  dónde proviene el ajuste — NO cambia el label principal ni el cálculo.
 *  Devuelve `null` para componentes de composición (no son ajustes del total)
 *  y para `ROUNDING_MONETARY` (lo rinde `RoundingRow` con su propio caption).
 *  Cualquier tipo modificador no mapeado cae a "Origen no especificado". */
function originSubtitleFor(type: string): string | null {
  switch (type) {
    case "CHANNEL":           return "Canal de venta";
    case "COUPON":            return "Cupón aplicado manualmente";
    case "DISCOUNT_QTY":      return "Promoción automática / por línea";
    case "DISCOUNT_PROMO":    return "Promoción automática";
    case "DISCOUNT_CLIENT":   return "Descuento del cliente";
    case "DISCOUNT_MANUAL":   return "Manual del comprobante";
    case "BONUS":             return "Bonificación del comprobante";
    case "SURCHARGE":         return "Recargo del comprobante";
    case "TAX":               return "Impuesto sobre base imponible";
    case "SHIPPING":          return "Envío del comprobante";
    case "PAYMENT":           return "Forma de pago";
    case "MANUAL_ADJUSTMENT": return "Ajuste manual del comprobante";
    // Composición (base, no modifica el total como ajuste) → sin subtítulo.
    case "HECHURA":
    case "PRODUCT":
    case "SERVICE":
    case "METAL_MARGIN":      return null;
    // El redondeo monetario se rinde en RoundingRow (caption propio en pantalla).
    case "ROUNDING_MONETARY": return null;
    default:                  return "Origen no especificado";
  }
}

function ComponentRow({
  label,
  amount,
  displayCurrency,
  testId,
  tier = "detail",
  originTitle,
  originBody,
  originSubtitle,
}: {
  label:           string;
  amount:          number;
  displayCurrency: string;
  testId:          string;
  tier?:           "premium" | "detail";
  originTitle?:    string;
  originBody?:     ReactNode;
  /** Origen VISIBLE en pantalla (subtítulo bajo el label). Display puro. */
  originSubtitle?: string | null;
}): ReactElement {
  const hasOrigin = !!originBody && !!originTitle;
  // Suprime el subtítulo si coincide con el label principal (ej. CHANNEL sin
  // nombre cae a "Canal de venta", igual que el origen) — evita duplicar.
  const showSubtitle =
    !!originSubtitle &&
    originSubtitle.trim().toLowerCase() !== label.trim().toLowerCase();
  const subtitle = showSubtitle
    ? (
      <span className="text-[10px] text-muted/65 leading-tight" data-testid={`${testId}-origin`}>
        {originSubtitle}
      </span>
    )
    : null;
  if (tier === "premium") {
    return (
      <li
        className="flex items-baseline justify-between gap-3 py-1"
        data-testid={testId}
      >
        <span className="flex flex-col gap-0">
          <span className="text-sm font-medium text-text inline-flex items-center">
            {label}
            {hasOrigin && <OriginTooltip title={originTitle!} body={originBody} />}
          </span>
          {subtitle}
        </span>
        <span
          className={`tabular-nums text-sm font-semibold ${amountColorClass(amount)}`}
        >
          {displayCurrency ? `${displayCurrency} ` : ""}
          {formatByType(amount, "MONEY")}
        </span>
      </li>
    );
  }
  return (
    <li
      className={vt.row.flexBetween}
      data-testid={testId}
    >
      <span className="flex flex-col gap-0">
        <span className={`${vt.text.label} inline-flex items-center`}>
          {label}
          {hasOrigin && <OriginTooltip title={originTitle!} body={originBody} />}
        </span>
        {subtitle}
      </span>
      <span className={`${vt.text.rowAmount} ${amountColorClass(amount)}`}>
        {displayCurrency ? `${displayCurrency} ` : ""}
        {formatByType(amount, "MONEY")}
      </span>
    </li>
  );
}

/**
 * POLICY §R-Rounding-3 — render diferenciado de la fila de redondeo.
 *
 * Hasta antes de esta etapa, todo `roundingAdjustment` se mostraba como
 * "Redondeo" sin contexto, generando confusión: el operador asumía que un
 * "Redondeo: 26,03" era pendiente al `total` cuando en realidad ya estaba
 * absorbido en las líneas (caso del rounding de LISTA DE PRECIOS).
 *
 * Ahora distinguimos dos casos (passthrough — cero matemática):
 *
 *   · `documentRoundingApplied != null` → política del COMPROBANTE activa
 *     (Etapa 1B). El delta MODIFICA `documentTotals.total`. Se renderiza:
 *       - label "Redondeo del comprobante"
 *       - caption con scope (UNIFIED / BREAKDOWN / BOTH) y modo
 *       - tipografía igual al resto de filas detail (no inflar peso)
 *
 *   · `documentRoundingApplied == null` → el delta proviene de la LISTA
 *     DE PRECIOS (ya absorbido en `lineTotal` de cada línea). Se renderiza:
 *       - label "Redondeo de lista"
 *       - caption "Ya incluido en el subtotal"
 *       - tipografía secundaria (text-muted, italic) — informativo
 *
 * `data-tp-rounding-source` permite a los tests identificar la fuente sin
 * depender del texto exacto.
 */
function RoundingRow({
  label,
  amount,
  displayCurrency,
  testId,
  documentRoundingApplied,
  roundingSource,
  trace,
}: {
  label:           string;
  amount:          number;
  displayCurrency: string;
  testId:          string;
  documentRoundingApplied?: DocumentRoundingAppliedSummary | null;
  /** POLICY §R-Rounding-3 — origen REAL del componente emitido por el backend.
   *  Cuando viene, DECIDE el label (independiente de `documentRoundingApplied`):
   *    · `"LIST"`     → "Redondeo comercial" (lista de precios).
   *    · `"DOCUMENT"` → "Redondeo financiero" (comprobante / tenant).
   *  Con opción B (financiero diferido a capa 16), el `roundingAdjustment` es el
   *  COMERCIAL aunque `documentRoundingApplied` (financiero) esté presente — por
   *  eso NO se puede inferir el origen de `documentRoundingApplied`. Cuando falta
   *  `roundingSource` (snapshots legacy), se cae al heurístico previo. */
  roundingSource?: "LIST" | "DOCUMENT" | null;
  /** Trazabilidad de auditoría — si llega, el tooltip ⓘ reconstruye la cuenta
   *  completa (pre → post · impacto) en vez del cuerpo legacy. */
  trace?:          ComponentTrace | null;
}): ReactElement {
  // POLICY §R-Rounding-3 — el ORIGEN del componente manda. Si el backend lo
  // emite (`roundingSource`), se usa tal cual; si no (back-compat), se infiere
  // de la presencia de `documentRoundingApplied` (heurístico legacy).
  const isComprobante =
    roundingSource != null
      ? roundingSource === "DOCUMENT"
      : documentRoundingApplied != null;
  const source: "DOCUMENT" | "LIST" = isComprobante ? "DOCUMENT" : "LIST";

  // POLICY §R-Rounding-12 — dominios oficiales:
  //   · LIST     → "Redondeo comercial"  (sobre precio antes de impuestos)
  //   · DOCUMENT → "Redondeo financiero" (sobre total después de impuestos)
  // Label substituye el "Redondeo" genérico del backend.
  const displayLabel = isComprobante
    ? "Redondeo financiero"
    : "Redondeo comercial";

  // Caption secundaria.
  const caption = isComprobante
    ? buildComprobanteCaption(documentRoundingApplied)
    : "Antes de impuestos · ya incluido en el subtotal";

  if (isComprobante) {
    // Caso comprobante — fila de cierre del cálculo. Estilo igual al
    // resto del detail (densidad ERP) pero el caption deja claro qué
    // capa actuó (UNIFIED / BREAKDOWN / BOTH).
    //
    // I2 — Cuando el dominio es PHYSICAL y hay metales con delta físico,
    // adicionamos un sub-bloque por metal padre debajo de la fila principal.
    // Mismo patrón visual que BreakdownSnapshotRows (referencia canónica).
    const isPhysical = documentRoundingApplied?.breakdown?.metalDomain === "PHYSICAL";
    const physicalMetals = isPhysical
      ? documentRoundingApplied?.breakdown?.metalPhysical?.metals
      : null;
    return (
      <li
        className="block"
        data-testid={testId}
        data-tp-rounding-source={source}
        data-tp-metal-domain={documentRoundingApplied?.breakdown?.metalDomain ?? ""}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex flex-col gap-0">
            <span className={`${vt.text.label} inline-flex items-center`}>
              {displayLabel}
              <OriginTooltip
                title={trace ? trace.title : displayLabel}
                body={
                  trace
                    ? <TraceTooltipBody trace={trace} currency={displayCurrency} />
                    : buildRoundingOriginBody(documentRoundingApplied, displayCurrency, amount)
                }
              />
            </span>
            {caption && (
              <span className="text-[10px] text-muted/65 leading-tight">
                {caption}
              </span>
            )}
          </span>
          <span className={`${vt.text.rowAmount} ${amountColorClass(amount)}`}>
            {displayCurrency ? `${displayCurrency} ` : ""}
            {formatByType(amount, "MONEY")}
          </span>
        </div>
        {physicalMetals != null && (
          <RoundingPhysicalBreakdownRows
            metals={physicalMetals}
            displayCurrency={displayCurrency}
          />
        )}
      </li>
    );
  }

  // Caso lista — informativo, secundario. Muted + italic + caption
  // explícita "Ya incluido en el subtotal".
  return (
    <li
      className="flex items-baseline justify-between gap-3 opacity-75"
      data-testid={testId}
      data-tp-rounding-source={source}
    >
      <span className="flex flex-col gap-0">
        <span className={`${vt.text.label} italic inline-flex items-center`}>
          {displayLabel}
          <OriginTooltip
            title={trace ? trace.title : displayLabel}
            body={
              trace
                ? <TraceTooltipBody trace={trace} currency={displayCurrency} />
                : buildRoundingOriginBody(documentRoundingApplied, displayCurrency, amount)
            }
          />
        </span>
        <span className="text-[10px] text-muted/60 leading-tight italic">
          {caption}
        </span>
      </span>
      <span className={`${vt.text.rowAmount} ${amountColorClass(amount)} italic`}>
        {displayCurrency ? `${displayCurrency} ` : ""}
        {formatByType(amount, "MONEY")}
      </span>
    </li>
  );
}

/** I2 — Subfilas del detalle PHYSICAL del redondeo financiero.
 *
 *  Cuando `documentRoundingApplied.breakdown.metalDomain === "PHYSICAL"` y
 *  hay `metalPhysical.metals[*]` con delta físico ≠ 0, mostramos por cada
 *  metal padre la transformación canónica:
 *
 *    Oro Fino · 1,526 g → 2,000 g · ARS 100/g       +ARS 47.400
 *
 *  Mismo patrón visual que `BreakdownSnapshotRows` del ManualAdjustmentSection
 *  (referencia canónica del DESGLOSADO). Cero matemática local — el backend
 *  ya devuelve los 5 campos calculados en `documentRoundingSnapshot`.
 *
 *  Filtra metales con `deltaGrams === 0` (no aportan información). Si todos
 *  son 0, devuelve null (no renderiza nada).
 */
type PhysicalMetalEntry = NonNullable<
  NonNullable<
    NonNullable<DocumentRoundingAppliedSummary["breakdown"]>["metalPhysical"]
  >["metals"]
>[number];

function RoundingPhysicalBreakdownRows({
  metals,
  displayCurrency,
}: {
  metals:          ReadonlyArray<PhysicalMetalEntry> | null | undefined;
  displayCurrency: string;
}): ReactElement | null {
  const list = (metals ?? []).filter(
    (m): m is NonNullable<typeof m> => {
      if (m == null) return false;
      const delta = m.deltaGrams;
      return typeof delta === "number" && Number.isFinite(delta) && delta !== 0;
    },
  );
  if (list.length === 0) return null;

  return (
    <ul
      className="mt-1 space-y-0.5 pl-3 border-l border-border/15"
      data-testid="total-card-rounding-physical-detail"
    >
      {list.map((m, idx) => {
        const equiv = typeof m.monetaryEquivalent === "number" && Number.isFinite(m.monetaryEquivalent)
          ? m.monetaryEquivalent
          : 0;
        const pre   = typeof m.preGrams  === "number" ? m.preGrams  : 0;
        const post  = typeof m.postGrams === "number" ? m.postGrams : 0;
        const ppg   = typeof m.metalPricePerGram === "number" && Number.isFinite(m.metalPricePerGram)
          ? m.metalPricePerGram
          : null;
        return (
          <li
            key={`${m.metalParentId ?? "null"}-${idx}`}
            className="flex items-baseline justify-between gap-3 text-[11px]"
            data-testid="total-card-rounding-physical-metal-row"
            data-tp-metal-id={m.metalParentId ?? ""}
          >
            <span className="text-muted truncate flex-1">
              {m.metalParentName ?? "—"}
              {" · "}
              <span className="tabular-nums">
                {formatByType(pre, "METAL_GRAMS")} → {formatByType(post, "METAL_GRAMS")} g
              </span>
              {ppg != null && (
                <>
                  {" · "}
                  <span className="tabular-nums text-muted/70">
                    {displayCurrency ? `${displayCurrency} ` : ""}
                    {formatByType(ppg, "MONEY")}/g
                  </span>
                </>
              )}
            </span>
            <span
              className={`tabular-nums ${amountColorClass(equiv)}`}
              data-testid="total-card-rounding-physical-metal-equiv"
            >
              {displayCurrency ? `${displayCurrency} ` : ""}
              {formatByType(equiv, "MONEY")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Resumen textual del scope/modo aplicado por la política de rounding del
 *  comprobante (Etapa 1B). Solo display — el caller pasa el `applied` tal
 *  cual viene del backend. */
function buildComprobanteCaption(
  applied: DocumentRoundingAppliedSummary | null | undefined,
): string {
  // POLICY §R-Rounding-12 — dominio financiero: SIEMPRE después de impuestos.
  const PREFIX = "Después de impuestos";
  if (!applied) return `${PREFIX} · aplicado al total final`;
  const parts: string[] = [];
  if (applied.unified && applied.unified.mode && applied.unified.mode !== "NONE") {
    parts.push(`Total ${applied.unified.mode}`);
  }
  if (applied.breakdown) {
    const metalMode   = applied.breakdown.metal?.mode;
    const hechuraMode = applied.breakdown.hechura?.mode;
    if (metalMode && metalMode !== "NONE") parts.push(`Metal ${metalMode}`);
    if (hechuraMode && hechuraMode !== "NONE") parts.push(`Hechura ${hechuraMode}`);
  }
  return parts.length > 0
    ? `${PREFIX} · ${parts.join(" · ")}`
    : `${PREFIX} · aplicado al total final`;
}

/** Render de los grupos de UNA sección.
 *
 *  `showGroupHeaders` controla si cada grupo lleva su sub-encabezado:
 *    · `true`  → muestra `groupLabel(g.group)` arriba de los items (ej.
 *      "Canal de venta" + items, "Bonificaciones" + items). Útil para
 *      AJUSTES y POST_TAX donde hay variedad de grupos.
 *    · `false` → omite el sub-encabezado y muestra items directos. Útil
 *      para COMMERCIAL: el bloque entero ya está bajo "Total hechura" del
 *      orchestrator, repetir "Base monetaria" / "Productos / Servicios"
 *      es ruido técnico para el operador final.
 */
function SectionGroups({
  groups,
  displayCurrency,
  showGroupHeaders,
  tier,
  documentRoundingApplied,
  subtotalCommercial,
  taxableBase,
  componentTraces,
}: {
  groups:           GroupedComponents[];
  displayCurrency:  string;
  showGroupHeaders: boolean;
  /** Jerarquía visual de las filas — "premium" (COMMERCIAL) o "detail"
   *  (expand interno). Se propaga a `ComponentRow`. */
  tier:             "premium" | "detail";
  /** POLICY §R-Rounding-3 — discriminador para el render del ROUNDING_MONETARY. */
  documentRoundingApplied?: DocumentRoundingAppliedSummary | null;
  /** UX.33 — contexto para que el helper de tooltips pueda mostrar "Cuenta"
   *  (= base × % = amount) en DISCOUNT_MANUAL e IVA. Passthrough. */
  subtotalCommercial?: number | null;
  taxableBase?:        number | null;
  /** Trazabilidad por `type` — tooltip de auditoría con la cuenta completa. */
  componentTraces?: Readonly<Record<string, ComponentTrace>>;
}): ReactElement {
  return (
    <div className={showGroupHeaders ? "space-y-2.5" : ""}>
      {groups.map((g) => (
        <div key={g.group} data-testid={`total-card-group-${g.group}`}>
          {showGroupHeaders && (
            <div className={`text-[10px] uppercase tracking-wider ${vt.colors.labelSoft} mb-1`}>
              {groupLabel(g.group)}
            </div>
          )}
          <ul className={tier === "premium" ? "divide-y divide-border/15" : "space-y-1"}>
            {g.components.map((c, idx) => {
              const testId = `total-card-component-${c.type}`;
              // POLICY §R-Rounding-3 — la fila ROUNDING_MONETARY se renderiza
              // con un componente especializado que distingue "lista" vs
              // "comprobante" según `documentRoundingApplied`.
              // Trazabilidad de auditoría: si hay un trace para este `type`,
              // su tooltip reconstruye la cuenta completa (Origen · Base ×
              // regla · Impacto). Tiene PRIORIDAD sobre el cuerpo legacy.
              const trace = componentTraces?.[c.type] ?? null;
              if (c.type === "ROUNDING_MONETARY") {
                return (
                  <RoundingRow
                    key={`${c.type}-${idx}`}
                    label={c.label}
                    amount={c.amount}
                    displayCurrency={displayCurrency}
                    testId={testId}
                    documentRoundingApplied={documentRoundingApplied}
                    // POLICY §R-Rounding-3 — origen REAL del componente. Tiene
                    // prioridad sobre `documentRoundingApplied` para el label.
                    roundingSource={c.roundingSource ?? null}
                    trace={trace}
                  />
                );
              }
              // Etapa UX.30 — origen del importe (tooltip ⓘ).
              // UX.33 — ctx con `subtotalCommercial` y `taxableBase` para
              // que tooltips de DISCOUNT_MANUAL e IVA puedan mostrar "Cuenta".
              const legacyOrigin = buildOriginBodyFor(c.type, c.label, c.amount, displayCurrency, {
                subtotalCommercial,
                taxableBase,
              });
              const origin = trace
                ? { title: trace.title, body: <TraceTooltipBody trace={trace} currency={displayCurrency} /> }
                : legacyOrigin;
              // C (2026-06) — El bucket DISCOUNT_QTY agrega descuentos de línea
              // de varios orígenes (promoción, descuento por cantidad, etc.). El
              // footer NO recibe el nombre exacto de la promo (vive per-línea),
              // así que el label genérico "Descuentos de línea" se reemplaza por
              // el más claro "Promociones y descuentos". Solo display — no inventa
              // nombres ni toca el dato del backend.
              const rowLabel =
                c.type === "DISCOUNT_QTY" ? "Promociones y descuentos" : c.label;
              return (
                <ComponentRow
                  key={`${c.type}-${idx}`}
                  label={rowLabel}
                  amount={c.amount}
                  displayCurrency={displayCurrency}
                  testId={testId}
                  tier={tier}
                  originTitle={origin?.title}
                  originBody={origin?.body}
                  // Origen VISIBLE en pantalla (subtítulo bajo el label).
                  originSubtitle={originSubtitleFor(c.type)}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Fila síntesis dentro de una sección (Subtotal comercial / BASE IMPONIBLE).
 *  Tipografía un poco más prominente para diferenciarla de las filas
 *  individuales. `emphasis="strong"` se reserva para BASE IMPONIBLE. */
function SectionSummaryRow({
  label,
  amount,
  displayCurrency,
  emphasis = "normal",
  testId,
}: {
  label:           string;
  amount:          number;
  displayCurrency: string;
  emphasis?:       "normal" | "strong";
  testId:          string;
}): ReactElement {
  const isStrong = emphasis === "strong";
  return (
    <div
      className={`mt-2 flex items-baseline justify-between border-t border-border/30 pt-1.5`}
      data-testid={testId}
    >
      <span
        className={
          isStrong
            ? "text-[11px] font-bold uppercase tracking-[0.16em] text-text"
            : "text-[11px] font-semibold uppercase tracking-wider text-text/85"
        }
      >
        {label}
      </span>
      <span
        className={`${vt.text.rowAmount} ${
          isStrong ? "font-bold" : "font-semibold"
        } ${amountColorClass(amount)}`}
      >
        {displayCurrency ? `${displayCurrency} ` : ""}
        {formatByType(amount, "MONEY")}
      </span>
    </div>
  );
}

// B (2026-06) — Labels CORTOS de sección para el encabezado del detalle
// financiero. Reusan la clasificación canónica `DisplaySection`
// (`categorizeGroupsForDisplay`). Versión compacta del `sectionLabel` de
// `helpers.ts` (que devuelve los nombres largos "Construcción comercial",
// etc.); acá priorizamos densidad ERP. Solo jerarquía visual — cero cálculo.
const SECTION_SHORT_LABEL: Record<DisplaySection, string> = {
  COMMERCIAL:       "Composición",
  BASE_ADJUSTMENTS: "Ajustes",
  TAXES:            "Impuestos",
  POST_TAX:         "Adicionales",
};

export function MonetarySummary({
  groups,
  displayCurrency,
  subtotalCommercial,
  taxableBase,
  documentRoundingApplied,
  monetaryResult,
  metalsValuationSum,
  totalDocument,
  commercialPhysicalMetals,
  isBreakdown = true,
  flatDetail = false,
  componentTraces,
}: MonetarySummaryProps): ReactElement | null {
  const hasResult        = monetaryResult != null && Number.isFinite(monetaryResult);
  const hasTotalDocument = totalDocument  != null && Number.isFinite(totalDocument);
  const hasSubtotal      = subtotalCommercial != null && Number.isFinite(subtotalCommercial);
  const hasTaxableBase   = taxableBase != null && Number.isFinite(taxableBase);

  // Filtro de ruido visual: componentes con amount === 0 NO aportan
  // información al operador. Display-only (no matemática).
  //
  // Etapa UX-Comercial (2026-05-30 — POLICY §R-Rounding-16) — suprimimos
  // el component `METAL_MARGIN` del render. Cuando el "Patrimonio Metálico"
  // del card muestra el valor COMERCIAL (= Σ metalCost = Σ valuationMonetary
  // + METAL_MARGIN), la diferencia ya está absorbida adentro del Patrimonio.
  // Renderizar METAL_MARGIN acá implicaría duplicarla matemáticamente. El
  // backend sigue emitiendo el component para snapshots / auditoría interna;
  // este filtro es exclusivamente visual.
  const filteredGroups = groups
    .map((g) => ({
      group:      g.group,
      components: g.components.filter(
        (c) => c.amount !== 0 && c.type !== "METAL_MARGIN",
      ),
    }))
    .filter((g) => g.components.length > 0);

  // Reorganización en 4 secciones (helper puro). El orden canónico
  // (COMMERCIAL → BASE_ADJUSTMENTS → TAXES → POST_TAX) se respeta siempre.
  const allSections = categorizeGroupsForDisplay(filteredGroups);
  // Etapa 2F — en UNIFICADO se OCULTA la sección COMMERCIAL ("Composición").
  // No hay composición metal/monetario: el detalle se enfoca en la cuenta
  // monetaria (ajustes / impuestos / redondeos / ajuste manual).
  const sections = isBreakdown
    ? allSections
    : allSections.filter((s) => s.section !== "COMMERCIAL");

  const hasAnyRow = sections.length > 0 || hasResult || hasTotalDocument
                    || hasSubtotal || hasTaxableBase;

  if (!hasAnyRow) {
    return (
      <p
        className={`${vt.text.subLabel} ${vt.colors.labelSoft} italic`}
        data-testid="total-card-monetary-empty"
      >
        Sin desglose disponible todavía.
      </p>
    );
  }

  // Helper: ¿existe esta sección en los datos? (decide si mostrar la fila
  // síntesis aun cuando los grupos vinieron vacíos por el filtro de ceros).
  const hasSection = (s: DisplaySection): boolean =>
    sections.some((sec) => sec.section === s);

  /**
   * Determina si la fila síntesis de una sección debe mostrarse:
   * - "Subtotal comercial" → al cierre de COMMERCIAL si hay subtotal y al
   *   menos un grupo de la sección, O si hay subtotal y hay ajustes a la
   *   base (para que el operador entienda de dónde sale lo que se ajusta).
   * - "BASE IMPONIBLE" → al cierre de BASE_ADJUSTMENTS si hay taxableBase
   *   y existen impuestos o ajustes (sino no aporta información).
   */
  const showSubtotalRow = hasSubtotal
    && (hasSection("COMMERCIAL") || hasSection("BASE_ADJUSTMENTS"));
  const showTaxableBaseRow = hasTaxableBase
    && (hasSection("BASE_ADJUSTMENTS") || hasSection("TAXES"));

  // Etapa 2F-B — en UNIFICADO el detalle es COMPACTO (como print 1): sin
  // headers de sección, sin sub-headers de grupo, sin base imponible y con
  // separadores mínimos. Solo filas relevantes (Promociones/IVA/Redondeo/
  // Ajuste manual). En BREAKDOWN se conserva el desglose estructurado, SALVO
  // que el caller pida `flatDetail` (paridad visual con el unificado): ahí el
  // layout es plano pero el CONTENIDO sigue siendo el de BREAKDOWN (Composición
  // incluida, gracias a que `sections` ya se resolvió con `isBreakdown`).
  const compact = flatDetail || !isBreakdown;
  return (
    <div className={compact ? "space-y-0.5" : "space-y-2"} data-testid="total-card-monetary">
      {sections.map(({ section, groups: secGroups }, secIdx) => {
        // Etapa UX-premium v3 — los headers/captions de sección se ELIMINARON.
        // El operador entiende el contexto por agrupación (sub-headers de
        // grupo: "Canal de venta", "Descuentos", "Bonificaciones", etc.) y
        // por las filas síntesis destacadas ("Subtotal comercial", "Base
        // imponible"). El detalle vive dentro del collapsible "Detalle
        // financiero" del orchestrator — no necesita anidar headers de
        // sección encima.
        //
        // Las únicas distinciones que SÍ se preservan son las filas síntesis
        // (Subtotal comercial y BASE IMPONIBLE) porque actúan como cierres
        // semánticos de bloque, no como títulos.
        const isCommercial = section === "COMMERCIAL";
        return (
          <section
            key={section}
            data-testid={`total-card-section-${section}`}
            // Etapa 2F-B — en UNIFICADO (compact) sin separadores entre
            // secciones (lista plana); en BREAKDOWN borde tenue + padding mínimo.
            className={compact ? "" : (secIdx === 0 ? "" : "border-t border-border/10 pt-2")}
          >
            {/* Encabezado corto de sección (COMPOSICIÓN / AJUSTES / IMPUESTOS /
                ADICIONALES). Etapa 2F-B — OCULTO en UNIFICADO (compact): el
                detalle se lee como una cuenta simple sin títulos de sección. */}
            {!compact && (
              <header
                className="text-[10px] font-semibold uppercase tracking-wider text-muted/70 mb-1.5"
                data-testid={`total-card-section-header-${section}`}
              >
                {SECTION_SHORT_LABEL[section]}
              </header>
            )}
            <SectionGroups
              groups={secGroups}
              displayCurrency={displayCurrency}
              // COMMERCIAL: items directos sin sub-encabezados de grupo.
              // Etapa 2F-B — en UNIFICADO (compact) TODOS los grupos van sin
              // sub-encabezado ("Descuentos"/"Bonificaciones"/etc.): filas planas.
              showGroupHeaders={!isCommercial && !compact}
              // Todo el detalle financiero vive bajo el collapsible y se ve
              // SECUNDARIO al header premium "Total hechura · ARS xxx" del
              // orchestrator. Todas las filas pasan a `tier="detail"`
              // (densidad ERP compacta) — la jerarquía premium queda
              // reservada para el header del bloque.
              tier="detail"
              // POLICY §R-Rounding-3 — distingue rounding de lista vs
              // comprobante en el componente ROUNDING_MONETARY.
              documentRoundingApplied={documentRoundingApplied}
              // UX.33 — contexto para tooltips con "Cuenta" en IVA y
              // DISCOUNT_MANUAL (base × % = amount).
              subtotalCommercial={subtotalCommercial}
              taxableBase={taxableBase}
              // Trazabilidad de auditoría por componente.
              componentTraces={componentTraces}
            />

            {/* Etapa UX-Saldo Compact (2026-05-29) — fila "Subtotal comercial"
                eliminada del detalle expandido. El header del card ya muestra
                "Saldo monetario" como cierre comercial; mantener esta fila
                acá duplicaba contexto y alargaba la lectura. La prop
                `subtotalCommercial` se mantiene en el API por back-compat con
                callers que la siguen pasando (passthrough sin render).
                Si en algún momento se decide reactivar, descomentar:
                  {section === "COMMERCIAL" && showSubtotalRow && (
                    <SectionSummaryRow label="Subtotal comercial" ... />
                  )} */}

            {/* Etapa 2F — "Base imponible" como REFERENCIA secundaria dentro de
                la cuenta (no título fuerte). Etapa 2F-B — OCULTA en UNIFICADO
                (compact) para no recargar la lista; en BREAKDOWN se mantiene. */}
            {!compact && section === "BASE_ADJUSTMENTS" && showTaxableBaseRow && (
              <div
                className="mt-1 flex items-baseline justify-between border-t border-border/10 pt-1"
                data-testid="total-card-taxable-base"
              >
                <span className="text-[10px] text-muted/70">Base imponible</span>
                <span className="tabular-nums text-[11px] text-text/80">
                  {displayCurrency ? `${displayCurrency} ` : ""}
                  {formatByType(taxableBase as number, "MONEY")}
                </span>
              </div>
            )}
          </section>
        );
      })}

      {/* I2 — Detalle PHYSICAL del redondeo financiero — fallback cuando
          NO hay `ROUNDING_MONETARY` component (path PHYSICAL puro: el motor
          mutó `documentTotals.total += metalMonetaryEquivalent` sin emitir
          un component monetario). Si hay component ROUNDING_MONETARY, el
          detalle PHYSICAL ya está renderizado adentro del `RoundingRow` —
          este bloque queda inactivo para evitar duplicar.
          Cero matemática local: passthrough EXACTO de
          documentRoundingSnapshot.breakdown.metalPhysical.metals[]. */}
      {(() => {
        const isPhysical = documentRoundingApplied?.breakdown?.metalDomain === "PHYSICAL";
        const physicalMetals = isPhysical
          ? documentRoundingApplied?.breakdown?.metalPhysical?.metals
          : null;
        const hasPhysicalDelta = (physicalMetals ?? []).some((m) => {
          const d = m?.deltaGrams;
          return typeof d === "number" && Number.isFinite(d) && d !== 0;
        });
        // ¿Ya se renderizó adentro de RoundingRow? Sí cuando hay component
        // ROUNDING_MONETARY en algún grupo.
        const hasRoundingMonetaryComponent = filteredGroups.some((g) =>
          g.components.some((c) => c.type === "ROUNDING_MONETARY"),
        );
        if (!hasPhysicalDelta || hasRoundingMonetaryComponent) return null;
        return (
          <section
            className="mt-1 border-t border-border/15 pt-2"
            data-testid="total-card-rounding-physical-section"
          >
            <div className="flex flex-col gap-0 mb-1">
              <span className={vt.text.label}>Redondeo financiero</span>
              <span className="text-[10px] text-muted/65 leading-tight">
                Después de impuestos · Metal físico
              </span>
            </div>
            <RoundingPhysicalBreakdownRows
              metals={physicalMetals}
              displayCurrency={displayCurrency}
            />
          </section>
        );
      })()}

      {/* F1 — Bloque del REDONDEO COMERCIAL PHYSICAL (passthrough por línea).
          Vive paralelo al bloque financiero: cuando ambos están activos, el
          operador ve ambos con su origen claramente etiquetado. Reutiliza
          RoundingPhysicalBreakdownRows; cada entry conserva preGrams/postGrams/
          equivalente del backend (cero matemática frontend).

          Etapa UX-Auditable (2026-05-29) — guard anti-duplicación: si el
          motor ya emitió un component `ROUNDING_MONETARY` (= el mismo delta
          monetario visible adentro de `RoundingRow` agrupado), suprimimos
          este bloque para evitar que el mismo importe aparezca dos veces.
          Mismo patrón que el guard del bloque financiero (I2) más arriba. */}
      {(() => {
        const list = (commercialPhysicalMetals ?? []).filter(
          (m): m is NonNullable<typeof m> => {
            if (m == null) return false;
            const d = m.deltaGrams;
            return typeof d === "number" && Number.isFinite(d) && d !== 0;
          },
        );
        if (list.length === 0) return null;
        // Etapa UX-Auditable — anti-duplicación.
        const hasRoundingMonetaryComponent = filteredGroups.some((g) =>
          g.components.some((c) => c.type === "ROUNDING_MONETARY"),
        );
        if (hasRoundingMonetaryComponent) return null;
        return (
          <section
            className="mt-1 border-t border-border/15 pt-2"
            data-testid="total-card-rounding-commercial-physical-section"
          >
            <div className="flex flex-col gap-0 mb-1">
              <span className={vt.text.label}>Redondeo comercial</span>
              <span className="text-[10px] text-muted/65 leading-tight">
                Por línea · Metal físico (POLICY §R-Rounding-14)
              </span>
            </div>
            <RoundingPhysicalBreakdownRows
              metals={list}
              displayCurrency={displayCurrency}
            />
          </section>
        );
      })()}

      {/* Etapa UX-Auditable (2026-05-29) — "Resultado monetario" eliminado.
          Auditoría 2026-05-29 demostró que `monetaryBalance.amount` se calcula
          como `total − Σ metalSale` (lado venta con margen), lo cual:
            · NO cumple POLICY §R-Rounding-14 (metal = físico, no lado venta)
            · NO responde un caso operativo real de joyería
            · Convive con "Saldo monetario" del header (canónico, =
              total − Σ valuationMonetary) generando ambigüedad
          El passthrough `monetaryResult` queda en el API por back-compat con
          callers — simplemente no se renderiza. */}

      {/* Etapa UX-Auditable (2026-05-29) — fila final "TOTAL A COBRAR EN $".
          Cierre del detalle financiero. Regla 7 (auditabilidad): este monto
          DEBE coincidir EXACTAMENTE con la Σ de las filas visibles arriba
          (Hechura + Metal margen + IVA + Redondeo + Canal + Cupón + Pago +
          Envío + Ajuste manual, según apliquen).
          Source: `totalDocument − metalsValuationSum` (Saldo monetario
          canónico del header). El backend garantiza que
          Σ monetaryBalance.components[] == (total − Σ valuationMonetary)
          vía `buildDocumentMonetaryComponentsFromTotals` ampliado con
          METAL_MARGIN + MANUAL_ADJUSTMENT. Solo se renderiza en BREAKDOWN
          (cuando el caller pasa `metalsValuationSum` no-nulo). */}
      {hasTotalDocument
        && typeof metalsValuationSum === "number"
        && Number.isFinite(metalsValuationSum) && (() => {
          const totalACobrar = (totalDocument as number) - metalsValuationSum;
          return (
            <div
              className={`${vt.row.flexCenter} ${vt.card.totalAccent} !py-2 mt-1`}
              data-testid="total-card-monetary-total-a-cobrar"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-text inline-flex items-center">
                Total a cobrar en $
                {/* UX.33-final — desglose calculadora: cada component visible
                    con su signo + Total. Sin texto narrativo. */}
                <OriginTooltip
                  title="Total a cobrar en $"
                  body={(() => {
                    if (!displayCurrency) return null;
                    // Map type → grupo de signo: muestra el monto tal como
                    // viene del backend (con su signo nativo).
                    return (
                      <>
                        {filteredGroups.flatMap((g) => g.components).map((c, idx) => (
                          <TooltipRow
                            key={`tac-${c.type}-${idx}`}
                            label={c.label}
                            amount={c.amount}
                            currency={displayCurrency}
                          />
                        ))}
                        <TooltipDivider />
                        <TooltipRow
                          label="Total"
                          amount={totalACobrar}
                          currency={displayCurrency}
                          bold
                        />
                      </>
                    );
                  })()}
                />
              </span>
              <span
                className={`${vt.text.rowAmount} font-bold ${vt.colors.text}`}
                data-testid="total-card-monetary-total-a-cobrar-amount"
              >
                {displayCurrency ? `${displayCurrency} ` : ""}
                {formatByType(totalACobrar, "MONEY")}
              </span>
            </div>
          );
        })()}
    </div>
  );
}

export default MonetarySummary;
