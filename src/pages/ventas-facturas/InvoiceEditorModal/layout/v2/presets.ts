// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/presets.ts
// ============================================================================
// LayoutV2UserPreset — vistas guardadas por el usuario (Etapa 5 — Layout Pro).
//
// El operador puede guardar configuraciones del aside como "vistas"
// reutilizables (ej. "Venta rápida", "Mi escritorio financiero",
// "Vista completa"). Cada preset es un snapshot completo del
// `LayoutV2Config` + metadatos (id local, nombre, isDefault).
//
// Persistencia: array dentro de `UserPreference.invoiceLayoutPresets`
// (campo nuevo, mismo PUT que invoiceLayoutConfig). El servicio normaliza
// defensivamente — entradas inválidas se descartan, isDefault mutex se
// fuerza (sólo uno puede ser default a la vez).
//
// Reglas:
//   · `id` es un identificador LOCAL — se genera client-side (no viene del
//     backend). Pensado para keyset estable en React y comparaciones por id
//     en las acciones del hook.
//   · `name` es libre — el frontend valida no-vacío y trim, sin tope de
//     longitud estricto (con un sane cap de 60 chars para evitar abusos).
//   · `isDefault` opcional — cuando es true para uno, el frontend lo aplica
//     automáticamente al abrir la Factura. Mutex: el último marcado como
//     default gana (los anteriores quedan false).
//   · `config` es un `LayoutV2Config` COMPLETO — el contrato V2 es el SSOT
//     del layout, así que el preset guarda exactamente lo que el operador
//     ve en pantalla cuando aprieta "Guardar como mi vista".
//
// Pure / determinístico — cero efectos secundarios.
// ============================================================================

import { reconcileLayoutV2 } from "./reconcileLayoutV2";
import type { LayoutV2Config } from "./types";

/** Tope sensato para nombres de preset (UI + bytes en backend). */
export const PRESET_NAME_MAX_LENGTH = 60;

export type LayoutV2UserPreset = {
  /** Identificador local — se genera con `nextPresetId()` al crear. */
  id:        string;
  /** Nombre visible para el operador. Trimmeado al normalizar. */
  name:      string;
  /** Si true, el frontend lo aplica al abrir la Factura. Mutex: solo
   *  uno activo a la vez (la última activación pisa las anteriores). */
  isDefault: boolean;
  /** Snapshot completo del LayoutV2Config — la fuente de verdad del preset. */
  config:    LayoutV2Config;
};

// ─────────────────────────────────────────────────────────────────────────────
// ID generator (cliente-side, único por sesión + sane fallback).
// ─────────────────────────────────────────────────────────────────────────────

/** Generador determinístico para tests; en runtime usa `Date.now()` +
 *  contador interno + sufijo random corto para colisiones improbables. */
let _presetIdCounter = 0;
export function nextPresetId(): string {
  _presetIdCounter += 1;
  const ts = Date.now().toString(36);
  const seq = _presetIdCounter.toString(36);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `up_${ts}_${seq}_${rnd}`;
}

/** Reset del contador — utilidad para tests deterministas. NO usar en
 *  runtime productivo (el contador es interno y no debería resetearse). */
export function _resetPresetIdCounterForTests(): void {
  _presetIdCounter = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/** Crea un preset nuevo a partir de un `LayoutV2Config`. Trimea el nombre
 *  y aplica el cap de longitud. `isDefault` no se setea desde acá (el
 *  llamador decide via `setDefaultPreset` del hook, que aplica el mutex). */
export function createUserPreset(
  name: string,
  config: LayoutV2Config,
): LayoutV2UserPreset {
  const safeName = sanitizeName(name);
  return {
    id:        nextPresetId(),
    name:      safeName,
    isDefault: false,
    config,
  };
}

function sanitizeName(raw: string): string {
  const trimmed = (raw ?? "").toString().trim();
  if (trimmed.length === 0) return "Vista sin nombre";
  return trimmed.slice(0, PRESET_NAME_MAX_LENGTH);
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalizer defensivo — convierte un blob desconocido del backend en una
// lista válida de presets. Garantías:
//   1) Input inválido → [] (no tira, no rompe).
//   2) Entradas con shape inválido → descartadas silenciosamente.
//   3) Cada `config` se reconcilia con `reconcileLayoutV2` para garantizar
//      validez (cards faltantes/inválidas se completan/descartan).
//   4) Mutex `isDefault`: si más de uno viene con `isDefault=true`, solo el
//      PRIMERO en el array conserva el flag; los demás caen a false.
//   5) Nombres vacíos → "Vista sin nombre".
// ─────────────────────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function normalizeUserPresets(raw: unknown): LayoutV2UserPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: LayoutV2UserPreset[] = [];
  let defaultSeen = false;
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const id = typeof item.id === "string" && item.id.length > 0
      ? item.id
      : nextPresetId();
    const name = sanitizeName(typeof item.name === "string" ? item.name : "");
    // `config` reconciliado para garantizar shape válido. Si viene null/
    // basura, reconcileLayoutV2 devuelve DEFAULT_LAYOUT_V2 — preservamos
    // el preset (con su nombre) usando ese fallback. La alternativa
    // (descartar el preset) sería peor UX: el operador perdería su vista.
    const config = reconcileLayoutV2(item.config ?? null);
    let isDefault = item.isDefault === true;
    if (isDefault) {
      if (defaultSeen) {
        // Ya hay otro default en el array → este queda false (mutex).
        isDefault = false;
      } else {
        defaultSeen = true;
      }
    }
    out.push({ id, name, isDefault, config });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutators puros — pensados para usar desde el hook (state inmutable).
// Cada uno toma la lista actual y devuelve una NUEVA lista con la mutación
// aplicada. Garantizan el mutex de `isDefault`.
// ─────────────────────────────────────────────────────────────────────────────

/** Agrega un preset al final. */
export function addPreset(
  list: ReadonlyArray<LayoutV2UserPreset>,
  preset: LayoutV2UserPreset,
): LayoutV2UserPreset[] {
  return [...list, preset];
}

/** Renombra un preset por id. Sin efecto si el id no existe. */
export function renamePreset(
  list: ReadonlyArray<LayoutV2UserPreset>,
  id: string,
  newName: string,
): LayoutV2UserPreset[] {
  const safeName = sanitizeName(newName);
  return list.map((p) => (p.id === id ? { ...p, name: safeName } : p));
}

/** Duplica un preset por id. El nuevo tiene un id fresco, nombre con
 *  sufijo "(copia)", isDefault=false. Sin efecto si el id no existe. */
export function duplicatePreset(
  list: ReadonlyArray<LayoutV2UserPreset>,
  id: string,
): LayoutV2UserPreset[] {
  const src = list.find((p) => p.id === id);
  if (!src) return [...list];
  const copy = createUserPreset(`${src.name} (copia)`, src.config);
  return [...list, copy];
}

/** Borra un preset por id. */
export function deletePreset(
  list: ReadonlyArray<LayoutV2UserPreset>,
  id: string,
): LayoutV2UserPreset[] {
  return list.filter((p) => p.id !== id);
}

/** Marca un preset como default. Aplica mutex: los demás quedan false.
 *  Si `id` es null, simplemente DESACTIVA el default actual sin elegir
 *  otro (queda ningún preset marcado como default). */
export function setDefaultPreset(
  list: ReadonlyArray<LayoutV2UserPreset>,
  id: string | null,
): LayoutV2UserPreset[] {
  return list.map((p) => ({ ...p, isDefault: p.id === id }));
}

/** Devuelve el preset default si existe, sino null. */
export function findDefaultPreset(
  list: ReadonlyArray<LayoutV2UserPreset>,
): LayoutV2UserPreset | null {
  return list.find((p) => p.isDefault) ?? null;
}
