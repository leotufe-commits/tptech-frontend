// src/components/sales/TotalDelComprobanteCard/parts/ManualAdjustmentSection.tsx
// =============================================================================
// Etapa A — Ajuste manual UNIFIED del comprobante.
// Etapa C — Ajuste manual BREAKDOWN (solo manual, no redondeo físico).
// POLICY §R-Rounding-1 capa 17.
//
// El operador captura intención. El backend re-corre
// `buildManualAdjustmentSnapshot` y devuelve los valores que el card pinta
// byte a byte. POLICY §R-Rounding-9: cero matemática local — el frontend NO
// calcula `monetaryEquivalent` ni totales.
//
// UNIFIED — aplica sobre el TOTAL UNIFICADO del comprobante:
//   · Un monto humano sobre el `engineTotal`. No distingue dominios.
//
// BREAKDOWN — aplica sobre el SALDO DESGLOSADO (dos dominios PARALELOS):
//   · "Gramos finales" por metal padre — el helper deriva el deltaGrams
//     desde los preGrams del balance del backend. El ajuste físico vive
//     SOLO en su metal padre.
//   · "Hechura / saldo monetario" — ajuste $ sobre el BUCKET no-metal del
//     comprobante (hechura física + productos + servicios + impuestos +
//     envío + descuentos + cupones + canal + forma de pago + redondeos
//     monetarios). El ajuste $ vive SOLO en este bucket y NO contamina
//     los gramos de ningún metal.
//
// Equivalencia monetaria de ajustes de metal (regla crítica):
//   Los ajustes en gramos también impactan monetariamente el comprobante
//   vía `monetaryEquivalent = deltaGrams × metalPricePerGram` que el
//   backend devuelve en el snapshot. El card renderiza ese equivalente al
//   lado de cada metal ajustado y lo suma a "Total final". El valor
//   NUNCA se mueve a la fila "Hechura / saldo monetario" — el ajuste
//   físico sigue perteneciendo al metal padre.
// =============================================================================

import type { ReactElement } from "react";
import { useState } from "react";
import { Plus, X as XIcon, ChevronDown } from "lucide-react";
import TPNumberInput from "../../../ui/TPNumberInput";
import { vt } from "../../../../lib/pricing/visualTokens";
import { formatByType } from "../../../../lib/pricing/format";
import type {
  ManualAdjustmentApiSnapshot,
  ManualAdjustmentApiSnapshotBreakdownMetal,
} from "../../../../services/sales";

// ── Tipos de las props ────────────────────────────────────────────────────

type ManualAdjustmentDraftUnified = {
  scope?: "UNIFIED";
  amount: number;
  reason?: string | null;
};

type ManualAdjustmentDraftBreakdownMetal = {
  metalParentId: string | null;
  metalParentName?: string;
  targetGrams?: number | null;
  deltaGrams?: number | null;
  reason?: string | null;
};

type ManualAdjustmentDraftBreakdown = {
  scope: "BREAKDOWN";
  metals?: ManualAdjustmentDraftBreakdownMetal[];
  monetaryAmount?: number | null;
  reason?: string | null;
};

type ManualAdjustmentDraft =
  | ManualAdjustmentDraftUnified
  | ManualAdjustmentDraftBreakdown
  | null;

export type ManualAdjustmentBreakdownMetalRef = {
  metalParentId: string | null;
  metalParentName: string;
  preGrams: number;
};

export interface ManualAdjustmentSectionProps {
  /** Modo efectivo del documento (UNIFIED / BREAKDOWN). */
  mode?: "UNIFIED" | "BREAKDOWN";
  /** Borrador editable del operador. `null` = sin ajuste activo. */
  draft?: ManualAdjustmentDraft;
  /** Snapshot congelado del backend tras el último preview. */
  snapshot?: ManualAdjustmentApiSnapshot | null;
  /** Total del motor antes del ajuste (`Sale.engineTotal`). */
  engineTotal?: number | null;
  /** Code de la moneda display ("ARS", "USD", …). */
  displayCurrency?: string;
  /** Metales del documento para mostrar como referencia en BREAKDOWN.
   *  `preGrams` se toma del balanceBreakdown del backend (passthrough). */
  breakdownMetals?: ManualAdjustmentBreakdownMetalRef[];
  /** Callback al cambiar el ajuste manual. `null` = quitar ajuste. */
  onChange?: (next: ManualAdjustmentDraft) => void;
  /** Deshabilita el editor (ej. venta confirmada). */
  disabled?: boolean;
}

const EPS_MONEY = 0.005;
const EPS_GRAMS = 0.0001;

function fmtMoney(amount: number, currency: string): string {
  return `${currency ? `${currency} ` : ""}${formatByType(amount, "MONEY")}`;
}

function fmtGrams(g: number): string {
  return `${formatByType(g, "METAL_GRAMS")} gr`;
}

/** Etapa 2E — gramos con signo tipográfico (+ / −) para el "Ajuste resultante".
 *  Display puro: el valor es la resta `targetGrams − preGrams`. */
function fmtSignedGrams(g: number): string {
  const sign = g > 0 ? "+" : g < 0 ? "−" : "";
  return `${sign}${formatByType(Math.abs(g), "METAL_GRAMS")} gr`;
}

// Etapa 2E — Umbrales del warning de "ajuste inusualmente grande" (UX de
// seguridad anti-tipeo). Comparación 100% frontend, NO bloqueante, sin backend.
// Constantes locales del componente — ajustables sin tocar contratos.
const ADJUST_WARN_ABS_GRAMS = 5;   // |delta| > 5 g → inusual
const ADJUST_WARN_RATIO     = 3;   // nuevo ≥ 3× actual ó ≤ 1/3 del actual → inusual

/** ¿El ajuste (preGrams → targetGrams) es "inusualmente grande"? Dispara el
 *  warning visual. Cualquiera de los criterios alcanza:
 *    · |delta| absoluto supera `ADJUST_WARN_ABS_GRAMS`, o
 *    · el nuevo valor es ≥ `ADJUST_WARN_RATIO`× o ≤ 1/ratio del actual.
 *  Comparación pura — no es cálculo comercial. */
function isLargeMetalAdjustment(preGrams: number, targetGrams: number): boolean {
  if (!Number.isFinite(preGrams) || !Number.isFinite(targetGrams)) return false;
  const delta = targetGrams - preGrams;
  if (Math.abs(delta) > ADJUST_WARN_ABS_GRAMS) return true;
  if (preGrams > EPS_GRAMS) {
    const ratio = targetGrams / preGrams;
    if (ratio >= ADJUST_WARN_RATIO || ratio <= 1 / ADJUST_WARN_RATIO) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────

export function ManualAdjustmentSection(props: ManualAdjustmentSectionProps): ReactElement | null {
  const {
    mode = "UNIFIED",
    draft,
    snapshot,
    engineTotal,
    displayCurrency,
    breakdownMetals,
    onChange,
    disabled,
  } = props;

  // ── Hooks SIEMPRE al tope ─────────────────────────────────────────────
  const isUnifiedDraft = !!draft && (draft as any).scope !== "BREAKDOWN";
  const isBreakdownDraft = !!draft && (draft as any).scope === "BREAKDOWN";
  const draftHasMovement =
    (isUnifiedDraft &&
      typeof (draft as ManualAdjustmentDraftUnified).amount === "number" &&
      Number.isFinite((draft as ManualAdjustmentDraftUnified).amount) &&
      Math.abs((draft as ManualAdjustmentDraftUnified).amount) > EPS_MONEY) ||
    (isBreakdownDraft && breakdownDraftHasMovement(draft as ManualAdjustmentDraftBreakdown));
  const [reasonOpen, setReasonOpen] = useState<boolean>(
    Boolean(draft && (draft as any).reason && String((draft as any).reason).length > 0),
  );
  const [open, setOpen] = useState<boolean>(draftHasMovement || snapshot != null);

  const editable = typeof onChange === "function" && !disabled;
  const hasSnapshot = snapshot != null;

  // Modo display-only sin info para mostrar → null.
  // El gate "engineTotal nulo + sin onChange" lo mantenemos para
  // back-compat con tests viejos (caller pasó manualAdjustment sin engineTotal).
  if (!editable && (!hasSnapshot || engineTotal == null)) return null;

  // ── Chip "+ Agregar ajuste manual" cuando NO hay ni draft ni snapshot ─
  if (!open && editable && !draftHasMovement && !hasSnapshot) {
    return (
      <section
        className="border-t border-border/20 pt-3"
        data-testid="total-card-manual-adjustment-toggle"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[11px] text-muted/80 hover:text-text transition-colors"
          data-testid="total-card-manual-adjustment-open"
        >
          <Plus size={12} aria-hidden="true" />
          <span>Agregar ajuste manual</span>
        </button>
      </section>
    );
  }

  // Resumen compacto para el header colapsado: el impacto neto del ajuste.
  // Passthrough — `totals.totalMonetaryAdjustment` ya viene del backend.
  const collapsedDelta =
    hasSnapshot && snapshot
      ? snapshot.totals?.totalMonetaryAdjustment ?? null
      : null;

  return (
    <section
      className="border-t border-border/20 pt-3 border-l-2 border-primary/40 pl-3 space-y-2"
      data-testid="total-card-manual-adjustment"
      data-tp-manual-scope={snapshot?.scope ?? (mode === "BREAKDOWN" ? "BREAKDOWN" : "UNIFIED")}
    >
      {/* Header colapsable — click abre/cierra (comportamiento simétrico con el
          resto de los bloques desplegables del card). */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="total-card-manual-adjustment-body"
        className="flex w-full items-baseline justify-between gap-2 text-left"
        data-testid="total-card-manual-adjustment-header"
      >
        <span className="inline-flex items-center gap-1.5">
          <ChevronDown
            size={13}
            aria-hidden="true"
            className={`shrink-0 text-muted/70 transition-transform ${open ? "rotate-180" : ""}`}
          />
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-text">
            Ajuste manual{mode === "BREAKDOWN" ? " desglosado" : ""}
          </span>
        </span>
        {/* Colapsado con contenido → muestra el impacto neto como resumen.
            Expandido → caption "Intervención humana". */}
        {!open && collapsedDelta != null && Number.isFinite(collapsedDelta) ? (
          <span
            className={`tabular-nums text-[11px] font-semibold ${collapsedDelta < 0 ? vt.colors.discount : "text-text"}`}
            data-testid="total-card-manual-adjustment-collapsed-summary"
          >
            {fmtMoney(collapsedDelta, displayCurrency || "")}
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-muted/70 italic">
            Intervención humana
          </span>
        )}
      </button>

      {open && (
        <div id="total-card-manual-adjustment-body" className="space-y-2">
          <p className="text-[10px] text-muted/70 italic">
            Intervención humana sobre el total final.
          </p>

          {editable && (
            <div className="space-y-2">
              {mode === "BREAKDOWN" ? (
                <BreakdownEditor
                  draft={(isBreakdownDraft ? (draft as ManualAdjustmentDraftBreakdown) : null) ?? null}
                  metals={breakdownMetals ?? []}
                  displayCurrency={displayCurrency}
                  disabled={disabled}
                  onChange={onChange!}
                />
              ) : (
                <UnifiedEditor
                  draft={(isUnifiedDraft ? (draft as ManualAdjustmentDraftUnified) : null) ?? null}
                  displayCurrency={displayCurrency}
                  disabled={disabled}
                  onChange={onChange!}
                />
              )}

              {/* Motivo opcional — colapsado por defecto. */}
              <ReasonEditor
                reasonOpen={reasonOpen}
                setReasonOpen={setReasonOpen}
                draft={draft as ManualAdjustmentDraft}
                mode={mode}
                disabled={disabled}
                onChange={onChange!}
              />
            </div>
          )}

          {/* Display del snapshot del backend — passthrough exacto. */}
          {hasSnapshot && engineTotal != null && (
            <SnapshotDisplay
              snapshot={snapshot!}
              engineTotal={engineTotal}
              displayCurrency={displayCurrency || ""}
            />
          )}
        </div>
      )}
    </section>
  );
}

export default ManualAdjustmentSection;

// ─────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────

function UnifiedEditor(props: {
  draft: ManualAdjustmentDraftUnified | null;
  displayCurrency?: string;
  disabled?: boolean;
  onChange: NonNullable<ManualAdjustmentSectionProps["onChange"]>;
}): ReactElement {
  const { draft, displayCurrency, disabled, onChange } = props;
  const amount = draft?.amount ?? null;
  const hasAmount = typeof amount === "number" && Number.isFinite(amount) && Math.abs(amount) > EPS_MONEY;

  const handleChange = (next: number | null) => {
    const nextAmount = typeof next === "number" && Number.isFinite(next) ? next : 0;
    if (Math.abs(nextAmount) <= EPS_MONEY) {
      onChange(null);
      return;
    }
    onChange({ scope: "UNIFIED", amount: nextAmount, reason: draft?.reason ?? null });
  };

  return (
    <div
      className="flex items-center gap-2"
      data-testid="total-card-manual-adjustment-input"
    >
      <div className="flex-1">
        <TPNumberInput
          value={amount}
          onChange={handleChange}
          formatType="MONEY"
          placeholder="0,00"
          disabled={disabled}
          leftIcon={
            <span className="text-[11px] text-muted/70 px-1">
              {displayCurrency || ""}
            </span>
          }
          onClear={hasAmount ? () => onChange(null) : undefined}
          clearAriaLabel="Quitar ajuste manual"
          clearTitle="Quitar ajuste"
          aria-label="Monto del ajuste manual"
        />
      </div>
    </div>
  );
}

function BreakdownEditor(props: {
  draft: ManualAdjustmentDraftBreakdown | null;
  metals: ManualAdjustmentBreakdownMetalRef[];
  displayCurrency?: string;
  disabled?: boolean;
  onChange: NonNullable<ManualAdjustmentSectionProps["onChange"]>;
}): ReactElement {
  const { draft, metals, displayCurrency, disabled, onChange } = props;

  // Helper: encontrar la entry de un metal en el draft (por id o nombre).
  const findEntry = (
    ref: ManualAdjustmentBreakdownMetalRef,
  ): ManualAdjustmentDraftBreakdownMetal | undefined => {
    return (draft?.metals ?? []).find((m) => {
      if (m.metalParentId != null && ref.metalParentId != null) {
        return m.metalParentId === ref.metalParentId;
      }
      if (m.metalParentId == null && ref.metalParentId == null) {
        return (m.metalParentName ?? "").trim().toLowerCase() ===
          (ref.metalParentName ?? "").trim().toLowerCase();
      }
      return false;
    });
  };

  // Helper: emitir el nuevo draft consolidando las entries y monetary.
  const emit = (
    nextMetals: ManualAdjustmentDraftBreakdownMetal[],
    nextMonetary: number | null,
  ) => {
    const monetaryClean =
      typeof nextMonetary === "number" &&
      Number.isFinite(nextMonetary) &&
      Math.abs(nextMonetary) > EPS_MONEY
        ? nextMonetary
        : null;
    const metalsClean = nextMetals.filter((m) => {
      const hasTarget =
        typeof m.targetGrams === "number" && Number.isFinite(m.targetGrams);
      const hasDelta =
        typeof m.deltaGrams === "number" &&
        Number.isFinite(m.deltaGrams) &&
        Math.abs(m.deltaGrams) > EPS_GRAMS;
      return hasTarget || hasDelta;
    });
    if (metalsClean.length === 0 && monetaryClean == null) {
      onChange(null);
      return;
    }
    onChange({
      scope: "BREAKDOWN",
      metals: metalsClean,
      ...(monetaryClean != null ? { monetaryAmount: monetaryClean } : {}),
      reason: draft?.reason ?? null,
    });
  };

  const handleMetalChange = (
    ref: ManualAdjustmentBreakdownMetalRef,
    nextTarget: number | null,
  ) => {
    const existingMetals = draft?.metals ?? [];
    const others = existingMetals.filter((m) => m !== findEntry(ref));
    const monetary = draft?.monetaryAmount ?? null;

    if (nextTarget == null || !Number.isFinite(nextTarget)) {
      emit(others, monetary);
      return;
    }
    // Solo emit como ajuste si el target difiere de los preGrams.
    if (Math.abs(nextTarget - ref.preGrams) <= EPS_GRAMS) {
      emit(others, monetary);
      return;
    }
    const next: ManualAdjustmentDraftBreakdownMetal = {
      metalParentId:   ref.metalParentId,
      metalParentName: ref.metalParentName,
      targetGrams:     nextTarget,
    };
    emit([...others, next], monetary);
  };

  const handleMonetaryChange = (next: number | null) => {
    emit(draft?.metals ?? [], next);
  };

  const monetaryDraft = draft?.monetaryAmount ?? null;
  const hasMonetary = typeof monetaryDraft === "number" &&
    Number.isFinite(monetaryDraft) &&
    Math.abs(monetaryDraft) > EPS_MONEY;

  return (
    <div className="space-y-2" data-testid="total-card-manual-adjustment-breakdown-editor">
      {metals.length === 0 && (
        <p className="text-[10px] text-muted/60 italic">
          No hay metales en este comprobante.
        </p>
      )}
      {metals.map((ref) => {
        const entry = findEntry(ref);
        const value =
          typeof entry?.targetGrams === "number" && Number.isFinite(entry.targetGrams)
            ? entry.targetGrams
            : null;
        // Etapa 2E — Δ en vivo (display puro): targetGrams − preGrams. Solo se
        // muestra cuando el operador ingresó un valor que difiere del actual.
        const hasTargetValue = typeof value === "number" && Number.isFinite(value);
        const deltaPreview = hasTargetValue
          ? Math.round((value - ref.preGrams) * 10000) / 10000
          : null;
        const showDelta = deltaPreview != null && Math.abs(deltaPreview) > EPS_GRAMS;
        const showWarning = hasTargetValue && isLargeMetalAdjustment(ref.preGrams, value);
        return (
          <div
            key={`${ref.metalParentId ?? "null"}-${ref.metalParentName}`}
            className="space-y-1"
            data-testid="total-card-manual-adjustment-metal-row"
            data-tp-metal-id={ref.metalParentId ?? ""}
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-text truncate">{ref.metalParentName}</div>
                <div className="text-[10px] text-muted/70 tabular-nums">
                  Actual: {fmtGrams(ref.preGrams)}
                </div>
              </div>
              <div className="w-32">
                <TPNumberInput
                  value={value}
                  onChange={(n) => handleMetalChange(ref, n)}
                  formatType="METAL_GRAMS"
                  placeholder={fmtGrams(ref.preGrams)}
                  disabled={disabled}
                  onClear={value != null ? () => handleMetalChange(ref, null) : undefined}
                  clearAriaLabel={`Quitar ajuste de ${ref.metalParentName}`}
                  clearTitle="Quitar"
                  aria-label={`Gramos finales de ${ref.metalParentName}`}
                />
              </div>
            </div>
            {/* Etapa 2E — "Ajuste resultante" en vivo (display-only, NO se envía
                ni persiste; el backend recalcula deltaGrams = target − pre). */}
            {showDelta && (
              <div
                className="flex items-baseline justify-between gap-2 pl-0.5"
                data-testid="total-card-manual-adjustment-delta-preview"
                data-tp-metal-id={ref.metalParentId ?? ""}
              >
                <span className="text-[10px] uppercase tracking-wider text-muted/60">
                  Ajuste resultante
                </span>
                <span
                  className={`tabular-nums text-[11px] font-medium ${deltaPreview! < 0 ? vt.colors.discount : "text-text"}`}
                >
                  {fmtSignedGrams(deltaPreview!)}
                </span>
              </div>
            )}
            {/* Etapa 2E — Warning no bloqueante de ajuste inusual (anti-tipeo). */}
            {showWarning && (
              <div
                className="flex items-start gap-1 text-[10px] leading-snug text-amber-600 dark:text-amber-400"
                role="alert"
                data-testid="total-card-manual-adjustment-warning"
                data-tp-metal-id={ref.metalParentId ?? ""}
              >
                <span aria-hidden="true">⚠️</span>
                <span>Ajuste inusualmente grande. Verifique el valor ingresado.</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Ajuste sobre el BUCKET HECHURA / SALDO MONETARIO.
          Por POLICY §R-Rounding-1, en BREAKDOWN este bucket abarca TODO
          lo no-metal-padre del documento: hechura física, productos,
          servicios, impuestos, envío, descuentos, cupones, canal, forma
          de pago, redondeos monetarios. El ajuste solo afecta este bucket
          — no contamina los gramos de ningún metal. */}
      <div
        className="flex items-center gap-2 pt-1 border-t border-border/15"
        data-testid="total-card-manual-adjustment-hechura-row"
        title="Bucket no-metal: hechura + productos + servicios + impuestos + envío + descuentos + cupones + canal + forma de pago + redondeos monetarios."
      >
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-text">Hechura / saldo monetario</div>
          <div className="text-[10px] text-muted/70">
            Bucket no-metal del comprobante
          </div>
        </div>
        <div className="w-32">
          <TPNumberInput
            value={hasMonetary ? (monetaryDraft as number) : null}
            onChange={handleMonetaryChange}
            formatType="MONEY"
            placeholder="0,00"
            disabled={disabled}
            leftIcon={
              <span className="text-[11px] text-muted/70 px-1">
                {displayCurrency || ""}
              </span>
            }
            onClear={hasMonetary ? () => handleMonetaryChange(null) : undefined}
            clearAriaLabel="Quitar ajuste de hechura / saldo monetario"
            clearTitle="Quitar"
            aria-label="Ajuste manual de hechura / saldo monetario"
          />
        </div>
      </div>
    </div>
  );
}

function ReasonEditor(props: {
  reasonOpen: boolean;
  setReasonOpen: (v: boolean) => void;
  draft: ManualAdjustmentDraft;
  mode: "UNIFIED" | "BREAKDOWN";
  disabled?: boolean;
  onChange: NonNullable<ManualAdjustmentSectionProps["onChange"]>;
}): ReactElement {
  const { reasonOpen, setReasonOpen, draft, mode, disabled, onChange } = props;
  const reason = draft && (draft as any).reason ? String((draft as any).reason) : "";

  const handleReasonChange = (next: string) => {
    const cleaned = next.trim().length > 0 ? next : null;
    if (!draft) {
      // Sin ajuste activo, persistir reason no tiene sentido — lo ignoramos.
      return;
    }
    if (mode === "BREAKDOWN" && (draft as any).scope === "BREAKDOWN") {
      onChange({ ...(draft as ManualAdjustmentDraftBreakdown), reason: cleaned });
    } else {
      onChange({ ...(draft as ManualAdjustmentDraftUnified), scope: "UNIFIED", reason: cleaned });
    }
  };

  if (!reasonOpen) {
    return (
      <button
        type="button"
        onClick={() => setReasonOpen(true)}
        className="text-[10px] text-muted/70 hover:text-text transition-colors"
        data-testid="total-card-manual-adjustment-reason-open"
      >
        + Agregar motivo
      </button>
    );
  }

  return (
    <div className="flex items-start gap-1.5">
      <input
        type="text"
        value={reason}
        onChange={(e) => handleReasonChange(e.target.value)}
        placeholder="Motivo (opcional)"
        disabled={disabled}
        className="flex-1 text-[11px] bg-surface2/40 border border-border/30 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
        aria-label="Motivo del ajuste manual"
        data-testid="total-card-manual-adjustment-reason"
      />
      <button
        type="button"
        onClick={() => {
          setReasonOpen(false);
          if (reason) handleReasonChange("");
        }}
        className="text-muted/60 hover:text-text transition-colors"
        aria-label="Quitar motivo"
      >
        <XIcon size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

function SnapshotDisplay(props: {
  snapshot: ManualAdjustmentApiSnapshot;
  engineTotal: number;
  displayCurrency: string;
}): ReactElement {
  const { snapshot, engineTotal, displayCurrency } = props;

  // Total final post-ajuste para BOTH scopes: engineTotal + totalMonetaryAdjustment.
  // El backend ya nos devuelve este número en `unified.postAmount` (UNIFIED) o
  // lo derivamos desde `totals.totalMonetaryAdjustment` (universal). Para
  // BREAKDOWN tomamos `engineTotal + totals.totalMonetaryAdjustment` (passthrough,
  // sin recalcular: ambos valores vienen del backend con clamp ya aplicado).
  const totalDelta = snapshot.totals?.totalMonetaryAdjustment ?? 0;
  const finalTotal =
    snapshot.scope === "UNIFIED"
      ? snapshot.unified.postAmount
      : engineTotal + totalDelta;

  return (
    <div className="space-y-1 mt-1">
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="text-muted">TPTech calculó</span>
        <span
          className="tabular-nums text-text"
          data-testid="total-card-manual-engine-total"
        >
          {fmtMoney(engineTotal, displayCurrency)}
        </span>
      </div>

      {snapshot.scope === "UNIFIED" ? (
        <div className="flex items-baseline justify-between gap-3 text-[11px]">
          <span className="text-muted">Vendedor ajustó</span>
          <span
            className={`tabular-nums font-semibold ${
              snapshot.totals.monetaryAdjustment < 0 ? vt.colors.discount : "text-text"
            }`}
            data-testid="total-card-manual-delta"
          >
            {fmtMoney(snapshot.totals.monetaryAdjustment, displayCurrency)}
          </span>
        </div>
      ) : (
        <BreakdownSnapshotRows snapshot={snapshot} displayCurrency={displayCurrency} />
      )}

      <div className="flex items-baseline justify-between gap-3 mt-1 border-t border-border/20 pt-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text">
          Total final
        </span>
        <span
          className={`tabular-nums text-sm font-bold ${vt.colors.primary}`}
          data-testid="total-card-manual-final-total"
        >
          {fmtMoney(finalTotal, displayCurrency)}
        </span>
      </div>

      {snapshot.audit.appliedBy && (
        <p className="text-[10px] text-muted/65 italic pt-1">
          Aplicado por {snapshot.audit.appliedBy.userName || "usuario"}
        </p>
      )}
    </div>
  );
}

function BreakdownSnapshotRows(props: {
  snapshot: Extract<ManualAdjustmentApiSnapshot, { scope: "BREAKDOWN" }>;
  displayCurrency: string;
}): ReactElement {
  const { snapshot, displayCurrency } = props;
  return (
    <div className="space-y-1 pl-2 border-l border-border/15">
      {/* Etapa 2E — DELTA protagonista. El pre→post pasa a "Final" secundario.
          Passthrough EXACTO del snapshot backend (deltaGrams / monetaryEquivalent
          / postGrams ya calculados) — cero matemática, sin cambios de contrato. */}
      {snapshot.breakdown.metals.map((m: ManualAdjustmentApiSnapshotBreakdownMetal) => (
        <div
          key={`${m.metalParentId ?? "null"}-${m.metalParentName}`}
          className="text-[11px]"
          data-testid="total-card-manual-metal-row"
          data-tp-metal-id={m.metalParentId ?? ""}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-text truncate flex-1">
              {m.metalParentName}
              {" · "}
              <span
                className={`tabular-nums font-medium ${m.deltaGrams < 0 ? vt.colors.discount : "text-text"}`}
                data-testid="total-card-manual-metal-delta"
              >
                {fmtSignedGrams(m.deltaGrams)}
              </span>
            </span>
            <span
              className={`tabular-nums ${m.monetaryEquivalent < 0 ? vt.colors.discount : "text-text"}`}
              data-testid="total-card-manual-metal-equiv"
            >
              {fmtMoney(m.monetaryEquivalent, displayCurrency)}
            </span>
          </div>
          {/* Final (postGrams) — secundario; el pre→post completo queda como
              dato de contexto, no protagonista. */}
          <div className="text-[10px] text-muted/65 tabular-nums pl-0.5">
            Final: {fmtGrams(m.postGrams)}
            <span className="text-muted/45"> · {fmtGrams(m.preGrams)} → {fmtGrams(m.postGrams)}</span>
          </div>
        </div>
      ))}
      {(snapshot.breakdown.monetary.amount !== 0 || snapshot.breakdown.metals.length === 0) && (
        <div
          className="flex items-baseline justify-between gap-3 text-[11px]"
          data-testid="total-card-manual-hechura-row"
          title="Bucket hechura / saldo monetario — no-metal del comprobante (POLICY §R-Rounding-1)."
        >
          <span className="text-muted">Hechura / saldo monetario</span>
          <span
            className={`tabular-nums ${
              snapshot.breakdown.monetary.amount < 0 ? vt.colors.discount : "text-text"
            }`}
            data-testid="total-card-manual-hechura-amount"
          >
            {fmtMoney(snapshot.breakdown.monetary.amount, displayCurrency)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function breakdownDraftHasMovement(draft: ManualAdjustmentDraftBreakdown): boolean {
  const metals = Array.isArray(draft.metals) ? draft.metals : [];
  const metalsHas = metals.some((m) => {
    const tg = m.targetGrams;
    const dg = m.deltaGrams;
    const hasTarget = typeof tg === "number" && Number.isFinite(tg);
    const hasDelta  = typeof dg === "number" && Number.isFinite(dg) && Math.abs(dg) > EPS_GRAMS;
    return hasTarget || hasDelta;
  });
  const monetary = draft.monetaryAmount;
  const monHas =
    typeof monetary === "number" &&
    Number.isFinite(monetary) &&
    Math.abs(monetary) > EPS_MONEY;
  return metalsHas || monHas;
}
