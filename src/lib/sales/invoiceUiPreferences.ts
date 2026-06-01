// src/lib/sales/invoiceUiPreferences.ts
// ============================================================================
// Configuraciones finas de UI del modal de Factura de ventas (UX.20 — Fase 1).
//
// SEPARADAS de `invoiceViewPresets.ts`:
//   · invoiceViewPreset  → layout BASE (BALANCED/CLASSIC/COMPACT/FINANCIAL).
//                          Solo 4 valores cerrados; cambia estructura del grid.
//   · invoiceUiPreferences → flags finos y toggles (visibilidad de cards).
//                            Objeto extensible que crece con cada iteración.
//
// HISTORIA: en la version anterior incluia `density` y `stickyActions`
// como flags ortogonales. Con el rediseno del layout V2 (auto-grow +
// resize manual + grilla 12-col), esos flags quedaron sin proposito y
// se removieron del resolver. La interfaz publica solo expone
// `visibleCards` + flags secundarios (totalsMode, breakdownExpanded).
//
// PRIORIDAD:
//   1. invoiceUiPreferences (user override) — gana siempre.
//   2. Default del resolver — cae si el campo no existe / es inválido.
//
// PERSISTENCIA:
//   `UserPreference.invoiceUiPreferences` (backend, Json?) → frontend lee
//   con `userPreferencesApi.get()`. Cambiar persiste vía
//   `userPreferencesApi.update({ invoiceUiPreferences })`.
// ============================================================================

import type { InvoiceUiPreferences } from "../../services/user-preferences";

export type { InvoiceUiPreferences };

/** @deprecated Densidad visual — removida con layout V2. Tipo conservado
 *  como alias hueco para no romper imports legacy. Nada lo lee ya. */
export type InvoiceDensity = "COMPACT" | "NORMAL" | "COMFORTABLE";

/** Ids de cards que el usuario puede ocultar/mostrar desde Configuración.
 *  IMPORTANTE: NO incluye `header` ni `lines` — esos son obligatorios y
 *  el modal de Configuración no los expone como toggleables. */
export type ToggleableCardId =
  | "discount"
  | "shipping"
  | "coupon"
  | "totals"
  | "payments"
  | "accountImpact"
  | "observations"
  | "composition"
  | "breakdown"
  | "metals";

/** Flags de visibilidad por card. Default todas en `true` (visibles).
 *  Persistido como `invoiceUiPreferences.visibleCards`. */
export type VisibleCardsConfig = Record<ToggleableCardId, boolean>;

/** Configuración resuelta de UI — defaults aplicados + tipos cerrados.
 *  La UI consume estos valores tipados (sin tener que validar el JSON
 *  opaco que llega del backend).
 *
 *  DEPRECADO `density` y `stickyActions` — quedan como tipo opaco
 *  ignorado por el resolver desde el rediseno del layout V2: la
 *  densidad la gobierna el preset + auto-grow, y las acciones de
 *  fila siempre son sticky. */
export interface ResolvedInvoiceUiPreferences {
  /** ¿Qué cards se renderean? Default todas en true. Los cards `header`
   *  y `lines` NO están aquí — son obligatorios. */
  visibleCards: VisibleCardsConfig;
  /** Énfasis del Total del comprobante. "STANDARD" usa el ajuste del
   *  preset; "EMPHASIZED" lo refuerza (tamaño + banda accent). Default
   *  "STANDARD". */
  totalsMode: "STANDARD" | "EMPHASIZED";
  /** ¿El desglose "Saldo monetario" arranca abierto en BREAKDOWN? El
   *  hook `useDesgloseOpen` ya tiene su propia heurística (cerrado en
   *  UNIFIED, abierto en BREAKDOWN). Este flag fuerza el comportamiento
   *  cuando el usuario lo prefiere distinto. `null` = respetar la
   *  heurística por defecto. */
  breakdownExpanded: boolean | null;
}

const ALL_TOGGLEABLE_CARDS: ReadonlyArray<ToggleableCardId> = [
  "discount", "shipping", "coupon", "totals", "payments", "accountImpact",
  "observations", "composition", "breakdown", "metals",
];

/** Default: todos los cards visibles. Cero impacto en operadores que no
 *  cambian la configuración. */
const DEFAULT_VISIBLE_CARDS: VisibleCardsConfig = ALL_TOGGLEABLE_CARDS
  .reduce((acc, id) => { acc[id] = true; return acc; }, {} as VisibleCardsConfig);

function normalizeVisibleCards(v: unknown): VisibleCardsConfig {
  // Default todas en true; permitimos override parcial (objeto puede traer
  // solo algunas keys — las ausentes quedan en true).
  if (v == null || typeof v !== "object" || Array.isArray(v)) {
    return { ...DEFAULT_VISIBLE_CARDS };
  }
  const out = { ...DEFAULT_VISIBLE_CARDS };
  const r = v as Record<string, unknown>;
  for (const id of ALL_TOGGLEABLE_CARDS) {
    if (typeof r[id] === "boolean") {
      out[id] = r[id] as boolean;
    }
  }
  return out;
}

/** Resuelve el objeto opaco persistido a una config tipada. Defensivo:
 *  cualquier valor inválido cae al default. Cero excepciones.
 *
 *  Los campos legacy `density` y `stickyActions` (si vienen en `raw`)
 *  se IGNORAN — el layout V2 los reemplazo. La firma del retorno ya
 *  no los expone. */
export function resolveInvoiceUiPreferences(
  raw: InvoiceUiPreferences | null | undefined,
): ResolvedInvoiceUiPreferences {
  const r = (raw ?? {}) as Record<string, unknown>;
  const visibleCards = normalizeVisibleCards(r.visibleCards);
  const totalsMode = r.totalsMode === "EMPHASIZED" ? "EMPHASIZED" : "STANDARD";
  const breakdownExpanded = typeof r.breakdownExpanded === "boolean"
    ? r.breakdownExpanded
    : null;
  return { visibleCards, totalsMode, breakdownExpanded };
}

/** Metadata de cards toggleables para el modal de Configuración (sección
 *  "Cards visibles"). Header y Líneas NO están aquí: son obligatorios. */
export const INVOICE_TOGGLEABLE_CARDS: ReadonlyArray<{
  id:          ToggleableCardId;
  label:       string;
  description: string;
}> = [
  { id: "discount",       label: "Descuento global",         description: "Card del aside — descuento manual del comprobante." },
  { id: "shipping",       label: "Envío",                    description: "Card del aside — método de entrega + costo." },
  { id: "coupon",         label: "Cupón",                    description: "Card del aside — cupón de venta aplicado." },
  { id: "totals",         label: "Total del comprobante",    description: "Card principal del aside con el total final." },
  { id: "payments",       label: "Cobro",                    description: "Card del aside — pagos del comprobante." },
  { id: "accountImpact",  label: "Impacto en cuenta corriente", description: "Card del aside — saldo previsto post-confirmación." },
  { id: "observations",   label: "Observaciones",            description: "Card colapsable — notas, términos y adjuntos." },
  { id: "composition",    label: "Composición del total",    description: "Mini desglose por línea (metal · hechura · monto)." },
  { id: "breakdown",      label: "Breakdown monetario",      description: "Desglose interno del Total — descuentos, envío, impuestos." },
  { id: "metals",         label: "Metales",                  description: "Sección de metales dentro del card Total." },
];
