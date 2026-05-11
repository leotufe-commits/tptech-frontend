// src/lib/pricing-factor-display.ts
// ============================================================================
// Helper visual UNIFICADO para mostrar el "factor de venta" en el simulador.
//
// Problema que resuelve:
//   El motor backend aplica primero el ajuste global de costo
//   (Article.manualAdjustment*, BONUS/SURCHARGE) sobre el `hechuraCost` y
//   `metalCost`, y después la lista aplica `marginHechura`/`marginMetal`
//   literales. El factor neto que el usuario percibe es:
//
//       factor efectivo = adjFactor × (1 + marginPct/100)
//
//   Ej.: lista marginHechura=50, ajuste BONUS 25% → 0.75 × 1.50 = 1.125 ≈ 1.13.
//
//   Antes de este helper, distintos lugares del simulador mostraban:
//     · "× 1.50 (+50%)"  → bruto de la lista (correcto matemáticamente vs
//       hechuraCost POST-ajuste, pero confuso porque ignora visualmente el ajuste).
//     · "× factor efectivo 1.13"  → neto (correcto vs lineCost PRE-ajuste,
//       pero parece contradecir lo que la lista promete).
//
//   Este helper devuelve un breakdown coherente con 3 piezas:
//     1) bruto de la lista (siempre visible — lo que el operador configuró)
//     2) ajuste de costo (cuando existe y modifica el resultado)
//     3) factor efectivo final (cuando difiere del bruto)
//
// POLICY R4.1: cero matemática nueva. Todos los números vienen del backend:
//   · `grossMarginPct`  ← `metalHechuraBreakdown.{metal,hechura}MarginPct` (lista).
//   · `effectiveFactor` ← derivado de `lineSale/lineCost` o
//                          `computeHechuraSaleFactor`/`computeMetalSaleFactor`,
//                          que a su vez es passthrough del breakdown del motor.
//   · `costAdjustmentPct` ← `composition.costAdjustment.value` (kind + value).
//
// Reader-only: este archivo NO consulta APIs, NO transforma valores monetarios,
// NO infiere factores. Solo decide qué texto/estructura visual mostrar.
// ============================================================================

/**
 * Datos crudos del backend necesarios para armar el breakdown.
 * Todos `null`-tolerantes: cuando un dato falta, el helper lo omite del display.
 */
export type FactorBreakdownInput = {
  /** Margen bruto de la lista en %, ej. 50 (= +50%). Viene de
   *  `metalHechuraBreakdown.metalMarginPct` o `.hechuraMarginPct`. */
  grossMarginPct: number | null;
  /** Factor efectivo final (cost-line × factor = sale-line). Ej. 1.125.
   *  Viene de `composition.{type}[i].lineSale / lineCost` o, agregado, de
   *  `computeHechuraSaleFactor`/`computeMetalSaleFactor`. */
  effectiveFactor: number | null;
  /** Ajuste global de costo, si el motor lo aplicó. Estructura espejo de
   *  `composition.costAdjustment` (kind / type / value). Cuando es null, no
   *  hay ajuste configurado. */
  costAdjustment?: {
    kind:  "BONUS" | "SURCHARGE" | null;
    type:  "PERCENTAGE" | "FIXED_AMOUNT" | null;
    value: number | null;
  } | null;
};

/**
 * Salida del helper — estructura lista para render. Cada pieza es `null`
 * cuando no debe mostrarse.
 */
export type FactorBreakdownDisplay = {
  /** Texto del margen bruto, ej. "+50%" o null si no hay margen. */
  grossText:        string | null;
  /** Texto del ajuste global, ej. "−25%" o "+15%", o null si no aplica. */
  adjustmentText:   string | null;
  /** Tono visual del ajuste: 'bonus' (verde, reduce costo) o 'surcharge' (ámbar, aumenta). */
  adjustmentTone:   "bonus" | "surcharge" | null;
  /** Texto del factor efectivo, ej. "1.13" o null si no aplica o coincide con el bruto. */
  effectiveText:    string | null;
  /** true cuando el factor efectivo difiere del bruto en >0.1pp y por ende
   *  conviene mostrar el breakdown completo. false cuando coinciden (sólo
   *  bruto). */
  hasDivergence:    boolean;
  /** Composición compacta de una sola línea: "lista +50% · ajuste −25% · efectivo 1.13".
   *  Útil para tooltips o líneas auxiliares. */
  compactLine:      string | null;
};

/**
 * Formatea un porcentaje con coma decimal (es-AR), omitiendo decimales
 * innecesarios cuando el valor es entero.
 *
 * Reglas:
 *   - Si está a menos de 0.05 de un entero → 0 decimales: `50 → "50%"`.
 *   - Caso contrario → 1 decimal: `12.5 → "12,5%"`, `33.333 → "33,3%"`.
 *
 * Coma como separador decimal (locale es-AR). Sin separador de miles (los
 * porcentajes en este contexto son < 1000% en la práctica).
 */
function fmtPct(n: number): string {
  const fixed = Math.abs(n - Math.round(n)) < 0.05 ? n.toFixed(0) : n.toFixed(1);
  return `${fixed.replace(".", ",")}%`;
}

/**
 * Formatea un factor multiplicador con 2 decimales y coma (es-AR).
 *
 * Ejemplo: `1.125 → "1,13"` (redondea a 2 decimales con regla "half away from zero" de toFixed).
 * Output siempre es exactamente 2 decimales (sin trim de ceros). Sin separador de miles.
 */
function fmtFactor(f: number): string {
  return f.toFixed(2).replace(".", ",");
}

/**
 * Extrae `costAdjustment` desde un array de steps (passthrough del backend,
 * espejo de `extractCompositionCostAdjustment` del motor). Útil cuando el
 * normalizer no incluye este campo y el simulador necesita acceso visual.
 *
 * Lee del step `COST_LINES_FINAL.meta`:
 *   · `adjustmentKind`  → "BONUS" | "SURCHARGE" | "" (vacío = sin ajuste)
 *   · `adjustmentType`  → "PERCENTAGE" | "FIXED_AMOUNT" | ""
 *   · `adjustmentValue` → string del valor (% o monto)
 *
 * Retorna null cuando no hay step COST_LINES_FINAL o cuando `kind` es vacío/no
 * reconocido.
 */
export function extractCostAdjustmentFromSteps(
  steps: ReadonlyArray<{ key: string; meta?: any }> | null | undefined,
): FactorBreakdownInput["costAdjustment"] {
  if (!Array.isArray(steps)) return null;
  const step = steps.find(s => s?.key === "COST_LINES_FINAL");
  if (!step) return null;
  const meta = (step.meta ?? {}) as Record<string, unknown>;
  const kindRaw = typeof meta.adjustmentKind === "string" ? meta.adjustmentKind : "";
  const kind: "BONUS" | "SURCHARGE" | null =
    kindRaw === "BONUS" || kindRaw === "SURCHARGE" ? kindRaw : null;
  if (!kind) return null;
  const typeRaw = typeof meta.adjustmentType === "string" ? meta.adjustmentType : "";
  const type: "PERCENTAGE" | "FIXED_AMOUNT" | null =
    typeRaw === "PERCENTAGE" || typeRaw === "FIXED_AMOUNT" ? typeRaw : null;
  const rawValue = meta.adjustmentValue;
  const value = rawValue != null && Number.isFinite(Number(rawValue)) ? Number(rawValue) : null;
  return { kind, type, value };
}

/**
 * Construye el breakdown visual del factor.
 *
 * Reglas:
 *   1. Si `grossMarginPct === null` y `effectiveFactor === null` → todo null.
 *   2. Si solo viene `grossMarginPct` → muestra "lista +X%", nada más.
 *   3. Si vienen ambos:
 *        a) Si coinciden (diferencia < 0.1pp) → solo bruto, sin "efectivo".
 *        b) Si difieren → muestra los 3: bruto, ajuste (si está disponible),
 *           efectivo. Esto es el caso que confunde al usuario ("1.13 vs 50%").
 *   4. El "ajuste" se infiere del `costAdjustment` (passthrough motor). Si no
 *      está disponible, NO se infiere — solo se muestra "bruto" y "efectivo"
 *      sin texto intermedio.
 */
export function buildFactorBreakdown(
  input: FactorBreakdownInput,
): FactorBreakdownDisplay {
  const { grossMarginPct, effectiveFactor, costAdjustment } = input;

  const hasGross = grossMarginPct != null && Number.isFinite(grossMarginPct);
  const hasEff   = effectiveFactor != null && Number.isFinite(effectiveFactor);

  // Caso degenerado: ningún dato → todo null.
  if (!hasGross && !hasEff) {
    return { grossText: null, adjustmentText: null, adjustmentTone: null,
             effectiveText: null, hasDivergence: false, compactLine: null };
  }

  const grossText = hasGross && grossMarginPct! > 0.005
    ? `+${fmtPct(grossMarginPct!)}`
    : null;

  // Detectar divergencia entre bruto y efectivo (>0.1pp).
  let hasDivergence = false;
  if (hasGross && hasEff) {
    const effectivePct = (effectiveFactor! - 1) * 100;
    hasDivergence = Math.abs(grossMarginPct! - effectivePct) > 0.1;
  } else if (hasEff && !hasGross) {
    // Sólo efectivo disponible (caso degenerado): siempre divergente para
    // poder mostrar al menos el efectivo.
    hasDivergence = Math.abs(effectiveFactor! - 1) > 0.005;
  }

  // Ajuste de costo: emitir texto sólo cuando hay divergencia Y el motor
  // emitió un costAdjustment estructurado.
  let adjustmentText: string | null = null;
  let adjustmentTone: "bonus" | "surcharge" | null = null;
  if (hasDivergence && costAdjustment?.kind && costAdjustment?.value != null
      && Number.isFinite(costAdjustment.value)) {
    const sign = costAdjustment.kind === "BONUS" ? "−" : "+";
    const valueStr = costAdjustment.type === "PERCENTAGE"
      ? fmtPct(costAdjustment.value)
      : String(costAdjustment.value);
    adjustmentText = `${sign}${valueStr}`;
    adjustmentTone = costAdjustment.kind === "BONUS" ? "bonus" : "surcharge";
  }

  // Texto del efectivo: sólo cuando hay divergencia (caso contrario,
  // mostraría redundancia "+50% / 1.50").
  const effectiveText = hasDivergence && hasEff
    ? fmtFactor(effectiveFactor!)
    : null;

  // Línea compacta opcional: "lista +50% · ajuste −25% · efectivo 1,13".
  const parts: string[] = [];
  if (grossText) parts.push(`lista ${grossText}`);
  if (adjustmentText) parts.push(`ajuste ${adjustmentText}`);
  if (effectiveText) parts.push(`efectivo ${effectiveText}`);
  const compactLine = parts.length > 1 ? parts.join(" · ") : null;

  return {
    grossText, adjustmentText, adjustmentTone, effectiveText,
    hasDivergence, compactLine,
  };
}
