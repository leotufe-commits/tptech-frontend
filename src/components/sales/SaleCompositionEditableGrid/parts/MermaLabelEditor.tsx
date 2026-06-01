// src/components/sales/SaleCompositionEditableGrid/parts/MermaLabelEditor.tsx
// =============================================================================
// FASE F9 — Merma como input siempre visible (sin pill, sin ✎, sin
// snapshot/cancel). Se renderea similar al campo de Cantidad: input
// compacto con sufijo "%" fijo a la derecha.
// FASE F10 — el origen entre paréntesis (Catálogo/Cliente/Manual/—) se
// eliminó del render. La prop `mermaSource` se mantiene en el contrato
// del componente para no romper callers, pero ya no se muestra.
// =============================================================================

import { READ_ONLY_TOOLTIP } from "../constants";
import { useOverrideNumber } from "../hooks/useOverrideNumber";
import { CellNumberInput } from "./CellNumberInput";
import { PrefixedField } from "./PrefixedField";
import type { MermaSource } from "../types";

export function MermaLabelEditor({
  value, original, onChange, readOnly, mermaSource,
}: {
  value:    number | null;
  original: number | null;
  onChange: (v: number | null) => void;
  readOnly?: boolean;
  mermaSource?: MermaSource;
}) {
  // FASE F10 — mermaSource ya no se renderea; aceptado para compat de callers.
  void mermaSource;
  // FIX oscilación flechitas — commit DEBOUNCED vía `useOverrideNumber`
  // (igual que Cantidad/Costo unit.), en vez de llamar `onChange` síncrono
  // por cada tick de la flecha. El commit por tick re-renderizaba
  // `TPNumberInput` con el `value` prop aún viejo (parent async) y su
  // effect lo trataba como "cambio externo" revirtiendo el valor:
  // 10 → 10,5 → 10 → 10,5. Con el hook, el valor local es estable y se
  // commitea una sola vez al pausar. `originalValue=null` → siempre emite
  // el valor literal (misma semántica que el onChange directo; el grid
  // hace `v ?? 0`). El sync interno del hook re-hidrata si el parent
  // cambia el valor de verdad (preview/reset).
  const { value: mermaLocal, setValue: setMermaLocal } = useOverrideNumber(
    value, null, (v) => onChange(v),
  );
  // FASE F13 — el label "Merma" se elimina del editor; el sufijo "%" alcanza
  // como pista contextual. El número queda como protagonista visual. El
  // input se ensancha (w-[120px]) para que cabe "-100,00" con 2–3 decimales
  // sin truncado, considerando los ~36px que `pr-9` del compact reserva
  // para los arrows.
  return (
    <div
      data-merma-inline-editor
      className="inline-flex items-center"
    >
      <PrefixedField suffix="%" interactive={!readOnly}>
        <CellNumberInput
          value={mermaLocal}
          onChange={setMermaLocal}
          formatType="MERMA_PERCENT"
          decimals={2}
          // Step 1,00 (antes 0,5): saltos enteros estables, sin oscilar.
          step={1}
          widthClass="w-[176px] max-w-none"
          original={original}
          readOnly={readOnly}
          tooltip={readOnly ? READ_ONLY_TOOLTIP : undefined}
          noInputBg
        />
      </PrefixedField>
    </div>
  );
}
