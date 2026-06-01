// src/components/sales/SaleCompositionEditableGrid/parts/__tests__/CommercialRoundingFooter.test.tsx
//
// Etapa D' (cierre conceptual) — Test del footer comercial.
//
// Display orientado al usuario:
//   · NO se muestran IDs internos (metalParentId) — solo `metalParentName`.
//   · NO se muestran enums (INTEGER / HUNDRED / NEAREST).
//   · Formato monetario via `formatMoneyDoc` (config del tenant).
//   · Etiquetas: "Redondeo comercial", "Metal — <nombre>", "Hechura",
//     "Impacto:", "Total impacto", "Total" (UNIFIED).
//
// REGLA DE ORO verificada:
//   · El frontend NO recalcula nada — solo pasa el snapshot al render.
//   · `appliedToLineCount` viene del backend (badge condicional).
//   · `monetaryEquivalent` se lee tal cual del snapshot.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommercialRoundingFooter } from "../CommercialRoundingFooter";
import type { DocumentLine } from "../../../../../lib/document-types";

type Ctx = NonNullable<NonNullable<DocumentLine["pricingMeta"]>["commercialRoundingContext"]>;

describe("CommercialRoundingFooter — passthrough sin IDs/enums", () => {
  it("context null → NO renderiza", () => {
    render(<CommercialRoundingFooter context={null} currency="ARS" />);
    expect(screen.queryByTestId("sce-commercial-rounding-footer")).toBeNull();
  });

  it("context undefined → NO renderiza", () => {
    render(<CommercialRoundingFooter context={undefined} currency="ARS" />);
    expect(screen.queryByTestId("sce-commercial-rounding-footer")).toBeNull();
  });

  it("UNIFIED — muestra header, fila 'Total' con pre→post, impacto y total", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "UNIFIED",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 1,
      totalAdjustment:    -8.90,
      unified: { pre: 200, post: 191.10, adjustment: -8.90, mode: "HUNDRED", direction: "DOWN" },
    };
    render(<CommercialRoundingFooter context={ctx} currency="ARS" />);
    expect(screen.getByTestId("sce-commercial-rounding-footer")).toBeInTheDocument();
    expect(screen.getByText(/Redondeo comercial/i)).toBeInTheDocument();
    expect(screen.getByTestId("sce-commercial-row-unified")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByTestId("sce-commercial-total-impact")).toBeInTheDocument();
    // NO se renderizan enums.
    expect(screen.queryByText(/HUNDRED/)).toBeNull();
    expect(screen.queryByText(/DOWN/)).toBeNull();
    expect(screen.queryByText(/NEAREST/)).toBeNull();
  });

  it("BREAKDOWN — saldo 182091.10 → 182100 (caso real) muestra 'Hechura' + 'Impacto'", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 1,
      totalAdjustment:    8.90,
      breakdown: {
        metals: [],
        metalMonetaryEquivalent: 0,
        hechura: {
          preRoundingSaldoMonetario:  182091.10,
          postRoundingSaldoMonetario: 182100,
          deltaSaldoMonetario:        8.90,
          mode:                       "HUNDRED",
          direction:                  "NEAREST",
          source:                     "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: 8.90,
      },
    };
    render(<CommercialRoundingFooter context={ctx} currency="ARS" />);
    expect(screen.getByTestId("sce-commercial-hechura")).toBeInTheDocument();
    expect(screen.getByText("Hechura")).toBeInTheDocument();
    // Hay dos "Impacto:" potencialmente (hechura + total impacto label distinto).
    expect(screen.getAllByText(/Impacto:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Total impacto/i)).toBeInTheDocument();
    // NO enums.
    expect(screen.queryByText(/HUNDRED/)).toBeNull();
    expect(screen.queryByText(/NEAREST/)).toBeNull();
  });

  it("BREAKDOWN con metal — muestra 'Metal — <name>' (nombre, no ID)", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 1,
      totalAdjustment:    -2991.10,
      breakdown: {
        metals: [{
          metalParentId:       "cmprg38wr00610sca21jxmqj1",   // ← ID interno NO debe verse
          metalParentName:     "Oro Fino",
          preGrams:            1.125,
          postGrams:           1.000,
          deltaGrams:          -0.125,
          metalPricePerGram:   80000,
          monetaryEquivalent:  -23437.50,
          mode:                "DECIMAL_1",
          direction:           "NEAREST",
        }],
        metalMonetaryEquivalent: -23437.50,
        hechura: {
          preRoundingSaldoMonetario:  353619,
          postRoundingSaldoMonetario: 353600,
          deltaSaldoMonetario:        -19,
          mode:                       "HUNDRED",
          direction:                  "NEAREST",
          source:                     "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: -23456.50,
      },
    };
    render(<CommercialRoundingFooter context={ctx} currency="ARS" />);
    // El nombre del metal SÍ aparece.
    expect(screen.getByText("Metal — Oro Fino")).toBeInTheDocument();
    // El ID interno NO aparece en pantalla.
    expect(screen.queryByText(/cmprg38wr00610sca21jxmqj1/)).toBeNull();
    // Enums NO aparecen.
    expect(screen.queryByText(/DECIMAL_1/)).toBeNull();
    expect(screen.queryByText(/HUNDRED/)).toBeNull();
    expect(screen.queryByText(/NEAREST/)).toBeNull();
    // Bloque hechura presente.
    expect(screen.getByText("Hechura")).toBeInTheDocument();
    // Total impacto presente.
    expect(screen.getByText(/Total impacto/i)).toBeInTheDocument();
  });

  it("BREAKDOWN con varias líneas → muestra badge 'Aplicado a nivel comprobante'", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 3,
      totalAdjustment:    8.90,
      breakdown: {
        metals: [],
        metalMonetaryEquivalent: 0,
        hechura: {
          preRoundingSaldoMonetario:  182091.10,
          postRoundingSaldoMonetario: 182100,
          deltaSaldoMonetario:        8.90,
          mode:                       "HUNDRED",
          direction:                  "NEAREST",
          source:                     "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: 8.90,
      },
    };
    render(<CommercialRoundingFooter context={ctx} currency="ARS" />);
    expect(screen.getByText(/Aplicado a nivel comprobante \(3 líneas\)/i)).toBeInTheDocument();
  });

  it("fallback de label: metalParentName === metalParentId → muestra 'Metal' (sin ID)", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 1,
      totalAdjustment:    -100,
      breakdown: {
        metals: [{
          metalParentId:       "cmprg38wr00610sca21jxmqj1",
          metalParentName:     "cmprg38wr00610sca21jxmqj1", // ← mismo que el id
          preGrams:            1,
          postGrams:           1,
          deltaGrams:          0,
          metalPricePerGram:   80000,
          monetaryEquivalent:  -100,
          mode:                "DECIMAL_1",
          direction:           "NEAREST",
        }],
        metalMonetaryEquivalent: -100,
        hechura: {
          preRoundingSaldoMonetario:  1000,
          postRoundingSaldoMonetario: 1000,
          deltaSaldoMonetario:        0,
          mode:                       "HUNDRED",
          direction:                  "NEAREST",
          source:                     "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: -100,
      },
    };
    render(<CommercialRoundingFooter context={ctx} currency="ARS" />);
    // Fallback amigable cuando el nombre no se pudo resolver en backend.
    expect(screen.getByText("Metal")).toBeInTheDocument();
    // Bajo NINGUNA circunstancia se muestra el id técnico.
    expect(screen.queryByText(/cmprg38wr00610sca21jxmqj1/)).toBeNull();
  });

  it("fallback de label: metalParentName vacío → muestra 'Metal' (sin ID)", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 1,
      totalAdjustment:    -50,
      breakdown: {
        metals: [{
          metalParentId:       "id-x",
          metalParentName:     "",
          preGrams:            0.5,
          postGrams:           0.5,
          deltaGrams:          0,
          metalPricePerGram:   80000,
          monetaryEquivalent:  -50,
          mode:                "DECIMAL_1",
          direction:           "NEAREST",
        }],
        metalMonetaryEquivalent: -50,
        hechura: {
          preRoundingSaldoMonetario:  100,
          postRoundingSaldoMonetario: 100,
          deltaSaldoMonetario:        0,
          mode:                       "HUNDRED",
          direction:                  "NEAREST",
          source:                     "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: -50,
      },
    };
    render(<CommercialRoundingFooter context={ctx} currency="ARS" />);
    expect(screen.getByText("Metal")).toBeInTheDocument();
    expect(screen.queryByText(/id-x/)).toBeNull();
  });

  it("fallback ALL_NONE (sin movimiento) → NO renderiza", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 1,
      totalAdjustment:    0,
      fallback:           "ALL_NONE",
    };
    render(<CommercialRoundingFooter context={ctx} currency="ARS" />);
    expect(screen.queryByTestId("sce-commercial-rounding-footer")).toBeNull();
  });
});
