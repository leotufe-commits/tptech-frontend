// src/lib/sales/applyGlobalPriceListChange.ts
// ============================================================================
// Helper PURO — cambio de lista de precios GLOBAL del documento.
//
// Regla funcional TPTech:
//   El selector global de lista (cabecera del documento) afecta TODAS las
//   líneas — existentes y futuras. Cuando el operador lo cambia, ninguna
//   línea puede quedar usando la lista anterior por sorpresa.
//
// Para la Etapa actual, la política es la más simple y segura:
//   · Cambia `draft.priceListId` al nuevo id (o `undefined` si "Sin lista").
//   · Setea `priceListExplicitlyCleared` para coordinar con el useEffect
//     de favoritos del modal (ver Nota 2 abajo).
//   · Limpia el override por línea: `priceListIdOverride = null`,
//     `priceListOverride = false` en todas las líneas que lo tenían.
//   · El render del badge "Línea" (`hasOverride =
//     typeof l.priceListIdOverride === "string"` en `TPDocumentLineAdvancedEditor`)
//     desaparece automáticamente porque los overrides quedan en `null`.
//   · El preview se dispara solo: `usePreviewFlow` observa el `draft` y
//     `priceListId` viaja en el payload + cada línea reporta
//     `priceListIdOverride: null` ⇒ el motor recalcula precio, descuentos,
//     impuestos, redondeos y promociones contra la lista global nueva.
//
// El helper es PURO (cero side effects, no muta el draft de entrada,
// no abre red, no toca preview). Solo retorna el nuevo `SalesInvoice`.
// La integración (handler + preview) la decide el caller.
//
// Si después el operador vuelve a tocar el selector PER-LÍNEA, el badge
// "Línea" vuelve a aparecer solo en esa línea — ese flujo ya existe
// (`onChangeLinePriceList` en `VentasFacturas.tsx`) y este helper no lo
// altera.
//
// Nota 2 (P0.1 — H1+H2):
//   El useEffect de favoritos en `VentasFacturas.tsx:3271-3320` aplica la
//   favorita del tenant cuando `!draft.priceListId && draft.priceListExplicitlyCleared !== true`.
//   Si el operador elige "Sin lista" → la favorita NO debe volver a aparecer
//   automáticamente. Por eso el helper también setea el flag:
//     · `nextPriceListId` null/empty/undefined → flag = `true`  (decisión explícita).
//     · `nextPriceListId` con id real          → flag = `false` (decisión nueva pisa flag previo).
//   Sin esta coordinación, unificar el popover del header (que ya seteaba
//   el flag inline) bajo este helper rompería la promesa de "Sin lista".
// ============================================================================

import type { SalesInvoice } from "./types";

/** Limpia `priceListIdOverride` + `priceListOverride` de UNA línea si
 *  tenía alguno seteado. Si la línea ya estaba limpia, devuelve la misma
 *  referencia (para preservar identidad cuando el `map` no cambia nada
 *  y evitar re-renders innecesarios). */
function clearLineOverride<L extends {
  priceListIdOverride?: string | null;
  priceListOverride?:   boolean;
}>(line: L): L {
  const hadId        = line.priceListIdOverride != null;
  const hadFlag      = line.priceListOverride === true;
  if (!hadId && !hadFlag) return line;
  return { ...line, priceListIdOverride: null, priceListOverride: false };
}

/**
 * Cambia la lista de precios GLOBAL del documento y limpia el override
 * de lista de TODAS las líneas (Etapa: política "aplicar a todas").
 *
 * @param draft         Draft actual del comprobante.
 * @param nextPriceListId Nueva lista global. `null`/`undefined` = "Sin lista"
 *                      (el documento queda sin lista global; las líneas
 *                      pierden su override anterior pero pasan a depender
 *                      de la cadena de fallback del backend: cliente → favorito).
 * @returns Nuevo `SalesInvoice` con `priceListId` actualizado, el flag
 *          `priceListExplicitlyCleared` coordinado y todas las líneas sin
 *          override. NO muta el draft de entrada.
 *
 * Notas:
 *   · No dispara preview ni red — el caller decide cuándo. Como cambia el
 *     `draft`, el `usePreviewFlow` ya programado dispara solo.
 *   · El payload del próximo preview enviará `priceListId` global + cada
 *     línea con `priceListIdOverride: null` (passthrough exacto a
 *     `buildSalePreviewPayload`).
 *   · No toca el `pricing-engine` (no calcula nada).
 */
export function applyGlobalPriceListChange(
  draft: SalesInvoice,
  nextPriceListId: string | null | undefined,
): SalesInvoice {
  const normalizedId =
    typeof nextPriceListId === "string" && nextPriceListId.length > 0
      ? nextPriceListId
      : undefined;

  return {
    ...draft,
    priceListId: normalizedId,
    // Cambiar la LISTA GLOBAL vuelve el modo de saldo a AUTOMÁTICO: se descarta
    // el override manual del footer para que el modo de la NUEVA lista (o el
    // del cliente, que tiene prioridad mayor) resuelva por jerarquía y el footer
    // + las líneas se actualicen en sincronía. (Un ajuste manual BREAKDOWN sigue
    // forzando BREAKDOWN en `buildSalePreviewPayload` — sin riesgo de 400.)
    balanceModeOverride: null,
    // P0.1 — Coordinación con el useEffect de favoritos.
    //   · "Sin lista" (normalizedId === undefined) → flag = true.
    //   · Lista nueva                              → flag = false.
    priceListExplicitlyCleared: normalizedId === undefined,
    lines: draft.lines.map((l) => clearLineOverride(l)),
  };
}
