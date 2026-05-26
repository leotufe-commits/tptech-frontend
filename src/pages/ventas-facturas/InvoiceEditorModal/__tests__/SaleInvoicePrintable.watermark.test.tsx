// src/pages/ventas-facturas/InvoiceEditorModal/__tests__/SaleInvoicePrintable.watermark.test.tsx
// =============================================================================
// 1.G — Watermark del printable HTML.
//
// Verifica que el sello visual aparece SOLO para DRAFT/CANCELLED y que el
// texto es exactamente "BORRADOR" / "ANULADA". Sin assertions de CSS
// pixel-perfect — solo presencia/ausencia del texto y atributo aria-hidden
// del overlay.
//
// Paridad esperada con el PDF server-side (`renderInvoicePdf.ts`):
//   · DRAFT     → "BORRADOR"
//   · CANCELLED → "ANULADA"
//   · resto     → sin sello
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SaleInvoicePrintable, { type SaleInvoicePrintableProps } from "@tptech/shared/document-printables/SaleInvoicePrintable";
import { buildLocalDefaultConfig } from "../../../../services/document-templates";
import type { CompanyFullProfile } from "../../../../services/company";

function makeCompany(): CompanyFullProfile {
  return {
    name: "Joyería Test", legalName: "Test SRL", logoUrl: "",
    cuit: "30-99999999-0", ivaCondition: "RI",
    addressLine: "Av. Siempre Viva 123, CABA",
    phone: "+54 11 5555-1234", email: "info@test.ar", website: "test.ar",
  };
}

function makeProps(over: Partial<SaleInvoicePrintableProps> = {}): SaleInvoicePrintableProps {
  return {
    config:          buildLocalDefaultConfig("FACTURA"),
    company:         makeCompany(),
    documentNumber:  "A-0001-00000001",
    documentDate:    "2026-05-25",
    clientName:      "Cliente SA",
    clientTaxId:     "CUIT: 30-12345678-9",
    clientAddress:   "Calle 1, CABA",
    lines:           [],     // no lines → el renderer aun debe pintar el header / sello
    totals:          { subtotal: 200, discountAmount: 0, taxAmount: 42, total: 242 },
    currencyCode:    "ARS",
    fxRate:          1,
    notes:           "",
    terms:           "",
    sellerName:      undefined,
    warehouseName:   undefined,
    paymentTermName: undefined,
    ...over,
  };
}

describe("SaleInvoicePrintable — watermark por estado", () => {
  it("DRAFT → renderea sello 'BORRADOR' (aria-hidden, no interfiere a11y)", () => {
    const { container } = render(<SaleInvoicePrintable {...makeProps({ status: "DRAFT" })} />);
    // El watermark va dentro de un div aria-hidden — usamos getByText con
    // queries inclusivos para encontrarlo aunque este oculto a11y.
    expect(screen.getByText("BORRADOR")).toBeTruthy();
    expect(screen.queryByText("ANULADA")).toBeNull();
    // Verificamos que el contenedor del sello esta marcado aria-hidden.
    const stamp = container.querySelector('[aria-hidden="true"]');
    expect(stamp).toBeTruthy();
    expect(stamp!.textContent).toContain("BORRADOR");
  });

  it("CANCELLED → renderea sello 'ANULADA'", () => {
    render(<SaleInvoicePrintable {...makeProps({ status: "CANCELLED" })} />);
    expect(screen.getByText("ANULADA")).toBeTruthy();
    expect(screen.queryByText("BORRADOR")).toBeNull();
  });

  it.each(["PENDING", "PARTIAL", "PAID"] as const)(
    "%s → sin watermark (estado final, no se renderea sello)",
    (status) => {
      render(<SaleInvoicePrintable {...makeProps({ status })} />);
      expect(screen.queryByText("BORRADOR")).toBeNull();
      expect(screen.queryByText("ANULADA")).toBeNull();
    },
  );

  it("status undefined (caso defensivo) → sin watermark", () => {
    render(<SaleInvoicePrintable {...makeProps({ status: undefined })} />);
    expect(screen.queryByText("BORRADOR")).toBeNull();
    expect(screen.queryByText("ANULADA")).toBeNull();
  });
});
