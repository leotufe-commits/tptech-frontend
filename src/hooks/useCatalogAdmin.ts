// tptech-frontend/src/hooks/useCatalogAdmin.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogItem, CatalogType } from "../services/catalogs";
import { bulkCreateCatalogItems, createCatalogItem, listCatalog, updateCatalogItem } from "../services/catalogs";

type CatalogListResponse = { items?: CatalogItem[] } | CatalogItem[] | null | undefined;

function readItemsFromList(r: CatalogListResponse): CatalogItem[] {
  if (!r) return [];
  if (Array.isArray(r)) return r;
  return Array.isArray(r.items) ? r.items : [];
}

export function useCatalogAdmin(type: CatalogType) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = (await listCatalog(type, { includeInactive: true })) as CatalogListResponse;
      setItems(readItemsFromList(r));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addOne = useCallback(
    async (label: string, sortOrder = 0) => {
      setBusy(true);
      setError(null);
      try {
        await createCatalogItem(type, label, sortOrder);
        await reload();
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setBusy(false);
      }
    },
    [type, reload]
  );

  const addBulk = useCallback(
    async (labels: string[], sortOrderStart = 0) => {
      setBusy(true);
      setError(null);
      try {
        await bulkCreateCatalogItems(type, labels, sortOrderStart);
        await reload();
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setBusy(false);
      }
    },
    [type, reload]
  );

  const update = useCallback(
    async (id: string, patch: Partial<{ label: string; isActive: boolean; sortOrder: number }>) => {
      setBusy(true);
      setError(null);
      try {
        await updateCatalogItem(id, patch);
        await reload();
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setBusy(false);
      }
    },
    [reload]
  );

  const activeCount = useMemo(() => items.filter((x) => x.isActive).length, [items]);

  return { items, loading, busy, error, reload, addOne, addBulk, update, activeCount };
}
