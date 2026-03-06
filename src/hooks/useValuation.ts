// src/hooks/useValuation.ts
import { useCallback, useEffect, useRef, useState } from "react";
import * as valuation from "../services/valuation";
import { TPTECH_VALUATION_CHANGED } from "../services/valuation";

import type {
  CurrencyRow,
  CurrencyRateRow,
  MetalRow,
  MetalRefHistoryItem,
  MetalQuoteRow as QuoteRow, // ✅ si en service se llama MetalQuoteRow
  MetalVariantRow as VariantRow, // ✅ si en service se llama MetalVariantRow
  VariantPricingPatch,
} from "../services/valuation";

/**
 * ✅ Si en tu services/valuation.ts NO exporta MetalVariantRow/MetalQuoteRow con esos nombres,
 * cambiá estos imports por los nombres reales (o borrá los alias y dejá VariantRow/QuoteRow).
 *
 * En tu services pegado aparecen:
 *  - export type MetalVariantRow
 *  - export type MetalQuoteRow
 */

// ✅ historial “tipo metales” (tu service lo devuelve en getVariantValueHistory)
export type VariantValueHistoryItem = {
  id: string;
  effectiveAt?: string;
  createdAt?: string;

  suggestedPrice?: number;
  finalPurchasePrice?: number;
  finalSalePrice?: number;

  reason?: string;

  currency?: { id: string; code: string; symbol: string; isBase?: boolean; isActive?: boolean };
  user?: { id: string; name: string | null; email: string } | null;
};

/* =========================
   Helpers (simples)
========================= */

type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; error: string };
type Res<T> = Ok<T> | Fail;

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

function pickId(resp: any): string | null {
  const id =
    resp?.id ??
    resp?.row?.id ??
    resp?.data?.id ??
    resp?.data?.row?.id ??
    resp?.currency?.id ??
    resp?.data?.currency?.id ??
    null;

  const s = String(id ?? "").trim();
  return s ? s : null;
}

function normKey(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function normCode(v: any) {
  return String(v ?? "").trim().toUpperCase();
}
function normId(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

export function useValuation() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [metals, setMetals] = useState<MetalRow[]>([]);

  // ✅ no hace falta memo para esto
  const baseCurrency = currencies.find((c) => (c as any).isBase) ?? null;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetchGenRef = useRef(0);
  const initialLoadedRef = useRef(false);

  /* =========================
     Wrappers: run / runSaving
  ========================= */

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<Res<T>> => {
    if (mountedRef.current) setError(null);
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (e: any) {
      const msg = getErrorMessage(e);
      if (mountedRef.current) setError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  const runSaving = useCallback(async <T,>(fn: () => Promise<T>): Promise<Res<T>> => {
    if (mountedRef.current) {
      setError(null);
      setSaving(true);
    }
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (e: any) {
      const msg = getErrorMessage(e);
      if (mountedRef.current) setError(msg);
      return { ok: false, error: msg };
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, []);

  /* =========================
     Loaders
  ========================= */

  const loadCurrencies = useCallback(async (gen?: number) => {
    const resp = await valuation.getCurrencies();
    if (!mountedRef.current) return;
    if (typeof gen === "number" && gen !== refetchGenRef.current) return;
    setCurrencies(pickRows(resp));
  }, []);

  const loadMetals = useCallback(async (gen?: number) => {
    const resp = await valuation.getMetals();
    if (!mountedRef.current) return;
    if (typeof gen === "number" && gen !== refetchGenRef.current) return;
    setMetals(pickRows(resp));
  }, []);

  const refetch = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (mountedRef.current) setError(null);

      const gen = ++refetchGenRef.current;

      try {
        if (!silent || !initialLoadedRef.current) setLoading(true);
        await Promise.all([loadCurrencies(gen), loadMetals(gen)]);
        if (mountedRef.current && gen === refetchGenRef.current) initialLoadedRef.current = true;
      } catch (e: any) {
        if (!mountedRef.current) return;
        if (gen !== refetchGenRef.current) return;
        setError(getErrorMessage(e));
      } finally {
        if (!mountedRef.current) return;
        if (gen !== refetchGenRef.current) return;
        setLoading(false);
      }
    },
    [loadCurrencies, loadMetals]
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /* =========================
     Auto-refresh global (evento)
  ========================= */

  const refreshTimerRef = useRef<any>(null);
  useEffect(() => {
    function scheduleSilentRefresh() {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        void refetch({ silent: true });
      }, 80);
    }

    function onValuationChanged() {
      scheduleSilentRefresh();
    }

    if (typeof window !== "undefined") {
      window.addEventListener(TPTECH_VALUATION_CHANGED, onValuationChanged as any);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(TPTECH_VALUATION_CHANGED, onValuationChanged as any);
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [refetch]);

  /* =========================
     Monedas
  ========================= */

  const createCurrency = useCallback(
    async (data: { code: string; name: string; symbol: string }) => {
      const code = normCode(data?.code);
      if (!code) return { ok: false as const, error: "Código requerido." };

      const exists = (currencies || []).some((c: any) => normCode(c.code) === code);
      if (exists) return { ok: false as const, error: `Ya existe una moneda con código "${code}".` };

      const r = await runSaving(async () => {
        const resp = await valuation.createCurrency({ ...data, code } as any);
        const createdId = pickId(resp);
        await loadCurrencies(refetchGenRef.current);
        return createdId;
      });

      return r.ok
        ? { ok: true as const, currencyId: r.data as string | null }
        : { ok: false as const, error: r.error };
    },
    [currencies, loadCurrencies, runSaving]
  );

  const updateCurrency = useCallback(
    async (currencyId: string, data: { code: string; name: string; symbol: string }) => {
      const id = normId(currencyId);
      if (!id) return { ok: false as const, error: "Moneda inválida." };

      const code = normCode(data?.code);
      if (!code) return { ok: false as const, error: "Código requerido." };

      const exists = (currencies || []).some((c: any) => c.id !== id && normCode(c.code) === code);
      if (exists) return { ok: false as const, error: `Ya existe una moneda con código "${code}".` };

      const r = await runSaving(async () => {
        await valuation.updateCurrency(id, { ...data, code } as any);
        await loadCurrencies(refetchGenRef.current);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [currencies, loadCurrencies, runSaving]
  );

  const setBaseCurrency = useCallback(
    async (currencyId: string, opts?: { effectiveAt?: string | Date }) => {
      const id = normId(currencyId);
      if (!id) return { ok: false as const, error: "Moneda inválida." };

      const r = await runSaving(async () => {
        await valuation.setBaseCurrency(id, opts as any);
        await refetch({ silent: false });
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [refetch, runSaving]
  );

  const toggleCurrencyActive = useCallback(
    async (currencyId: string, isActive: boolean) => {
      const id = normId(currencyId);
      if (!id) return { ok: false as const, error: "Moneda inválida." };

      const r = await runSaving(async () => {
        await valuation.toggleCurrencyActive(id, isActive);
        await loadCurrencies(refetchGenRef.current);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [loadCurrencies, runSaving]
  );

  const addCurrencyRate = useCallback(
    async (currencyId: string, data: { rate: number; effectiveAt: string | Date }) => {
      const id = normId(currencyId);
      if (!id) return { ok: false as const, error: "Moneda inválida." };

      const r = await runSaving(async () => {
        await valuation.addCurrencyRate(id, data as any);
        await loadCurrencies(refetchGenRef.current);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [loadCurrencies, runSaving]
  );

  const getCurrencyRates = useCallback(
    async (currencyId: string, take = 50) => {
      const id = normId(currencyId);
      if (!id) return { ok: false as const, error: "Moneda inválida.", rows: [] as CurrencyRateRow[] };

      const r = await run(async () => {
        const resp = await valuation.getCurrencyRates(id, take);
        return pickRows(resp) as CurrencyRateRow[];
      });

      return r.ok
        ? { ok: true as const, rows: r.data as CurrencyRateRow[] }
        : { ok: false as const, error: r.error, rows: [] as CurrencyRateRow[] };
    },
    [run]
  );

  const deleteCurrency = useCallback(
    async (currencyId: string) => {
      const id = normId(currencyId);
      if (!id) return { ok: false as const, error: "Moneda inválida." };

      const r = await runSaving(async () => {
        await valuation.deleteCurrency(id);
        await loadCurrencies(refetchGenRef.current);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [loadCurrencies, runSaving]
  );

  /* =========================
     Metales / Variantes
  ========================= */

  const createMetal = useCallback(
    async (data: { name: string; symbol?: string; referenceValue?: number }) => {
      const nameKey = normKey(data?.name);
      if (!nameKey) return { ok: false as const, error: "Nombre requerido." };

      const symKey = normKey(data?.symbol);

      if ((metals || []).some((m: any) => normKey(m.name) === nameKey)) {
        return { ok: false as const, error: `Ya existe un metal con nombre "${data.name}".` };
      }
      if (symKey && (metals || []).some((m: any) => normKey(m.symbol) === symKey)) {
        return { ok: false as const, error: `Ya existe un metal con símbolo "${data.symbol}".` };
      }

      const r = await runSaving(async () => {
        await valuation.createMetal(data as any);
        await loadMetals(refetchGenRef.current);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [loadMetals, metals, runSaving]
  );

  const updateMetal = useCallback(
    async (metalId: string, data: { name: string; symbol?: string; referenceValue?: number }) => {
      const id = normId(metalId);
      if (!id) return { ok: false as const, error: "Metal inválido." };

      const nameKey = normKey(data?.name);
      if (!nameKey) return { ok: false as const, error: "Nombre requerido." };

      const symKey = normKey(data?.symbol);

      if ((metals || []).some((m: any) => m.id !== id && normKey(m.name) === nameKey)) {
        return { ok: false as const, error: `Ya existe otro metal con nombre "${data.name}".` };
      }
      if (symKey && (metals || []).some((m: any) => m.id !== id && normKey(m.symbol) === symKey)) {
        return { ok: false as const, error: `Ya existe otro metal con símbolo "${data.symbol}".` };
      }

      const r = await runSaving(async () => {
        await valuation.updateMetal(id, data as any);
        await loadMetals(refetchGenRef.current);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [loadMetals, metals, runSaving]
  );

  const toggleMetalActive = useCallback(
    async (metalId: string, isActive: boolean) => {
      const id = normId(metalId);
      if (!id) return { ok: false as const, error: "Metal inválido." };

      const r = await runSaving(async () => {
        await valuation.toggleMetalActive(id, isActive);
        await loadMetals(refetchGenRef.current);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [loadMetals, runSaving]
  );

  const deleteMetal = useCallback(
    async (metalId: string) => {
      const id = normId(metalId);
      if (!id) return { ok: false as const, error: "Metal inválido." };

      const r = await runSaving(async () => {
        await valuation.deleteMetal(id);
        await loadMetals(refetchGenRef.current);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [loadMetals, runSaving]
  );

  const moveMetal = useCallback(
    async (metalId: string, dir: "UP" | "DOWN") => {
      const id = normId(metalId);
      if (!id) return { ok: false as const, error: "Metal inválido.", changed: false as const };

      const r = await runSaving(async () => {
        const resp = await valuation.moveMetal(id, dir);
        if ((resp as any)?.ok) await loadMetals(refetchGenRef.current);
        return resp;
      });

      if (!r.ok) return { ok: false as const, error: r.error, changed: false as const };
      return (r.data ?? { ok: false, changed: false }) as any;
    },
    [loadMetals, runSaving]
  );

  const getMetalRefHistory = useCallback(
    async (metalId: string, take = 80) => {
      const id = normId(metalId);
      if (!id) {
        return {
          ok: false as const,
          error: "Metal inválido.",
          metal: null as any,
          current: null,
          history: [] as MetalRefHistoryItem[],
        };
      }

      const r = await run(async () => valuation.getMetalRefHistory(id, take));
      if (!r.ok) {
        return {
          ok: false as const,
          error: r.error,
          metal: null as any,
          current: null,
          history: [] as MetalRefHistoryItem[],
        };
      }
      return r.data as any;
    },
    [run]
  );

  const getVariants = useCallback(
    async (metalId: string, params?: any) => {
      const id = normId(metalId);
      if (!id) return { ok: false as const, error: "Metal inválido.", rows: [] as VariantRow[] };

      const r = await run(async () => {
        const resp = await valuation.getVariants(id, params);
        return pickRows(resp) as VariantRow[];
      });

      return r.ok
        ? { ok: true as const, rows: r.data as VariantRow[] }
        : { ok: false as const, error: r.error, rows: [] as VariantRow[] };
    },
    [run]
  );

  const createVariant = useCallback(
    async (payload: any) => {
      const r = await runSaving(async () => {
        const resp = await (valuation as any).createVariant(payload);
        const row = resp?.row ?? resp?.data?.row ?? null;
        return row as VariantRow | null;
      });

      return r.ok
        ? { ok: true as const, row: r.data as VariantRow | null }
        : { ok: false as const, error: r.error, row: null as VariantRow | null };
    },
    [runSaving]
  );

  const updateVariant = useCallback(
    async (variantId: string, data: any) => {
      const id = normId(variantId);
      if (!id) return { ok: false as const, error: "Variante inválida." };

      const r = await runSaving(async () => {
        await (valuation as any).updateVariant(id, data as any);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [runSaving]
  );

  const updateVariantPricing = useCallback(
    async (variantId: string, patch: VariantPricingPatch) => {
      const id = normId(variantId);
      if (!id) return { ok: false as const, error: "Variante inválida." };

      const r = await runSaving(async () => {
        await valuation.updateVariantPricing(id, patch as any);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [runSaving]
  );

  const deleteVariant = useCallback(
    async (variantId: string) => {
      const id = normId(variantId);
      if (!id) return { ok: false as const, error: "Variante inválida." };

      const r = await runSaving(async () => {
        await (valuation as any).deleteVariant(id);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [runSaving]
  );

  const toggleVariantActive = useCallback(
    async (variantId: string, isActive: boolean) => {
      const id = normId(variantId);
      if (!id) return { ok: false as const, error: "Variante inválida." };

      const r = await runSaving(async () => {
        await valuation.toggleVariantActive(id, isActive);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [runSaving]
  );

  const setFavoriteVariant = useCallback(
    async (variantId: string | null, metalId?: string) => {
      const r = await runSaving(async () => {
        if (variantId === null) {
          const mid = normId(metalId);
          if (!mid) throw new Error("Metal requerido para quitar favorito.");

          if (typeof (valuation as any).clearFavoriteVariant === "function") {
            await (valuation as any).clearFavoriteVariant(mid);
            return true;
          }

          throw new Error("Falta endpoint/service para limpiar favorito del metal.");
        }

        await valuation.setFavoriteVariant(variantId);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [runSaving]
  );

  const addQuote = useCallback(
    async (data: any) => {
      const r = await runSaving(async () => {
        await valuation.addQuote(data);
        return true;
      });

      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    },
    [runSaving]
  );

  const getQuotes = useCallback(
    async (variantId: string, take = 50) => {
      const id = normId(variantId);
      if (!id) return { ok: false as const, error: "Variante inválida.", rows: [] as QuoteRow[] };

      const r = await run(async () => {
        const resp = await valuation.getQuotes(id, take);
        return pickRows(resp) as QuoteRow[];
      });

      return r.ok
        ? { ok: true as const, rows: r.data as QuoteRow[] }
        : { ok: false as const, error: r.error, rows: [] as QuoteRow[] };
    },
    [run]
  );

  const getVariantQuotes = useCallback(
    async (variantId: string, take = 50) => await getQuotes(variantId, take),
    [getQuotes]
  );

  /**
   * ✅ Historial “tipo metales”
   * Devuelve rows=history para que tu modal no cambie firma.
   */
  const getVariantValueHistory = useCallback(
    async (variantId: string, take = 200) => {
      const id = normId(variantId);
      if (!id) return { ok: false as const, error: "Variante inválida.", rows: [] as VariantValueHistoryItem[] };

      const r = await run(async () => {
        const resp = await (valuation as any).getVariantValueHistory(id, { take });
        const history: VariantValueHistoryItem[] = resp?.history ?? resp?.data?.history ?? [];
        return {
          variant: resp?.variant ?? resp?.data?.variant ?? null,
          current: resp?.current ?? resp?.data?.current ?? (history[0] ?? null),
          rows: history,
        };
      });

      return r.ok
        ? ({ ok: true as const, ...(r.data as any) } as any)
        : { ok: false as const, error: r.error, rows: [] as VariantValueHistoryItem[] };
    },
    [run]
  );

  /**
   * ✅ Historial de “cotizaciones / quotes” (para el modal de historial de variante)
   * - Usa valuation.getVariantQuoteHistory si existe
   * - Si no existe, cae a valuation.getQuotes
   * Devuelve { ok, rows, variant, current }.
   */
  const getVariantQuoteHistory = useCallback(
    async (variantId: string, take = 200) => {
      const id = normId(variantId);
      if (!id) return { ok: false as const, error: "Variante inválida.", rows: [] as any[] };

      const r = await run(async () => {
        // preferimos endpoint “rico”
        if (typeof (valuation as any).getVariantQuoteHistory === "function") {
          const resp = await (valuation as any).getVariantQuoteHistory(id, take);

          const rows = resp?.rows ?? resp?.data?.rows ?? resp?.history ?? resp?.data?.history ?? pickRows(resp) ?? [];
          const current = resp?.current ?? resp?.data?.current ?? (Array.isArray(rows) ? rows[0] : null);

          return {
            variant: resp?.variant ?? resp?.data?.variant ?? null,
            current,
            rows: Array.isArray(rows) ? rows : [],
          };
        }

        // fallback: quotes simple
        const resp = await valuation.getQuotes(id, Math.min(200, Math.max(1, take)));
        const rows = pickRows(resp);
        const current = Array.isArray(rows) ? rows[0] : null;

        return { variant: null, current, rows: Array.isArray(rows) ? rows : [] };
      });

      return r.ok
        ? ({ ok: true as const, ...(r.data as any) } as any)
        : { ok: false as const, error: r.error, rows: [] as any[] };
    },
    [run]
  );

  return {
    loading,
    saving,
    error,

    currencies,
    metals,
    baseCurrency,

    refetch,

    createCurrency,
    updateCurrency,
    setBaseCurrency,
    toggleCurrencyActive,
    addCurrencyRate,
    getCurrencyRates,
    deleteCurrency,

    createMetal,
    updateMetal,
    toggleMetalActive,
    deleteMetal,

    moveMetal,
    getMetalRefHistory,

    getVariants,
    createVariant,
    updateVariant,
    updateVariantPricing,
    deleteVariant,
    toggleVariantActive,
    setFavoriteVariant,
    addQuote,

    getQuotes,
    getVariantQuotes,

    // ✅ historial de variante (value-history)
    getVariantValueHistory,

    // ✅ historial de variante (quote-history / fallback quotes)
    getVariantQuoteHistory,
  };
}