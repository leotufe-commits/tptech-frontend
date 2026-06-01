// src/components/sales/TotalDelComprobanteCard/parts/RoundingDiagnosticsSection.tsx
// =============================================================================
// Etapa 3A — Diagnóstico de redondeos y ajustes (observabilidad).
//
// Sección DEV-only que muestra los TRES mecanismos del backend lado a lado:
//   1. Redondeo Comercial  — por línea (lista de precios), agregado al doc.
//   2. Redondeo Financiero — por comprobante (capa 16 del pricing-engine).
//   3. Ajuste Manual       — por comprobante (capa 17, intervención humana).
//
// Cero matemática: passthrough EXACTO de los snapshots del backend. Si el
// backend cambia el shape, este componente NO lo corrige — debe romper visible
// para que la divergencia salte.
//
// Visible SOLO en desarrollo (gate `import.meta.env.DEV`). En producción
// devuelve null. Permite al operador (en dev) confirmar de un vistazo que los
// snapshots persistidos por backend coinciden con lo que se ve en pantalla.
//
// NO sustituye el render integrado del card (Patrimonio Metálico, Total Hechura
// expandible, ManualAdjustmentSection). Es un BLOQUE PARALELO de diagnóstico.
// =============================================================================

import type { ReactElement } from "react";
import { formatByType } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type { TotalDelComprobanteCardProps } from "../types";
import {
  selectCommercialDocRoundingDisplay,
  type CommercialDocRoundingDisplayRow,
} from "../helpers";

type DocumentRoundingSnapshot = NonNullable<TotalDelComprobanteCardProps["documentRoundingSnapshot"]>;
type ManualAdjustmentSnapshot = NonNullable<TotalDelComprobanteCardProps["manualAdjustmentSnapshot"]>;

export interface RoundingDiagnosticsSectionProps {
  /** Snapshot del redondeo financiero (capa 16). Top-level canónico. */
  financialSnapshot?: TotalDelComprobanteCardProps["documentRoundingSnapshot"];
  /** Snapshot del ajuste manual (capa 17). Top-level canónico. */
  manualSnapshot?:    TotalDelComprobanteCardProps["manualAdjustmentSnapshot"];
  /** Etapa D' — Snapshot del redondeo COMERCIAL PER_DOCUMENT (capa nueva
   *  post-tax). null cuando la lista operó en PER_LINE_LEGACY o
   *  MIXED_LIST_FALLBACK. */
  commercialDocSnapshot?: TotalDelComprobanteCardProps["commercialDocumentRoundingSnapshot"];
  /** Total del motor pre-ajuste manual. */
  engineTotal?:       number | null;
  /** Total final post-ajuste manual. */
  finalTotal?:        number | null;
  /** Code de la moneda display (ARS / USD / …). */
  displayCurrency?:   string;
  /** Forzar visibilidad (override del gate DEV). Útil para tests / debug en prod. */
  forceVisible?:      boolean;
}

function fmtMoney(amount: number | null | undefined, currency: string): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return `${currency ? `${currency} ` : ""}${formatByType(amount, "MONEY")}`;
}

function fmtGrams(g: number | null | undefined): string {
  if (typeof g !== "number" || !Number.isFinite(g)) return "—";
  return `${formatByType(g, "METAL_GRAMS")} gr`;
}

// Color con signo: negativo → discount; positivo o 0 → text.
function signClass(value: number | null | undefined): string {
  return typeof value === "number" && value < 0 ? vt.colors.discount : "text-text";
}

export function RoundingDiagnosticsSection(
  props: RoundingDiagnosticsSectionProps,
): ReactElement | null {
  const {
    financialSnapshot,
    manualSnapshot,
    commercialDocSnapshot,
    engineTotal,
    finalTotal,
    displayCurrency,
    forceVisible,
  } = props;

  // Etapa UX.31 (2026-05-30) — el bloque de diagnóstico queda oculto por
  // defecto incluso en desarrollo. Antes se renderizaba siempre en `DEV`
  // (`import.meta.env.DEV`), lo cual saturaba visualmente la UI del card en
  // dev local. Ahora requiere flag explícito `VITE_SHOW_PRICING_DIAGNOSTICS=true`
  // o el override programático `forceVisible` (que usan los tests).
  // En producción: NUNCA visible (igual que antes).
  const flagOn =
    (import.meta.env as Record<string, string | undefined>).VITE_SHOW_PRICING_DIAGNOSTICS === "true";
  const visible = forceVisible || flagOn;
  if (!visible) return null;

  const cur = displayCurrency || "";

  return (
    <section
      className="border-t-2 border-dashed border-amber-300/40 dark:border-amber-700/30 mt-4 pt-3 space-y-3"
      data-testid="total-card-rounding-diagnostics"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
          🔍 Diagnóstico: redondeos y ajustes
        </h4>
        <span className="text-[9px] uppercase tracking-wider text-muted/60 italic">
          Solo desarrollo · passthrough backend
        </span>
      </header>

      {/* ── 1. REDONDEO COMERCIAL ────────────────────────────────────────── */}
      <CommercialBlock snapshot={commercialDocSnapshot} currency={cur} />

      {/* ── 2. REDONDEO FINANCIERO ───────────────────────────────────────── */}
      <FinancialBlock snapshot={financialSnapshot} currency={cur} />

      {/* ── 3. AJUSTE MANUAL ─────────────────────────────────────────────── */}
      <ManualBlock
        snapshot={manualSnapshot}
        engineTotal={engineTotal}
        finalTotal={finalTotal}
        currency={cur}
      />
    </section>
  );
}

export default RoundingDiagnosticsSection;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-bloques
// ─────────────────────────────────────────────────────────────────────────────

function BlockHeader(props: { label: string; scope?: string | null }): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text/80">
        {props.label}
      </span>
      {props.scope && (
        <span className="text-[10px] uppercase tracking-wider text-muted/70">
          scope: {props.scope}
        </span>
      )}
    </div>
  );
}

function EmptyRow(props: { text: string }): ReactElement {
  return (
    <p className="text-[10px] text-muted/60 italic pl-2">
      {props.text}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 1 — Comercial
// ─────────────────────────────────────────────────────────────────────────────
// Etapa D' — Cuando la lista está en `commercialRoundingScope=PER_DOCUMENT`,
// el backend persiste el snapshot en `Sale.commercialDocumentRoundingSnapshot`
// y lo expone en el response del preview. Renderiza UNIFIED o BREAKDOWN según
// scope. Cuando la lista está en PER_LINE_LEGACY (default) o hay mixed-list,
// snapshot es null y mostramos el placeholder histórico (legacy per-línea).
//
// Cero matemática: passthrough EXACTO del selector puro
// `selectCommercialDocRoundingDisplay`. Si los valores se ven raros, el fix
// va en backend o en el contrato — NUNCA inline en este componente.
function CommercialBlock(props: {
  snapshot?: TotalDelComprobanteCardProps["commercialDocumentRoundingSnapshot"];
  currency:  string;
}): ReactElement {
  const display = selectCommercialDocRoundingDisplay(props.snapshot);

  if (!display) {
    return (
      <div
        className="rounded-md bg-amber-50/30 dark:bg-amber-950/10 px-2.5 py-2 space-y-1"
        data-testid="diag-commercial-block"
      >
        <BlockHeader label="Redondeo Comercial (PER_LINE legacy)" />
        <EmptyRow text="La lista del documento opera en PER_LINE_LEGACY o las líneas no comparten lista (MIXED_LIST_FALLBACK). El redondeo viaja absorbido en lines[i].pricingSnapshot." />
      </div>
    );
  }

  return (
    <div
      className="rounded-md bg-amber-50/30 dark:bg-amber-950/10 px-2.5 py-2 space-y-1.5"
      data-testid="diag-commercial-block"
      data-tp-scope={display.scope}
      data-tp-fallback={display.fallback ?? ""}
    >
      <BlockHeader label="Redondeo Comercial (PER_DOCUMENT)" scope={display.scope} />

      {display.fallback && display.rows.length === 0 ? (
        <EmptyRow text={`Capa activa pero sin movimiento (fallback=${display.fallback}).`} />
      ) : (
        display.rows.map((row) => (
          <CommercialRow key={row.key} row={row} currency={props.currency} />
        ))
      )}

      {display.rows.length > 0 && (
        <div className={`flex items-baseline justify-between ${vt.row.separator} pt-1`}>
          <span className="text-[10px] uppercase tracking-wider text-muted/70">
            totalAdjustment
          </span>
          <span className={`text-xs font-mono ${signClass(display.totalAdjustment)}`}>
            {fmtMoney(display.totalAdjustment, props.currency)}
          </span>
        </div>
      )}
    </div>
  );
}

function CommercialRow(props: {
  row:      CommercialDocRoundingDisplayRow;
  currency: string;
}): ReactElement {
  const { row, currency } = props;
  if (row.domain === "METAL") {
    return (
      <div className="space-y-0.5" data-testid={`diag-commercial-row-${row.key}`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-text/90">{row.label}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted/60">
            {row.modeLabel}
          </span>
        </div>
        <div className="flex items-baseline justify-between pl-2 text-[10px] text-muted/80">
          <span>
            {fmtGrams(row.preGrams)} → {fmtGrams(row.postGrams)}
          </span>
          <span className={`font-mono ${signClass(row.deltaGrams)}`}>
            Δ {fmtGrams(row.deltaGrams)}
          </span>
        </div>
        <div className="flex items-baseline justify-between pl-2 text-[10px] text-muted/70">
          <span>equivalente $</span>
          <span className={`font-mono ${signClass(row.monetaryEquivalent)}`}>
            {fmtMoney(row.monetaryEquivalent, currency)}
          </span>
        </div>
      </div>
    );
  }
  // HECHURA / SALDO
  return (
    <div className="space-y-0.5" data-testid={`diag-commercial-row-${row.key}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-text/90">{row.label}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted/60">
          {row.modeLabel}
        </span>
      </div>
      <div className="flex items-baseline justify-between pl-2 text-[10px] text-muted/80">
        <span>
          {fmtMoney(row.pre, currency)} → {fmtMoney(row.post, currency)}
        </span>
        <span className={`font-mono ${signClass(row.delta)}`}>
          Δ {fmtMoney(row.delta, currency)}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 2 — Financiero
// ─────────────────────────────────────────────────────────────────────────────
function FinancialBlock(props: {
  snapshot?: TotalDelComprobanteCardProps["documentRoundingSnapshot"];
  currency: string;
}): ReactElement {
  const { snapshot, currency } = props;

  if (!snapshot) {
    return (
      <div
        className="rounded-md bg-amber-50/30 dark:bg-amber-950/10 px-2.5 py-2 space-y-1"
        data-testid="diag-financial-block"
      >
        <BlockHeader label="Redondeo Financiero (capa 16)" />
        <EmptyRow text="Sin redondeo activo en este preview (snapshot null)." />
      </div>
    );
  }

  const scope = snapshot.scope ?? null;
  const totals = snapshot.totals ?? null;
  const metalDomain = snapshot.breakdown?.metalDomain ?? null;
  const metalPhysical = snapshot.breakdown?.metalPhysical ?? null;
  const metals = (metalPhysical?.metals ?? []).filter(
    (m): m is NonNullable<typeof m> => m != null,
  );

  return (
    <div
      className="rounded-md bg-amber-50/30 dark:bg-amber-950/10 px-2.5 py-2 space-y-1.5"
      data-testid="diag-financial-block"
      data-tp-scope={scope ?? ""}
      data-tp-metal-domain={metalDomain ?? ""}
    >
      <BlockHeader label="Redondeo Financiero (capa 16)" scope={scope} />

      {metalDomain && (
        <p className="text-[10px] text-muted/70 pl-2">
          metalDomain: <span className="font-mono">{metalDomain}</span>
          {metalPhysical?.fallback && (
            <> · fallback: <span className="font-mono">{metalPhysical.fallback}</span></>
          )}
        </p>
      )}

      {/* Por metal padre — solo aparece cuando capa 16 PHYSICAL actuó */}
      {metals.length > 0 && (
        <div className="space-y-0.5 pl-2 border-l border-amber-300/30">
          {metals.map((m, i) => (
            <div
              key={`${m.metalParentId ?? "null"}-${i}`}
              className="flex items-baseline justify-between gap-3 text-[11px]"
              data-testid="diag-financial-metal-row"
            >
              <span className="text-text/80 truncate">
                {m.metalParentName ?? "—"} · {fmtGrams(m.preGrams)} → {fmtGrams(m.postGrams)}
                {typeof m.metalPricePerGram === "number" && (
                  <> · <span className="text-muted/70">{fmtMoney(m.metalPricePerGram, currency)}/g</span></>
                )}
              </span>
              <span
                className={`tabular-nums ${signClass(m.monetaryEquivalent)}`}
                data-testid="diag-financial-metal-equiv"
              >
                {fmtMoney(m.monetaryEquivalent, currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Totales consolidados */}
      {totals && (
        <div className="space-y-0.5 pl-2 border-l border-amber-300/30 mt-1">
          <DiagRow
            label="monetaryRoundingAdjustment"
            value={fmtMoney(totals.monetaryRoundingAdjustment, currency)}
            colorValue={totals.monetaryRoundingAdjustment}
          />
          <DiagRow
            label="metalMonetaryEquivalent"
            value={fmtMoney(totals.metalMonetaryEquivalent, currency)}
            colorValue={totals.metalMonetaryEquivalent}
          />
          <DiagRow
            label="totalRoundingAdjustment"
            value={fmtMoney(totals.totalRoundingAdjustment, currency)}
            colorValue={totals.totalRoundingAdjustment}
            emphasize
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 3 — Manual
// ─────────────────────────────────────────────────────────────────────────────
function ManualBlock(props: {
  snapshot?: TotalDelComprobanteCardProps["manualAdjustmentSnapshot"];
  engineTotal?: number | null;
  finalTotal?: number | null;
  currency: string;
}): ReactElement {
  const { snapshot, engineTotal, finalTotal, currency } = props;

  if (!snapshot) {
    return (
      <div
        className="rounded-md bg-amber-50/30 dark:bg-amber-950/10 px-2.5 py-2 space-y-1"
        data-testid="diag-manual-block"
      >
        <BlockHeader label="Ajuste Manual (capa 17)" />
        <EmptyRow text="Sin ajuste manual en este preview (snapshot null)." />
        {typeof engineTotal === "number" && (
          <p className="text-[10px] text-muted/60 pl-2 mt-1">
            engineTotal = finalTotal = <span className="font-mono tabular-nums">{fmtMoney(engineTotal, currency)}</span>
          </p>
        )}
      </div>
    );
  }

  const scope = snapshot.scope;
  const totals = snapshot.totals ?? null;

  return (
    <div
      className="rounded-md bg-amber-50/30 dark:bg-amber-950/10 px-2.5 py-2 space-y-1.5"
      data-testid="diag-manual-block"
      data-tp-scope={scope}
    >
      <BlockHeader label="Ajuste Manual (capa 17)" scope={scope} />

      {scope === "UNIFIED" && (
        <div className="space-y-0.5 pl-2 border-l border-amber-300/30">
          <DiagRow
            label="unified.preAmount"
            value={fmtMoney(snapshot.unified.preAmount, currency)}
          />
          <DiagRow
            label="unified.amount"
            value={fmtMoney(snapshot.unified.amount, currency)}
            colorValue={snapshot.unified.amount}
          />
          <DiagRow
            label="unified.postAmount"
            value={fmtMoney(snapshot.unified.postAmount, currency)}
            emphasize
          />
        </div>
      )}

      {scope === "BREAKDOWN" && (
        <div className="space-y-1 pl-2 border-l border-amber-300/30">
          {snapshot.breakdown.metals.length === 0 && (
            <EmptyRow text="Sin ajustes por metal padre." />
          )}
          {snapshot.breakdown.metals.map((m, i) => (
            <div
              key={`${m.metalParentId ?? "null"}-${i}`}
              className="flex items-baseline justify-between gap-3 text-[11px]"
              data-testid="diag-manual-metal-row"
            >
              <span className="text-text/80 truncate">
                {m.metalParentName} · {fmtGrams(m.preGrams)} → {fmtGrams(m.postGrams)}
                {typeof m.metalPricePerGram === "number" && (
                  <> · <span className="text-muted/70">{fmtMoney(m.metalPricePerGram, currency)}/g</span></>
                )}
              </span>
              <span
                className={`tabular-nums ${signClass(m.monetaryEquivalent)}`}
                data-testid="diag-manual-metal-equiv"
              >
                {fmtMoney(m.monetaryEquivalent, currency)}
              </span>
            </div>
          ))}
          <DiagRow
            label="monetary.amount (bucket hechura/saldo)"
            value={fmtMoney(snapshot.breakdown.monetary.amount, currency)}
            colorValue={snapshot.breakdown.monetary.amount}
          />
        </div>
      )}

      {/* Totales consolidados (universal — UNIFIED + BREAKDOWN) */}
      {totals && (
        <div className="space-y-0.5 pl-2 border-l border-amber-300/30 mt-1">
          <DiagRow
            label="totals.monetaryAdjustment"
            value={fmtMoney(totals.monetaryAdjustment, currency)}
            colorValue={totals.monetaryAdjustment}
          />
          <DiagRow
            label="totals.metalMonetaryEquivalent"
            value={fmtMoney(totals.metalMonetaryEquivalent, currency)}
            colorValue={totals.metalMonetaryEquivalent}
          />
          <DiagRow
            label="totals.totalMonetaryAdjustment"
            value={fmtMoney(totals.totalMonetaryAdjustment, currency)}
            colorValue={totals.totalMonetaryAdjustment}
            emphasize
          />
        </div>
      )}

      {/* Cierre: engineTotal → finalTotal */}
      {typeof engineTotal === "number" && (
        <div className="mt-1 pt-1 border-t border-amber-300/30 space-y-0.5">
          <DiagRow
            label="engineTotal"
            value={fmtMoney(engineTotal, currency)}
          />
          <DiagRow
            label="finalTotal (impacto total)"
            value={fmtMoney(finalTotal ?? engineTotal, currency)}
            emphasize
          />
        </div>
      )}
    </div>
  );
}

function DiagRow(props: {
  label: string;
  value: string;
  colorValue?: number | null;
  emphasize?: boolean;
}): ReactElement {
  const colorClass =
    typeof props.colorValue === "number" ? signClass(props.colorValue) : "text-text";
  return (
    <div className="flex items-baseline justify-between gap-3 text-[10px]">
      <span className="text-muted/80 font-mono">{props.label}</span>
      <span
        className={`tabular-nums font-mono ${colorClass} ${
          props.emphasize ? "font-semibold" : ""
        }`}
      >
        {props.value}
      </span>
    </div>
  );
}
