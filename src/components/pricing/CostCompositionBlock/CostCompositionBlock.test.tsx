// src/components/pricing/CostCompositionBlock/CostCompositionBlock.test.tsx
// ============================================================================
// Tests del orchestrator. Cubren:
//   - Degradación: render null cuando no hay datos.
//   - Render del header con total formateado.
//   - Expansión: cuerpo aparece al hacer click.
//   - Variantes: variant=compact arranca expandido (Factura).
//   - Modo: detailMode=UNIFICADO oculta cards de equivalencia.
//   - Fixtures: MULTIPLIER, METAL_MERMA_HECHURA, COST_LINES + costLineOverrides.
// ============================================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CostCompositionBlock } from "./CostCompositionBlock";
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
    priceSource:          "MANUAL_FALLBACK",
    appliedPriceListId:   null,
    appliedPriceListName: null,
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

describe("<CostCompositionBlock /> — orchestrator", () => {
  describe("degradación", () => {
    it("renderiza null cuando line es null", () => {
      const { container } = render(<CostCompositionBlock steps={[]} line={null} />);
      expect(container.firstChild).toBeNull();
    });

    it("renderiza null cuando no hay unitCost ni breakdown", () => {
      const line = makeLine({ unitCost: null, metalHechuraBreakdown: null } as any);
      const { container } = render(<CostCompositionBlock steps={[]} line={line} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("render principal", () => {
    it("muestra header 'Costo unitario' con total", () => {
      const line = makeLine();
      render(<CostCompositionBlock steps={[]} line={line} />);
      expect(screen.getByText("Costo unitario")).toBeTruthy();
      expect(screen.getByText("$600,00")).toBeTruthy(); // unitCost = 600
    });

    it("colapsado por default en variant=full", () => {
      const line = makeLine();
      render(<CostCompositionBlock steps={[]} line={line} variant="full" />);
      expect(screen.queryByText("Costo base")).toBeNull();
    });

    it("expandido por default en variant=compact (Factura)", () => {
      const line = makeLine();
      render(<CostCompositionBlock steps={[]} line={line} variant="compact" />);
      expect(screen.getByText("Costo base")).toBeTruthy();
    });

    it("expande al hacer click en el header", () => {
      const line = makeLine();
      render(<CostCompositionBlock steps={[]} line={line} variant="full" />);
      fireEvent.click(screen.getByText("Costo unitario"));
      expect(screen.getByText("Costo base")).toBeTruthy();
    });
  });

  describe("Fixture MULTIPLIER", () => {
    const steps: PricingStepResult[] = [
      makeStep("MULTIPLIER", 600, { qty: 2, unitValue: 300 }),
    ];
    const line = makeLine({ unitCost: 600, costMode: "MULTIPLIER" } as any);

    it("muestra fila Costo base con sub-texto del multiplicador", () => {
      render(<CostCompositionBlock steps={steps} line={line} variant="compact" />);
      expect(screen.getByText("Costo base")).toBeTruthy();
      // El sub-texto incluye la fórmula
      expect(screen.getByText(/Cantidad × valor unitario|2 × 300/)).toBeTruthy();
    });
  });

  describe("Fixture METAL_MERMA_HECHURA", () => {
    const steps: PricingStepResult[] = [
      makeStep("METAL_QUOTE", 1500, {
        variantName: "Oro 18K",
        metalName: "Oro",
        metalSymbol: "Au",
        variantSku: "AU18K",
        qty: 1, grams: 1, quotePrice: 1500,
        purity: 0.75, merma: 0.5,
      }),
      makeStep("HECHURA", 500, { mode: "PER_GRAM", price: 500, gramsWithMerma: 1 }),
    ];
    const line = makeLine({
      unitCost: 2000,
      costMode: "METAL_MERMA_HECHURA",
      metalHechuraBreakdown: { metalCost: 1500, hechuraCost: 500 } as any,
    } as any);

    it("muestra grupos 'Metales' y 'Hechura / Otros'", () => {
      render(<CostCompositionBlock steps={steps} line={line} variant="compact" />);
      expect(screen.getByText("Metales")).toBeTruthy();
      expect(screen.getByText("Hechura / Otros")).toBeTruthy();
    });

    it("muestra cards de equivalencia en variant=full + DESGLOSADO", () => {
      render(<CostCompositionBlock steps={steps} line={line} variant="full" detailMode="DESGLOSADO" expanded={{ costUnit: true }} onToggle={() => {}} />);
      // El título de la sección de cards
      expect(screen.getByText("Composición del costo")).toBeTruthy();
      // Card de Hechura
      expect(screen.getByText("Hechura")).toBeTruthy();
    });

    it("oculta cards de equivalencia en detailMode=UNIFICADO", () => {
      render(<CostCompositionBlock steps={steps} line={line} variant="full" detailMode="UNIFICADO" />);
      // No aparece el título de la sección de cards
      expect(screen.queryByText("Composición del costo")).toBeNull();
    });

    it("oculta cards de equivalencia en variant=compact aunque sea DESGLOSADO", () => {
      render(<CostCompositionBlock steps={steps} line={line} variant="compact" detailMode="DESGLOSADO" />);
      expect(screen.queryByText("Composición del costo")).toBeNull();
    });
  });

  describe("Fixture COST_LINES con cost-line-overrides", () => {
    const steps: PricingStepResult[] = [
      makeStep("COST_LINES_METAL", 1500, {
        variantName: "Oro 18K", metalName: "Oro", metalSymbol: "Au",
        variantSku: "AU18K", qty: 1, quotePrice: 1500,
        purity: 0.75, merma: 0.5,
      }),
      makeStep("COST_LINES_HECHURA", 500, { lineLabel: "Engaste" }),
      makeStep("COST_LINES_FINAL", 1900, {
        sumLines: 2000,
        adjustmentType: "PERCENTAGE",
        adjustmentValue: 5,
      }),
    ];
    const line = makeLine({
      unitCost: 1900,
      costMode: "COST_LINES",
      metalHechuraBreakdown: { metalCost: 1425, hechuraCost: 475 } as any,
    } as any);

    it("muestra ajuste global cuando COST_LINES_FINAL difiere de la suma", () => {
      render(<CostCompositionBlock steps={steps} line={line} variant="compact" />);
      // El ajuste global es bonificación de 5% (1900 - 2000 = -100)
      expect(screen.getByText(/Bonif\. global/)).toBeTruthy();
    });
  });

  describe("Estructura unificada de 3 segmentos (Costo unit. / Merma-Ajuste / Total)", () => {
    const steps: PricingStepResult[] = [
      makeStep("COST_LINES_HECHURA", 31500, {
        lineLabel: "Engaste",
        unitValue: 35000, qty: 1,
        lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE", lineAdjValue: 10,
        // Convención del motor: BONIF emite POSITIVO (positivo = reducción).
        // base 35.000 × 10% = 3.500.
        lineAdjAmount: 3500,
      }),
    ];
    const line = makeLine({ unitCost: 31500, costMode: "COST_LINES" } as any);

    it("separa base, valor ingresado e impacto monetario del motor", () => {
      render(<CostCompositionBlock steps={steps} line={line} variant="compact" />);
      // Columna 1 — Costo unit. (solo base)
      expect(screen.getByText("Costo unit.")).toBeTruthy();
      // Columna 2 — nivel A: valor ingresado
      expect(screen.getByText("Bonif. 10,00 %")).toBeTruthy();
      // Columna 2 — nivel B: impacto = base × % con signo por TIPO (bonif → −),
      // aunque el motor lo emita positivo. NO es el costo final.
      expect(screen.getByText("−$3.500,00")).toBeTruthy();
      // Columna 3 — Costo total final del motor (aparece en fila + cierre/header)
      expect(screen.getAllByText("$31.500,00").length).toBeGreaterThan(0);
    });

    it("paridad — variant=full y variant=compact rinden el mismo contenido", () => {
      const full = render(
        <CostCompositionBlock steps={steps} line={line} variant="full" expanded={{ costUnit: true }} onToggle={() => {}} />,
      );
      const fullTxt = full.container.textContent;
      full.unmount();
      const compact = render(<CostCompositionBlock steps={steps} line={line} variant="compact" />);
      expect(compact.container.textContent).toContain("Bonif. 10,00 %");
      expect(fullTxt).toContain("Bonif. 10,00 %");
      expect(fullTxt).toContain("−$3.500,00");
    });
  });

  describe("Estado controlado de expansión", () => {
    it("respeta `expanded` controlado", () => {
      const line = makeLine();
      render(<CostCompositionBlock steps={[]} line={line} expanded={{ costUnit: true }} onToggle={() => {}} />);
      expect(screen.getByText("Costo base")).toBeTruthy();
    });

    it("dispara onToggle al hacer click", () => {
      const line = makeLine();
      let toggled = "";
      render(<CostCompositionBlock steps={[]} line={line} expanded={{}} onToggle={(k) => { toggled = k; }} />);
      fireEvent.click(screen.getByText("Costo unitario"));
      expect(toggled).toBe("costUnit");
    });
  });
});
