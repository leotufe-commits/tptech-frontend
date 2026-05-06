// src/services/receipts.ts
// ============================================================================
// API client de comprobantes (Receipts) — FASE 3.
//
// Hoy expone solo `createDraft`: persiste un comprobante en estado DRAFT en
// el backend SIN disparar efectos colaterales (stock / cuenta corriente
// quedan intactos hasta el endpoint de emisión, que llega en otra fase).
// ============================================================================

import { apiFetch } from "../lib/api";

export type ReceiptType =
  | "QUOTE"
  | "INVOICE"
  | "DELIVERY_NOTE"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE";

export type ReceiptDirection = "OUTBOUND" | "INBOUND";
export type ReceiptStatus    = "DRAFT" | "ISSUED" | "VOIDED";

export type CreateReceiptDraftLine = {
  articleId?:      string;
  variantId?:      string;
  itemKind?:       "ARTICLE_SIMPLE" | "ARTICLE_VARIANT" | "SERVICE" | "COMBO";
  name?:           string;
  code?:           string;
  sku?:            string;
  barcode?:        string;
  quantity:        number;
  unitPrice:       number;
  subtotal:        number;
  discountAmount:  number;
  lineTotal:       number;
  taxAmount:       number;
  totalWithTax:    number;
  totalCost?:      number | null;
  totalMargin?:    number | null;
  sortOrder?:      number;
  pricingSnapshot?: unknown;
};

export type CreateReceiptDraftPayload = {
  type:             ReceiptType;
  direction:        ReceiptDirection;
  counterpartyId?:  string;
  currencyCode?:    string;
  currencyRate?:    number;
  subtotal?:        number;
  discountAmount?:  number;
  taxAmount?:       number;
  total?:           number;
  totalBase?:       number;
  issueDate?:       string; // ISO
  dueDate?:         string; // ISO
  notes?:           string;
  pricingSnapshot:  unknown;
  currencySnapshot: unknown;
  lines:            CreateReceiptDraftLine[];
};

export type ReceiptDraftResponse = {
  id:        string;
  code:      string;       // "DRAFT-<uuid>" mientras esté en DRAFT.
  type:      ReceiptType;
  direction: ReceiptDirection;
  status:    ReceiptStatus;
  // Resto de campos del Receipt; el frontend usa solo lo mínimo por ahora.
  [k: string]: unknown;
};

export const receiptsApi = {
  /** POST /receipts → status=DRAFT. Sin efectos en stock / cuenta corriente. */
  createDraft: (payload: CreateReceiptDraftPayload) =>
    apiFetch<ReceiptDraftResponse>("/receipts", {
      method: "POST",
      body:   payload,
      on401:  "throw",
    }),
};
