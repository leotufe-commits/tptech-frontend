// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/cardConstraints.ts
// ============================================================================
// CARD_CONSTRAINTS — single source of truth de minW/minH/maxW/maxH por id.
//
// Esta tabla define el ESPACIO MÍNIMO realista que cada card necesita para
// renderear su contenido de forma legible. El motor de resize
// (`clampSize` en `LayoutGridContext`) la usa como FLOOR — aunque un
// preset declare un minH más bajo, el clamp lo eleva al mínimo definido
// acá. Esto evita que el operador pueda dejar un card visualmente roto
// (input cortado, header sin body, etc.) por accidente.
//
// Valores derivados del contenido real de cada componente:
//
//   · header (locked, full-width):   minH 2 → 32px (header del documento).
//   · lines (locked, edit area):     minH 10 → 160px (tabla + filas).
//   · discount/shipping (toggle +    minH 4 → 64px (header colapsable +
//     combo + monto):                              input compacto).
//   · coupon (input + apply):        minH 3 → 48px (línea simple).
//   · totals (★ card principal,      minH 6 → 96px (balance + breakdown
//     financiero):                                + mode switch).
//   · payments (lista variable):     minH 5 → 80px (header + ≥1 pago).
//   · account-impact (read-only):    minH 4 → 64px (balance + nota).
//   · observations (text area):      minH 3 → 48px (header colapsable
//                                                   solo; expandida ideal 5+).
//
// MIN_W canónicos:
//   · header / lines: minW 6 (no permiten anchos absurdos en main).
//   · cards de aside: minW 3 (la mayoría requiere al menos input + label).
//
// Cero acoplamiento al pricing-engine, cero efectos. Pura tabla de datos.
// ============================================================================

import type { CardId } from "./types";

export type CardConstraints = {
  minW: number;
  minH: number;
  maxW?: number;
  maxH?: number;
};

/** Tabla central de constraints por card. Modificar acá impacta:
 *   · los 3 presets base (que importan estos valores).
 *   · el `clampSize` del LayoutGridContext (floor de resize).
 *   · `reconcileLayoutV2` cuando hidrata un payload V2 (los `minW/minH`
 *     persistidos se preservan, pero el clamp en runtime usa esta tabla).
 *
 *  Cards que NO viven en el aside (header/lines) tienen constraints
 *  porque participan del grid global (12 cols). Aunque sean locked, los
 *  mantenemos por completitud — si en una etapa futura se desbloquean,
 *  el floor sigue vigente. */
// MIN_H recalibrados para ROW_HEIGHT=20 + MARGIN_Y=8 (px = h*20 + (h-1)*8).
//
// Recalibracion 2026-05-26 (cierre layout post ROW=32→20):
// los `minH` previos (4-8) estaban calibrados para el contenido EXPANDIDO
// de cada card. Pero el motor de reflow (`recalculateCardHeight`) usa
// `minH` como PISO de shrink — cuando el operador colapsa un card via
// TPCard.open=false, el contenido se vuelve ~28px (header only) pero el
// slot del grid no puede achicarse por debajo de `minH * 20 + (minH-1) * 8`.
// Resultado: aire vertical grande entre cards colapsados (ej. `payments`
// con minH=8 dejaba 184px aunque el header colapsado mida 28px).
//
// La solucion es separar dos conceptos:
//   · `minH` (esta tabla) = floor de SHRINK = altura del card COLAPSADO
//     (header only, ~2 filas = 48px). Permite reflow real al colapsar.
//   · `h` default en `presetLayouts.ts` = altura del card EXPANDIDO. El
//     motor auto-grow crece automaticamente desde minH hasta que el
//     contenido medido entra.
//
// Pixeles resultantes (header colapsado):
//   discount/shipping/coupon  minH 2 → 48 px (header + safety)
//   payments                  minH 2 → 48 px
//   account-impact            minH 2 → 48 px
//   observations              minH 2 → 48 px
//   totals (★ hero, NO colapsa) minH 13 → 356 px (balance + breakdown +
//                                                 selector + status)
//   header (locked structural) minH 4 → 80 px
//   lines  (locked structural) minH 18 → 376 px (tabla + filas)
//
// Los cards colapsables comparten el mismo minH para que el spacing visual
// entre cards colapsados sea uniforme en los 3 presets (CLASSIC / COMPACT /
// ONE_LINE). El auto-grow trae cada card a su altura natural cuando el
// contenido lo necesita — sin importar el preset.
export const CARD_CONSTRAINTS: Record<CardId, CardConstraints> = {
  // ─── Structural (locked) ─────────────────────────────────────────────
  header: { minW: 8, minH: 4 },
  lines:  { minW: 6, minH: 18 },

  // ─── Aside cards ─────────────────────────────────────────────────────
  // Ajustes comerciales — floor de COLAPSO (header only). Auto-grow trae
  // a la altura natural del contenido expandido sin necesidad de subir
  // el floor.
  discount:        { minW: 3, minH: 2 },
  shipping:        { minW: 3, minH: 2 },
  coupon:          { minW: 3, minH: 2 },
  // ★ Total — protagonista. NO colapsa (no tiene toggle open/close)
  // pero SI puede achicarse cuando el contenido es chico (factura
  // vacia: solo total $0 + selector modo + status, ~120-140 px).
  //
  // Recalibracion 2026-05-28 — corrigiendo overshoot del fix 2026-05-27.
  // Volvemos a `minH = 6` (132 px) tras feedback visual:
  //
  // Historico de calibraciones de este floor:
  //   · `minH = 13` (etapa pre-2026-05-26) → 332 px piso. Forzaba aire
  //     INTERNO de ~150 px cuando contenido era 180 px → "hueco gigante
  //     entre Total y Cobro".
  //   · `minH = 6` (etapa 2026-05-26) → 132 px piso. Soluciono el hueco
  //     pero se reporto que se sentia "comprimido".
  //   · `minH = 8` (etapa 2026-05-27) → 172 px piso. Genero el efecto
  //     opuesto: "aire muerto" superior/inferior cuando empty
  //     (contenido ~120 px en slot 172 → ~50 px de aire).
  //   · `minH = 6` (actual, 2026-05-28) → 132 px piso. Balance final:
  //     - Empty (~120 px content): slot 132 → ~12 px de respiro
  //       interno. No comprimido, no inflado.
  //     - Con datos (200-400 px): auto-grow al alto natural (h=9-16).
  //     - Saldos del componente: el TotalDelComprobanteCard usa
  //       `space-y-3 p-2.5` internos (definidos en
  //       `components/sales/TotalDelComprobanteCard/`) que proveen el
  //       respiro estetico sin depender del floor del grid.
  //
  // Cohesion visual: 132 px (Total vacio) → 48 px (Cupon/Cobro colapsado)
  // marca jerarquia hero sin saltos drasticos.
  totals:          { minW: 3, minH: 6 },
  // Cobro: header colapsable. Una vez expandido el auto-grow ajusta segun
  // cantidad de pagos cargados.
  payments:        { minW: 3, minH: 2 },
  // Impacto CC: read-only colapsable, balance previsto + nota.
  "account-impact": { minW: 3, minH: 2 },
  // Observaciones: header colapsable, textarea + tabs (terminos / adjuntos)
  // crecen via auto-grow al expandir.
  observations:    { minW: 3, minH: 2 },
};

/** Helper — lookup seguro. Devuelve constraints o un fallback genérico
 *  (minW 1, minH 1) si el id no está en la tabla (caso defensivo —
 *  no debería pasar con un CardId válido). */
export function getCardConstraints(id: CardId): CardConstraints {
  return CARD_CONSTRAINTS[id] ?? { minW: 1, minH: 1 };
}
