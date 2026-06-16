// src/components/sales/TotalDelComprobanteCard/parts/MetalsSummary.tsx
// =============================================================================
// Etapa UX.8 — Sección "Metales" del card maestro (modo BREAKDOWN).
//
// Render premium: los metales son PATRIMONIO del comprobante, no una fila
// técnica. Cada fila respira; nombre en peso medium, gramos en tabular-nums
// jerárquicos, sufijo "gr" sutil. Sin íconos, sin cards anidadas, sin
// gradients — minimalismo joyería.
//
// I1 — Cuando el redondeo financiero PHYSICAL (capa 16) actuó sobre un metal,
// agregamos una sub-fila con la transformación canónica:
//   "Oro Fino · 1,526 g → 2,000 g · ARS 100/g     +ARS 47.400"
// Mismo patrón visual que ManualAdjustmentSection / BreakdownSnapshotRows
// (referencia canónica del DESGLOSADO físico). Cero matemática local — el
// detalle viene de documentRoundingSnapshot.breakdown.metalPhysical.metals[].
//
// READ-ONLY. Cero matemática. Sin labels técnicos (`metalBalance` /
// `monetaryBalance` / nombres internos del DTO).
// =============================================================================

import type { ReactElement } from "react";
import { formatByType } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import { OriginTooltip } from "./OriginTooltip";
import type { DocumentMetalSummaryItem } from "../types";
import type { MetalFinalRow, MetalPhysicalImpactDetail } from "../helpers";

/** Subset del snapshot del redondeo físico de UN metal padre. Passthrough
 *  EXACTO de `documentRoundingSnapshot.breakdown.metalPhysical.metals[i]`. */
export interface MetalPhysicalRoundingDetail {
  metalParentId?:     string | null;
  metalParentName?:   string;
  preGrams?:          number;
  postGrams?:         number;
  deltaGrams?:        number | null;
  metalPricePerGram?: number;
  monetaryEquivalent?: number;
}

export interface MetalsSummaryProps {
  metals: ReadonlyArray<DocumentMetalSummaryItem>;
  /** Code de la moneda del documento — se prepende al monto monetario del
   *  metal (sub-línea secundaria). Cuando falta, el monto se omite. */
  currencyCode?: string;
  /** I1 — Snapshots de capa 16 PHYSICAL por metal padre. El componente
   *  buscará match por `metalParentId` o `metalParentName` con cada fila de
   *  `metals` y mostrará la sub-fila pre→post + equivalente. Si no llega o
   *  está vacío, las filas no muestran el detalle (degradación segura). */
  physicalRoundedMetals?: ReadonlyArray<MetalPhysicalRoundingDetail | null | undefined>;
  /** Etapa UX-Saldo — mapa `lineId → nombre del artículo` para resolver el
   *  "Origen" del metal. Cuando un metal padre tiene `sourceLineIds`, el
   *  componente lista los artículos correspondientes ("1 línea — Anillo
   *  Solitario Brillante" o "Origen: A, B, C" cuando son varios). Cuando
   *  falta o no hay match, omite la sub-fila (degradación segura). */
  lineArticleNames?: Readonly<Record<string, string>>;
  /** Etapa UX.32 (2026-05-30) — Valor COMERCIAL POR metal padre.
   *  Mapa `metalName → monto` derivado del caller mediante
   *  `buildCommercialMetalValueByParent` (agregación pura de
   *  `composition.metals[i].lineCost × line.quantity`).
   *
   *  Cuando se provee, el componente renderiza una sub-fila terciaria
   *  "Valor comercial: ARS X" debajo de cada metal padre (look secundario,
   *  no compite con el Total ni con el Saldo monetario).
   *
   *  Invariante: Σ valores del mapa === el agregado del header del bloque
   *  (= `commercialMetalValueSum` del orchestrator). Si no coincide es BUG
   *  de derivación en el caller. */
  commercialMetalValueByParent?: Readonly<Record<string, number>>;
  /** Opción 1 (2026-06) — impacto $ del REDONDEO COMERCIAL por metal padre.
   *  Mapa `metalName → monetaryEquivalent` derivado por el caller desde
   *  `commercialDocumentRoundingSnapshot.breakdown.metals[]`. Passthrough puro:
   *  el componente compone "Valor final = Valor comercial + Redondeo" SIN
   *  recalcular el redondeo (los dos sumandos ya vienen finales del backend).
   *  Cuando falta (UNIFIED / sin snapshot / delta ~0) no se muestran las
   *  sub-filas y el bloque queda idéntico al previo (degradación segura). */
  commercialRoundingByParent?: Readonly<Record<string, number>>;
  /** Etapa 2C — composición FINAL por metal padre (DESGLOSADO). Cuando llega
   *  una fila para un metal, ES LA FUENTE CANÓNICA del display: se renderiza
   *  Valor comercial · Redondeo comercial · Redondeo financiero · Ajuste manual
   *  · Valor final metal, y se SUPRIMEN los bloques legacy
   *  (`commercialMetalValueByParent` / `commercialRoundingByParent` /
   *  `physicalRoundedMetals`) para ese metal — evita doble render. Cuando NO
   *  llega (UNIFICADO / callers viejos), el componente cae al comportamiento
   *  previo (degradación segura). Todos los montos son passthrough del backend. */
  finalRows?: ReadonlyArray<MetalFinalRow>;
  /** Aceptado por back-compat; ya NO se consume (el tooltip de metales muestra
   *  la cuenta + artículos de origen, no el nombre de lista). */
  priceListName?: string | null;
}

/** Match por id (prioridad) o nombre normalizado. Cero matemática — solo
 *  selección de objeto. */
function findPhysicalDetail(
  item: DocumentMetalSummaryItem,
  pool: ReadonlyArray<MetalPhysicalRoundingDetail | null | undefined> | undefined,
): MetalPhysicalRoundingDetail | undefined {
  if (!pool || pool.length === 0) return undefined;
  const itemId   = item.id ?? "";
  const itemName = (item.name ?? "").trim().toLowerCase();
  for (const entry of pool) {
    if (!entry) continue;
    if (entry.metalParentId != null && itemId.length > 0 && entry.metalParentId === itemId) {
      return entry;
    }
    const name = (entry.metalParentName ?? "").trim().toLowerCase();
    if (name.length > 0 && name === itemName) {
      return entry;
    }
  }
  return undefined;
}

function hasPhysicalDelta(d: MetalPhysicalRoundingDetail | undefined): boolean {
  if (!d) return false;
  const delta = d.deltaGrams;
  return typeof delta === "number" && Number.isFinite(delta) && delta !== 0;
}

/** Resuelve los nombres únicos de artículos para los `sourceLineIds` de un
 *  metal padre. Display puro — devuelve la lista en el orden de aparición
 *  con duplicados eliminados. Si `lineArticleNames` falta o ningún id
 *  matchea, devuelve `[]`. */
function resolveOriginArticleNames(
  sourceLineIds: ReadonlyArray<string> | undefined,
  lineArticleNames: Readonly<Record<string, string>> | undefined,
): string[] {
  if (!sourceLineIds || sourceLineIds.length === 0) return [];
  if (!lineArticleNames) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of sourceLineIds) {
    const name = lineArticleNames[id];
    if (!name || typeof name !== "string") continue;
    const trimmed = name.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/** Busca la fila final (Etapa 2C) de un metal por id (canónico) o nombre. */
function findFinalRow(
  item: DocumentMetalSummaryItem,
  rows: ReadonlyArray<MetalFinalRow> | undefined,
): MetalFinalRow | undefined {
  if (!rows || rows.length === 0) return undefined;
  const id = item.id ?? "";
  const nameNorm = (item.name ?? "").trim().toLowerCase();
  for (const r of rows) {
    if (r.metalParentId != null && id.length > 0 && r.metalParentId === id) return r;
  }
  for (const r of rows) {
    if ((r.metalParentName ?? "").trim().toLowerCase() === nameNorm) return r;
  }
  return undefined;
}

export function MetalsSummary({
  metals,
  currencyCode,
  physicalRoundedMetals,
  lineArticleNames,
  commercialMetalValueByParent,
  commercialRoundingByParent,
  finalRows,
}: MetalsSummaryProps): ReactElement {
  if (metals.length === 0) {
    return (
      <p
        className="text-[11px] italic text-muted/70"
        data-testid="total-card-metals-empty"
      >
        Sin metales en este comprobante.
      </p>
    );
  }
  return (
    <ul
      className="space-y-2"
      data-testid="total-card-metals"
    >
      {metals.map((m) => {
        // Etapa 2C — fila final canónica del metal (si llega). Cuando existe,
        // ES la fuente del display: suprime los bloques legacy para no duplicar.
        const fr = findFinalRow(m, finalRows);
        const physical = fr ? undefined : findPhysicalDetail(m, physicalRoundedMetals);
        const showPhysical = hasPhysicalDelta(physical);
        // Artículos que componen este metal padre (origen de la cuenta). Con
        // composición canónica (fr) se muestra en el tooltip ⓘ; sin fr (legacy)
        // cae a la sub-fila del card.
        const originNames = resolveOriginArticleNames(m.sourceLineIds, lineArticleNames);
        return (
          <li
            key={m.id}
            // Mini-bloque por metal padre — cada metal es un patrimonio propio
            // (jerarquía elevada): superficie + borde sutil en vez de la lista
            // divide-y plana. Solo presentación.
            className="rounded-lg border border-border/30 bg-surface2/25 px-3 py-2.5"
            data-testid={`total-card-metal-${m.id}`}
            data-tp-physical-rounded={showPhysical ? "true" : "false"}
          >
            {/* Fila principal: nombre del padre · gramos (primario, protagonista). */}
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base font-semibold text-text inline-flex items-center">
                {m.name}
                {/* Tooltip de trazabilidad del metal — solo cuando hay
                    composición final (DESGLOSADO con datos del backend). */}
                {fr && currencyCode && (
                  <OriginTooltip
                    title={m.name}
                    body={
                      <div className="space-y-1.5">
                        {/* LA CUENTA — protagonista del tooltip: gramos × precio/g =
                            valor. Sin Antes/Después/Impacto (redundante con la cuenta)
                            ni el nombre de lista ("Múltiples…"). */}
                        {(() => {
                          const grams = m.displayGrams ?? m.grams;
                          const cur = `${currencyCode} `;
                          return (
                            <div className="text-[13px] font-bold leading-snug text-text tabular-nums break-words">
                              {grams > 0
                                ? `${formatByType(grams, "METAL_GRAMS")} × ${cur}${formatByType(fr.baseCommercialValue / grams, "MONEY")}/g = ${cur}${formatByType(fr.baseCommercialValue, "MONEY")}`
                                : `${cur}${formatByType(fr.baseCommercialValue, "MONEY")}`}
                            </div>
                          );
                        })()}
                        {/* Origen — artículos/líneas que aportan a este metal padre. */}
                        {originNames.length > 0 && (
                          <div className="border-t border-border/30 pt-1.5">
                            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted/55">
                              {originNames.length === 1 ? "Origen" : `Origen · ${originNames.length} líneas`}
                            </div>
                            <ul className="space-y-px">
                              {originNames.map((n) => (
                                <li key={n} className="truncate text-[11px] text-muted/80">{n}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    }
                  />
                )}
              </span>
              <span className="tabular-nums">
                {/* Foco de metal por criterio único (`vt.emphasisFor`) + tamaño
                    local del footer. */}
                <span className={`${vt.emphasisFor("BREAKDOWN", "metalGrams")} text-lg`}>
                  {/* GRAMO CANÓNICO = `displayGrams` (= `gramsEquivLine` /
                      `saleEquivGr` del card del artículo: metal padre equivalente
                      con pureza + merma + margen). SSOT compartida con el
                      Simulador y el card de línea → card y footer muestran el
                      MISMO gramo. Fallback legacy: `grams` (físico) cuando el
                      caller no derivó displayGrams. Passthrough — cero recálculo,
                      sin saleValue/cotización. */}
                  {/* El preset METAL_GRAMS ya emite el sufijo " g" — no agregar
                      otro "gr" (evita el duplicado "4,59 g gr"). */}
                  {formatByType(m.displayGrams ?? m.grams, "METAL_GRAMS")}
                </span>
              </span>
            </div>
            {/* Etapa UX.30 (2026-05-30) — sub-fila con `monetaryAmount`
                (valuationMonetary físico canónico) OCULTA del render.
                Razón: confundía al operador (no es lo que paga el cliente,
                no es valor comercial, no es hechura, no es saldo). El
                "Valor comercial del metal" agregado se muestra al pie del
                bloque vía `commercialMetalValueSum` (§R-Rounding-16).
                `m.monetaryAmount` sigue disponible en el prop por back-compat
                con consumers — solo dejamos de renderizar. */}
            {/* I1 — Sub-fila del redondeo financiero PHYSICAL.
                Misma jerarquía visual que BreakdownSnapshotRows del ajuste
                manual. Passthrough EXACTO — los 5 campos vienen ya calculados
                del backend en `documentRoundingSnapshot.breakdown.metalPhysical`. */}
            {showPhysical && physical && (
              <PhysicalRoundingRow detail={physical} currencyCode={currencyCode} />
            )}
            {/* Etapa 2C — composición FINAL del metal (DESGLOSADO). Fuente
                canónica: Valor comercial · Redondeo comercial · Redondeo
                financiero · Ajuste manual · Valor final metal. Passthrough puro
                de los `monetaryEquivalent` ya emitidos por el backend. Cuando
                existe, suprime los bloques legacy de abajo (gate `!fr`). */}
            {fr && currencyCode && (
              <MetalFinalComposition row={fr} metalId={m.id} currencyCode={currencyCode} />
            )}
            {/* Etapa UX.32 (2026-05-30) — sub-fila terciaria "Valor comercial"
                por metal padre. Lookup contra `commercialMetalValueByParent`
                por `m.name` (= `metalName` con el que se agrega en el caller).
                Tipografía pequeña/secundaria para no competir con el Total ni
                con el Saldo Monetario.

                Ajuste 2026-06 — se muestra el "Valor comercial" por metal en
                TODOS los casos (incluido 1 metal). Decisión explícita del
                operador para poder auditar "Metal comercial + Hechura = Base"
                directo en cada fila. Antes (UX.32.b) se ocultaba con 1 metal
                porque duplicaba el total del header del bloque; ese total sigue
                en el header — la fila per-padre lo expone al lado de los gramos.
                Passthrough puro del campo `commercialMetalValueByParent` ya
                provisto por el caller — cero recálculo, cero margen aplicado
                en el frontend. */}
            {(() => {
              if (fr) return null; // Etapa 2C — la composición canónica ya lo cubre.
              if (!commercialMetalValueByParent || !currencyCode) return null;
              const value = commercialMetalValueByParent[m.name];
              if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
              return (
                <div
                  className="mt-0.5 flex items-baseline justify-between gap-2"
                  data-testid={`total-card-metal-${m.id}-commercial-value`}
                >
                  <span className="text-[11px] text-muted/70">
                    Valor de venta metal
                  </span>
                  <span className="tabular-nums text-[12px] font-medium text-muted/85">
                    {currencyCode} {formatByType(value, "MONEY")}
                  </span>
                </div>
              );
            })()}
            {/* Opción 1 (2026-06) — Redondeo comercial + Valor final POR metal
                padre, inmediatamente debajo de "Valor comercial". Secuencia que
                refleja el flujo mental: comercial (pre) → redondeo (delta) →
                final (post). PASSTHROUGH: el "Valor final" es la composición de
                dos valores YA finales del backend (Valor comercial + delta), no
                un recálculo del redondeo. Se omite cuando no hay delta
                significativo (UNIFIED / sin snapshot / ~0) → queda solo "Valor
                comercial", idéntico al previo. Negativos: signo − + color
                discount, NUNCA clamp. */}
            {(() => {
              if (fr) return null; // Etapa 2C — la composición canónica ya lo cubre.
              if (!commercialMetalValueByParent || !commercialRoundingByParent || !currencyCode) return null;
              const comercial = commercialMetalValueByParent[m.name];
              const delta     = commercialRoundingByParent[m.name];
              if (typeof comercial !== "number" || !Number.isFinite(comercial) || comercial <= 0) return null;
              if (typeof delta !== "number" || !Number.isFinite(delta) || Math.abs(delta) <= 0.005) return null;
              const finalValue = Math.round((comercial + delta) * 100) / 100;
              const sign = delta > 0 ? "+ " : "− ";
              return (
                <>
                  <div
                    className="mt-0.5 flex items-baseline justify-between gap-2"
                    data-testid={`total-card-metal-${m.id}-commercial-rounding`}
                  >
                    <span className="text-[11px] text-muted/70">Redondeo comercial</span>
                    <span
                      className={`tabular-nums text-[12px] font-medium ${delta < 0 ? vt.colors.discount : "text-muted/85"}`}
                    >
                      {sign}{currencyCode} {formatByType(Math.abs(delta), "MONEY")}
                    </span>
                  </div>
                  <div
                    className="mt-0.5 flex items-baseline justify-between gap-2"
                    data-testid={`total-card-metal-${m.id}-commercial-final`}
                  >
                    <span className="text-[11px] font-medium text-muted/80">Valor final metal</span>
                    <span className="tabular-nums text-[12px] font-semibold text-text">
                      {currencyCode} {formatByType(finalValue, "MONEY")}
                    </span>
                  </div>
                </>
              );
            })()}
            {/* Etapa UX-Saldo — Sub-fila "Origen". Lista los artículos que
                aportaron a este metal padre. Display puro, derivado de
                `sourceLineIds` del balance + nombres pasados por el caller.
                Se omite cuando no hay datos suficientes (degradación segura). */}
            {(() => {
              // Con composición canónica (fr) el Origen vive en el tooltip ⓘ del
              // metal (card minimalista) → no duplicar acá. Sin fr (legacy) se
              // mantiene como sub-fila del card.
              if (fr) return null;
              if (originNames.length === 0) return null;
              const count = originNames.length;
              return (
                <div
                  className="mt-0.5 text-[10px] leading-tight text-muted/70"
                  data-testid={`total-card-metal-${m.id}-origin`}
                >
                  {count === 1 ? (
                    <span>
                      <span className="uppercase tracking-wider text-muted/55 mr-1">Origen:</span>
                      1 línea — {originNames[0]}
                    </span>
                  ) : (
                    <>
                      <div className="uppercase tracking-wider text-muted/55">
                        Origen: {count} líneas
                      </div>
                      <ul className="mt-0.5 pl-3 space-y-px list-disc list-inside marker:text-muted/40">
                        {originNames.map((name) => (
                          <li key={name} className="truncate">{name}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })()}
          </li>
        );
      })}
      {/* Etapa UX.32 (2026-05-30) — fila al pie "Valor comercial del metal"
          ELIMINADA. El total comercial agregado se movió al header del
          bloque ("METALES … ARS X" — ver TotalDelComprobanteCard.tsx) y por
          padre cada metal muestra su propio "Valor comercial: ARS Y" como
          sub-fila terciaria. Resultado: Σ_padres == header del bloque
          (invariante verificado E2E con qty=1, 3, 7). */}
    </ul>
  );
}

/** Etapa 2C — Composición FINAL de UN metal padre (modo DESGLOSADO).
 *  Renderiza, en orden:
 *    Valor de venta metal ARS base
 *    Redondeo comercial   ±ARS   (si ≠ 0)
 *    Redondeo financiero  pre→post g · Δ Δg · ARS ppg/g   ±ARS equiv  (si existe)
 *    Ajuste manual        pre→post g · Δ Δg · ARS ppg/g   ±ARS equiv  (si existe)
 *    Valor final metal    ARS finalMetalValue
 *  PASSTHROUGH puro — todos los montos vienen del backend (cero recálculo,
 *  sin clamp, negativos preservados). */
function MetalFinalComposition({
  row,
  metalId,
  currencyCode,
}: {
  row:          MetalFinalRow;
  metalId:      string;
  currencyCode: string;
}): ReactElement {
  const EPS = 0.005;
  const EPS_GRAMS = 1e-9;
  const showCommercialRounding = Math.abs(row.commercialRoundingImpact) > EPS;
  // Gate del redondeo financiero físico: solo si hay impacto REAL (Δgramos o
  // equivalente monetario significativo). Evita filas ruido "1,10 → 1,10 · Δ 0".
  const showFinancial =
    !!row.financial &&
    (Math.abs(row.financial.deltaGrams) > EPS_GRAMS ||
      Math.abs(row.financial.monetaryEquivalent) > EPS);
  // Pedido UX (2026-06) — el card del metal muestra SOLO "Valor final metal";
  // las filas "Valor de venta metal" + redondeo aparecen SOLO cuando hay algún
  // ajuste (comercial / financiero / manual). Sin ajuste venta == final →
  // mostrar ambas sería redundante.
  const hasAnyAdjustment = showCommercialRounding || showFinancial || !!row.manual;
  return (
    <>
      {/* Valor de venta del metal (base, pre-redondeos) — SOLO cuando hay un
          ajuste que lo distinga del valor final. En DESGLOSADO el metal es
          patrimonio que se cobra al cliente → el label refleja "venta". */}
      {hasAnyAdjustment && (
      <div
        className="mt-0.5 flex items-baseline justify-between gap-2"
        data-testid={`total-card-metal-${metalId}-commercial-value`}
      >
        <span className="text-[11px] text-muted/70">Valor de venta metal</span>
        <span className="tabular-nums text-[12px] font-medium text-muted/85">
          {currencyCode} {formatByType(row.baseCommercialValue, "MONEY")}
        </span>
      </div>
      )}

      {/* Redondeo comercial (monetario), solo si ≠ 0. */}
      {showCommercialRounding && (
        <div
          className="mt-0.5 flex items-baseline justify-between gap-2"
          data-testid={`total-card-metal-${metalId}-commercial-rounding`}
        >
          <span className="text-[11px] text-muted/70">Redondeo comercial</span>
          <span
            className={`tabular-nums text-[12px] font-medium ${row.commercialRoundingImpact < 0 ? vt.colors.discount : "text-muted/85"}`}
          >
            {row.commercialRoundingImpact > 0 ? "+ " : "− "}{currencyCode} {formatByType(Math.abs(row.commercialRoundingImpact), "MONEY")}
          </span>
        </div>
      )}

      {/* Redondeo financiero (físico): pre→post · Δ · ppg · equivalente.
          Solo si hay impacto REAL (gate `showFinancial`). */}
      {showFinancial && row.financial && (
        <MetalPhysicalImpactRow
          label="Redondeo financiero"
          detail={row.financial}
          currencyCode={currencyCode}
          testId={`total-card-metal-${metalId}-financial`}
          metalId={metalId}
        />
      )}

      {/* Ajuste manual (físico): pre→post · Δ · ppg · equivalente. El ajuste
          es del METAL (físico) — su equivalente $ se suma al valor final, pero
          NO se mueve a hechura. */}
      {row.manual && (
        <MetalPhysicalImpactRow
          label="Ajuste manual"
          detail={row.manual}
          currencyCode={currencyCode}
          testId={`total-card-metal-${metalId}-manual`}
          metalId={metalId}
        />
      )}

      {/* Valor final metal = base + comercial + financiero + manual. */}
      <div
        className="mt-0.5 flex items-baseline justify-between gap-2"
        data-testid={`total-card-metal-${metalId}-final`}
      >
        <span className="text-[11px] font-medium text-muted/80">Valor final metal</span>
        <span
          className={`tabular-nums text-[12px] font-semibold ${row.finalMetalValue < 0 ? vt.colors.discount : "text-text"}`}
        >
          {currencyCode} {formatByType(row.finalMetalValue, "MONEY")}
        </span>
      </div>
    </>
  );
}

/** Sub-fila física de un mecanismo (redondeo financiero / ajuste manual) sobre
 *  un metal padre. Muestra `preGrams → postGrams · Δ deltaGrams · ppg/g` y el
 *  `monetaryEquivalent` a la derecha. Passthrough EXACTO — sin cálculo. */
function MetalPhysicalImpactRow({
  label,
  detail,
  currencyCode,
  testId,
  metalId,
}: {
  label:        string;
  detail:       MetalPhysicalImpactDetail;
  currencyCode: string;
  testId:       string;
  metalId:      string;
}): ReactElement {
  const ppg = Number.isFinite(detail.metalPricePerGram) ? detail.metalPricePerGram : null;
  return (
    <div
      className="mt-0.5 pl-3 border-l border-border/15 flex items-baseline justify-between gap-3 text-[11px]"
      data-testid={testId}
      data-tp-metal-id={metalId}
    >
      <span className="text-muted/80 truncate flex-1">
        <span className="text-[10px] uppercase tracking-wider text-muted/60 mr-1">{label}</span>
        <span className="tabular-nums">
          {formatByType(detail.preGrams, "METAL_GRAMS")} → {formatByType(detail.postGrams, "METAL_GRAMS")} g
        </span>
        {" · "}
        <span className="tabular-nums text-muted/70">
          Δ {formatByType(detail.deltaGrams, "METAL_GRAMS")} g
        </span>
        {ppg != null && (
          <>
            {" · "}
            <span className="tabular-nums text-muted/70">
              {currencyCode} {formatByType(ppg, "MONEY")}/g
            </span>
          </>
        )}
      </span>
      <span
        className={`tabular-nums ${detail.monetaryEquivalent < 0 ? vt.colors.discount : "text-text"}`}
      >
        {currencyCode} {formatByType(detail.monetaryEquivalent, "MONEY")}
      </span>
    </div>
  );
}

/** Sub-fila del redondeo físico de UN metal padre. Renderiza:
 *
 *    Redondeo financiero · 1,526 g → 2,000 g · ARS 100/g    +ARS 47.400
 *
 *  Cero matemática local. El delta físico, el equivalente monetario y el
 *  precio por gramo vienen del backend. */
function PhysicalRoundingRow({
  detail,
  currencyCode,
}: {
  detail:       MetalPhysicalRoundingDetail;
  currencyCode: string | undefined;
}): ReactElement {
  const pre   = typeof detail.preGrams  === "number" ? detail.preGrams  : 0;
  const post  = typeof detail.postGrams === "number" ? detail.postGrams : 0;
  const equiv = typeof detail.monetaryEquivalent === "number" && Number.isFinite(detail.monetaryEquivalent)
    ? detail.monetaryEquivalent
    : 0;
  const ppg   = typeof detail.metalPricePerGram === "number" && Number.isFinite(detail.metalPricePerGram)
    ? detail.metalPricePerGram
    : null;
  return (
    <div
      className="mt-1 pl-3 border-l border-border/15 flex items-baseline justify-between gap-3 text-[11px]"
      data-testid="total-card-metal-physical-row"
      data-tp-metal-id={detail.metalParentId ?? ""}
    >
      <span className="text-muted/80 truncate flex-1">
        <span className="text-[10px] uppercase tracking-wider text-muted/60 mr-1">
          Redondeo financiero
        </span>
        <span className="tabular-nums">
          {formatByType(pre, "METAL_GRAMS")} → {formatByType(post, "METAL_GRAMS")} g
        </span>
        {ppg != null && currencyCode && (
          <>
            {" · "}
            <span className="tabular-nums text-muted/70">
              {currencyCode} {formatByType(ppg, "MONEY")}/g
            </span>
          </>
        )}
      </span>
      <span
        className={`tabular-nums ${equiv < 0 ? vt.colors.discount : "text-text"}`}
        data-testid="total-card-metal-physical-equiv"
      >
        {currencyCode ? `${currencyCode} ` : ""}
        {formatByType(equiv, "MONEY")}
      </span>
    </div>
  );
}

export default MetalsSummary;
