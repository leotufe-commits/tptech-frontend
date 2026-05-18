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
  number: string;            // "FV-0001"
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
};
