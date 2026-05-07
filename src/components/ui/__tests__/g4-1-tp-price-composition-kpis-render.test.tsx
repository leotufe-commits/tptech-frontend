// src/components/ui/__tests__/g4-1-tp-price-composition-kpis-render.test.tsx
// =============================================================================
// FASE F1.3 G4.1 #8 — render visual de PRODUCT/SERVICE + Pre-bonif.
//
// Cubre TODAS las validaciones del usuario:
//   · no products/services → no render
//   · 1 product → render bloque PRODUCTO
//   · 2 products → render 2 bloques
//   · 1 service → render bloque SERVICIO
//   · lineAdjKind BONUS → muestra Bonif. con monto emerald
//   · lineAdjKind SURCHARGE → muestra Recargo con monto amber
//   · affectsStock=true → muestra Stock: Descuenta
//   · Pre-bonif. aparece solo cuando pre != final y hay ajuste manual
//   · Pre-bonif. NO aparece si pre == final
//   · snapshots viejos sin campos nuevos no crashean
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TPPriceCompositionKpis from "../TPPriceCompositionKpis";
import type {
  TPCompositionInput,
  TPComponentSaleDetailInput,
} from "../TPPriceCompositionKpis";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMinimalProps(overrides: {
  composition?: TPCompositionInput;
  componentSaleBreakdown?: TPComponentSaleDetailInput;
} = {}) {
  return {
    composition: overrides.composition ?? {
      metal: null,
      hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
      taxes: [],
    },
    metalHechuraBreakdown: {
      metalCost: 0, metalSale: 0, metalMarginPct: 0,
      hechuraCost: 100, hechuraSale: 100, hechuraMarginPct: 0,
    },
    componentSaleBreakdown: overrides.componentSaleBreakdown,
    total: 100,
    subtotal: 100,
    taxAmount: 0,
    currencySymbol: "ARS",
    view: "sale" as const,
    priceListMode: "METAL_HECHURA",
  };
}

// =============================================================================
// 1. PRODUCTOS / SERVICIOS — render condicional
// =============================================================================

describe("F1.3 G4.1 #8 — render PRODUCT / SERVICE", () => {
  it("baseline correct: no products / services → no render de cards", () => {
    render(<TPPriceCompositionKpis {...makeMinimalProps()} />);
    expect(screen.queryByText("PRODUCTO")).toBeNull();
    expect(screen.queryByText("SERVICIO")).toBeNull();
  });

  it("baseline correct: 1 product → render 1 bloque PRODUCTO con name + total", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
            products: [{
              costLineId: "cl-p1",
              catalogItemId: "art-P",
              catalogItemCode: "ZAF-01",
              catalogItemName: "Zafiro 0.5ct",
              quantity: 2, unitValue: 50, totalValue: 100,
              currencyId: null,
              lineAdjKind: null, lineAdjType: null,
              lineAdjValue: null, lineAdjAmount: null,
              affectsStock: null,
            }],
            services: [],
            taxes: [],
          },
        })}
      />,
    );
    expect(screen.getByText("PRODUCTO")).toBeInTheDocument();
    expect(screen.getByText("Zafiro 0.5ct")).toBeInTheDocument();
    // catalogItemCode aparece como headingSub.
    expect(screen.getByText("ZAF-01")).toBeInTheDocument();
    // Total display.
    expect(screen.getAllByText(/ARS 100/).length).toBeGreaterThan(0);
  });

  it("baseline correct: 2 products → render 2 bloques PRODUCTO", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
            products: [
              {
                costLineId: "cl-p1", catalogItemId: "art-P1",
                catalogItemCode: "ZAF-01", catalogItemName: "Zafiro 0.5ct",
                quantity: 2, unitValue: 50, totalValue: 100,
                currencyId: null,
                lineAdjKind: null, lineAdjType: null,
                lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
              },
              {
                costLineId: "cl-p2", catalogItemId: "art-P2",
                catalogItemCode: "RUB-02", catalogItemName: "Rubí 0.3ct",
                quantity: 1, unitValue: 80, totalValue: 80,
                currencyId: null,
                lineAdjKind: null, lineAdjType: null,
                lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
              },
            ],
            services: [],
            taxes: [],
          },
        })}
      />,
    );
    expect(screen.getAllByText("PRODUCTO")).toHaveLength(2);
    expect(screen.getByText("Zafiro 0.5ct")).toBeInTheDocument();
    expect(screen.getByText("Rubí 0.3ct")).toBeInTheDocument();
  });

  it("baseline correct: 1 service → render bloque SERVICIO", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
            products: [],
            services: [{
              costLineId: "cl-s1", catalogItemId: "art-S",
              catalogItemCode: "ENG-01", catalogItemName: "Engaste profesional",
              quantity: 1, unitValue: 80, totalValue: 80,
              currencyId: null,
              lineAdjKind: null, lineAdjType: null,
              lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
            }],
            taxes: [],
          },
        })}
      />,
    );
    expect(screen.getByText("SERVICIO")).toBeInTheDocument();
    expect(screen.getByText("Engaste profesional")).toBeInTheDocument();
    expect(screen.queryByText("PRODUCTO")).toBeNull();
  });
});

// =============================================================================
// 2. AJUSTES — BONUS / SURCHARGE / affectsStock
// =============================================================================

describe("F1.3 G4.1 #8 — ajustes per item", () => {
  it("baseline correct: lineAdjKind=BONUS → 'Bonif. X%' con monto emerald y signo −", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
            products: [{
              costLineId: "cl-p1", catalogItemId: "art-P",
              catalogItemCode: "ZAF-01", catalogItemName: "Zafiro",
              quantity: 1, unitValue: 100, totalValue: 95,
              currencyId: null,
              lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE",
              lineAdjValue: 5, lineAdjAmount: 5, affectsStock: null,
            }],
            services: [], taxes: [],
          },
        })}
      />,
    );
    expect(screen.getByText("Bonif. 5%")).toBeInTheDocument();
    // Monto emerald: la celda tiene la clase emerald.
    const minus = screen.getByText(/^−/);
    expect(minus.className).toMatch(/emerald/);
  });

  it("baseline correct: lineAdjKind=SURCHARGE → 'Recargo X%' con monto amber y signo +", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
            products: [],
            services: [{
              costLineId: "cl-s1", catalogItemId: "art-S",
              catalogItemCode: "ENG-01", catalogItemName: "Engaste",
              quantity: 1, unitValue: 80, totalValue: 100,
              currencyId: null,
              lineAdjKind: "SURCHARGE", lineAdjType: "PERCENTAGE",
              lineAdjValue: 25, lineAdjAmount: 20, affectsStock: null,
            }],
            taxes: [],
          },
        })}
      />,
    );
    expect(screen.getByText("Recargo 25%")).toBeInTheDocument();
    const plus = screen.getByText(/^\+/);
    expect(plus.className).toMatch(/amber/);
  });

  it("baseline correct: lineAdjKind=BONUS sin lineAdjAmount → no muestra fila bonif. (passthrough estricto)", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
            products: [{
              costLineId: "cl-p1", catalogItemId: "art-P",
              catalogItemCode: "X", catalogItemName: "Item",
              quantity: 1, unitValue: 100, totalValue: 100,
              currencyId: null,
              lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE",
              lineAdjValue: 5,
              lineAdjAmount: null,   // backend no lo emite
              affectsStock: null,
            }],
            services: [], taxes: [],
          },
        })}
      />,
    );
    // No hay fila Bonif. — la UI no la deriva.
    expect(screen.queryByText(/Bonif\./)).toBeNull();
  });

  it("baseline correct: affectsStock=true → 'Stock: Descuenta'", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
            products: [{
              costLineId: "cl-p1", catalogItemId: "art-P",
              catalogItemCode: "X", catalogItemName: "Item",
              quantity: 1, unitValue: 100, totalValue: 100,
              currencyId: null,
              lineAdjKind: null, lineAdjType: null,
              lineAdjValue: null, lineAdjAmount: null,
              affectsStock: true,
            }],
            services: [], taxes: [],
          },
        })}
      />,
    );
    expect(screen.getByText("Stock")).toBeInTheDocument();
    expect(screen.getByText("Descuenta")).toBeInTheDocument();
  });

  it("baseline correct: affectsStock=false NO muestra fila Stock (cero ruido visual)", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
            products: [],
            services: [{
              costLineId: "cl-s1", catalogItemId: "art-S",
              catalogItemCode: "X", catalogItemName: "Servicio",
              quantity: 1, unitValue: 100, totalValue: 100,
              currencyId: null,
              lineAdjKind: null, lineAdjType: null,
              lineAdjValue: null, lineAdjAmount: null,
              affectsStock: false,
            }],
            taxes: [],
          },
        })}
      />,
    );
    expect(screen.queryByText("Stock")).toBeNull();
  });
});

// =============================================================================
// 3. Pre-bonif. — threshold visual
// =============================================================================

describe("F1.3 G4.3 #8 — fila Pre-bonif. con threshold visual", () => {
  it("baseline correct: pre != final + adjustment MANUAL_DISCOUNT → muestra fila Pre-bonif.", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 400, manual: false, appliesTo: null, originalAmount: 400 },
            products: [], services: [], taxes: [],
          },
          componentSaleBreakdown: {
            metal:   { base: 0,   final: 0,   salePreManualDiscount: 0,   adjustments: [] },
            hechura: {
              base: 400, final: 360, salePreManualDiscount: 400,
              adjustments: [
                { kind: "MANUAL_DISCOUNT", label: "Bonif", amount: 40, applyOn: "HECHURA" },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.getByText("Pre-bonif.")).toBeInTheDocument();
    // Tooltip wording correcto.
    const wrapper = screen.getByText("Pre-bonif.").closest("[title]");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute("title")).toBe(
      "Valor antes del ajuste manual del operador.",
    );
  });

  it("baseline correct: pre === final → NO muestra fila Pre-bonif.", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 400, manual: false, appliesTo: null, originalAmount: 400 },
            products: [], services: [], taxes: [],
          },
          componentSaleBreakdown: {
            metal:   { base: 0,   final: 0,   salePreManualDiscount: 0,   adjustments: [] },
            hechura: {
              base: 400, final: 360, salePreManualDiscount: 360,    // pre === final
              adjustments: [
                { kind: "MANUAL_DISCOUNT", label: "Bonif", amount: 40, applyOn: "HECHURA" },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.queryByText("Pre-bonif.")).toBeNull();
  });

  it("baseline correct: salePreManualDiscount=null (snapshot v3) → NO muestra fila", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 400, manual: false, appliesTo: null, originalAmount: 400 },
            products: [], services: [], taxes: [],
          },
          componentSaleBreakdown: {
            metal:   { base: 0,   final: 0,   adjustments: [] },
            hechura: {
              base: 400, final: 360,
              // sin salePreManualDiscount (v3)
              adjustments: [
                { kind: "MANUAL_DISCOUNT", label: "Bonif", amount: 40, applyOn: "HECHURA" },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.queryByText("Pre-bonif.")).toBeNull();
  });

  it("baseline correct: pre != final pero SIN adjustment MANUAL_DISCOUNT → NO muestra (defensa)", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 400, manual: false, appliesTo: null, originalAmount: 400 },
            products: [], services: [], taxes: [],
          },
          componentSaleBreakdown: {
            metal:   { base: 0,   final: 0,   salePreManualDiscount: 0,   adjustments: [] },
            hechura: {
              base: 400, final: 340, salePreManualDiscount: 360,
              adjustments: [
                // Solo customer rule — sin manual.
                { kind: "ENTITY_RULE", label: "Cliente", amount: 60, applyOn: "HECHURA" },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.queryByText("Pre-bonif.")).toBeNull();
  });
});

// =============================================================================
// 4. RETROCOMPAT — snapshots viejos sin campos nuevos no crashean
// =============================================================================

describe("F1.3 G4.x #8 — retrocompat snapshots viejos", () => {
  it("baseline correct: composition sin products/services → render OK sin crash", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          composition: {
            metal: null,
            hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
            // sin products / services
            taxes: [],
          },
        })}
      />,
    );
    expect(screen.queryByText("PRODUCTO")).toBeNull();
    expect(screen.queryByText("SERVICIO")).toBeNull();
    expect(screen.queryByText("HECHURA")).toBeInTheDocument();
  });

  it("baseline correct: componentSaleBreakdown sin salePreManualDiscount → no crashea", () => {
    render(
      <TPPriceCompositionKpis
        {...makeMinimalProps({
          componentSaleBreakdown: {
            metal:   { base: 100, final: 100, adjustments: [] },
            hechura: { base: 50,  final: 50,  adjustments: [] },
          },
        })}
      />,
    );
    expect(screen.queryByText("Pre-bonif.")).toBeNull();
  });
});
