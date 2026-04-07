// src/services/payments.ts
import { apiFetch } from "../lib/api";
import type { CheckoutResult } from "./articles";

/* =========================================================
   TYPES
========================================================= */
export type PaymentMethodType =
  | "CASH"
  | "DEBIT_CARD"
  | "CREDIT_CARD"
  | "TRANSFER"
  | "QR"
  | "OTHER";

export type PaymentAdjustmentType = "NONE" | "PERCENTAGE" | "FIXED_AMOUNT";

export type InstallmentPlan = {
  id?: string;
  installments: number;
  interestRate: string; // decimal as string
  isActive: boolean;
  sortOrder: number;
};

export type PaymentMethodRow = {
  id: string;
  jewelryId: string;
  name: string;
  code: string;
  type: PaymentMethodType;
  /** Nombre personalizado visible para el tipo. Si está vacío, usar el label estándar del tipo. */
  customTypeLabel: string;
  adjustmentType: PaymentAdjustmentType;
  adjustmentValue: string | null;
  isFavorite: boolean;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  notes: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  installmentPlans: InstallmentPlan[];
};

export type PaymentMethodPayload = {
  name: string;
  code?: string;
  type: PaymentMethodType;
  /** Nombre visible personalizado para el tipo. Opcional, default vacío. */
  customTypeLabel?: string;
  adjustmentType: PaymentAdjustmentType;
  adjustmentValue?: string | null;
  isFavorite?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string;
  installmentPlans?: Array<{
    id?: string;
    installments: number;
    interestRate: string;
    isActive: boolean;
    sortOrder?: number;
  }>;
};

/* =========================================================
   API
========================================================= */
export const paymentsApi = {
  list: () =>
    apiFetch<PaymentMethodRow[]>("/payments", { method: "GET", on401: "throw" }),

  create: (data: PaymentMethodPayload) =>
    apiFetch<PaymentMethodRow>("/payments", {
      method: "POST",
      body: data,
      on401: "throw",
    }),

  clone: (id: string) =>
    apiFetch<PaymentMethodRow>(`/payments/${id}/clone`, {
      method: "POST",
      on401: "throw",
    }),

  update: (id: string, data: PaymentMethodPayload) =>
    apiFetch<PaymentMethodRow>(`/payments/${id}`, {
      method: "PUT",
      body: data,
      on401: "throw",
    }),

  toggle: (id: string) =>
    apiFetch<PaymentMethodRow>(`/payments/${id}/toggle`, {
      method: "PATCH",
      on401: "throw",
    }),

  setFavorite: (id: string) =>
    apiFetch<PaymentMethodRow>(`/payments/${id}/favorite`, {
      method: "PATCH",
      on401: "throw",
    }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/payments/${id}`, {
      method: "DELETE",
      on401: "throw",
    }),

  /** Resuelve ajuste de pago + cuotas sobre un monto dado (sin artículo específico). Usado en Ventas. */
  checkoutPreview: (opts: {
    amount: number;
    paymentMethodId?: string | null;
    installmentsQty?: number | null;
  }) => {
    const qs = new URLSearchParams();
    qs.set("amount", String(opts.amount));
    if (opts.paymentMethodId) qs.set("paymentMethodId", opts.paymentMethodId);
    if (opts.installmentsQty) qs.set("installmentsQty", String(opts.installmentsQty));
    return apiFetch<CheckoutResult>(`/payments/checkout-preview?${qs.toString()}`, {
      method: "GET",
      on401: "throw",
    });
  },
};
