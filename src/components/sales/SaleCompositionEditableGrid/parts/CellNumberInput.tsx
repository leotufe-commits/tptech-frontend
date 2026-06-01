// src/components/sales/SaleCompositionEditableGrid/parts/CellNumberInput.tsx
// =============================================================================
// CellNumberInput — input numérico compacto alineado a la derecha.
// Extraído del monolito sin cambios; el contrato de props y semántica se
// mantienen para que callers (MermaLabelEditor, AdjustmentLabelEditor,
// EditableRow) sigan funcionando idénticamente.
// =============================================================================

import TPNumberInput from "../../../ui/TPNumberInput";
import { cn } from "../../../ui/tp";
import { nearlyEqual } from "../helpers";

export function CellNumberInput({
  value, onChange, decimals = 2, step = 0.01, suffix,
  readOnly = false, disabled = false, tooltip, widthClass,
  original, decimalsOriginal, formatOriginal,
  noInputBg = false, formatType,
}: {
  value:    number | null;
  onChange: (v: number | null) => void;
  decimals?: number;
  /** Tipo del motor central — el input respeta región/decimales del tenant. */
  formatType?: import("../../../../lib/number-format").NumberFormatType;
  step?:     number;
  suffix?:   React.ReactNode;
  readOnly?: boolean;
  disabled?: boolean;
  tooltip?:  string;
  widthClass?: string;
  /**
   * Fase 2.1 — valor original del backend (sin override). Cuando difiere de
   * `value`, se muestra debajo del input en gris/tachado para que el operador
   * vea claro qué viene del catálogo y qué editó.
   */
  original?: number | null;
  /** Decimales para el render del original (default = `decimals`). */
  decimalsOriginal?: number;
  /** Formato custom del original (default: toLocaleString es-AR). */
  formatOriginal?: (v: number) => string;
  /** FASE 12.20 — el input vive dentro de un `PrefixedField` que aplica
   *  hover/focus-within a TODO el campo compuesto. Para evitar
   *  double-feedback, este flag suprime las clases hover/focus del
   *  input interno (sólo se mantiene la transición y el tinte amber del
   *  manual override). */
  noInputBg?: boolean;
}) {
  const isInteractive = !readOnly && !disabled;
  const hasManualOverride =
    original != null && value != null && !nearlyEqual(original, value);
  // FASE 12.23 — el tachado del "valor original" debajo del input se
  // eliminó: aparecía como flash al editar y ensuciaba la tabla. El
  // manual override sigue marcándose con el `text-amber` del input
  // (`hasManualOverride`) y con el punto/etiqueta "Manual" en el primary
  // del componente. Las props `original` / `decimalsOriginal` /
  // `formatOriginal` se mantienen en el contrato del componente para no
  // romper callers, pero ya no se renderean.
  void original; void decimalsOriginal; void formatOriginal;
  return (
    <div
      className={cn(
        "inline-flex flex-col items-end",
        // Manual: borde-resalte sutil + valor más bold via clase del input.
      )}
      title={!isInteractive ? tooltip : undefined}
    >
      <TPNumberInput
        value={value}
        onChange={onChange}
        formatType={formatType}
        decimals={decimals}
        step={step}
        suffix={suffix}
        showArrows={isInteractive}
        readOnly={readOnly}
        disabled={disabled}
        // Fase 2.1 fix layout — `compact` es OBLIGATORIO acá. El input está
        // forzado a `!h-6` (24px) y sin compact los arrows usan `h-5 w-8`
        // (20×32px) + `mt-0.5` → stack ~42px, sobresale ~9px arriba/abajo
        // del input. En compact los arrows son `h-3.5 w-5` (14×20) → stack
        // ~28px, encajan en 24px. Compact también ajusta padding-right
        // (3rem vs 4rem) para que el suffix no compita con los arrows.
        compact
        className={cn(
          "!h-6 !text-[11px] text-right tabular-nums",
          isInteractive ? (widthClass ?? "w-[88px]") : (widthClass ?? "w-[80px]"),
          !isInteractive && "cursor-help opacity-70",
          // ── FASE 12.17 — texto editable + feedback con color del theme ──
          // Anulamos el `tp-input` global (rounded-xl + border + shadow) y
          // dejamos texto plano. Feedback visual SOLO en hover/focus,
          // usando el `primary` del theme (var --primary-rgb) en lugar de
          // un azul Google hardcoded. El `!` es necesario porque
          // `tp-input` tiene specificity propia desde index.css.
          "!bg-transparent !rounded-sm !shadow-none !border-0",
          isInteractive && !noInputBg && "hover:!bg-primary/[0.05] dark:hover:!bg-primary/[0.08]",
          isInteractive && !noInputBg && "focus:!bg-primary/[0.06] dark:focus:!bg-primary/[0.10]",
          // Línea inferior 1px en color del theme, dibujada vía inset-shadow
          // para no alterar la altura del input. Cuando el input está dentro
          // de un `PrefixedField`, el wrap externo aplica este feedback al
          // campo completo — el input no lo duplica.
          isInteractive && !noInputBg && "focus:!shadow-[inset_0_-1px_0_0_rgb(var(--primary-rgb)_/_0.7)]",
          "!transition-[background-color,box-shadow] !duration-150",
          // Manual override: texto un poco más bold + tinte amber, marca
          // sutil sin agregar caja ni outline.
          hasManualOverride && "!font-semibold !text-amber-700 dark:!text-amber-400",
        )}
        wrapClassName="!w-auto"
      />
    </div>
  );
}
