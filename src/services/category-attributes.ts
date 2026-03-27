// src/services/category-attributes.ts
import { apiFetch } from "../lib/api";

export type AttributeInputType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "DECIMAL"
  | "BOOLEAN"
  | "DATE"
  | "SELECT"
  | "MULTISELECT"
  | "COLOR";

export type AttributeOption = {
  id: string;
  /** Maps to assignment id for backward compat */
  attributeId: string;
  label: string;
  value: string;
  colorHex: string;
  codeExtension: string;  // extensión para SKU de variante (ej. "A" → SKU padre + "A")
  sortOrder: number;
  isActive: boolean;
};

/** Asignación de un atributo a una categoría (con campos de definición aplanados) */
export type CategoryAttribute = {
  id: string;            // ID de la asignación (ArticleCategoryAttribute)
  definitionId: string;  // ID de la definición global (ArticleAttributeDef)
  jewelryId: string;
  categoryId: string;
  // Campos de la definición (aplanados en el response del backend)
  name: string;
  code: string;
  inputType: AttributeInputType;
  helpText: string;
  defaultValue: string;
  unit: string;
  options: AttributeOption[];
  // Campos de la asignación
  isRequired: boolean;
  isActive: boolean;
  isFilterable: boolean;
  isVariantAxis: boolean;
  inheritToChild: boolean;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Solo en el endpoint /effective
  inherited?: boolean;
  sourceCategoryId?: string;
  sourceCategoryName?: string;
};

export type AttributeAssignPayload = {
  /** Si se envía, asigna una definición existente */
  definitionId?: string;
  /** Si no hay definitionId, se crea una nueva definición */
  name?: string;
  code?: string;
  inputType?: AttributeInputType;
  helpText?: string;
  defaultValue?: string;
  unit?: string;
  // Config de asignación (siempre):
  isRequired?: boolean;
  isFilterable?: boolean;
  isVariantAxis?: boolean;
  inheritToChild?: boolean;
  sortOrder?: number;
};

export type AssignmentConfigPayload = {
  isRequired?: boolean;
  isFilterable?: boolean;
  isVariantAxis?: boolean;
  inheritToChild?: boolean;
  sortOrder?: number;
};

export type OptionPayload = {
  label: string;
  value?: string;
  colorHex?: string;
  codeExtension?: string;
  sortOrder?: number;
};

export const categoryAttributesApi = {
  /** Asignaciones propias de la categoría (activas + inactivas) */
  list: (categoryId: string) =>
    apiFetch<CategoryAttribute[]>(`/categories/${categoryId}/attributes`, {
      method: "GET",
      on401: "throw",
    }),

  /** Asignaciones efectivas: propias + heredadas de ancestros (solo activas) */
  effectiveList: (categoryId: string) =>
    apiFetch<CategoryAttribute[]>(
      `/categories/${categoryId}/attributes/effective`,
      { method: "GET", on401: "throw" }
    ),

  /**
   * Crear asignación:
   * - Si payload incluye `definitionId` → asigna def existente
   * - Si no → crea nueva def + asignación en una transacción
   */
  create: (categoryId: string, data: AttributeAssignPayload) =>
    apiFetch<CategoryAttribute>(`/categories/${categoryId}/attributes`, {
      method: "POST",
      body: data,
      on401: "throw",
    }),

  /** Actualiza configuración de la asignación (isRequired, etc.) */
  update: (assignId: string, data: AssignmentConfigPayload) =>
    apiFetch<CategoryAttribute>(`/categories/attributes/${assignId}`, {
      method: "PUT",
      body: data,
      on401: "throw",
    }),

  toggle: (assignId: string) =>
    apiFetch<CategoryAttribute>(`/categories/attributes/${assignId}/toggle`, {
      method: "PATCH",
      on401: "throw",
    }),

  remove: (assignId: string) =>
    apiFetch<{ id: string }>(`/categories/attributes/${assignId}`, {
      method: "DELETE",
      on401: "throw",
    }),

  /** Agrega una opción a la definición global (vía assignId — backend resuelve el defId) */
  createOption: (assignId: string, data: OptionPayload) =>
    apiFetch<AttributeOption>(
      `/categories/attributes/${assignId}/options`,
      { method: "POST", body: data, on401: "throw" }
    ),

  removeOption: (optionId: string) =>
    apiFetch<{ id: string }>(
      `/categories/attributes/options/${optionId}`,
      { method: "DELETE", on401: "throw" }
    ),
};

/* =========================================================
   Helpers de presentación
========================================================= */
export const INPUT_TYPE_LABELS: Record<AttributeInputType, string> = {
  TEXT: "Texto",
  TEXTAREA: "Texto largo",
  NUMBER: "Número",
  DECIMAL: "Decimal",
  BOOLEAN: "Sí / No",
  DATE: "Fecha",
  SELECT: "Selección",
  MULTISELECT: "Múltiple",
  COLOR: "Color",
};

export const INPUT_TYPE_OPTIONS: { value: AttributeInputType; label: string }[] = [
  { value: "TEXT", label: "Texto corto" },
  { value: "TEXTAREA", label: "Texto largo" },
  { value: "NUMBER", label: "Número entero" },
  { value: "DECIMAL", label: "Número decimal" },
  { value: "BOOLEAN", label: "Sí / No (booleano)" },
  { value: "DATE", label: "Fecha" },
  { value: "SELECT", label: "Selección (una opción)" },
  { value: "MULTISELECT", label: "Selección múltiple" },
  { value: "COLOR", label: "Color" },
];

export const HAS_OPTIONS: AttributeInputType[] = ["SELECT", "MULTISELECT", "COLOR"];

export const INPUT_TYPE_COLOR: Record<AttributeInputType, string> = {
  TEXT: "bg-surface2 text-muted",
  TEXTAREA: "bg-surface2 text-muted",
  NUMBER: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  DECIMAL: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  BOOLEAN: "bg-green-500/15 text-green-600 dark:text-green-400",
  DATE: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  SELECT: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  MULTISELECT: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  COLOR: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
};
