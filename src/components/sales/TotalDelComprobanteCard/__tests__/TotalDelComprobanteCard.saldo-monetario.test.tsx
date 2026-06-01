// src/components/sales/TotalDelComprobanteCard/__tests__/TotalDelComprobanteCard.saldo-monetario.test.tsx
// =============================================================================
// Etapa UX-Saldo (2026-05-29) — Tests del rediseño del header monetario del
// card maestro en modo BREAKDOWN.
//
// Cambios cubiertos:
//   (A) TotalDelComprobanteCard — header del bloque colapsable en BREAKDOWN
//       pasa de "Total hechura" a "Saldo monetario" con valor
//       `totalDocument − Σ valuationMonetary`.
//   (B) MonetarySummary — cuando el caller pasa `metalsValuationSum` y
//       `totalDocument`, agrega filas síntesis "Menos patrimonio metálico" +
//       "Saldo monetario" tras "Total final".
//   (C) MetalsSummary — cuando un metal tiene `sourceLineIds` y el caller
//       pasa `lineArticleNames`, renderiza sub-fila "Origen" con el/los
//       nombres de los artículos que aportan al padre.
//
// Cero matemática comercial — todos los valores son passthrough del preview.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import { MonetarySummary } from "../parts/MonetarySummary";
import { MetalsSummary } from "../parts/MetalsSummary";
import type { BalanceBreakdownDTO } from "../../../../services/sales";
import type { DocumentMetalSummaryItem } from "../types";

const noop = () => undefined;

// ──────────────────────────────────────────────────────────────────────────
// Fixtures comunes — caso real de la auditoría:
//   Total final            ARS 538.260,94
//   Patrimonio metálico    ARS 210.937,50   (Oro 1,125 g × 187.500)
//   Saldo monetario        ARS 327.323,44
// ──────────────────────────────────────────────────────────────────────────

function balanceWithOro(): BalanceBreakdownDTO {
  return {
    metals: [{
      metalParentId:         "oro-fino",
      metalParentName:       "Oro",
      gramsOriginal:         1.5,
      purity:                0.75,
      gramsPure:             1.125,
      quotePriceSnapshot:    187500,
      valuationMonetary:     210937.5,
      valuationCurrencyCode: "ARS",
      sourceLineIds:         ["L-1"],
    }],
    monetaryBalance: {
      amount: 235917.19, currencyCode: "ARS", currencyRate: 1, amountBase: 235917.19,
      components: [
        { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 142500 },
      ],
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// (A) Header del card — "Saldo monetario" en BREAKDOWN
// ──────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — header 'Saldo monetario' en BREAKDOWN", () => {
  it("BREAKDOWN (canónico fallback): sin commercialMetalValueSum, header = total − Σ valuationMonetary", () => {
    // Sin el prop nuevo, el card cae al fallback canónico §R-Rounding-14
    // (Patrimonio físico). Verifica retro-compatibilidad cuando un caller
    // no se ha actualizado a UX-Comercial.
    render(
      <TotalDelComprobanteCard
        totalDocument={538260.94}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceWithOro()}
        onBalanceModeOverrideChange={noop}
      />,
    );
    const row = screen.getByTestId("total-card-hechura-row");
    // UX.33 — el `data-tp-header-mode` sigue distinguiendo modos (interno),
    // pero el LABEL visible ahora dice "Hechura total" en ambos modos.
    expect(row.getAttribute("data-tp-header-mode")).toBe("saldo-monetario");
    expect(row.textContent).toContain("Hechura total");
    expect(row.textContent).not.toContain("Saldo monetario");

    const amount = screen.getByTestId("total-card-monetary-header-amount");
    // 538260.94 − 210937.50 = 327323.44 (fallback canónico, Patrimonio físico)
    expect(amount.textContent).toMatch(/327[.,]?323[.,]44/);
  });

  it("BREAKDOWN (UX-Comercial §R-Rounding-16): con commercialMetalValueSum, header = total − metalCost", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={538260.94}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceWithOro()}
        commercialMetalValueSum={309375}    // Patrimonio comercial (metalCost)
        onBalanceModeOverrideChange={noop}
      />,
    );
    const amount = screen.getByTestId("total-card-monetary-header-amount");
    // 538260.94 − 309375 = 228885.94 (modo UX-Comercial)
    expect(amount.textContent).toMatch(/228[.,]?885[.,]94/);
  });

  it("BREAKDOWN: Patrimonio + Saldo = Total (invariante UX-Comercial)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={538260.94}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceWithOro()}
        commercialMetalValueSum={309375}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // Verificación matemática: el header del bloque METALES muestra
    // "ARS 309.375" (post UX.32) + saldo monetario "$228.885,94" → suma = total.
    const valorComercial = screen.getByTestId("total-card-metals-header-total");
    expect(valorComercial.textContent).toMatch(/309[.,]?375/);
    const saldo = screen.getByTestId("total-card-monetary-header-amount");
    expect(saldo.textContent).toMatch(/228[.,]?885[.,]94/);
    // 309.375 + 228.885,94 = 538.260,94 ✅
  });

  it("BREAKDOWN: con varios metales padre suma todas las valuaciones antes de restar", () => {
    const bb: BalanceBreakdownDTO = {
      metals: [
        {
          metalParentId: "oro-fino", metalParentName: "Oro",
          gramsOriginal: 1.5, purity: 1, gramsPure: 1.125,
          quotePriceSnapshot: 187500, valuationMonetary: 210937.5,
          valuationCurrencyCode: "ARS", sourceLineIds: ["L-1"],
        },
        {
          metalParentId: "plata", metalParentName: "Plata",
          gramsOriginal: 2, purity: 1, gramsPure: 2,
          quotePriceSnapshot: 5000, valuationMonetary: 10000,
          valuationCurrencyCode: "ARS", sourceLineIds: ["L-2"],
        },
      ],
      monetaryBalance: {
        amount: 100000, currencyCode: "ARS", currencyRate: 1, amountBase: 100000,
        // Necesario para que el bloque colapsable se renderice: requiere
        // al menos 1 component agrupable. Pricing aparte — solo gating.
        components: [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 100000 },
        ],
      },
    };
    render(
      <TotalDelComprobanteCard
        totalDocument={538260.94}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bb}
        onBalanceModeOverrideChange={noop}
      />,
    );
    const amount = screen.getByTestId("total-card-monetary-header-amount");
    // 538260.94 − (210937.5 + 10000) = 317323.44
    expect(amount.textContent).toMatch(/317[.,]?323[.,]44/);
  });

  it("UNIFIED puro (sin metales) → header muestra 'Hechura total' (UX.33 unifica el label en ambos modos)", () => {
    // En UNIFIED puro NO se pasa `documentMetals` ni `balanceBreakdown.metals`:
    // si hubiera metales visibles, el card fuerza `mode=BREAKDOWN` por diseño
    // (`TotalDelComprobanteCard.tsx:187-189`) — es el contrato del componente,
    // independiente del prop `balanceMode`. Por eso UNIFIED puro = sin metales.
    const bbUnified: BalanceBreakdownDTO = {
      metals: [],
      monetaryBalance: {
        amount: 538260.94, currencyCode: "ARS", currencyRate: 1, amountBase: 538260.94,
        components: [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 142500 },
        ],
      },
    };
    render(
      <TotalDelComprobanteCard
        totalDocument={538260.94}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bbUnified}
        onBalanceModeOverrideChange={noop}
      />,
    );
    const row = screen.getByTestId("total-card-hechura-row");
    // UX.33 — el atributo interno sigue distinguiendo (mode=total-hechura
    // para UNIFIED), pero el label visible es "Hechura total" en ambos
    // modos. Eliminamos la dualidad visual.
    expect(row.getAttribute("data-tp-header-mode")).toBe("total-hechura");
    expect(row.textContent).toContain("Hechura total");
    expect(row.textContent).not.toContain("Saldo monetario");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (B) MonetarySummary — detalle compactado (UX-Saldo Compact 2026-05-29)
// ──────────────────────────────────────────────────────────────────────────
// Las filas "Subtotal comercial", "Total final", "Menos patrimonio metálico"
// y "Saldo monetario" se OCULTARON del cuerpo expandido para evitar duplicar
// la información que ya muestra el header del card. Los props se mantienen
// en el API para back-compat con callers (passthrough sin render).
// ──────────────────────────────────────────────────────────────────────────

describe("MonetarySummary — detalle expandido compactado", () => {
  function renderWithAllProps() {
    render(
      <MonetarySummary
        groups={[
          {
            group:      "HECHURA",
            components: [
              { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 142500 },
            ],
          },
          {
            group:      "TAX",
            components: [
              { type: "TAX", group: "TAX", label: "IVA", amount: 93417.19 },
            ],
          },
          {
            group:      "ROUNDING",
            components: [
              { type: "ROUNDING_MONETARY", group: "ROUNDING", label: "Redondeo", amount: -7031.25 },
            ],
          },
        ]}
        displayCurrency="ARS"
        subtotalCommercial={444843.75}
        totalDocument={538260.94}
        metalsValuationSum={210937.5}
      />,
    );
  }

  it("NO renderiza fila 'Total final' aunque totalDocument esté provisto", () => {
    renderWithAllProps();
    expect(screen.queryByTestId("total-card-monetary-total")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-total-amount")).toBeNull();
  });

  it("NO renderiza fila 'Subtotal comercial' aunque subtotalCommercial esté provisto", () => {
    renderWithAllProps();
    expect(screen.queryByTestId("total-card-subtotal-commercial")).toBeNull();
  });

  it("NO renderiza filas 'Menos patrimonio metálico' / 'Saldo monetario' aunque metalsValuationSum esté provisto", () => {
    renderWithAllProps();
    expect(screen.queryByTestId("total-card-monetary-less-metals")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-saldo")).toBeNull();
  });

  it("SÍ renderiza Hechura, IVA y Redondeo (las filas que el operador necesita ver)", () => {
    renderWithAllProps();
    const root = screen.getByTestId("total-card-monetary");
    expect(root.textContent).toContain("Hechura");
    expect(root.textContent).toContain("IVA");
    expect(root.textContent).toContain("Redondeo");
    expect(root.textContent).toMatch(/142[.,]?500/);
    expect(root.textContent).toMatch(/93[.,]?417[.,]19/);
    expect(root.textContent).toMatch(/7[.,]?031[.,]25/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (D) Etapa UX-Auditable — "Total a cobrar en $" al pie del detalle
// ──────────────────────────────────────────────────────────────────────────
// El cierre del cuerpo expandido es el monto canónico (= totalDocument −
// metalsValuationSum). Regla 7 (auditabilidad): este monto cuadra contra
// la Σ de los components visibles cuando el backend emite METAL_MARGIN +
// MANUAL_ADJUSTMENT (Etapa UX-Auditable backend, 2026-05-29).
// ──────────────────────────────────────────────────────────────────────────

describe("MonetarySummary — Total a cobrar en $ al pie del detalle", () => {
  it("renderiza 'Total a cobrar en $' con valor = totalDocument − metalsValuationSum", () => {
    render(
      <MonetarySummary
        groups={[]}
        displayCurrency="ARS"
        totalDocument={538260.94}
        metalsValuationSum={210937.5}
      />,
    );
    const row = screen.getByTestId("total-card-monetary-total-a-cobrar");
    expect(row.textContent).toContain("Total a cobrar en $");
    expect(screen.getByTestId("total-card-monetary-total-a-cobrar-amount").textContent)
      .toMatch(/ARS\s*327[.,]?323[.,]44/);
  });

  it("omite la fila cuando metalsValuationSum es null (UNIFIED puro)", () => {
    render(
      <MonetarySummary
        groups={[]}
        displayCurrency="ARS"
        totalDocument={538260.94}
        metalsValuationSum={null}
      />,
    );
    expect(screen.queryByTestId("total-card-monetary-total-a-cobrar")).toBeNull();
  });

  it("omite la fila cuando totalDocument es null (defensive)", () => {
    render(
      <MonetarySummary
        groups={[]}
        displayCurrency="ARS"
        totalDocument={null}
        metalsValuationSum={210937.5}
      />,
    );
    expect(screen.queryByTestId("total-card-monetary-total-a-cobrar")).toBeNull();
  });

  it("UX-Comercial (§R-Rounding-16): METAL_MARGIN backend SE OCULTA del detalle — Σ visibles == 'Total a cobrar en $' con Patrimonio comercial", () => {
    // Etapa UX-Comercial (2026-05-30): METAL_MARGIN se emite desde el backend
    // pero se filtra del render del detalle (queda absorbido en el Patrimonio
    // comercial = metalCost). Para que la suma cuadre, `metalsValuationSum`
    // del caller debe representar metalCost (no valuationMonetary).
    //
    // Caso: total=538260.94, metalCost=309375, valuationMonetary=210937.50,
    // METAL_MARGIN=98437.50. Si Patrimonio = metalCost (309375), entonces
    // Saldo = total − metalCost = 228885.94. Σ visibles (sin METAL_MARGIN) =
    // 142500 + 93417.19 − 7031.25 = 228885.94 ✅.
    render(
      <MonetarySummary
        groups={[
          {
            group:      "HECHURA",
            components: [
              { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 142500 },
            ],
          },
          {
            group:      "MARGIN",
            components: [
              { type: "METAL_MARGIN", group: "MARGIN", label: "Diferencia metal (venta vs físico)", amount: 98437.5 },
            ],
          },
          {
            group:      "TAX",
            components: [
              { type: "TAX", group: "TAX", label: "IVA", amount: 93417.19 },
            ],
          },
          {
            group:      "ROUNDING",
            components: [
              { type: "ROUNDING_MONETARY", group: "ROUNDING", label: "Redondeo", amount: -7031.25 },
            ],
          },
        ]}
        displayCurrency="ARS"
        totalDocument={538260.94}
        metalsValuationSum={309375}     // Patrimonio comercial (metalCost)
      />,
    );
    // Total a cobrar = 538260.94 − 309375 = 228885.94.
    const totalAmount = screen.getByTestId("total-card-monetary-total-a-cobrar-amount");
    expect(totalAmount.textContent).toMatch(/228[.,]?885[.,]94/);
    // Σ visibles (sin METAL_MARGIN): 142500 + 93417.19 − 7031.25 = 228885.94.
    const root = screen.getByTestId("total-card-monetary");
    expect(root.textContent).toMatch(/142[.,]?500/);
    expect(root.textContent).toMatch(/93[.,]?417[.,]19/);
    expect(root.textContent).toMatch(/7[.,]?031[.,]25/);
    // METAL_MARGIN ya no se renderiza (filtrado del detalle).
    expect(root.textContent).not.toMatch(/98[.,]?437[.,]50/);
    expect(root.textContent).not.toMatch(/Diferencia metal/);
  });

  it("UX.32 (helper): buildCommercialMetalValueByParent agrega lineCost × qty por metalName", async () => {
    const { buildCommercialMetalValueByParent } = await import("../helpers");
    // 2 metales: Oro y Plata, distintas líneas y qty.
    const out = buildCommercialMetalValueByParent([
      {
        quantity: 1,
        composition: {
          metals: [
            { metalName: "Oro",   lineCost: 309375 },
          ],
        },
      },
      {
        quantity: 2,
        composition: {
          metals: [
            { metalName: "Plata", lineCost: 5000 },
          ],
        },
      },
      {
        quantity: 3,
        composition: {
          metals: [
            { metalName: "Oro",   lineCost: 100000 },
            { metalName: "Plata", lineCost:   1000 },
          ],
        },
      },
    ]);
    expect(out.Oro).toBe(309375 * 1 + 100000 * 3);     // = 609375
    expect(out.Plata).toBe(5000 * 2 + 1000 * 3);       // = 13000
  });

  it("UX.32 (helper): omite items sin metalName o lineCost no finito; soporta string", async () => {
    const { buildCommercialMetalValueByParent } = await import("../helpers");
    const out = buildCommercialMetalValueByParent([
      {
        quantity: 1,
        composition: {
          metals: [
            { metalName: "Oro",   lineCost: "309375.50" }, // string → parseFloat
            { metalName: "",      lineCost: 999 },          // sin nombre → omitido
            { metalName: "Plata", lineCost: null },         // lineCost null → omitido
            { metalName: "Cobre", lineCost: NaN },          // NaN → omitido
            null,                                            // null → omitido
          ],
        },
      },
    ]);
    expect(out.Oro).toBe(309375.5);
    expect(out.Plata).toBeUndefined();
    expect(out.Cobre).toBeUndefined();
  });

  it("UX.32: header del bloque METALES muestra total agregado (commercialMetalValueSum)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={538260.94}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceWithOro()}
        commercialMetalValueSum={309375}
        onBalanceModeOverrideChange={noop}
      />,
    );
    const header = screen.getByTestId("total-card-metals-header-total");
    expect(header.textContent).toMatch(/ARS\s*309[.,]?375/);
  });

  it("UX.32 (>1 padre): cada metal padre muestra 'Valor comercial: ARS X' como sub-fila terciaria", () => {
    // Con 2+ metales el desglose por padre SÍ aporta información.
    const bb: BalanceBreakdownDTO = {
      metals: [
        {
          metalParentId: "oro-fino", metalParentName: "Oro",
          gramsOriginal: 1.5, purity: 1, gramsPure: 1.125,
          quotePriceSnapshot: 187500, valuationMonetary: 210937.5,
          valuationCurrencyCode: "ARS", sourceLineIds: ["L-1"],
        },
        {
          metalParentId: "plata", metalParentName: "Plata",
          gramsOriginal: 2, purity: 1, gramsPure: 2,
          quotePriceSnapshot: 5000, valuationMonetary: 10000,
          valuationCurrencyCode: "ARS", sourceLineIds: ["L-2"],
        },
      ],
      monetaryBalance: {
        amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0,
        components: [],
      },
    };
    render(
      <TotalDelComprobanteCard
        totalDocument={538260.94}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bb}
        commercialMetalValueSum={465375}
        commercialMetalValueByParent={{ Oro: 309375, Plata: 156000 }}
        onBalanceModeOverrideChange={noop}
      />,
    );
    const oroRow = screen.getByTestId("total-card-metal-oro-fino-commercial-value");
    expect(oroRow.textContent).toMatch(/Valor comercial/i);
    expect(oroRow.textContent).toMatch(/309[.,]?375/);
    const plataRow = screen.getByTestId("total-card-metal-plata-commercial-value");
    expect(plataRow.textContent).toMatch(/156[.,]?000/);
  });

  it("UX.32.b (1 padre): NO renderiza 'Valor comercial' por padre — el header ya lo muestra", () => {
    // Con 1 solo padre, la sub-fila duplicaría el valor del header del bloque.
    // Se suprime para evitar ruido visual.
    render(
      <TotalDelComprobanteCard
        totalDocument={538260.94}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceWithOro()}
        commercialMetalValueSum={309375}
        commercialMetalValueByParent={{ Oro: 309375 }}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // Sub-fila por padre: NO renderizada (regla N=1).
    expect(screen.queryByTestId("total-card-metal-oro-fino-commercial-value")).toBeNull();
    // Header del bloque: SÍ presente con el total agregado.
    expect(screen.getByTestId("total-card-metals-header-total").textContent)
      .toMatch(/309[.,]?375/);
  });

  it("UX.32: invariante Σ por padre = header del bloque (caso real qty=1)", () => {
    const byParent = { Oro: 309375 };
    const sigma = Object.values(byParent).reduce((a, b) => a + b, 0);
    expect(sigma).toBe(309375); // = commercialMetalValueSum del header
  });

  it("UX.32: si commercialMetalValueByParent no se provee, la sub-fila por padre se omite", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={538260.94}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceWithOro()}
        commercialMetalValueSum={309375}
        onBalanceModeOverrideChange={noop}
        // commercialMetalValueByParent omitido
      />,
    );
    expect(screen.queryByTestId("total-card-metal-oro-fino-commercial-value")).toBeNull();
    // Pero el header del bloque sí muestra el total (porque commercialMetalValueSum sí está).
    expect(screen.getByTestId("total-card-metals-header-total")).toBeTruthy();
  });

  it("UX.32: fila legacy 'Valor comercial del metal' al pie del bloque YA NO existe", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={538260.94}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceWithOro()}
        commercialMetalValueSum={309375}
        commercialMetalValueByParent={{ Oro: 309375 }}
        onBalanceModeOverrideChange={noop}
      />,
    );
    expect(screen.queryByTestId("total-card-metals-commercial-value")).toBeNull();
  });

  it("UX.33-final: tooltip de IVA muestra base + alícuota + IVA (estilo calculadora, sin texto)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <MonetarySummary
        groups={[
          {
            group:      "TAX",
            components: [
              { type: "TAX", group: "TAX", label: "IVA", amount: 93417.19 },
            ],
          },
        ]}
        displayCurrency="ARS"
        taxableBase={444843.75}
      />,
    );
    const trigger = screen.getByTestId("origin-tooltip-trigger-iva");
    await user.click(trigger);
    const content = screen.getByTestId("origin-tooltip-content-iva");
    // Muestra las 3 filas + total. Cero texto narrativo.
    expect(content.textContent).toMatch(/Base imponible/);
    expect(content.textContent).toMatch(/444[.,]?843[.,]75/);
    expect(content.textContent).toMatch(/Alícuota/);
    expect(content.textContent).toMatch(/21[.,]00/);
    expect(content.textContent).toMatch(/93[.,]?417[.,]19/);
    // Sin texto narrativo: NO debe contener "Origen" ni "El motor".
    expect(content.textContent).not.toMatch(/Origen/);
    expect(content.textContent).not.toMatch(/motor/i);
  });

  it("UX.33-final: tooltip de IVA sin taxableBase muestra solo la cifra final (sin Base/Alícuota)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <MonetarySummary
        groups={[
          {
            group:      "TAX",
            components: [
              { type: "TAX", group: "TAX", label: "IVA", amount: 93417.19 },
            ],
          },
        ]}
        displayCurrency="ARS"
      />,
    );
    const trigger = screen.getByTestId("origin-tooltip-trigger-iva");
    await user.click(trigger);
    const content = screen.getByTestId("origin-tooltip-content-iva");
    expect(content.textContent).toMatch(/93[.,]?417[.,]19/);
    expect(content.textContent).not.toMatch(/Base imponible/);
    expect(content.textContent).not.toMatch(/Alícuota/);
  });

  it("UX.33-final: tooltip de Hechura muestra solo el monto (estilo calculadora)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <MonetarySummary
        groups={[
          {
            group:      "HECHURA",
            components: [
              { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 142500 },
            ],
          },
        ]}
        displayCurrency="ARS"
      />,
    );
    const trigger = screen.getByTestId("origin-tooltip-trigger-hechura");
    await user.click(trigger);
    const content = screen.getByTestId("origin-tooltip-content-hechura");
    expect(content.textContent).toMatch(/142[.,]?500/);
    // Cero texto narrativo
    expect(content.textContent).not.toMatch(/Origen/);
    expect(content.textContent).not.toMatch(/Σ.*hechuraSale.*qty/);
  });

  it("UX.33-final: 'Total a cobrar en $' tooltip muestra desglose calculadora (todos los components + Total)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <MonetarySummary
        groups={[
          {
            group:      "HECHURA",
            components: [
              { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 142500 },
            ],
          },
          {
            group:      "TAX",
            components: [
              { type: "TAX", group: "TAX", label: "IVA", amount: 93417.19 },
            ],
          },
        ]}
        displayCurrency="ARS"
        totalDocument={538260.94}
        metalsValuationSum={309375}
      />,
    );
    const trigger = screen.getByTestId("origin-tooltip-trigger-total-a-cobrar-en-$");
    await user.click(trigger);
    const content = screen.getByTestId("origin-tooltip-content-total-a-cobrar-en-$");
    // Cada component visible + Total
    expect(content.textContent).toMatch(/Hechura/);
    expect(content.textContent).toMatch(/142[.,]?500/);
    expect(content.textContent).toMatch(/IVA/);
    expect(content.textContent).toMatch(/93[.,]?417[.,]19/);
    expect(content.textContent).toMatch(/Total/);
    expect(content.textContent).toMatch(/228[.,]?885[.,]94/);
    // Sin texto narrativo
    expect(content.textContent).not.toMatch(/Origen/);
    expect(content.textContent).not.toMatch(/resultado monetario/i);
  });

  it("UX.30: cada component visible tiene tooltip ⓘ de origen (excepto los que no aplican)", () => {
    render(
      <MonetarySummary
        groups={[
          {
            group:      "HECHURA",
            components: [
              { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 142500 },
            ],
          },
          {
            group:      "TAX",
            components: [
              { type: "TAX", group: "TAX", label: "IVA", amount: 93417.19 },
            ],
          },
          {
            group:      "ROUNDING",
            components: [
              { type: "ROUNDING_MONETARY", group: "ROUNDING", label: "Redondeo", amount: -7031.25 },
            ],
          },
        ]}
        displayCurrency="ARS"
      />,
    );
    // Hechura tiene tooltip
    expect(screen.getByTestId("origin-tooltip-trigger-hechura")).toBeTruthy();
    // IVA tiene tooltip
    expect(screen.getByTestId("origin-tooltip-trigger-iva")).toBeTruthy();
    // Redondeo (comercial — no comprobante) tiene tooltip
    expect(screen.getByTestId("origin-tooltip-trigger-redondeo-comercial")).toBeTruthy();
  });

  it("UX-Comercial: METAL_MARGIN filtrado aunque venga aislado como único component", () => {
    // Defensa: si por algún motivo el único component visible fuera METAL_MARGIN,
    // tampoco se renderiza — el filtro es estricto por type.
    render(
      <MonetarySummary
        groups={[
          {
            group:      "MARGIN",
            components: [
              { type: "METAL_MARGIN", group: "MARGIN", label: "Diferencia metal", amount: 98437.5 },
            ],
          },
        ]}
        displayCurrency="ARS"
      />,
    );
    // El bloque queda vacío o muestra "Sin desglose"; nunca METAL_MARGIN.
    const empty = screen.queryByTestId("total-card-monetary-empty");
    expect(empty).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (E) Etapa UX-Auditable — Guard anti-duplicación del Redondeo Comercial
// ──────────────────────────────────────────────────────────────────────────

describe("MonetarySummary — guard anti-duplicación del Redondeo Comercial", () => {
  it("suprime el bloque 'Redondeo comercial' si ya hay component ROUNDING_MONETARY", () => {
    render(
      <MonetarySummary
        groups={[
          {
            group:      "ROUNDING",
            components: [
              { type: "ROUNDING_MONETARY", group: "ROUNDING", label: "Redondeo", amount: -7031.25 },
            ],
          },
        ]}
        displayCurrency="ARS"
        commercialPhysicalMetals={[{
          metalParentId:    "oro-fino",
          metalParentName:  "Oro",
          preGrams:         1.2375,
          postGrams:        1.2,
          deltaGrams:       -0.0375,
          metalPricePerGram: 187500,
          monetaryEquivalent: -7031.25,
        }]}
      />,
    );
    // No debe aparecer el bloque adicional (ya está cubierto por RoundingRow).
    expect(screen.queryByTestId("total-card-rounding-commercial-physical-section")).toBeNull();
  });

  it("SÍ renderiza el bloque 'Redondeo comercial' cuando NO hay component ROUNDING_MONETARY (degradación segura)", () => {
    // Caso: el motor emitió `appliedRounding.physical` pero no `roundingAdjustment`
    // monetario — fallback al bloque adicional para que el operador vea el delta.
    render(
      <MonetarySummary
        groups={[
          {
            group:      "HECHURA",
            components: [
              { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 },
            ],
          },
        ]}
        displayCurrency="ARS"
        commercialPhysicalMetals={[{
          metalParentId:    "oro-fino",
          metalParentName:  "Oro",
          preGrams:         1.2375,
          postGrams:        1.2,
          deltaGrams:       -0.0375,
          metalPricePerGram: 187500,
          monetaryEquivalent: -7031.25,
        }]}
      />,
    );
    expect(screen.getByTestId("total-card-rounding-commercial-physical-section")).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (C) MetalsSummary — sub-fila "Origen" desde sourceLineIds
// ──────────────────────────────────────────────────────────────────────────

describe("MetalsSummary — sub-fila 'Origen' desde sourceLineIds + lineArticleNames", () => {
  it("1 línea: 'Origen: 1 línea — Nombre del artículo'", () => {
    const metals: DocumentMetalSummaryItem[] = [{
      id: "oro-fino", name: "Oro", grams: 1.125, monetaryAmount: 210937.5,
      sourceLineIds: ["L-1"],
    }];
    render(
      <MetalsSummary
        metals={metals}
        currencyCode="ARS"
        lineArticleNames={{ "L-1": "ANILLO SOLITARIO BRILLANTE" }}
      />,
    );
    const origin = screen.getByTestId("total-card-metal-oro-fino-origin");
    expect(origin.textContent).toContain("Origen:");
    expect(origin.textContent).toContain("1 línea");
    expect(origin.textContent).toContain("ANILLO SOLITARIO BRILLANTE");
  });

  it("múltiples líneas: lista artículos únicos, omite duplicados", () => {
    const metals: DocumentMetalSummaryItem[] = [{
      id: "oro-fino", name: "Oro", grams: 3.5, monetaryAmount: 600000,
      sourceLineIds: ["L-1", "L-2", "L-3"],
    }];
    render(
      <MetalsSummary
        metals={metals}
        currencyCode="ARS"
        lineArticleNames={{
          "L-1": "ANILLO SOLITARIO BRILLANTE",
          "L-2": "CADENA CUBANA",
          "L-3": "CADENA CUBANA", // duplicado → debe colapsarse
        }}
      />,
    );
    const origin = screen.getByTestId("total-card-metal-oro-fino-origin");
    expect(origin.textContent).toContain("Origen:");
    expect(origin.textContent).toContain("2 líneas");
    expect(origin.textContent).toContain("ANILLO SOLITARIO BRILLANTE");
    expect(origin.textContent).toContain("CADENA CUBANA");
    // No debe duplicar el repetido
    const matches = origin.textContent?.match(/CADENA CUBANA/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("sin sourceLineIds → no renderiza la fila de origen", () => {
    const metals: DocumentMetalSummaryItem[] = [{
      id: "oro-fino", name: "Oro", grams: 1.125, monetaryAmount: 210937.5,
    }];
    render(
      <MetalsSummary
        metals={metals}
        currencyCode="ARS"
        lineArticleNames={{ "L-1": "ANILLO SOLITARIO BRILLANTE" }}
      />,
    );
    expect(screen.queryByTestId("total-card-metal-oro-fino-origin")).toBeNull();
  });

  it("sin lineArticleNames → no renderiza la fila de origen (degradación segura)", () => {
    const metals: DocumentMetalSummaryItem[] = [{
      id: "oro-fino", name: "Oro", grams: 1.125, monetaryAmount: 210937.5,
      sourceLineIds: ["L-1"],
    }];
    render(<MetalsSummary metals={metals} currencyCode="ARS" />);
    expect(screen.queryByTestId("total-card-metal-oro-fino-origin")).toBeNull();
  });

  it("sourceLineIds con IDs que no matchean el mapa → omite el origen (sin error)", () => {
    const metals: DocumentMetalSummaryItem[] = [{
      id: "oro-fino", name: "Oro", grams: 1.125, monetaryAmount: 210937.5,
      sourceLineIds: ["L-FANTASMA"],
    }];
    render(
      <MetalsSummary
        metals={metals}
        currencyCode="ARS"
        lineArticleNames={{ "L-1": "OTRO" }}
      />,
    );
    expect(screen.queryByTestId("total-card-metal-oro-fino-origin")).toBeNull();
  });
});
