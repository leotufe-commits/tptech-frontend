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
// MIN_H recalibrados para ROW_HEIGHT=20 (antes 32). px = h*20 + (h-1)*8.
// Cada valor preserva (o levemente reduce) el floor en pixeles del era
// rowHeight 32:
//   discount/shipping minH 6 → 128px  (era 4*32+3*8 = 152, ahora 128)
//   coupon            minH 5 → 104px  (era 3*32+2*8 = 112, ahora 104)
//   totals            minH 10 → 232px (era 6*32+5*8 = 232, mantiene)
//   payments          minH 8 → 184px  (era 5*32+4*8 = 192, ahora 184)
//   account-impact    minH 6 → 128px  (era 4*32+3*8 = 152, ahora 128)
//   observations      minH 5 → 104px  (era 3*32+2*8 = 112, ahora 104)
//   header            minH 4 → 80px   (header del documento)
//   lines             minH 18 → 376px (tabla + filas)
export const CARD_CONSTRAINTS: Record<CardId, CardConstraints> = {
  // ─── Structural (locked) ─────────────────────────────────────────────
  header: { minW: 8, minH: 4 },
  lines:  { minW: 6, minH: 18 },

  // ─── Aside cards ─────────────────────────────────────────────────────
  // Ajustes comerciales — toggleable header + un combo + un monto.
  discount:        { minW: 3, minH: 6 },
  shipping:        { minW: 3, minH: 6 },
  // Cupón: 1 input + botón Aplicar.
  coupon:          { minW: 3, minH: 5 },
  // ★ Total — protagonista. minH 10 garantiza espacio para balance +
  // breakdown principal + selector de modo + estado comercial.
  totals:          { minW: 3, minH: 10 },
  // Cobro: header + lista de pagos. Con al menos 1 pago.
  payments:        { minW: 3, minH: 8 },
  // Impacto CC: read-only, balance previsto + nota.
  "account-impact": { minW: 3, minH: 6 },
  // Observaciones: header colapsable. Floor 5 permite el modo "header
  // only" sin romper layouts compactos.
  observations:    { minW: 3, minH: 5 },
};

/** Helper — lookup seguro. Devuelve constraints o un fallback genérico
 *  (minW 1, minH 1) si el id no está en la tabla (caso defensivo —
 *  no debería pasar con un CardId válido). */
export function getCardConstraints(id: CardId): CardConstraints {
  return CARD_CONSTRAINTS[id] ?? { minW: 1, minH: 1 };
}
