// src/components/pricing/CommercialPhysicalRoundingBlock/CommercialPhysicalRoundingBlock.tsx
// =============================================================================
// Etapa C-comercial / C6 (POLICY §R-Rounding-14) — Bloque visual
// "Redondeo comercial del metal" + filas pre/post/delta de metal y hechura.
//
// CONTRATO CANÓNICO TPTech:
//   DESGLOSADO = metal padre físico + hechura / saldo monetario.
//
// El componente lee EXCLUSIVAMENTE el snapshot que el backend ya generó
// (C3) y transportó (C4-fix). Cero matemática nueva, cero cálculo. Si la
// lista operó MONETARY (legacy) y/o no hay delta, el bloque no se renderiza.
//
// Estructura del render:
//
//   Redondeo comercial del metal
//     Oro Fino
//       0,908 g → 1,000 g
//       Δ +0,092 g
//       Equivalente: ARS 9.200
//     (Plata si aplica…)
//   ───────────────────────────────
//   Metal venta:
//     ARS 90.800 → ARS 100.000  (+ARS 9.200)
//   Hechura:
//     ARS 14.987,50 → ARS 15.000  (+ARS 12,50)
//
// Reglas:
//   · Por metal padre: mostrar gramos pre/post/delta + equivalente monetario.
//   · Hechura: SOLO si delta ≠ 0 y campos disponibles.
//   · Sin `commercialPhysical` ni deltas → no renderiza nada.
//   · Si los deltas existen pero `commercialPhysical` está vacío (raro), igual
//     mostramos las filas pre/post — la auditoría del subtotal es útil sola.
// =============================================================================

import React from "react";
import { vt } from "../../../lib/pricing/visualTokens";
import { formatByType } from "../../../lib/pricing/format";
import type {
  CommercialPhysicalRoundingBlockProps,
  CommercialPhysicalEntry,
} from "./types";

/** Formatea un delta monetario con signo explícito. Por ejemplo
 *  `+ARS 9.200` o `−ARS 12,50`. Usa `formatByType("MONEY")` para respetar
 *  el preset del tenant (cero strings hardcodeados). */
function fmtDeltaMoney(value: number, currencyCode?: string): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs  = Math.abs(value);
  const cur  = currencyCode ? `${currencyCode} ` : "";
  return `${sign}${cur}${formatByType(abs, "MONEY")}`;
}

/** Formatea un delta de gramos con signo. Ej `+0,092 g`. */
function fmtDeltaGrams(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs  = Math.abs(value);
  return `${sign}${formatByType(abs, "METAL_GRAMS")} g`;
}

/** Render de una entry de metal padre — passthrough estricto. */
function MetalParentRow({
  entry,
  currencyCode,
}: {
  entry: CommercialPhysicalEntry;
  currencyCode?: string;
}): React.ReactElement {
  const noDelta = Math.abs(entry.deltaGrams) < 1e-9;
  const cur = currencyCode ? `${currencyCode} ` : "";
  return (
    <li
      className="space-y-0.5"
      data-testid={`cprb-metal-row-${entry.metalParentId ?? entry.metalParentName}`}
    >
      <p className={vt.text.cardName}>{entry.metalParentName}</p>
      <p className={vt.text.formulaCompact}>
        <span data-testid="cprb-pregrams">
          {formatByType(entry.preGrams, "METAL_GRAMS")} g
        </span>
        <span className={vt.colors.formulaFaint}> → </span>
        <span data-testid="cprb-postgrams" className={vt.text.subtotalRow}>
          {formatByType(entry.postGrams, "METAL_GRAMS")} g
        </span>
      </p>
      {!noDelta && (
        <>
          <p
            className={vt.text.formulaCompact}
            data-testid="cprb-deltagrams"
          >
            {"Δ "}{fmtDeltaGrams(entry.deltaGrams)}
          </p>
          <p
            className={vt.text.formulaCompact}
            data-testid="cprb-equivalent"
          >
            {"Equivalente: "}
            <span className={entry.monetaryEquivalent < 0 ? vt.colors.discount : ""}>
              {cur}{formatByType(Math.abs(entry.monetaryEquivalent), "MONEY")}
            </span>
          </p>
        </>
      )}
      {entry.fallback && (
        <p
          className={vt.text.formulaCompact}
          data-testid="cprb-metal-fallback"
        >
          {`(${entry.fallback.replace(/_/g, " ").toLowerCase()})`}
        </p>
      )}
    </li>
  );
}

export function CommercialPhysicalRoundingBlock(
  props: CommercialPhysicalRoundingBlockProps,
): React.ReactElement | null {
  const {
    commercialPhysical,
    metalSalePreRounding,
    metalSalePostRounding,
    metalSaleRoundingDelta,
    hechuraSalePreRounding,
    hechuraSalePostRounding,
    hechuraSaleRoundingDelta,
    currencyCode,
    variant = "full",
    className,
  } = props;

  // Render del bloque metales — solo si hay snapshot y al menos una entry.
  const metalsEntries = commercialPhysical?.metals ?? [];
  const hasMetals    = metalsEntries.length > 0;

  // Render de "Metal venta:" — solo si hay delta significativo + ambos
  // valores (pre y post) disponibles. NUNCA se suma pre+delta para inferir
  // post — los tres llegan del backend (cero matemática frontend).
  const metalDeltaOk =
    metalSaleRoundingDelta != null &&
    Number.isFinite(metalSaleRoundingDelta) &&
    Math.abs(metalSaleRoundingDelta) > 0.005 &&
    metalSalePreRounding  != null &&
    metalSalePostRounding != null;

  // Render de "Hechura:" — mismas guardas.
  const hechuraDeltaOk =
    hechuraSaleRoundingDelta != null &&
    Number.isFinite(hechuraSaleRoundingDelta) &&
    Math.abs(hechuraSaleRoundingDelta) > 0.005 &&
    hechuraSalePreRounding  != null &&
    hechuraSalePostRounding != null;

  // Si no hay NADA que mostrar → no renderizar (regla canónica de C6).
  if (!hasMetals && !metalDeltaOk && !hechuraDeltaOk) return null;

  const cur = currencyCode ? `${currencyCode} ` : "";
  const outerCls =
    variant === "compact"
      ? "pb-1 space-y-2 pt-2 mt-2"
      : "pb-1 space-y-3 border-t border-border/20 pt-3 mt-3";

  // Cuando el snapshot trae fallback a nivel batch sin entries reales,
  // mostramos un sub-label informativo (no es error — es transparencia).
  const batchFallback = commercialPhysical?.fallback ?? null;
  const showBatchFallback =
    batchFallback != null && !hasMetals && (metalDeltaOk || hechuraDeltaOk);

  return (
    <div
      className={`${outerCls} ${className ?? ""}`}
      data-testid="commercial-physical-rounding-block"
    >
      <p className={`${vt.text.groupLabel} ${vt.colors.labelSoft}`}>
        Redondeo comercial
      </p>

      {hasMetals && (
        <ul className="space-y-1.5" data-testid="cprb-metals-list">
          {metalsEntries.map((entry, idx) => (
            <MetalParentRow
              key={`cprb-${entry.metalParentId ?? entry.metalParentName}-${idx}`}
              entry={entry}
              currencyCode={currencyCode}
            />
          ))}
        </ul>
      )}

      {showBatchFallback && (
        <p
          className={vt.text.formulaCompact}
          data-testid="cprb-batch-fallback"
        >
          {`(${batchFallback.replace(/_/g, " ").toLowerCase()})`}
        </p>
      )}

      {(metalDeltaOk || hechuraDeltaOk) && (
        <div
          className="space-y-1 pt-2 border-t border-border/20"
          data-testid="cprb-subtotals"
        >
          {metalDeltaOk && (
            <p
              className={vt.text.formulaCompact}
              data-testid="cprb-metal-subtotal"
            >
              <span className={vt.colors.labelSoft}>{"Metal venta: "}</span>
              <span>
                {cur}{formatByType(metalSalePreRounding!, "MONEY")}
              </span>
              <span className={vt.colors.formulaFaint}> → </span>
              <span className={vt.text.subtotalRow}>
                {cur}{formatByType(metalSalePostRounding!, "MONEY")}
              </span>
              <span
                className={
                  metalSaleRoundingDelta! < 0 ? vt.colors.discount : ""
                }
              >
                {" ("}
                {fmtDeltaMoney(metalSaleRoundingDelta!, currencyCode)}
                {")"}
              </span>
            </p>
          )}

          {hechuraDeltaOk && (
            <p
              className={vt.text.formulaCompact}
              data-testid="cprb-hechura-subtotal"
            >
              <span className={vt.colors.labelSoft}>{"Hechura: "}</span>
              <span>
                {cur}{formatByType(hechuraSalePreRounding!, "MONEY")}
              </span>
              <span className={vt.colors.formulaFaint}> → </span>
              <span className={vt.text.subtotalRow}>
                {cur}{formatByType(hechuraSalePostRounding!, "MONEY")}
              </span>
              <span
                className={
                  hechuraSaleRoundingDelta! < 0 ? vt.colors.discount : ""
                }
              >
                {" ("}
                {fmtDeltaMoney(hechuraSaleRoundingDelta!, currencyCode)}
                {")"}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default CommercialPhysicalRoundingBlock;
