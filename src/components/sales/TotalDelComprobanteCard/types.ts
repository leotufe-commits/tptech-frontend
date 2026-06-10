// src/components/sales/TotalDelComprobanteCard/types.ts
// =============================================================================
// Etapa B — Tipos del card maestro "Total del comprobante".
//
// Cero lógica. Solo shapes.
// =============================================================================

import type { BalanceBreakdownDTO } from "../../../services/sales";

/** Modo de saldo resuelto por el backend. */
export type BalanceMode = "UNIFIED" | "BREAKDOWN";

/** Ítem normalizado del bloque METALES del card maestro. Se consume desde
 *  `MetalsSummary`; el orchestrator se encarga de hidratarlo a partir de la
 *  mejor fuente disponible (BREAKDOWN: `balanceBreakdown.metals[]`; UNIFIED
 *  o fallback: derivado de `lines[*].composition.metals[]` consolidado por
 *  metal PADRE vía `buildMetalParentTotals`). */
export interface DocumentMetalSummaryItem {
  /** Key estable (metalParentId del backend o slug del nombre). */
  id:    string;
  /** Nombre del metal PADRE (ej. "Oro", "Plata"). Nunca variante. */
  name:  string;
  /** Gramos consolidados LADO VENTA (= Σ `gramsEquivLine` del helper canónico
   *  `buildMetalParentSaleLines`, ya con merma × pureza × `metalSaleFactor`
   *  × `quantity`). Paridad EXACTA con el mini desglose por línea — si una
   *  línea muestra "Oro Fino 1,526 gr", el documento muestra Σ de esos
   *  números. NUNCA gramos puros / sin margen / lado costo. */
  grams: number;
  /** Etapa 2D — gramos de DISPLAY (lado venta / comercial consolidado, =
   *  `gramsEquivLine` de `deriveDocumentMetalsFromLines`). Es lo que el OPERADOR
   *  ve en el card de línea. SOLO para display del bloque METALES del footer —
   *  garantiza paridad Card↔Footer. NUNCA para ajuste manual, cuenta corriente
   *  metálica ni redondeo físico, que SIEMPRE usan `grams` (físico `gramsPure`).
   *  Cuando falta, el render cae a `grams` (degradación segura). */
  displayGrams?: number;
  /** Importe monetario del metal en moneda del documento (Σ `saleAmountLine`
   *  por padre). `null` cuando ningún cost-line emitió `lineSale` (snapshot
   *  legacy). Display referencial — el caller lo renderiza como sub-línea
   *  secundaria; en BREAKDOWN no se mezcla con el saldo monetario. */
  monetaryAmount?: number | null;
  /** Etapa UX-Saldo — IDs de las líneas del documento que aportaron a este
   *  metal padre. Passthrough EXACTO de
   *  `balanceBreakdown.metals[i].sourceLineIds`. Permite que `MetalsSummary`
   *  muestre el origen ("1 línea — Anillo Solitario Brillante" o lista de
   *  artículos cuando son varias). Display-only — no participa de cálculos.
   *  Cuando falta (rama legacy / sin balance), MetalsSummary omite el origen. */
  sourceLineIds?: ReadonlyArray<string>;
}

/** Props del orchestrator. Todo es passthrough — el card NO calcula. */
export interface TotalDelComprobanteCardProps {
  /** Total final del documento (en moneda del documento). Passthrough del
   *  preview. */
  totalDocument:    number;
  /** Code de la moneda del documento (display). */
  currencyCode?:    string;

  /** Modo de balance resuelto por el backend en este preview. */
  balanceMode?:     BalanceMode;
  /** Origen de la resolución del modo (DOCUMENT_OVERRIDE / ENTITY_DEFAULT /
   *  PRICELIST_DEFAULT / TENANT_DEFAULT / FALLBACK_UNIFIED). */
  balanceModeSource?: string;
  /** Breakdown canónico — alimenta el desglose monetario y los metales. */
  balanceBreakdown?: BalanceBreakdownDTO | null;

  /** Override actual del documento. `null` = automático. */
  balanceModeOverride?: BalanceMode | null;
  /** Callback al cambiar el override. */
  onBalanceModeOverrideChange: (next: BalanceMode | null) => void;
  /** Si la edición del override está deshabilitada (ej. venta confirmada). */
  overrideDisabled?: boolean;

  /** Nombre del canal de venta aplicado (para el subheader contextual). */
  channelName?:     string | null;
  /** Nombre de la lista de precios aplicada (subheader opcional). */
  priceListName?:   string | null;

  /** Aviso UI (2026-06-03) — el comprobante usa MÚLTIPLES listas de precios
   *  (preview `appliedPriceListId === "MIXED"`). Cuando es `true`, el motor
   *  entró en `MIXED_LIST_FALLBACK`: el redondeo comercial PER_DOCUMENT se
   *  desactiva y cada línea conserva su lógica comercial por lista. El card
   *  muestra un aviso informativo — NO cambia ningún cálculo ni total.
   *  Passthrough puro: el caller lo deriva de `appliedPriceListId === "MIXED"`. */
  priceListMixed?:  boolean;

  /** Etapa UX-Saldo — mapa `lineId → nombre del artículo` para que
   *  `MetalsSummary` muestre el "Origen" de cada metal padre (lookup contra
   *  `DocumentMetalSummaryItem.sourceLineIds`). El caller (`VentasFacturas`)
   *  lo arma desde `preview.result.lines[]` mapeando `line.id → articleName`.
   *  Si falta o no hay match, la sub-fila de origen se omite (degradación). */
  lineArticleNames?: Readonly<Record<string, string>>;

  /** Etapa UX-Comercial (2026-05-30 — POLICY §R-Rounding-16) —
   *  Valor COMERCIAL del metal (Σ `documentTotals.metalCostSubtotal`).
   *  Cuando se provee y `balanceMode === "BREAKDOWN"`:
   *    · "Patrimonio Metálico" muestra este valor agregado al pie del bloque
   *      (en lugar del `valuationMonetary` físico canónico por padre).
   *    · "Saldo Monetario" del header se calcula como
   *      `totalDocument − commercialMetalValueSum` (en lugar de
   *      `totalDocument − Σ valuationMonetary`).
   *  Resultado: Patrimonio + Saldo = Total exactamente, sin METAL_MARGIN
   *  visible en el detalle (queda absorbido en el Patrimonio comercial).
   *  Cuando falta o es null, el card vuelve al comportamiento canónico
   *  POLICY §R-Rounding-14 (Patrimonio = valor físico, METAL_MARGIN visible). */
  commercialMetalValueSum?: number | null;

  /** Etapa UX.32 (2026-05-30) — Valor COMERCIAL por metal padre (desglose
   *  del agregado `commercialMetalValueSum`). Derivado desde
   *  `composition.metals[i].lineCost × line.quantity` agregado por
   *  `metalName` (helper `buildCommercialMetalValueByParent`). Cero
   *  matemática nueva — agregación pura de un campo del motor.
   *
   *  Invariante verificado E2E (qty=1, 3, 7):
   *    Σ valores del mapa === commercialMetalValueSum === documentTotals.metalCostSubtotal
   *
   *  Cuando se provee, `MetalsSummary` muestra una sub-fila terciaria
   *  "Valor comercial: ARS X" debajo de cada metal padre y mueve el TOTAL
   *  agregado al header del bloque "METALES … ARS Y" (eliminando la fila
   *  legacy "Valor comercial del metal" al pie). */
  commercialMetalValueByParent?: Readonly<Record<string, number>>;

  /** Fase 1 (2026-06) — Valor de VENTA del metal por padre (con margen).
   *  `Record<metalName, monto>` derivado por el caller con
   *  `buildMetalSaleByParent` (= Σ `saleAmountLine` = `metalSale` del motor,
   *  misma fuente que `documentMetals`). Cuando se provee, el bloque METALES
   *  lo prioriza sobre `commercialMetalValueByParent` (COSTO) para el display
   *  y para la deducción del saldo — así el cierre usa el MISMO valor (venta)
   *  que se muestra, sin doble margen en PER_LINE/MIXED. Cuando falta o es `{}`
   *  (snapshot legacy / sin líneas / `balanceBreakdown`), el card degrada a
   *  COSTO (fallback) sin romper esos paths. Passthrough puro — el card no
   *  recalcula. */
  metalSaleByParent?: Readonly<Record<string, number>>;

  /** Fix listas mixtas (2026-06) — Valor de venta del metal por padre
   *  PRE-redondeo comercial (Σ `saleAmountLinePre` = el "Valor comercial" del
   *  card). El footer lo usa como BASE de la consolidación del metal en lugar de
   *  `metalSaleByParent` (POST), para que `valor final = base + redondeo` NO
   *  duplique el redondeo en listas que lo aplican por línea (MIXED). Cuando
   *  falta, el card cae a `metalSaleByParent` (back-compat). Passthrough puro. */
  metalSalePreByParent?: Readonly<Record<string, number>>;

  /** SSOT card ↔ footer (2026-06) — Gramo PRINCIPAL de METALES por metal padre,
   *  consolidado del MISMO dato visible que el card del artículo (Σ
   *  `lineCommercialSummary.metals.byParent[].visibleGrams` ?? `gramsEquivLine`).
   *  El caller lo computa con `buildVisibleGramsByParent(lines)`. Cuando se
   *  provee, el bloque METALES usa ESTE gramo como protagonista (override de
   *  `displayGrams`) en lugar de `saleEquivGr`/`displayGrams` — así card y footer
   *  muestran EXACTAMENTE el mismo gramo. NO toca el físico `grams` (cuenta
   *  corriente / sub-filas físicas / tooltips lo siguen usando). Cuando falta,
   *  el card cae a `displayGrams` (back-compat). Passthrough puro. */
  metalVisibleGramsByParent?: Readonly<Record<string, number>>;

  /** FASE 1 — Footer "Monetario (saldo)" (2026-06-03). Σ de
   *  `lineCommercialSummary.monetary.amount` por línea (el MISMO "MONETARIO"
   *  que muestra el Resumen Comercial de cada línea). El caller lo computa con
   *  `sumLineCommercialMonetary(lines)`. Cuando se provee y el modo es
   *  BREAKDOWN, el header "Monetario (saldo)" usa ESTE valor (paridad
   *  línea↔footer) en lugar del cálculo legacy `total − metales`. `null` ⇒
   *  fallback legacy (back-compat). Passthrough puro — el card no recalcula. */
  commercialMonetarySaldoSum?: number | null;

  /** Impacto del redondeo comercial MONETARIO del comprobante. Σ de
   *  `lineCommercialSummary.monetary.roundingImpact` por línea (mismo contrato
   *  por línea que `commercialMonetarySaldoSum`). El caller lo computa con
   *  `sumLineCommercialMonetaryRoundingImpact(lines)`. Cuando es != 0, el
   *  header "Monetario (saldo)" muestra el desglose
   *  Valor comercial → Redondeo comercial → Valor redondeado (mismo patrón que
   *  el bloque de metal). En listas UNIFICADAS el contrato trae 0 (el redondeo
   *  ya está embebido en el total) ⇒ no se muestra la fila. `null`/`0` ⇒ no se
   *  renderiza el desglose. Passthrough puro — el card no recalcula. */
  commercialMonetaryRoundingImpactSum?: number | null;

  /** Impacto del redondeo comercial del METAL consolidado por líneas. Σ de
   *  `lineCommercialSummary.metals.byParent[].roundingImpact` (fallback
   *  `metalRoundingMonetaryImpact`). El caller lo computa con
   *  `sumLineCommercialMetalRoundingImpact(lines)`. Alimenta el bloque
   *  "REDONDEOS COMERCIALES" (fila Metal) en documentos MIXED, cuando
   *  `commercialDocumentRoundingSnapshot` es null. `null` ⇒ sin aporte de
   *  metal. Passthrough puro. */
  commercialMetalRoundingImpactSum?: number | null;

  /** Mapa `metalParentName → Σ impacto $ redondeo comercial` por línea.
   *  El caller lo computa con `groupLineCommercialMetalRoundingByParent(lines)`.
   *  Alimenta la Opción 1 de METALES (Redondeo comercial + Valor final por
   *  metal) en documentos MIXED, cuando no hay snapshot document-level.
   *  `undefined` ⇒ sin aporte (las filas se omiten). Passthrough puro. */
  commercialRoundingByParentFromLines?: Readonly<Record<string, number>>;

  /** Resumen de metales padres del comprobante. Cuando el modo es UNIFIED el
   *  backend NO popula `balanceBreakdown.metals[]`, pero el operador igual
   *  necesita ver el patrimonio en metales — el caller deriva esta lista
   *  desde `lines[*].composition.metals[]` usando `buildMetalParentTotals`
   *  (helper canónico ya compartido con el Simulador). En BREAKDOWN, el
   *  card prefiere `balanceBreakdown.metals[]` (autoridad del backend). */
  documentMetals?:  DocumentMetalSummaryItem[];

  /** Líneas del preview para derivar el bucket HECHURA puro del documento
   *  cuando el backend no popula `balanceBreakdown.monetaryBalance.components[]`
   *  con `group="HECHURA"`. El helper `resolveMonetaryHeaderAmount` recurre
   *  a Σ `lines[i].metalHechuraBreakdown.hechuraSale × quantity` como
   *  fallback secundario (paridad línea↔documento, passthrough puro del
   *  campo emitido por el motor). Solo se usa en BREAKDOWN. */
  hechuraLines?: ReadonlyArray<{
    quantity?: number | null;
    metalHechuraBreakdown?: { hechuraSale?: number | null } | null;
  } | null | undefined>;

  /** Passthrough EXACTO de `documentTotals.subtotalAfterLineDiscounts`
   *  (backend). Se usa para mostrar la fila síntesis "Subtotal comercial"
   *  al cierre de la sección "Construcción comercial". `null`/undefined →
   *  el card omite esa fila (degradación segura para callers viejos). */
  subtotalCommercial?: number | null;

  /** Passthrough EXACTO de `documentTotals.taxableBase` (backend).
   *  Se usa para mostrar la fila "BASE IMPONIBLE" destacada después de los
   *  ajustes de cabecera (canal/cupón/bonificación global). Refleja sobre
   *  qué monto el motor calculó los impuestos. `null`/undefined → la fila
   *  se omite. POLICY §Tax.1 paso 11. */
  taxableBase?: number | null;

  /** Passthrough EXACTO de `documentTotals.documentRoundingApplied` (Etapa 1B).
   *
   *  Determina cómo el card renderiza el component ROUNDING_MONETARY del
   *  `monetaryBalance.components[]`:
   *    · `!= null` → existe política de redondeo del COMPROBANTE activa.
   *       El delta modifica `documentTotals.total`. Se renderiza como
   *       "Redondeo del comprobante" prominente, con caption del scope.
   *    · `null` (y aún así viene un component ROUNDING_MONETARY del
   *       breakdown) → el delta proviene de la LISTA DE PRECIOS (ya
   *       absorbido en `lineTotal` de cada línea). Se renderiza como
   *       "Redondeo de lista" secundario, con caption "Ya incluido en el
   *       subtotal" — evita la confusión visual del operador que asumía
   *       que era un ajuste pendiente.
   *
   *  POLICY §R-Rounding-1 (separación oficial lista vs comprobante). */
  documentRoundingApplied?: {
    scope?:           "UNIFIED" | "BREAKDOWN" | "BOTH" | string;
    totalAdjustment?: number;
    unified?:         { mode?: string; direction?: string; adjustment?: number } | null;
    breakdown?:       {
      metal?:   { mode?: string; direction?: string; adjustment?: number } | null;
      hechura?: { mode?: string; direction?: string; adjustment?: number } | null;
      /** Etapa D — dominio del metal en BREAKDOWN. `"PHYSICAL"` indica que
       *  la capa 16 (`applyDocumentPhysicalRounding`) actuó: los gramos por
       *  metal padre fueron redondeados y `balanceBreakdown.metals[i].gramsPure`
       *  refleja `postGrams`. Cuando este flag está activo, el card debe
       *  preferir `balanceBreakdown.metals[]` sobre `documentMetals`. */
      metalDomain?:   "MONETARY" | "PHYSICAL" | string | null;
      /** Etapa D — snapshot por metal padre del redondeo físico (Δgramos +
       *  equivalente monetario). Display-only en el card; sirve para
       *  detectar actividad de la capa 16. */
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
    /** Etapa D — bloque universal de totales del redondeo (capa 15 monetario
     *  + capa 16 metal físico). Cuando hay capa 16 activa,
     *  `metalMonetaryEquivalent ≠ 0`. */
    totals?: {
      monetaryRoundingAdjustment?: number;
      metalMonetaryEquivalent?:    number;
      totalRoundingAdjustment?:    number;
    } | null;
    fallback?: string | null;
  } | null;

  /** Total emitido por el motor (pre-ajuste manual). POLICY §R-Rounding-6.
   *  Cuando hay ajuste manual, se renderiza el bloque "TPTech calculó X /
   *  Ajuste manual Y / Total final Z" mostrando este número como "calculó". */
  engineTotal?: number | null;

  /** Snapshot del ajuste manual devuelto por el preview/confirm (POLICY
   *  §R-Rounding-1 capa 17). UNIFIED (Etapa A) o BREAKDOWN (Etapa C). Si
   *  `null`, el bloque "Ajuste manual" solo muestra el editor.
   *  @deprecated Usar `manualAdjustmentSnapshot` (top-level canónico
   *  alineado con `Sale.manualAdjustmentSnapshot` en DB). Mantenido como
   *  alias durante la migración del frontend. */
  manualAdjustment?: import("../../../services/sales").ManualAdjustmentApiSnapshot | null;

  // ── Etapa 3A — campos canónicos top-level (paridad con backend Etapa 1+2) ─
  /** Snapshot canónico del ajuste manual. Si llega, el orchestrator lo
   *  prefiere sobre el alias deprecated `manualAdjustment`. Mismo shape. */
  manualAdjustmentSnapshot?: import("../../../services/sales").ManualAdjustmentApiSnapshot | null;
  /** Snapshot canónico del redondeo automático del documento (top-level).
   *  Si llega, el orchestrator lo prefiere sobre el legacy
   *  `documentRoundingApplied` (que es la MISMA referencia). */
  documentRoundingSnapshot?: TotalDelComprobanteCardProps["documentRoundingApplied"];

  /** Etapa D' — Snapshot del REDONDEO COMERCIAL PER_DOCUMENT (capa nueva
   *  post-tax, pre-shipping/payment del motor). Distinto del financiero
   *  (`documentRoundingSnapshot`) y del comercial PER_LINE legacy. Cuando
   *  llega, el card muestra una sub-sección informativa con el detalle
   *  del bucket hechura/saldo monetario (`pre → post`, `delta`) y, si la
   *  config redondea metal físico, también los gramos por metal padre.
   *  null cuando la lista del documento operó en PER_LINE_LEGACY o
   *  MIXED_LIST_FALLBACK. PURA LECTURA — el frontend no recalcula nada,
   *  solo muestra el snapshot canónico tal como vino del backend. */
  commercialDocumentRoundingSnapshot?: {
    source: "PRICE_LIST";
    scope:  "UNIFIED" | "BREAKDOWN";
    totalAdjustment: number;
    unified?: {
      pre:        number;
      post:       number;
      adjustment: number;
      mode:       string;
      direction:  string;
    };
    breakdown?: {
      metals: ReadonlyArray<{
        metalParentId:      string;
        metalParentName:    string;
        preGrams:           number;
        postGrams:          number;
        deltaGrams:         number;
        metalPricePerGram:  number;
        monetaryEquivalent: number;
        mode:               string;
        direction:          string;
      }>;
      metalMonetaryEquivalent: number;
      hechura: {
        preRoundingSaldoMonetario:  number;
        postRoundingSaldoMonetario: number;
        deltaSaldoMonetario:        number;
        mode:                       string;
        direction:                  string;
        source:                     "PRICE_LIST_HECHURA";
      };
      combinedAdjustment: number;
    };
    fallback?: "ALL_NONE" | "NO_METALS_BREAKDOWN_DATA" | "NO_SHARED_LIST" | null;
  } | null;

  /** F1 — Snapshots del redondeo COMERCIAL PHYSICAL aplanados por línea.
   *  El caller (`VentasFacturas`) hace flatMap puro de
   *  `lines[i].appliedRounding.physical.metals[*]` sin sumar/multiplicar.
   *  Cada entry conserva su `preGrams/postGrams/deltaGrams/metalPricePerGram/
   *  monetaryEquivalent` intacto desde el backend.
   *  Distinto a `documentRoundingSnapshot.breakdown.metalPhysical` que es el
   *  redondeo FINANCIERO (capa 16 del tenant). Si ambos están activos, los
   *  dos bloques se muestran lado a lado en MonetarySummary.
   *
   *  `quantity` (opcional): cantidad de la LÍNEA de origen. El backend emite
   *  `postGrams` POR UNIDAD; al agregar por metal padre para el patrimonio
   *  total del documento, el helper multiplica `postGrams × quantity`. Si
   *  falta o no es finita, se asume `1` (back-compat con callers que aún no
   *  propagan la cantidad). */
  commercialPhysicalRoundedMetals?: ReadonlyArray<{
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
    quantity?:          number | null;
  } | null | undefined>;

  /** Intención del operador en el DRAFT (UNIFIED o BREAKDOWN). Se vuelca
   *  al payload de preview. Si es `null`, no hay ajuste activo. */
  manualAdjustmentDraft?:
    | { scope?: "UNIFIED"; amount: number; reason?: string | null }
    | {
        scope: "BREAKDOWN";
        metals?: Array<{
          metalParentId: string | null;
          metalParentName?: string;
          targetGrams?: number | null;
          deltaGrams?: number | null;
          reason?: string | null;
        }>;
        monetaryAmount?: number | null;
        reason?: string | null;
      }
    | null;

  /** Callback al editar el ajuste manual. El operador escribe monto / gramos
   *  / motivo; el caller actualiza el draft y dispara preview. Si no se
   *  provee, el editor queda oculto. */
  onManualAdjustmentChange?: (
    next:
      | { scope?: "UNIFIED"; amount: number; reason?: string | null }
      | {
          scope: "BREAKDOWN";
          metals?: Array<{
            metalParentId: string | null;
            metalParentName?: string;
            targetGrams?: number | null;
            deltaGrams?: number | null;
            reason?: string | null;
          }>;
          monetaryAmount?: number | null;
          reason?: string | null;
        }
      | null,
  ) => void;

  /** Deshabilita el editor (ej. venta CONFIRMED). El snapshot ya congelado
   *  se sigue renderizando como display. */
  manualAdjustmentDisabled?: boolean;

  /** Trazabilidad de auditoría por `type` de componente monetario (cupón,
   *  canal, IVA, envío, descuento/bonificación global, promociones, redondeo
   *  financiero, ajuste manual). El caller la arma con `buildComponentTraces`
   *  desde el preview + draft. Cuando existe un trace para una fila del
   *  desglose, su tooltip ⓘ reconstruye la cuenta completa (Origen · Base ×
   *  regla · Impacto); si falta, la fila cae al tooltip minimalista legacy.
   *  Passthrough puro — el card no calcula nada. */
  componentTraces?: Readonly<Record<string, import("./traceability").ComponentTrace>>;

  /** Clase CSS adicional para el contenedor exterior. */
  className?:       string;

  /** Refinamiento Fase A — política comercial.
   *  Resumen consolidado del estado comercial del comprobante. El card
   *  renderiza al pie un bloque con el estado (chip + texto) para que el
   *  operador lo vea junto al Total al momento de cerrar la venta.
   *  Passthrough — la agregación la hace el caller con
   *  `aggregateDocumentStatus(matchedNormalized)`. Si no se provee o
   *  `evaluated === 0`, el bloque no se renderiza. */
  commercialStatus?: {
    ok:       number;
    warning:  number;
    risk:     number;
    critical: number;
    evaluated: number;
    worst:    "OK" | "WARNING" | "RISK" | "CRITICAL";
  };
}
