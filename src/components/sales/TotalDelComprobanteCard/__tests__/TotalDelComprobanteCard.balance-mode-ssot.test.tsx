// src/components/sales/TotalDelComprobanteCard/__tests__/TotalDelComprobanteCard.balance-mode-ssot.test.tsx
// =============================================================================
// SSOT 2026-06-03 — `balanceMode` del backend es la ÚNICA fuente de verdad del
// "Modo de saldo". El frontend es lector puro: NO deriva el modo desde la
// presencia de metales.
//
// Reemplaza al antiguo `mode-from-metals` test (cuya premisa "hay metales →
// BREAKDOWN" se eliminó por crear una doble fuente de verdad: el label decía
// "Desglosado" mientras el motor calculaba los totales en UNIFIED).
//
// Contrato verificado:
//   A) balanceMode=UNIFIED + metales visibles → label "Unificado", editor de
//      ajuste manual UNIFIED (sin filas de metal). Los metales SIGUEN visibles
//      como información (Patrimonio Metálico). Mostrar metales ≠ cambiar modo.
//   B) balanceMode=BREAKDOWN + metales → label "Desglosado", editor BREAKDOWN.
//   C) coherencia: Total del comprobante y Impacto en cuenta corriente
//      muestran el MISMO modo (ambos leen `balanceMode`).
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import { TPSaleAccountImpactCard } from "../../TPSaleAccountImpactCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function openManualAdjustmentEditor(): void {
  const chip = screen.queryByTestId("total-card-manual-adjustment-open");
  if (chip) fireEvent.click(chip);
}

function bdWithMetals(): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId:   "oro-fino",
        metalParentName: "Oro Fino",
        gramsOriginal:   8.918,
        purity:          1,
        gramsPure:       8.918,
        quotePriceSnapshot:    100000,
        valuationMonetary:     891800,
        valuationCurrencyCode: "ARS",
        sourceLineIds:   ["L-1"],
      },
      {
        metalParentId:   "plata-925",
        metalParentName: "Plata",
        gramsOriginal:   3.108,
        purity:          0.925,
        gramsPure:       3.108,
        quotePriceSnapshot:    500,
        valuationMonetary:     1554,
        valuationCurrencyCode: "ARS",
        sourceLineIds:   ["L-2"],
      },
    ],
    monetaryBalance: {
      amount: 50000, currencyCode: "ARS", currencyRate: 1, amountBase: 50000,
      components: [
        { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 50000 },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// A) balanceMode=UNIFIED + metales → label "Unificado" (NO se deriva BREAKDOWN)
// ─────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — balanceMode SSOT (UNIFIED con metales)", () => {
  it("A) balanceMode=UNIFIED + metales: label 'Unificado', SIN bloque METALES (2D), editor UNIFIED", () => {
    const onChange = vi.fn();
    render(
      <TotalDelComprobanteCard
        totalDocument={943000}
        currencyCode="ARS"
        balanceMode="UNIFIED"             // ← backend manda
        balanceModeSource="TENANT_DEFAULT"
        balanceBreakdown={bdWithMetals()} // ← hay metales, pero NO cambian el modo
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
        manualAdjustment={null}
        manualAdjustmentDraft={null}
        onManualAdjustmentChange={onChange}
      />,
    );

    // Etapa 2D — en UNIFICADO NO se renderiza el bloque METALES.
    expect(screen.queryByTestId("total-card-metals-section")).toBeNull();

    // El control segmentado muestra ambos modos; el segmento ACTIVO es
    // "Unificado" (data-active=true) y el de "Desglosado" queda inactivo.
    expect(
      screen.getByTestId("balance-mode-segment-unified").getAttribute("data-active"),
    ).toBe("true");
    expect(
      screen.getByTestId("balance-mode-segment-breakdown").getAttribute("data-active"),
    ).toBe("false");

    // El editor de ajuste manual opera en UNIFIED: sin filas por metal.
    openManualAdjustmentEditor();
    expect(screen.queryByTestId("total-card-manual-adjustment-metal-row")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B) balanceMode=BREAKDOWN + metales → label "Desglosado", editor BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — balanceMode SSOT (BREAKDOWN)", () => {
  it("B) balanceMode=BREAKDOWN + metales: label 'Desglosado', editor con filas de metal", () => {
    const onChange = vi.fn();
    render(
      <TotalDelComprobanteCard
        totalDocument={943000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"           // ← backend manda BREAKDOWN
        balanceModeSource="PRICELIST_DEFAULT"
        balanceBreakdown={bdWithMetals()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
        manualAdjustment={null}
        manualAdjustmentDraft={null}
        onManualAdjustmentChange={onChange}
      />,
    );

    const metalsSection = screen.getByTestId("total-card-metals-section");
    expect(metalsSection.getAttribute("data-mode")).toBe("BREAKDOWN");

    const badge = screen.getByTestId("balance-mode-selector-badge");
    expect(badge.textContent).toContain("Desglosado");

    openManualAdjustmentEditor();
    expect(screen.getAllByTestId("total-card-manual-adjustment-metal-row")).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C) Coherencia: Total del comprobante ↔ Impacto en cuenta corriente
// ─────────────────────────────────────────────────────────────────────────

describe("coherencia balanceMode — Total del comprobante ↔ Impacto cuenta corriente", () => {
  it("C-UNIFIED) ambos cards muestran 'Unificado' con balanceMode=UNIFIED + metales", () => {
    const onChange = vi.fn();
    const { rerender: _rerender } = render(
      <>
        <TotalDelComprobanteCard
          totalDocument={943000}
          currencyCode="ARS"
          balanceMode="UNIFIED"
          balanceModeSource="TENANT_DEFAULT"
          balanceBreakdown={bdWithMetals()}
          balanceModeOverride={null}
          onBalanceModeOverrideChange={noop}
          engineTotal={943000}
          manualAdjustment={null}
          manualAdjustmentDraft={null}
          onManualAdjustmentChange={onChange}
        />
        <TPSaleAccountImpactCard
          totalDocument={943000}
          paidAmount={0}
          balancePending={943000}
          currencyCode="ARS"
          balanceMode="UNIFIED"
          balanceBreakdown={bdWithMetals()}
        />
      </>,
    );

    // Total del comprobante → UNIFIED, SIN bloque METALES (Etapa 2D).
    expect(screen.queryByTestId("total-card-metals-section")).toBeNull();
    expect(screen.getByTestId("balance-mode-selector-badge").textContent).toContain("Unificado");
    // Impacto en cuenta corriente → MISMO modo (Unificado), sin inferir desde metales.
    expect(screen.getByTestId("account-impact-mode").textContent).toBe("Unificado");
  });

  it("C-BREAKDOWN) ambos cards muestran 'Desglosado' con balanceMode=BREAKDOWN", () => {
    const onChange = vi.fn();
    render(
      <>
        <TotalDelComprobanteCard
          totalDocument={943000}
          currencyCode="ARS"
          balanceMode="BREAKDOWN"
          balanceModeSource="PRICELIST_DEFAULT"
          balanceBreakdown={bdWithMetals()}
          balanceModeOverride={null}
          onBalanceModeOverrideChange={noop}
          engineTotal={943000}
          manualAdjustment={null}
          manualAdjustmentDraft={null}
          onManualAdjustmentChange={onChange}
        />
        <TPSaleAccountImpactCard
          totalDocument={943000}
          paidAmount={0}
          balancePending={943000}
          currencyCode="ARS"
          balanceMode="BREAKDOWN"
          balanceBreakdown={bdWithMetals()}
        />
      </>,
    );
    expect(screen.getByTestId("total-card-metals-section").getAttribute("data-mode")).toBe("BREAKDOWN");
    expect(screen.getByTestId("balance-mode-selector-badge").textContent).toContain("Desglosado");
    expect(screen.getByTestId("account-impact-mode").textContent).toBe("Desglosado");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ETAPA 1 — Footer UNIFICADO (Opción B): metal informativo, sin separación
// monetaria de metal, saldo = total completo.
// ─────────────────────────────────────────────────────────────────────────

/** Snapshot comercial PER_DOCUMENT BREAKDOWN con un metal padre. Sirve para
 *  probar que en UNIFICADO NO se muestra ninguna separación comercial por
 *  metal aunque el snapshot venga en scope BREAKDOWN (el gate es el modo del
 *  documento, no el scope del snapshot). */
const crSnapBreakdownOro = {
  source: "PRICE_LIST" as const,
  scope: "BREAKDOWN" as const,
  totalAdjustment: 5300,
  breakdown: {
    metals: [{
      metalParentId: "oro-fino", metalParentName: "Oro Fino",
      preGrams: 8.918, postGrams: 9, deltaGrams: 0.082,
      metalPricePerGram: 100000, monetaryEquivalent: 5300,
      mode: "DECIMAL_1", direction: "NEAREST",
    }],
    metalMonetaryEquivalent: 5300,
    hechura: {
      preRoundingSaldoMonetario: 50000, postRoundingSaldoMonetario: 50000,
      deltaSaldoMonetario: 0, mode: "NONE", direction: "NEAREST",
      source: "PRICE_LIST_HECHURA" as const,
    },
    combinedAdjustment: 5300,
  },
};

describe("Etapa 2D — Footer UNIFICADO: SIN bloque METALES", () => {
  function renderUnified() {
    return render(
      <TotalDelComprobanteCard
        totalDocument={943000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceModeSource="TENANT_DEFAULT"
        balanceBreakdown={bdWithMetals()}
        metalSaleByParent={{ "Oro Fino": 891800, "Plata": 1554 }}
        commercialMetalValueByParent={{ "Oro Fino": 891800, "Plata": 1554 }}
        commercialDocumentRoundingSnapshot={crSnapBreakdownOro}
        commercialMonetaryRoundingImpactSum={24.79}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
      />,
    );
  }

  it("1) NO renderiza el bloque METALES (Etapa 2D)", () => {
    renderUnified();
    expect(screen.queryByTestId("total-card-metals-section")).toBeNull();
  });

  it("2) NO muestra el total monetario del bloque de metales", () => {
    renderUnified();
    expect(screen.queryByTestId("total-card-metals-header-total")).toBeNull();
  });

  it("3) NO muestra valor comercial / redondeo / valor final por metal", () => {
    renderUnified();
    // ids derivados de metalParentId: "oro-fino" / "plata-925".
    expect(screen.queryByTestId("total-card-metal-oro-fino-commercial-value")).toBeNull();
    expect(screen.queryByTestId("total-card-metal-oro-fino-commercial-rounding")).toBeNull();
    expect(screen.queryByTestId("total-card-metal-oro-fino-commercial-final")).toBeNull();
    // Tampoco el desglose del redondeo comercial monetario.
    expect(screen.queryByTestId("total-card-monetary-commercial-rounding")).toBeNull();
  });

  it("4) Total en el hero = totalDocument; sin header de saldo duplicado (2F-C)", () => {
    renderUnified();
    // Etapa 2F-C — el header "Monetario (saldo)" se oculta en UNIFICADO.
    expect(screen.queryByTestId("total-card-monetary-header-amount")).toBeNull();
    expect(screen.getByTestId("total-card-amount").textContent).toMatch(/943[.,]?000/);
  });

  it("5) la sección 'Redondeos comerciales' está ausente", () => {
    renderUnified();
    expect(screen.queryByTestId("total-card-commercial-rounding-section")).toBeNull();
  });

  it("6) NO renderiza la lista de gramos del metal", () => {
    renderUnified();
    expect(screen.queryByTestId("total-card-metals")).toBeNull();
    expect(screen.queryByTestId("total-card-metal-oro-fino")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Contraprueba BREAKDOWN — la separación comercial por metal SÍ se muestra.
// ─────────────────────────────────────────────────────────────────────────

describe("Etapa UX — BREAKDOWN autocontenido: el redondeo vive en el patrimonio", () => {
  it("BREAKDOWN con snapshot comercial → NO hay bloque standalone; el patrimonio metálico queda intacto", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={943000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceModeSource="PRICELIST_DEFAULT"
        balanceBreakdown={bdWithMetals()}
        metalSaleByParent={{ "Oro Fino": 891800, "Plata": 1554 }}
        commercialMetalValueByParent={{ "Oro Fino": 891800, "Plata": 1554 }}
        commercialDocumentRoundingSnapshot={crSnapBreakdownOro}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
      />,
    );
    // Etapa UX (Opción B) — el bloque standalone "Redondeos comerciales" se
    // ELIMINÓ: su info ahora vive dentro de cada patrimonio.
    expect(screen.queryByTestId("total-card-commercial-rounding-section")).toBeNull();
    // El patrimonio metálico conserva su total monetario y su composición.
    expect(screen.getByTestId("total-card-metals-header-total")).toBeTruthy();
  });
});
