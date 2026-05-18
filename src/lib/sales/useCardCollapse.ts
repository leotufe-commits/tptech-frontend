// src/lib/sales/useCardCollapse.ts
// ============================================================================
// Hook reutilizable para colapsar/expandir cards con persistencia en
// localStorage. Mantiene la preferencia entre sesiones y entre navegaciones.
//
// Extraído de VentasFacturas.tsx durante FASE 8.2.4. Consolida 4 pares
// `useState + useEffect` idénticos (DiscountCard, ShippingCard, PaymentCard,
// AccountImpactCard) en una sola pieza testeable.
//
// SSR-safe: en server (`typeof window === "undefined"`) el hook devuelve el
// `fallback` y NO intenta leer/escribir localStorage.
//
// El hook NO toca otras claves de localStorage. Si querés migrar / borrar
// preferencias viejas, hacelo desde un script de migración aparte (Storage
// schema versioning queda fuera de scope).
// ============================================================================

import { useEffect, useState, useCallback } from "react";

/**
 * Lee un valor booleano de localStorage con fallback.
 * Pure helper — exportado para tests / migraciones.
 *
 * Reglas de parsing:
 *   - "true"  → true
 *   - "false" → false
 *   - cualquier otra cosa (null, "yes", etc.) → fallback
 */
export function readBoolPref(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v === "true")  return true;
    if (v === "false") return false;
  } catch {
    // localStorage puede tirar (modo incógnito, quota, etc.) — caemos al fallback.
  }
  return fallback;
}

/** Tipo del setter — acepta valor directo o updater function como `useState`. */
export type CardCollapseSetter = (next: boolean | ((prev: boolean) => boolean)) => void;

/**
 * Hook de colapso de card con persistencia en localStorage.
 *
 * @param key       Clave de localStorage (usar `lsKey()` de `document-types`).
 * @param defaultOpen  Estado inicial cuando no hay valor persistido.
 *
 * @returns Tuple `[open, setOpen]` — misma firma que `useState<boolean>`.
 *
 * Comportamiento:
 *   - El initial state se lee de localStorage UNA VEZ (al mount).
 *   - Cada cambio dispara persistencia automática.
 *   - SSR safe: si no hay `window`, retorna `defaultOpen` y NO escribe.
 *   - Errores de localStorage (quota, modo incógnito) se silencian.
 *
 * Ejemplo:
 * ```tsx
 * const [discountOpen, setDiscountOpen] = useCardCollapse(DISCOUNT_CARD_KEY, true);
 * <TPCard collapsible open={discountOpen} onOpenChange={setDiscountOpen} />
 * ```
 */
export function useCardCollapse(
  key: string,
  defaultOpen: boolean,
): [boolean, CardCollapseSetter] {
  const [open, setOpen] = useState<boolean>(() => readBoolPref(key, defaultOpen));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, String(open));
    } catch {
      // Silenciar — coherente con readBoolPref.
    }
  }, [key, open]);

  // setOpen ya es estable (referencia del useState) — devolvemos tal cual.
  // Lo envolvemos en useCallback solo para forzar la firma `CardCollapseSetter`
  // y simplificar la inferencia TS al consumir el hook.
  const setOpenStable: CardCollapseSetter = useCallback((next) => setOpen(next), []);
  return [open, setOpenStable];
}
