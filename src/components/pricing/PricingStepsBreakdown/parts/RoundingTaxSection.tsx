// src/components/pricing/PricingStepsBreakdown/parts/RoundingTaxSection.tsx
// ============================================================================
// Sección de redondeo + impuestos:
//   1. Redondeo PRICE/NET (antes de impuestos)
//   2. Bloque informativo "Redondeo por artículo / lista" (passthrough motor)
//   3. Impuestos por línea (uno por impuesto con fórmula)
//   4. Redondeo TOTAL (después de impuestos)
//
// Origen: PricingSimulator.tsx:4965-5116.
//
// Read-only — todos los valores y la decisión de aplicar/suprimir vienen del
// motor (`appliedRounding`, `appliedRoundingSuppressedByDocPolicy`,
// `taxBreakdown`).
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { formatMoneyDisplay } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import {
  ROUNDING_DIR_SYMBOLS,
  ROUNDING_MODE_LABELS,
  TAX_APPLY_ON_LABELS,
  APPLIED_ROUNDING_APPLY_ON_LABEL,
  APPLIED_ROUNDING_MODE_LABEL,
  APPLIED_ROUNDING_DIRECTION_LABEL,
} from "../helpers";
import type { PricingStepsDisplay } from "../types";
import type { PricingStepResult, PricingPreviewResult } from "../../../../services/articles";

export type RoundingTaxSectionProps = {
  rndStep:    PricingStepResult | undefined;
  hasTaxesL:  boolean;
  result:     Pick<PricingPreviewResult,
    | "appliedRounding"
    | "appliedRoundingSuppressedByDocPolicy"
    | "listRoundingMeta"
    | "taxBreakdown"
  > | null;
  display:    PricingStepsDisplay;
  /** Si false, oculta el bloque informativo "Redondeo por artículo / lista"
   *  (card naranja). La fila simple "Redondeo" (pre-tax / post-tax) sigue
   *  visible. Default `true` para preservar el comportamiento de Factura y
   *  Comparador; el Simulador lo pasa `false` para evitar la duplicación
   *  visual con la fila "Redondeo" del flujo. */
  showListRoundingCard?: boolean;
};

function SubLine({ children }: { children: React.ReactNode }) {
  return <p className={cn(vt.text.formula, vt.colors.formula, "mt-0.5")}>{children}</p>;
}

export function RoundingTaxSection(props: RoundingTaxSectionProps): React.ReactElement | null {
  const { rndStep, hasTaxesL, result, display, showListRoundingCard = true } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  const rndApplyOn = String((rndStep as any)?.meta?.applyOn ?? "PRICE");
  const isPreTaxRounding = rndStep?.value != null && (rndStep as any).meta?.preRounding != null && rndApplyOn !== "TOTAL";
  const isPostTaxRounding = rndStep?.value != null && (rndStep as any).meta?.preRounding != null && rndApplyOn === "TOTAL";

  return (
    <>
      {/* ── 1. Redondeo PRICE/NET (antes de impuestos) ─────────────────────── */}
      {isPreTaxRounding && (() => {
        const meta: any = (rndStep as any).meta;
        const pre     = parseFloat(String(meta.preRounding));
        const rounded = parseFloat(String(rndStep!.value));
        const diff    = rounded - pre;
        if (Math.abs(diff) < 0.001) return null;
        const dirSym  = ROUNDING_DIR_SYMBOLS[String(meta.direction ?? "")] ?? "";
        const modeLbl = ROUNDING_MODE_LABELS[String(meta.mode ?? "")] ?? String(meta.mode ?? "");
        const applyOnLbl = rndApplyOn === "NET" ? "sobre precio sin impuestos" : "sobre precio de lista";
        const ctxLine = [`${dirSym} ${modeLbl}`.trim(), applyOnLbl].filter(Boolean).join(" · ");
        return (
          <div>
            <div className={vt.row.flexBetween}>
              <span>Redondeo</span>
              <span className={vt.text.subtotalRow}>{diff > 0 ? "+" : ""}{fm(diff)}</span>
            </div>
            {ctxLine && <SubLine>{ctxLine}</SubLine>}
            <SubLine>{fm(pre)} → {fm(rounded)}</SubLine>
          </div>
        );
      })()}

      {/* ── 2. Bloque informativo "Redondeo por artículo / lista" ──────────── */}
      {showListRoundingCard
        && (result?.appliedRounding || result?.appliedRoundingSuppressedByDocPolicy) && (() => {
        // Rama 2a: redondeo de lista omitido por política doc.
        if (result.appliedRoundingSuppressedByDocPolicy && !result.appliedRounding) {
          const meta: any = result.listRoundingMeta;
          return (
            <div className={cn(vt.card.info, "mt-1")}>
              <div className={cn("text-[10px] font-semibold uppercase tracking-wider", vt.colors.label)}>
                Redondeo por artículo / lista
              </div>
              <p className={cn(vt.text.subLabel, "italic", vt.colors.formula)}>
                Omitido por redondeo de comprobante activo.
              </p>
              {meta && (
                <p className={cn(vt.text.formula, vt.colors.formula)}>
                  Configuración de la lista: {APPLIED_ROUNDING_MODE_LABEL[meta.mode] ?? meta.mode}
                  {" · "}{APPLIED_ROUNDING_DIRECTION_LABEL[meta.direction] ?? meta.direction}
                  {" · sobre "}{(APPLIED_ROUNDING_APPLY_ON_LABEL[meta.applyOn] ?? meta.applyOn).toLowerCase()}.
                </p>
              )}
            </div>
          );
        }
        // Rama 2b: redondeo aplicado.
        const ar: any = result.appliedRounding!;
        const adj = Number(ar.unitAdjustment ?? 0);
        const adjAbs = Math.abs(adj);
        const noAdjustment = adjAbs < 0.005;
        return (
          <div className={cn(vt.card.info, "mt-1")}>
            <div className={cn("text-[10px] font-semibold uppercase tracking-wider", vt.colors.label)}>
              Redondeo por artículo / lista
            </div>
            <div className={cn("space-y-0.5", vt.text.subLabel)}>
              <div className="flex justify-between gap-2">
                <span className={vt.colors.label}>Aplicado sobre</span>
                <span className={cn("font-medium", vt.colors.text)}>
                  {APPLIED_ROUNDING_APPLY_ON_LABEL[ar.applyOn] ?? ar.applyOn}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={vt.colors.label}>Modo</span>
                <span className={cn("font-medium", vt.colors.text)}>
                  {APPLIED_ROUNDING_MODE_LABEL[ar.mode] ?? ar.mode}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={vt.colors.label}>Dirección</span>
                <span className={cn("font-medium", vt.colors.text)}>
                  {APPLIED_ROUNDING_DIRECTION_LABEL[ar.direction] ?? ar.direction}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={vt.colors.label}>Ajuste unitario</span>
                <span className={cn(
                  "tabular-nums font-medium",
                  noAdjustment
                    ? cn("italic", vt.colors.labelSoft)
                    : adj > 0
                      ? vt.colors.roundingPositive
                      : vt.colors.roundingNegative,
                )}>
                  {noAdjustment ? "Sin ajuste por redondeo" : (adj > 0 ? "+" : "") + fm(adj)}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 3. Impuestos — uno por impuesto con fórmula ────────────────────── */}
      {hasTaxesL && (
        <div className="border-t border-border/30 pt-2 mt-0.5 space-y-1.5">
          {(result?.taxBreakdown ?? []).map((t: any, i: number) => {
            const applyLbl = t.applyOn !== "TOTAL" ? (TAX_APPLY_ON_LABELS[t.applyOn] ?? "") : "";
            let formulaLeft: string | null = null;
            if (t.calculationType === "PERCENTAGE" && t.rate != null)
              formulaLeft = `${fm(t.base)} × ${t.rate}%${applyLbl ? ` (${applyLbl})` : ""}`;
            else if (t.calculationType === "FIXED_AMOUNT")
              formulaLeft = "fijo";
            else if (t.calculationType === "PERCENTAGE_PLUS_FIXED" && t.rate != null)
              formulaLeft = `${fm(t.base)} × ${t.rate}% + fijo${applyLbl ? ` (${applyLbl})` : ""}`;
            return (
              <div key={i} className={vt.row.flexBetween}>
                <span className={vt.text.subLabel}>
                  <span className="text-foreground/75">{t.name}</span>
                  {formulaLeft && <span className={cn("ml-1 text-[9px] tabular-nums", vt.colors.formulaFaint)}>{formulaLeft}</span>}
                </span>
                <span className={cn(vt.text.subtotalRow, vt.colors.label, "shrink-0")}>+{fm(t.taxAmount)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4. Redondeo TOTAL — después de impuestos ───────────────────────── */}
      {isPostTaxRounding && (() => {
        const meta: any = (rndStep as any).meta;
        const pre     = parseFloat(String(meta.preRounding));
        const rounded = parseFloat(String(rndStep!.value));
        const diff    = rounded - pre;
        if (Math.abs(diff) < 0.001) return null;
        const dirSym  = ROUNDING_DIR_SYMBOLS[String(meta.direction ?? "")] ?? "";
        const modeLbl = ROUNDING_MODE_LABELS[String(meta.mode ?? "")] ?? String(meta.mode ?? "");
        const roundTarget = hasTaxesL ? "sobre total con impuestos" : "sobre precio final";
        const ctxLine = [`${dirSym} ${modeLbl}`.trim(), roundTarget].filter(Boolean).join(" · ");
        return (
          <div>
            <div className={vt.row.flexBetween}>
              <span>Redondeo</span>
              <span className={vt.text.subtotalRow}>{diff > 0 ? "+" : ""}{fm(diff)}</span>
            </div>
            {ctxLine && <SubLine>{ctxLine}</SubLine>}
            <SubLine>{fm(pre)} → {fm(rounded)}</SubLine>
          </div>
        );
      })()}
    </>
  );
}
