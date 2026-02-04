// tptech-frontend/src/hooks/useCatalog.ts
import { useCallback, useEffect, useState } from "react";
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
      const resp = await listCatalog(type);
      setItems(Array.isArray(resp?.items) ? resp.items : []);
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

      // ✅ dejamos que backend maneje duplicados (P2002 => devuelve existente)
      // para evitar depender de 'items' del render (stale).
      await createCatalogItem(type, clean, 0);

      // refresco para traer el item (nuevo o existente)
      await refresh();
    },
    [type, refresh]
  );

  useEffect(() => {
    if (!auto) return;
    void refresh();
  }, [auto, refresh]);

  return { items, loading, error, refresh, createItem };
}
