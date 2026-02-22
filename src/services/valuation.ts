// tptech-frontend/src/services/valuation.ts
import { apiFetch } from "../lib/api";

export type CurrencyRow = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  isActive: boolean;
  latestRate: number | null;
  latestAt: string | null;
  latestCreatedAt: string | null;
};

export type CurrencyRateRow = {
  id: string;
  rate: number;
  effectiveAt?: string;
  createdAt?: string;
};

export type MetalRow = {
  id: string;
  name: string;
  symbol: string;
  referenceValue: number;
  isActive: boolean;
  sortOrder?: number;
};

export type MetalVariantRow = {
  id: string;
  metalId: string;
  name: string;
  sku: string;
  purity: number;
  isActive: boolean;
  isFavorite: boolean;

  // ✅ NUEVO: persistidos
  buyFactor?: number;
  saleFactor?: number;
  purchasePriceOverride?: number | null;
  salePriceOverride?: number | null;
  pricingMode?: "AUTO" | "OVERRIDE" | string;

  // ✅ NUEVO: calculados backend
  suggestedPrice?: number;
  finalPurchasePrice?: number;
  finalSalePrice?: number;

  // ✅ opcional (si backend lo expone para UX/debug)
  referenceValue?: number;
};

export type MetalQuoteRow = {
  id: string;
  variantId: string;
  currencyId: string;
  purchasePrice: number;
  salePrice: number;
  effectiveAt?: string;
  createdAt?: string;
  currency?: { id: string; code: string; symbol: string };
};

export type MetalRefHistoryItem = {
  id: string;
  referenceValue: number;
  effectiveAt: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
};

export type VariantPricingPatch = {
  buyFactor?: number;
  saleFactor?: number;

  purchasePriceOverride?: number | null;
  salePriceOverride?: number | null;

  // helpers
  clearPurchaseOverride?: boolean;
  clearSaleOverride?: boolean;
};

/* =========================
   Monedas
========================= */

export async function getCurrencies() {
  return apiFetch("/valuation/currencies");
}

// alias opcional
export async function listCurrencies() {
  return getCurrencies();
}

export async function createCurrency(data: { code: string; name: string; symbol: string }) {
  return apiFetch("/valuation/currencies", { method: "POST", body: data as any });
}

export async function updateCurrency(currencyId: string, data: { code: string; name: string; symbol: string }) {
  return apiFetch(`/valuation/currencies/${currencyId}`, { method: "PATCH", body: data as any });
}

export async function deleteCurrency(currencyId: string) {
  return apiFetch(`/valuation/currencies/${currencyId}`, { method: "DELETE" });
}

export async function setBaseCurrency(currencyId: string, _opts?: { effectiveAt?: string | Date }) {
  // backend usa effectiveAt = now en controller; dejamos opts por compatibilidad
  return apiFetch(`/valuation/currencies/${currencyId}/set-base`, { method: "POST" });
}

export async function toggleCurrencyActive(currencyId: string, isActive: boolean) {
  return apiFetch(`/valuation/currencies/${currencyId}/active`, {
    method: "PATCH",
    body: { isActive } as any,
  });
}

export async function addCurrencyRate(currencyId: string, data: { rate: number; effectiveAt: string | Date }) {
  return apiFetch(`/valuation/currencies/${currencyId}/rates`, {
    method: "POST",
    body: data as any,
  });
}

export async function getCurrencyRates(currencyId: string, take = 50) {
  return apiFetch(`/valuation/currencies/${currencyId}/rates?take=${take}`);
}

// alias opcional
export async function listCurrencyRates(currencyId: string, take = 50) {
  return getCurrencyRates(currencyId, take);
}

export async function getCurrencyRateHistory(currencyId: string, take = 80) {
  return apiFetch(`/valuation/currencies/${currencyId}/history?take=${take}`);
}

/* =========================
   Metales
========================= */

export async function getMetals() {
  return apiFetch("/valuation/metals");
}

// alias opcional
export async function listMetals() {
  return getMetals();
}

export async function createMetal(data: { name: string; symbol?: string; referenceValue?: number }) {
  return apiFetch("/valuation/metals", { method: "POST", body: data as any });
}

export async function updateMetal(metalId: string, data: { name: string; symbol?: string; referenceValue?: number }) {
  return apiFetch(`/valuation/metals/${metalId}`, { method: "PATCH", body: data as any });
}

export async function deleteMetal(metalId: string) {
  return apiFetch(`/valuation/metals/${metalId}`, { method: "DELETE" });
}

export async function toggleMetalActive(metalId: string, isActive: boolean) {
  return apiFetch(`/valuation/metals/${metalId}/active`, {
    method: "PATCH",
    body: { isActive } as any,
  });
}

export async function getMetalRefHistory(
  metalId: string,
  take = 80
): Promise<{
  ok: boolean;
  metal: MetalRow;
  current: MetalRefHistoryItem | null;
  history: MetalRefHistoryItem[];
  error?: string;
}> {
  return apiFetch(`/valuation/metals/${metalId}/ref-history?take=${take}`);
}

export async function moveMetal(
  metalId: string,
  dir: "UP" | "DOWN"
): Promise<{ ok: boolean; changed: boolean; rows?: MetalRow[]; error?: string }> {
  return apiFetch(`/valuation/metals/${metalId}/move`, {
    method: "POST",
    body: { dir } as any,
  });
}

/* =========================
   Variantes
========================= */

export async function createVariant(data: {
  metalId: string;
  name: string;
  sku: string;
  purity: number;

  // ✅ opcional: pricing
  buyFactor?: number;
  saleFactor?: number;
  purchasePriceOverride?: number | null;
  salePriceOverride?: number | null;
}) {
  return apiFetch("/valuation/variants", { method: "POST", body: data as any });
}

/**
 * ✅ NUEVO: editar variante (para reutilizar CreateVariantModal en modo EDIT)
 * Ruta esperada:
 *   PATCH /valuation/variants/:variantId
 */
export async function updateVariant(
  variantId: string,
  data: {
    name?: string;
    sku?: string;
    purity?: number;
    saleFactor?: number;
    salePriceOverride?: number | null;
  }
) {
  return apiFetch(`/valuation/variants/${variantId}`, {
    method: "PATCH",
    body: data as any,
  });
}

export async function updateVariantPricing(variantId: string, patch: VariantPricingPatch) {
  return apiFetch(`/valuation/variants/${variantId}/pricing`, {
    method: "PATCH",
    body: patch as any,
  });
}

// ✅ eliminar variante (lo usa useValuation + ConfirmDeleteDialog)
export async function deleteVariant(variantId: string) {
  return apiFetch(`/valuation/variants/${variantId}`, { method: "DELETE" });
}

export async function getVariants(
  metalId: string,
  params?: {
    q?: string;
    isActive?: boolean;
    onlyFavorites?: boolean;
    minPurchase?: number;
    maxPurchase?: number;
    minSale?: number;
    maxSale?: number;
    currencyId?: string;
  }
) {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (typeof params?.isActive === "boolean") q.set("isActive", String(params.isActive));
  if (params?.onlyFavorites) q.set("onlyFavorites", "true");
  if (params?.minPurchase != null) q.set("minPurchase", String(params.minPurchase));
  if (params?.maxPurchase != null) q.set("maxPurchase", String(params.maxPurchase));
  if (params?.minSale != null) q.set("minSale", String(params.minSale));
  if (params?.maxSale != null) q.set("maxSale", String(params.maxSale));
  if (params?.currencyId) q.set("currencyId", params.currencyId);

  const qs = q.toString();
  return apiFetch(`/valuation/metals/${metalId}/variants${qs ? `?${qs}` : ""}`);
}

// alias opcional
export async function listVariants(
  metalId: string,
  params?: {
    q?: string;
    isActive?: boolean;
    onlyFavorites?: boolean;
    minPurchase?: number;
    maxPurchase?: number;
    minSale?: number;
    maxSale?: number;
    currencyId?: string;
  }
) {
  return getVariants(metalId, params);
}

export async function toggleVariantActive(variantId: string, isActive: boolean) {
  return apiFetch(`/valuation/variants/${variantId}/active`, {
    method: "PATCH",
    body: { isActive } as any,
  });
}

/**
 * ✅ Favorito:
 * Backend actual: POST /valuation/variants/:variantId/set-favorite
 */
export async function setFavoriteVariant(variantId: string) {
  return apiFetch(`/valuation/variants/${variantId}/set-favorite`, { method: "POST" });
}

/**
 * ✅ limpiar favorito del metal para que no quede ninguno seleccionado.
 *
 * Requiere endpoint en backend:
 *   POST /valuation/metals/:metalId/clear-favorite
 */
export async function clearFavoriteVariant(metalId: string) {
  return apiFetch(`/valuation/metals/${metalId}/clear-favorite`, { method: "POST" });
}

/* =========================
   Quotes
========================= */

export async function addQuote(data: {
  variantId: string;
  currencyId: string;
  purchasePrice: number;
  salePrice: number;
  effectiveAt?: string | Date;
}) {
  return apiFetch("/valuation/quotes", { method: "POST", body: data as any });
}

export async function getQuotes(variantId: string, take = 50) {
  return apiFetch(`/valuation/variants/${variantId}/quotes?take=${take}`);
}

// alias opcional
export async function listQuotes(variantId: string, take = 50) {
  return getQuotes(variantId, take);
}