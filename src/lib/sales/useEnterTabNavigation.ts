// src/lib/sales/useEnterTabNavigation.ts
// =============================================================================
// FASE 4.5 — Enter = next field para Factura de ventas (uso intensivo ERP).
//
// Objetivo: que el operador presione Enter en un input editable y el foco
// avance al siguiente input editable dentro del scope. Shift+Enter retrocede.
//
// Reglas no-negociables:
//   · Solo opera dentro del `containerRef` (scope acotado, no global).
//   · No intercepta Enter en textarea, combobox abierto, o cuando un
//     dropdown/menu tiene `aria-expanded="true"` en el DOM activo.
//   · Respeta `tabIndex={-1}` — los buttons/toggles fuera del flujo TAB
//     siguen estando fuera del flujo Enter.
//   · Skipea inputs `[disabled]` y `[readonly]`.
//   · Commit del valor actual ocurre naturalmente vía blur del input
//     que pierde el foco (TPNumberInput tiene su propio onBlur que
//     dispara onChange con el valor actual).
//
// Feature flag: el hook acepta `enabled: boolean` para apagarlo en runtime
// si emerge un caso edge no contemplado.
// =============================================================================

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  // Inputs editables — excluye disabled, readonly, y tabIndex=-1.
  'input:not([disabled]):not([readonly]):not([tabindex="-1"]):not([type="hidden"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([readonly]):not([tabindex="-1"])',
].join(",");

/**
 * Devuelve true si en el DOM hay algún elemento `[aria-expanded="true"]`.
 * Si lo hay, asumimos que un combobox / menu / popover está abierto y
 * NO interceptamos Enter (lo dejamos llegar a su handler propio).
 */
function isMenuOpen(): boolean {
  return !!document.querySelector('[aria-expanded="true"]');
}

/**
 * Hook que aplica navegación por Enter dentro del `containerRef`.
 * Llamarlo una vez por contenedor (típicamente el modal o el editor).
 */
export function useEnterTabNavigation(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    if (!root) return;

    function handler(e: KeyboardEvent) {
      if (e.key !== "Enter") return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Solo interceptamos cuando el target es un INPUT (text/number).
      // Para textarea, dejar Enter como salto de línea (default).
      if (target.tagName !== "INPUT") return;
      const input = target as HTMLInputElement;
      const t = (input.type || "").toLowerCase();
      if (t === "checkbox" || t === "radio" || t === "submit" ||
          t === "button"   || t === "reset" || t === "file") return;

      // Si hay un combobox / menu / popover abierto, dejar que su handler
      // maneje Enter (selección, etc.).
      if (isMenuOpen()) return;

      // Comportamiento estándar: el target debe estar dentro del root.
      const r = containerRef.current;
      if (!r || !r.contains(input)) return;

      // Busca todos los focusables dentro del root y ordena por DOM.
      const focusables = Array.from(
        r.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const idx = focusables.indexOf(input);
      if (idx === -1) return;

      const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
      const next = focusables[nextIdx];
      if (!next) return;     // último input — no hacer nada (evita loop).

      e.preventDefault();
      // Fuerza blur del input actual para que su onBlur commite el valor
      // antes del cambio de foco. focus() del siguiente input ya dispara
      // blur del actual de forma natural, pero hacerlo explícito asegura
      // el orden en navegadores que reordenen los eventos async.
      input.blur();
      next.focus();
      // Para inputs numéricos, seleccionar todo el contenido facilita
      // la sobreescritura inmediata (UX ERP estándar).
      if (next instanceof HTMLInputElement) {
        try { next.select(); } catch { /* no-op */ }
      }
    }

    // Capturamos en el contenedor (no document) para no afectar otras zonas.
    root.addEventListener("keydown", handler);
    return () => root.removeEventListener("keydown", handler);
  }, [containerRef, enabled]);
}
