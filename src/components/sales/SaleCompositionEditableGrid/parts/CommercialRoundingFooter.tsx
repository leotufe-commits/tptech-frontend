// src/components/sales/SaleCompositionEditableGrid/parts/CommercialRoundingFooter.tsx
// =============================================================================
// Etapa D' (cierre conceptual) — Footer del Redondeo Comercial PER_DOCUMENT
// dentro de la composición del artículo. DISPLAY orientado al usuario final.
//
// ──────────────────────────────────────────────────────────────────────────
// SCREENSHOT MENTAL (esperado en pantalla)
// ──────────────────────────────────────────────────────────────────────────
//
// ┌──────────────────────────────────────────────────────────────────┐
// │ REDONDEO COMERCIAL                              ARS −23.456,50   │
// │ Aplicado a nivel comprobante (3 líneas)                          │
// │                                                                  │
// │   METAL — Oro Fino                                               │
// │     1,125 g → 1,000 g                                            │
// │     Impacto: ARS −23.437,50                                      │
// │                                                                  │
// │   HECHURA                                                        │
// │     ARS 353.619,00 → ARS 353.600,00                              │
// │     Impacto: ARS −19,00                                          │
// │                                                                  │
// │   Total impacto                                  ARS −23.456,50  │
// └──────────────────────────────────────────────────────────────────┘
//
// En UNIFIED:
// ┌──────────────────────────────────────────────────────────────────┐
// │ REDONDEO COMERCIAL                                 ARS −8,90     │
// │   Total                                                          │
// │     ARS 200,00 → ARS 191,10                                      │
// │     Impacto: ARS −8,90                                           │
// └──────────────────────────────────────────────────────────────────┘
//
// ──────────────────────────────────────────────────────────────────────────
// REGLA DE ORO (permanente)
// ──────────────────────────────────────────────────────────────────────────
//
// Backend calcula. Frontend renderiza.
//
// Ningún valor se recalcula, infiere ni reconstruye en frontend. TODOS los
// valores vienen del snapshot `line.pricingMeta.commercialRoundingContext`.
//
// PROHIBIDO en este componente:
//   · IDs internos (`metalParentId` tipo "cmprg38wr…") — usar `metalParentName`.
//   · Enums técnicos (`INTEGER`, `HUNDRED`, `NEAREST`) — son detalle interno
//     del motor, no aportan al operador. La etiqueta visual usa el dominio
//     ("Total", "Hechura", nombre del metal padre).
//   · `Math.*`, `toFixed`, `toLocaleString`, `Intl.NumberFormat` — todo
//     formato pasa por `formatByType` / `formatMoneyDoc` (config del tenant).
//   · Multiplicaciones `grams × price` — el backend ya emite `monetaryEquivalent`.
//
// Naturaleza del campo (CRÍTICO):
//   · NO representa un redondeo propio de la línea.
//   · Es una VISTA del redondeo comercial DEL COMPROBANTE replicada por el
//     backend en cada línea. El cálculo SIEMPRE fue a nivel comprobante.
//   · Por eso `appliedAt` SIEMPRE vale `"DOCUMENT"`.
//
// Modos:
//   · UNIFIED   — un único bloque "Total" con pre→post, impacto.
//   · BREAKDOWN — dos buckets disjuntos: METAL (por padre, gramos pre→post
//     + impacto $) y HECHURA / SALDO (monto pre→post + impacto).
//
// Visibilidad: cuando `appliedToLineCount > 1`, badge "Aplicado a nivel
// comprobante" justo debajo del header. El backend emite el conteo — el
// frontend NUNCA hace `lines.length`.
// =============================================================================

import React from "react";
import { formatByType, formatMoneyDoc } from "../../../../lib/pricing/format";
import type { DocumentLine } from "../../../../lib/document-types";

type Ctx = NonNullable<NonNullable<DocumentLine["pricingMeta"]>["commercialRoundingContext"]>;

export type CommercialRoundingFooterProps = {
  /** Passthrough EXACTO del snapshot del backend. `null` → no se renderiza. */
  context:  Ctx | null | undefined;
  /** Code de la moneda del documento (ARS / USD / …). Solo se prepone al
   *  número para display — `formatByType` lo gobierna por config del tenant. */
  currency: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function CommercialRoundingFooter(
  props: CommercialRoundingFooterProps,
): React.ReactElement | null {
  const { context, currency } = props;

  if (!context) return null;

  // hasMovement: discriminado por scope. Sin movimiento no se renderiza —
  // un snapshot informativo con fallback (ALL_NONE / NO_METALS_BREAKDOWN_DATA)
  // y sin números reales no aporta valor visual al operador.
  const hasMovement =
    (context.scope === "UNIFIED"   && context.unified  != null) ||
    (context.scope === "BREAKDOWN" && context.breakdown != null);
  if (!hasMovement) return null;

  // Badge: viene del backend (`appliedToLineCount`). Cero conteo en FE.
  const showDocBadge =
    context.appliedAt === "DOCUMENT" && context.appliedToLineCount > 1;

  return (
    <div
      className="mt-3 rounded-md border border-border/40 bg-muted/10 px-3 py-2.5 space-y-2"
      data-testid="sce-commercial-rounding-footer"
      data-tp-scope={context.scope}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text/85">
          Redondeo comercial
        </span>
        <span
          className="text-sm font-mono tabular-nums text-text"
          data-testid="sce-commercial-total-impact-header"
        >
          {fmtMoneySigned(context.totalAdjustment, currency)}
        </span>
      </div>

      {showDocBadge && (
        <p className="text-[10px] uppercase tracking-wider text-muted/65 italic">
          Aplicado a nivel comprobante ({context.appliedToLineCount} líneas)
        </p>
      )}

      {/* ── UNIFIED ────────────────────────────────────────────────────── */}
      {context.unified && (
        <UnifiedBlock unified={context.unified} currency={currency} />
      )}

      {/* ── BREAKDOWN ──────────────────────────────────────────────────── */}
      {context.breakdown && (
        <>
          {context.breakdown.metals.map((m) => (
            <MetalBlock key={m.metalParentId} metal={m} currency={currency} />
          ))}
          <HechuraBlock hechura={context.breakdown.hechura} currency={currency} />
        </>
      )}

      {/* ── Total impacto (footer del bloque) ──────────────────────────── */}
      <div
        className="flex items-baseline justify-between gap-3 pt-1.5 border-t border-border/30"
        data-testid="sce-commercial-total-impact"
      >
        <span className="text-[11px] uppercase tracking-wider text-text/75">
          Total impacto
        </span>
        <span className="text-sm font-mono tabular-nums text-text">
          {fmtMoneySigned(context.totalAdjustment, currency)}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-bloques
// ─────────────────────────────────────────────────────────────────────────────

function UnifiedBlock(props: {
  unified:  NonNullable<Ctx["unified"]>;
  currency: string;
}): React.ReactElement {
  const { unified, currency } = props;
  return (
    <div className="pl-2 space-y-0.5" data-testid="sce-commercial-row-unified">
      <p className="text-[11px] font-medium text-text/80">Total</p>
      <p className="text-[11px] text-muted/85 font-mono tabular-nums">
        {fmtMoney(unified.pre, currency)} → {fmtMoney(unified.post, currency)}
      </p>
      <p className="text-[11px] text-muted/85">
        Impacto:{" "}
        <span className="font-mono tabular-nums">
          {fmtMoneySigned(unified.adjustment, currency)}
        </span>
      </p>
    </div>
  );
}

function MetalBlock(props: {
  metal:    NonNullable<Ctx["breakdown"]>["metals"][number];
  currency: string;
}): React.ReactElement {
  const { metal, currency } = props;
  // Fallback de label: si el backend NO resolvió el nombre (drafts viejos,
  // metal eliminado, query falló), `metalParentName` puede venir vacío o
  // igual al `metalParentId` técnico. En ese caso mostramos "Metal" plano
  // — NUNCA el id tipo "cmprg38wr…". REGLA DE ORO: frontend no inventa
  // nombres; usa lo que viene del backend o un placeholder genérico.
  const isUnresolvedName =
    !metal.metalParentName ||
    metal.metalParentName === metal.metalParentId;
  const metalLabel = isUnresolvedName ? "Metal" : `Metal — ${metal.metalParentName}`;
  return (
    <div
      className="pl-2 space-y-0.5"
      data-testid={`sce-commercial-metal-${metal.metalParentId}`}
    >
      <p className="text-[11px] font-medium text-text/80">{metalLabel}</p>
      <p className="text-[11px] text-muted/85 font-mono tabular-nums">
        {fmtGrams(metal.preGrams)} → {fmtGrams(metal.postGrams)}
      </p>
      <p className="text-[11px] text-muted/85">
        Impacto:{" "}
        <span className="font-mono tabular-nums">
          {fmtMoneySigned(metal.monetaryEquivalent, currency)}
        </span>
      </p>
    </div>
  );
}

function HechuraBlock(props: {
  hechura:  NonNullable<Ctx["breakdown"]>["hechura"];
  currency: string;
}): React.ReactElement {
  const { hechura, currency } = props;
  return (
    <div className="pl-2 space-y-0.5" data-testid="sce-commercial-hechura">
      <p className="text-[11px] font-medium text-text/80">Hechura</p>
      <p className="text-[11px] text-muted/85 font-mono tabular-nums">
        {fmtMoney(hechura.preRoundingSaldoMonetario, currency)} → {fmtMoney(hechura.postRoundingSaldoMonetario, currency)}
      </p>
      <p className="text-[11px] text-muted/85">
        Impacto:{" "}
        <span className="font-mono tabular-nums">
          {fmtMoneySigned(hechura.deltaSaldoMonetario, currency)}
        </span>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters — TODOS config-aware (preset del tenant)
// ─────────────────────────────────────────────────────────────────────────────

/** Moneda sin signo explícito (para pre/post). */
function fmtMoney(value: number, currency: string): string {
  return formatMoneyDoc(value, currency);
}

/** Moneda con signo: passthrough de `formatMoneyDoc` (el helper ya emite
 *  el menos para valores negativos según preset del tenant). No agregamos
 *  "+" para positivos: el operador ya distingue el signo natural. */
function fmtMoneySigned(value: number, currency: string): string {
  return formatMoneyDoc(value, currency);
}

/** Gramos config-aware + sufijo "g". */
function fmtGrams(g: number): string {
  return `${formatByType(g, "METAL_GRAMS")} g`;
}
