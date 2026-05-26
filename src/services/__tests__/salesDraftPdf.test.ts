// src/services/__tests__/salesDraftPdf.test.ts
// =============================================================================
// C5-fix Opción A — Tests del cliente del nuevo endpoint render-only.
//
// Mockeamos `fetch` y `apiFetch`. Verificamos que:
//   1) `downloadFromDraft` postea JSON al endpoint correcto con el
//      body completo del request.
//   2) Reconoce `Content-Disposition` para el filename.
//   3) Cae al `req.filename` si el header no viene.
//   4) Lanza `ApiError` con el mensaje del backend en !ok.
//   5) `sendDraftByEmail` usa apiFetch con el endpoint correcto.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockApiFetch = vi.hoisted(() => vi.fn());
vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return {
    ...actual,
    apiFetch: mockApiFetch,
  };
});

import { salesDraftPdfApi, type SaleDraftPdfRequest } from "../salesDraftPdf";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function buildReq(): SaleDraftPdfRequest {
  return {
    printable: {
      config:         {},
      company:        { name: "Joyería Test" },
      documentNumber: "A-0001-00000001",
      documentDate:   "2026-05-26",
      clientName:     "Cliente Test SA",
      lines: [
        { id: "ln-1", articleId: "art-1", article: "Anillo", quantity: 2, unitPrice: 500, subtotal: 1000, lineTotal: 1000 },
      ],
      totals:       { subtotal: 1000, discountAmount: 150, taxAmount: 178.5, total: 1028.5 },
      currencyCode: "ARS",
      fxRate:       1,
      status:       "DRAFT",
    },
    page:     { widthMm: 210, heightMm: 297, orientation: "portrait" },
    filename: "Borrador-A-0001-00000001.pdf",
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("salesDraftPdfApi.downloadFromDraft", () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("postea JSON al endpoint correcto con el body completo", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["%PDF"], { type: "application/pdf" }),
      headers: { get: () => "" },
    });

    const req = buildReq();
    await salesDraftPdfApi.downloadFromDraft(req);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toMatch(/\/sales\/render-pdf$/);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body);
    expect(body).toEqual(req);   // body completo, sin transformación
  });

  it("usa el filename del Content-Disposition si viene", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["%PDF"], { type: "application/pdf" }),
      headers: { get: () => 'attachment; filename="Custom-from-server.pdf"' },
    });

    const out = await salesDraftPdfApi.downloadFromDraft(buildReq());
    expect(out.filename).toBe("Custom-from-server.pdf");
  });

  it("cae al filename del request si el header no viene", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["%PDF"], { type: "application/pdf" }),
      headers: { get: () => "" },
    });

    const out = await salesDraftPdfApi.downloadFromDraft(buildReq());
    expect(out.filename).toBe("Borrador-A-0001-00000001.pdf");
  });

  it("lanza ApiError con el mensaje del backend en !ok", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: "Falta printable.documentNumber." }),
    });

    await expect(salesDraftPdfApi.downloadFromDraft(buildReq())).rejects.toThrow(
      "Falta printable.documentNumber.",
    );
  });
});

describe("salesDraftPdfApi.sendDraftByEmail", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("usa apiFetch con el endpoint correcto y propaga el body con mail fields", async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: true, message: "ok" });

    const baseReq = buildReq();
    const emailReq = { ...baseReq, to: "cliente@example.com", subject: "Factura", message: "hola" };
    await salesDraftPdfApi.sendDraftByEmail(emailReq);

    expect(mockApiFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockApiFetch.mock.calls[0]!;
    expect(url).toBe("/sales/send-draft-email");
    expect(opts.method).toBe("POST");
    expect(opts.body).toEqual(emailReq);
  });
});
