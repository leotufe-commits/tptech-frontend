// src/hooks/useValuation.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as valuation from "../services/valuation";

export type CurrencyRow = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  isActive: boolean;

  latestRate?: number | null;
  latestAt?: string | null;
  latestCreatedAt?: string | null;
};

export type CurrencyRateRow = {
  id: string;
  currencyId: string;
  rate: number;
  effectiveAt?: string;
  createdAt?: string;
};

export type MetalRow = {
  id: string;
  name: string;
  symbol?: string;
  referenceValue?: number | null;
  isActive: boolean;
  sortOrder?: number | null;
};

export type MetalRefHistoryItem = {
  id: string;
  referenceValue: number;
  effectiveAt: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
};

export type VariantRow = {
  id: string;
  metalId: string;
  name: string;
  sku: string;
  purity: number;
  isActive: boolean;
  isFavorite?: boolean;

  // ✅ persistidos
  buyFactor?: number;
  saleFactor?: number;
  purchasePriceOverride?: number | null;
  salePriceOverride?: number | null;
  pricingMode?: "AUTO" | "OVERRIDE" | string;

  // ✅ calculados backend (por referenceValue actual del metal)
  suggestedPrice?: number;
  finalPurchasePrice?: number;
  finalSalePrice?: number;
  referenceValue?: number;

  quotes?: Array<{
    id: string;
    purchasePrice: number;
    salePrice: number;
    effectiveAt?: string;
    createdAt?: string;
    currency?: { id: string; code: string; symbol: string };
  }>;
};

export type QuoteRow = {
  id: string;
  variantId: string;
  currencyId: string;
  purchasePrice: number;
  salePrice: number;
  effectiveAt?: string;
  createdAt?: string;
  currency?: { id: string; code: string; symbol: string };
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

function getErrorMessage(e: any) {
  if (!e) return "Error";
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  if (typeof e?.error === "string") return e.error;
  try {
    return JSON.stringify(e);
  } catch {
    return "Error";
  }
}

function pickRows(resp: any) {
  return resp?.rows ?? resp?.data?.rows ?? resp?.data ?? resp ?? [];
}

function normKey(v: any) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function normCode(v: any) {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

export function useValuation() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [metals, setMetals] = useState<MetalRow[]>([]);

  const baseCurrency = useMemo(() => currencies.find((c) => c.isBase) ?? null, [currencies]);

  // evita setState si el componente se desmonta
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadCurrencies = useCallback(async () => {
    const c = await valuation.getCurrencies();
    if (!mountedRef.current) return;
    setCurrencies(pickRows(c));
  }, []);

  const loadMetals = useCallback(async () => {
    const m = await valuation.getMetals();
    if (!mountedRef.current) return;
    setMetals(pickRows(m));
  }, []);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      setLoading(true);
      await Promise.all([loadCurrencies(), loadMetals()]);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(getErrorMessage(e));
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }, [loadCurrencies, loadMetals]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /* =========================
     Monedas
  ========================= */

  const createCurrency = useCallback(
    async (data: { code: string; name: string; symbol: string }) => {
      setError(null);
      try {
        const code = normCode(data?.code);
        if (!code) return { ok: false as const, error: "Código requerido." };

        // ✅ no permitir duplicados por code (case-insensitive)
        const exists = currencies.some((c) => normCode(c.code) === code);
        if (exists) return { ok: false as const, error: `Ya existe una moneda con código "${code}".` };

        setSaving(true);
        await valuation.createCurrency({ ...data, code });
        await refetch();
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [refetch, currencies]
  );

  const updateCurrency = useCallback(
    async (currencyId: string, data: { code: string; name: string; symbol: string }) => {
      setError(null);
      try {
        const id = String(currencyId || "").trim();
        if (!id) return { ok: false as const, error: "Moneda inválida." };

        const code = normCode(data?.code);
        if (!code) return { ok: false as const, error: "Código requerido." };

        // ✅ no permitir duplicados por code, excluyendo la misma moneda
        const exists = currencies.some((c) => c.id !== id && normCode(c.code) === code);
        if (exists) return { ok: false as const, error: `Ya existe una moneda con código "${code}".` };

        setSaving(true);
        await valuation.updateCurrency(id, { ...data, code });
        await refetch();
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [refetch, currencies]
  );

  const setBaseCurrency = useCallback(
    async (currencyId: string, opts?: { effectiveAt?: string | Date }) => {
      setError(null);
      try {
        setSaving(true);
        await valuation.setBaseCurrency(currencyId, opts);
        await Promise.all([loadCurrencies(), loadMetals()]);
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [loadCurrencies, loadMetals]
  );

  const toggleCurrencyActive = useCallback(
    async (currencyId: string, isActive: boolean) => {
      setError(null);
      try {
        setSaving(true);
        await valuation.toggleCurrencyActive(currencyId, isActive);
        await loadCurrencies();
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [loadCurrencies]
  );

  const addCurrencyRate = useCallback(
    async (currencyId: string, data: { rate: number; effectiveAt: string | Date }) => {
      setError(null);
      try {
        setSaving(true);
        await valuation.addCurrencyRate(currencyId, data);
        await loadCurrencies();
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [loadCurrencies]
  );

  const getCurrencyRates = useCallback(async (currencyId: string, take = 50) => {
    setError(null);
    try {
      const resp = await valuation.getCurrencyRates(currencyId, take);
      const rows: CurrencyRateRow[] = pickRows(resp);
      return { ok: true as const, rows };
    } catch (e) {
      const msg = getErrorMessage(e);
      if (mountedRef.current) setError(msg);
      return { ok: false as const, error: msg, rows: [] as CurrencyRateRow[] };
    }
  }, []);

  const deleteCurrency = useCallback(
    async (currencyId: string) => {
      setError(null);
      try {
        const id = String(currencyId || "").trim();
        if (!id) return { ok: false as const, error: "Moneda inválida." };

        setSaving(true);
        await valuation.deleteCurrency(id);
        await loadCurrencies();
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [loadCurrencies]
  );

  /* =========================
     Metales
  ========================= */

  const createMetal = useCallback(
    async (data: { name: string; symbol?: string; referenceValue?: number }) => {
      setError(null);
      try {
        const nameKey = normKey(data?.name);
        if (!nameKey) return { ok: false as const, error: "Nombre requerido." };

        const symKey = normKey(data?.symbol);

        if (metals.some((m) => normKey(m.name) === nameKey)) {
          return { ok: false as const, error: `Ya existe un metal con nombre "${data.name}".` };
        }

        if (symKey && metals.some((m) => normKey(m.symbol) === symKey)) {
          return { ok: false as const, error: `Ya existe un metal con símbolo "${data.symbol}".` };
        }

        setSaving(true);
        await valuation.createMetal(data);
        await loadMetals();
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [loadMetals, metals]
  );

  const updateMetal = useCallback(
    async (metalId: string, data: { name: string; symbol?: string; referenceValue?: number }) => {
      setError(null);
      try {
        const id = String(metalId || "").trim();
        if (!id) return { ok: false as const, error: "Metal inválido." };

        const nameKey = normKey(data?.name);
        if (!nameKey) return { ok: false as const, error: "Nombre requerido." };

        const symKey = normKey(data?.symbol);

        if (metals.some((m) => m.id !== id && normKey(m.name) === nameKey)) {
          return { ok: false as const, error: `Ya existe otro metal con nombre "${data.name}".` };
        }

        if (symKey && metals.some((m) => m.id !== id && normKey(m.symbol) === symKey)) {
          return { ok: false as const, error: `Ya existe otro metal con símbolo "${data.symbol}".` };
        }

        setSaving(true);
        await valuation.updateMetal(id, data as any);
        await loadMetals();
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [loadMetals, metals]
  );

  const toggleMetalActive = useCallback(
    async (metalId: string, isActive: boolean) => {
      setError(null);
      try {
        setSaving(true);
        await valuation.toggleMetalActive(metalId, isActive);
        await loadMetals();
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [loadMetals]
  );

  const deleteMetal = useCallback(
    async (metalId: string) => {
      setError(null);
      try {
        const id = String(metalId || "").trim();
        if (!id) return { ok: false as const, error: "Metal inválido." };

        setSaving(true);
        await valuation.deleteMetal(id);
        await loadMetals();
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [loadMetals]
  );

  const moveMetal = useCallback(
    async (metalId: string, dir: "UP" | "DOWN") => {
      setError(null);
      try {
        const id = String(metalId || "").trim();
        if (!id) return { ok: false as const, error: "Metal inválido.", changed: false as const };

        setSaving(true);
        const r = await valuation.moveMetal(id, dir);
        if (r?.ok) await loadMetals();
        return r;
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg, changed: false as const };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [loadMetals]
  );

  const getMetalRefHistory = useCallback(async (metalId: string, take = 80) => {
    setError(null);
    try {
      const id = String(metalId || "").trim();
      if (!id) {
        return {
          ok: false as const,
          error: "Metal inválido.",
          metal: null as any,
          current: null,
          history: [] as MetalRefHistoryItem[],
        };
      }

      const r = await valuation.getMetalRefHistory(id, take);
      return r;
    } catch (e) {
      const msg = getErrorMessage(e);
      if (mountedRef.current) setError(msg);
      return {
        ok: false as const,
        error: msg,
        metal: null as any,
        current: null,
        history: [] as MetalRefHistoryItem[],
      };
    }
  }, []);

  /* =========================
     Variantes / Quotes
  ========================= */

  const getVariants = useCallback(
    async (
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
    ) => {
      setError(null);
      try {
        const resp = await valuation.getVariants(metalId, params);
        const rows: VariantRow[] = pickRows(resp);
        return { ok: true as const, rows };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg, rows: [] as VariantRow[] };
      }
    },
    []
  );

  const createVariant = useCallback(
    async (payload: {
      metalId: string;
      name: string;
      sku: string;
      purity: number;
      buyFactor?: number;
      saleFactor?: number;
      purchasePriceOverride?: number | null;
      salePriceOverride?: number | null;
    }) => {
      setError(null);
      try {
        setSaving(true);
        const resp = await (valuation as any).createVariant(payload);
        const row = resp?.row ?? resp?.data?.row ?? null;
        return { ok: true as const, row: row as VariantRow | null };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg, row: null as VariantRow | null };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    []
  );

  // ✅ NUEVO: editar variante (name/sku/purity + pricing)
  const updateVariant = useCallback(
    async (
      variantId: string,
      data: { name?: string; sku?: string; purity?: number; saleFactor?: number; salePriceOverride?: number | null }
    ) => {
      setError(null);
      try {
        const id = String(variantId || "").trim();
        if (!id) return { ok: false as const, error: "Variante inválida." };

        setSaving(true);
        await (valuation as any).updateVariant(id, data as any);
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    []
  );

  const updateVariantPricing = useCallback(async (variantId: string, patch: VariantPricingPatch) => {
    setError(null);
    try {
      const id = String(variantId || "").trim();
      if (!id) return { ok: false as const, error: "Variante inválida." };

      setSaving(true);
      await valuation.updateVariantPricing(id, patch as any);
      return { ok: true as const };
    } catch (e) {
      const msg = getErrorMessage(e);
      if (mountedRef.current) setError(msg);
      return { ok: false as const, error: msg };
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, []);

  const deleteVariant = useCallback(async (variantId: string) => {
    setError(null);
    try {
      const id = String(variantId || "").trim();
      if (!id) return { ok: false as const, error: "Variante inválida." };

      setSaving(true);
      await (valuation as any).deleteVariant(id);
      return { ok: true as const };
    } catch (e) {
      const msg = getErrorMessage(e);
      if (mountedRef.current) setError(msg);
      return { ok: false as const, error: msg };
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, []);

  const toggleVariantActive = useCallback(async (variantId: string, isActive: boolean) => {
    setError(null);
    try {
      setSaving(true);
      await valuation.toggleVariantActive(variantId, isActive);
      return { ok: true as const };
    } catch (e) {
      const msg = getErrorMessage(e);
      if (mountedRef.current) setError(msg);
      return { ok: false as const, error: msg };
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, []);

  /**
   * ✅ FAVORITO (con deselección)
   * - variantId string => setear favorita
   * - variantId null => limpiar favorito del metal (requiere metalId)
   *
   * IMPORTANTE: el panel debe llamar setFavoriteVariant(null, selectedMetalId)
   */
  const setFavoriteVariant = useCallback(
    async (variantId: string | null, metalId?: string) => {
      setError(null);
      try {
        setSaving(true);

        if (variantId === null) {
          const mid = String(metalId || "").trim();
          if (!mid) return { ok: false as const, error: "Metal requerido para quitar favorito." };

          // si existe endpoint dedicado, úsalo
          if (typeof (valuation as any).clearFavoriteVariant === "function") {
            await (valuation as any).clearFavoriteVariant(mid);
            return { ok: true as const };
          }

          return { ok: false as const, error: "Falta endpoint/service para limpiar favorito del metal." };
        }

        await valuation.setFavoriteVariant(variantId);
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    []
  );

  const addQuote = useCallback(
    async (data: {
      variantId: string;
      currencyId: string;
      purchasePrice: number;
      salePrice: number;
      effectiveAt?: string | Date;
    }) => {
      setError(null);
      try {
        setSaving(true);
        await valuation.addQuote(data);
        return { ok: true as const };
      } catch (e) {
        const msg = getErrorMessage(e);
        if (mountedRef.current) setError(msg);
        return { ok: false as const, error: msg };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    []
  );

  const getQuotes = useCallback(async (variantId: string, take = 50) => {
    setError(null);
    try {
      const resp = await valuation.getQuotes(variantId, take);
      const rows: QuoteRow[] = pickRows(resp);
      return { ok: true as const, rows };
    } catch (e) {
      const msg = getErrorMessage(e);
      if (mountedRef.current) setError(msg);
      return { ok: false as const, error: msg, rows: [] as QuoteRow[] };
    }
  }, []);

  return {
    loading,
    saving,
    error,

    currencies,
    metals,
    baseCurrency,

    refetch,

    // monedas
    createCurrency,
    updateCurrency,
    setBaseCurrency,
    toggleCurrencyActive,
    addCurrencyRate,
    getCurrencyRates,
    deleteCurrency,

    // metales
    createMetal,
    updateMetal,
    toggleMetalActive,
    deleteMetal,

    // orden / history
    moveMetal,
    getMetalRefHistory,

    // variantes/quotes
    getVariants,
    createVariant,
    updateVariant, // ✅ NUEVO
    updateVariantPricing,
    deleteVariant,
    toggleVariantActive,
    setFavoriteVariant,
    addQuote,
    getQuotes,
  };
}