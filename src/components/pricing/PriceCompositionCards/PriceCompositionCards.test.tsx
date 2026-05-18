// src/components/pricing/PriceCompositionCards/PriceCompositionCards.test.tsx
// ============================================================================
// Tests del orchestrator y helpers. Cubren:
//   - degradación: sin metal ni hechura → render null
//   - render con composition de metal solo
//   - render con composition de hechura solo
//   - render combinado metal + hechura
//   - controlled expansion
// ============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceCompositionCards } from "./PriceCompositionCards";
import { buildMetalSaleMap, computeMetalSaleFactor, computeHechuraSaleFactor } from "./helpers";
import type { NormalizedPricingLine } from "../../../lib/pricing/contract";
import type { PricingStepResult } from "../../../services/articles";

function makeLine(o: Partial<NormalizedPricingLine> = {}): NormalizedPricingLine {
  return {
    articleId:        "a1",
    variantId:        null,
    quantity:         1,
    basePrice:        2000,
    unitPrice:        2000,
    unitTaxAmount:    0,
    unitTotalWithTax: 2000,
    quantityDiscountAmount:  0,
    promotionDiscountAmount: 0,
    lineTotal:        2000,
    lineTaxAmount:    0,
    lineTotalWithTax: 2000,
    lineDiscount:     0,
    priceSource:          "PRICE_LIST",
    appliedPriceListId:   "pl1",
    appliedPriceListName: "General",
    appliedPromotionId:   null,
    appliedPromotionName: null,
    appliedDiscountId:    null,
    unitCost:      1500,
    unitMargin:    500,
    marginPercent: 25,
    markupPercent: 33.33,
    costMode:      "METAL_MERMA_HECHURA",
    costPartial:   false,
    taxBreakdown:    [],
    appliedRounding: null,
    partial:         false,
    ...o,
  } as NormalizedPricingLine;
}

function makeStep(key: string, value: number, meta: Record<string, unknown> = {}): PricingStepResult {
  return { key, label: key, status: "ok", value: String(value), meta } as unknown as PricingStepResult;
}

describe("PriceCompositionCards — helpers", () => {
  it("computeMetalSaleFactor: ratio metalSale/metalCost", () => {
    expect(computeMetalSaleFactor({ metalCost: 1000, metalSale: 1500 })).toBe(1.5);
  });

  it("computeMetalSaleFactor: null si metalCost <= 0", () => {
    expect(computeMetalSaleFactor({ metalCost: 0, metalSale: 1500 })).toBeNull();
    expect(computeMetalSaleFactor(null)).toBeNull();
  });

  it("computeHechuraSaleFactor: ratio hechuraSale/hechuraCost", () => {
    expect(computeHechuraSaleFactor({ hechuraCost: 500, hechuraSale: 800 })).toBe(1.6);
  });

  it("buildMetalSaleMap: agrupa por metal padre", () => {
    const steps = [
      makeStep("COST_LINES_METAL", 1500, {
        metalId: "au", metalName: "Oro", metalSymbol: "Au",
        variantId: "v1", variantName: "Oro 18K", variantSku: "AU18K",
        qty: 1, purity: 0.75, merma: 0, quotePrice: 1500,
        costLineId: "cl1",
      }),
    ];
    const map = buildMetalSaleMap({
      steps,
      lineSaleByCostLineId: new Map([["cl1", 2250]]),
      saleEntityMermaMap:   new Map(),
      metalSaleFactor:      1.5,
    });
    const entries = Array.from(map.values());
    expect(entries.length).toBe(1);
    expect(entries[0].displayName).toBe("Oro");
    expect(entries[0].totalCost).toBe(2250);
    expect(entries[0].variants.length).toBe(1);
    expect(entries[0].variants[0].saleLine).toBe(2250);
  });
});

describe("<PriceCompositionCards /> — orchestrator", () => {
  it("renderiza null cuando no hay metal ni hechura", () => {
    const { container } = render(
      <PriceCompositionCards steps={[]} line={makeLine()} result={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza el grid con título 'Composición del precio' cuando hay metales", () => {
    const steps = [
      makeStep("COST_LINES_METAL", 1500, {
        metalId: "au", metalName: "Oro", metalSymbol: "Au",
        variantName: "Oro 18K", variantSku: "AU18K",
        qty: 1, purity: 0.75, merma: 0, quotePrice: 1500,
        costLineId: "cl1",
      }),
    ];
    const line = makeLine({
      metalHechuraBreakdown: { metalCost: 1500, metalSale: 2250, hechuraCost: 0, hechuraSale: 0 } as any,
      composition: { metals: [{ costLineId: "cl1", lineSale: 2250 }] } as any,
    });
    render(<PriceCompositionCards steps={steps} line={line} result={null} />);
    expect(screen.getByText("Composición del precio")).toBeTruthy();
    expect(screen.getByText("Oro")).toBeTruthy();
  });

  it("renderiza card Hechura cuando hay hechuraCost", () => {
    const steps = [
      makeStep("COST_LINES_HECHURA", 500, { lineLabel: "Engaste", costLineId: "h1" }),
    ];
    const line = makeLine({
      metalHechuraBreakdown: { metalCost: 0, metalSale: 0, hechuraCost: 500, hechuraSale: 800 } as any,
      composition: { hechuras: [{ costLineId: "h1", lineSale: 800, lineLabel: "Engaste" }] } as any,
    });
    render(<PriceCompositionCards steps={steps} line={line} result={null} />);
    expect(screen.getByText("Hechura")).toBeTruthy();
  });

  it("estado controlado: expanded={hechura:true} expande la card", () => {
    const steps = [
      makeStep("COST_LINES_HECHURA", 500, { lineLabel: "Engaste" }),
    ];
    const line = makeLine({
      metalHechuraBreakdown: { metalCost: 0, metalSale: 0, hechuraCost: 500, hechuraSale: 800 } as any,
    });
    let toggled = "";
    render(
      <PriceCompositionCards
        steps={steps} line={line} result={null}
        expanded={{ hechura: true }} onToggle={(k) => { toggled = k; }}
      />
    );
    // Origen aparece cuando expanded
    expect(screen.getByText("Origen")).toBeTruthy();
    void toggled;
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Fila colapsada en modo derivado (MARGIN_TOTAL / PROPORTIONAL_COST / etc.).
// El motor emite `hechuraMarginPct = 0` y `composition.hechuras[i].lineSale`
// colapsa al `lineCost`. Reusamos el `unifiedFactor` del artículo
// (basePrice / unitCost) para SOLO DISPLAY y mostrar la misma fórmula
// `cost × factor = venta` que el modo desglosado — sin subtítulo aparte.
// ────────────────────────────────────────────────────────────────────────────
describe("Modo derivado en HechuraSaleCard (MARGIN_TOTAL) — display unifiedFactor", () => {
  it("Modo derivado (mpct=0, hechuraSale ≠ hechuraCost) y línea colapsada → muestra fórmula 'cost × factor = venta' (sin subtítulo)", () => {
    const steps = [
      makeStep("COST_LINES_HECHURA", 500, { lineLabel: "Mano de obra", costLineId: "h1" }),
    ];
    // hechuraMarginPct=0 + hechuraSale ≠ hechuraCost (motor en MARGIN_TOTAL)
    // + composition.hechuras[0].lineSale === lineCost (colapsado).
    // unitCost=1500, basePrice=2000 (defaults de makeLine) → unifiedFactor ≈ 1.33
    const line = makeLine({
      metalHechuraBreakdown: {
        metalCost: 0, metalSale: 0,
        hechuraCost: 500, hechuraSale: 850, hechuraMarginPct: 0,
      } as any,
      composition: {
        hechuras: [{ costLineId: "h1", lineSale: 500, lineLabel: "Mano de obra" }],
      } as any,
    });
    render(
      <PriceCompositionCards
        steps={steps} line={line} result={null}
        expanded={{ hechura: true }} onToggle={() => {}}
      />
    );
    // El subtítulo ya no se renderiza.
    expect(screen.queryByText(/Valor de costo · margen aplicado al total del artículo/i))
      .toBeNull();
    // En su lugar, la fila muestra fórmula `cost × factor = venta` con
    // unifiedFactor = 2000/1500 ≈ 1.33, y el monto de la derecha pasa de
    // ser lineCost ($500) a lineCost × unifiedFactor ($666,67).
    const matches = screen.getAllByText((_content, node) => {
      if (!node || node.tagName !== "P") return false;
      const txt = node.textContent ?? "";
      return /\$500,00/.test(txt) && /1[.,]33/.test(txt) && /\$666,67/.test(txt);
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("Modo desglosado (mpct > 0, sale > cost) → NO muestra el subtítulo (mantiene comportamiento original)", () => {
    const steps = [
      makeStep("COST_LINES_HECHURA", 500, { lineLabel: "Mano de obra", costLineId: "h1" }),
    ];
    const line = makeLine({
      metalHechuraBreakdown: {
        metalCost: 0, metalSale: 0,
        hechuraCost: 500, hechuraSale: 800, hechuraMarginPct: 60,
      } as any,
      composition: {
        hechuras: [{ costLineId: "h1", lineSale: 800, lineLabel: "Mano de obra" }],
      } as any,
    });
    render(
      <PriceCompositionCards
        steps={steps} line={line} result={null}
        expanded={{ hechura: true }} onToggle={() => {}}
      />
    );
    expect(screen.queryByText(/Valor de costo · margen aplicado al total del artículo/i))
      .toBeNull();
  });

  it("Modo MARGIN_TOTAL con margen 0% literal (sale === cost) → NO muestra el subtítulo (no es modo derivado)", () => {
    const steps = [
      makeStep("COST_LINES_HECHURA", 500, { lineLabel: "Mano de obra", costLineId: "h1" }),
    ];
    const line = makeLine({
      metalHechuraBreakdown: {
        metalCost: 0, metalSale: 0,
        hechuraCost: 500, hechuraSale: 500, hechuraMarginPct: 0,
      } as any,
      composition: {
        hechuras: [{ costLineId: "h1", lineSale: 500, lineLabel: "Mano de obra" }],
      } as any,
    });
    render(
      <PriceCompositionCards
        steps={steps} line={line} result={null}
        expanded={{ hechura: true }} onToggle={() => {}}
      />
    );
    expect(screen.queryByText(/Valor de costo · margen aplicado al total del artículo/i))
      .toBeNull();
  });
});

describe("MetalSaleCard — Origen: desglose de gramos auditable (2 pasos)", () => {
  // Caso real del usuario. metalCost/metalSale = 100/185 → factor 1,85.
  function metalStep(meta: Record<string, unknown>) {
    return makeStep("COST_LINES_METAL", 100, meta);
  }
  const steps: PricingStepResult[] = [
    metalStep({ metalId: "au", metalName: "Oro", metalSymbol: "Au",
      variantId: "v-cha", variantName: "Chafalonía 18 Kilates", variantSku: "CH18K",
      qty: 1.10, purity: 0.700, merma: 0, quotePrice: 100 }),
    metalStep({ metalId: "au", metalName: "Oro", metalSymbol: "Au",
      variantId: "v-18", variantName: "Oro 18 Kilates", variantSku: "AU18K",
      qty: 1.20, purity: 0.750, merma: 10, quotePrice: 100 }),
    metalStep({ metalId: "au", metalName: "Oro", metalSymbol: "Au",
      variantId: "v-22", variantName: "Oro 22 Kilates", variantSku: "AU22K",
      qty: 1.30, purity: 0.900, merma: 0, quotePrice: 100 }),
    metalStep({ metalId: "au", metalName: "Oro", metalSymbol: "Au",
      variantId: "v-24", variantName: "Oro 24 Kilates", variantSku: "AU24K",
      qty: 1.40, purity: 1.000, merma: 0, quotePrice: 100 }),
    metalStep({ metalId: "ag", metalName: "Plata", metalSymbol: "Ag",
      variantId: "v-ag", variantName: "Plata - Granalla", variantSku: "AG100",
      qty: 1.40, purity: 1.000, merma: 20, quotePrice: 100 }),
  ];
  const line = makeLine({
    metalHechuraBreakdown: { metalCost: 100, metalSale: 185, hechuraCost: 0, hechuraSale: 0 } as any,
  });

  function renderExpanded() {
    return render(
      <PriceCompositionCards
        steps={steps} line={line} result={null}
        expanded={{ "metalPrice-0": true, "metalPrice-1": true }}
        onToggle={() => {}}
      />,
    );
  }

  it("ORO: paso 1 (gr × ley [× merma]) y paso 2 (× factor) por variante", () => {
    const { container } = renderExpanded();
    const txt = container.textContent ?? "";
    // Chafalonía — sin merma.
    expect(txt).toContain("1,10 gr × ley 0,700 = 0,77 gr");
    expect(txt).toContain("0,77 gr × factor 1,85 = 1,42 gr");
    // Oro 18K — con merma 10%.
    expect(txt).toContain("1,20 gr × ley 0,750 × merma 10% = 0,99 gr");
    expect(txt).toContain("0,99 gr × factor 1,85 = 1,83 gr");
    // Oro 22K / 24K.
    expect(txt).toContain("1,30 gr × ley 0,900 = 1,17 gr");
    expect(txt).toContain("1,17 gr × factor 1,85 = 2,16 gr");
    expect(txt).toContain("1,40 gr × ley 1,000 = 1,40 gr");
    expect(txt).toContain("1,40 gr × factor 1,85 = 2,59 gr");
  });

  it("ORO: total de la card auditable = suma de gramos finales (8,01 gr)", () => {
    const { container } = renderExpanded();
    const txt = container.textContent ?? "";
    expect(txt).toContain("1,42 + 1,83 + 2,16 + 2,59");
    // Header de la card Oro.
    expect(screen.getAllByText(/8,01\s*gr/).length).toBeGreaterThanOrEqual(1);
  });

  it("PLATA: única variante con merma 20% → 3,11 gr (sin lista de suma)", () => {
    const { container } = renderExpanded();
    const txt = container.textContent ?? "";
    expect(txt).toContain("1,40 gr × ley 1,000 × merma 20% = 1,68 gr");
    expect(txt).toContain("1,68 gr × factor 1,85 = 3,11 gr");
    expect(screen.getAllByText(/3,11\s*gr/).length).toBeGreaterThanOrEqual(1);
  });

  it("NO muestra cálculo monetario de venta por variante (solo gramos)", () => {
    const { container } = renderExpanded();
    // El antiguo "X gr × $/gr = $..." no debe aparecer.
    expect(container.textContent ?? "").not.toMatch(/gr\s*×\s*\$/);
  });
});
