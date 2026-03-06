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
   Helpers
========================= */

function s(v: any) {
  const out = String(v ?? "").trim();
  return out ? out : "";
}

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

  const out = s(id);
  return out ? out : undefined;
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

  const out = s(mid);
  return out ? out : undefined;
}

function qs(params?: Record<string, any>) {
  const q = new URLSearchParams();
  if (!params) return "";
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const out = q.toString();
  return out ? `?${out}` : "";
}

async function post<T = any>(url: string, body?: any) {
  return apiFetch(url, { method: "POST", body: body as any }) as Promise<T>;
}
async function patch<T = any>(url: string, body?: any) {
  return apiFetch(url, { method: "PATCH", body: body as any }) as Promise<T>;
}
async function del<T = any>(url: string) {
  return apiFetch(url, { method: "DELETE" }) as Promise<T>;
}

/* =========================
   Types
   ✅ acá agregamos ALIAS amigables: VariantRow / QuoteRow
   (sin romper los nombres viejos)
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

  buyFactor?: number;
  saleFactor?: number;
  purchasePriceOverride?: number | null;
  salePriceOverride?: number | null;
  pricingMode?: "AUTO" | "OVERRIDE" | string;

  suggestedPrice?: number;
  finalPurchasePrice?: number;
  finalSalePrice?: number;

  referenceValue?: number;
};

// ✅ alias “cómodo”
export type VariantRow = MetalVariantRow;

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

// ✅ alias “cómodo”
export type QuoteRow = MetalQuoteRow;

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

  clearPurchaseOverride?: boolean;
  clearSaleOverride?: boolean;
};

/* =========================
   Monedas
========================= */

export async function getCurrencies() {
  return apiFetch("/valuation/currencies");
}

// alias compatible (si alguien lo usa)
export const listCurrencies = getCurrencies;

export async function createCurrency(data: { code: string; name: string; symbol: string; initialRate?: number | null }) {
  const resp = await post("/valuation/currencies", data);
  emitValuationChanged({ kind: "currencies:created", currencyId: pickId(resp) });
  return resp;
}

export async function updateCurrency(currencyId: string, data: { code: string; name: string; symbol: string }) {
  const resp = await patch(`/valuation/currencies/${currencyId}`, data);
  emitValuationChanged({ kind: "currencies:updated", currencyId });
  return resp;
}

export async function deleteCurrency(currencyId: string) {
  const resp = await del(`/valuation/currencies/${currencyId}`);
  emitValuationChanged({ kind: "currencies:deleted", currencyId });
  return resp;
}

export async function setBaseCurrency(currencyId: string, _opts?: { effectiveAt?: string | Date }) {
  const resp = await post(`/valuation/currencies/${currencyId}/set-base`);
  emitValuationChanged({ kind: "currencies:base-changed", newBaseId: currencyId });
  return resp;
}

export async function toggleCurrencyActive(currencyId: string, isActive: boolean) {
  const resp = await patch(`/valuation/currencies/${currencyId}/active`, { isActive });
  emitValuationChanged({ kind: "currencies:active-changed", currencyId, isActive });
  return resp;
}

export async function addCurrencyRate(currencyId: string, data: { rate: number; effectiveAt: string | Date }) {
  const resp = await post(`/valuation/currencies/${currencyId}/rates`, data);
  emitValuationChanged({ kind: "currencies:rate-added", currencyId });
  return resp;
}

export async function getCurrencyRates(currencyId: string, take = 50) {
  return apiFetch(`/valuation/currencies/${currencyId}/rates${qs({ take })}`);
}
export const listCurrencyRates = getCurrencyRates;

export async function getCurrencyRateHistory(currencyId: string, take = 80) {
  return apiFetch(`/valuation/currencies/${currencyId}/rate-history${qs({ take })}`);
}

/* =========================
   Metales
========================= */

export async function getMetals() {
  return apiFetch("/valuation/metals");
}
export const listMetals = getMetals;

export async function createMetal(data: { name: string; symbol?: string; referenceValue?: number }) {
  const resp = await post("/valuation/metals", data);
  emitValuationChanged({ kind: "metals:created", metalId: pickId(resp) });
  return resp;
}

export async function updateMetal(metalId: string, data: { name: string; symbol?: string; referenceValue?: number }) {
  const resp = await patch(`/valuation/metals/${metalId}`, data);
  emitValuationChanged({ kind: "metals:updated", metalId });
  return resp;
}

export async function deleteMetal(metalId: string) {
  const resp = await del(`/valuation/metals/${metalId}`);
  emitValuationChanged({ kind: "metals:deleted", metalId });
  return resp;
}

export async function toggleMetalActive(metalId: string, isActive: boolean) {
  const resp = await patch(`/valuation/metals/${metalId}/active`, { isActive });
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
  return apiFetch(`/valuation/metals/${metalId}/ref-history${qs({ take })}`);
}

export async function moveMetal(
  metalId: string,
  dir: "UP" | "DOWN"
): Promise<{ ok: boolean; changed: boolean; rows?: MetalRow[]; error?: string }> {
  const resp = await post(`/valuation/metals/${metalId}/move`, { dir });
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
  const resp = await post("/valuation/variants", data);
  emitValuationChanged({ kind: "variants:created", metalId: data.metalId, variantId: pickId(resp) });
  return resp;
}

export async function updateVariant(
  variantId: string,
  data: { name?: string; sku?: string; purity?: number; saleFactor?: number; salePriceOverride?: number | null },
  metalId?: string
) {
  const resp = await patch(`/valuation/variants/${variantId}`, data);
  const mid = s(metalId) || s(pickMetalId(resp)) || undefined;
  emitValuationChanged({ kind: "variants:updated", variantId, metalId: mid });
  return resp;
}

export async function updateVariantPricing(variantId: string, patchData: VariantPricingPatch, metalId?: string) {
  const resp = await patch(`/valuation/variants/${variantId}/pricing`, patchData);
  const mid = s(metalId) || s(pickMetalId(resp)) || undefined;
  emitValuationChanged({ kind: "variants:pricing-updated", variantId, metalId: mid });
  return resp;
}

export async function deleteVariant(variantId: string, metalId?: string) {
  const resp = await del(`/valuation/variants/${variantId}`);
  const mid = s(metalId) || s(pickMetalId(resp)) || undefined;
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
  return apiFetch(`/valuation/metals/${metalId}/variants${qs(params as any)}`);
}
export const listVariants = getVariants;

export async function toggleVariantActive(variantId: string, isActive: boolean, metalId?: string) {
  const resp = await patch(`/valuation/variants/${variantId}/active`, { isActive });
  const mid = s(metalId) || s(pickMetalId(resp)) || undefined;
  emitValuationChanged({ kind: "variants:active-changed", variantId, isActive, metalId: mid });
  return resp;
}

export async function setFavoriteVariant(variantId: string, metalId?: string) {
  const resp = await post(`/valuation/variants/${variantId}/set-favorite`);
  const mid = s(metalId) || s(pickMetalId(resp)) || undefined;
  emitValuationChanged({ kind: "variants:favorite-changed", variantId, metalId: mid });
  return resp;
}

export async function clearFavoriteVariant(metalId: string) {
  const resp = await post(`/valuation/metals/${metalId}/clear-favorite`);
  emitValuationChanged({ kind: "variants:favorite-changed", variantId: null, metalId });
  return resp;
}

export async function getVariantValueHistory(
  variantId: string,
  opts?: { take?: number; from?: string | Date | null; to?: string | Date | null }
) {
  const take = Number(opts?.take);
  const q: any = {};
  if (Number.isFinite(take) && take > 0) q.take = Math.min(200, Math.trunc(take));
  if (opts?.from) q.from = String(opts.from);
  if (opts?.to) q.to = String(opts.to);

  return apiFetch(`/valuation/variants/${variantId}/value-history${qs(q)}`);
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
  metalId?: string;
}) {
  const resp = await post("/valuation/quotes", data);

  const mid = s(data.metalId) || s(pickMetalId(resp)) || undefined;
  emitValuationChanged({ kind: "quotes:added", variantId: data.variantId, metalId: mid });

  return resp;
}

export async function getQuotes(variantId: string, take = 50) {
  return apiFetch(`/valuation/variants/${variantId}/quotes${qs({ take })}`);
}
export const listQuotes = getQuotes;