// src/lib/sales/types.ts
// ============================================================================
// Tipos del dominio Sales (Factura de ventas).
//
// Extraídos de `src/pages/VentasFacturas.tsx` durante FASE 5 — adelgazamiento
// estructural. Estos tipos modelan el estado del comprobante en frontend y
// son consumidos por los helpers de `src/lib/sales/` y por la página.
//
// Sin lógica — solo definiciones de shape.
// ============================================================================

import type {
  DocumentLine,
  DocumentShipping,
  DocumentDiscountGlobal,
} from "../document-types";

export type SalesInvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "CANCELLED";

/**
 * Snapshot del cliente en el momento de armar el comprobante. Conserva los
 * datos comerciales relevantes para impresión / auditoría aunque la entidad
 * cambie luego en el catálogo.
 */
export type ClientSnapshot = {
  name:            string;
  /** Mismo que `name` cuando el backend lo expone explícitamente. */
  displayName?:    string;
  /** PERSON o COMPANY — define qué bloque de identidad mostrar. */
  entityType?:     "PERSON" | "COMPANY";
  /** Razón social (COMPANY). */
  companyName?:    string;
  /** Nombre comercial / fantasía. */
  tradeName?:      string;
  /** Nombre y apellido (PERSON). */
  firstName?:      string;
  lastName?:       string;
  documentType?:   string;
  documentNumber?: string;
  taxCondition?:   string;
  email?:          string;
  phone?:          string;
  currency?:       string;
  priceList?:      string;     // priceListId
  paymentTerm?:    string;
  seller?:         string;     // sellerId
  /** Línea legible de la dirección principal. */
  address?:        string;
  /** Id de la dirección elegida (cuando el usuario pueda alternar). */
  addressId?:      string;
};

export type SalesInvoice = {
  id: string;
  number: string;            // "FV-0001" — identificador interno del draft (Sale.code)
  /** 1.A — Numeracion oficial del comprobante (Receipt.code, ej.
   *  "A-0001-00000001") asignada por ReceiptSeries al confirmar la
   *  venta. Solo presente en facturas CONFIRMED y solo si el backend
   *  hidrato la respuesta con `receipts[]`. Si esta presente, el modal
   *  muestra "Factura N° <officialNumber>"; si no, cae al `number`
   *  interno. */
  officialNumber?: string;
  date: string;              // ISO
  dueDate: string;           // ISO — opcional
  /** Id real del cliente (CommercialEntity). Se setea al elegir del combo. */
  clientId?: string;
  /** Snapshot inmutable del cliente al armar el comprobante. */
  clientSnapshot?: ClientSnapshot;
  /** Nombre del cliente — duplicado del snapshot.name para compatibilidad. */
  client: string;
  salesOrderNumber: string;  // opcional — referencia a OV
  deliveryNumber: string;    // opcional — referencia a entrega/remito
  currency: string;
  /** Cotización a moneda base. Default 1. Editable solo si currency ≠ base. */
  fxRate: number;
  /** IVA % placeholder — pricing-engine lo calcula en Fase 6 */
  taxPercent: number;
  /** Vendedor asignado. Visual por ahora. */
  seller: string;
  /** Almacén del documento. */
  warehouse: string;
  /** Término de pago. */
  paymentTerm: string;
  /** Nro. de referencia interna o externa. */
  referenceNumber: string;
  notes: string;
  /** Términos y condiciones del comprobante. */
  terms: string;

  // Totales calculados
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;

  // Cobros
  paidAmount: number;

  lines: DocumentLine[];
  status: SalesInvoiceStatus;

  /** Lista de precios aplicada. */
  priceListId?: string;
  /** Datos de envío. */
  shipping?: DocumentShipping;
  /** Descuento global aplicado sobre el subtotal. */
  discountGlobal?: DocumentDiscountGlobal;
  /** Canal de venta del documento. CUID real de SalesChannel. */
  channelId?: string;
  /** Cupón de venta — código ingresado por el operador. */
  couponCode?: string;
  /** Etapa C16.3 — paridad rehidratación DRAFT. Forma de pago + cuotas del
   *  documento. El motor las consume vía `getCheckoutPreview` para calcular
   *  el `paymentAdjustment`. Hoy el modal mantiene también un state local
   *  para selección visual; estos campos son la fuente canónica al
   *  reabrir un borrador para que `buildSalePreviewPayload` los propague
   *  sin perder el cálculo del payment surcharge/descuento. `undefined` =
   *  sin forma de pago elegida (consistente con `channelId`/`couponCode`). */
  paymentMethodId?: string;
  paymentInstallments?: number;
  /**
   * Fase 4.2 — Override manual del Balance Mode del documento
   * (POLICY.md §11 R11.4). `null`/`undefined` = el backend resuelve por
   * jerarquía (cliente → lista → tenant → fallback UNIFIED).
   * `"UNIFIED" | "BREAKDOWN"` = el operador pisa la resolución.
   * Persiste en `Sale.balanceModeOverride` via create/update.
   * El frontend NO resuelve — solo envía la intención y muestra lo que
   * el backend devuelve en `previewResult.balanceMode` + `balanceModeSource`.
   */
  balanceModeOverride?: "UNIFIED" | "BREAKDOWN" | null;
  /** Resultado de la validación del cupón. */
  couponStatus?: {
    code:           string;
    valid:          boolean;
    name?:          string;
    reason?:        string;
    discountType?:  string;
    discountValue?: number;
  };
  // ── Flags "explícitamente vacío" ──
  channelExplicitlyCleared?:   boolean;
  priceListExplicitlyCleared?: boolean;
  warehouseExplicitlyCleared?: boolean;

  /**
   * Ajuste manual del comprobante (POLICY §R-Rounding-1 capa 17).
   *
   * Etapa A — `scope: "UNIFIED"`. Aplica sobre el TOTAL UNIFICADO del
   * comprobante (no distingue dominios).
   *   · `amount > 0` = recargo manual.
   *   · `amount < 0` = descuento / cierre comercial.
   *   · `amount = 0`/ausente/`null` = sin ajuste.
   *
   * Etapa C — `scope: "BREAKDOWN"`. Aplica sobre el SALDO DESGLOSADO.
   * Disponible solo cuando el documento opera en modo BREAKDOWN. Dominios
   * DISJUNTOS:
   *   · Gramos de cada metal padre (`targetGrams` o `deltaGrams`) — el
   *     ajuste físico vive en su metal padre.
   *   · Bucket hechura / saldo monetario (`monetaryAmount`) — todo lo
   *     no-metal-padre (hechura física + productos + servicios + impuestos
   *     + envío + descuentos + cupones + canal + forma de pago + redondeos
   *     monetarios).
   *
   * Principio "no mezclar": ajustes en gramos viven SOLO en su metal padre;
   * ajustes monetarios viven SOLO en el bucket hechura/saldo. El frontend
   * NUNCA calcula: solo captura la intención.
   *
   * Equivalencia monetaria (regla crítica): los ajustes de metal padre
   * impactan `Sale.total` y los displays vía el `monetaryEquivalent` del
   * snapshot del backend — igual que el redondeo BREAKDOWN. NUNCA se
   * mueve el valor a hechura: el ajuste físico sigue perteneciendo al
   * metal padre.
   */
  manualAdjustment?: SalesInvoiceManualAdjustmentDraft;
};

/** Intención de ajuste UNIFIED en el draft del frontend. */
export interface SalesInvoiceManualAdjustmentDraftUnified {
  scope?: "UNIFIED";
  amount: number;
  reason?: string | null;
}

/** Ajuste por metal padre en el draft del frontend (Etapa C). */
export interface SalesInvoiceManualAdjustmentDraftMetal {
  metalParentId:   string | null;
  metalParentName?: string;
  targetGrams?: number | null;
  deltaGrams?:  number | null;
  reason?:      string | null;
}

/** Intención de ajuste BREAKDOWN en el draft del frontend. */
export interface SalesInvoiceManualAdjustmentDraftBreakdown {
  scope:  "BREAKDOWN";
  metals?:         SalesInvoiceManualAdjustmentDraftMetal[];
  monetaryAmount?: number | null;
  reason?:         string | null;
}

/** Unión del draft de ajuste manual. `null` / `undefined` = sin ajuste. */
export type SalesInvoiceManualAdjustmentDraft =
  | SalesInvoiceManualAdjustmentDraftUnified
  | SalesInvoiceManualAdjustmentDraftBreakdown
  | null;
