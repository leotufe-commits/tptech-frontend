// src/services/price-lists.ts
import { apiFetch } from "../lib/api";

/* =========================================================
   TYPES
========================================================= */
export type PriceListScope = "GENERAL" | "CHANNEL" | "CATEGORY" | "CLIENT";
export type PriceListMode = "MARGIN_TOTAL" | "METAL_HECHURA" | "COST_PER_GRAM";
export type RoundingTarget = "NONE" | "METAL" | "FINAL_PRICE";
export type RoundingMode = "NONE" | "INTEGER" | "DECIMAL_1" | "DECIMAL_2" | "TEN" | "HUNDRED";
export type RoundingDirection = "NEAREST" | "UP" | "DOWN";
export type RoundingApplyOn = "PRICE" | "NET" | "TOTAL";

export type PriceListRow = {
  id: string;
  jewelryId: string;
  name: string;
  code: string;
  description: string;
  scope: PriceListScope;
  categoryId: string | null;
  channelId: string | null;
  clientId: string | null;
  mode: PriceListMode;
  marginTotal: string | null;
  marginMetal: string | null;
  marginHechura: string | null;
  costPerGram: string | null;
  surcharge: string | null;
  minimumPrice: string | null;
  roundingTarget: RoundingTarget;
  roundingMode: RoundingMode;
  roundingDirection: RoundingDirection;
  roundingApplyOn: RoundingApplyOn;
  roundingModeHechura?: RoundingMode;
  roundingDirectionHechura?: RoundingDirection;
  roundingValueMetal: string | null;
  roundingValueHechura: string | null;
  validFrom: string | null;
  validTo: string | null;
  isFavorite: boolean;
  isActive: boolean;
  sortOrder: number;
  notes: string;
  // ── Etapa C-comercial / C10 (POLICY §R-Rounding-14) ─────────────────────
  // El backend ya los emite (PL_SELECT en `price-lists.service.ts:62-63`);
  // este row los expone al frontend para que el editor pueda hidratar el
  // toggle Monetario/Físico al editar una lista existente.
  commercialRoundingMetalDomain?: "MONETARY" | "PHYSICAL";
  commercialPhysicalRoundingConfig?: Record<string, unknown> | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
};

export type PriceListPayload = {
  name: string;
  code?: string;
  description?: string;
  scope: PriceListScope;
  categoryId?: string | null;
  mode: PriceListMode;
  marginTotal?: string | null;
  marginMetal?: string | null;
  marginHechura?: string | null;
  costPerGram?: string | null;
  surcharge?: string | null;
  minimumPrice?: string | null;
  roundingTarget?: RoundingTarget;
  roundingMode?: RoundingMode;
  roundingDirection?: RoundingDirection;
  roundingApplyOn?: RoundingApplyOn;
  roundingModeHechura?: RoundingMode;
  roundingDirectionHechura?: RoundingDirection;
  roundingValueMetal?: string | null;
  roundingValueHechura?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  isFavorite?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string;
  // ── Etapa C-comercial / C9 (POLICY §R-Rounding-14) ──────────────────────
  // Activación canónica del dominio metal del redondeo comercial. El mapper
  // de la pantalla de Listas (`draftToPayload`) los deriva automáticamente:
  // lista DESGLOSADA con rounding activo ⇒ PHYSICAL. Resto ⇒ MONETARY (legacy).
  // El backend C3 ya bifurca el motor cuando recibe `"PHYSICAL"`; acá solo
  // dejamos de omitirlos.
  commercialRoundingMetalDomain?: "MONETARY" | "PHYSICAL";
  commercialPhysicalRoundingConfig?: Record<string, unknown> | null;
};

/* =========================================================
   API
========================================================= */
export const priceListsApi = {
  list: () =>
    apiFetch<PriceListRow[]>("/price-lists", { method: "GET", on401: "throw" }),

  create: (data: PriceListPayload) =>
    apiFetch<PriceListRow>("/price-lists", {
      method: "POST",
      body: data,
      on401: "throw",
    }),

  clone: (id: string) =>
    apiFetch<PriceListRow>(`/price-lists/${id}/clone`, {
      method: "POST",
      on401: "throw",
    }),

  update: (id: string, data: PriceListPayload) =>
    apiFetch<PriceListRow>(`/price-lists/${id}`, {
      method: "PUT",
      body: data,
      on401: "throw",
    }),

  toggle: (id: string) =>
    apiFetch<PriceListRow>(`/price-lists/${id}/toggle`, {
      method: "PATCH",
      on401: "throw",
    }),

  setFavorite: (id: string) =>
    apiFetch<PriceListRow>(`/price-lists/${id}/favorite`, {
      method: "PATCH",
      on401: "throw",
    }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/price-lists/${id}`, {
      method: "DELETE",
      on401: "throw",
    }),
};
