// src/components/sales/SaleCompositionEditableGrid/parts/AdjustmentLabelEditor.tsx
// =============================================================================
// FASE F9 — AdjustmentLabelEditor: editor inline siempre visible.
// Sin pill, sin ✎, sin ✓/×, sin popover. Tres controles compactos en línea:
//   [signo +/−] [valor numérico] [unidad %/$]
//   −  = BONUS    (descuento)
//   +  = SURCHARGE (recargo)
//   %  = PERCENTAGE
//   $  = FIXED_AMOUNT
// Cada cambio crea/actualiza el override completo (kind+type+value) para
// que el motor backend reciba el patch consistente, incluso cuando se
// arranca desde "sin ajuste" o desde un original del catálogo. Cero
// matemática nueva — el monto/impacto sigue viniendo del preview.
// =============================================================================

import { cn } from "../../../ui/tp";
import { formatMoneyDoc as fmtMoney } from "../../../../lib/pricing/format";
import { useOverrideNumber } from "../hooks/useOverrideNumber";
import { CellNumberInput } from "./CellNumberInput";
import { PrefixedField } from "./PrefixedField";

export function AdjustmentLabelEditor({
  kind, type, value, currency, disabled, onChange,
  originalKind, originalType, originalValue, originalAmount,
  currentAmount,
}: {
  kind:     "BONUS" | "SURCHARGE" | null;
  type:     "PERCENTAGE" | "FIXED_AMOUNT" | null;
  value:    number | null;
  currency: string;
  disabled?: boolean;
  onChange: (patch: {
    adjustmentKind?:  "BONUS" | "SURCHARGE" | null;
    adjustmentType?:  "PERCENTAGE" | "FIXED_AMOUNT" | null;
    adjustmentValue?: number | null;
  }) => void;
  originalKind?:   "BONUS" | "SURCHARGE" | null;
  originalType?:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
  originalValue?:  number | null;
  originalAmount?: number | null;
  /** @deprecated Recálculo local (`lineCost − unitVal·qty`) — currency-unsafe
   *  en líneas NO base (mezcla moneda base con original). Ya NO se usa para
   *  el label de impacto: la fuente es `originalAmount` (= `lineAdjAmount`
   *  del motor, moneda base). Se mantiene en el contrato para no romper
   *  callers; eliminar cuando se limpien los sitios de invocación. */
  currentAmount?:  number | null;
}) {
  // Valores efectivos para el render: override → original → defaults.
  const hasOverride = kind != null;
  const effKind:  "BONUS" | "SURCHARGE"            = (kind  ?? originalKind  ?? "BONUS");
  const effType:  "PERCENTAGE" | "FIXED_AMOUNT"    = (type  ?? originalType  ?? "PERCENTAGE");
  const effValue: number | null                     = hasOverride ? value : (originalValue ?? null);

  const isBonus   = effKind === "BONUS";
  const isPercent = effType === "PERCENTAGE";
  const signCls   = isBonus
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";

  // Cualquier change envía el trío completo para que el override quede
  // consistente aún si arrancaba en null.
  const apply = (patch: Partial<{
    adjustmentKind:  "BONUS" | "SURCHARGE";
    adjustmentType:  "PERCENTAGE" | "FIXED_AMOUNT";
    adjustmentValue: number | null;
  }>) => {
    onChange({
      adjustmentKind:  patch.adjustmentKind  ?? effKind,
      adjustmentType:  patch.adjustmentType  ?? effType,
      adjustmentValue: patch.adjustmentValue ?? effValue ?? 0,
    });
  };

  const flipSign = () => apply({ adjustmentKind: isBonus ? "SURCHARGE" : "BONUS" });
  const flipUnit = () => apply({ adjustmentType: isPercent ? "FIXED_AMOUNT" : "PERCENTAGE" });
  const setValue = (v: number | null) => apply({ adjustmentValue: v ?? 0 });

  // FIX oscilación flechitas — mismo patrón que MermaLabelEditor/Cantidad:
  // commit DEBOUNCED vía `useOverrideNumber` en lugar de `setValue` síncrono
  // por cada tick. El commit por tick re-renderizaba `TPNumberInput` con el
  // `value` prop aún viejo (parent async) → su effect lo revertía y el valor
  // oscilaba (10 → 10,5 → 10 → 10,5). `originalValue=null` → emite siempre el
  // valor literal (misma semántica que el `setValue` directo). El sync del
  // hook re-hidrata cuando cambia `effValue` real (toggle %/$, signo,
  // preview/reset).
  const { value: adjLocal, setValue: setAdjLocal } = useOverrideNumber(
    effValue, null, (v) => setValue(v),
  );

  // FASE F25 — eliminado el render del "ajuste original tachado" debajo
  // del editor. Aparecía por un segundo al editar mientras viajaba el
  // preview y daba sensación de flash/glitch. La info del original sigue
  // disponible via props para futuros consumidores; solo se removió el
  // render visual.

  // FIX — el impacto del ajuste es SIEMPRE el `lineAdjAmount` que emite el
  // motor (`originalAmount`): passthrough en moneda BASE, ya = baseConvertida
  // × %, correcto aún con conversión de moneda y tras edición inline (el
  // preview se refetchea con el override aplicado y el motor reemite el
  // dato). El path anterior usaba `currentAmount` (= lineCost − unitVal·qty)
  // cuando había override: en líneas NO base eso MEZCLA monedas (lineCost en
  // base vs unitVal en USD) y mostraba ~el total de la línea en lugar del
  // impacto del 10%. Usar siempre el backend da paridad con el bloque
  // read-only (Simulador == Factura). `currentAmount` queda deprecado.
  void currentAmount;
  const showAmount = originalAmount != null ? originalAmount : null;
  const amountText = showAmount != null && Math.abs(Number(showAmount)) > 0
    ? `${isBonus ? "−" : "+"}${currency} ${fmtMoney(Math.abs(Number(showAmount)))}`
    : null;

  // FASE F11 — signo y unidad como prefix/suffix INTERACTIVOS del wrap.
  // El wrap se ve como UN solo control compacto: `[− 11,00 %]` / `[+ 5,00 $]`.
  // Los botones siguen siendo buttons (no decorativos): tabIndex=-1 los
  // mantiene fuera del flujo TAB, pero responden a click.
  // FASE F13 — buttons compactados a w-3.5 y el input ensanchado a w-[96px]
  // para dar prioridad visual al número. Antes: w-4 + w-[60px], el "+/−" y
  // "%/$" robaban espacio y el número quedaba truncado.
  const signButton = (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onClick={flipSign}
      title={isBonus
        ? "Bonificación (−). Click para cambiar a recargo (+)."
        : "Recargo (+). Click para cambiar a bonificación (−)."}
      aria-label={isBonus ? "Signo: bonificación" : "Signo: recargo"}
      className={cn(
        "h-5 w-3.5 rounded text-[12px] font-bold leading-none tabular-nums hover:bg-surface2",
        signCls,
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {isBonus ? "−" : "+"}
    </button>
  );
  const unitButton = (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onClick={flipUnit}
      title={isPercent ? `Porcentaje (toggle a ${currency || "$"})` : `Monto fijo (toggle a %)`}
      aria-label={isPercent ? "Unidad: porcentaje" : "Unidad: monto fijo"}
      className={cn(
        "h-5 w-3.5 rounded text-[10px] font-semibold text-muted/85 hover:bg-surface2 hover:text-text",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {isPercent ? "%" : "$"}
    </button>
  );

  return (
    <div
      data-adjustment-inline-editor
      className="inline-flex flex-col items-end gap-0"
    >
      <PrefixedField
        prefix={signButton}
        suffix={unitButton}
        prefixStatic={false}
        suffixStatic={false}
        interactive={!disabled}
      >
        <CellNumberInput
          value={adjLocal}
          onChange={setAdjLocal}
          formatType="PERCENT"
          decimals={2}
          // Step 1,00 para % y $ (antes 0,5 en %): saltos enteros estables.
          step={1}
          readOnly={disabled}
          widthClass="w-[128px]"
          noInputBg
        />
      </PrefixedField>
      {/* Monto signado debajo (display only) cuando el backend lo emite. */}
      {amountText && (
        <span className={cn("text-[10px] tabular-nums leading-tight px-0.5", signCls, "opacity-90")}>
          {amountText}
        </span>
      )}
      {/* FASE F25 — render del "Ajuste original del artículo" tachado
          eliminado. Causaba flash visual al editar (parpadeaba mientras
          viajaba el preview). El input mantiene el valor editado limpio
          sin overlay legacy. */}
    </div>
  );
}
