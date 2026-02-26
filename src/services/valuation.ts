// tptech-frontend/src/services/valuation.ts
import { apiFetch } from "../lib/api";

/* =========================
   Events (auto-refresh global)
========================= */

export const TPTECH_VALUATION_CHANGED = "tptech:valuation-changed";

export type ValuationChangedDetail =
  | { kind: "currencies:created"; currencyId?: string }
  | { kind: "currencies:updated"; currencyId: string }
  | { kind: "currencies:deleted"; currencyId: string }
  | { kind: "currencies:base-changed"; newBaseId: string }
  | { kind: "currencies:active-changed"; currencyId: string; isActive: boolean }
  | { kind: "currencies:rate-added"; currencyId: string }
  | { kind: "metals:created"; metalId?: string }
  | { kind: "metals:updated"; metalId: string }
  | { kind: "metals:deleted"; metalId: string }
  | { kind: "metals:active-changed"; metalId: string; isActive: boolean }
  | { kind: "metals:moved"; metalId: string; dir: "UP" | "DOWN" }
  | { kind: "variants:created"; metalId: string; variantId?: string }
  | { kind: "variants:updated"; variantId: string; metalId?: string }
  | { kind: "variants:deleted"; variantId: string; metalId?: string }
  | { kind: "variants:active-changed"; variantId: string; isActive: boolean; metalId?: string }
  | { kind: "variants:favorite-changed"; variantId?: string | null; metalId?: string }
  | { kind: "variants:pricing-updated"; variantId: string; metalId?: string }
  | { kind: "quotes:added"; variantId: string; metalId?: string };

function emitValuationChanged(detail: ValuationChangedDetail) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(TPTECH_VALUATION_CHANGED, { detail }));
  } catch {
    // noop
  }
}

/* =========================
   Helpers: pick ids from responses
========================= */

function pickId(resp: any): string | undefined {
  const id =
    resp?.id ??
    resp?.row?.id ??
    resp?.data?.id ??
    resp?.data?.row?.id ??
    resp?.currency?.id ??
    resp?.data?.currency?.id ??
    resp?.metal?.id ??
    resp?.data?.metal?.id ??
    resp?.variant?.id ??
    resp?.data?.variant?.id ??
    undefined;

  const s = String(id ?? "").trim();
  return s ? s : undefined;
}

function pickMetalId(resp: any): string | undefined {
  const mid =
    resp?.row?.metalId ??
    resp?.data?.row?.metalId ??
    resp?.variant?.metalId ??
    resp?.data?.variant?.metalId ??
    resp?.metalId ??
    resp?.data?.metalId ??
    undefined;

  const s = String(mid ?? "").trim();
  return s ? s : undefined;
}

/* =========================
   Types
========================= */

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

  // ✅ persistidos
  buyFactor?: number;
  saleFactor?: number;
  purchasePriceOverride?: number | null;
  salePriceOverride?: number | null;
  pricingMode?: "AUTO" | "OVERRIDE" | string;

  // ✅ calculados backend
  suggestedPrice?: number;
  finalPurchasePrice?: number;
  finalSalePrice?: number;

  // ✅ opcional
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

export async function listCurrencies() {
  return getCurrencies();
}

export async function createCurrency(data: { code: string; name: string; symbol: string }) {
  const resp = await apiFetch("/valuation/currencies", { method: "POST", body: data as any });
  emitValuationChanged({ kind: "currencies:created", currencyId: pickId(resp) });
  return resp;
}

export async function updateCurrency(currencyId: string, data: { code: string; name: string; symbol: string }) {
  const resp = await apiFetch(`/valuation/currencies/${currencyId}`, { method: "PATCH", body: data as any });
  emitValuationChanged({ kind: "currencies:updated", currencyId });
  return resp;
}

export async function deleteCurrency(currencyId: string) {
  const resp = await apiFetch(`/valuation/currencies/${currencyId}`, { method: "DELETE" });
  emitValuationChanged({ kind: "currencies:deleted", currencyId });
  return resp;
}

export async function setBaseCurrency(currencyId: string, _opts?: { effectiveAt?: string | Date }) {
  const resp = await apiFetch(`/valuation/currencies/${currencyId}/set-base`, { method: "POST" });
  emitValuationChanged({ kind: "currencies:base-changed", newBaseId: currencyId });
  return resp;
}

export async function toggleCurrencyActive(currencyId: string, isActive: boolean) {
  const resp = await apiFetch(`/valuation/currencies/${currencyId}/active`, {
    method: "PATCH",
    body: { isActive } as any,
  });
  emitValuationChanged({ kind: "currencies:active-changed", currencyId, isActive });
  return resp;
}

export async function addCurrencyRate(currencyId: string, data: { rate: number; effectiveAt: string | Date }) {
  const resp = await apiFetch(`/valuation/currencies/${currencyId}/rates`, {
    method: "POST",
    body: data as any,
  });
  emitValuationChanged({ kind: "currencies:rate-added", currencyId });
  return resp;
}

export async function getCurrencyRates(currencyId: string, take = 50) {
  return apiFetch(`/valuation/currencies/${currencyId}/rates?take=${take}`);
}

export async function listCurrencyRates(currencyId: string, take = 50) {
  return getCurrencyRates(currencyId, take);
}

/**
 * ✅ Legacy / compat
 * Antes era: /history
 * Ahora backend expone: /rate-history
 */
export async function getCurrencyRateHistory(currencyId: string, take = 80) {
  return apiFetch(`/valuation/currencies/${currencyId}/rate-history?take=${take}`);
}

/* =========================
   Metales
========================= */

export async function getMetals() {
  return apiFetch("/valuation/metals");
}

export async function listMetals() {
  return getMetals();
}

export async function createMetal(data: { name: string; symbol?: string; referenceValue?: number }) {
  const resp = await apiFetch("/valuation/metals", { method: "POST", body: data as any });
  emitValuationChanged({ kind: "metals:created", metalId: pickId(resp) });
  return resp;
}

export async function updateMetal(metalId: string, data: { name: string; symbol?: string; referenceValue?: number }) {
  const resp = await apiFetch(`/valuation/metals/${metalId}`, { method: "PATCH", body: data as any });
  emitValuationChanged({ kind: "metals:updated", metalId });
  return resp;
}

export async function deleteMetal(metalId: string) {
  const resp = await apiFetch(`/valuation/metals/${metalId}`, { method: "DELETE" });
  emitValuationChanged({ kind: "metals:deleted", metalId });
  return resp;
}

export async function toggleMetalActive(metalId: string, isActive: boolean) {
  const resp = await apiFetch(`/valuation/metals/${metalId}/active`, {
    method: "PATCH",
    body: { isActive } as any,
  });
  emitValuationChanged({ kind: "metals:active-changed", metalId, isActive });
  return resp;
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
  const resp = await apiFetch(`/valuation/metals/${metalId}/move`, {
    method: "POST",
    body: { dir } as any,
  });
  emitValuationChanged({ kind: "metals:moved", metalId, dir });
  return resp as any;
}

/* =========================
   Variantes
========================= */

export async function createVariant(data: {
  metalId: string;
  name: string;
  sku: string;
  purity: number;

  buyFactor?: number;
  saleFactor?: number;
  purchasePriceOverride?: number | null;
  salePriceOverride?: number | null;
}) {
  const resp = await apiFetch("/valuation/variants", { method: "POST", body: data as any });
  emitValuationChanged({ kind: "variants:created", metalId: data.metalId, variantId: pickId(resp) });
  return resp;
}

/**
 * ✅ editar variante
 *   PATCH /valuation/variants/:variantId
 *
 * 🟦 mejora: metalId opcional (si lo tenés en UI, lo pasás y listo)
 */
export async function updateVariant(
  variantId: string,
  data: {
    name?: string;
    sku?: string;
    purity?: number;
    saleFactor?: number;
    salePriceOverride?: number | null;
  },
  metalId?: string
) {
  const resp = await apiFetch(`/valuation/variants/${variantId}`, {
    method: "PATCH",
    body: data as any,
  });

  const mid = String(metalId || pickMetalId(resp) || "").trim() || undefined;
  emitValuationChanged({ kind: "variants:updated", variantId, metalId: mid });

  return resp;
}

/**
 * 🟦 mejora: metalId opcional
 */
export async function updateVariantPricing(variantId: string, patch: VariantPricingPatch, metalId?: string) {
  const resp = await apiFetch(`/valuation/variants/${variantId}/pricing`, {
    method: "PATCH",
    body: patch as any,
  });

  const mid = String(metalId || pickMetalId(resp) || "").trim() || undefined;
  emitValuationChanged({ kind: "variants:pricing-updated", variantId, metalId: mid });

  return resp;
}

/**
 * 🟦 mejora: metalId opcional
 */
export async function deleteVariant(variantId: string, metalId?: string) {
  const resp = await apiFetch(`/valuation/variants/${variantId}`, { method: "DELETE" });

  const mid = String(metalId || pickMetalId(resp) || "").trim() || undefined;
  emitValuationChanged({ kind: "variants:deleted", variantId, metalId: mid });

  return resp;
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

/**
 * 🟦 mejora: metalId opcional
 */
export async function toggleVariantActive(variantId: string, isActive: boolean, metalId?: string) {
  const resp = await apiFetch(`/valuation/variants/${variantId}/active`, {
    method: "PATCH",
    body: { isActive } as any,
  });

  const mid = String(metalId || pickMetalId(resp) || "").trim() || undefined;
  emitValuationChanged({ kind: "variants:active-changed", variantId, isActive, metalId: mid });

  return resp;
}

/**
 * ✅ Favorito
 *
 * 🟦 mejora: metalId opcional (por si querés filtrar en listeners)
 */
export async function setFavoriteVariant(variantId: string, metalId?: string) {
  const resp = await apiFetch(`/valuation/variants/${variantId}/set-favorite`, { method: "POST" });

  const mid = String(metalId || pickMetalId(resp) || "").trim() || undefined;
  emitValuationChanged({ kind: "variants:favorite-changed", variantId, metalId: mid });

  return resp;
}

/**
 * ✅ limpiar favorito del metal
 */
export async function clearFavoriteVariant(metalId: string) {
  const resp = await apiFetch(`/valuation/metals/${metalId}/clear-favorite`, { method: "POST" });
  emitValuationChanged({ kind: "variants:favorite-changed", variantId: null, metalId });
  return resp;
}

/* =========================
   Quotes
========================= */

/**
 * 🟦 mejora: metalId opcional
 */
export async function addQuote(data: {
  variantId: string;
  currencyId: string;
  purchasePrice: number;
  salePrice: number;
  effectiveAt?: string | Date;
  metalId?: string; // 👈 opcional por si lo tenés en UI
}) {
  const resp = await apiFetch("/valuation/quotes", { method: "POST", body: data as any });

  const mid = String(data.metalId || pickMetalId(resp) || "").trim() || undefined;
  emitValuationChanged({ kind: "quotes:added", variantId: data.variantId, metalId: mid });

  return resp;
}

export async function getQuotes(variantId: string, take = 50) {
  return apiFetch(`/valuation/variants/${variantId}/quotes?take=${take}`);
}

export async function listQuotes(variantId: string, take = 50) {
  return getQuotes(variantId, take);
}