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
  terms?:           string;
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

export type ReceiptAttachment = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export const receiptsApi = {
  /** POST /receipts → status=DRAFT. Sin efectos en stock / cuenta corriente. */
  createDraft: (payload: CreateReceiptDraftPayload) =>
    apiFetch<ReceiptDraftResponse>("/receipts", {
      method: "POST",
      body:   payload,
      on401:  "throw",
    }),

  /** GET /receipts/:id/attachments — adjuntos vivos (deletedAt=null). */
  listAttachments: (id: string) =>
    apiFetch<ReceiptAttachment[]>(`/receipts/${id}/attachments`, {
      method: "GET",
      on401:  "throw",
    }),

  /** POST /receipts/:id/attachments — multipart, field "file". */
  addAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);

    return apiFetch<ReceiptAttachment>(`/receipts/${id}/attachments`, {
      method: "POST",
      body:   form,
      on401:  "throw",
    });
  },

  /** DELETE /receipts/:id/attachments/:attachmentId — soft-delete. */
  deleteAttachment: (id: string, attachmentId: string) =>
    apiFetch<{ id: string }>(`/receipts/${id}/attachments/${attachmentId}`, {
      method: "DELETE",
      on401:  "throw",
    }),
};
