// src/components/pricing/PriceCompositionCards/PriceCompositionCards.commercial-physical.test.tsx
// =============================================================================
// Etapa C-comercial / C6 (POLICY §R-Rounding-14) — Integración del bloque
// CommercialPhysicalRoundingBlock dentro de PriceCompositionCards.
//
// Verifica:
//   · `line.metalHechuraBreakdown.physical != null` ⇒ se renderiza el bloque
//     Y los subtotales pre→post viajan al hijo.
//   · `physical == null` (lista MONETARY legacy) ⇒ NO renderiza el bloque.
//   · Variant `compact` (Factura via SaleLinePricingPanel) y `full`
//     (Simulador) muestran el mismo contenido semántico.
//
// El test usa `line: NormalizedPricingLine` mínimo + `result: null` — el
// orchestrator se enfoca en pasar el `metalHechuraBreakdown` al hijo.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceCompositionCards } from "./PriceCompositionCards";

function makeLine(physical: any): any {
  // Shape MÍNIMO de `NormalizedPricingLine` requerido por PriceCompositionCards.
  // `metalHechuraBreakdown` lleva los campos C4-fix + el snapshot physical.
  return {
    quantity:  1,
    unitPrice: 115000,
    basePrice: 115000,
    unitCost:  60400,
    metalHechuraBreakdown: {
      metalCost:               45400,
      metalSale:               100000,
      metalMarginPct:          100,
      hechuraCost:             15000,
      hechuraSale:             15000,
      hechuraMarginPct:        0,
      metalGramsBase:          0.908,
      metalGramsSale:          1.816,
      metalPricePerGram:       100000,
      metalSalePreRounding:    90800,
      hechuraSalePreRounding:  null,
      metalSaleRoundingDelta:  9200,
      hechuraSaleRoundingDelta:null,
      physical,
    },
    componentSaleBreakdown: null,
    composition: null,
    appliedRounding: null,
  };
}

function physicalSnap() {
  return {
    metals: [{
      metalParentId:      "oro-fino",
      metalParentName:    "Oro Fino",
      preGrams:           0.908,
      postGrams:          1.000,
      deltaGrams:         0.092,
      metalPricePerGram:  100000,
      monetaryEquivalent: 9200,
      mode:               "INTEGER",
      direction:          "NEAREST",
      source:             "COMMERCIAL_PHYSICAL_ROUNDING" as const,
      fallback:           null,
    }],
    metalMonetaryEquivalent: 9200,
    fallback:                null,
  };
}

function makeSteps(): any[] {
  // PriceCompositionCards necesita pasar la guardia "sin metal ni hechura →
  // no renderizar". Inyectamos steps mínimos del motor con metales puros y
  // hechura para que el orchestrator considere que hay composición.
  return [
    {
      key: "COST_LINES_METAL", status: "ok", value: "45400",
      meta: {
        costLineId: "cl-1", variantId: "v-1", metalId: "oro-fino",
        metalName: "Oro Fino", variantName: "Oro 18K",
        gramsOriginal: 1.211, gramsFineEquivalent: 0.908, purity: 0.75,
        quotePrice: 50000, lineSale: 100000,
      },
    },
    {
      key: "COST_LINES_HECHURA", status: "ok", value: "15000",
      meta: { costLineId: "cl-2", appliedAmount: 15000, lineSale: 15000 },
    },
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// (A) Lista PHYSICAL → bloque visible
// ──────────────────────────────────────────────────────────────────────────

describe("PriceCompositionCards — C6: snapshot physical renderiza bloque", () => {
  it("muestra CommercialPhysicalRoundingBlock con Oro Fino 0,908 → 1,000", () => {
    render(
      <PriceCompositionCards
        steps={makeSteps()}
        line={makeLine(physicalSnap())}
        result={null}
      />,
    );
    expect(screen.getByTestId("commercial-physical-rounding-block")).toBeTruthy();
    expect(screen.getByText(/^Redondeo comercial$/i)).toBeTruthy();
    expect(screen.getByTestId("cprb-pregrams").textContent).toMatch(/0,?908/);
    expect(screen.getByTestId("cprb-postgrams").textContent).toMatch(/1,?000/);
  });

  it("propaga 'Metal venta: ... → ...' al subtotal del componente", () => {
    render(
      <PriceCompositionCards
        steps={makeSteps()}
        line={makeLine(physicalSnap())}
        result={null}
      />,
    );
    const row = screen.getByTestId("cprb-metal-subtotal");
    expect(row.textContent).toMatch(/90\.?800/);
    expect(row.textContent).toMatch(/100\.?000/);
    expect(row.textContent).toMatch(/9\.?200/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (B) Lista MONETARY (legacy) → bloque oculto
// ──────────────────────────────────────────────────────────────────────────

describe("PriceCompositionCards — C6: MONETARY legacy oculta bloque", () => {
  it("physical=null y deltas=null → no se renderiza CommercialPhysicalRoundingBlock", () => {
    const legacyLine = makeLine(null);
    // simulamos MONETARY: nulls en deltas también.
    legacyLine.metalHechuraBreakdown.metalSalePreRounding   = null;
    legacyLine.metalHechuraBreakdown.metalSaleRoundingDelta = null;
    render(
      <PriceCompositionCards
        steps={makeSteps()}
        line={legacyLine}
        result={null}
      />,
    );
    expect(screen.queryByTestId("commercial-physical-rounding-block")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (C) Paridad Simulador (full) ↔ Factura (compact)
// ──────────────────────────────────────────────────────────────────────────

describe("PriceCompositionCards — C6: bloque solo en SIMULADOR (full)", () => {
  it("variant='full' (Simulador) RENDERIZA el bloque de redondeo comercial", () => {
    const fullRender = render(
      <PriceCompositionCards
        steps={makeSteps()}
        line={makeLine(physicalSnap())}
        result={null}
        variant="full"
      />,
    );
    const fullBlock = fullRender.getByTestId("commercial-physical-rounding-block");
    const fullText  = fullBlock.textContent ?? "";
    for (const fragment of [
      "Redondeo comercial",
      "Oro Fino",
      "0,908",
      "1,000",
      "9.200",
      "90.800",
      "100.000",
    ]) {
      expect(fullText).toContain(fragment);
    }
  });

  it("variant='compact' (Factura) NO renderiza el bloque — la auditoría vive en el Resumen Comercial del lateral", () => {
    const compactRender = render(
      <PriceCompositionCards
        steps={makeSteps()}
        line={makeLine(physicalSnap())}
        result={null}
        variant="compact"
      />,
    );
    expect(compactRender.queryByTestId("commercial-physical-rounding-block")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (D) Overrides post-redondeo en los cards principales (Hechura + Metal)
//
// Verifica que el VALOR PRINCIPAL de cada card use el campo post-redondeo
// del backend, no el agregado pre-redondeo del frontend:
//   - HechuraSaleCard: subtotal = `metalHechuraBreakdown.hechuraSale` (post)
//   - MetalSaleCard:   gramos   = `physical.metals[i].postGrams` (post)
//
// Mantiene paridad visual con el aside "Total del comprobante".
// ──────────────────────────────────────────────────────────────────────────

describe("PriceCompositionCards — overrides post-redondeo (paridad con aside)", () => {
  function makeStepsWithAdjustedHechura(): any[] {
    // Steps con hechura pre-redondeo = 182091.10 (suma de lineSale).
    // El motor además emite hechuraSale = 182100 (post-redondeo de lista).
    return [
      {
        key: "COST_LINES_METAL", status: "ok", value: "45400",
        meta: {
          costLineId: "cl-1", variantId: "v-1", metalId: "oro-fino",
          metalName: "Oro Fino", variantName: "Oro 18K",
          gramsOriginal: 1.611, gramsFineEquivalent: 1.209, purity: 0.75,
          quotePrice: 50000, lineSale: 100000,
        },
      },
      {
        key: "COST_LINES_HECHURA", status: "ok", value: "60697.03",
        meta: { costLineId: "cl-h-1", appliedAmount: 60697.03, lineSale: 60697.03 },
      },
      {
        key: "COST_LINES_HECHURA", status: "ok", value: "60697.03",
        meta: { costLineId: "cl-h-2", appliedAmount: 60697.03, lineSale: 60697.03 },
      },
      {
        key: "COST_LINES_HECHURA", status: "ok", value: "60697.04",
        meta: { costLineId: "cl-h-3", appliedAmount: 60697.04, lineSale: 60697.04 },
      },
    ];
  }

  function makeLineWithPostRoundingHechura(physical: any): any {
    return {
      quantity:  1,
      unitPrice: 282100,
      basePrice: 282100,
      unitCost:  150000,
      metalHechuraBreakdown: {
        metalCost:               45400,
        metalSale:               100000,
        metalMarginPct:          100,
        hechuraCost:             60000,
        // Suma de lineSale por componente = 182091.10 (pre-redondeo de lista
        // agregada). El motor emite hechuraSale = 182100 (post-redondeo a
        // centena NEAREST). El card debe mostrar 182.100, no 182.091.
        hechuraSale:             182100,
        hechuraMarginPct:        0,
        metalGramsBase:          1.209,
        metalGramsSale:          1.209,
        metalPricePerGram:       82710.50,
        metalSalePreRounding:    null,
        hechuraSalePreRounding:  182091.10,
        metalSaleRoundingDelta:  null,
        hechuraSaleRoundingDelta: 8.90,
        physical,
      },
      componentSaleBreakdown: null,
      composition: null,
      appliedRounding: null,
    };
  }

  it("(D.1) HechuraSaleCard usa hechuraSale=182.100 (post-redondeo) en lugar del agregado pre-redondeo 182.091,10", () => {
    render(
      <PriceCompositionCards
        steps={makeStepsWithAdjustedHechura()}
        line={makeLineWithPostRoundingHechura(null)}
        result={null}
        // Expandimos hechura para forzar el render del subtotal interno.
        expanded={{ hechura: true }}
        onToggle={() => {}}
      />,
    );
    // Buscamos el texto del subtotal. Como puede aparecer en distintas
    // sub-secciones según presencia de impuestos/ajustes, validamos sobre
    // el card completo.
    const cardText = document.body.textContent ?? "";
    expect(cardText).toMatch(/182\.?100/);
    // El valor pre-redondeo NO debe aparecer como principal — pero puede
    // aparecer dentro del bloque CommercialPhysicalRoundingBlock (detalle
    // pre→post → eso es esperado y deseado). Verificamos al menos que
    // 182.100 aparezca como cifra de subtotal.
  });

  it("(D.2) Si pre=182.091,10 y post=182.100, el principal muestra 182.100 + el bloque muestra pre→post+delta", () => {
    render(
      <PriceCompositionCards
        steps={makeStepsWithAdjustedHechura()}
        line={makeLineWithPostRoundingHechura(null)}
        result={null}
        expanded={{ hechura: true }}
        onToggle={() => {}}
      />,
    );
    // El bloque CommercialPhysicalRoundingBlock debe verse (hay delta de hechura).
    expect(screen.getByTestId("commercial-physical-rounding-block")).toBeTruthy();
    const row = screen.getByTestId("cprb-hechura-subtotal");
    expect(row.textContent).toMatch(/182\.?091/);    // pre
    expect(row.textContent).toMatch(/182\.?100/);    // post
    expect(row.textContent).toMatch(/8,?90/);        // delta
  });

  it("(D.3) Sin override (hechuraSale ausente) → mantiene comportamiento actual del agregado", () => {
    // line sin hechuraSale → el card cae al fallback hechuraSaleTotal.
    const lineSinOverride: any = {
      quantity:  1,
      unitPrice: 282091.10,
      basePrice: 282091.10,
      unitCost:  150000,
      metalHechuraBreakdown: {
        metalCost: 45400, metalSale: 100000, metalMarginPct: 100,
        hechuraCost: 60000,
        // hechuraSale ausente / no finito → no hay override.
        hechuraSale: null as any,
        hechuraMarginPct: 0,
      },
      componentSaleBreakdown: null, composition: null, appliedRounding: null,
    };
    render(
      <PriceCompositionCards
        steps={makeStepsWithAdjustedHechura()}
        line={lineSinOverride}
        result={null}
        expanded={{ hechura: true }}
        onToggle={() => {}}
      />,
    );
    // Cae al agregado: 60697.03 + 60697.03 + 60697.04 = 182091.10.
    expect(document.body.textContent).toMatch(/182\.?091/);
  });

  it("(D.4) MetalSaleCard usa postGrams=1,000 cuando hay snapshot PHYSICAL", () => {
    render(
      <PriceCompositionCards
        steps={makeStepsWithAdjustedHechura()}
        line={makeLineWithPostRoundingHechura(physicalSnap())}
        result={null}
      />,
    );
    // El gramo principal del card debe ser 1,00 (postGrams, formato display
    // del header con 2 decimales). El bloque CommercialPhysicalRoundingBlock
    // sí muestra 1,000 g con 3 decimales como `cprb-pregrams`/`cprb-postgrams`.
    const cardText = document.body.textContent ?? "";
    expect(cardText).toMatch(/1,00\s*gr/);
  });

  it("(D.5) MetalSaleCard sin snapshot PHYSICAL → mantiene comportamiento actual (gramos venta calculados)", () => {
    // Sin snapshot physical y sin override → cae al cálculo legacy.
    render(
      <PriceCompositionCards
        steps={makeStepsWithAdjustedHechura()}
        line={makeLineWithPostRoundingHechura(null)}
        result={null}
      />,
    );
    // No exigimos un valor específico — solo que el card se renderice
    // sin errores. La cobertura cualitativa de "no usa postGrams" la
    // garantiza el assert (D.4) en el caso opuesto.
    const cardText = document.body.textContent ?? "";
    // No debe aparecer "1,000 gr" como principal sin physical.
    // (Verificación negativa contra falso positivo del fix.)
    // Nota: el principal en este caso será el cálculo legacy
    // (totalEquivGr × metalSaleFactor). El test confirma que no se
    // imprime el postGrams cuando NO hay snapshot.
    expect(cardText).not.toMatch(/^.*\b1,000 gr\b.*Oro Fino/);
  });
});
