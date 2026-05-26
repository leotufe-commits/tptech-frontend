// src/services/salesDraftPdf.ts
// =============================================================================
//  C5-fix Opción A — Cliente del nuevo endpoint render-only.
//
//  POST /api/sales/render-pdf — recibe DIRECTAMENTE las props del
//  `<SaleInvoicePrintable>` (las mismas que se pasan en el browser
//  print). El backend NO crea Sale, NO toca pricing-engine, NO
//  persiste — solo renderea HTML + Puppeteer.
//
//  Diseño:
//    · `downloadFromDraft` → POST con body JSON, espera PDF binario.
//    · `sendDraftByEmail`  → POST con body JSON, espera { ok, message }.
//    · Ambos endpoints comparten el shape `SaleDraftPdfRequest` para
//      asegurar que el adjunto del mail == archivo descargado.
//
//  Reglas:
//    · El frontend YA tiene los datos del draft (no hace fetch
//      extra). Por eso este servicio es 100% client-side: solo
//      empaqueta y manda.
//    · Vive separado de `services/sales.ts` para no entrar en
//      conflicto con cambios en curso de ese archivo (mods
//      uncommitted del operador).
// =============================================================================

import { apiFetch, API_URL, ApiError } from "../lib/api";

// ─── Tipos del request (espejo del backend) ──────────────────────────────────

export interface SaleDraftPrintableCompany {
  name?:         string;
  legalName?:    string;
  logoUrl?:      string;
  cuit?:         string;
  ivaCondition?: string;
  addressLine?:  string;
  phone?:        string;
  email?:        string;
  website?:      string;
}

export interface SaleDraftPrintableLine {
  id:                 string;
  type?:              "ARTICLE" | "HEADER";
  title?:             string;
  articleId?:         string;
  isManual?:          boolean;
  manualDescription?: string;
  article?:           string;
  variant?:           string;
  sku?:               string;
  quantity?:          number;
  unitPrice?:         number;
  subtotal?:          number;
  lineTotal?:         number;
}

export interface SaleDraftPrintableProps {
  config?:           unknown;
  company:           SaleDraftPrintableCompany;
  documentNumber:    string;
  documentDate:      string;
  clientName:        string;
  clientTaxId?:      string;
  clientAddress?:    string;
  lines:             SaleDraftPrintableLine[];
  totals: {
    subtotal:       number;
    discountAmount: number;
    taxAmount:      number;
    total:          number;
  };
  currencyCode:     string;
  fxRate:           number;
  notes?:           string;
  terms?:           string;
  sellerName?:      string;
  warehouseName?:   string;
  paymentTermName?: string;
  status?:          "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
}

export interface SaleDraftPdfPageConfig {
  widthMm:      number;
  heightMm:     number;
  orientation?: "portrait" | "landscape";
}

export interface SaleDraftPdfRequest {
  printable: SaleDraftPrintableProps;
  page:      SaleDraftPdfPageConfig;
  filename?: string;
}

export interface SaleDraftEmailRequest extends SaleDraftPdfRequest {
  to:      string;
  subject: string;
  message: string;
  /** E2 — REQUERIDO. Anchor al Sale persistido para que el log
   *  documental tenga trazabilidad. El caller (handler de email en
   *  VentasFacturas) llama `ensurePersistedSaleDraft()` antes y manda
   *  el id resultante. */
  saleId:  string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const salesDraftPdfApi = {
  /** Descarga el PDF generado desde el draft del frontend. NO requiere
   *  que el Sale esté persistido — el backend renderea solo lo que
   *  recibe. */
  downloadFromDraft: async (req: SaleDraftPdfRequest): Promise<{ blob: Blob; filename: string }> => {
    const url = `${API_URL}/sales/render-pdf`;
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as { message?: string; code?: string }));
      throw new ApiError(
        (data as { message?: string }).message || `Error al generar el PDF (${res.status})`,
        { status: res.status, data, url, method: "POST" },
      );
    }
    const blob     = await res.blob();
    const cd       = res.headers.get("Content-Disposition") || "";
    const m        = /filename="?([^";]+)"?/.exec(cd);
    const filename = m?.[1] ?? req.filename ?? "Factura.pdf";
    return { blob, filename };
  },

  /** Envía la factura por mail con el PDF del draft adjunto. El backend
   *  renderea exactamente el mismo PDF que se descargaría — un único
   *  buffer por operación. */
  sendDraftByEmail: (req: SaleDraftEmailRequest) =>
    apiFetch<{ ok: boolean; message: string }>("/sales/send-draft-email", {
      method: "POST",
      body:   req,
      on401:  "throw",
    }),
};
