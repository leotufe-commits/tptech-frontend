// src/lib/sales/__tests__/invoiceViewPresets.test.ts
// ============================================================================
// Tests del resolver de Plantillas de vista.
//
// Cubre:
//   1. Default BALANCED cuando no hay preset (null / undefined / desconocido).
//   2. Cada preset resuelve a su config esperada (5 presets).
//   3. SINGLE_COLUMN (Financiera) ya NO setea forceSingleColumn=true (la
//      nueva identidad es "panel financiero dominante", no "single column").
//   4. asideColumnGridStyle setea la CSS variable correctamente.
//   5. INVOICE_VIEW_PRESET_OPTIONS contiene los 5 presets en orden esperado.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  resolveInvoiceViewPreset,
  asideColumnGridStyle,
  INVOICE_VIEW_PRESET_OPTIONS,
  type InvoiceViewPreset,
} from "../invoiceViewPresets";

describe("resolveInvoiceViewPreset — fallback a BALANCED (default)", () => {
  it.each([
    null,
    undefined,
    "UNKNOWN_PRESET" as unknown as InvoiceViewPreset,
    "" as unknown as InvoiceViewPreset,
  ])("preset = %p → BALANCED", (input) => {
    const r = resolveInvoiceViewPreset(input as any);
    expect(r.preset).toBe("BALANCED");
    expect(r.layoutMode).toBe("TWO_COLS_FROM_TOP");
    expect(r.asideMinPx).toBe(440);
    expect(r.asideMaxPx).toBe(540);
    expect(r.asideSpacingClass).toBe("space-y-4");
    expect(r.compositionDensity).toBe("REGULAR");
    expect(r.totalHierarchy).toBe("EMPHASIZED");
    expect(r.stickyLineActions).toBe(true);
    expect(r.forceSingleColumn).toBe(false);
  });
});

describe("resolveInvoiceViewPreset — cada preset", () => {
  it("BALANCED (default — recomendado para uso diario)", () => {
    const r = resolveInvoiceViewPreset("BALANCED");
    expect(r.preset).toBe("BALANCED");
    expect(r.layoutMode).toBe("TWO_COLS_FROM_TOP");
    expect(r.asideMinPx).toBe(440);
    expect(r.asideMaxPx).toBe(540);
    expect(r.asideSpacingClass).toBe("space-y-4");
    expect(r.totalHierarchy).toBe("EMPHASIZED");
    expect(r.forceSingleColumn).toBe(false);
  });

  it("COMPACT (densidad alta — notebooks/monitores chicos)", () => {
    const r = resolveInvoiceViewPreset("COMPACT");
    expect(r.preset).toBe("COMPACT");
    expect(r.layoutMode).toBe("TWO_COLS_FROM_TOP");
    // Aside MÁS ANGOSTO que BALANCED — líneas dominan.
    expect(r.asideMinPx).toBe(360);
    expect(r.asideMaxPx).toBe(420);
    expect(r.asideSpacingClass).toBe("space-y-2");
    expect(r.compositionDensity).toBe("COMPACT");
    expect(r.forceSingleColumn).toBe(false);
  });

  it("CLASSIC (estructura ERP tradicional)", () => {
    const r = resolveInvoiceViewPreset("CLASSIC");
    expect(r.preset).toBe("CLASSIC");
    // CLASSIC apunta al layout pre-UX.9 (líneas full-width, aside abajo).
    expect(r.layoutMode).toBe("STACKED_FULL_WIDTH");
    expect(r.asideMinPx).toBe(460);
    expect(r.asideMaxPx).toBe(600);
    // CLASSIC NO usa sticky actions (comportamiento clásico).
    expect(r.stickyLineActions).toBe(false);
    expect(r.forceSingleColumn).toBe(false);
  });

  it("SINGLE_COLUMN — identidad UI 'Financiera': panel dominante", () => {
    const r = resolveInvoiceViewPreset("SINGLE_COLUMN");
    expect(r.preset).toBe("SINGLE_COLUMN");
    // Cambió de identidad: ya NO es "una sola columna full-width" sino
    // "panel financiero dominante a la derecha".
    expect(r.layoutMode).toBe("TWO_COLS_FROM_TOP");
    expect(r.forceSingleColumn).toBe(false);
    // Aside MUY ancho — el panel financiero es el protagonista.
    expect(r.asideMinPx).toBe(520);
    expect(r.asideMaxPx).toBe(640);
    expect(r.totalHierarchy).toBe("EMPHASIZED");
  });

  it("CUSTOM (layout libre draggable)", () => {
    const r = resolveInvoiceViewPreset("CUSTOM");
    expect(r.preset).toBe("CUSTOM");
    // CUSTOM arranca con los mismos anchos base que COMPACT viejo (400-480)
    // — el usuario luego reorganiza con drag/resize. La diferencia es
    // semántica ("CUSTOM" = "este layout es mío").
    expect(r.layoutMode).toBe("TWO_COLS_FROM_TOP");
    expect(r.asideMinPx).toBe(400);
    expect(r.asideMaxPx).toBe(480);
    expect(r.forceSingleColumn).toBe(false);
    expect(r.stickyLineActions).toBe(true);
  });
});

describe("asideColumnGridStyle — CSS variable", () => {
  it("setea --invoice-aside-col con el minmax del preset (BALANCED)", () => {
    const style = asideColumnGridStyle(resolveInvoiceViewPreset("BALANCED"));
    expect((style as Record<string, unknown>)["--invoice-aside-col"]).toBe(
      "minmax(440px, 540px)",
    );
  });

  it("COMPACT → minmax(360, 420) (más angosto que BALANCED)", () => {
    const style = asideColumnGridStyle(resolveInvoiceViewPreset("COMPACT"));
    expect((style as Record<string, unknown>)["--invoice-aside-col"]).toBe(
      "minmax(360px, 420px)",
    );
  });

  it("CLASSIC → minmax(460, 600)", () => {
    const style = asideColumnGridStyle(resolveInvoiceViewPreset("CLASSIC"));
    expect((style as Record<string, unknown>)["--invoice-aside-col"]).toBe(
      "minmax(460px, 600px)",
    );
  });

  it("SINGLE_COLUMN (Financiera) → minmax(520, 640) (aside dominante)", () => {
    const style = asideColumnGridStyle(resolveInvoiceViewPreset("SINGLE_COLUMN"));
    expect((style as Record<string, unknown>)["--invoice-aside-col"]).toBe(
      "minmax(520px, 640px)",
    );
  });

  it("CUSTOM → minmax(400, 480)", () => {
    const style = asideColumnGridStyle(resolveInvoiceViewPreset("CUSTOM"));
    expect((style as Record<string, unknown>)["--invoice-aside-col"]).toBe(
      "minmax(400px, 480px)",
    );
  });
});

describe("layoutMode — render esperado por preset", () => {
  it("BALANCED → TWO_COLS_FROM_TOP", () => {
    expect(resolveInvoiceViewPreset("BALANCED").layoutMode).toBe("TWO_COLS_FROM_TOP");
  });

  it("COMPACT → TWO_COLS_FROM_TOP", () => {
    expect(resolveInvoiceViewPreset("COMPACT").layoutMode).toBe("TWO_COLS_FROM_TOP");
  });

  it("CLASSIC → STACKED_FULL_WIDTH (líneas full-width arriba, aside debajo)", () => {
    expect(resolveInvoiceViewPreset("CLASSIC").layoutMode).toBe("STACKED_FULL_WIDTH");
  });

  it("SINGLE_COLUMN (Financiera) → TWO_COLS_FROM_TOP — cambió de identidad", () => {
    expect(resolveInvoiceViewPreset("SINGLE_COLUMN").layoutMode).toBe("TWO_COLS_FROM_TOP");
  });

  it("CUSTOM → TWO_COLS_FROM_TOP", () => {
    expect(resolveInvoiceViewPreset("CUSTOM").layoutMode).toBe("TWO_COLS_FROM_TOP");
  });

  it("forceSingleColumn es false en TODOS los presets (nadie fuerza single column)", () => {
    expect(resolveInvoiceViewPreset("BALANCED").forceSingleColumn).toBe(false);
    expect(resolveInvoiceViewPreset("COMPACT").forceSingleColumn).toBe(false);
    expect(resolveInvoiceViewPreset("CLASSIC").forceSingleColumn).toBe(false);
    expect(resolveInvoiceViewPreset("CUSTOM").forceSingleColumn).toBe(false);
    expect(resolveInvoiceViewPreset("SINGLE_COLUMN").forceSingleColumn).toBe(false);
  });

  it("lineTotalEmphasis: solo CLASSIC usa EMPHASIZED; los demás STANDARD", () => {
    expect(resolveInvoiceViewPreset("BALANCED").lineTotalEmphasis).toBe("STANDARD");
    expect(resolveInvoiceViewPreset("COMPACT").lineTotalEmphasis).toBe("STANDARD");
    expect(resolveInvoiceViewPreset("CLASSIC").lineTotalEmphasis).toBe("EMPHASIZED");
    expect(resolveInvoiceViewPreset("SINGLE_COLUMN").lineTotalEmphasis).toBe("STANDARD");
    expect(resolveInvoiceViewPreset("CUSTOM").lineTotalEmphasis).toBe("STANDARD");
    expect(resolveInvoiceViewPreset(null).lineTotalEmphasis).toBe("STANDARD");
  });
});

describe("INVOICE_VIEW_PRESET_OPTIONS — metadata para el selector UI", () => {
  it("contiene exactamente los 5 presets en el orden esperado", () => {
    const values = INVOICE_VIEW_PRESET_OPTIONS.map((o) => o.value);
    expect(values).toEqual([
      "BALANCED", "CLASSIC", "COMPACT", "SINGLE_COLUMN", "CUSTOM",
    ]);
  });

  it("labels en español: Balanceada / Clásica / Compacta / Financiera / Personalizada", () => {
    const labels = INVOICE_VIEW_PRESET_OPTIONS.map((o) => o.label);
    expect(labels).toEqual([
      "Balanceada", "Clásica", "Compacta", "Financiera", "Personalizada",
    ]);
  });

  it("cada opción tiene label legible y descripción", () => {
    for (const opt of INVOICE_VIEW_PRESET_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.description.length).toBeGreaterThan(0);
    }
  });
});
