// src/components/ui/__tests__/TPDocumentModalFooter.test.tsx
// =============================================================================
// Etapa D — Tests del footer estándar de modales de documento.
//
// Reglas testeadas:
//   · Default (summary cableado, hideDetailedTotals omitido) → muestra summary.
//   · hideDetailedTotals=true → OCULTA el summary, deja solo acciones.
//   · hideDetailedTotals=false → idéntico al default (compat explícita).
//   · Sin summary → layout justify-end con solo acciones (back-compat histórica).
//   · Botones primarios y secundarios se conservan en ambos modos.
//   · extraActions visibles en ambos modos (incluido el indicador "Recalculando…").
//   · onSaveDraft renderiza el botón "Guardar borrador" en ambos modos.
//   · saveLabelCreate / saveLabelEdit respetados según isNew.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TPDocumentModalFooter } from "../TPDocumentModalFooter";

const baseProps = {
  isNew:    true,
  onCancel: () => { /* noop */ },
  onSave:   () => { /* noop */ },
};

const summaryNode = (
  <div data-testid="footer-summary">
    Subtotal: <span>$100</span>
    <span> · </span>
    Total: <span>$121</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Default (back-compat)
// ─────────────────────────────────────────────────────────────────────────────

describe("TPDocumentModalFooter — comportamiento por default (back-compat)", () => {
  it("con summary y sin hideDetailedTotals → muestra summary", () => {
    render(<TPDocumentModalFooter {...baseProps} summary={summaryNode} />);
    expect(screen.getByTestId("footer-summary")).toBeTruthy();
    expect(screen.getByTestId("document-modal-footer").getAttribute("data-summary-visible"))
      .toBe("true");
  });

  it("sin summary → layout sin summary (acciones a la derecha)", () => {
    render(<TPDocumentModalFooter {...baseProps} />);
    expect(screen.queryByTestId("footer-summary")).toBeNull();
    expect(screen.getByTestId("document-modal-footer").getAttribute("data-summary-visible"))
      .toBe("false");
  });

  it("hideDetailedTotals=false → comportamiento idéntico al default", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        summary={summaryNode}
        hideDetailedTotals={false}
      />,
    );
    expect(screen.getByTestId("footer-summary")).toBeTruthy();
    expect(screen.getByTestId("document-modal-footer").getAttribute("data-summary-visible"))
      .toBe("true");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hideDetailedTotals=true (modo Factura — card maestro en el aside)
// ─────────────────────────────────────────────────────────────────────────────

describe("TPDocumentModalFooter — hideDetailedTotals=true (footer reducido)", () => {
  it("oculta el summary aunque venga poblado", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        summary={summaryNode}
        hideDetailedTotals
      />,
    );
    expect(screen.queryByTestId("footer-summary")).toBeNull();
    expect(screen.getByTestId("document-modal-footer").getAttribute("data-summary-visible"))
      .toBe("false");
  });

  it("preserva los botones de acción (Cancelar + Crear/Guardar)", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        isNew={true}
        summary={summaryNode}
        hideDetailedTotals
      />,
    );
    expect(screen.getByText("Cancelar")).toBeTruthy();
    expect(screen.getByText("Crear")).toBeTruthy();
  });

  it("preserva 'Guardar borrador' cuando hay onSaveDraft", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        summary={summaryNode}
        hideDetailedTotals
        onSaveDraft={() => { /* noop */ }}
      />,
    );
    expect(screen.getByText("Guardar borrador")).toBeTruthy();
  });

  it("preserva extraActions (ej. indicador 'Recalculando…')", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        summary={summaryNode}
        hideDetailedTotals
        extraActions={<span data-testid="recalculating">Recalculando…</span>}
      />,
    );
    expect(screen.getByTestId("recalculating")).toBeTruthy();
  });

  it("onCancel y onSave se siguen invocando con click", () => {
    const onCancel = vi.fn();
    const onSave   = vi.fn();
    render(
      <TPDocumentModalFooter
        {...baseProps}
        onCancel={onCancel}
        onSave={onSave}
        summary={summaryNode}
        hideDetailedTotals
      />,
    );
    fireEvent.click(screen.getByText("Cancelar"));
    fireEvent.click(screen.getByText("Crear"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("respeta saveLabelEdit cuando isNew=false", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        isNew={false}
        summary={summaryNode}
        hideDetailedTotals
      />,
    );
    expect(screen.getByText("Guardar cambios")).toBeTruthy();
    expect(screen.queryByText("Crear")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelLabel — override del texto del botón de cierre (Factura usa "Cerrar")
// ─────────────────────────────────────────────────────────────────────────────

describe("TPDocumentModalFooter — cancelLabel override", () => {
  it("default → 'Cancelar' (back-compat)", () => {
    render(<TPDocumentModalFooter {...baseProps} />);
    expect(screen.getByText("Cancelar")).toBeTruthy();
  });

  it("cancelLabel='Cerrar' → renderiza 'Cerrar' (Factura de ventas)", () => {
    render(<TPDocumentModalFooter {...baseProps} cancelLabel="Cerrar" />);
    expect(screen.getByText("Cerrar")).toBeTruthy();
    expect(screen.queryByText("Cancelar")).toBeNull();
  });

  it("click sobre 'Cerrar' invoca el MISMO handler onCancel (sin lógica nueva)", () => {
    const onCancel = vi.fn();
    render(<TPDocumentModalFooter {...baseProps} onCancel={onCancel} cancelLabel="Cerrar" />);
    fireEvent.click(screen.getByText("Cerrar"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Back-compat: pantallas que no migraron al card maestro
// ─────────────────────────────────────────────────────────────────────────────

describe("TPDocumentModalFooter — compatibilidad con pantallas hermanas", () => {
  it("Presupuestos/Órdenes/Compras (sin hideDetailedTotals) siguen viendo el summary", () => {
    // Simula el call-site de una pantalla hermana: misma firma que VentasFacturas
    // pre-Etapa D — no setea hideDetailedTotals.
    render(
      <TPDocumentModalFooter
        {...baseProps}
        summary={summaryNode}
        // hideDetailedTotals omitido a propósito.
      />,
    );
    expect(screen.getByTestId("footer-summary")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 5 — readOnly (factura emitida / anulada)
// ─────────────────────────────────────────────────────────────────────────────

describe("TPDocumentModalFooter — readOnly", () => {
  it("readOnly=true → oculta el botón primario 'Crear'", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        hideDetailedTotals
        readOnly
      />,
    );
    expect(screen.queryByText("Crear")).toBeNull();
    expect(screen.queryByText("Guardar cambios")).toBeNull();
  });

  it("readOnly=true → oculta 'Guardar borrador' aunque haya onSaveDraft", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        hideDetailedTotals
        readOnly
        onSaveDraft={() => { /* noop */ }}
      />,
    );
    expect(screen.queryByText("Guardar borrador")).toBeNull();
  });

  it("readOnly=true → mantiene Cancelar/Cerrar", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        hideDetailedTotals
        readOnly
        cancelLabel="Cerrar"
      />,
    );
    expect(screen.getByText("Cerrar")).toBeTruthy();
  });

  it("readOnly=true → mantiene extraActions (Imprimir/Descargar/Mail)", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        hideDetailedTotals
        readOnly
        extraActions={<span data-testid="print-btn">Imprimir</span>}
      />,
    );
    expect(screen.getByTestId("print-btn")).toBeTruthy();
  });

  it("readOnly=true + isNew=false → no muestra 'Guardar cambios'", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        hideDetailedTotals
        readOnly
        isNew={false}
      />,
    );
    expect(screen.queryByText("Guardar cambios")).toBeNull();
    expect(screen.queryByText("Crear")).toBeNull();
  });

  it("readOnly=false (default) → conserva el comportamiento original", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        hideDetailedTotals
        onSaveDraft={() => { /* noop */ }}
      />,
    );
    expect(screen.getByText("Crear")).toBeTruthy();
    expect(screen.getByText("Guardar borrador")).toBeTruthy();
  });

  it("readOnly=true con summary y showSummary=true → tampoco renderea primary/draft", () => {
    render(
      <TPDocumentModalFooter
        {...baseProps}
        summary={summaryNode}
        readOnly
        onSaveDraft={() => { /* noop */ }}
      />,
    );
    expect(screen.getByTestId("footer-summary")).toBeTruthy();
    expect(screen.queryByText("Crear")).toBeNull();
    expect(screen.queryByText("Guardar borrador")).toBeNull();
  });
});
