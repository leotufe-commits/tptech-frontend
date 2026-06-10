// src/components/sales/TotalDelComprobanteCard/parts/CommercialRoundingSummary.tsx
// =============================================================================
// A (2026-06) — Sección VISIBLE "Redondeos comerciales".
//
// Saca a producción información que ya llegaba al footer pero solo se mostraba
// en `RoundingDiagnosticsSection` (DEV-only). PASSTHROUGH PURO del snapshot
// `commercialDocumentRoundingSnapshot` (Etapa D' / PER_DOCUMENT): cero
// matemática, cero recálculo. Si un dato no existe (o es ~0), se oculta esa
// fila; si no hay nada significativo, no se renderiza la sección.
//
//   REDONDEOS COMERCIALES
//   Metal      + ARS 7.656,25      ← breakdown.metalMonetaryEquivalent
//   Hechura    + ARS 24,79         ← breakdown.hechura.deltaSaldoMonetario
//   Total      + ARS 7.681,04      ← totalAdjustment
//
// En modo UNIFIED el snapshot no trae metal/hechura → solo "Total".
// READ-ONLY. No es el redondeo financiero del comprobante ni el físico del
// metal — es el redondeo COMERCIAL de la lista (PER_DOCUMENT).
// =============================================================================

import type { ReactElement } from "react";
import { formatByType } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type { TotalDelComprobanteCardProps } from "../types";

type CommercialRoundingSnapshot =
  NonNullable<TotalDelComprobanteCardProps["commercialDocumentRoundingSnapshot"]>;

const EPS = 0.005;

/** Número monetario significativo (finito y |x| > medio centavo). */
function isMoney(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) > EPS;
}

/** Monto con signo tipográfico (+ / −). Display puro — el valor viene del
 *  snapshot backend, acá solo se formatea. */
function SignedAmount({
  amount,
  currency,
}: {
  amount:   number;
  currency: string;
}): ReactElement {
  const sign = amount > 0 ? "+ " : amount < 0 ? "− " : "";
  return (
    <span
      className={`tabular-nums text-[12px] font-semibold ${amount < 0 ? vt.colors.discount : "text-text"}`}
    >
      {sign}
      {currency ? `${currency} ` : ""}
      {formatByType(Math.abs(amount), "MONEY")}
    </span>
  );
}

export interface CommercialRoundingSummaryProps {
  snapshot?:        CommercialRoundingSnapshot | null;
  displayCurrency?: string;
}

export function CommercialRoundingSummary({
  snapshot,
  displayCurrency,
}: CommercialRoundingSummaryProps): ReactElement | null {
  // Contrato original: PASSTHROUGH PURO del snapshot documental
  // (`commercialDocumentRoundingSnapshot`, PER_DOCUMENT). Dominio DOCUMENTO.
  // Si no hay snapshot, no se renderiza. Sin suma por línea, sin gate MIXED.
  if (!snapshot) return null;
  const cur = displayCurrency ?? "";

  // BREAKDOWN → metal (Σ Δgramos × cotización) + hechura (Δ saldo monetario).
  // UNIFIED   → ninguno de los dos (solo "Total").
  const metalImpact =
    snapshot.scope === "BREAKDOWN"
      ? snapshot.breakdown?.metalMonetaryEquivalent
      : undefined;
  const hechuraImpact =
    snapshot.scope === "BREAKDOWN"
      ? snapshot.breakdown?.hechura?.deltaSaldoMonetario
      : undefined;
  const totalImpact = snapshot.totalAdjustment;

  const rows: Array<{ key: string; label: string; amount: number }> = [];
  if (isMoney(metalImpact))   rows.push({ key: "metal",   label: "Metal",   amount: metalImpact });
  if (isMoney(hechuraImpact)) rows.push({ key: "hechura", label: "Hechura", amount: hechuraImpact });
  const showTotal = isMoney(totalImpact);

  // Sin nada significativo → no renderizar (degradación segura).
  if (rows.length === 0 && !showTotal) return null;

  return (
    <section
      className="border-t border-border/20 pt-3 space-y-2"
      data-testid="total-card-commercial-rounding-section"
    >
      <header className="text-xs font-bold uppercase tracking-[0.16em] text-text">
        Redondeos comerciales
      </header>
      <ul className="space-y-1" data-testid="total-card-commercial-rounding">
        {rows.map((r) => (
          <li
            key={r.key}
            className="flex items-baseline justify-between gap-3"
            data-testid={`total-card-commercial-rounding-${r.key}`}
          >
            <span className="text-[12px] text-muted/80">{r.label}</span>
            <SignedAmount amount={r.amount} currency={cur} />
          </li>
        ))}
        {showTotal && (
          <li
            className="flex items-baseline justify-between gap-3 border-t border-border/15 pt-1 mt-1"
            data-testid="total-card-commercial-rounding-total"
          >
            <span className="text-[12px] font-semibold text-text">Total</span>
            <SignedAmount amount={totalImpact as number} currency={cur} />
          </li>
        )}
      </ul>
    </section>
  );
}

export default CommercialRoundingSummary;
