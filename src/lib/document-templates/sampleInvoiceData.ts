// src/lib/document-templates/sampleInvoiceData.ts
// =============================================================================
//  Datos de muestra fijos para el preview del editor de plantillas de
//  Factura.
//
//  Reglas:
//    · CONSTANTE — nunca depende del estado de un draft real ni de una
//      venta confirmada. El editor es para configurar la plantilla,
//      no para previsualizar una venta puntual.
//    · Realistas pero claramente "de ejemplo" (cliente "Empresa de
//      Muestra", artículos genéricos) para que el operador no se
//      confunda con datos reales.
//    · Monto del total ≠ subtotal — incluye descuento + impuestos para
//      ejercitar todas las filas del bloque de totales del printable.
//    · Status `PENDING` (sin watermark) — el editor muestra el estado
//      "factura emitida" por default. El operador puede inferir cómo
//      se vería DRAFT / CANCELLED mirando el botón de descarga del
//      modal de Factura, no acá.
//
//  Consumer: `<SaleInvoicePrintable>` (@tptech/shared/document-printables/...)
//  cuando se monta dentro del editor de plantillas FACTURA. La prop
//  `config` (DocumentTemplateConfig) la pasa el editor; lo demás sale
//  de acá.
// =============================================================================

export const SAMPLE_INVOICE_PRINTABLE_PROPS = {
  documentNumber: "A-0001-00000123",
  documentDate:   "2026-05-26",
  clientName:     "Empresa de Muestra S.A.",
  clientTaxId:    "CUIT: 30-12345678-9",
  clientAddress:  "Av. Corrientes 1234, CABA",
  lines: [
    {
      id:        "sample-line-1",
      articleId: "sample-1",
      article:   "Anillo oro 18k",
      variant:   "Talle 14",
      sku:       "AN-001",
      quantity:  2,
      unitPrice: 50000,
      subtotal:  100000,
      lineTotal: 100000,
    },
    {
      id:        "sample-line-2",
      articleId: "sample-2",
      article:   "Cadena plata 925",
      variant:   "45 cm",
      sku:       "CA-002",
      quantity:  1,
      unitPrice: 18000,
      subtotal:  18000,
      lineTotal: 18000,
    },
    {
      id:        "sample-line-3",
      articleId: "sample-3",
      article:   "Aro corazón",
      variant:   "Pequeño",
      sku:       "AR-003",
      quantity:  3,
      unitPrice: 7500,
      subtotal:  22500,
      lineTotal: 22500,
    },
  ],
  totals: {
    subtotal:       140500,
    discountAmount: 10000,
    taxAmount:      27405,
    total:          157905,
  },
  currencyCode:    "ARS",
  fxRate:          1,
  notes:           "Entregar en oficina antes del viernes.",
  terms:           "Pagos en pesos. No se aceptan devoluciones pasados 30 días.",
  sellerName:      "Juan Pérez",
  warehouseName:   "Depósito Central",
  paymentTermName: "Contado",
  status:          "PENDING" as const,
};
