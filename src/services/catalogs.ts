// tptech-frontend/src/services/catalogs.ts
import { apiFetch } from "../lib/api";

export type CatalogType =
  | "IVA_CONDITION"
  | "DOCUMENT_TYPE"
  | "PHONE_PREFIX"
  | "CITY"
  | "PROVINCE"
  | "COUNTRY";

export type CatalogItem = {
  id: string;
  type: CatalogType;
  label: string;
  isActive: boolean;
  sortOrder: number;

  // ✅ NUEVO: favorito (opcional para no romper DB vieja)
  isFavorite?: boolean;

  createdAt?: string;
  updatedAt?: string;
};

/**
 * GET /company/catalogs/:type
 * ✅ DEVUELVE ARRAY DIRECTO (CatalogItem[])
 *
 * opts.force:
 * - agrega cache bust ?_ts=... por si algún proxy/browser cachea igual
 */
export async function listCatalog(
  type: CatalogType,
  opts?: { includeInactive?: boolean; force?: boolean }
): Promise<CatalogItem[]> {
  const qs = new URLSearchParams();

  if (opts?.includeInactive) qs.set("includeInactive", "1");
  if (opts?.force) qs.set("_ts", String(Date.now()));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const resp = await apiFetch<{ items: CatalogItem[] }>(`/company/catalogs/${type}${suffix}`);

  // ✅ tolerante por si algún día el backend devuelve array directo
  const items = (resp as any)?.items ?? resp;
  return Array.isArray(items) ? (items as CatalogItem[]) : [];
}

/**
 * POST /company/catalogs/:type
 */
export async function createCatalogItem(type: CatalogType, label: string, sortOrder = 0) {
  return apiFetch<{ item: CatalogItem; created?: boolean }>(`/company/catalogs/${type}`, {
    method: "POST",
    body: { label, sortOrder },
  });
}

/**
 * POST /company/catalogs/:type/bulk
 */
export async function bulkCreateCatalogItems(type: CatalogType, labels: string[], sortOrderStart = 0) {
  return apiFetch<{ ok: boolean; requested: number; created: number; skipped: number }>(
    `/company/catalogs/${type}/bulk`,
    {
      method: "POST",
      body: { labels, sortOrderStart },
    }
  );
}

/**
 * PATCH /company/catalogs/item/:id
 */
export async function updateCatalogItem(
  id: string,
  data: Partial<{ label: string; isActive: boolean; sortOrder: number; isFavorite: boolean }>
) {
  return apiFetch<{ item: CatalogItem }>(`/company/catalogs/item/${id}`, {
    method: "PATCH",
    body: data,
  });
}

/**
 * ✅ Endpoint dedicado a favorito (recomendado)
 * PATCH /company/catalogs/item/:id/favorite
 * Body: { isFavorite: boolean }
 */
export async function setCatalogItemFavorite(id: string, isFavorite: boolean) {
  return apiFetch<{ item: CatalogItem }>(`/company/catalogs/item/${id}/favorite`, {
    method: "PATCH",
    body: { isFavorite },
  });
}
