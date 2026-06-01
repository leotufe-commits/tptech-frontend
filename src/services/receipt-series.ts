// src/services/receipt-series.ts
// =============================================================================
// Cliente API admin de numeración (Etapa B — 2026-05-29).
//
// Cubre los 5 endpoints del backend `/api/receipt-series`:
//   · GET    /                  → list
//   · GET    /:id               → get
//   · POST   /                  → create
//   · PATCH  /:id               → update (type/direction inmutables backend-side)
//   · DELETE /:id               → soft-delete (bloqueado si hay receipts emitidos)
//
// Patrón idéntico a `taxes.ts` / `payments.ts`: tipos explícitos +
// `apiFetch` con `on401: "throw"` para que el wrapper global maneje
// la sesión. Manejo de errores se delega al consumer (toast).
// =============================================================================

import { apiFetch } from "../lib/api";

// ─── Enums del dominio (espejo del backend) ────────────────────────────────

export type ReceiptSeriesType =
  | "QUOTE"
  | "INVOICE"
  | "DELIVERY_NOTE"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE";

export type ReceiptSeriesDirection = "OUTBOUND" | "INBOUND";

/**
 * Labels visuales en español (single source of truth UI). Reutilizables
 * en cualquier pantalla que muestre series — la pantalla de admin las
 * importa para la tabla y el modal.
 */
export const RECEIPT_SERIES_TYPE_LABELS: Record<ReceiptSeriesType, string> = {
  QUOTE:         "Presupuesto",
  INVOICE:       "Factura",
  DELIVERY_NOTE: "Remito",
  CREDIT_NOTE:   "Nota de crédito",
  DEBIT_NOTE:    "Nota de débito",
};

export const RECEIPT_SERIES_DIRECTION_LABELS: Record<ReceiptSeriesDirection, string> = {
  OUTBOUND: "Venta",
  INBOUND:  "Compra",
};

// ─── Shape de datos ────────────────────────────────────────────────────────

export type ReceiptSeries = {
  id:          string;
  name:        string;
  type:        ReceiptSeriesType;
  direction:   ReceiptSeriesDirection;
  prefix:      string;
  pointOfSale: string;
  nextNumber:  number;
  isActive:    boolean;
  createdAt:   string;
  updatedAt:   string;
};

export type CreateReceiptSeriesPayload = {
  name:        string;
  type:        ReceiptSeriesType;
  direction:   ReceiptSeriesDirection;
  prefix:      string;
  pointOfSale: string;
  nextNumber:  number;
  isActive:    boolean;
};

/**
 * Editar NO permite cambiar `type` ni `direction` — el backend los marca
 * como inmutables (define la naturaleza fiscal de la serie). Para cambiar
 * tipo/dirección hay que crear OTRA serie y soft-deletear la actual.
 */
export type UpdateReceiptSeriesPayload = {
  name?:        string;
  prefix?:      string;
  pointOfSale?: string;
  nextNumber?:  number;
  isActive?:    boolean;
};

// ─── API ───────────────────────────────────────────────────────────────────

export const receiptSeriesApi = {
  list: () =>
    apiFetch<ReceiptSeries[]>("/receipt-series", { method: "GET", on401: "throw" }),

  get: (id: string) =>
    apiFetch<ReceiptSeries>(`/receipt-series/${id}`, { method: "GET", on401: "throw" }),

  create: (data: CreateReceiptSeriesPayload) =>
    apiFetch<ReceiptSeries>("/receipt-series", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: UpdateReceiptSeriesPayload) =>
    apiFetch<ReceiptSeries>(`/receipt-series/${id}`, { method: "PATCH", body: data, on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/receipt-series/${id}`, { method: "DELETE", on401: "throw" }),
};
