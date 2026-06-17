// src/components/sales/TotalDelComprobanteCard/__tests__/rounding-source-label.test.tsx
// =============================================================================
// POLICY §R-Rounding-3 — Etiqueta del ROUNDING_MONETARY por ORIGEN del backend.
//
// Con "opción B" (redondeo financiero PHYSICAL diferido a capa 16), el
// `roundingAdjustment` que viaja en el componente ROUNDING_MONETARY es el
// COMERCIAL de la lista, AUNQUE `documentRoundingApplied` (financiero) esté
// presente. Por eso el label NO puede inferirse de `documentRoundingApplied`:
// el backend emite `roundingSource` y el frontend lo respeta.
//
//   · roundingSource="LIST"     → "Redondeo comercial"  (aunque haya doc applied)
//   · roundingSource="DOCUMENT" → "Redondeo financiero"
//   · roundingSource ausente    → heurístico legacy (documentRoundingApplied)
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function bd(
  roundingSource?: "LIST" | "DOCUMENT",
): BalanceBreakdownDTO {
  return {
    metals: [],
    monetaryBalance: {
      amount: 1223.68, currencyCode: "ARS", currencyRate: 1, amountBase: 1223.68,
      components: [
        { type: "HECHURA",           group: "HECHURA",  label: "Hechura", amount: 1000 },
        { type: "TAX",               group: "TAX",      label: "IVA",     amount: 210 },
        {
          type:   "ROUNDING_MONETARY",
          group:  "ROUNDING",
          label:  "Redondeo",
          amount: 13.68,
          ...(roundingSource ? { roundingSource } : {}),
        },
      ],
    },
  };
}

function openDetail() {
  fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
}

describe("POLICY §R-Rounding-3 — etiqueta del ROUNDING_MONETARY por roundingSource", () => {
  it("escenario unificado opción B: roundingSource='LIST' + documentRoundingApplied financiero presente → 'Redondeo comercial'", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1223.68}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd("LIST")}
        // financiero presente (delta 0 / PHYSICAL diferido a capa 16) — NO debe
        // forzar la etiqueta "Redondeo financiero" sobre el componente comercial.
        documentRoundingApplied={{ scope: "UNIFIED", totalAdjustment: 0 }}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    const row = screen.getByTestId("total-card-component-ROUNDING_MONETARY");
    expect(row.getAttribute("data-tp-rounding-source")).toBe("LIST");
    expect(row.textContent).toContain("Redondeo comercial");
    expect(row.textContent).not.toContain("Redondeo financiero");
  });

  it("roundingSource='DOCUMENT' → 'Redondeo financiero'", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1223.68}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd("DOCUMENT")}
        documentRoundingApplied={{ scope: "UNIFIED", totalAdjustment: 13.68 }}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    const row = screen.getByTestId("total-card-component-ROUNDING_MONETARY");
    expect(row.getAttribute("data-tp-rounding-source")).toBe("DOCUMENT");
    expect(row.textContent).toContain("Redondeo financiero");
  });

  it("back-compat: sin roundingSource + sin documentRoundingApplied → 'Redondeo comercial' (LIST)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1223.68}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd()}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    const row = screen.getByTestId("total-card-component-ROUNDING_MONETARY");
    expect(row.getAttribute("data-tp-rounding-source")).toBe("LIST");
    expect(row.textContent).toContain("Redondeo comercial");
  });

  it("back-compat: sin roundingSource + documentRoundingApplied presente → 'Redondeo financiero' (heurístico legacy)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1223.68}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd()}
        documentRoundingApplied={{ scope: "UNIFIED", totalAdjustment: 13.68 }}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    const row = screen.getByTestId("total-card-component-ROUNDING_MONETARY");
    expect(row.getAttribute("data-tp-rounding-source")).toBe("DOCUMENT");
    expect(row.textContent).toContain("Redondeo financiero");
  });
});
