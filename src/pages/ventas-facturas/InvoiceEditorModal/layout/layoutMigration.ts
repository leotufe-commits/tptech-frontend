// src/pages/ventas-facturas/InvoiceEditorModal/layout/layoutMigration.ts
// ============================================================================
// reconcileLayout — combina lo que el backend devolvió (`saved`) con la
// imagen "verdad" del frontend (`defaults`). Garantías:
//
//   1) Si `saved` es null/inválido → devuelve `defaults` entero.
//   2) Si una card existe en `defaults` pero NO en `saved` → se agrega al
//      FINAL de su slot original (preserva el orden percibido del operador
//      mientras introducimos features nuevos sin romper layouts viejos).
//   3) Si una card existe en `saved` pero NO en `defaults` (id desconocido,
//      versión futura, etc.) → se descarta silenciosamente.
//   4) Width inválido → se normaliza al valor del default de esa card.
//   5) Slot inválido → se ignora ese item (cae al default).
//   6) Order se respeta tal cual viene de `saved`; el sort estable se hace
//      en el render (`getCardsBySlot`).
//
// Pure / determinístico. Cero efectos.
// ============================================================================

import {
  CURRENT_LAYOUT_VERSION,
  VALID_CARD_IDS,
  VALID_SLOTS,
  VALID_WIDTHS,
  type CardId,
  type LayoutCard,
  type LayoutConfig,
  type Slot,
  type Width,
} from "./types";

/** Type guard suelto: un objeto plano (no array, no null). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Valida una card individual contra los enums. Devuelve la card normalizada
 *  o `null` si no es recuperable. El `defaultWidth` se usa cuando el width
 *  viene inválido (rare path; el frontend no debería emitirlo, pero la
 *  preferencia puede venir de un cliente viejo / json hand-edited). */
function normalizeCard(
  raw: unknown,
  defaultWidth: Width,
): LayoutCard | null {
  if (!isPlainObject(raw)) return null;
  const { id, slot, order, width } = raw;
  if (typeof id !== "string" || !VALID_CARD_IDS.has(id as CardId)) return null;
  if (typeof slot !== "string" || !VALID_SLOTS.has(slot as Slot)) return null;
  const orderNum = typeof order === "number" && Number.isFinite(order) ? order : 0;
  const widthOk: Width = typeof width === "string" && VALID_WIDTHS.has(width as Width)
    ? (width as Width)
    : defaultWidth;
  return {
    id:    id as CardId,
    slot:  slot as Slot,
    order: orderNum,
    width: widthOk,
  };
}

/** Reconcilia `saved` contra `defaults` siguiendo las garantías documentadas
 *  arriba. NUNCA muta los inputs — devuelve un nuevo `LayoutConfig`. */
export function reconcileLayout(
  saved: unknown,
  defaults: LayoutConfig,
): LayoutConfig {
  // Fallback duro si `saved` no es un layout válido.
  if (!isPlainObject(saved)) return defaults;
  const savedCards = (saved as { cards?: unknown }).cards;
  if (!Array.isArray(savedCards)) return defaults;

  // Mapa de cards default (por id) para lookup rápido del width fallback y
  // para detectar faltantes en `saved` (los agregamos al final).
  const defaultsById = new Map<CardId, LayoutCard>();
  for (const c of defaults.cards) defaultsById.set(c.id, c);

  // Pase 1 — normalizar cada card de `saved`. Descartar las inválidas /
  // con id desconocido. Mantener el orden original del array.
  const seen = new Set<CardId>();
  const normalized: LayoutCard[] = [];
  for (const item of savedCards) {
    const defaultCard = isPlainObject(item) && typeof item.id === "string"
      ? defaultsById.get(item.id as CardId)
      : undefined;
    if (!defaultCard) continue; // id desconocido → descartar
    const card = normalizeCard(item, defaultCard.width);
    if (!card) continue;
    if (seen.has(card.id)) continue; // duplicado → conservar el primero
    seen.add(card.id);
    normalized.push(card);
  }

  // Migración silenciosa — `observations` solía vivir en slot="bottom".
  // Ahora forma parte del aside (participa del sistema drag/resize). Si un
  // usuario tiene un layout persistido con observations en bottom, lo
  // migramos a aside preservando el width persistido pero recomputando el
  // order al final del aside (se hace abajo, en `Pase 2`). Es una migración
  // determinística: el shape persistido nuevo (slot="aside") es válido para
  // todos los presets y elimina huérfanos en bottom.
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (c.id === "observations" && c.slot !== "aside") {
      // `order` se reescribe en Pase 2 al considerarlo como missing-in-slot
      // → para forzar ese path, lo dejamos con un slot temporal inválido y
      // delegamos al pase 2. La forma más simple es marcarlo como "aside"
      // con order = -1; Pase 2 lo recolocará al final del slot real
      // (no entra al loop "missing in saved" porque ya está en `seen`).
      // Por eso aplicamos slot + order=-1 acá y el sort de getCardsBySlot
      // lo dejará primero. Mejor: lo movemos a aside con order = ∞ ahora,
      // y luego Pase 2 normaliza los huecos.
      normalized[i] = { ...c, slot: "aside", order: Number.MAX_SAFE_INTEGER };
    }
  }

  // Pase 2 — agregar cards del default que NO aparecieron en `saved`. Cada
  // una entra con `order = max(order del slot en saved) + 1` para quedar al
  // FINAL de su slot (preserva el orden percibido por usuarios existentes
  // al agregarse features nuevos).
  const slotMaxOrder = new Map<Slot, number>();
  for (const c of normalized) {
    if (c.order === Number.MAX_SAFE_INTEGER) continue; // sentinel migrado
    const cur = slotMaxOrder.get(c.slot) ?? -1;
    if (c.order > cur) slotMaxOrder.set(c.slot, c.order);
  }
  for (const def of defaults.cards) {
    if (seen.has(def.id)) continue;
    const next = (slotMaxOrder.get(def.slot) ?? -1) + 1;
    slotMaxOrder.set(def.slot, next);
    normalized.push({ ...def, order: next });
  }

  // Pase 3 — resolver sentinels MAX_SAFE_INTEGER de la migración: cada uno
  // recibe `order = max(slot) + 1`, asegurando que quede al final de su
  // slot destino (típicamente observations migrada de bottom → aside).
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (c.order !== Number.MAX_SAFE_INTEGER) continue;
    const next = (slotMaxOrder.get(c.slot) ?? -1) + 1;
    slotMaxOrder.set(c.slot, next);
    normalized[i] = { ...c, order: next };
  }

  return {
    version: CURRENT_LAYOUT_VERSION,
    cards:   normalized,
  };
}

/** Helper de render: agrupa las cards por slot y las ordena por `order` de
 *  forma estable. El consumidor llama `getCardsBySlot(layout, "aside")` y
 *  recibe la lista lista para iterar en JSX. */
export function getCardsBySlot(layout: LayoutConfig, slot: Slot): LayoutCard[] {
  return layout.cards
    .filter((c) => c.slot === slot)
    .slice()
    .sort((a, b) => a.order - b.order);
}
