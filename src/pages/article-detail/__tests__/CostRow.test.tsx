// src/pages/article-detail/__tests__/CostRow.test.tsx
// ============================================================================
// FASE 10.2 — Tests del salvavidas defensivo de ProductSelector.
//
// Bug original: al reabrir el modal de un combo comercial, la columna
// "Descripción / Variante" se borraba después del primer render aunque la
// composición estuviera persistida con catalogItemId/catalogVariantId. Causa:
// race entre la carga async de variantes y el render del combo. La option
// con value="<art>::<var>" no existía en flatOptions hasta que la cache
// completaba, y TPComboFixed mostraba el placeholder.
//
// Fix: option sintética inyectada AL FINAL de flatOptions cuando currentValue
// existe pero no matchea ninguna option real. Usa line.label como fallback.
// Cuando la option real existe (caso normal), va PRIMERO en el array y
// `find()` la prioriza — la sintética queda inactiva.
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductSelector } from "../CostRow";
import type { CostLine, ArticleVariant } from "../../../services/articles";
import type { ProductItem } from "../CostRow";

const noop = () => {};
const fmtN = (n: number) => n.toFixed(2);

const baseCurrencyId = "ars-id";
const currencyOptions = [
  { id: "ars-id", code: "ARS", name: "Peso", symbol: "$",
    isBase: true, isActive: true, latestRate: null, latestAt: null } as any,
];

function makeLine(o: Partial<CostLine> = {}): CostLine {
  return {
    id:               "line-1",
    type:             "PRODUCT",
    label:            "",
    quantity:         1,
    quantityUnit:     "u",
    unitValue:        100,
    currencyId:       null,
    mermaPercent:     null,
    metalVariantId:   null,
    catalogItemId:    null,
    catalogVariantId: null,
    sortOrder:        0,
    lineAdjKind:      "",
    lineAdjType:      "",
    lineAdjValue:     null,
    ...o,
  };
}

function renderSelector(opts: {
  line: CostLine;
  productItems?: ProductItem[];
  variantsCache?: Record<string, ArticleVariant[]>;
}) {
  const variantsCache = opts.variantsCache ?? {};
  return render(
    <ProductSelector
      line={opts.line}
      productItems={opts.productItems ?? []}
      currencyOptions={currencyOptions}
      baseCurrencyId={baseCurrencyId}
      selSym="$"
      onPatch={noop}
      getVariantsForArticle={(id) => variantsCache[id]}
      loadVariantsForArticle={noop}
      submitted={false}
      fmtN={fmtN}
    />
  );
}

// El input del trigger del combo es el primer <input> del wrapper. Helper
// que lo aísla para que los asserts no dependan del orden interno del DOM.
function comboInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input') as HTMLInputElement;
}

describe("<ProductSelector /> — salvavidas defensivo (FASE 10.2)", () => {
  it("Caso A — sin productItems ni cache, la option sintética rescata line.label", () => {
    const { container } = renderSelector({
      line: makeLine({
        catalogItemId:    "art-X",
        catalogVariantId: "var-Y",
        label:            "Anillo Oro — 18kt",
      }),
      productItems: [],
      variantsCache: {},
    });
    expect(comboInput(container).value).toBe("Anillo Oro — 18kt");
  });

  it("Caso B — con option real disponible, el label real gana sobre line.label viejo", () => {
    const { container } = renderSelector({
      line: makeLine({
        catalogItemId:    "art-X",
        catalogVariantId: "var-Y",
        label:            "LABEL_VIEJO_DESACTUALIZADO",
      }),
      productItems: [
        { id: "art-X", name: "Anillo Oro", costPrice: 1000,
          manualCurrencyId: null, mainImageUrl: "" },
      ],
      variantsCache: {
        "art-X": [
          { id: "var-Y", name: "18kt" } as any,
        ],
      },
    });
    // La option real "Anillo Oro — 18kt" gana porque va antes en el array
    // que la sintética. TPComboFixed.find() devuelve la primera coincidencia.
    expect(comboInput(container).value).toBe("Anillo Oro — 18kt");
  });

  it("Caso C — variantes que llegan tarde: pasa de line.label a label real al re-render", () => {
    const line = makeLine({
      catalogItemId:    "art-X",
      catalogVariantId: "var-Y",
      label:            "Anillo Oro 18kt",
    });
    const productItems = [
      { id: "art-X", name: "Anillo Oro", costPrice: 1000,
        manualCurrencyId: null, mainImageUrl: "" },
    ];

    // Primer render: cache vacía → la sintética muestra line.label.
    let cacheRef: Record<string, ArticleVariant[]> = {};
    const { container, rerender } = render(
      <ProductSelector
        line={line}
        productItems={productItems}
        currencyOptions={currencyOptions}
        baseCurrencyId={baseCurrencyId}
        selSym="$"
        onPatch={noop}
        getVariantsForArticle={(id) => cacheRef[id]}
        loadVariantsForArticle={noop}
        submitted={false}
        fmtN={fmtN}
      />
    );
    expect(comboInput(container).value).toBe("Anillo Oro 18kt");

    // Variantes async resuelven, cache se actualiza, el padre re-renderiza
    // (en producción esto lo dispara el bump de variantsCacheVersion).
    cacheRef = { "art-X": [{ id: "var-Y", name: "18kt" } as any] };
    rerender(
      <ProductSelector
        line={line}
        productItems={productItems}
        currencyOptions={currencyOptions}
        baseCurrencyId={baseCurrencyId}
        selSym="$"
        onPatch={noop}
        getVariantsForArticle={(id) => cacheRef[id]}
        loadVariantsForArticle={noop}
        submitted={false}
        fmtN={fmtN}
      />
    );
    // Ahora gana la option real construida desde productItems × variants.
    expect(comboInput(container).value).toBe("Anillo Oro — 18kt");
  });

  it("Línea nueva (catalogItemId=null) no inyecta sintética — muestra 'Seleccionar producto...'", () => {
    const { container } = renderSelector({
      line: makeLine({ catalogItemId: null, catalogVariantId: null, label: "" }),
      productItems: [],
    });
    // currentValue="" matchea la option {value:"", label:"Seleccionar producto..."}
    // del array de options del combo. El input muestra ese label — y NO una
    // option sintética (que no se generó porque catalogItemId es null).
    expect(comboInput(container).value).toBe("Seleccionar producto...");
  });

  it("line.label vacío + artículo en productItems → fallback a productItems.name", () => {
    const { container } = renderSelector({
      line: makeLine({
        catalogItemId:    "art-X",
        catalogVariantId: "var-Y",
        label:            "",   // legacy: combo guardado sin label
      }),
      productItems: [
        { id: "art-X", name: "Cadena Plata", costPrice: 200,
          manualCurrencyId: null, mainImageUrl: "" },
      ],
      variantsCache: {},
    });
    // Sin label persistido pero con artículo en catálogo → muestra el nombre
    // del artículo. El sublabel "Información completa cargando…" señala
    // que la variante específica no está resuelta todavía.
    expect(comboInput(container).value).toBe("Cadena Plata");
  });

  it("ningún fallback disponible → muestra '(componente)' como último recurso", () => {
    const { container } = renderSelector({
      line: makeLine({
        catalogItemId:    "art-fantasma",
        catalogVariantId: "var-fantasma",
        label:            "",
      }),
      productItems: [],
      variantsCache: {},
    });
    expect(comboInput(container).value).toBe("(componente)");
  });
});

// ============================================================================
// Filtro de combos en la composición de COSTO del modal de Artículos.
// El selector "Descripción / Variante" NUNCA debe ofrecer combos comerciales
// como componente — SIEMPRE, sin importar el modo del artículo que se edita.
// ============================================================================
describe("<ProductSelector /> — excluye combos del dropdown SIEMPRE", () => {
  function renderSel(catalogItemId: string, label: string) {
    return render(
      <ProductSelector
        line={makeLine({ catalogItemId, catalogVariantId: null, label })}
        productItems={[
          { id: "combo-X", name: "COMBO REAL", costPrice: 514352.43,
            manualCurrencyId: null, mainImageUrl: "", commercialMode: "COMBO_COMMERCIAL" },
          { id: "prod-1", name: "Producto Normal", costPrice: 1000,
            manualCurrencyId: null, mainImageUrl: "", commercialMode: "NORMAL" },
        ]}
        currencyOptions={currencyOptions}
        baseCurrencyId={baseCurrencyId}
        selSym="$"
        onPatch={noop}
        getVariantsForArticle={() => undefined}
        loadVariantsForArticle={noop}
        submitted={false}
        fmtN={fmtN}
      />
    );
  }

  it("el combo NO es opción del dropdown (filtro incondicional → cae a la sintética)", () => {
    // line apunta al combo: como fue excluido de las opciones, no hay match
    // real → la option sintética muestra line.label (no el nombre del combo).
    const { container } = renderSel("combo-X", "FALLBACK_COMBO");
    expect(comboInput(container).value).toBe("FALLBACK_COMBO");
  });

  it("los productos normales SÍ aparecen como opción", () => {
    const { container } = renderSel("prod-1", "FALLBACK_PROD");
    // 'Producto Normal' no se filtra → es opción real → el input lo muestra.
    expect(comboInput(container).value).toBe("Producto Normal");
  });
});

// Sanity: el helper vi.fn no se usa pero el import de vi se mantiene por si
// se agregan tests con spies más adelante.
void vi;
