// src/components/pricing/PricingStepsBreakdown/PricingStepsBreakdown.test.tsx
// ============================================================================
// Tests del shell. Cubren API pública + degradación.
// FASE 2.2 sumará tests de fixture (PROMOTION, QUANTITY_DISCOUNT,
// ENTITY_COMMERCIAL_RULE, ROUNDING TOTAL/NET, CHECKOUT_PAYMENT, SHIPPING).
// ============================================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PricingStepsBreakdown } from "./PricingStepsBreakdown";
import type { NormalizedPricingLine } from "../../../lib/pricing/contract";
import type { PricingStepResult } from "../../../services/articles";

function makeLine(overrides: Partial<NormalizedPricingLine> = {}): NormalizedPricingLine {
  return {
    articleId:        "a1",
    variantId:        null,
    quantity:         1,
    basePrice:        1000,
    unitPrice:        1000,
    unitTaxAmount:    0,
    unitTotalWithTax: 1000,
    quantityDiscountAmount:  0,
    promotionDiscountAmount: 0,
    lineTotal:        1000,
    lineTaxAmount:    0,
    lineTotalWithTax: 1000,
    lineDiscount:     0,
    priceSource:          "PRICE_LIST",
    appliedPriceListId:   "pl1",
    appliedPriceListName: "General",
    appliedPromotionId:   null,
    appliedPromotionName: null,
    appliedDiscountId:    null,
    unitCost:      600,
    unitMargin:    400,
    marginPercent: 40,
    markupPercent: 66.67,
    costMode:      "MANUAL",
    costPartial:   false,
    taxBreakdown:    [],
    appliedRounding: null,
    partial:         false,
    ...overrides,
  } as NormalizedPricingLine;
}

function makeStep(key: string, value: number, meta: Record<string, unknown> = {}, status: "ok" | "skipped" | "missing" | "partial" = "ok"): PricingStepResult {
  return { key, label: key, status, value: String(value), meta } as unknown as PricingStepResult;
}

describe("<PricingStepsBreakdown /> — shell (FASE 2.1)", () => {
  describe("degradación", () => {
    it("renderiza null si no hay basePriceVal (no baseStep)", () => {
      const line = makeLine();
      const { container } = render(
        <PricingStepsBreakdown steps={[]} line={line} result={null} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("variant=full", () => {
    const steps = [makeStep("PRICE_LIST", 1000, { priceListName: "General" })];
    const line = makeLine();

    it("renderiza el card con header 'Cálculo del precio'", () => {
      render(<PricingStepsBreakdown steps={steps} line={line} result={null} variant="full" />);
      expect(screen.getByText("Cálculo del precio")).toBeTruthy();
      expect(screen.getByTestId("pricing-steps-block")).toBeTruthy();
    });

    it("muestra el total en el header (unitTotalWithTax)", () => {
      render(<PricingStepsBreakdown steps={steps} line={line} result={null} variant="full" />);
      expect(screen.getByText("$1.000,00")).toBeTruthy();
    });

    it("body colapsado por default en full", () => {
      render(<PricingStepsBreakdown steps={steps} line={line} result={null} variant="full" />);
      expect(screen.queryByTestId("pricing-steps-body")).toBeNull();
    });

    it("expande al hacer click en el header", () => {
      render(<PricingStepsBreakdown steps={steps} line={line} result={null} variant="full" />);
      fireEvent.click(screen.getByText("Cálculo del precio"));
      expect(screen.getByTestId("pricing-steps-body")).toBeTruthy();
    });
  });

  describe("variant=compact", () => {
    const steps = [makeStep("PRICE_LIST", 1000, { priceListName: "General" })];
    const line = makeLine();

    it("no renderiza wrapper card ni header", () => {
      render(<PricingStepsBreakdown steps={steps} line={line} result={null} variant="compact" />);
      expect(screen.queryByText("Cálculo del precio")).toBeNull();
      expect(screen.queryByTestId("pricing-steps-block")).toBeNull();
    });

    it("renderiza el body directamente con etiqueta de lista", () => {
      render(<PricingStepsBreakdown steps={steps} line={line} result={null} variant="compact" />);
      expect(screen.getByTestId("pricing-steps-body")).toBeTruthy();
      // PriceBaseSection renderiza "Precio de lista · General" cuando baseStep.key === "PRICE_LIST"
      expect(screen.getByText(/Precio de lista/)).toBeTruthy();
    });
  });

  describe("estado controlado de expansión", () => {
    const steps = [makeStep("PRICE_LIST", 1000)];
    const line = makeLine();

    it("respeta `expanded` controlado", () => {
      render(
        <PricingStepsBreakdown
          steps={steps} line={line} result={null}
          expanded={{ priceCalc: true }} onToggle={() => {}}
        />
      );
      expect(screen.getByTestId("pricing-steps-body")).toBeTruthy();
    });

    it("dispara onToggle al hacer click", () => {
      let toggled = "";
      render(
        <PricingStepsBreakdown
          steps={steps} line={line} result={null}
          expanded={{}} onToggle={(k) => { toggled = k; }}
        />
      );
      fireEvent.click(screen.getByText("Cálculo del precio"));
      expect(toggled).toBe("priceCalc");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Fila de hechura colapsada en modo derivado (MARGIN_TOTAL / etc.). El
  // motor emite `hechuraMarginPct = 0` y los lineSale por componente colapsan
  // al lineCost. Reusamos el `unifiedFactor` del artículo (basePrice / unitCost)
  // para SOLO DISPLAY y mostrar la fórmula `cost × factor = venta` igual que
  // el modo desglosado — sin subtítulo aparte.
  // ──────────────────────────────────────────────────────────────────────────
  describe("Modo derivado en PriceBaseSection (MARGIN_TOTAL) — display unifiedFactor", () => {
    it("Modo derivado (mpct=0, sale ≠ cost agregado) y fila colapsada → muestra fórmula 'cost × factor = venta' (sin subtítulo)", () => {
      const steps = [
        makeStep("PRICE_LIST", 850, { priceListName: "Mayorista", mode: "MARGIN_TOTAL" }),
        // Step de hechura con lineSale === lineCost (colapsado).
        makeStep("COST_LINES_HECHURA", 500, {
          lineLabel: "Mano de obra", costLineId: "h1",
        }),
      ];
      // unitCost=500, basePrice=850 → unifiedFactor = 1.7.
      const line = makeLine({
        unitCost: 500, basePrice: 850, unitPrice: 850,
        metalHechuraBreakdown: {
          metalCost: 0, metalSale: 0,
          hechuraCost: 500, hechuraSale: 850, hechuraMarginPct: 0,
        } as any,
        composition: {
          hechuras: [{ costLineId: "h1", lineSale: 500, lineLabel: "Mano de obra" }],
        } as any,
      } as any);
      render(
        <PricingStepsBreakdown
          steps={steps} line={line} result={null}
          expanded={{ priceCalc: true }} onToggle={() => {}}
        />
      );
      // El subtítulo ya no se renderiza.
      expect(screen.queryByText(/Valor de costo · margen aplicado al total del artículo/i))
        .toBeNull();
      // La fila ahora muestra el mismo patrón visual que el modo desglosado:
      // a la izquierda `$500,00 × 1.70 =` y a la derecha el lineSale `$850,00`.
      // unifiedFactor = basePrice/unitCost = 850/500 = 1.70.
      const formulaLefts = screen.getAllByText((_content, node) => {
        if (!node || node.tagName !== "SPAN") return false;
        const txt = node.textContent ?? "";
        return /\$500,00/.test(txt) && /1[.,]70/.test(txt) && /×/.test(txt) && /=/.test(txt);
      });
      expect(formulaLefts.length).toBeGreaterThan(0);
      // El lineSale a la derecha también está presente.
      expect(screen.getAllByText("$850,00").length).toBeGreaterThan(0);
    });

    it("Modo desglosado (mpct > 0) → NO muestra subtítulo (comportamiento original)", () => {
      const steps = [
        makeStep("PRICE_LIST", 800, { priceListName: "Mayorista", mode: "METAL_HECHURA" }),
        makeStep("COST_LINES_HECHURA", 500, {
          lineLabel: "Mano de obra", costLineId: "h1",
        }),
      ];
      const line = makeLine({
        unitCost: 500, basePrice: 800, unitPrice: 800,
        metalHechuraBreakdown: {
          metalCost: 0, metalSale: 0,
          hechuraCost: 500, hechuraSale: 800, hechuraMarginPct: 60,
        } as any,
        composition: {
          hechuras: [{ costLineId: "h1", lineSale: 800, lineLabel: "Mano de obra" }],
        } as any,
      } as any);
      render(
        <PricingStepsBreakdown
          steps={steps} line={line} result={null}
          expanded={{ priceCalc: true }} onToggle={() => {}}
        />
      );
      expect(screen.queryByText(/Valor de costo · margen aplicado al total del artículo/i))
        .toBeNull();
    });

    it("MARGIN_TOTAL con margen 0% literal (sale === cost agregado) → NO muestra subtítulo", () => {
      const steps = [
        makeStep("PRICE_LIST", 500, { priceListName: "Costo", mode: "MARGIN_TOTAL" }),
        makeStep("COST_LINES_HECHURA", 500, {
          lineLabel: "Mano de obra", costLineId: "h1",
        }),
      ];
      const line = makeLine({
        unitCost: 500, basePrice: 500, unitPrice: 500,
        metalHechuraBreakdown: {
          metalCost: 0, metalSale: 0,
          hechuraCost: 500, hechuraSale: 500, hechuraMarginPct: 0,
        } as any,
        composition: {
          hechuras: [{ costLineId: "h1", lineSale: 500, lineLabel: "Mano de obra" }],
        } as any,
      } as any);
      render(
        <PricingStepsBreakdown
          steps={steps} line={line} result={null}
          expanded={{ priceCalc: true }} onToggle={() => {}}
        />
      );
      expect(screen.queryByText(/Valor de costo · margen aplicado al total del artículo/i))
        .toBeNull();
    });
  });
});
