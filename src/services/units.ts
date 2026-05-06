// tptech-frontend/src/services/units.ts
import { apiFetch } from "../lib/api";

export type UnitType = "QUANTITY" | "WEIGHT" | "LENGTH" | "VOLUME" | "OTHER";

export type Unit = {
  id: string;
  jewelryId?: string;
  name: string;
  code: string;
  type: UnitType;
  isSystem: boolean;
  isFavorite: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type ListUnitsParams = {
  type?: UnitType;
  isActive?: boolean;
  q?: string;
};

export type CreateUnitPayload = {
  name: string;
  code: string;
  type: UnitType;
  isActive?: boolean;
  isFavorite?: boolean;
  sortOrder?: number;
};

export type UpdateUnitPayload = Partial<{
  name: string;
  code: string;
  type: UnitType;
  isActive: boolean;
  sortOrder: number;
}>;

/**
 * GET /company/units
 */
export async function listUnits(params: ListUnitsParams = {}): Promise<Unit[]> {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (typeof params.isActive === "boolean") qs.set("isActive", params.isActive ? "1" : "0");
  if (params.q && params.q.trim()) qs.set("q", params.q.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const resp = await apiFetch<{ items: Unit[] }>(`/company/units${suffix}`);
  const items = (resp as any)?.items ?? resp;
  return Array.isArray(items) ? (items as Unit[]) : [];
}

/**
 * POST /company/units
 */
export async function createUnit(payload: CreateUnitPayload) {
  return apiFetch<{ item: Unit; restored?: boolean }>(`/company/units`, {
    method: "POST",
    body: payload,
  });
}

/**
 * PATCH /company/units/:id
 */
export async function updateUnit(id: string, payload: UpdateUnitPayload) {
  return apiFetch<{ item: Unit }>(`/company/units/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

/**
 * PATCH /company/units/:id/favorite
 */
export async function setFavoriteUnit(id: string, isFavorite: boolean) {
  return apiFetch<{ item: Unit }>(`/company/units/${id}/favorite`, {
    method: "PATCH",
    body: { isFavorite },
  });
}

/**
 * DELETE /company/units/:id (soft delete)
 */
export async function deleteUnit(id: string) {
  return apiFetch<{ ok: boolean }>(`/company/units/${id}`, {
    method: "DELETE",
  });
}
