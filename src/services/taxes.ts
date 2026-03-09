// src/services/taxes.ts
import { apiFetch } from "../lib/api";

export type TaxType = "IVA" | "INTERNAL" | "PERCEPTION" | "RETENTION" | "OTHER";
export type TaxCalculationType = "PERCENTAGE" | "FIXED_AMOUNT" | "PERCENTAGE_PLUS_FIXED";
export type TaxApplyOn =
  | "TOTAL"
  | "METAL"
  | "HECHURA"
  | "METAL_Y_HECHURA"
  | "SUBTOTAL_AFTER_DISCOUNT"
  | "SUBTOTAL_BEFORE_DISCOUNT";

export type TaxRow = {
  id: string;
  jewelryId: string;
  name: string;
  code: string;
  taxType: TaxType;
  calculationType: TaxCalculationType;
  rate: string | null;
  fixedAmount: string | null;
  applyOn: TaxApplyOn;
  includedInPrice: boolean;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  sortOrder: number;
  notes: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaxPayload = {
  name: string;
  code?: string;
  taxType: TaxType;
  calculationType: TaxCalculationType;
  rate?: number | null;
  fixedAmount?: number | null;
  applyOn: TaxApplyOn;
  includedInPrice?: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string;
};

export const taxesApi = {
  list: () =>
    apiFetch<TaxRow[]>("/taxes", { method: "GET", on401: "throw" }),

  create: (data: TaxPayload) =>
    apiFetch<TaxRow>("/taxes", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: TaxPayload) =>
    apiFetch<TaxRow>(`/taxes/${id}`, { method: "PUT", body: data, on401: "throw" }),

  clone: (id: string) =>
    apiFetch<TaxRow>(`/taxes/${id}/clone`, { method: "POST", on401: "throw" }),

  toggle: (id: string) =>
    apiFetch<TaxRow>(`/taxes/${id}/toggle`, { method: "PATCH", on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/taxes/${id}`, { method: "DELETE", on401: "throw" }),
};
