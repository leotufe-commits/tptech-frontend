// src/components/sales/SaleLineDiscountSummary.tsx
// ============================================================================
// SaleLineDiscountSummary — bloque visual del desglose de descuentos /
// recargos APLICADOS A UNA LÍNEA.
//
// Estructura:
//   · Header SIEMPRE visible: "Ajustes aplicados: −AR$ X  Ver detalle ▼".
//     Clickeable: expande/colapsa el detalle. Cerrado por defecto para no
//     ocupar lugar.
//   · Detalle (cuando abierto): por origen muestra
//        · Origen   (• Promo / • Desc. por cantidad / • Cliente / ...)
//        · Regla    (italic, "Promo Verano" o "regla del cliente: 15% sobre Total")
//        · Base     (Total / Metal / Hechura)
//        · Cálculo  ("AR$ 375.781,25 × 10%" o "AR$ 50,00 × 3 u." o
//                    "detalle no disponible" si el motor no expone base+valor)
//        · Impacto  (monto, alineado a la derecha)
//     Termina con Total automático y/o Total recargos.
//   · Sección "Ajuste manual" / "Sin ajuste manual" debajo.
//
// REGLAS:
//   · NO recalcula montos ni porcentajes. Todo es passthrough del motor.
//   · NUNCA "%" en label primario.
//   · "Cálculo: detalle no disponible" cuando el motor no segregó la base
//     (caso ENTITY_RULE applyOn=TOTAL). El impacto del motor sigue visible.
// ============================================================================

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "../ui/tp";
import { formatMoneyDoc as fmtMoney, formatByType } from "../../lib/pricing/format";
import {
  buildLineDiscountSources,
  buildLineDiscountPipeline,
  isEmptyLineGroup,
  lineEffectiveDiscountTotal,
  lineEffectiveAdjustmentSigned,
  type LineLikeForDiscount,
  type LineDiscountItemGroup,
  type LineDiscountSourceItem,
  type LineDiscountCalculation,
  type LinePipelineEntry,
  type LineDiscountPipeline,
} from "../../lib/pricing/display/saleLineDiscountSourcesDisplay";

export type SaleLineDiscountSummaryProps = {
  line:     LineLikeForDiscount;
  currency: string;
  displayRate?: number;
  /** Si false, oculta el bloque "Sin ajuste manual" cuando no hay manual. */
  showEmptyManualBlock?: boolean;
  /** Si true, el detalle arranca abierto. Default false (cerrado).
   *  Sólo aplica cuando el componente trabaja en modo NO CONTROLADO
   *  (sin `open` / `onOpenChange`). */
  defaultOpen?: boolean;
  /** T34 — Modo controlado: el caller maneja el estado open/close.
   *  Cuando se provee `open`, `defaultOpen` se ignora y el state interno
   *  se "puentea" al externo. Útil cuando trigger y panel viven en
   *  ubicaciones distintas del DOM (e.g. trigger en la celda del TPNumber
   *  y panel en una zona común debajo del row). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** T34 — Qué parte renderizar:
   *  · "both"    → wrapper + trigger + (panel si open). Comportamiento default.
   *  · "trigger" → sólo el trigger (sin panel, sin wrapper externo).
   *  · "panel"   → sólo el contenido expandido (asume `open=true`).
   *                NO renderiza wrapper externo; el caller decide el contenedor. */
  part?: "both" | "trigger" | "panel";
};

// ─── Helpers de display ────────────────────────────────────────────────────

/** Formatea el monto neto del header: "−AR$ X" o "+AR$ Y" o ambos.
 *  Si hay solo bonifications → "−$X". Si hay solo surcharges → "+$Y".
 *  Si hay ambos → "−$X / +$Y" para no inducir un neto engañoso. */
function formatHeaderAmount(
  bonifTotal: number,
  surchargeTotal: number,
  currency: string,
  displayRate: number,
): string {
  const fmt = (n: number) => fmtMoney(n / displayRate, currency);
  const hasBonif    = bonifTotal    > 0.005;
  const hasSurcharge = surchargeTotal > 0.005;
  if (hasBonif && hasSurcharge) return `−${fmt(bonifTotal)} / +${fmt(surchargeTotal)}`;
  if (hasBonif)                  return `−${fmt(bonifTotal)}`;
  if (hasSurcharge)              return `+${fmt(surchargeTotal)}`;
  return fmt(0);
}

/** Renderiza el bloque "Base usada" — UNA línea compacta con la cuenta
 *  POR UNIDAD: `base_unit × percent% = -impact_unit`. Devuelve `null`
 *  cuando `calc` es null.
 *
 *  El valor verde del impacto a la derecha del ítem sigue siendo el TOTAL
 *  línea (passthrough del motor) — esta línea explica solo el cálculo
 *  unitario para que el operador valide mentalmente:
 *    "cada unidad descuenta X, el verde es la suma sobre toda la cantidad".
 *
 *  `amount` es el impacto TOTAL línea. El impacto unitario se descompone
 *  como `amount / qty` — división trivial, NO recálculo comercial. */
function renderCalcLine(
  calc:        LineDiscountCalculation | null,
  currency:    string,
  displayRate: number,
  amount:      number | null,
  signed:      "negative" | "positive",
): React.ReactNode {
  if (calc == null) return null;
  if (calc.kind === "UNAVAILABLE") {
    return (
      <div
        data-tp-calc-unavailable="true"
        className="inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
      >
        <span className="font-semibold">Base usada:</span>
        <span>detalle no disponible</span>
      </div>
    );
  }
  const sign = signed === "negative" ? "−" : "+";
  if (calc.kind === "PERCENT") {
    const baseUnitText = fmtMoney(calc.baseUnit / displayRate, currency);
    const pctText      = formatByType(calc.percent, "PERCENT", { bare: true });
    // Impacto unitario = amount / qty (descomposición trivial del total
    // del motor — no es recálculo comercial).
    const impactUnit = amount != null && calc.qty > 0 ? amount / calc.qty : null;
    const impactUnitText = impactUnit != null
      ? `${sign}${fmtMoney(impactUnit / displayRate, currency)}`
      : null;
    // Aviso de mismatch del motor preservado.
    const EPS = 0.01;
    const engineBase = calc.baseFromEngine ?? null;
    const baseLineComputed = calc.baseUnit * calc.qty;
    const baseMismatch =
      engineBase != null && Math.abs(engineBase - baseLineComputed) > EPS;
    return (
      <div className="text-[10px] text-muted/75 space-y-0.5">
        <div data-tp-base-used="true">
          <span className="font-semibold text-muted">Base usada:</span>{" "}
          <span className="tabular-nums text-muted">{baseUnitText}</span>
          <span className="text-muted/65"> × </span>
          <span className="tabular-nums text-muted">{pctText}%</span>
          {impactUnitText && (
            <>
              <span className="text-muted/65"> = </span>
              <span className="tabular-nums text-muted">{impactUnitText}</span>
            </>
          )}
        </div>
        {baseMismatch && engineBase != null && (
          <div className="italic text-amber-600/85 dark:text-amber-400/85">
            Base usada por motor: {fmtMoney(engineBase / displayRate, currency)}
            <span className="ml-1 text-muted/60">
              (no coincide con base unitaria × cantidad — el motor aplicó la
              regla sobre la base segregada)
            </span>
          </div>
        )}
      </div>
    );
  }
  // FIXED — monto fijo por unidad. Cuando es fijo no hay "× %"; se muestra
  // como "X por unidad" para que quede claro que cada unidad recibe el
  // mismo monto fijo.
  const perUnitText = fmtMoney(calc.perUnit / displayRate, currency);
  const sUnitText   = `${sign}${perUnitText}`;
  return (
    <div className="text-[10px] text-muted/75">
      <div data-tp-base-used="true">
        <span className="font-semibold text-muted">Base usada:</span>{" "}
        <span className="tabular-nums text-muted">{sUnitText}</span>
        <span className="text-muted/55"> por unidad</span>
      </div>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────

function BlockHeader({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted/70">
        {title}
      </div>
      {/* T9 — caption opcional: cuando se omite no se renderiza el subtítulo
          técnico ("Override del operador…"). */}
      {caption && (
        <div className="text-[10px] italic text-muted/55">{caption}</div>
      )}
    </div>
  );
}

function ItemRow({
  item, signed, currency, displayRate,
}: {
  item:        LineDiscountSourceItem;
  signed:      "negative" | "positive";
  currency:    string;
  displayRate: number;
}) {
  const sign = signed === "negative" ? "−" : "+";
  const amountText =
    item.status === "OK" && item.amount != null
      ? sign + fmtMoney(item.amount / displayRate, currency)
      : null;
  const amountTone =
    signed === "negative"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-amber-600 dark:text-amber-400";

  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-[11px] font-semibold text-text">
          • {item.label}
        </div>
        {item.originName && (
          <div className="text-[10px] italic text-muted/80 break-words">
            Regla: {item.originName}
          </div>
        )}
        {item.baseLabel && (
          <div className="text-[10px] text-muted/65">
            Base: <span className="text-muted">{item.baseLabel}</span>
          </div>
        )}
        {renderCalcLine(item.calc, currency, displayRate, item.amount ?? null, signed)}
        {item.status === "UNDETAILED" && (
          <div className="text-[10px] italic text-amber-600 dark:text-amber-400 break-words">
            Aplicado por el motor — detalle no disponible en esta línea.
          </div>
        )}
      </div>
      <div className={"tabular-nums text-[11px] font-semibold shrink-0 text-right " + amountTone}>
        {amountText ?? <span className="italic text-muted/60 font-normal">—</span>}
      </div>
    </div>
  );
}

function GroupTotalRow({
  label, total, signed, currency, displayRate,
}: {
  label:       string;
  total:       number;
  signed:      "negative" | "positive";
  currency:    string;
  displayRate: number;
}) {
  const sign = signed === "negative" ? "−" : "+";
  return (
    <div className="mt-1 flex items-center justify-between gap-3 border-t-2 border-border/60 pt-1.5 text-[11px]">
      <span className="font-bold uppercase tracking-wide text-text">{label}</span>
      <span className="tabular-nums font-bold text-amber-600 dark:text-amber-500">
        {sign + fmtMoney(total / displayRate, currency)}
      </span>
    </div>
  );
}

function RenderGroup({
  g, currency, displayRate,
}: {
  g:           LineDiscountItemGroup;
  currency:    string;
  displayRate: number;
}) {
  const hasBonifs    = g.bonifications.length > 0;
  const hasSurcharges = g.surcharges.length > 0;
  const bonifOkCount    = g.bonifications.filter((it) => it.status === "OK").length;
  const surchargeOkCount = g.surcharges  .filter((it) => it.status === "OK").length;
  return (
    <>
      {hasBonifs && (
        <div className="divide-y divide-border/30">
          {g.bonifications.map((it) => (
            <ItemRow key={it.key} item={it} signed="negative" currency={currency} displayRate={displayRate} />
          ))}
          {bonifOkCount > 0 && (
            <GroupTotalRow
              label="Total automático"
              total={g.bonificationTotal}
              signed="negative"
              currency={currency}
              displayRate={displayRate}
            />
          )}
        </div>
      )}
      {hasSurcharges && (
        <div className="divide-y divide-border/30">
          {g.surcharges.map((it) => (
            <ItemRow key={it.key} item={it} signed="positive" currency={currency} displayRate={displayRate} />
          ))}
          {surchargeOkCount > 0 && (
            <GroupTotalRow
              label="Total recargos"
              total={g.surchargeTotal}
              signed="positive"
              currency={currency}
              displayRate={displayRate}
            />
          )}
        </div>
      )}
    </>
  );
}

// ─── Timeline (pipeline) — render en orden REAL del motor ──────────────────

/** Render del pipeline cuando la línea trae `pricingSteps` del motor.
 *  Cada paso muestra: número de orden, label, regla, base usada, impacto y
 *  subtotal resultante. Termina con un total automático y/o manual.
 *
 *  `effectiveTotal` y `hasManualOverride` vienen del componente principal y
 *  son la FUENTE DE VERDAD del TOTAL mostrado en los footers (passthrough
 *  motor `baseInitial − subtotal`). Los `impact` por step siguen siendo del
 *  motor (display educativo del orden y razón del descuento) pero el TOTAL
 *  ya no es Σ steps — eso garantiza coincidencia con el TPNumber del editor. */
function PipelineTimeline({
  pipeline, currency, displayRate, showEmptyManualBlock,
  effectiveTotal, hasManualOverride, isSurchargeLn = false,
}: {
  pipeline:    LineDiscountPipeline;
  currency:    string;
  displayRate: number;
  showEmptyManualBlock: boolean;
  effectiveTotal:    number;
  hasManualOverride: boolean;
  // T10 — cuando la línea es un RECARGO efectivo, los footers "Total
  // automático/manual" muestran "+$X" (no "−$X"). El monto es magnitud.
  isSurchargeLn?: boolean;
}) {
  const adjSign = isSurchargeLn ? "+" : "−";
  const fmt = (n: number) => fmtMoney(n / displayRate, currency);
  const auto   = pipeline.steps.filter((e) => e.group === "AUTOMATIC");
  const manual = pipeline.steps.filter((e) => e.group === "MANUAL");

  // T7 — numeración VISUAL correlativa según los ítems realmente mostrados.
  // El `e.index` original es el orden interno del motor (1=ENTITY_RULE,
  // 2=MANUAL_DISCOUNT_OVERRIDE, etc). Cuando hay manual el bloque AUTO se
  // oculta y el ítem manual quedaba renderizado como "2", haciendo creer al
  // operador que faltaba un ítem #1. Pasamos un `visibleNumber` derivado del
  // orden del array que efectivamente se mapea — el orden REAL del motor
  // se preserva (siguen filtrándose por group AUTO/MANUAL antes), solo se
  // re-numera el chip visual. Cero impacto en cálculo.
  const renderStep = (e: LinePipelineEntry, visibleNumber: number) => {
    const sign = e.signed === "negative" ? "−" : "+";
    const impactTone =
      e.signed === "negative"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-amber-600 dark:text-amber-400";
    return (
      <li key={`${e.index}:${e.key}`} className="relative pl-7 pr-2 py-2">
        {/* Punto numerado a la izquierda — funciona como ancla del timeline.
            Usa `visibleNumber` (orden visible, 1..N) no el `e.index` del motor. */}
        <div
          aria-hidden
          className="absolute left-0 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-[10px] font-bold text-muted"
        >
          {visibleNumber}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-[11px] font-semibold text-text">{e.label}</div>
            {e.originName && (
              <div className="text-[10px] italic text-muted/80 break-words">
                Regla: {e.originName}
              </div>
            )}
            {e.baseLabel && (
              <div className="text-[10px] text-muted/65">
                Aplica sobre: <span className="text-muted">{e.baseLabel}</span>
              </div>
            )}
            {/* Base usada — cuenta POR UNIDAD. Permite validar mentalmente
                "cada unidad descuenta esto". Cuando `calc` es PERCENT
                muestra `baseUnit × % = -impactUnit`. Cuando es FIXED
                muestra `monto fijo por unidad`. El verde a la derecha
                sigue siendo el TOTAL línea (passthrough motor). */}
            {(() => {
              const c = e.calc;
              const impactUnit = e.calc != null && e.calc.kind === "PERCENT" && pipeline.quantity > 0
                ? e.impact / pipeline.quantity
                : null;
              if (c == null) {
                return (
                  <div className="text-[10px] text-muted/75">
                    <span className="font-semibold text-muted">Base usada:</span>{" "}
                    <span className="tabular-nums text-muted">{fmt(e.baseUsed)}</span>
                  </div>
                );
              }
              if (c.kind === "PERCENT") {
                const baseUnitText = fmt(c.baseUnit);
                const pctText = formatByType(c.percent, "PERCENT", { bare: true });
                const impactUnitText = impactUnit != null
                  ? `${sign}${fmt(impactUnit)}`
                  : null;
                return (
                  <div data-tp-base-used="true" className="text-[10px] text-muted/75">
                    <span className="font-semibold text-muted">Base usada:</span>{" "}
                    <span className="tabular-nums text-muted">{baseUnitText}</span>
                    <span className="text-muted/65"> × </span>
                    <span className="tabular-nums text-muted">{pctText}%</span>
                    {impactUnitText && (
                      <>
                        <span className="text-muted/65"> = </span>
                        <span className="tabular-nums text-muted">{impactUnitText}</span>
                      </>
                    )}
                    {e.baseEstimated && (
                      <span className="ml-1 italic text-amber-600/85 dark:text-amber-400/85">
                        (estimada)
                      </span>
                    )}
                  </div>
                );
              }
              if (c.kind === "FIXED") {
                const perUnitText = `${sign}${fmt(c.perUnit)}`;
                return (
                  <div data-tp-base-used="true" className="text-[10px] text-muted/75">
                    <span className="font-semibold text-muted">Base usada:</span>{" "}
                    <span className="tabular-nums text-muted">{perUnitText}</span>
                    <span className="text-muted/55"> por unidad</span>
                  </div>
                );
              }
              // UNAVAILABLE — el motor no expuso base + valor para este step.
              return (
                <div
                  data-tp-base-used="true"
                  className="inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
                >
                  <span className="font-semibold">Base usada:</span>
                  <span>detalle no disponible</span>
                </div>
              );
            })()}
          </div>
          <div className={"tabular-nums text-[11px] font-semibold shrink-0 text-right " + impactTone}>
            {sign}{fmt(e.impact)}
          </div>
        </div>
        {/* "Subtotal resultante" del step quedó oculto — era un detalle técnico
            (debug del pipeline) que confundía al operador comercial. La info
            relevante (impacto del step + base usada) ya está arriba. */}
      </li>
    );
  };

  return (
    <div className="space-y-3">
      {/* Base inicial — siempre visible cuando el motor la declaró. */}
      {pipeline.baseInitial != null && (
        <div className="flex items-center justify-between gap-3 rounded-sm bg-card/60 px-2 py-1.5 ring-1 ring-border/40">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/70">
            Base inicial (lista × {pipeline.quantity} u.)
          </span>
          <span className="tabular-nums text-[11px] font-bold text-text">
            {fmt(pipeline.baseInitial)}
          </span>
        </div>
      )}

      {/* AUTOMÁTICOS — semántica unificada "manual reemplaza automático":
          cuando hay override manual de bonificación, la sección AUTOMÁTICOS
          COMPLETA se oculta (no solo el footer del total). El motor sustituye
          promo/qty/cliente por el override del operador; mostrar esos steps
          como "Ajustes aplicados por el sistema" mientras el manual también
          está activo es contradictorio y confunde al operador.
          El motor backend puede seguir emitiendo PROMOTION/QUANTITY_DISCOUNT/
          ENTITY_COMMERCIAL_RULE en `pricingSteps` por compatibilidad cuando
          hay `manualDiscountOverride`; el filtro vive en este render
          (display-only), NO se borra info del motor. Al limpiar el override
          (X → manualDiscount=null) la sección vuelve en el siguiente render. */}
      {!hasManualOverride && (
      <div className="space-y-1.5">
        <div className="space-y-0.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted/70">
            Ajustes aplicados por el sistema
          </div>
          {/* Subtítulo técnico ("Pipeline en orden real del motor…") oculto:
              era jerga interna del motor, no info comercial relevante. */}
        </div>
        {auto.length === 0 ? (
          <div className="py-1 text-[10px] italic text-muted/65">
            Sin ajustes automáticos en esta línea.
          </div>
        ) : (
          <>
            <ol className="divide-y divide-border/30 rounded border border-border/30">
              {auto.map((e, i) => renderStep(e, i + 1))}
            </ol>
            {/* Footer "Total automático" — el monto es el EFECTIVO TOTAL
                (passthrough motor: baseInitial − subtotal). Coincide con el
                TPNumber.
                Si Σ steps difiere del efectivo (caso bug `ENTITY_COMMERCIAL_RULE`
                sub-dividido del motor), una nota chica advierte la
                discrepancia sin alarmar al operador. */}
            {/* T19 — Label técnico "Suma de pasos del motor: …" eliminado.
                Era jerga interna (pipeline / discrepancia) que no aporta
                valor comercial al operador. El total efectivo aplicado
                sigue siendo el visible y autoritativo. */}
            <div className="flex items-center justify-between gap-3 border-t-2 border-border/60 pt-1.5 text-[11px]">
              <span className="font-bold uppercase tracking-wide text-text">
                {isSurchargeLn ? "Total recargo" : "Total automático"}
              </span>
              <span className="tabular-nums font-bold text-amber-600 dark:text-amber-500">
                {adjSign}{fmt(effectiveTotal)}
              </span>
            </div>
          </>
        )}
      </div>
      )}

      {/* MANUAL */}
      {manual.length > 0 ? (
        <div className="space-y-1.5 border-t border-border/40 pt-2">
          <div className="space-y-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted/70">
              Ajuste manual
            </div>
            {/* Subtítulo "Override del operador (reemplaza promo y desc.
                por cantidad)" oculto: era jerga técnica. La intención de
                reemplazar el automático ya queda clara con el header y los
                pills "Manual" del editor. */}
          </div>
          <ol className="divide-y divide-border/30 rounded border border-border/30">
            {manual.map((e, i) => renderStep(e, i + 1))}
          </ol>
          {/* Footer "Total manual" — análogo al automático: el monto es el
              EFECTIVO TOTAL de la línea (passthrough motor). Cuando hay
              manual activo, ese efectivo es lo que realmente cobra el motor;
              el detalle de steps puede no sumar al total si el motor
              combinó manual + cliente — la nota debajo lo aclara. */}
          {/* T19 — Idem rama automática: "Suma de pasos manuales del motor"
              eliminado. El total efectivo es el visible. */}
          <div className="flex items-center justify-between gap-3 border-t-2 border-border/60 pt-1.5 text-[11px]">
            <span className="font-bold uppercase tracking-wide text-text">
              {isSurchargeLn ? "Total recargo manual" : "Total manual"}
            </span>
            <span className="tabular-nums font-bold text-amber-600 dark:text-amber-500">
              {adjSign}{fmt(effectiveTotal)}
            </span>
          </div>
        </div>
      ) : (showEmptyManualBlock && (
        <div className="space-y-1.5 border-t border-border/40 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted/70">
            Ajuste manual
          </div>
          <div className="py-1 text-[10px] italic text-muted/65">
            Sin ajuste manual.
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────

export function SaleLineDiscountSummary({
  line,
  currency,
  displayRate = 1,
  showEmptyManualBlock = true,
  defaultOpen = false,
  open: openControlled,
  onOpenChange,
  part = "both",
}: SaleLineDiscountSummaryProps) {
  // Pipeline en orden REAL del motor (modo principal). Si la línea es un
  // preview legacy sin `pricingSteps`, queda `null` y el componente cae al
  // modo agrupado (fallback) — sin romper compatibilidad.
  const pipeline = buildLineDiscountPipeline(line);
  // Modo agrupado por origen (fallback). Lo seguimos calculando porque el
  // header compacto suma bonificaciones y recargos desde acá; es agregación
  // trivial idéntica al pipeline cuando éste existe.
  const groups = buildLineDiscountSources(line);
  const hasAuto   = !isEmptyLineGroup(groups.automatic);
  const hasManual = !isEmptyLineGroup(groups.manual);

  // Cuando NO hay ningún ajuste en la línea: no mostramos NADA (ni header).
  // El operador no se distrae con un bloque vacío en cada línea.
  if (!hasAuto && !hasManual) return null;

  // FUENTE DE VERDAD ÚNICA: descuento EFECTIVO TOTAL de la línea
  // (`baseInitial − subtotalNet`, passthrough del motor). Misma fórmula que
  // usa el TPNumber del editor → header y footers del card SIEMPRE coinciden
  // con el % que muestra el input. Independiente del shape per-step del
  // pipeline (que puede divergir si el motor emite alguno mal — caso
  // documentado: `ENTITY_COMMERCIAL_RULE` con `applyOn=TOTAL` sub-dividido).
  //
  // Hay un único override por línea (manual) que reemplaza los automáticos
  // cuando está activo; la distinción AUTO vs MANUAL en el header es solo
  // semántica (mismo monto efectivo). Si el motor combinó manual + cliente
  // simultáneamente, el monto sigue siendo el efectivo total — los items
  // individuales del detalle desglosan el origen.
  const hasManualOverride = !!line.pricingMeta?.manualDiscount;
  // T10 — magnitud + signo: BONUS (positiva) ⇒ "−$X"; SURCHARGE (negativa)
  // ⇒ "+$X". `lineEffectiveDiscountTotal` solo daba magnitud BONUS y
  // clampaba SURCHARGE a 0 ⇒ el card no se renderizaba para recargos
  // (gate `!hasAuto && !hasManual` ya pasa, pero el header mostraba "$0,00").
  const adjSigned     = lineEffectiveAdjustmentSigned(line);
  const isSurchargeLn = adjSigned < 0;
  const effectiveTotal = Math.abs(adjSigned);
  // Conservamos la fuente clampada por compat de tests existentes.
  void lineEffectiveDiscountTotal;
  // T29 — `headerLabel` removido: el trigger ya no usa "Total automático/
  // manual/recargo" porque el card abierto ya dice "Ajustes aplicados por el
  // sistema" / "Ajuste manual" en sus headers internos. La info del trigger
  // queda en el monto + chevron + "Ver detalle"/"Ocultar".
  const headerSign  = isSurchargeLn ? "+" : "−";
  const headerAmount =
    effectiveTotal > 0.005
      ? `${headerSign}${fmtMoney(effectiveTotal / displayRate, currency)}`
      : fmtMoney(0, currency);
  // Marcador legacy usado solo si el código futuro vuelve a necesitar el
  // header agrupado por origen. Hoy no se usa.
  void formatHeaderAmount;

  // Estado del collapse — controlado externamente (T34) o local (legacy).
  // Cuando el caller provee `open`, se ignora el state interno y se delega
  // el toggle a `onOpenChange`.
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen);
  const isControlled = openControlled !== undefined;
  const open = isControlled ? !!openControlled : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else              setInternalOpen(next);
  };
  const detailsId = React.useId();

  // ─── TRIGGER ───────────────────────────────────────────────────────────
  const triggerNode = (
    <button
      type="button"
      data-tp-enter="ignore"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls={detailsId}
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors cursor-pointer",
        "hover:bg-surface2/30 rounded-md",
      )}
    >
      <span
        className={cn(
          "tabular-nums text-[11px] font-semibold shrink-0",
          // BONUS (descuento) → verde; SURCHARGE → naranja.
          isSurchargeLn
            ? "text-amber-600 dark:text-amber-400"
            : "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {headerAmount}
      </span>
      <span className="inline-flex items-center gap-1 shrink-0">
        <span className="text-[10px] italic text-muted/70">
          {open ? "Ocultar" : "Ver detalle"}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex items-center text-muted/70 transition-transform",
            open && "rotate-180",
          )}
        >
          <ChevronDown size={12} />
        </span>
      </span>
    </button>
  );

  // ─── PANEL (detalle expandido) ─────────────────────────────────────────
  const panelNode = (
    <div
      id={detailsId}
      data-tp-line-discount-summary-panel="true"
      className="space-y-3 rounded-md border border-border/30 bg-surface2/20 px-3 py-2.5"
    >
      {pipeline != null ? (
        <PipelineTimeline
          pipeline={pipeline}
          currency={currency}
          displayRate={displayRate}
          showEmptyManualBlock={showEmptyManualBlock}
          effectiveTotal={effectiveTotal}
          hasManualOverride={hasManualOverride}
          isSurchargeLn={isSurchargeLn}
        />
      ) : (
        <>
          <div className="space-y-1.5">
            <BlockHeader
              title="Ajustes aplicados por el sistema"
              caption="Promoción, descuento por cantidad y cliente."
            />
            {hasAuto ? (
              <RenderGroup g={groups.automatic} currency={currency} displayRate={displayRate} />
            ) : (
              <div className="py-1 text-[10px] italic text-muted/65">
                Sin ajustes automáticos en esta línea.
              </div>
            )}
          </div>
          {hasManual ? (
            <div className="space-y-1.5 border-t border-border/40 pt-2">
              <BlockHeader
                title="Ajuste manual"
                caption={undefined}
              />
              <RenderGroup g={groups.manual} currency={currency} displayRate={displayRate} />
            </div>
          ) : (showEmptyManualBlock && (
            <div className="space-y-1.5 border-t border-border/40 pt-2">
              <BlockHeader
                title="Ajuste manual"
                caption={undefined}
              />
              <div className="py-1 text-[10px] italic text-muted/65">
                Sin ajuste manual.
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  // T34 — Modo `part="trigger"` o `"panel"`: el caller renderiza cada parte
  // en una ubicación distinta del DOM (trigger junto al TPNumber, panel en
  // la zona expandida común debajo del row).
  if (part === "trigger") return triggerNode;
  if (part === "panel")   return panelNode;

  // Modo `both` (default, retrocompat): wrapper + trigger + panel inline.
  return (
    <div
      data-tp-line-discount-summary="true"
      data-tp-open={open ? "true" : "false"}
      className="mt-1 w-full"
    >
      {triggerNode}
      {open && <div className="mt-1">{panelNode}</div>}
    </div>
  );
}

export default SaleLineDiscountSummary;
