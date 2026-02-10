import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogItem, CatalogType } from "../services/catalogs";
import { createCatalogItem, listCatalog } from "../services/catalogs";

function normLabel(v: any) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

export function useCatalog(type: CatalogType, opts?: { auto?: boolean }) {
  const auto = opts?.auto ?? true;

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const arr = await listCatalog(type);
      setItems(Array.isArray(arr) ? arr : []);
    } catch (e: any) {
      setError(String(e?.message || "Error cargando catálogo."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  const createItem = useCallback(
    async (label: string) => {
      const clean = normLabel(label);
      if (!clean) return;

      // backend maneja duplicados
      await createCatalogItem(type, clean, 0);
      await refresh();
    },
    [type, refresh]
  );

  useEffect(() => {
    if (!auto) return;
    void refresh();
  }, [auto, refresh]);

  // 👉 solo lectura: el hook NO decide defaults
  const favoriteItem = useMemo(
    () => items.find((i) => i.isFavorite),
    [items]
  );

  return {
    items,
    favoriteItem, // opcional para CREATE, nunca auto-aplicado
    loading,
    error,
    refresh,
    createItem,
  };
}
