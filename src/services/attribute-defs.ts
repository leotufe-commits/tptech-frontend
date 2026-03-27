// src/services/attribute-defs.ts
import { apiFetch } from "../lib/api";
import type { AttributeInputType } from "./category-attributes";

export type AttributeDefOption = {
  id: string;
  definitionId: string;
  label: string;
  value: string;
  colorHex: string;
  codeExtension: string;  // extensión para SKU de variante
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Definición global de un atributo (biblioteca del tenant) */
export type AttributeDefRow = {
  id: string;
  jewelryId: string;
  name: string;
  code: string;
  inputType: AttributeInputType;
  helpText: string;
  unit: string;
  defaultValue: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  options: AttributeDefOption[];
  /** Cantidad de categorías donde está asignado */
  assignmentCount: number;
  /** Nombres de las categorías donde está asignado */
  assignedCategories: { id: string; name: string }[];
};

export type AttributeDefPayload = {
  name: string;
  code?: string;
  inputType: AttributeInputType;
  helpText?: string;
  unit?: string;
  defaultValue?: string;
};

export type AttributeDefOptionPayload = {
  label: string;
  value?: string;
  colorHex?: string;
  codeExtension?: string;
  sortOrder?: number;
};

export const attributeDefsApi = {
  /** Lista todas las definiciones del tenant (activas e inactivas) */
  list: () =>
    apiFetch<AttributeDefRow[]>("/attribute-defs", {
      method: "GET",
      on401: "throw",
    }),

  create: (data: AttributeDefPayload) =>
    apiFetch<AttributeDefRow>("/attribute-defs", {
      method: "POST",
      body: data,
      on401: "throw",
    }),

  update: (id: string, data: AttributeDefPayload) =>
    apiFetch<AttributeDefRow>(`/attribute-defs/${id}`, {
      method: "PUT",
      body: data,
      on401: "throw",
    }),

  toggle: (id: string) =>
    apiFetch<AttributeDefRow>(`/attribute-defs/${id}/toggle`, {
      method: "PATCH",
      on401: "throw",
    }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/attribute-defs/${id}`, {
      method: "DELETE",
      on401: "throw",
    }),

  createOption: (defId: string, data: AttributeDefOptionPayload) =>
    apiFetch<AttributeDefOption>(`/attribute-defs/${defId}/options`, {
      method: "POST",
      body: data,
      on401: "throw",
    }),

  updateOption: (optionId: string, data: AttributeDefOptionPayload) =>
    apiFetch<AttributeDefOption>(`/attribute-defs/options/${optionId}`, {
      method: "PUT",
      body: data,
      on401: "throw",
    }),

  toggleOption: (optionId: string) =>
    apiFetch<{ id: string; isActive: boolean }>(
      `/attribute-defs/options/${optionId}/toggle`,
      { method: "PATCH", on401: "throw" }
    ),

  reorderOptions: (defId: string, ids: string[]) =>
    apiFetch<{ ok: boolean }>(`/attribute-defs/${defId}/options/reorder`, {
      method: "PATCH",
      body: { ids },
      on401: "throw",
    }),

  removeOption: (optionId: string) =>
    apiFetch<{ id: string }>(`/attribute-defs/options/${optionId}`, {
      method: "DELETE",
      on401: "throw",
    }),
};
