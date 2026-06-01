// src/components/pricing/CommercialPhysicalRoundingBlock/types.ts
// =============================================================================
// Etapa C-comercial / C6 — Tipos del bloque visual "Redondeo comercial del
// metal" (POLICY §R-Rounding-14).
//
// El componente es read-only y SOLO display: muestra el snapshot del redondeo
// COMERCIAL PHYSICAL que el backend ya generó (C3) y transportó (C4-fix).
// Cero matemática nueva — passthrough estricto del shape ya tipado.
// =============================================================================

/** Entry por metal padre — shape EXACTO del backend
 *  (`SalePreviewLineCommercialPhysicalEntry` en `services/sales.ts`). */
export type CommercialPhysicalEntry = {
  metalParentId:      string | null;
  metalParentName:    string;
  preGrams:           number;
  postGrams:          number;
  deltaGrams:         number;
  metalPricePerGram:  number;
  monetaryEquivalent: number;
  mode:               string;
  direction:          string;
  source:             "COMMERCIAL_PHYSICAL_ROUNDING";
  fallback:
    | null
    | "NO_METAL_PRICE"
    | "NO_CONFIG"
    | "INVALID_GRAMS";
};

/** Snapshot del redondeo comercial PHYSICAL — paralelo al
 *  `documentRoundingApplied.breakdown.metalPhysical` del financiero. */
export type CommercialPhysicalSnapshot = {
  metals:                  CommercialPhysicalEntry[];
  metalMonetaryEquivalent: number;
  fallback:
    | null
    | "NO_BREAKDOWN_DATA"
    | "NO_METALS_TO_ROUND";
};

export type CommercialPhysicalRoundingBlockProps = {
  /** Snapshot completo del redondeo COMERCIAL PHYSICAL. `null`/`undefined` →
   *  el bloque de metales no se renderiza (regla de la etapa: lista MONETARY
   *  legacy no muestra nada). */
  commercialPhysical?: CommercialPhysicalSnapshot | null;
  /** Subtotales del metal — pre y POST rounding tal como los emitió el motor
   *  (`metalHechuraBreakdown.metalSalePreRounding` y `metalHechuraBreakdown.metalSale`).
   *  Los dos viajan ya calculados desde el backend; el frontend NO suma
   *  `pre + delta`. `delta` está acá solo para display (`(+ARS 9.200)`),
   *  pero también viene tal cual del backend (no se deriva). */
  metalSalePreRounding?:    number | null;
  metalSalePostRounding?:   number | null;
  metalSaleRoundingDelta?:  number | null;
  /** Subtotales de la HECHURA — siempre monetaria por contrato canónico
   *  (POLICY §R-Rounding-14). Mismo patrón que metal: tres valores del
   *  backend, frontend solo renderiza. */
  hechuraSalePreRounding?:  number | null;
  hechuraSalePostRounding?: number | null;
  hechuraSaleRoundingDelta?:number | null;
  /** Código de moneda para el sufijo display ("ARS", "USD"). Opcional —
   *  el helper de moneda lo usa solo para el label; el formato numérico
   *  lo gobierna el preset config-aware del tenant. */
  currencyCode?: string;
  /** Variante visual:
   *   - `"full"` (default) → padding completo, header destacado. Para
   *     Simulador y vistas amplias.
   *   - `"compact"` → padding reducido, para encajar dentro del modal
   *     editor de Factura. */
  variant?: "full" | "compact";
  className?: string;
};
