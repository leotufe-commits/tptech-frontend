// src/services/__tests__/sales.downloadPdf.test.ts
// =============================================================================
// 1.G — Cobertura de `salesApi.downloadPdf` (endpoint GET /sales/:id/pdf).
//
// El componente VentasFacturas no es testeable en aislamiento (~6500 lineas
// + pricing-engine + state machine de preview). El handler del boton
// "Descargar PDF" delega 100% en `salesApi.downloadPdf` + `file-saver`, asi
// que testeando el servicio cubrimos el contrato de I/O:
//   · URL correcta
//   · credentials: include (cookie httpOnly)
//   · blob + filename extraidos de Content-Disposition
//   · errores 409 (SALE_NOT_CONFIRMED, SALE_CANCELLED) — backward-compat
//     check: aunque el backend post-pivot ya NO los emite, el cliente
//     sigue traduciendo cualquier 4xx con `data.message` para el toast
//   · cualquier 4xx/5xx → ApiError con el message del backend (listo para toast)
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_FETCH = globalThis.fetch;

import { salesApi } from "../sales";
import { ApiError } from "../../lib/api";

function mockFetchOnce(impl: () => Response | Promise<Response>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl);
  globalThis.fetch = fn as unknown as typeof globalThis.fetch;
  return fn;
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

describe("salesApi.downloadPdf", () => {
  it("hace GET al endpoint con credentials:include y devuelve blob + filename", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4 fake pdf body", "utf-8");
    const fetchSpy = mockFetchOnce(() => new Response(pdfBytes, {
      status:  200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": 'attachment; filename="Factura-A-0001-00000001.pdf"',
      },
    }));

    const out = await salesApi.downloadPdf("sale-abc");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/sales\/sale-abc\/pdf$/);
    expect((init as { credentials: string }).credentials).toBe("include");

    // El Blob de fetch puede no pasar `instanceof Blob` en jsdom porque
    // viene de undici/node, no del Blob global. Verificamos shape duck-typed.
    expect(typeof (out.blob as { size?: number }).size).toBe("number");
    expect((out.blob as { size: number }).size).toBeGreaterThan(0);
    expect((out.blob as { type?: string }).type).toBe("application/pdf");
    expect(out.filename).toBe("Factura-A-0001-00000001.pdf");
  });

  it("filename DRAFT — extrae 'Borrador-<Sale.code>.pdf' del header", async () => {
    mockFetchOnce(() => new Response(Buffer.from("%PDF-"), {
      status:  200,
      headers: { "Content-Disposition": 'attachment; filename="Borrador-VTA-0001.pdf"' },
    }));
    const out = await salesApi.downloadPdf("sale-1");
    expect(out.filename).toBe("Borrador-VTA-0001.pdf");
  });

  it("filename CANCELLED — extrae 'Factura-ANULADA-...' del header", async () => {
    mockFetchOnce(() => new Response(Buffer.from("%PDF-"), {
      status:  200,
      headers: { "Content-Disposition": 'attachment; filename="Factura-ANULADA-A-0001-00000001.pdf"' },
    }));
    const out = await salesApi.downloadPdf("sale-2");
    expect(out.filename).toBe("Factura-ANULADA-A-0001-00000001.pdf");
  });

  it("sin Content-Disposition — usa fallback 'Factura-<id>.pdf'", async () => {
    mockFetchOnce(() => new Response(Buffer.from("%PDF-"), { status: 200, headers: {} }));
    const out = await salesApi.downloadPdf("sale-xyz");
    expect(out.filename).toBe("Factura-sale-xyz.pdf");
  });

  it("backend 4xx — lanza ApiError con el `message` del payload (listo para toast)", async () => {
    mockFetchOnce(() => new Response(
      JSON.stringify({ code: "SOME_CODE", message: "Mensaje específico del backend" }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    ));
    await expect(salesApi.downloadPdf("sale-1")).rejects.toMatchObject({
      status:  409,
      message: "Mensaje específico del backend",
      data:    { code: "SOME_CODE", message: "Mensaje específico del backend" },
    });
  });

  it("backend 5xx sin body parseable — lanza ApiError con mensaje genérico", async () => {
    mockFetchOnce(() => new Response("not json", { status: 500 }));
    const err = await salesApi.downloadPdf("sale-1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    expect((err as ApiError).message).toMatch(/Error al generar el PDF \(500\)/);
  });
});

describe("salesApi.sendEmail", () => {
  it("hace POST al endpoint con el payload y devuelve { ok, message }", async () => {
    const fetchSpy = mockFetchOnce(() => new Response(
      JSON.stringify({ ok: true, message: "Factura enviada correctamente." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));

    const out = await salesApi.sendEmail("sale-1", {
      to:      "cliente@example.com",
      subject: "BORRADOR VTA-0001 - Joyería Test",
      message: "Hola,\n\nAdjunto el borrador.\n",
    });

    expect(out.ok).toBe(true);
    expect(out.message).toBe("Factura enviada correctamente.");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/sales\/sale-1\/send-email$/);
    const sentBody = JSON.parse(String((init as { body?: string }).body));
    expect(sentBody).toMatchObject({
      to:      "cliente@example.com",
      subject: "BORRADOR VTA-0001 - Joyería Test",
      message: "Hola,\n\nAdjunto el borrador.\n",
    });
  });
});
