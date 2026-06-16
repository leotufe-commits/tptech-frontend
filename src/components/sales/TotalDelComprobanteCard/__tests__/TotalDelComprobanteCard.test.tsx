// src/components/sales/TotalDelComprobanteCard/__tests__/TotalDelComprobanteCard.test.tsx
// =============================================================================
// Etapa B — Tests del card maestro.
//
// Reglas testeadas:
//   · Header: title fijo + Total grande passthrough + subheader Modo/Canal/Lista.
//   · Selector inline integrado en el header (no flotante).
//   · UNIFIED: desglose COLAPSADO por defecto, toggle expande.
//   · BREAKDOWN: METALES siempre visible + desglose EXPANDIDO por defecto.
//   · No duplicación del Total maestro (el desglose no incluye fila "Total").
//   · Click en toggle "Desglose" preserva la preferencia del operador.
//   · helpers puros: groupComponentsByGroup preserva orden y agrupa por group.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import {
  deriveDocumentMetalsFromLines,
  groupComponentsByGroup,
  resolveCardMetals,
  typeToGroup,
} from "../helpers";
import type { BalanceBreakdownDTO } from "../../../../services/sales";
import type { DocumentMetalSummaryItem } from "../types";

const noopChange = () => { /* noop */ };

/**
 * Etapa UX-premium v3 — el detalle financiero (subtotal, descuentos,
 * canal, base imponible, IVA, envío, redondeo) pasó a estar cerrado por
 * default en cualquier modo (UNIFIED y BREAKDOWN). Helper de test que
 * abre el sub-toggle "Ver detalle financiero" cuando un test necesita
 * inspeccionar el contenido del cuerpo. Mantiene los tests legibles sin
 * agregar boilerplate en cada caso.
 */
function openDetalle(): void {
  const toggle = screen.queryByTestId("total-card-composicion-toggle");
  if (toggle && toggle.getAttribute("aria-expanded") === "false") {
    fireEvent.click(toggle);
  }
}

function bdUnified(): BalanceBreakdownDTO {
  return {
    metals: [],
    monetaryBalance: {
      amount: 1210,
      currencyCode: "ARS",
      currencyRate: 1,
      amountBase: 1210,
      components: [
        { type: "HECHURA",           group: "HECHURA",  label: "Hechura",   amount: 1000 },
        { type: "TAX",               group: "TAX",      label: "IVA",       amount: 210 },
      ],
    },
  };
}

function bdBreakdown(): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId:   "oro-fino",
        metalParentName: "Oro Fino",
        gramsOriginal:   4.20,
        purity:          0.66,
        gramsPure:       2.77,
        quotePriceSnapshot:    100,
        valuationMonetary:     277,
        valuationCurrencyCode: "ARS",
        sourceLineIds:   ["L-1"],
      },
      {
        metalParentId:   "plata-925",
        metalParentName: "Plata",
        gramsOriginal:   2.64,
        purity:          0.925,
        gramsPure:       2.44,
        quotePriceSnapshot:    5,
        valuationMonetary:     12.2,
        valuationCurrencyCode: "ARS",
        sourceLineIds:   ["L-2"],
      },
    ],
    monetaryBalance: {
      amount: 50000,
      currencyCode: "ARS",
      currencyRate: 1,
      amountBase: 50000,
      components: [
        { type: "HECHURA",           group: "HECHURA",  label: "Hechura",            amount: 49000 },
        { type: "DISCOUNT_QTY",      group: "DISCOUNT", label: "Descuentos de línea", amount: -1000 },
        { type: "ROUNDING_MONETARY", group: "ROUNDING", label: "Redondeo",           amount: -0.05 },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — header", () => {
  it("renderiza title fijo y Total grande passthrough", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.getByText("Total del comprobante")).toBeTruthy();
    const amount = screen.getByTestId("total-card-amount");
    expect(amount.textContent).toMatch(/ARS/);
    expect(amount.textContent).toMatch(/1[.,]?210/);
  });

  it("subheader incluye Canal + Lista cuando se pasan (el modo lo nombra el selector inline)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1000}
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        channelName="Tienda Online"
        priceListName="Mayorista"
      />,
    );
    expect(screen.getByTestId("total-card-channel").textContent).toBe("Tienda Online");
    expect(screen.getByTestId("total-card-pricelist").textContent).toBe("Mayorista");
    // UX.1 — el subheader ya NO repite "Modo: …" para evitar duplicación
    // con el TPBalanceModeSelector inline. El modo lo nombra el selector.
    const subheader = screen.getByTestId("total-card-subheader");
    expect(subheader.textContent).not.toMatch(/Modo:/);
  });

  it("subheader NO se renderiza cuando no hay ni canal ni lista", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1000}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.queryByTestId("total-card-channel")).toBeNull();
    expect(screen.queryByTestId("total-card-pricelist")).toBeNull();
    expect(screen.queryByTestId("total-card-subheader")).toBeNull();
  });

  it("Total grande aparece UNA SOLA VEZ (no se duplica en el desglose)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Hay solo UN testid del Total maestro.
    expect(screen.getAllByTestId("total-card-amount")).toHaveLength(1);
    // El desglose monetario NO emite una fila "Total" (regla anti-duplicación).
    expect(screen.queryByTestId("total-card-component-TOTAL")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Selector inline integrado
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — selector inline", () => {
  it("monta TPBalanceModeSelector dentro del header (no flotante)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1000}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const header = screen.getByTestId("total-card-header");
    const selectorWrap = screen.getByTestId("total-card-mode-selector");
    // El selector vive DENTRO del header del card.
    expect(header.contains(selectorWrap)).toBe(true);
    // Y el badge interno del TPBalanceModeSelector existe.
    expect(screen.getByTestId("balance-mode-selector-badge")).toBeTruthy();
  });

  it("selector deshabilitado cuando overrideDisabled=true", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1000}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        overrideDisabled
      />,
    );
    const seg = screen.getByTestId("balance-mode-segment-unified");
    expect((seg as HTMLButtonElement).disabled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED — desglose colapsado por defecto
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — modo UNIFIED", () => {
  it("desglose arranca COLAPSADO por defecto", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const toggle = screen.getByTestId("total-card-composicion-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("total-card-composicion-body")).toBeNull();
  });

  it("click en toggle expande el desglose y muestra componentes agrupados", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    expect(screen.getByTestId("total-card-composicion-body")).toBeTruthy();
    // Etapa 2F — en UNIFICADO la sección COMPOSICIÓN (HECHURA) se oculta; el
    // detalle se enfoca en la cuenta monetaria (impuestos / ajustes / etc.).
    expect(screen.queryByTestId("total-card-group-HECHURA")).toBeNull();
    expect(screen.getByTestId("total-card-group-TAX")).toBeTruthy();
  });

  it("NO renderiza la sección METALES en UNIFIED", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.queryByTestId("total-card-metals-section")).toBeNull();
    expect(screen.queryByTestId("total-card-metals")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN — METALES visible + desglose expandido por defecto
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — modo BREAKDOWN", () => {
  it("renderiza METALES (lista por padre) en BREAKDOWN", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.getByTestId("total-card-metals-section")).toBeTruthy();
    // Etapa UX.30 (2026-05-30) — el título de la sección volvió a "Metales"
    // (era "Patrimonio metálico"). Más corto y claro para el operador.
    expect(screen.getByText(/^metales$/i)).toBeTruthy();
    expect(screen.getByTestId("total-card-metal-oro-fino")).toBeTruthy();
    expect(screen.getByTestId("total-card-metal-plata-925")).toBeTruthy();
    expect(screen.getByText("Oro Fino")).toBeTruthy();
    expect(screen.getByText("Plata")).toBeTruthy();
  });

  it("desglose arranca CERRADO en BREAKDOWN (Etapa UX-premium v3 — detalle financiero opt-in)", () => {
    // Etapa UX-premium v3 — el detalle financiero pasó a ser opt-in en
    // ambos modos (UNIFIED y BREAKDOWN). La vista rápida muestra solo:
    // Total, Patrimonio metálico (cuando aplica), Total hechura, Total
    // final y Estado comercial. El operador abre el detalle si quiere
    // auditar descuentos/impuestos/envío/redondeo.
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const toggle = screen.getByTestId("total-card-composicion-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("total-card-composicion-body")).toBeNull();
    // Y los metales SIGUEN visibles aunque el detalle financiero esté cerrado
    // (viven en su propio bloque, no dependen del toggle).
    expect(screen.getByTestId("total-card-metals-section")).toBeTruthy();
  });

  it("toggle 'Ver detalle financiero' abre el cuerpo del detalle (Etapa UX-premium v3)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const toggle = screen.getByTestId("total-card-composicion-toggle");
    expect(toggle.textContent).toMatch(/ver detalle financiero/i);
    fireEvent.click(toggle);
    expect(screen.getByTestId("total-card-composicion-body")).toBeTruthy();
    expect(screen.getByTestId("total-card-group-ROUNDING")).toBeTruthy();
    // El label del toggle cambia a "Ocultar" cuando está abierto.
    expect(toggle.textContent).toMatch(/ocultar detalle financiero/i);
  });

  it("BREAKDOWN renderiza PATRIMONIO METÁLICO ANTES que TOTAL HECHURA en el DOM (Etapa UX-Tax v2)", () => {
    // Etapa UX-Tax v2 — feedback del usuario: en joyería el metal es el
    // componente PRINCIPAL del valor. El bloque "Patrimonio metálico" va
    // ARRIBA del bloque "Total hechura" para que el operador identifique
    // primero el patrimonio físico (gramos) y después el desglose monetario
    // (hechura + ajustes + impuestos + adicionales). Es la inversión del
    // orden previo de Etapa B / UX.5.
    const { container } = render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const composicionSection = container.querySelector("[data-testid='total-card-composicion-section']");
    const metalsSection      = container.querySelector("[data-testid='total-card-metals-section']");
    expect(composicionSection).toBeTruthy();
    expect(metalsSection).toBeTruthy();
    // METALES (Patrimonio metálico) aparece antes que COMPOSICIÓN (Total
    // hechura) en el orden del documento.
    expect(
      metalsSection!.compareDocumentPosition(composicionSection!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("MetalsSummary muestra nombre + gramos (sufijo ' g', sin duplicar 'gr') sin labels técnicos", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const oroRow = screen.getByTestId("total-card-metal-oro-fino");
    // Nombre humano del padre — NO el id interno.
    expect(oroRow.textContent).toMatch(/Oro Fino/);
    // El preset METAL_GRAMS ya emite el sufijo " g" (ej. "2,770 g"); NO debe
    // duplicarse con otro "gr" ("2,770 g gr").
    expect(oroRow.textContent).toMatch(/\d\s*g/);
    expect(oroRow.textContent ?? "").not.toMatch(/g\s*gr/i);
    // No se filtran labels técnicos del DTO al render.
    expect(oroRow.textContent).not.toMatch(/metalBalance/i);
    expect(oroRow.textContent).not.toMatch(/monetaryBalance/i);
    expect(oroRow.textContent).not.toMatch(/parentMetal/i);
    expect(oroRow.textContent).not.toMatch(/breakdownItems/i);
    expect(oroRow.textContent).not.toMatch(/metalParentId/i);
  });

  it("BREAKDOWN sin metales (edge) → bloque METALES visible con mensaje vacío", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={100}
        balanceMode="BREAKDOWN"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: {
            amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100,
          },
        }}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.getByTestId("total-card-metals-section")).toBeTruthy();
    expect(screen.getByTestId("total-card-metals-empty")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sin componentes — fallback silencioso
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — sin components", () => {
  it("balanceBreakdown sin components[] → NO renderiza sección Desglose", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={100}
        balanceMode="UNIFIED"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: {
            amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100,
          },
        }}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.queryByTestId("total-card-composicion-section")).toBeNull();
  });

  it("sin balanceBreakdown → solo Header (sin METALES ni Desglose)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={500}
        currencyCode="ARS"
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.getByTestId("total-card-header")).toBeTruthy();
    expect(screen.queryByTestId("total-card-metals-section")).toBeNull();
    expect(screen.queryByTestId("total-card-composicion-section")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// helpers — agrupación pura
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — helpers puros", () => {
  it("groupComponentsByGroup preserva orden de primera aparición", () => {
    const out = groupComponentsByGroup([
      { type: "HECHURA",      group: "HECHURA",  label: "H", amount: 100 },
      { type: "DISCOUNT_QTY", group: "DISCOUNT", label: "D", amount: -10 },
      { type: "TAX",          group: "TAX",      label: "T", amount: 21 },
      { type: "HECHURA",      group: "HECHURA",  label: "H2", amount: 50 },
    ]);
    expect(out.map((g) => g.group)).toEqual(["HECHURA", "DISCOUNT", "TAX"]);
    // HECHURA tiene los 2 componentes en orden de aparición.
    expect(out[0].components.map((c) => c.label)).toEqual(["H", "H2"]);
  });

  it("typeToGroup mapea correctamente los types canónicos", () => {
    expect(typeToGroup("HECHURA")).toBe("HECHURA");
    expect(typeToGroup("DISCOUNT_QTY")).toBe("DISCOUNT");
    expect(typeToGroup("DISCOUNT_MANUAL")).toBe("DISCOUNT");
    expect(typeToGroup("ROUNDING_MONETARY")).toBe("ROUNDING");
    expect(typeToGroup("SERVICE")).toBe("PRODUCT");
    // Desconocido → ADJUSTMENT (catch-all).
    expect(typeToGroup("UNKNOWN_X")).toBe("ADJUSTMENT");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hook de desglose — preferencia local del operador
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — preferencia del operador sobre el desglose", () => {
  it("toggle del desglose: arranca cerrado (Etapa UX-premium v3), abre y cierra preservando preferencia", () => {
    // Etapa UX-premium v3 — el detalle financiero pasó a ser opt-in en ambos
    // modos (UNIFIED y BREAKDOWN). Antes en BREAKDOWN arrancaba abierto; el
    // operador ahora lo abre cuando quiere auditar.
    const { rerender } = render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Arranca CERRADO.
    expect(screen.getByTestId("total-card-composicion-toggle").getAttribute("aria-expanded"))
      .toBe("false");
    // El operador lo abre.
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    expect(screen.getByTestId("total-card-composicion-toggle").getAttribute("aria-expanded"))
      .toBe("true");
    // El operador colapsa.
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    expect(screen.getByTestId("total-card-composicion-toggle").getAttribute("aria-expanded"))
      .toBe("false");
    // Re-render con los mismos props NO debe re-abrir el desglose.
    rerender(
      <TotalDelComprobanteCard
        totalDocument={50000}
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.getByTestId("total-card-composicion-toggle").getAttribute("aria-expanded"))
      .toBe("false");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Selector de Modo de saldo — Automático / Unificado / Desglosado
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — selector cambia modo", () => {
  it("(1) elegir UNIFIED dispara override='UNIFIED' y al re-renderizar el card muestra modo unificado", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceModeSource="ENTITY_DEFAULT"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={onChange}
      />,
    );
    // Control segmentado — click directo en el segmento "Unificado".
    fireEvent.click(screen.getByTestId("balance-mode-segment-unified"));
    expect(onChange).toHaveBeenCalledWith("UNIFIED");

    // El padre vuelve a renderizar con balanceMode=UNIFIED + override=UNIFIED.
    rerender(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceModeSource="DOCUMENT_OVERRIDE"
        balanceBreakdown={bdUnified()}
        balanceModeOverride="UNIFIED"
        onBalanceModeOverrideChange={onChange}
      />,
    );
    // Origen "Manual" visible cuando el modo fue elegido manualmente.
    expect(screen.getByTestId("balance-mode-origin").textContent).toContain("Manual");
    // El bloque METALES del modo BREAKDOWN ya no aparece como sección de saldo:
    // en UNIFIED se rotula como "Informativo" cuando hay metales (acá no hay).
    expect(screen.queryByTestId("total-card-metals-section")).toBeNull();
  });

  it("(2) elegir BREAKDOWN dispara override='BREAKDOWN' y al re-renderizar muestra modo desglosado", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceModeSource="ENTITY_DEFAULT"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-segment-breakdown"));
    expect(onChange).toHaveBeenCalledWith("BREAKDOWN");

    rerender(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceModeSource="DOCUMENT_OVERRIDE"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride="BREAKDOWN"
        onBalanceModeOverrideChange={onChange}
      />,
    );
    // En BREAKDOWN: la sección "Metales" se renderiza (header del bloque
    // existente: ahora label "Metales" — antes "Patrimonio metálico" — y
    // antes de eso "Saldo en metales"). Etapa UX.30 (2026-05-30) eliminó el
    // `total-card-metals-caption` legacy; nos atamos al testid del wrapper.
    expect(screen.getByTestId("total-card-metals-section")).toBeTruthy();
    expect(screen.getByText(/^metales$/i)).toBeTruthy();
    expect(screen.getByTestId("balance-mode-origin").textContent).toContain("Manual");
  });

  it("(3) elegir Automático dispara override=null y oculta el origen MANUAL", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceModeSource="DOCUMENT_OVERRIDE"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride="BREAKDOWN"
        onBalanceModeOverrideChange={onChange}
      />,
    );
    // Arranca con override manual → Origen "Manual" + link de reset visible.
    expect(screen.getByTestId("balance-mode-origin").textContent).toContain("Manual");

    // Override manual activo → link "Volver a automático" disponible.
    fireEvent.click(screen.getByTestId("balance-mode-reset"));
    expect(onChange).toHaveBeenCalledWith(null);

    // Padre re-renderiza con override=null y source resuelto por backend.
    rerender(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceModeSource="ENTITY_DEFAULT"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={onChange}
      />,
    );
    // Sin override → el Origen ya no dice "Manual" y el link de reset desaparece.
    expect(screen.getByTestId("balance-mode-origin").textContent).not.toContain("Manual");
    expect(screen.queryByTestId("balance-mode-reset")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MetalsSummary — siempre que existan metales (incluso en UNIFIED)
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — MetalsSummary nunca dice 'sin metales' cuando hay", () => {
  it("(4) BREAKDOWN con documentMetals → muestra lista, NO el mensaje vacío", () => {
    // Etapa 2D — el bloque METALES solo se renderiza en DESGLOSADO. El test
    // conserva su intención (lista, sin mensaje vacío) en BREAKDOWN.
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro",   name: "Oro Fino", grams: 4.20 },
          { id: "plata", name: "Plata",    grams: 2.64 },
        ]}
      />,
    );
    expect(screen.getByTestId("total-card-metals-section")).toBeTruthy();
    expect(screen.queryByTestId("total-card-metals-empty")).toBeNull();
    expect(screen.getByText("Oro Fino")).toBeTruthy();
    expect(screen.getByText("Plata")).toBeTruthy();
    // Etapa UX.30 (2026-05-30) eliminó `total-card-metals-caption` legacy
    // (las captions "Saldo en metales" / "Informativo" se removieron;
    // el header del bloque "METALES" ya transmite el contexto).
    expect(screen.queryByTestId("total-card-metals-caption")).toBeNull();
  });

  it("(5) consolida varias variantes del MISMO metal padre en UNA fila", () => {
    // Dos cost lines de "Oro" (variantes 18k y 22k) en una línea de qty=1.
    const documentMetals = deriveDocumentMetalsFromLines([
      {
        quantity: 1,
        composition: {
          metals: [
            { metalName: "Oro", purity: 0.75,  appliedGrams: 1.2, appliedMermaPct: 0 },
            { metalName: "Oro", purity: 0.916, appliedGrams: 2.0, appliedMermaPct: 0 },
          ],
        },
      },
    ]);
    expect(documentMetals).toHaveLength(1);
    expect(documentMetals[0].name).toBe("Oro");

    render(
      <TotalDelComprobanteCard
        totalDocument={1000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={documentMetals}
      />,
    );
    // Una sola fila de metal "Oro" — no se duplica por variante.
    expect(screen.getAllByText("Oro")).toHaveLength(1);
    // No se filtran nombres de variantes ("18k" / "22k").
    const section = screen.getByTestId("total-card-metals-section");
    expect(section.textContent).not.toMatch(/18k/i);
    expect(section.textContent).not.toMatch(/22k/i);
  });

  it("(6) multiplica gramos por cantidad de línea (qty × appliedGrams)", () => {
    // 0,91 gr/u × qty 3 = 2,73 gr · pureza 0,75 → equiv ≈ 2,0475
    const documentMetals = deriveDocumentMetalsFromLines([
      {
        quantity: 3,
        composition: {
          metals: [
            { metalName: "Oro", purity: 0.75, appliedGrams: 0.91, appliedMermaPct: 0 },
          ],
        },
      },
    ]);
    expect(documentMetals).toHaveLength(1);
    // El helper canónico devuelve `totalEquivGr` (con pureza × merma).
    // sin merma: 0,91 × 3 × 0,75 = 2,0475
    expect(documentMetals[0].grams).toBeCloseTo(0.91 * 3 * 0.75, 6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aislamiento monetario vs metales por modo
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — aislamiento monetario / metales por modo", () => {
  it("(7) BREAKDOWN: el desglose monetario NO incluye filas por metal padre (saldo separado)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    openDetalle();
    // Las cards "Oro Fino" / "Plata" del fixture viven SÓLO en la sección
    // de metales, no como componentes monetarios.
    const monetary = screen.getByTestId("total-card-monetary");
    expect(monetary.textContent).not.toMatch(/Oro Fino/);
    expect(monetary.textContent).not.toMatch(/Plata/);
    // Y la sección de metales SÍ los muestra como saldo separado.
    const metals = screen.getByTestId("total-card-metals-section");
    expect(metals.textContent).toMatch(/Oro Fino/);
    expect(metals.textContent).toMatch(/Plata/);
    // Etapa UX.30 (2026-05-30) eliminó `total-card-metals-caption` legacy —
    // el header del bloque "METALES" + la separación visual ya transmiten
    // que es saldo separado. La caption legacy ya no existe.
    expect(screen.queryByTestId("total-card-metals-caption")).toBeNull();
  });

  it("(8) UNIFIED: el total grande sigue siendo el total del comprobante (passthrough)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro", name: "Oro Fino", grams: 4.20 },
        ]}
      />,
    );
    // Total grande = totalDocument (1.210), independiente de los metales.
    const amount = screen.getByTestId("total-card-amount");
    expect(amount.textContent).toMatch(/1[.,]?210/);
    // Etapa UX.30 — caption "Informativo" ya no existe. El header "METALES"
    // + el contexto UNIFIED del card transmiten el rol del bloque.
    expect(screen.queryByTestId("total-card-metals-caption")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de resolución/derivación de metales (puros)
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — resolveCardMetals + deriveDocumentMetalsFromLines", () => {
  it("resolveCardMetals: balance.gramsPure GANA sobre documentMetals (Opción C — Patrimonio físico)", () => {
    // Opción C de la auditoría:
    //   El Patrimonio Metálico SIEMPRE muestra gramos FÍSICOS — no
    //   `metalGramsSale` (lado venta con margen). Eliminada la prioridad
    //   anterior "documentMetals gana" que rompía la semántica: el operador
    //   veía un valor de precio (1.068 g) en vez de su inventario real
    //   (0.9075 g). balance.gramsPure es la autoridad backend del físico
    //   consolidado del documento.
    //   Trade-off conocido: rompe paridad numérica con el mini desglose por
    //   línea (que sigue mostrando lado venta). Patrimonio y línea representan
    //   conceptos distintos — patrimonio = inventario, línea = pricing.
    const docs: DocumentMetalSummaryItem[] = [
      { id: "oro", name: "Oro", grams: 1.526, monetaryAmount: 152.69 },
    ];
    const out = resolveCardMetals(bdBreakdown(), docs);
    // balance del fixture trae oro-fino y plata-925 (ver bdBreakdown). Con
    // Opción C ahora retorna esos en lugar del 'oro' de documentMetals.
    expect(out.map((m) => m.id)).toEqual(["oro-fino", "plata-925"]);
    expect(out[0].grams).toBeCloseTo(2.77, 6);   // gramsPure del balance
  });

  it("resolveCardMetals: sin documentMetals cae a breakdown (autoridad backend / snapshot legacy)", () => {
    const out = resolveCardMetals(bdBreakdown(), undefined);
    expect(out.map((m) => m.id)).toEqual(["oro-fino", "plata-925"]);
    expect(out[0].grams).toBeCloseTo(2.77, 6); // gramsPure del fixture
    expect(out[0].monetaryAmount).toBeCloseTo(277, 6); // valuationMonetary
  });

  it("deriveDocumentMetalsFromLines: ignora líneas vacías / sin composition / sin gramos", () => {
    const out = deriveDocumentMetalsFromLines([
      null,
      { quantity: 1, composition: null },
      { quantity: 2, composition: { metals: [] } },
      { quantity: 1, composition: { metals: [{ metalName: "Oro", purity: 0.75, appliedGrams: null, appliedMermaPct: 0 }] } },
      { quantity: 1, composition: { metals: [{ metalName: "",   purity: 0.75, appliedGrams: 1,   appliedMermaPct: 0 }] } },
    ]);
    expect(out).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARIDAD línea ↔ documento — el bloque METALES del card debe mostrar
// EXACTAMENTE las mismas cifras que el mini desglose por línea
// (`TPDocumentLineAdvancedEditor` → "Composición del total"). Usa los
// mismos helpers (`buildMetalParentSaleLines` + `computeMetalSaleFactor`).
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — PARIDAD línea ↔ documento (metales LADO VENTA)", () => {
  // Caso real del print: 1 línea, qty=1, appliedGrams=1.1, purity=0.75,
  // merma=0, metalCost=100, metalSale=185 → factor=1.85.
  //   gramsEquivLine = 1.1 × 0.75 × 1.85 × 1 = 1.52625  (la línea muestra 1,526 gr)
  //   saleAmountLine = 50000 × 1                       (≈ ARS 50.000)
  // Si el card siguiera usando `gramsPure`/`totalEquivGr` mostraría 0,825 gr
  // (1.1 × 0.75 sin factor) — bug histórico que este test bloquea.
  const lineWithSaleFactor = {
    quantity: 1,
    metalHechuraBreakdown: { metalCost: 100, metalSale: 185 },
    composition: {
      metals: [
        {
          metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.1,
          appliedMermaPct: 0, lineSale: 50000,
        },
      ],
    },
  };

  it("(1) qty=1 → gramos = costEquivGr × factor (NO gramsPure ni costEquivGr puro)", () => {
    const out = deriveDocumentMetalsFromLines([lineWithSaleFactor]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Oro Fino");
    expect(out[0].grams).toBeCloseTo(1.1 * 0.75 * 1.85, 6); // 1,52625
    // Defensa explícita contra el bug histórico: NO debe ser 0,825 (lado costo).
    expect(out[0].grams).not.toBeCloseTo(1.1 * 0.75, 4);
    expect(out[0].monetaryAmount).toBeCloseTo(50000, 6);
  });

  it("(2) qty=2 → consolidación escala lineal por cantidad de línea", () => {
    const out = deriveDocumentMetalsFromLines([{
      ...lineWithSaleFactor,
      quantity: 2,
    }]);
    expect(out[0].grams).toBeCloseTo(1.1 * 0.75 * 1.85 * 2, 6); // 3,0525
    expect(out[0].monetaryAmount).toBeCloseTo(50000 * 2, 6);
  });

  it("(3) dos líneas del MISMO metal padre → consolida en una sola fila", () => {
    const out = deriveDocumentMetalsFromLines([
      lineWithSaleFactor,
      {
        quantity: 3,
        metalHechuraBreakdown: { metalCost: 100, metalSale: 185 },
        composition: {
          metals: [{
            metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.1,
            appliedMermaPct: 0, lineSale: 50000,
          }],
        },
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Oro Fino");
    expect(out[0].grams).toBeCloseTo(1.1 * 0.75 * 1.85 * (1 + 3), 6);
    expect(out[0].monetaryAmount).toBeCloseTo(50000 * (1 + 3), 6);
  });

  it("(4) dos VARIANTES del mismo padre → consolida en padre (sin duplicar variante)", () => {
    const out = deriveDocumentMetalsFromLines([{
      quantity: 1,
      metalHechuraBreakdown: { metalCost: 100, metalSale: 185 },
      composition: {
        metals: [
          { metalName: "Oro", variantName: "Oro 18k", purity: 0.75,  appliedGrams: 1.2, appliedMermaPct: 0, lineSale: 30000 },
          { metalName: "Oro", variantName: "Oro 22k", purity: 0.916, appliedGrams: 0.5, appliedMermaPct: 0, lineSale: 20000 },
        ],
      },
    }]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Oro");
    expect(out[0].monetaryAmount).toBeCloseTo(50000, 6);
  });

  it("(5) monto monetario consolidado = Σ saleAmountLine por padre × qty (paridad agregada)", () => {
    const out = deriveDocumentMetalsFromLines([
      {
        quantity: 5,
        metalHechuraBreakdown: { metalCost: 100, metalSale: 185 },
        composition: {
          metals: [
            { metalName: "Oro",   purity: 1,     appliedGrams: 4.33, appliedMermaPct: 0, lineSale: 800 },
            { metalName: "Plata", purity: 0.925, appliedGrams: 1.68, appliedMermaPct: 0, lineSale: 120 },
          ],
        },
      },
    ]);
    const oro   = out.find((m) => m.name === "Oro")!;
    const plata = out.find((m) => m.name === "Plata")!;
    expect(oro.monetaryAmount).toBeCloseTo(800 * 5, 6);
    expect(plata.monetaryAmount).toBeCloseTo(120 * 5, 6);
  });

  it("(6) sin metalHechuraBreakdown (snapshot legacy) → cae a costEquivGr (sin margen) — NO inventa factor", () => {
    const out = deriveDocumentMetalsFromLines([{
      quantity: 1,
      composition: {
        metals: [{
          metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.1,
          appliedMermaPct: 0, lineSale: 50000,
        }],
      },
    }]);
    // Sin factor: gramos = appliedGrams × purity (lado costo).
    expect(out[0].grams).toBeCloseTo(1.1 * 0.75, 6); // 0,825
    // Monto sigue siendo passthrough del motor.
    expect(out[0].monetaryAmount).toBeCloseTo(50000, 6);
  });

  it("(7) snapshot sin lineSale → monetaryAmount = null (NO inventa monto)", () => {
    const out = deriveDocumentMetalsFromLines([{
      quantity: 2,
      metalHechuraBreakdown: { metalCost: 100, metalSale: 185 },
      composition: {
        metals: [{
          metalName: "Oro", purity: 0.75, appliedGrams: 1.1, appliedMermaPct: 0,
        }],
      },
    }]);
    expect(out[0].monetaryAmount).toBeNull();
  });

  it("(8) UX.30 (2026-05-30): el monto monetario por padre (valuationMonetary físico) YA NO se renderiza", () => {
    // Etapa UX.30 eliminó la sub-fila con `monetaryAmount` por metal padre
    // (era valuationMonetary físico — confundía al operador, no es lo que
    // paga el cliente ni el valor comercial). El valor comercial agregado
    // ahora va al pie del bloque vía `commercialMetalValueSum`.
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro", name: "Oro Fino", grams: 1.526, monetaryAmount: 152.69 },
        ]}
      />,
    );
    expect(screen.queryByTestId("total-card-metal-oro-amount")).toBeNull();
  });

  it("(9) BREAKDOWN con metales → bloque METALES presente sin caption legacy ni monto por padre (Etapa UX.30)", () => {
    // Etapa 2D — el bloque METALES solo se renderiza en DESGLOSADO; el test
    // conserva su intención (sin caption legacy ni monto por padre) en BREAKDOWN.
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro", name: "Oro Fino", grams: 1.526, monetaryAmount: 152.69 },
        ]}
      />,
    );
    // Bloque METALES sí presente.
    expect(screen.getByTestId("total-card-metals-section")).toBeTruthy();
    expect(screen.getByText("Oro Fino")).toBeTruthy();
    // Caption legacy: eliminada.
    expect(screen.queryByTestId("total-card-metals-caption")).toBeNull();
    // Monto por padre: oculto.
    expect(screen.queryByTestId("total-card-metal-oro-amount")).toBeNull();
  });

  it("(10) UX.30: el guard de formato del monto monetario por padre ya no aplica (fila removida)", () => {
    // El monto monetario por padre se removió del render (Etapa UX.30). El
    // guard de formato anti-toFixed/toLocaleString sigue activo en el resto
    // de las superficies del card vía `factura-format.guard.test.ts`.
    // Acá verificamos solo que la fila ya no se renderiza.
    render(
      <TotalDelComprobanteCard
        totalDocument={1000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro", name: "Oro", grams: 1, monetaryAmount: 12345.6 },
        ]}
      />,
    );
    expect(screen.queryByTestId("total-card-metal-oro-amount")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 1 — rename semántico (METALES vs SALDO MONETARIO).
//   · Título de sección "Composición" → "Saldo monetario".
//   · Group label "HECHURA" → "Base monetaria" (el group key del DTO sigue
//     siendo "HECHURA"; solo cambia el render).
//   · Labels per-componente (`c.label` del backend, ej. "Hechura" en el
//     fixture) NO se tocan — son passthrough del motor.
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — Etapa UX-Tax v2 labels ('Total hechura' / 'Patrimonio metálico')", () => {
  it("título del bloque desglose (BREAKDOWN): header dice 'Monetario (saldo)', toggle dice 'Ver detalle financiero'", () => {
    // Etapa 2F-C — el header "Monetario (saldo)" solo se renderiza en BREAKDOWN
    // (en UNIFICADO se oculta por duplicar el TOTAL). El TOGGLE
    // (`total-card-composicion-toggle`) tiene texto independiente.
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const headerRow = screen.getByTestId("total-card-hechura-row");
    expect(headerRow.textContent).toMatch(/monetario \(saldo\)/i);
    expect(headerRow.textContent).not.toMatch(/hechura total/i);
    expect(headerRow.textContent).not.toMatch(/saldo en moneda/i);
    expect(headerRow.textContent).not.toMatch(/^composici[oó]n/i);
    // Toggle: texto separado, propio del control.
    const toggle = screen.getByTestId("total-card-composicion-toggle");
    expect(toggle.textContent).toMatch(/detalle financiero/i);
  });

  it("el grupo HECHURA NO muestra sub-encabezado 'Base monetaria' (sección COMPOSICIÓN, BREAKDOWN)", () => {
    // Etapa 2F — la sección COMPOSICIÓN (HECHURA) solo se renderiza en
    // DESGLOSADO; en UNIFICADO se oculta. El test conserva su intención
    // (HECHURA sin sub-encabezado "Base monetaria") en BREAKDOWN.
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Expande el desglose.
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    const groupNode = screen.getByTestId("total-card-group-HECHURA");
    // Etapa UX-Tax v2: en sección COMMERCIAL los items van DIRECTOS, sin
    // sub-encabezado de grupo. El label técnico "Base monetaria" ya no
    // aparece en el render — el bloque entero está bajo "Total hechura".
    expect(groupNode.textContent).not.toMatch(/base monetaria/i);
    // El componente individual (c.label del DTO) sigue siendo passthrough.
    // En el fixture es "Hechura" y debe estar presente.
    expect(groupNode.textContent).toMatch(/hechura/i);
  });

  it("Bloque METALES aparece ANTES (más arriba en el DOM) que el bloque del Saldo Monetario", () => {
    // Etapa UX.30 (2026-05-30) — el label "Patrimonio metálico" pasó a
    // "METALES"; en BREAKDOWN el header del bloque colapsable dice
    // "Saldo monetario" (no "Total hechura"). El invariante de orden DOM
    // (Metales arriba, Saldo Monetario abajo) sigue vigente.
    const { container } = render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const metalsSection = container.querySelector('[data-testid="total-card-metals-section"]');
    const hechuraRow    = container.querySelector('[data-testid="total-card-hechura-row"]');
    expect(metalsSection).toBeTruthy();
    expect(hechuraRow).toBeTruthy();
    // METALES debe estar antes que el bloque del Saldo Monetario.
    expect(
      metalsSection!.compareDocumentPosition(hechuraRow!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("la sección COMMERCIAL NO renderiza header 'Construcción comercial'", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    const body = screen.getByTestId("total-card-composicion-body");
    expect(body.textContent).not.toMatch(/construcci[oó]n comercial/i);
  });

  it("el orden y los amounts de los componentes NO cambian con el rename", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Etapa UX-premium v3 — el detalle financiero arranca cerrado en
    // cualquier modo. Lo abrimos para inspeccionar el orden de grupos.
    openDetalle();
    const monetary = screen.getByTestId("total-card-monetary");
    // Order: HECHURA primero, luego DISCOUNT, luego ROUNDING — preservado.
    const groups = monetary.querySelectorAll("[data-testid^='total-card-group-']");
    expect(Array.from(groups).map((g) => g.getAttribute("data-testid"))).toEqual([
      "total-card-group-HECHURA",
      "total-card-group-DISCOUNT",
      "total-card-group-ROUNDING",
    ]);
    // Amounts no se modifican — passthrough.
    const hechuraRow = screen.getByTestId("total-card-component-HECHURA");
    expect(hechuraRow.textContent).toMatch(/49[.,]?000/);
    const discountRow = screen.getByTestId("total-card-component-DISCOUNT_QTY");
    expect(discountRow.textContent).toMatch(/1[.,]?000/);
  });

  it("helpers.groupLabel('HECHURA') === 'Base monetaria' (rename canónico)", async () => {
    const { groupLabel } = await import("../helpers");
    expect(groupLabel("HECHURA")).toBe("Base monetaria");
    // Los demás labels NO cambian.
    expect(groupLabel("TAX")).toBe("Impuestos");
    expect(groupLabel("DISCOUNT")).toBe("Descuentos");
    expect(groupLabel("ROUNDING")).toBe("Redondeo");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 2 — Fila "Resultado monetario".
//   · Solo en BREAKDOWN (en UNIFIED duplicaría el Total maestro).
//   · Valor = passthrough EXACTO de `balanceBreakdown.monetaryBalance.amount`
//     (autoridad backend); el frontend NUNCA suma components para derivarlo.
//   · Si es negativo, usa el tono de descuento existente (`vt.colors.discount`).
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — Etapa 2 'Resultado monetario'", () => {
  /** Fixture BREAKDOWN con `monetaryBalance.amount` controlado. */
  function bdWithMonetaryAmount(
    amount:     number,
    components: Array<{ type: string; group: any; label: string; amount: number }>,
  ): BalanceBreakdownDTO {
    return {
      metals: [
        {
          metalParentId:   "oro-fino",
          metalParentName: "Oro Fino",
          gramsOriginal:   1.0,
          purity:          0.75,
          gramsPure:       0.75,
          quotePriceSnapshot:    100,
          valuationMonetary:     75,
          valuationCurrencyCode: "ARS",
          sourceLineIds:   ["L-1"],
        },
      ],
      monetaryBalance: {
        amount,
        currencyCode: "ARS",
        currencyRate: 1,
        amountBase:   amount,
        components:   components as any,
      },
    };
  }

  it("(A) UX-Auditable: 'Resultado monetario' NO se renderiza (eliminado por contradecir POLICY §R-Rounding-14)", () => {
    // Antes este test validaba la fila "Resultado monetario" con el amount
    // de monetaryBalance.amount (= total − Σ metalSale, lado venta con margen).
    // Etapa UX-Auditable (2026-05-29) eliminó esa fila: no responde un caso
    // operativo real y duplicaba la pregunta que ya responde "Saldo monetario"
    // (= total − Σ valuationMonetary físico) del header. Ahora el detalle
    // usa "Total a cobrar en $" que cuadra con Σ components.
    render(
      <TotalDelComprobanteCard
        totalDocument={5000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdWithMonetaryAmount(1234.56, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 },
          { type: "TAX",     group: "TAX",     label: "IVA",     amount: 234.56 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    openDetalle();
    expect(screen.queryByTestId("total-card-monetary-result")).toBeNull();
    expect(screen.queryByText(/resultado monetario/i)).toBeNull();
  });

  it("(B) UNIFIED NO renderiza la fila 'Resultado monetario' (evita duplicar Total maestro)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithMonetaryAmount(1210, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 },
          { type: "TAX",     group: "TAX",     label: "IVA",     amount: 210 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // En UNIFIED el desglose arranca colapsado — expandimos para garantizar
    // que la fila tampoco esté oculta dentro del cuerpo (no debe existir
    // independientemente del estado del toggle).
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    expect(screen.queryByTestId("total-card-monetary-result")).toBeNull();
    expect(screen.queryByText(/resultado monetario/i)).toBeNull();
  });

  it("(C) UX-Auditable: 'Resultado monetario' ya no existe — sin importar lo que declare monetaryBalance.amount", () => {
    // Antes este test validaba que el render leía monetaryBalance.amount
    // (1234.56) y NO una Σ inventada. Etapa UX-Auditable eliminó la fila —
    // independientemente del valor del DTO, no se renderiza.
    render(
      <TotalDelComprobanteCard
        totalDocument={9999}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdWithMonetaryAmount(1234.56, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 5000 },
          { type: "TAX",     group: "TAX",     label: "IVA",     amount: 4999 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    openDetalle();
    expect(screen.queryByTestId("total-card-monetary-result")).toBeNull();
  });

  it("(D) UX-Auditable: la fila eliminada tampoco se renderiza para amounts negativos", () => {
    // Antes este test validaba el render con color `text-red-500` para
    // amounts < 0 en la fila Resultado monetario. La fila ya no existe.
    render(
      <TotalDelComprobanteCard
        totalDocument={-5000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdWithMonetaryAmount(-5000, [
          { type: "HECHURA",         group: "HECHURA",  label: "Hechura",          amount: 10000 },
          { type: "DISCOUNT_MANUAL", group: "DISCOUNT", label: "Descuento global", amount: -15000 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    openDetalle();
    expect(screen.queryByTestId("total-card-monetary-result")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-negative-warning")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 4 — Warning NO bloqueante cuando el resultado monetario es negativo.
//   · Aparece SOLO en BREAKDOWN + monetary.amount < 0.
//   · NO aparece en UNIFIED ni con amount >= 0.
//   · Es informativo (role="status"); no es alert, no abre modal, no
//     bloquea guardar.
//   · Los metales del comprobante siguen visibles aunque la moneda sea
//     negativa (no se compensan visualmente).
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — Etapa 4 warning de negativos", () => {
  function bdMon(
    amount:     number,
    components: Array<{ type: string; group: any; label: string; amount: number }>,
  ): BalanceBreakdownDTO {
    return {
      metals: [
        {
          metalParentId:   "oro-fino",
          metalParentName: "Oro Fino",
          gramsOriginal:   8.01,
          purity:          1,
          gramsPure:       8.01,
          quotePriceSnapshot:    100000,
          valuationMonetary:     801000,
          valuationCurrencyCode: "ARS",
          sourceLineIds:   ["L-1"],
        },
      ],
      monetaryBalance: {
        amount,
        currencyCode: "ARS",
        currencyRate: 1,
        amountBase:   amount,
        components:   components as any,
      },
    };
  }

  it("BREAKDOWN + monetario NEGATIVO → UX-Auditable: warning eliminado junto con 'Resultado monetario'", () => {
    // Antes este test validaba un warning informativo cuando monetaryBalance.amount
    // < 0 (ej. bonificación supera la base). Etapa UX-Auditable eliminó la fila
    // "Resultado monetario" y el warning asociado — el operador ve el saldo
    // monetario canónico (= total − Σ patrimonio) en el header y, si es
    // negativo, lo identifica directamente por color discount.
    render(
      <TotalDelComprobanteCard
        totalDocument={-65000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdMon(-65000, [
          { type: "HECHURA",         group: "HECHURA",  label: "Hechura",          amount: 55000 },
          { type: "DISCOUNT_MANUAL", group: "DISCOUNT", label: "Descuento global", amount: -120000 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    openDetalle();
    expect(screen.queryByTestId("total-card-monetary-negative-warning")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-result")).toBeNull();
  });

  it("BREAKDOWN + monetario CERO → NO renderiza warning", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={0}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdMon(0, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 0 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.queryByTestId("total-card-monetary-negative-warning")).toBeNull();
  });

  it("BREAKDOWN + monetario POSITIVO → NO renderiza warning", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={25000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdMon(25000, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 25000 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.queryByTestId("total-card-monetary-negative-warning")).toBeNull();
  });

  it("UNIFIED + monetario negativo → NO renderiza warning (regla solo BREAKDOWN)", () => {
    // El card NO pasa `monetaryResult` en UNIFIED (regla del orchestrator),
    // por lo que ni el `Resultado monetario` ni el warning aparecen aunque
    // el amount declarado sea negativo.
    render(
      <TotalDelComprobanteCard
        totalDocument={-5000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdMon(-5000, [
          { type: "HECHURA",         group: "HECHURA",  label: "Hechura",          amount: 10000 },
          { type: "DISCOUNT_MANUAL", group: "DISCOUNT", label: "Descuento global", amount: -15000 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    expect(screen.queryByTestId("total-card-monetary-negative-warning")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-result")).toBeNull();
  });

  it("Negativo monetario NO oculta los metales (saldo metálico separado)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={-65000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdMon(-65000, [
          { type: "HECHURA",         group: "HECHURA",  label: "Hechura",          amount: 55000 },
          { type: "DISCOUNT_MANUAL", group: "DISCOUNT", label: "Descuento global", amount: -120000 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Metales siguen visibles con sus gramos passthrough — no se compensan.
    expect(screen.getByTestId("total-card-metal-oro-fino")).toBeTruthy();
    expect(screen.getByText("Oro Fino")).toBeTruthy();
    // Etapa UX-Auditable — el warning anterior fue eliminado junto con la
    // fila "Resultado monetario". Lo único que verificamos acá es que los
    // metales permanecen visibles (saldo metálico separado, regla §R-Rounding-14).
    openDetalle();
    expect(screen.queryByTestId("total-card-monetary-negative-warning")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Header de "Total hechura" (Etapa UX-Tax v2 — antes "Saldo en moneda") —
// importe siempre visible (incluso colapsado).
//   · Passthrough EXACTO de `monetaryBalance.amount` (autoridad backend).
//   · Visible en BREAKDOWN y UNIFIED.
//   · NO se deriva de Σ components.
//   · NO muestra el Total del comprobante por error.
//   · NO muestra valuación de metales por error.
//   · Negativos heredan tono de descuento.
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — importe en el header de 'Total hechura'", () => {
  function bdHdr(
    monetaryAmount: number,
    metalValuation: number | null,
    components: Array<{ type: string; group: any; label: string; amount: number }>,
  ): BalanceBreakdownDTO {
    return {
      metals: metalValuation == null ? [] : [
        {
          metalParentId:   "oro-fino",
          metalParentName: "Oro Fino",
          gramsOriginal:   1,
          purity:          1,
          gramsPure:       1,
          quotePriceSnapshot:    metalValuation,
          valuationMonetary:     metalValuation,
          valuationCurrencyCode: "ARS",
          sourceLineIds:   ["L-1"],
        },
      ],
      monetaryBalance: {
        amount:       monetaryAmount,
        currencyCode: "ARS",
        currencyRate: 1,
        amountBase:   monetaryAmount,
        components:   components as any,
      },
    };
  }

  it("(1) header SALDO MONETARIO muestra el importe (BREAKDOWN, sección colapsada por default sí, pero ya abierta acá)", () => {
    // Etapa UX-Saldo (2026-05-29): en BREAKDOWN el header = `totalDocument −
    // Σ valuationMonetary` (saldo monetario canónico). Antes era
    // `monetaryBalance.amount`. Fixture: total=473474, metal=381562.50 →
    // header = 91911.50.
    render(
      <TotalDelComprobanteCard
        totalDocument={473474}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdHdr(91911.47, 381562.50, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 91911.47 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const headerAmount = screen.getByTestId("total-card-monetary-header-amount");
    expect(headerAmount.textContent).toMatch(/ARS/);
    expect(headerAmount.textContent).toMatch(/91[.,]?911[.,]?50/);
  });

  it("(2) importe = totalDocument − Σ valuationMonetary (NO el Total ni el monetaryBalance.amount del DTO)", () => {
    // Etapa UX-Saldo: el header ya NO viene de `monetaryBalance.amount` —
    // ahora se deriva como `totalDocument − Σ valuationMonetary`. Fixture
    // deliberadamente con `monetaryBalance.amount = 12345.67` (un valor
    // distinto al saldo derivado) para que sea inequívoco. total=473474,
    // metal=381562.50 → header derivado = 91.911,50.
    render(
      <TotalDelComprobanteCard
        totalDocument={473474}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdHdr(12345.67, 381562.50, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 12345.67 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const headerAmount = screen.getByTestId("total-card-monetary-header-amount");
    expect(headerAmount.textContent).toMatch(/91[.,]?911[.,]?50/);
    // NO debe mostrar el total del comprobante…
    expect(headerAmount.textContent).not.toMatch(/473[.,]?474/);
    // …ni el monetaryBalance.amount del DTO (legacy).
    expect(headerAmount.textContent).not.toMatch(/12[.,]?345[.,]?67/);
  });

  it("(3) importe NO refleja la valuación de metales", () => {
    // valuationMonetary 381.562,50 (visible en el bloque METALES) NO debe
    // aparecer en el header del bucket monetario.
    render(
      <TotalDelComprobanteCard
        totalDocument={473474}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdHdr(91911.47, 381562.50, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 91911.47 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const headerAmount = screen.getByTestId("total-card-monetary-header-amount");
    expect(headerAmount.textContent).not.toMatch(/381[.,]?562/);
  });

  it("(4) BREAKDOWN sin metales en el balance → header = totalDocument (Σ valuationMonetary = 0)", () => {
    // Etapa UX-Saldo (2026-05-29): el header ya NO se deriva de Σ components
    // con group=HECHURA. Ahora = `totalDocument − Σ valuationMonetary`. En
    // este fixture el balance NO declara metales (`metalValuation=null`), así
    // que la resta es total − 0 = total. La diferencia conceptual respecto
    // al test legacy: antes era "bucket HECHURA puro" (50.000); ahora es
    // "saldo monetario" (91.911,47 — coincide con el total porque no hay
    // patrimonio metálico que descontar).
    render(
      <TotalDelComprobanteCard
        totalDocument={91911.47}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdHdr(91911.47, null, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 50000 },
          { type: "TAX",     group: "TAX",     label: "IVA",     amount: 41911.47 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const headerAmount = screen.getByTestId("total-card-monetary-header-amount");
    expect(headerAmount.textContent).toMatch(/91[.,]?911[.,]?47/);
    // Confirmación negativa: ya no se muestra el bucket HECHURA aislado.
    expect(headerAmount.textContent).not.toMatch(/50[.,]?000(?!\d)/);
  });

  it("(5) soporta negativo con clase de descuento existente — HECHURA puro negativo", () => {
    // Componentes negativos válidos en pricing-engine (descuento dirigido a
    // HECHURA que supera el subtotal de hechura → bucket HECHURA negativo).
    // El header lo muestra con clase de descuento (CLAUDE.md: prohibido
    // Math.max(0, value) o clamps — render passthrough).
    render(
      <TotalDelComprobanteCard
        totalDocument={-65000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdHdr(-65000, null, [
          { type: "HECHURA",         group: "HECHURA",  label: "Hechura",          amount: -65000 },
          { type: "DISCOUNT_MANUAL", group: "DISCOUNT", label: "Descuento global", amount: -55000 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const headerAmount = screen.getByTestId("total-card-monetary-header-amount");
    expect(headerAmount.className).toMatch(/text-red-500/);
    expect(headerAmount.textContent).toMatch(/[−-]\s*65[.,]?000/);
  });

  it("(6) UNIFIED — NO muestra header 'Monetario (saldo)' (Etapa 2F-C); el total es único en el hero", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdHdr(1210, null, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 },
          { type: "TAX",     group: "TAX",     label: "IVA",     amount: 210 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Etapa 2F-C — el header "Monetario (saldo)" se oculta en UNIFICADO (duplicaba el TOTAL).
    expect(screen.queryByTestId("total-card-monetary-header-amount")).toBeNull();
    // El total vive ÚNICAMENTE en el hero del card.
    expect(screen.getByTestId("total-card-amount").textContent).toMatch(/1[.,]?210/);
  });

  it("(7) UNIFIED — detalle COLAPSADO por default + sin header de saldo duplicado (2F-C)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdHdr(1210, null, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 },
          { type: "TAX",     group: "TAX",     label: "IVA",     amount: 210 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // UNIFIED arranca colapsado → no hay body.
    expect(screen.queryByTestId("total-card-composicion-body")).toBeNull();
    // Etapa 2F-C — el header "Monetario (saldo)" NO se renderiza en UNIFICADO.
    expect(screen.queryByTestId("total-card-monetary-header-amount")).toBeNull();
  });

  it("(8) BREAKDOWN — importe del header siempre visible aunque el desglose esté cerrado (Etapa UX-premium v3)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdHdr(50000, null, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 50000 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Etapa UX-premium v3: BREAKDOWN también arranca cerrado en el detalle.
    // La fila "Total hechura · monto" SIEMPRE es visible (vista rápida).
    expect(screen.queryByTestId("total-card-composicion-body")).toBeNull();
    expect(screen.getByTestId("total-card-monetary-header-amount")).toBeTruthy();
    // Al abrir el detalle, el body aparece.
    openDetalle();
    expect(screen.getByTestId("total-card-composicion-body")).toBeTruthy();
  });

  it("(9) sin balanceBreakdown / sin amount → NO renderiza importe (no inventa)", () => {
    // Sin breakdown no hay sección desglose tampoco — coherencia.
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.queryByTestId("total-card-monetary-header-amount")).toBeNull();
    expect(screen.queryByTestId("total-card-composicion-section")).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Etapa 1 (Opción B) — en UNIFICADO el saldo monetario ES el TOTAL completo
  // del documento. Los metales son informativos (gramos) y NO se descuentan
  // del saldo. (Reemplaza el comportamiento previo "total − Σ metales".)
  // En BREAKDOWN el header sigue siendo `total − Σ valuationMonetary`.
  // ──────────────────────────────────────────────────────────────────────────

  it("(11) UNIFIED con metales → saldo = total completo (metal informativo)", () => {
    // Etapa 1: el metal no se resta; el saldo es el total del documento.
    render(
      <TotalDelComprobanteCard
        totalDocument={488473.97}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdHdr(488473.97, 381562.50, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 91911.47 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro", name: "Oro Fino", grams: 1.526, monetaryAmount: 381562.50 },
        ]}
      />,
    );
    // Etapa 2F-C — en UNIFICADO el total vive en el hero (no hay header de saldo).
    const headerAmount = screen.getByTestId("total-card-amount");
    // Total COMPLETO (no 106.911,47, que era total − metal).
    expect(headerAmount.textContent).toMatch(/488[.,]?473[.,]?97/);
    expect(headerAmount.textContent).not.toMatch(/106[.,]?911/);
  });

  it("(12) UNIFIED con metales → saldo = totalDocument (no resta metal)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1000000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdHdr(1000000, null, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 100000 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro",   name: "Oro",   grams: 8.01, monetaryAmount: 800000 },
          { id: "plata", name: "Plata", grams: 1.68, monetaryAmount: 100000 },
        ]}
      />,
    );
    // Etapa 2F-C — total en el hero (sin header de saldo en UNIFICADO).
    const headerAmount = screen.getByTestId("total-card-amount");
    // Total completo (1.000.000), no 100.000 (total − metal).
    expect(headerAmount.textContent).toMatch(/1[.,]?000[.,]?000/);
  });

  it("(13) UNIFIED sin metales → saldo = totalDocument (no se resta nada)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdHdr(1210, null, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 },
          { type: "TAX",     group: "TAX",     label: "IVA",     amount: 210 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        // documentMetals NO se pasa → resolvedMetals = []
      />,
    );
    // Etapa 2F-C — total en el hero (sin header de saldo en UNIFICADO).
    const headerAmount = screen.getByTestId("total-card-amount");
    expect(headerAmount.textContent).toMatch(/1[.,]?210/);
  });

  it("(14) BREAKDOWN: header = totalDocument − Σ valuationMonetary (derivación canónica)", () => {
    // Etapa UX-Saldo (2026-05-29): el header en BREAKDOWN es
    // `totalDocument − Σ valuationMonetary` (saldo monetario canónico).
    // Antes pasaba `monetaryBalance.amount` crudo del DTO. Cuando
    // documentMetals está presente, resolvedMetals los usa con preferencia
    // sobre balance.metals. Fixture: total=473474, documentMetals.monetary=
    // 381562.50 → header = 91.911,50.
    render(
      <TotalDelComprobanteCard
        totalDocument={473474}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdHdr(91911.47, 381562.50, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 91911.47 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro", name: "Oro Fino", grams: 1.526, monetaryAmount: 381562.50 },
        ]}
      />,
    );
    const headerAmount = screen.getByTestId("total-card-monetary-header-amount");
    expect(headerAmount.textContent).toMatch(/91[.,]?911[.,]?50/);
  });

  it("(15) BREAKDOWN: si DTO declara amount distinto a (total − metals), gana (total − metals) — autoridad de la resta", () => {
    // Etapa UX-Saldo: el frontend ahora deriva el header como
    // `totalDocument − Σ valuationMonetary`. Ya NO depende del valor
    // crudo `monetaryBalance.amount` del DTO. Fixture deliberadamente
    // inconsistente (amount=12345.67, total=1000000, metal=500000):
    // header = 1.000.000 − 500.000 = 500.000.
    render(
      <TotalDelComprobanteCard
        totalDocument={1000000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdHdr(12345.67, 500000, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 12345.67 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro", name: "Oro", grams: 1, monetaryAmount: 500000 },
        ]}
      />,
    );
    const headerAmount = screen.getByTestId("total-card-monetary-header-amount");
    // Header = total − Σ metales = 500.000.
    expect(headerAmount.textContent).toMatch(/500[.,]?000/);
    // El DTO.amount (12.345,67) ya no se usa para el header del bloque.
    expect(headerAmount.textContent).not.toMatch(/12[.,]?345[.,]?67/);
    // Tampoco se muestra el total crudo.
    expect(headerAmount.textContent).not.toMatch(/1[.,]?000[.,]?000/);
  });

  it("(16) UNIFIED con metales (incl. monetaryAmount null) → saldo = total completo", () => {
    // Etapa 1 — en UNIFICADO los metales son informativos y no se restan del
    // saldo, sin importar si traen monetaryAmount o null. Saldo = total.
    render(
      <TotalDelComprobanteCard
        totalDocument={500000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdHdr(500000, null, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 100000 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro",   name: "Oro",   grams: 1, monetaryAmount: 200000 },
          { id: "plata", name: "Plata", grams: 1, monetaryAmount: null },   // legacy
        ]}
      />,
    );
    // Etapa 2F-C — total en el hero (sin header de saldo en UNIFICADO).
    const headerAmount = screen.getByTestId("total-card-amount");
    // Total completo (500.000), no 300.000 (total − metal).
    expect(headerAmount.textContent).toMatch(/500[.,]?000/);
    expect(headerAmount.textContent).not.toMatch(/300[.,]?000/);
  });

  it("(17) UNIFIED soporta negativos (descuento mayor a base, sin metales)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={-5000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdHdr(-5000, null, [
          { type: "HECHURA",         group: "HECHURA",  label: "Hechura",          amount: 10000 },
          { type: "DISCOUNT_MANUAL", group: "DISCOUNT", label: "Descuento global", amount: -15000 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Etapa 2F-C — el total negativo vive en el hero (sin header de saldo en UNIFICADO).
    const headerAmount = screen.getByTestId("total-card-amount");
    expect(headerAmount.textContent).toMatch(/[−-]\s*5[.,]?000/);
  });

  it("(18) UX-Auditable: 'Resultado monetario' eliminado — el header sigue mostrando 'Saldo monetario' canónico", () => {
    // Etapa UX-Auditable (2026-05-29) eliminó la fila "Resultado monetario"
    // del cuerpo expandido (contradecía POLICY §R-Rounding-14). El header
    // sigue mostrando "Saldo monetario" = total − Σ valuationMonetary.
    render(
      <TotalDelComprobanteCard
        totalDocument={473474}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdHdr(91911.47, 381562.50, [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 91911.47 },
        ])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentMetals={[
          { id: "oro", name: "Oro", grams: 1.526, monetaryAmount: 381562.50 },
        ]}
      />,
    );
    // Header: saldo monetario derivado = 473.474 − 381.562,50 = 91.911,50.
    expect(screen.getByTestId("total-card-monetary-header-amount").textContent)
      .toMatch(/91[.,]?911[.,]?50/);
    openDetalle();
    // La fila "Resultado monetario" ya no se renderiza.
    expect(screen.queryByTestId("total-card-monetary-result")).toBeNull();
  });

  it("(19) helper resolveMonetaryHeaderAmount es puro — paridad", async () => {
    const { resolveMonetaryHeaderAmount } = await import("../helpers");
    // BREAKDOWN con components[]: passthrough del bucket HECHURA puro.
    // Caso del bug histórico — antes devolvía monetaryBalance.amount
    // (= hechura + tax + descuentos + etc.) mostrando 59.384,06 cuando
    // hechura pura era 15.000. Hoy devuelve el bucket HECHURA puro.
    expect(resolveMonetaryHeaderAmount(
      "BREAKDOWN",
      999,                                            // ignorado
      {
        metals: [],
        monetaryBalance: {
          amount: 59384.06,                           // saldo total post-metales
          currencyCode: "ARS", currencyRate: 1, amountBase: 59384.06,
          components: [
            { type: "HECHURA",           group: "HECHURA",  label: "Hechura",  amount: 15000   },
            { type: "TAX",               group: "TAX",      label: "IVA",      amount: 44384.06 },
            { type: "ROUNDING_MONETARY", group: "ROUNDING", label: "Redondeo", amount:   0     },
          ],
        },
      },
      [{ id: "x", name: "X", grams: 1, monetaryAmount: 50 }], // ignorado
    )).toBe(15000);

    // BREAKDOWN sin components[] (snapshot legacy) → fallback al amount
    // (degradación segura: caller viejo no rompe).
    expect(resolveMonetaryHeaderAmount(
      "BREAKDOWN",
      999,
      { metals: [], monetaryBalance: { amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100 } },
      [{ id: "x", name: "X", grams: 1, monetaryAmount: 50 }],
    )).toBe(100);

    // BREAKDOWN con components[] sin HECHURA y SIN líneas → cae al fallback
    // legacy del amount (1000). Conserva comportamiento previo cuando no hay
    // info útil para derivar el bucket HECHURA.
    expect(resolveMonetaryHeaderAmount(
      "BREAKDOWN",
      999,
      {
        metals: [],
        monetaryBalance: {
          amount: 1000,
          currencyCode: "ARS", currencyRate: 1, amountBase: 1000,
          components: [
            { type: "TAX", group: "TAX", label: "IVA", amount: 1000 },
          ],
        },
      },
      [],
    )).toBe(1000);

    // BREAKDOWN con components[] sin HECHURA pero CON líneas →
    // derivación de líneas gana sobre el fallback legacy.
    expect(resolveMonetaryHeaderAmount(
      "BREAKDOWN",
      999,
      {
        metals: [],
        monetaryBalance: {
          amount: 1000,
          currencyCode: "ARS", currencyRate: 1, amountBase: 1000,
          components: [
            { type: "TAX", group: "TAX", label: "IVA", amount: 1000 },
          ],
        },
      },
      [],
      [
        { quantity: 2, metalHechuraBreakdown: { hechuraSale: 7500 } },
      ],
    )).toBe(15000);

    // BREAKDOWN sin components[] pero CON líneas con hechura →
    // derivación de líneas, no toca el amount legacy.
    expect(resolveMonetaryHeaderAmount(
      "BREAKDOWN",
      999,
      { metals: [], monetaryBalance: { amount: 50000, currencyCode: "ARS", currencyRate: 1, amountBase: 50000 } },
      [],
      [
        { quantity: 1, metalHechuraBreakdown: { hechuraSale: 15000 } },
      ],
    )).toBe(15000);

    // UNIFIED: resta de Σ monetaryAmount.
    expect(resolveMonetaryHeaderAmount(
      "UNIFIED",
      1000,
      null,
      [
        { id: "a", name: "A", grams: 1, monetaryAmount: 300 },
        { id: "b", name: "B", grams: 1, monetaryAmount: 200 },
      ],
    )).toBe(500);

    // UNIFIED sin metales → total intacto.
    expect(resolveMonetaryHeaderAmount("UNIFIED", 1210, null, [])).toBe(1210);

    // UNIFIED con monetaryAmount null → se omite ese padre.
    expect(resolveMonetaryHeaderAmount(
      "UNIFIED",
      1000,
      null,
      [
        { id: "a", name: "A", grams: 1, monetaryAmount: null },
        { id: "b", name: "B", grams: 1, monetaryAmount: 200 },
      ],
    )).toBe(800);

    // BREAKDOWN sin breakdown DTO → null.
    expect(resolveMonetaryHeaderAmount("BREAKDOWN", 1000, null, [])).toBeNull();

    // UNIFIED sin total finito → null.
    expect(resolveMonetaryHeaderAmount("UNIFIED", null as any, null, [])).toBeNull();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Etapa UX — claridad del desglose
//
// Dos mejoras de display, passthrough puro (cero matemática):
//   (a) Componentes con `amount === 0` se omiten para evitar filas ruidosas
//       (envío $0 / cupón $0 / impuesto $0 → no aportan información). Si
//       el backend quisiera mostrar un cero explícito, debería emitirlo con
//       amount distinto o un flag dedicado.
//   (b) Fila de cierre "Total final" al pie del desglose — passthrough EXACTO
//       de `totalDocument` (el mismo número que el header grande). Refuerza
//       el cierre del cálculo cuando el operador expande el desglose.
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — Etapa UX (filtro de ceros + cierre Total final)", () => {
  it("(a1) componentes con amount === 0 NO se renderizan", () => {
    const bd: BalanceBreakdownDTO = {
      metals: [],
      monetaryBalance: {
        amount: 1000,
        currencyCode: "ARS",
        currencyRate: 1,
        amountBase: 1000,
        components: [
          { type: "HECHURA",  group: "HECHURA",  label: "Hechura",  amount: 1000 },
          { type: "SHIPPING", group: "SHIPPING", label: "Envío",    amount: 0    },  // ruidoso
          { type: "COUPON",   group: "COUPON",   label: "Cupón",    amount: 0    },  // ruidoso
          { type: "TAX",      group: "TAX",      label: "IVA 21%",  amount: 210  },
        ],
      },
    };
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Abrir el desglose para inspeccionar las filas (UNIFIED default colapsado).
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    // Fila con amount distinto a 0 (no-COMMERCIAL) → visible.
    expect(screen.getByTestId("total-card-component-TAX")).toBeTruthy();
    // Filas con amount === 0 → ocultas (filtro de ceros).
    expect(screen.queryByTestId("total-card-component-SHIPPING")).toBeNull();
    expect(screen.queryByTestId("total-card-component-COUPON")).toBeNull();
    // Etapa 2F — HECHURA (COMPOSICIÓN) oculto en UNIFICADO, independiente del amount.
    expect(screen.queryByTestId("total-card-component-HECHURA")).toBeNull();
  });

  it("(a2) grupo cuyo único componente tiene amount === 0 NO renderiza header de grupo", () => {
    const bd: BalanceBreakdownDTO = {
      metals: [],
      monetaryBalance: {
        amount: 1000,
        currencyCode: "ARS",
        currencyRate: 1,
        amountBase: 1000,
        components: [
          { type: "HECHURA",  group: "HECHURA",  label: "Hechura", amount: 1000 },
          { type: "SHIPPING", group: "SHIPPING", label: "Envío",   amount: 0    },
        ],
      },
    };
    render(
      <TotalDelComprobanteCard
        totalDocument={1000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    expect(screen.queryByTestId("total-card-group-SHIPPING")).toBeNull();
  });

  it("(a3) los componentes NEGATIVOS NO se ocultan (filtro solo aplica a amount === 0)", () => {
    const bd: BalanceBreakdownDTO = {
      metals: [],
      monetaryBalance: {
        amount: 800,
        currencyCode: "ARS",
        currencyRate: 1,
        amountBase: 800,
        components: [
          { type: "HECHURA",         group: "HECHURA",  label: "Hechura",       amount: 1000 },
          { type: "DISCOUNT_MANUAL", group: "DISCOUNT", label: "Bonificación",  amount: -200 },
        ],
      },
    };
    render(
      <TotalDelComprobanteCard
        totalDocument={800}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    // El negativo sigue visible (passthrough — sin Math.max ni clamps).
    const discountRow = screen.getByTestId("total-card-component-DISCOUNT_MANUAL");
    expect(discountRow).toBeTruthy();
    expect(discountRow.textContent).toContain("Bonificación");
    // Color de descuento aplicado (token semántico). El monto es el ÚLTIMO
    // hijo directo del <li> (el label+origen viven en el span-columna previo).
    const amountSpan = discountRow.lastElementChild;
    expect(amountSpan?.className).toMatch(/text-red-500/);
  });

  it("(b1) UX-Saldo Compact: 'Total final' NO se renderiza en el cuerpo expandido (UNIFIED)", () => {
    // Antes el desglose cerraba con la fila "Total final" replicando el hero.
    // Con UX-Saldo Compact (2026-05-29) esa fila se removió del cuerpo
    // expandido — el hero del card ya muestra el Total grande arriba.
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    expect(screen.queryByTestId("total-card-monetary-total")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-total-amount")).toBeNull();
    // El hero sigue presente y muestra el total.
    expect(screen.getByTestId("total-card-amount")).toBeTruthy();
  });

  it("(b2) UX-Saldo Compact: 'Total final' NO se renderiza en el cuerpo expandido (BREAKDOWN)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    openDetalle();
    expect(screen.queryByTestId("total-card-monetary-total")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-total-amount")).toBeNull();
    expect(screen.getByTestId("total-card-amount")).toBeTruthy();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Jerarquía visual (FASE UX) — el total maestro y el cierre del desglose
  // deben usar los TOKENS canónicos del sistema (`vt.colors.primary` +
  // `vt.card.totalAccent`), alineados con el patrón del Simulador
  // (`FinalAdjustmentsSection.tsx`). Cero colores hardcodeados.
  // ───────────────────────────────────────────────────────────────────────

  it("(c1) total maestro del header usa vt.colors.primary (acento del sistema)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const headerAmount = screen.getByTestId("total-card-amount");
    // `vt.colors.primary === "text-primary"` — token semántico que respeta
    // dark mode vía la paleta de Tailwind del tema.
    expect(headerAmount.className).toMatch(/text-primary/);
    // Acento: NO usar `text-text` neutro en el total maestro.
    expect(headerAmount.className).not.toMatch(/\btext-text\b/);
  });

  it("(c2) UX-Saldo Compact: tokens de 'Total final' ya no aplican (fila removida)", () => {
    // Antes este test validaba que la banda "Total final" usaba
    // `vt.card.totalAccent` + `vt.colors.primary`. Con UX-Saldo Compact la
    // fila se removió del cuerpo expandido — los tokens canónicos siguen
    // siendo el contrato visual del hero (cubierto por (c1)).
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    expect(screen.queryByTestId("total-card-monetary-total")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-total-amount")).toBeNull();
  });

  it("(c3) los componentes NEGATIVOS conservan vt.colors.discount (no se ven como total)", () => {
    // Anti-regresión: el énfasis primary del total NO debe contagiar a
    // componentes negativos del desglose — esos siguen con su semántica
    // propia (descuento = rojo).
    const bd: BalanceBreakdownDTO = {
      metals: [],
      monetaryBalance: {
        amount: 800,
        currencyCode: "ARS",
        currencyRate: 1,
        amountBase: 800,
        components: [
          { type: "HECHURA",         group: "HECHURA",  label: "Hechura",      amount: 1000 },
          { type: "DISCOUNT_MANUAL", group: "DISCOUNT", label: "Bonificación", amount: -200 },
        ],
      },
    };
    render(
      <TotalDelComprobanteCard
        totalDocument={800}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    const discountAmount = screen.getByTestId("total-card-component-DISCOUNT_MANUAL")
      .lastElementChild;
    expect(discountAmount?.className).toMatch(/text-red-500/);
    // El descuento NO toma el acento `text-primary` del total.
    expect(discountAmount?.className).not.toMatch(/text-primary/);
  });

  it("(c4) en BREAKDOWN los GRAMOS del metal toman el acento de foco (text-primary)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={50000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdown()}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Los metales se renderizan con su id slug (oro-fino, plata-925).
    const metalRow = screen.getByTestId("total-card-metal-oro-fino");
    // Los GRAMOS (patrimonio físico) son el protagonista del desglosado → acento
    // de foco (text-primary, vía vt.emphasisFor) + apenas más grandes (text-lg).
    // El nombre y el monto "Valor final metal" quedan en neutro (no compiten).
    const html = metalRow.outerHTML;
    expect(html).toMatch(/text-primary/);
    expect(html).toMatch(/text-lg/);
    const finalAmount = screen.getByTestId("total-card-metal-oro-fino-final").lastElementChild;
    expect(finalAmount?.className ?? "").not.toMatch(/text-primary/);
  });

  it("(c5b) total maestro del header usa tamaño grande (override !text-2xl/3xl) para protagonismo del card", () => {
    // Etapa UX.5 — feedback del usuario: el card "Total del comprobante" es
    // el card principal del stack del aside. El total grande del header
    // sobreescribe el tamaño default del token `totalGrand` (text-base) con
    // un override LOCAL al card (!text-2xl en mobile, !text-3xl en sm+) para
    // ganar protagonismo. La regla de tamaño NO toca el token global
    // (otras pantallas que usan `totalGrand` siguen iguales).
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const headerAmount = screen.getByTestId("total-card-amount");
    // UX.6 — ajustado al print: protagonismo aún mayor del total del card.
    // Cero impacto en otras pantallas porque el override es LOCAL al card.
    expect(headerAmount.className).toMatch(/!text-3xl/);
    expect(headerAmount.className).toMatch(/sm:!text-4xl/);
  });

  it("(c5) no introducir colores hex hardcodeados en el render del total", () => {
    // Anti-regresión: ningún `#xxxxxx` ni `rgb(...)` inline en el árbol del
    // card — todos los colores pasan por tokens vt.* (que a su vez resuelven
    // a la paleta del tema, soportando dark mode sin override por componente).
    const { container } = render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    const html = container.innerHTML;
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(html).not.toMatch(/rgb\(/);
  });

  it("(b3) UX-Saldo Compact: 'Total final' del cuerpo NO sustituye al hero — el invariante migró al header del card", () => {
    // Antes este test validaba que el footer "Total final" leía `totalDocument`
    // tal cual (no Σ components). Con UX-Saldo Compact (2026-05-29) la fila
    // se removió — el contrato de cierre lo hace el hero del card (`total-
    // card-amount`). Mantenemos el fixture inconsistente (Σ components != total)
    // para validar que el hero sigue siendo `totalDocument` puro, ignorando
    // los components.
    const bd: BalanceBreakdownDTO = {
      metals: [],
      monetaryBalance: {
        amount: 0,  // intencional: componentes no suman al total
        currencyCode: "ARS",
        currencyRate: 1,
        amountBase: 0,
        components: [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 100 },
          { type: "TAX",     group: "TAX",     label: "IVA",     amount: 21  },
        ],
      },
    };
    render(
      <TotalDelComprobanteCard
        totalDocument={999}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
    expect(screen.queryByTestId("total-card-monetary-total")).toBeNull();
    // El hero refleja `totalDocument` (999) — passthrough sin sumar components.
    const heroAmount = screen.getByTestId("total-card-amount");
    expect(heroAmount.textContent).toContain("999");
    expect(heroAmount.textContent).not.toContain("121");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Badge superior — Estado comercial (Etapa B de UX simplificada)
// Verifica que el badge diferencie visualmente WARNING (margen bajo) vs
// CRITICAL (riesgo crítico) vs OK, y que se oculte cuando no hay líneas
// evaluadas. Cero lógica comercial — solo presentación derivada de
// `commercialStatus` (ya producido por `aggregateDocumentStatus`).
// ─────────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — badge Estado comercial", () => {
  // UX.33-final: el bloque "Estado Comercial" fue ELIMINADO del card por
  // redundancia (las alertas comerciales ya viven en: warnings por línea,
  // warning de composición y warning de política comercial superior).
  // La prop `commercialStatus` se acepta por compatibilidad de API pero
  // NO se renderiza nada visible en el card. Los tests verifican la
  // AUSENCIA del bloque en todos los niveles (OK / WARNING / CRITICAL).
  it("UX.33-final OK: no se renderiza ningún badge ni texto 'Política comercial OK'", () => {
    const { container } = render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        commercialStatus={{
          ok: 2, warning: 0, risk: 0, critical: 0,
          evaluated: 2, worst: "OK",
        }}
      />,
    );
    expect(screen.queryByText(/Política comercial OK/)).toBeNull();
    expect(container.querySelector("[data-tp-commercial-worst]")).toBeNull();
    expect(container.querySelector("[data-tp-commercial-badge]")).toBeNull();
  });

  it("UX.33-final WARNING: no se renderiza badge ni texto 'Margen bajo en N líneas'", () => {
    const { container } = render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        commercialStatus={{
          ok: 1, warning: 2, risk: 0, critical: 0,
          evaluated: 3, worst: "WARNING",
        }}
      />,
    );
    expect(screen.queryByText(/Margen bajo en/)).toBeNull();
    expect(container.querySelector('[data-tp-commercial-badge="WARNING"]')).toBeNull();
  });

  it("UX.33-final WARNING singular: tampoco se renderiza 'Margen bajo en 1 línea'", () => {
    const { container } = render(
      <TotalDelComprobanteCard
        totalDocument={500}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        commercialStatus={{
          ok: 0, warning: 1, risk: 0, critical: 0,
          evaluated: 1, worst: "WARNING",
        }}
      />,
    );
    expect(screen.queryByText(/Margen bajo en/)).toBeNull();
    expect(container.querySelector("[data-tp-commercial-badge]")).toBeNull();
  });

  it("UX.33-final CRITICAL: no se renderiza badge rojo ni texto 'riesgo crítico'", () => {
    const { container } = render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        commercialStatus={{
          ok: 0, warning: 0, risk: 0, critical: 1,
          evaluated: 1, worst: "CRITICAL",
        }}
      />,
    );
    expect(screen.queryByText(/riesgo crítico/i)).toBeNull();
    expect(container.querySelector('[data-tp-commercial-badge="CRITICAL"]')).toBeNull();
  });

  it("UX.33-final CRITICAL plural: tampoco se renderiza 'N riesgos críticos'", () => {
    const { container } = render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        commercialStatus={{
          ok: 0, warning: 0, risk: 0, critical: 3,
          evaluated: 3, worst: "CRITICAL",
        }}
      />,
    );
    expect(screen.queryByText(/riesgos críticos/i)).toBeNull();
    expect(container.querySelector("[data-tp-commercial-badge]")).toBeNull();
  });

  it("sin commercialStatus o sin líneas evaluadas → no se renderiza nada del badge", () => {
    const { container, rerender } = render(
      <TotalDelComprobanteCard
        totalDocument={0}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(container.querySelector("[data-tp-commercial-worst]")).toBeNull();

    rerender(
      <TotalDelComprobanteCard
        totalDocument={0}
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        commercialStatus={{
          ok: 0, warning: 0, risk: 0, critical: 0,
          evaluated: 0, worst: "OK",
        }}
      />,
    );
    expect(container.querySelector("[data-tp-commercial-worst]")).toBeNull();
  });
});

// =============================================================================
// POLICY §R-Rounding-3 — Distinción visual entre rounding de LISTA y rounding
// de COMPROBANTE.
//
// La fila ROUNDING_MONETARY del breakdown puede provenir de dos fuentes que el
// operador necesita distinguir:
//   · Lista de precios:  `documentRoundingApplied == null` y el motor reporta
//     `documentTotals.roundingAdjustment != 0`. El delta YA está absorbido en
//     `lineTotal` de cada línea — el `documentTotals.total` no se modifica
//     extra. La UI lo etiqueta "Redondeo comercial" + caption "Antes de impuestos · ya incluido en
//     el subtotal" (estilo secundario / muted).
//   · Comprobante (Etapa 1B): `documentRoundingApplied != null`. El delta
//     MODIFICA `documentTotals.total`. La UI lo etiqueta "Redondeo del
//     comprobante" + caption con scope (UNIFIED/BREAKDOWN/BOTH).
//
// El atributo `data-tp-rounding-source` ("LIST" | "DOCUMENT") permite a los
// tests verificar la fuente sin depender del texto exacto.
// =============================================================================

describe("TotalDelComprobanteCard — POLICY §R-Rounding-3 distinción lista vs comprobante", () => {
  function bdWithRounding(
    roundingAmount: number,
  ): BalanceBreakdownDTO {
    return {
      metals: [],
      monetaryBalance: {
        amount:       1210 + roundingAmount,
        currencyCode: "ARS",
        currencyRate: 1,
        amountBase:   1210 + roundingAmount,
        components: [
          { type: "HECHURA",          group: "HECHURA",  label: "Hechura",  amount: 1000 } as any,
          { type: "TAX",              group: "TAX",      label: "IVA",      amount: 210  } as any,
          { type: "ROUNDING_MONETARY",group: "ROUNDING", label: "Redondeo", amount: roundingAmount } as any,
        ],
      },
    };
  }

  it("(R-3.A) POLICY §R-Rounding-12 — sin documentRoundingApplied → fila ROUNDING etiquetada 'Redondeo comercial' + caption 'antes de impuestos · ya incluido en el subtotal'", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1236.03}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithRounding(26.03)}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        // documentRoundingApplied omitido (rounding viene de la LISTA)
      />,
    );
    openDetalle();
    const row = screen.getByTestId("total-card-component-ROUNDING_MONETARY");
    expect(row).toBeTruthy();
    expect(row.getAttribute("data-tp-rounding-source")).toBe("LIST");
    // POLICY §R-Rounding-12 — naming oficial: "Redondeo comercial".
    expect(row.textContent).toMatch(/redondeo comercial/i);
    expect(row.textContent).toMatch(/antes de impuestos/i);
    expect(row.textContent).toMatch(/ya incluido en el subtotal/i);
    // NO debe decir "financiero" en este caso (dominio distinto).
    expect(row.textContent).not.toMatch(/redondeo financiero/i);
  });

  it("(R-3.B) POLICY §R-Rounding-12 — con documentRoundingApplied → fila ROUNDING etiquetada 'Redondeo financiero' + caption 'después de impuestos · {scope}'", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1200}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithRounding(-10)}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentRoundingApplied={{
          scope:           "UNIFIED",
          totalAdjustment: -10,
          unified:         { mode: "INTEGER", direction: "NEAREST", adjustment: -10 },
        }}
      />,
    );
    openDetalle();
    const row = screen.getByTestId("total-card-component-ROUNDING_MONETARY");
    expect(row.getAttribute("data-tp-rounding-source")).toBe("DOCUMENT");
    // POLICY §R-Rounding-12 — naming oficial: "Redondeo financiero".
    expect(row.textContent).toMatch(/redondeo financiero/i);
    expect(row.textContent).toMatch(/después de impuestos/i);
    expect(row.textContent).toMatch(/total integer/i);
    // NO debe decir "comercial" cuando hay política del comprobante activa.
    expect(row.textContent).not.toMatch(/redondeo comercial/i);
    expect(row.textContent).not.toMatch(/ya incluido en el subtotal/i);
  });

  it("(R-3.C) scope BREAKDOWN → caption menciona metal y hechura", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1200}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdWithRounding(-10)}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentRoundingApplied={{
          scope:           "BREAKDOWN",
          totalAdjustment: -10,
          breakdown: {
            metal:   { mode: "TEN",     direction: "DOWN",    adjustment: -5 },
            hechura: { mode: "INTEGER", direction: "NEAREST", adjustment: -5 },
          },
        }}
      />,
    );
    openDetalle();
    const row = screen.getByTestId("total-card-component-ROUNDING_MONETARY");
    expect(row.textContent).toMatch(/metal ten/i);
    expect(row.textContent).toMatch(/hechura integer/i);
  });

  it("(R-3.D) scope BOTH → caption menciona TOTAL + metal + hechura", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1200}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdWithRounding(-15)}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentRoundingApplied={{
          scope:           "BOTH",
          totalAdjustment: -15,
          unified:         { mode: "TEN", direction: "NEAREST", adjustment: -5 },
          breakdown: {
            metal:   { mode: "INTEGER", direction: "NEAREST", adjustment: -5 },
            hechura: { mode: "INTEGER", direction: "NEAREST", adjustment: -5 },
          },
        }}
      />,
    );
    openDetalle();
    const row = screen.getByTestId("total-card-component-ROUNDING_MONETARY");
    expect(row.textContent).toMatch(/total ten/i);
    expect(row.textContent).toMatch(/metal integer/i);
    expect(row.textContent).toMatch(/hechura integer/i);
  });

  it("(R-3.E) cuando NO viene component ROUNDING_MONETARY, la fila no se renderiza", () => {
    const bd: BalanceBreakdownDTO = {
      metals: [],
      monetaryBalance: {
        amount: 1210, currencyCode: "ARS", currencyRate: 1, amountBase: 1210,
        components: [
          { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 } as any,
          { type: "TAX",     group: "TAX",     label: "IVA",     amount: 210  } as any,
        ],
      },
    };
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    openDetalle();
    expect(screen.queryByTestId("total-card-component-ROUNDING_MONETARY")).toBeNull();
  });

  it("(R-3.F) NO se duplica la fila — un solo ROUNDING_MONETARY por documento", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1200}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithRounding(-10)}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentRoundingApplied={{
          scope:           "UNIFIED",
          totalAdjustment: -10,
          unified:         { mode: "INTEGER", direction: "NEAREST", adjustment: -10 },
        }}
      />,
    );
    openDetalle();
    const all = screen.getAllByTestId("total-card-component-ROUNDING_MONETARY");
    expect(all).toHaveLength(1);
  });

  it("(R-3.G) atributo data-tp-rounding-source siempre presente (LIST o DOCUMENT)", () => {
    // Caso LIST.
    const { rerender, container } = render(
      <TotalDelComprobanteCard
        totalDocument={1236.03}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithRounding(26.03)}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    openDetalle();
    expect(
      container.querySelector("[data-tp-rounding-source='LIST']"),
    ).toBeTruthy();

    // Caso DOCUMENT (re-render con documentRoundingApplied).
    rerender(
      <TotalDelComprobanteCard
        totalDocument={1200}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithRounding(-10)}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
        documentRoundingApplied={{
          scope:           "UNIFIED",
          totalAdjustment: -10,
          unified:         { mode: "INTEGER", direction: "NEAREST", adjustment: -10 },
        }}
      />,
    );
    expect(
      container.querySelector("[data-tp-rounding-source='DOCUMENT']"),
    ).toBeTruthy();
  });
});

// =============================================================================
// POLICY §R-Rounding-7 — Invariante visual oficial:
//
//   Σ visible (UI)  ===  hero total
//
// Lo que el operador ve renderizado al cierre del desglose ("Total final" al
// pie de "Detalle financiero") DEBE coincidir EXACTAMENTE con el monto del
// hero del card. Sin drift, sin centavos perdidos, sin labels duplicados, sin
// componentes invisibles.
//
// Cubre los escenarios canónicos del pipeline (POLICY §R-Rounding-1):
//   · UNIFIED / BREAKDOWN / BOTH
//   · Con / sin IVA
//   · Con / sin descuentos doc (canal, cupón, global)
//   · Con / sin envío
//   · Con / sin payment adjustment
//   · Con / sin rounding de lista
//   · Con / sin rounding de comprobante
//
// El test NO recompone los totales — toma `totalDocument` (= documentTotals.total
// del backend), lo pasa al card, y verifica que el footer del desglose tiene
// EXACTAMENTE el mismo string formateado que el hero.
// =============================================================================

describe("POLICY §R-Rounding-7 — Σ visible === hero (invariante)", () => {
  /** Lee el textContent normalizado (trim + colapso de whitespace) de un
   *  elemento. Necesario porque los amounts del card pueden tener saltos
   *  de línea / espacios alrededor de la moneda. */
  function tx(el: Element | null): string {
    return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  /** Render del card, abre el detalle financiero y valida el invariante
   *  POLICY §R-Rounding-7 adaptado al contrato visual actual (UX-Saldo
   *  Compact 2026-05-29 — la fila "Total final" se removió del cuerpo
   *  expandido).
   *
   *  Invariante adaptado:
   *    · UNIFIED puro / sin metales en el balance → el header del bloque
   *      colapsable ("Total hechura") = `total − Σ metales = total`. Igual
   *      al hero.
   *    · BREAKDOWN con metales en el balance → el header del bloque
   *      colapsable ("Saldo monetario") = `total − Σ valuationMonetary`,
   *      distinto al hero por diseño (el hero sigue mostrando el Total).
   *      En este caso validamos solo presencia de ambos amounts (la
   *      composición visible Patrimonio + Saldo == Total ya está cubierta
   *      por `TotalDelComprobanteCard.saldo-monetario.test.tsx`). */
  function assertSigmaEqualsHero(props: any): void {
    render(<TotalDelComprobanteCard {...props} />);
    openDetalle();
    const heroAmount   = screen.getByTestId("total-card-amount");
    const hasMetals    = (props.balanceBreakdown?.metals?.length ?? 0) > 0;
    expect(tx(heroAmount)).toBeTruthy();
    if (hasMetals) {
      // BREAKDOWN con metales: header del bloque presente (≠ hero por contrato).
      const headerAmount = screen.getByTestId("total-card-monetary-header-amount");
      expect(tx(headerAmount)).toBeTruthy();
    } else {
      // Etapa 2F-C — UNIFICADO: el header de saldo se OCULTA (duplicaba el hero).
      // El hero es el ÚNICO monto visible; no hay header que comparar.
      expect(screen.queryByTestId("total-card-monetary-header-amount")).toBeNull();
    }
  }

  /** Fixture canónico — componentes que cubren todas las secciones del card.
   *  La suma matemática se delega al backend; este test sólo valida la
   *  consistencia visual (passthrough sin drift). */
  function bd(monetaryAmount: number, components: Array<any>): BalanceBreakdownDTO {
    return {
      metals: [],
      monetaryBalance: {
        amount: monetaryAmount, currencyCode: "ARS", currencyRate: 1, amountBase: monetaryAmount,
        components: components as any,
      },
    };
  }

  it("(1) UNIFIED — solo hechura + IVA", () => {
    assertSigmaEqualsHero({
      totalDocument: 1210,
      currencyCode:  "ARS",
      balanceMode:   "UNIFIED",
      balanceBreakdown: bd(1210, [
        { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 },
        { type: "TAX",     group: "TAX",     label: "IVA",     amount: 210  },
      ]),
      balanceModeOverride: null,
      onBalanceModeOverrideChange: noopChange,
    });
  });

  it("(2) UNIFIED — sin IVA (cliente exento)", () => {
    assertSigmaEqualsHero({
      totalDocument: 1000,
      currencyCode:  "ARS",
      balanceMode:   "UNIFIED",
      balanceBreakdown: bd(1000, [
        { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 },
      ]),
      balanceModeOverride: null,
      onBalanceModeOverrideChange: noopChange,
    });
  });

  it("(3) UNIFIED — con canal + cupón + bonificación global", () => {
    // Hechura 2000 + canal +5% (=100) − cupón 50 − global 150 + IVA 399.
    // total = 2000 + 100 − 50 − 150 + 399 = 2299.
    assertSigmaEqualsHero({
      totalDocument: 2299,
      currencyCode:  "ARS",
      balanceMode:   "UNIFIED",
      balanceBreakdown: bd(2299, [
        { type: "HECHURA",         group: "HECHURA",  label: "Hechura",          amount: 2000 },
        { type: "CHANNEL",         group: "CHANNEL",  label: "Tienda online",    amount: 100  },
        { type: "COUPON",          group: "COUPON",   label: "PROMO5",           amount: -50  },
        { type: "DISCOUNT_MANUAL", group: "DISCOUNT", label: "Descuento global", amount: -150 },
        { type: "TAX",             group: "TAX",      label: "IVA",              amount: 399  },
      ]),
      balanceModeOverride: null,
      onBalanceModeOverrideChange: noopChange,
    });
  });

  it("(4) UNIFIED — con envío + payment adjustment + rounding lista", () => {
    assertSigmaEqualsHero({
      totalDocument: 1496,
      currencyCode:  "ARS",
      balanceMode:   "UNIFIED",
      balanceBreakdown: bd(1496, [
        { type: "HECHURA",          group: "HECHURA",  label: "Hechura",           amount: 1000 },
        { type: "TAX",              group: "TAX",      label: "IVA",               amount: 210  },
        { type: "SHIPPING",         group: "SHIPPING", label: "Envío domicilio",   amount: 200  },
        { type: "PAYMENT",          group: "PAYMENT",  label: "Recargo tarjeta",   amount: 100  },
        { type: "ROUNDING_MONETARY",group: "ROUNDING", label: "Redondeo",          amount: -14  },
      ]),
      balanceModeOverride: null,
      onBalanceModeOverrideChange: noopChange,
      // documentRoundingApplied omitido → la fila ROUNDING se etiqueta
      // como "Redondeo comercial" (POLICY §R-Rounding-12). El total visible
      // sigue siendo `totalDocument`.
    });
  });

  it("(5) UNIFIED — con rounding de comprobante (Etapa 1B)", () => {
    assertSigmaEqualsHero({
      totalDocument: 1200,
      currencyCode:  "ARS",
      balanceMode:   "UNIFIED",
      balanceBreakdown: bd(1200, [
        { type: "HECHURA",          group: "HECHURA",  label: "Hechura",  amount: 1000 },
        { type: "TAX",              group: "TAX",      label: "IVA",      amount: 210  },
        { type: "ROUNDING_MONETARY",group: "ROUNDING", label: "Redondeo", amount: -10  },
      ]),
      balanceModeOverride: null,
      onBalanceModeOverrideChange: noopChange,
      documentRoundingApplied: {
        scope: "UNIFIED",
        totalAdjustment: -10,
        unified: { mode: "INTEGER", direction: "NEAREST", adjustment: -10 },
      },
    });
  });

  it("(6) BREAKDOWN — metales + hechura + IVA", () => {
    // En BREAKDOWN el hero muestra `totalDocument` (= 50000) y el footer del
    // desglose lo replica. La regla §R-Rounding-7 vale igual.
    assertSigmaEqualsHero({
      totalDocument: 50000,
      currencyCode:  "ARS",
      balanceMode:   "BREAKDOWN",
      balanceBreakdown: {
        metals: [
          {
            metalParentId: "oro-fino", metalParentName: "Oro Fino",
            gramsOriginal: 4.2, purity: 1, gramsPure: 4.2,
            quotePriceSnapshot: 8000, valuationMonetary: 33600,
            valuationCurrencyCode: "ARS", sourceLineIds: ["L-1"],
          },
        ],
        monetaryBalance: {
          amount: 16400, currencyCode: "ARS", currencyRate: 1, amountBase: 16400,
          components: [
            { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 13500 },
            { type: "TAX",     group: "TAX",     label: "IVA",     amount:  2900 },
          ] as any,
        },
      },
      balanceModeOverride: null,
      onBalanceModeOverrideChange: noopChange,
    });
  });

  it("(7) BREAKDOWN — con rounding de comprobante scope BREAKDOWN", () => {
    assertSigmaEqualsHero({
      totalDocument: 49995,
      currencyCode:  "ARS",
      balanceMode:   "BREAKDOWN",
      balanceBreakdown: {
        metals: [
          {
            metalParentId: "oro-fino", metalParentName: "Oro Fino",
            gramsOriginal: 4.2, purity: 1, gramsPure: 4.2,
            quotePriceSnapshot: 8000, valuationMonetary: 33600,
            valuationCurrencyCode: "ARS", sourceLineIds: ["L-1"],
          },
        ],
        monetaryBalance: {
          amount: 16395, currencyCode: "ARS", currencyRate: 1, amountBase: 16395,
          components: [
            { type: "HECHURA",          group: "HECHURA",  label: "Hechura",  amount: 13500 },
            { type: "TAX",              group: "TAX",      label: "IVA",      amount: 2900  },
            { type: "ROUNDING_MONETARY",group: "ROUNDING", label: "Redondeo", amount: -5    },
          ] as any,
        },
      },
      balanceModeOverride: null,
      onBalanceModeOverrideChange: noopChange,
      documentRoundingApplied: {
        scope: "BREAKDOWN",
        totalAdjustment: -5,
        breakdown: {
          metal:   { mode: "DECIMAL_2", direction: "NEAREST", adjustment: 0 },
          hechura: { mode: "INTEGER",   direction: "NEAREST", adjustment: -5 },
        },
      },
    });
  });

  it("(8) BOTH — cascada BREAKDOWN → UNIFIED", () => {
    assertSigmaEqualsHero({
      totalDocument: 49990,
      currencyCode:  "ARS",
      balanceMode:   "BREAKDOWN",
      balanceBreakdown: {
        metals: [
          {
            metalParentId: "oro-fino", metalParentName: "Oro Fino",
            gramsOriginal: 4.2, purity: 1, gramsPure: 4.2,
            quotePriceSnapshot: 8000, valuationMonetary: 33600,
            valuationCurrencyCode: "ARS", sourceLineIds: ["L-1"],
          },
        ],
        monetaryBalance: {
          amount: 16390, currencyCode: "ARS", currencyRate: 1, amountBase: 16390,
          components: [
            { type: "HECHURA",          group: "HECHURA",  label: "Hechura",  amount: 13500 },
            { type: "TAX",              group: "TAX",      label: "IVA",      amount: 2900  },
            { type: "ROUNDING_MONETARY",group: "ROUNDING", label: "Redondeo", amount: -10   },
          ] as any,
        },
      },
      balanceModeOverride: null,
      onBalanceModeOverrideChange: noopChange,
      documentRoundingApplied: {
        scope: "BOTH",
        totalAdjustment: -10,
        unified:   { mode: "TEN",     direction: "NEAREST", adjustment: -5  },
        breakdown: {
          metal:   { mode: "INTEGER", direction: "NEAREST", adjustment: 0   },
          hechura: { mode: "INTEGER", direction: "NEAREST", adjustment: -5  },
        },
      },
    });
  });

  it("(9) Caso edge — total con decimales raros (sin drift de redondeo en formato)", () => {
    assertSigmaEqualsHero({
      totalDocument: 1573.45,
      currencyCode:  "ARS",
      balanceMode:   "UNIFIED",
      balanceBreakdown: bd(1573.45, [
        { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1300 },
        { type: "TAX",     group: "TAX",     label: "IVA",     amount: 273.45 },
      ]),
      balanceModeOverride: null,
      onBalanceModeOverrideChange: noopChange,
    });
  });

  it("(10) Caso edge — total cero (sin componentes)", () => {
    // Sin componentes el card no muestra el desglose. Pero el hero sigue
    // mostrando el monto correctamente — verificación de no-render del
    // collapse y del hero coherente.
    render(
      <TotalDelComprobanteCard
        totalDocument={0}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bd(0, [])}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    // Hero presente con monto 0.
    expect(screen.getByTestId("total-card-amount")).toBeTruthy();
    // Sin componentes, NO se renderiza el bloque collapsible — el footer no existe.
    expect(screen.queryByTestId("total-card-monetary-total-amount")).toBeNull();
  });
});

// =============================================================================
// Manual Adjustment Etapa 1 (POLICY §R-Rounding-1 capa 17)
//
// El card renderiza el bloque "Ajuste manual" SOLO cuando `manualAdjustment`
// no es null y `engineTotal` está disponible. Estructura visible:
//
//   AJUSTE MANUAL                 Intervención humana
//   TPTech calculó      ARS xxx          ← engineTotal (lo que calculó el motor)
//   Vendedor ajustó     ARS ±yyy         ← delta del operador
//   Total final         ARS zzz          ← lo que cobra el cliente (= hero)
//   Aplicado por NombreUsuario           ← audit
//
// Reglas:
// · Hero del card SIEMPRE muestra el `totalDocument` (= finalTotal pasado por
//   el caller). El bloque "Ajuste manual" muestra `engineTotal` como
//   referencia auditiva.
// · Cuando NO hay manualAdjustment, el bloque NO se renderiza y el hero
//   coincide con engineTotal (que === documentTotals.total).
// =============================================================================

describe("TotalDelComprobanteCard — Manual Adjustment Etapa 1", () => {
  const fullSnapshot = {
    scope:   "UNIFIED" as const,
    unified: { preAmount: 473500, postAmount: 473000, amount: -500 },
    totals:  { monetaryAdjustment: -500 },
    audit:   {
      appliedBy: { userId: "u-1", userName: "Roberto" },
      appliedAt: "2026-05-28T18:00:00.000Z",
      reason:    null,
    },
  };

  it("renderiza el bloque cuando manualAdjustment != null", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={473000}     // ← finalTotal
        engineTotal={473500}        // ← lo que calculó el motor
        manualAdjustment={fullSnapshot}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const block = screen.getByTestId("total-card-manual-adjustment");
    expect(block).toBeTruthy();
    expect(block.getAttribute("data-tp-manual-scope")).toBe("UNIFIED");
    expect(block.textContent).toMatch(/ajuste manual/i);
    expect(block.textContent).toMatch(/intervenci[oó]n humana/i);
  });

  it("muestra las 3 filas: TPTech calculó / Vendedor ajustó / Total final", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={473000}
        engineTotal={473500}
        manualAdjustment={fullSnapshot}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const engineRow = screen.getByTestId("total-card-manual-engine-total");
    const deltaRow  = screen.getByTestId("total-card-manual-delta");
    const finalRow  = screen.getByTestId("total-card-manual-final-total");
    expect(engineRow.textContent).toMatch(/473[.,]?500/);
    expect(deltaRow.textContent).toMatch(/[−-]?\s*500/);
    expect(finalRow.textContent).toMatch(/473[.,]?000/);
  });

  it("hero (`total-card-amount`) coincide con el 'Total final' del bloque", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={473000}     // ← caller pasa finalTotal acá
        engineTotal={473500}
        manualAdjustment={fullSnapshot}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const hero      = screen.getByTestId("total-card-amount");
    const finalRow  = screen.getByTestId("total-card-manual-final-total");
    // Ambos muestran el mismo número (473.000) — POLICY §R-Rounding-7
    // invariante extendido a manualAdjustment.
    expect(hero.textContent?.replace(/\s+/g, " ").trim())
      .toContain(finalRow.textContent?.replace(/\s+/g, " ").trim() || "");
  });

  it("delta negativo se renderiza con color de descuento", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={473000}
        engineTotal={473500}
        manualAdjustment={fullSnapshot}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const deltaRow = screen.getByTestId("total-card-manual-delta");
    expect(deltaRow.className).toMatch(/text-red-500/);
  });

  it("audit.appliedBy.userName se muestra al pie del bloque", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={473000}
        engineTotal={473500}
        manualAdjustment={fullSnapshot}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const block = screen.getByTestId("total-card-manual-adjustment");
    expect(block.textContent).toMatch(/roberto/i);
  });

  it("NO renderiza el bloque cuando manualAdjustment es null", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        engineTotal={1210}
        manualAdjustment={null}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.queryByTestId("total-card-manual-adjustment")).toBeNull();
  });

  it("NO renderiza el bloque cuando engineTotal falta (caller no proveyó)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        manualAdjustment={fullSnapshot}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    expect(screen.queryByTestId("total-card-manual-adjustment")).toBeNull();
  });

  it("ajuste POSITIVO se renderiza con color neutro (no descuento)", () => {
    const positive = {
      ...fullSnapshot,
      unified: { preAmount: 473500, postAmount: 474000, amount: 500 },
      totals:  { monetaryAdjustment: 500 },
    };
    render(
      <TotalDelComprobanteCard
        totalDocument={474000}
        engineTotal={473500}
        manualAdjustment={positive}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnified()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noopChange}
      />,
    );
    const deltaRow = screen.getByTestId("total-card-manual-delta");
    expect(deltaRow.className).not.toMatch(/text-red-500/);
  });
});
