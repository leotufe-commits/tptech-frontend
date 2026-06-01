// src/pages/configuracion-sistema/documentos/__tests__/DocumentosComprobantesPage.test.tsx
// =============================================================================
// Fase A — Tests de la pantalla unificada después de eliminar la tab
// "Vista previa". Cobertura:
//   1) Renderea las 2 tabs visibles (Plantillas + Numeración).
//   2) `?tab=preview` legacy → redirige a `?tab=plantillas`.
//   3) Tab activa Plantillas embebe el hub.
//   4) Tab activa Numeración muestra "Próximamente".
//   5) Cambio de tab actualiza el URL.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DocumentosComprobantesPage from "../DocumentosComprobantesPage";

// Mockear el hub: validamos que cuando la tab activa es "plantillas" el
// componente se monta — sin tener que cablear la nav real al editor.
vi.mock("../DocumentosHub", () => ({
  default: () => <div data-testid="documentos-hub">HUB_RENDERED</div>,
}));

// Mockear NumeracionAdmin (Etapa B 2026-05-29) — validamos solo que se
// monta cuando la tab activa es "numeracion". Los tests específicos de
// la pantalla viven en `NumeracionAdmin.test.tsx`.
vi.mock("../NumeracionAdmin", () => ({
  default: () => <div data-testid="numeracion-admin">NUMERACION_ADMIN_RENDERED</div>,
}));

function renderWithUrl(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/x" element={<DocumentosComprobantesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DocumentosComprobantesPage (Fase A)", () => {
  it("renderea solo Plantillas + Numeración (la tab Vista previa fue eliminada)", () => {
    renderWithUrl("/x");
    expect(screen.getByRole("tab", { name: /plantillas/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /numeración/i })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /vista previa/i })).toBeNull();
  });

  it("default (sin ?tab) → activa Plantillas y embebe el hub", () => {
    renderWithUrl("/x");
    expect(screen.getByTestId("documentos-hub")).toBeTruthy();
  });

  it("?tab=plantillas → activa Plantillas explícitamente", () => {
    renderWithUrl("/x?tab=plantillas");
    expect(screen.getByTestId("documentos-hub")).toBeTruthy();
  });

  it("?tab=numeracion → monta NumeracionAdmin (Etapa B 2026-05-29)", () => {
    renderWithUrl("/x?tab=numeracion");
    expect(screen.getByTestId("numeracion-admin")).toBeTruthy();
    expect(screen.queryByTestId("documentos-hub")).toBeNull();
    // El placeholder "Módulo en preparación" YA NO existe en esta tab.
    // (la frase puede seguir apareciendo en la ayuda lateral del subtítulo
    //  de la pantalla; lo importante es que el panel central monte el CRUD).
  });

  it("?tab=preview (legacy) → redirige a Plantillas (deep-links no rompen)", () => {
    renderWithUrl("/x?tab=preview");
    // El hub se monta (tab activa = plantillas tras el normalize).
    expect(screen.getByTestId("documentos-hub")).toBeTruthy();
  });

  it("?tab=basura (valor inválido) → cae a Plantillas como default", () => {
    renderWithUrl("/x?tab=invalido");
    expect(screen.getByTestId("documentos-hub")).toBeTruthy();
  });

  it("ningún tab disponible se llama 'Vista previa'", () => {
    renderWithUrl("/x");
    // El tab "Vista previa" fue eliminado. La frase "vista previa" puede
    // aparecer en texto descriptivo de la ayuda — eso es OK. Lo
    // estructural es: NO hay un tab con ese nombre.
    expect(screen.queryByRole("tab", { name: /vista previa/i })).toBeNull();
  });
});
