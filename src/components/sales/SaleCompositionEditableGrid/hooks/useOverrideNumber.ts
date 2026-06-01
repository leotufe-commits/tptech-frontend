// src/components/sales/SaleCompositionEditableGrid/hooks/useOverrideNumber.ts
// =============================================================================
// useOverrideNumber — copia local del hook de LineAdvancedOverridesPanel.
// Se duplica intencionalmente para no acoplar este módulo al panel legacy.
// Debounce 250ms — un cambio rápido seguido de otro cancela el commit del
// primero (un solo preview backend por intent estable).
//
// Extraído del monolito sin cambios. Mantiene el FIX de `lastSent` que se
// inicializa al valor commiteado INICIAL (no a un sentinel "INIT") para no
// tragarse la PRIMERA edición real del usuario.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { nearlyEqual } from "../helpers";

export function useOverrideNumber(
  initialValue: number | null,
  originalValue: number | null,
  onCommit: (value: number | null) => void,
): {
  value:    number | null;
  setValue: (n: number | null) => void;
  manual:   boolean;
} {
  const [value, setValue] = useState<number | null>(
    initialValue != null ? initialValue : originalValue,
  );

  const lastSyncedRef = useRef<{ initial: number | null; original: number | null }>({
    initial: initialValue, original: originalValue,
  });
  useEffect(() => {
    const last = lastSyncedRef.current;
    if (
      !nearlyEqual(last.initial, initialValue) ||
      !nearlyEqual(last.original, originalValue)
    ) {
      setValue(initialValue != null ? initialValue : originalValue);
      lastSyncedRef.current = { initial: initialValue, original: originalValue };
    }
  }, [initialValue, originalValue]);

  // FIX — `lastSent` se inicializa al valor commiteado INICIAL (no a un
  // sentinel "INIT"). Así el commit de montaje es no-op (same) sin tragarse
  // la PRIMERA edición real del usuario: con el sentinel, si el usuario
  // tocaba la flecha antes del primer timer, ese primer cambio se perdía
  // (había que tocar dos veces). Con el valor inicial real, montar no
  // commitea pero el primer cambio sí.
  const commitRef = useRef<{ timer: number | null; lastSent: number | null }>({
    timer: null,
    lastSent: nearlyEqual(initialValue ?? originalValue, originalValue)
      ? null
      : (initialValue ?? originalValue),
  });
  useEffect(() => {
    const c = commitRef.current;
    if (c.timer) window.clearTimeout(c.timer);
    c.timer = window.setTimeout(() => {
      const next = nearlyEqual(value, originalValue) ? null : value;
      const same =
        (next == null && c.lastSent == null) ||
        (typeof next === "number" && typeof c.lastSent === "number" && nearlyEqual(next, c.lastSent));
      if (same) return;
      c.lastSent = next;
      onCommit(next);
    }, 250);   // Fase 4.3 — debounce 400→250ms (sensación de fluidez ERP).
    return () => { if (c.timer) window.clearTimeout(c.timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, originalValue]);

  const manual = value != null && originalValue != null && !nearlyEqual(value, originalValue);
  return { value, setValue, manual };
}
