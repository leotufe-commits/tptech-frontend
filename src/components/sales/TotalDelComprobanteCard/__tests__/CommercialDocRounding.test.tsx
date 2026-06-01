// src/components/sales/TotalDelComprobanteCard/__tests__/CommercialDocRounding.test.tsx
//
// Etapa D' — display del snapshot comercial PER_DOCUMENT.
//
// Verifica:
//   1. Selector puro `selectCommercialDocRoundingDisplay` — passthrough
//      sin matemática; null cuando snapshot null.
//   2. `RoundingDiagnosticsSection` renderiza el bloque commercial con los
//      valores del snapshot tal cual.
//   3. Caso BREAKDOWN (saldo 182091.10 → 182100 — el caso real del audit).
//   4. Caso UNIFIED.
//   5. Caso PER_LINE_LEGACY (snapshot null) muestra placeholder.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  selectCommercialDocRoundingDisplay,
  type CommercialDocRoundingDisplay,
} from "../helpers";
import { RoundingDiagnosticsSection } from "../parts/RoundingDiagnosticsSection";
import type { TotalDelComprobanteCardProps } from "../types";

type Snapshot = TotalDelComprobanteCardProps["commercialDocumentRoundingSnapshot"];

// ─────────────────────────────────────────────────────────────────────────────
// Selector puro
// ─────────────────────────────────────────────────────────────────────────────

describe("selectCommercialDocRoundingDisplay", () => {
  it("snapshot null → null", () => {
    expect(selectCommercialDocRoundingDisplay(null)).toBeNull();
    expect(selectCommercialDocRoundingDisplay(undefined)).toBeNull();
  });

  it("UNIFIED — single row passthrough", () => {
    const snap: Snapshot = {
      source:          "PRICE_LIST",
      scope:           "UNIFIED",
      totalAdjustment: 8.90,
      unified:         { pre: 182091.10, post: 182100, adjustment: 8.90, mode: "HUNDRED", direction: "NEAREST" },
    };
    const d = selectCommercialDocRoundingDisplay(snap) as CommercialDocRoundingDisplay;
    expect(d.scope).toBe("UNIFIED");
    expect(d.totalAdjustment).toBe(8.90);
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0].domain).toBe("HECHURA");
    expect(d.rows[0].pre).toBe(182091.10);
    expect(d.rows[0].post).toBe(182100);
    expect(d.rows[0].delta).toBe(8.90);
    expect(d.rows[0].modeLabel).toBe("HUNDRED NEAREST");
  });

  it("BREAKDOWN — caso real del audit (saldo 182091.10 → 182100)", () => {
    const snap: Snapshot = {
      source:          "PRICE_LIST",
      scope:           "BREAKDOWN",
      totalAdjustment: 8.90,
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
    const d = selectCommercialDocRoundingDisplay(snap) as CommercialDocRoundingDisplay;
    expect(d.scope).toBe("BREAKDOWN");
    expect(d.rows).toHaveLength(1); // solo hechura, sin metales
    expect(d.rows[0].domain).toBe("HECHURA");
    expect(d.rows[0].pre).toBe(182091.10);
    expect(d.rows[0].post).toBe(182100);
    expect(d.rows[0].delta).toBe(8.90);
  });

  it("BREAKDOWN — con metal físico: el row del metal trae gramos passthrough + monetaryEquivalent", () => {
    const snap: Snapshot = {
      source:          "PRICE_LIST",
      scope:           "BREAKDOWN",
      totalAdjustment: -2991.10,
      breakdown: {
        metals: [{
          metalParentId: "OroFino", metalParentName: "Oro Fino",
          preGrams: 1.2375, postGrams: 1.2, deltaGrams: -0.0375,
          metalPricePerGram: 80000, monetaryEquivalent: -3000,
          mode: "DECIMAL_1", direction: "NEAREST",
        }],
        metalMonetaryEquivalent: -3000,
        hechura: {
          preRoundingSaldoMonetario:  182091.10,
          postRoundingSaldoMonetario: 182100,
          deltaSaldoMonetario:        8.90,
          mode: "HUNDRED", direction: "NEAREST",
          source: "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: -2991.10,
      },
    };
    const d = selectCommercialDocRoundingDisplay(snap) as CommercialDocRoundingDisplay;
    expect(d.rows).toHaveLength(2);
    const metal   = d.rows.find((r) => r.domain === "METAL")!;
    const hechura = d.rows.find((r) => r.domain === "HECHURA")!;
    expect(metal.preGrams).toBe(1.2375);
    expect(metal.postGrams).toBe(1.2);
    expect(metal.deltaGrams).toBe(-0.0375);
    expect(metal.monetaryEquivalent).toBe(-3000);
    // El row del metal NO recalcula pre/post en pesos (passthrough puro).
    expect(metal.pre).toBeUndefined();
    expect(metal.post).toBeUndefined();
    expect(hechura.delta).toBe(8.90);
  });

  it("fallback ALL_NONE → rows vacío + fallback expuesto", () => {
    const snap: Snapshot = {
      source: "PRICE_LIST", scope: "BREAKDOWN", totalAdjustment: 0, fallback: "ALL_NONE",
    };
    const d = selectCommercialDocRoundingDisplay(snap) as CommercialDocRoundingDisplay;
    expect(d.rows).toHaveLength(0);
    expect(d.fallback).toBe("ALL_NONE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Render del bloque diagnóstico
// ─────────────────────────────────────────────────────────────────────────────

describe("RoundingDiagnosticsSection — bloque comercial PER_DOCUMENT", () => {
  it("snapshot null → muestra placeholder PER_LINE_LEGACY", () => {
    render(
      <RoundingDiagnosticsSection
        commercialDocSnapshot={null}
        forceVisible
        displayCurrency="ARS"
      />,
    );
    expect(screen.getByText(/PER_LINE_LEGACY/i)).toBeInTheDocument();
  });

  it("snapshot BREAKDOWN (caso 182091.10 → 182100) renderiza valores passthrough", () => {
    const snap: Snapshot = {
      source: "PRICE_LIST", scope: "BREAKDOWN", totalAdjustment: 8.90,
      breakdown: {
        metals: [],
        metalMonetaryEquivalent: 0,
        hechura: {
          preRoundingSaldoMonetario:  182091.10,
          postRoundingSaldoMonetario: 182100,
          deltaSaldoMonetario:        8.90,
          mode: "HUNDRED", direction: "NEAREST",
          source: "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: 8.90,
      },
    };
    render(
      <RoundingDiagnosticsSection
        commercialDocSnapshot={snap}
        forceVisible
        displayCurrency="ARS"
      />,
    );
    expect(screen.getByText(/PER_DOCUMENT/i)).toBeInTheDocument();
    expect(screen.getByTestId("diag-commercial-row-hechura")).toBeInTheDocument();
    // El selector pasa los valores tal cual; el formatter de display los
    // imprime con el preset del tenant. Verificamos por testid + scope data.
    expect(screen.getByTestId("diag-commercial-block").getAttribute("data-tp-scope")).toBe("BREAKDOWN");
  });

  it("snapshot UNIFIED renderiza un solo row HECHURA", () => {
    const snap: Snapshot = {
      source: "PRICE_LIST", scope: "UNIFIED", totalAdjustment: -8.90,
      unified: { pre: 200, post: 191.10, adjustment: -8.90, mode: "HUNDRED", direction: "DOWN" },
    };
    render(
      <RoundingDiagnosticsSection
        commercialDocSnapshot={snap}
        forceVisible
        displayCurrency="ARS"
      />,
    );
    expect(screen.getByTestId("diag-commercial-row-unified")).toBeInTheDocument();
    expect(screen.getByTestId("diag-commercial-block").getAttribute("data-tp-scope")).toBe("UNIFIED");
  });
});
