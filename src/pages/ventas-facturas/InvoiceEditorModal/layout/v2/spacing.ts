// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/spacing.ts
//
// Constantes UNIFICADAS de spacing para el layout del modal de Factura.
// Toda fuente que necesite alinearse al grid del aside (gap entre cards,
// padding interno, alto de fila) debe importar de aqui — NO hardcodear
// valores en componentes ni en JSX.
//
// Beneficio: cualquier plantilla (CLASICA / COMPACTO / UNA LINEA) renderea
// los cards con la MISMA distancia visual; cambiar el spacing implica
// editar UNA constante.

/**
 * Alto de una fila de la grilla del aside (px). Combinado con
 * `CARD_GAP_Y_PX`, define la unidad de medida vertical:
 *   - cardHeight(h) = h * ROW_HEIGHT + (h - 1) * CARD_GAP_Y
 *   - cardHeight(6) = 6 * 20 + 5 * 8 = 160 px
 *
 * Reduccion 2026-05-25 (pedido producto "cierre layout fino"):
 * de 32 a 20 px. Beneficios:
 *   - Mayor GRANULARIDAD de resize vertical (step = 28 px en vez de
 *     40 px) → el operador ajusta cards con mas precision.
 *   - Cards con poco contenido ocupan slots mas chicos automaticamente.
 *   - Compatibilidad: layouts V2 persistidos heredan los `h` viejos,
 *     que ahora rinden mas compacto. Si el contenido no cabe, el
 *     auto-grow (`recalculateCardHeight`) lo agranda automaticamente
 *     en el primer render — sin recorte.
 */
export const GRID_ROW_HEIGHT_PX = 20;

/**
 * Gap vertical entre cards del aside (px). Tambien usado por la columna
 * izquierda (Datos / Lineas / Observaciones) y por el grid principal
 * que separa el area main del aside lateral.
 *
 * Tailwind equivalente: `gap-2` / `space-y-2` (= 8 px).
 *
 * Reducido de 12 a 8 (2026-05-25 — pedido producto "cierre layout"):
 * cards mas pegados visualmente, sin huecos exagerados. La densidad
 * uniforme de 8px funciona para los 3 presets (CLASICA, COMPACTO,
 * UNA LINEA) sin necesidad de overrides por plantilla.
 */
export const CARD_GAP_Y_PX = 8;

/**
 * Gap horizontal entre cards (px). Se aplica cuando dos cards comparten
 * fila en el grid del aside (caso poco frecuente — la mayoria de los
 * presets apilan vertical), y al grid 2-cols principal main / aside.
 *
 * Mismo valor que el gap vertical para consistencia visual.
 */
export const CARD_GAP_X_PX = 8;

/**
 * Padding interno del CONTENEDOR del grid de cards (no del card en si).
 * El padding interno de cada card lo maneja `TPCard.bodyClassName`.
 *
 * Default 0: el grid del aside no agrega aire alrededor — el aside ya
 * tiene su propio padding del wrapper externo.
 */
export const GRID_CONTAINER_PADDING_X_PX = 0;
export const GRID_CONTAINER_PADDING_Y_PX = 0;

// Re-exports en formato react-grid-layout (tuplas [x, y]).
export const GRID_MARGIN: [number, number] = [CARD_GAP_X_PX, CARD_GAP_Y_PX];
export const GRID_CONTAINER_PADDING: [number, number] = [
  GRID_CONTAINER_PADDING_X_PX,
  GRID_CONTAINER_PADDING_Y_PX,
];

/**
 * Clases Tailwind para los gaps. Mantener sincronizadas con las
 * constantes en px arriba — un cambio en `CARD_GAP_Y_PX` debe
 * reflejarse aqui (8 → `gap-2`, 12 → `gap-3`, 16 → `gap-4`).
 */
export const TW_CARD_GAP_Y = "space-y-2"; // 8 px
export const TW_CARD_GAP_X = "gap-2";     // 8 px
export const TW_GRID_GAP    = "gap-2";    // 8 px

/**
 * Padding interno UNIFICADO de los cards del modal de Factura. Pasar
 * a `TPCard` como `bodyClassName` y `headerClassName` para que TODOS
 * los cards luzcan con la misma densidad tipo ERP comercial — sin
 * aire muerto interno, sin huecos entre header y contenido.
 *
 * Default de `TPCard` sin override es `px-4 py-3` (header) + `p-4`
 * (body) ≈ 16/12 px. Eso es generoso y deja "aire" tipo dashboard
 * tradicional. Los cards de Factura usan estos valores compactos
 * (10 px) por pedido producto "look ERP".
 */
export const TPCARD_BODY_COMPACT   = "!p-2.5";   // 10 px en los 4 lados
export const TPCARD_HEADER_COMPACT = "!py-1.5";  // 6 px arriba/abajo del header
