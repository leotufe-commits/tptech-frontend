// src/components/sales/SaleCompositionEditableGrid/hooks/useFlashOnChange.ts
// =============================================================================
// Fase 2.1 — flash sutil cuando un valor numérico cambia.
//
// Devuelve una clase Tailwind con opacidad bg-emerald que se aplica durante
// ~700ms tras una actualización del `value`. Cero animación pesada — solo
// un `transition-colors` corto que ayuda al ojo a localizar el cambio
// (total línea, margen, total componentes).
//
// Parámetro opcional `key`: si se pasa, el flash dispara cuando ese key
// cambia (útil cuando el value es estable pero el contexto cambió, o para
// forzar reset).
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { nearlyEqual } from "../helpers";

export function useFlashOnChange(value: number | null | undefined, key?: string): string {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef<{ value: number | null | undefined; key: string | undefined }>({
    value, key,
  });
  useEffect(() => {
    const prev = prevRef.current;
    const valueChanged =
      typeof prev.value === "number" && typeof value === "number"
        ? !nearlyEqual(prev.value, value)
        : prev.value !== value;
    const keyChanged = prev.key !== key;
    if (valueChanged || keyChanged) {
      prevRef.current = { value, key };
      // El estado inicial no debería disparar flash — la primera vez que el
      // hook corre, prev.value === value (porque ref se inicializó con
      // value), así que valueChanged=false. El flash dispara solo en
      // re-renders donde value/key efectivamente cambian.
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 700);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [value, key]);
  return flash ? "bg-emerald-500/10" : "";
}
