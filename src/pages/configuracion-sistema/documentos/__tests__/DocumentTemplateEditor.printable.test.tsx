// src/pages/configuracion-sistema/documentos/__tests__/DocumentTemplateEditor.printable.test.tsx
// =============================================================================
// Fase B1 — Verifica que el editor de plantillas usa el printable REAL
// (`<SaleInvoicePrintable>` del shared) para FACTURA y `DocumentPreview`
// genérico para los otros kinds (PRESUPUESTO/REMITO/ORDEN_COMPRA/
// MOVIMIENTO_STOCK).
//
// Stubea ambos componentes con markers de testid para detectar cuál se
// monta sin acoplar a su contenido visual. El swap se hace SÓLO para
// FACTURA — el resto sigue con DocumentPreview hasta que cada kind
// tenga su printable shared.
// =============================================================================

import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// jsdom no implementa ResizeObserver; el editor lo usa para medir el
// canvas del preview. Stub mínimo (noop) — el cálculo de zoom queda
// indefinido pero no rompe el render.
beforeAll(() => {
  class RO { observe() {} unobserve() {} disconnect() {} }
  (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

// Mocks de servicios externos (no probamos fetch real acá).
vi.mock("../../../../services/document-templates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../services/document-templates")>();
  return {
    ...actual,
    documentTemplatesApi: {
      get:   vi.fn().mockResolvedValue(actual.buildLocalDefaultConfig("FACTURA", "A4")),
      save:  vi.fn(),
      reset: vi.fn(),
    },
  };
});

vi.mock("../../../../services/company", () => ({
  fetchCompanyProfile: vi.fn().mockResolvedValue({ name: "Joyería Test", logoUrl: "" }),
}));

// Stub del printable real — capturamos las props que recibe.
const printableMock = vi.fn();
vi.mock("@tptech/shared/document-printables/SaleInvoicePrintable", () => ({
  default: (props: unknown) => {
    printableMock(props);
    return <div data-testid="printable-real">PRINTABLE_REAL</div>;
  },
}));

// Stub del preview genérico.
vi.mock("../DocumentPreview", () => ({
  default: () => <div data-testid="document-preview">DOCUMENT_PREVIEW</div>,
}));

import DocumentTemplateEditor from "../DocumentTemplateEditor";

async function renderEditor(kind: string) {
  const utils = render(
    <MemoryRouter initialEntries={[`/configuracion-sistema/documentos/${kind}`]}>
      <Routes>
        <Route path="/configuracion-sistema/documentos/:kind" element={<DocumentTemplateEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  // El editor hace fetch async del template + company; esperamos a que
  // al menos uno de los previews aparezca antes de assertar.
  await screen.findByText(/PRINTABLE_REAL|DOCUMENT_PREVIEW/i);
  return utils;
}

describe("DocumentTemplateEditor — preview unificado (Fase B1)", () => {
  it("kind=FACTURA → monta el printable REAL del shared", async () => {
    await renderEditor("FACTURA");
    expect(screen.getByTestId("printable-real")).toBeTruthy();
    expect(screen.queryByTestId("document-preview")).toBeNull();
  });

  it("kind=PRESUPUESTO → sigue con DocumentPreview (B1 no migra los otros kinds)", async () => {
    await renderEditor("PRESUPUESTO");
    expect(screen.getByTestId("document-preview")).toBeTruthy();
    expect(screen.queryByTestId("printable-real")).toBeNull();
  });

  it("kind=REMITO → sigue con DocumentPreview", async () => {
    await renderEditor("REMITO");
    expect(screen.getByTestId("document-preview")).toBeTruthy();
  });

  it("kind=ORDEN_COMPRA → sigue con DocumentPreview", async () => {
    await renderEditor("ORDEN_COMPRA");
    expect(screen.getByTestId("document-preview")).toBeTruthy();
  });

  it("kind=MOVIMIENTO_STOCK → sigue con DocumentPreview", async () => {
    await renderEditor("MOVIMIENTO_STOCK");
    expect(screen.getByTestId("document-preview")).toBeTruthy();
  });

  it("kind=FACTURA → el printable recibe la config viva + datos de muestra fijos", async () => {
    printableMock.mockClear();
    await renderEditor("FACTURA");

    // La última call recibió: config (template viva), company, y los
    // datos de muestra fijos (documentNumber A-0001-00000123, etc.).
    expect(printableMock).toHaveBeenCalled();
    const props = printableMock.mock.calls.at(-1)![0];
    expect(props.config).toBeTruthy();                         // template viva
    expect(props.company.name).toBe("Joyería Test");           // de fetchCompanyProfile
    expect(props.documentNumber).toBe("A-0001-00000123");      // sample fijo
    expect(props.clientName).toBe("Empresa de Muestra S.A.");  // sample fijo
    expect(props.totals.total).toBe(157905);                   // sample fijo
    expect(props.status).toBe("PENDING");                       // sin watermark
  });

  it("NO aparece el texto 'Escala aproximada — no representa el PDF final'", async () => {
    await renderEditor("FACTURA");
    expect(screen.queryByText(/Escala aproximada/i)).toBeNull();
    expect(screen.queryByText(/no representa el PDF final/i)).toBeNull();
  });
});
