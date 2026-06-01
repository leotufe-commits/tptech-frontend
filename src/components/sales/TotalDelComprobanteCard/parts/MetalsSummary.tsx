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
import type { DocumentMetalSummaryItem } from "../types";

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

export function MetalsSummary({
  metals,
  currencyCode,
  physicalRoundedMetals,
  lineArticleNames,
  commercialMetalValueByParent,
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
      className="divide-y divide-border/15"
      data-testid="total-card-metals"
    >
      {metals.map((m) => {
        const physical = findPhysicalDetail(m, physicalRoundedMetals);
        const showPhysical = hasPhysicalDelta(physical);
        return (
          <li
            key={m.id}
            className="py-2.5 first:pt-0 last:pb-0"
            data-testid={`total-card-metal-${m.id}`}
            data-tp-physical-rounded={showPhysical ? "true" : "false"}
          >
            {/* Fila principal: nombre del padre · gramos (primario). */}
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium text-text">
                {m.name}
              </span>
              <span className="tabular-nums">
                <span className="text-[15px] font-semibold text-text">
                  {formatByType(m.grams, "METAL_GRAMS")}
                </span>
                <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wider text-muted/60">
                  gr
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
            {/* Etapa UX.32 (2026-05-30) — sub-fila terciaria "Valor comercial"
                por metal padre. Lookup contra `commercialMetalValueByParent`
                por `m.name` (= `metalName` con el que se agrega en el caller).
                Tipografía pequeña/secundaria para no competir con el Total ni
                con el Saldo Monetario.

                UX.32.b (2026-05-30) — solo se renderiza cuando hay MÁS DE UN
                metal padre. Con un único padre, el "Valor comercial" por
                padre es idéntico al total agregado del header del bloque
                METALES (no aporta información, solo ruido visual). Con N≥2
                padres, el desglose por padre sí es útil porque el operador
                ve cuánto vale cada metal individual. */}
            {(() => {
              if (metals.length <= 1) return null;
              if (!commercialMetalValueByParent || !currencyCode) return null;
              const value = commercialMetalValueByParent[m.name];
              if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
              return (
                <div
                  className="mt-0.5 flex items-baseline justify-between gap-2"
                  data-testid={`total-card-metal-${m.id}-commercial-value`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-muted/55">
                    Valor comercial
                  </span>
                  <span className="tabular-nums text-[11px] text-muted/75">
                    {currencyCode} {formatByType(value, "MONEY")}
                  </span>
                </div>
              );
            })()}
            {/* Etapa UX-Saldo — Sub-fila "Origen". Lista los artículos que
                aportaron a este metal padre. Display puro, derivado de
                `sourceLineIds` del balance + nombres pasados por el caller.
                Se omite cuando no hay datos suficientes (degradación segura). */}
            {(() => {
              const originNames = resolveOriginArticleNames(m.sourceLineIds, lineArticleNames);
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
