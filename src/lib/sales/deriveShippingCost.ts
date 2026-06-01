// tptech-frontend/src/lib/sales/deriveShippingCost.ts
// =============================================================================
// Helper PURO — única función que deriva el `cost` del envío en moneda DOC
// (la moneda del comprobante) a partir de la tarifa del catálogo (BASE).
//
// CONTRATO `draft.shipping.cost` (rectificación 2026-05-28):
//   - Vive SIEMPRE en moneda DOC.
//   - Operador VE y EDITA en moneda DOC.
//   - Payload al backend envía cost en moneda DOC.
//   - La conversión BASE→DOC sucede UNA SOLA VEZ aquí.
//
// Defensa en profundidad (incidente 2026-05-29 — "21.582.733"):
//   El bug observado tenía a un tenant con la moneda ARS marcada como base
//   pero con `latestRate` populated incorrectamente como 0.000556
//   (= 1/1798.561). `resolveCurrencyRate` no chequeaba `isBase` y devolvía
//   ese valor. derivedCost = 12000 / 0.000556 = 21.582.733.
//
//   Este helper agrega una capa de defensa: cuando `baseCurrencyCode ===
//   documentCurrencyCode`, FORZAMOS `cost = baseCost` sin importar el rate.
//   Si las dos monedas son iguales no hay conversión que hacer — ignoramos
//   el fxRate por completo. Esto blinda contra rates corruptos en la DB.
// =============================================================================

export type DeriveShippingCostInput = {
  /**
   * Valor de la tarifa según el catálogo "Envíos y Logística".
   * SIEMPRE en moneda BASE del tenant (cómo se persiste en
   * `ShippingRate.fixedPrice` / `pricePerKg`).
   *
   * Ejemplo: Motomensajería en ARS → baseCost = 12000.
   */
  baseCost: number;

  /**
   * Tasa BASE↔DOC del comprobante (BASE/DOC, ej. 1800 ARS/USD).
   * Default `1` (sin conversión).
   *
   * Solo se usa si `baseCurrencyCode !== documentCurrencyCode`. Si las
   * monedas coinciden, este parámetro se ignora completamente.
   */
  documentFxRate: number;

  /**
   * Código de la moneda BASE del tenant (ej. "ARS"). Sin este dato no
   * podemos aplicar el blindaje "si monedas iguales no convertir" — en
   * ese caso se cae al comportamiento legacy (dividir por fxRate).
   */
  baseCurrencyCode?: string;

  /**
   * Código de la moneda DOC del comprobante (ej. "ARS", "USD"). Mismo
   * fallback que arriba si no se pasa.
   */
  documentCurrencyCode?: string;
};

/**
 * Deriva el costo del envío en moneda DOC.
 *
 * Reglas (en orden de aplicación):
 *
 *   1. Si `baseCost` no es un número positivo finito → 0.
 *   2. Si los códigos de moneda BASE y DOC coinciden (Y AMBOS están
 *      presentes) → retorna `baseCost` directamente, IGNORANDO `fxRate`.
 *      Defensa contra rates corruptos para misma moneda.
 *   3. Si `fxRate` no es positivo finito o es exactamente 1 → retorna
 *      `baseCost` (no hay conversión efectiva).
 *   4. Caso general: retorna `baseCost / fxRate`.
 *
 * Cero side-effects, cero dependencias de React. Testeable en aislamiento.
 */
export function deriveShippingCostInDocumentCurrency(
  input: DeriveShippingCostInput,
): number {
  const { baseCost, documentFxRate, baseCurrencyCode, documentCurrencyCode } = input;

  // (1) Tarifa cero / inválida → cost cero.
  if (!Number.isFinite(baseCost) || baseCost <= 0) return 0;

  // (2) Defensa en profundidad: si los codes coinciden, retornamos
  //     baseCost SIN aplicar conversión. Esto neutraliza cualquier valor
  //     erróneo de `documentFxRate` (rate invertido, rate de otra moneda,
  //     rate negativo, etc.) cuando la operación es BASE→BASE.
  //
  //     Importante: requiere que AMBOS códigos estén presentes y sean
  //     comparables. Si alguno falta, caemos al case (3).
  const bothCodesPresent =
    typeof baseCurrencyCode === "string" && baseCurrencyCode.length > 0
    && typeof documentCurrencyCode === "string" && documentCurrencyCode.length > 0;
  if (bothCodesPresent && baseCurrencyCode === documentCurrencyCode) {
    return baseCost;
  }

  // (3) fxRate inválido / 1 → sin conversión efectiva.
  if (!Number.isFinite(documentFxRate) || documentFxRate <= 0 || documentFxRate === 1) {
    return baseCost;
  }

  // (4) Conversión BASE → DOC.
  return baseCost / documentFxRate;
}
