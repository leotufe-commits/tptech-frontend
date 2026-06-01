// src/pages/entity-detail/__tests__/EntityBalanceMovementsView.test.tsx
// =============================================================================
// T61 (Fase 4.3) — Tests de la vista canónica de cuenta corriente.
//
// Cubren:
//   1. Render del resumen agregado superior (metales + monetario por moneda).
//   2. Movimiento UNIFIED muestra solo "Saldo monetario".
//   3. Movimiento BREAKDOWN muestra "Metales" + "Saldo monetario".
//   4. Multi-metal en el mismo movimiento agrupa correctamente.
//   5. Multi-moneda agrega por currencyCode (NO convierte).
//   6. Empty state cuando data.data = [].
//   7. Loading state mientras data === null y no hay initialData.
//   8. Error state cuando fetcher rechaza.
//   9. "Ver origen" aparece cuando hay sourceDocumentId.
//  10. "Ver origen" no aparece cuando falta el sourceDocumentId.
//  11. Agregado de metales: la suma NO depende del orden ni del currencyCode.
//  12. Función pura `aggregateMovements` exportada.
//
// Mock de `react-router-dom` para `useNavigate`.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  EntityBalanceMovementsView,
  aggregateMovements,
} from "../EntityBalanceMovementsView";
import type {
  BalanceMovementDTO,
  BalanceMovementsListResponse,
} from "../../../services/commercial-entities";

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeMovUnified(over: Partial<BalanceMovementDTO> = {}): BalanceMovementDTO {
  return {
    id: "mov-u1",
    entityId: "ent-1",
    kind: "DEBIT",
    source: "RECEIPT",
    receiptId: "rcp-1",
    paymentAllocationId: null,
    amountBase:     509500,
    amountOriginal: 509500,
    currencyCode:   "ARS",
    currencyRate:   1,
    movementDate:   "2026-05-22T10:00:00Z",
    createdAt:      "2026-05-22T10:00:00Z",
    notes:          "Receipt A-0001-00000001",
    balanceMode:    "UNIFIED",
    sourceDocumentType: "SALE",
    sourceDocumentId:   "sale-u1",
    metalEntries:   [],
    ...over,
  };
}

function makeMovBreakdown(over: Partial<BalanceMovementDTO> = {}): BalanceMovementDTO {
  return {
    id: "mov-b1",
    entityId: "ent-1",
    kind: "DEBIT",
    source: "RECEIPT",
    receiptId: "rcp-2",
    paymentAllocationId: null,
    amountBase:     91911.47,
    amountOriginal: 91911.47,
    currencyCode:   "ARS",
    currencyRate:   1,
    movementDate:   "2026-05-22T11:00:00Z",
    createdAt:      "2026-05-22T11:00:00Z",
    notes:          "Receipt A-0002-00000001",
    balanceMode:    "BREAKDOWN",
    sourceDocumentType: "SALE",
    sourceDocumentId:   "sale-b1",
    metalEntries: [
      {
        id: "me-1", metalParentId: "oro-fino",  metalParentName: "Oro Fino",
        gramsOriginal: 2, purity: 0.763, gramsPure: 1.526,
        sourceLineId: "L-1", createdAt: "2026-05-22T11:00:00Z",
      },
      {
        id: "me-2", metalParentId: "plata-925", metalParentName: "Plata",
        gramsOriginal: 0.38, purity: 0.925, gramsPure: 0.350,
        sourceLineId: "L-2", createdAt: "2026-05-22T11:00:00Z",
      },
    ],
    ...over,
  };
}

function makeListResponse(movements: BalanceMovementDTO[]): BalanceMovementsListResponse {
  return { data: movements, total: movements.length, skip: 0, take: 100 };
}

function renderView(props: Partial<React.ComponentProps<typeof EntityBalanceMovementsView>> = {}) {
  return render(
    <MemoryRouter>
      <EntityBalanceMovementsView entityId="ent-1" {...props} />
    </MemoryRouter>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Resumen agregado
// ─────────────────────────────────────────────────────────────────────────────

describe("EntityBalanceMovementsView — resumen superior", () => {
  it("muestra metales agregados y monetario por moneda", () => {
    renderView({
      initialData: makeListResponse([makeMovBreakdown(), makeMovUnified()]),
    });
    expect(screen.getByTestId("balance-movements-summary")).toBeTruthy();
    // Suma de metales del único BREAKDOWN.
    expect(screen.getByTestId("summary-metal-row-oro-fino")).toBeTruthy();
    expect(screen.getByTestId("summary-metal-row-plata-925")).toBeTruthy();
    // Saldo monetario en ARS (UNIFIED+BREAKDOWN ambos en ARS).
    expect(screen.getByTestId("summary-money-row-ARS")).toBeTruthy();
  });

  it("multi-moneda: agrupa por currencyCode (NO convierte)", () => {
    renderView({
      initialData: makeListResponse([
        makeMovUnified({ id: "u-ars", currencyCode: "ARS", amountOriginal: 1000 }),
        makeMovUnified({ id: "u-usd", currencyCode: "USD", amountOriginal: 50  }),
        makeMovUnified({ id: "u-eur", currencyCode: "EUR", amountOriginal: 25  }),
      ]),
    });
    expect(screen.getByTestId("summary-money-row-ARS")).toBeTruthy();
    expect(screen.getByTestId("summary-money-row-USD")).toBeTruthy();
    expect(screen.getByTestId("summary-money-row-EUR")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 + 3. Movimiento UNIFIED vs BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────

describe("EntityBalanceMovementsView — movimientos individuales", () => {
  it("UNIFIED: muestra Saldo monetario, NO muestra Metales", () => {
    renderView({ initialData: makeListResponse([makeMovUnified()]) });
    const card = screen.getByTestId("movement-card-mov-u1");
    expect(card).toBeTruthy();
    expect(card.querySelector("[data-testid='movement-metals']")).toBeNull();
    expect(card.querySelector("[data-testid='movement-monetary']")).toBeTruthy();
    // No tag "Desglosado" en UNIFIED.
    expect(card.querySelector("[data-testid='movement-mode-tag']")).toBeNull();
  });

  it("BREAKDOWN: muestra Metales + tag 'Desglosado' + Saldo monetario", () => {
    renderView({ initialData: makeListResponse([makeMovBreakdown()]) });
    const card = screen.getByTestId("movement-card-mov-b1");
    expect(card.getAttribute("data-balance-mode")).toBe("BREAKDOWN");
    expect(card.querySelector("[data-testid='movement-mode-tag']")).toBeTruthy();
    expect(card.querySelector("[data-testid='movement-metals']")).toBeTruthy();
    expect(card.querySelector("[data-testid='movement-monetary']")).toBeTruthy();
  });

  it("BREAKDOWN con varios padres: cada metal renderiza su propia fila", () => {
    renderView({ initialData: makeListResponse([makeMovBreakdown()]) });
    expect(screen.getByTestId("movement-mov-b1-metal-oro-fino")).toBeTruthy();
    expect(screen.getByTestId("movement-mov-b1-metal-plata-925")).toBeTruthy();
  });

  it("BREAKDOWN sin metales (línea solo hechura) → cae a UNIFIED-like visual", () => {
    renderView({
      initialData: makeListResponse([
        makeMovBreakdown({ id: "mov-bh", metalEntries: [], balanceMode: "BREAKDOWN" }),
      ]),
    });
    const card = screen.getByTestId("movement-card-mov-bh");
    // No hay metales → no se renderiza el bloque, pero el monetary sí.
    expect(card.querySelector("[data-testid='movement-metals']")).toBeNull();
    expect(card.querySelector("[data-testid='movement-monetary']")).toBeTruthy();
    expect(card.querySelector("[data-testid='movement-mode-tag']")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ver origen
// ─────────────────────────────────────────────────────────────────────────────

describe("EntityBalanceMovementsView — Ver origen", () => {
  it("renderiza 'Ver origen' cuando hay sourceDocumentId + sourceDocumentType", () => {
    renderView({ initialData: makeListResponse([makeMovUnified()]) });
    expect(screen.getByTestId("movement-view-origin-mov-u1")).toBeTruthy();
  });

  it("NO renderiza 'Ver origen' cuando falta sourceDocumentId", () => {
    renderView({
      initialData: makeListResponse([
        makeMovUnified({ sourceDocumentId: null, sourceDocumentType: null }),
      ]),
    });
    expect(screen.queryByTestId("movement-view-origin-mov-u1")).toBeNull();
  });

  it("click en 'Ver origen' es accionable (no tira)", () => {
    renderView({ initialData: makeListResponse([makeMovUnified()]) });
    const btn = screen.getByTestId("movement-view-origin-mov-u1");
    expect(() => fireEvent.click(btn)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Estados visuales
// ─────────────────────────────────────────────────────────────────────────────

describe("EntityBalanceMovementsView — estados loading/error/empty", () => {
  it("empty state: data.data = [] → mensaje", () => {
    renderView({ initialData: makeListResponse([]) });
    expect(screen.getByTestId("balance-movements-empty")).toBeTruthy();
  });

  it("loading: sin initialData + fetcher pendiente → skeleton premium (Fase 4.4)", () => {
    // Fetcher que nunca resuelve → permanece loading. Antes (Fase 4.3) usaba
    // spinner; ahora (Fase 4.4) usa skeleton premium para mejor percepción.
    const slowFetcher = vi.fn(() => new Promise<BalanceMovementsListResponse>(() => {}));
    renderView({ fetcher: slowFetcher as any });
    expect(screen.getByTestId("balance-movements-skeleton")).toBeTruthy();
  });

  it("error: fetcher rechaza → error visible", async () => {
    const failingFetcher = vi.fn(() =>
      Promise.reject(new Error("Falla en backend")),
    );
    renderView({ fetcher: failingFetcher as any });
    await waitFor(() => {
      expect(screen.getByTestId("balance-movements-error")).toBeTruthy();
    });
    expect(screen.getByText(/Falla en backend/)).toBeTruthy();
  });

  it("fetcher resuelve → lista visible", async () => {
    const okFetcher = vi.fn(() =>
      Promise.resolve(makeListResponse([makeMovUnified()])),
    );
    renderView({ fetcher: okFetcher as any });
    await waitFor(() => {
      expect(screen.getByTestId("balance-movements-view")).toBeTruthy();
    });
    expect(okFetcher).toHaveBeenCalledWith("ent-1", expect.any(Object));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// aggregateMovements (función pura)
// ─────────────────────────────────────────────────────────────────────────────

describe("aggregateMovements — función pura", () => {
  it("suma gramos por metalParentId entre múltiples movimientos", () => {
    const ms = [
      makeMovBreakdown({
        id: "m1",
        metalEntries: [{
          id: "e1", metalParentId: "oro-fino", metalParentName: "Oro Fino",
          gramsOriginal: 1, purity: 0.75, gramsPure: 0.75,
          sourceLineId: null, createdAt: "",
        }],
      }),
      makeMovBreakdown({
        id: "m2",
        metalEntries: [{
          id: "e2", metalParentId: "oro-fino", metalParentName: "Oro Fino",
          gramsOriginal: 2, purity: 0.916, gramsPure: 1.832,
          sourceLineId: null, createdAt: "",
        }],
      }),
    ];
    const agg = aggregateMovements(ms);
    expect(agg.metals).toHaveLength(1);
    expect(agg.metals[0].totalGramsPure).toBeCloseTo(2.582, 3);
    expect(agg.metals[0].totalGramsOriginal).toBeCloseTo(3, 3);
  });

  it("kind=CREDIT resta del agregado (devolución de metal)", () => {
    const ms = [
      makeMovBreakdown({
        id: "m1", kind: "DEBIT",
        metalEntries: [{
          id: "e1", metalParentId: "oro-fino", metalParentName: "Oro Fino",
          gramsOriginal: 2, purity: 0.75, gramsPure: 1.5,
          sourceLineId: null, createdAt: "",
        }],
      }),
      makeMovBreakdown({
        id: "m2", kind: "CREDIT",
        metalEntries: [{
          id: "e2", metalParentId: "oro-fino", metalParentName: "Oro Fino",
          gramsOriginal: 1, purity: 0.75, gramsPure: 0.75,
          sourceLineId: null, createdAt: "",
        }],
      }),
    ];
    const agg = aggregateMovements(ms);
    expect(agg.metals[0].totalGramsPure).toBeCloseTo(0.75, 3); // 1.5 − 0.75
  });

  it("multi-moneda: agrupa por currencyCode y NO convierte", () => {
    const ms = [
      makeMovUnified({ id: "u1", currencyCode: "ARS", amountOriginal: 1000 }),
      makeMovUnified({ id: "u2", currencyCode: "USD", amountOriginal: 50  }),
      makeMovUnified({ id: "u3", currencyCode: "ARS", amountOriginal: 500 }),
    ];
    const agg = aggregateMovements(ms);
    expect(agg.monetary).toHaveLength(2);
    const ars = agg.monetary.find((m) => m.currencyCode === "ARS");
    const usd = agg.monetary.find((m) => m.currencyCode === "USD");
    expect(ars?.amount).toBe(1500); // 1000 + 500 — NO suma USD adentro
    expect(usd?.amount).toBe(50);
  });

  it("gramos netos cero se descartan del resumen (entradas+salidas compensadas)", () => {
    const ms = [
      makeMovBreakdown({
        id: "m1", kind: "DEBIT",
        metalEntries: [{
          id: "e1", metalParentId: "oro-fino", metalParentName: "Oro Fino",
          gramsOriginal: 1, purity: 0.75, gramsPure: 0.75,
          sourceLineId: null, createdAt: "",
        }],
      }),
      makeMovBreakdown({
        id: "m2", kind: "CREDIT",
        metalEntries: [{
          id: "e2", metalParentId: "oro-fino", metalParentName: "Oro Fino",
          gramsOriginal: 1, purity: 0.75, gramsPure: 0.75,
          sourceLineId: null, createdAt: "",
        }],
      }),
    ];
    const agg = aggregateMovements(ms);
    expect(agg.metals).toEqual([]);
  });

  it("input vacío → agregado vacío", () => {
    expect(aggregateMovements([])).toEqual({ metals: [], monetary: [] });
  });

  it("metalEntries con metalParentId=null pero name presente → agrupa por name (fallback)", () => {
    const ms = [
      makeMovBreakdown({
        id: "m1",
        metalEntries: [{
          id: "e1", metalParentId: null, metalParentName: "Genérico",
          gramsOriginal: 1, purity: 0.5, gramsPure: 0.5,
          sourceLineId: null, createdAt: "",
        }],
      }),
      makeMovBreakdown({
        id: "m2",
        metalEntries: [{
          id: "e2", metalParentId: null, metalParentName: "Genérico",
          gramsOriginal: 1, purity: 0.5, gramsPure: 0.5,
          sourceLineId: null, createdAt: "",
        }],
      }),
    ];
    const agg = aggregateMovements(ms);
    expect(agg.metals).toHaveLength(1);
    expect(agg.metals[0].totalGramsPure).toBeCloseTo(1, 3);
  });

  it("orden de entrada no afecta el resultado (estabilidad de agregado)", () => {
    const ordered = [
      makeMovBreakdown({ id: "a", metalEntries: [{
        id: "ea", metalParentId: "oro-fino", metalParentName: "Oro",
        gramsOriginal: 1, purity: 1, gramsPure: 1,
        sourceLineId: null, createdAt: "",
      }] }),
      makeMovBreakdown({ id: "b", metalEntries: [{
        id: "eb", metalParentId: "plata-925", metalParentName: "Plata",
        gramsOriginal: 2, purity: 1, gramsPure: 2,
        sourceLineId: null, createdAt: "",
      }] }),
    ];
    const reversed = [...ordered].reverse();
    expect(aggregateMovements(ordered)).toEqual(aggregateMovements(reversed));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fase 4.4 — Filtros UX
// ─────────────────────────────────────────────────────────────────────────────

describe("EntityBalanceMovementsView — filtros (Fase 4.4)", () => {
  it("renderiza la barra de filtros con sus 5 selects + botón 'Limpiar'", () => {
    renderView({ initialData: makeListResponse([makeMovUnified(), makeMovBreakdown()]) });
    expect(screen.getByTestId("balance-movements-filters")).toBeTruthy();
    expect(screen.getByTestId("filter-kind")).toBeTruthy();
    expect(screen.getByTestId("filter-doctype")).toBeTruthy();
    expect(screen.getByTestId("filter-balance-mode")).toBeTruthy();
    expect(screen.getByTestId("filter-currency")).toBeTruthy();
    expect(screen.getByTestId("filter-metal")).toBeTruthy();
    expect(screen.getByTestId("filter-clear")).toBeTruthy();
  });

  it("filtro por kind=CREDIT oculta los DEBIT", () => {
    renderView({
      initialData: makeListResponse([
        makeMovUnified({ id: "u-d", kind: "DEBIT" }),
        makeMovUnified({ id: "u-c", kind: "CREDIT" }),
      ]),
    });
    expect(screen.getByTestId("movement-card-u-d")).toBeTruthy();
    expect(screen.getByTestId("movement-card-u-c")).toBeTruthy();
    fireEvent.change(screen.getByTestId("filter-kind"), { target: { value: "CREDIT" } });
    expect(screen.queryByTestId("movement-card-u-d")).toBeNull();
    expect(screen.getByTestId("movement-card-u-c")).toBeTruthy();
  });

  it("filtro por balanceMode=BREAKDOWN oculta los UNIFIED", () => {
    renderView({ initialData: makeListResponse([makeMovUnified(), makeMovBreakdown()]) });
    fireEvent.change(screen.getByTestId("filter-balance-mode"), { target: { value: "BREAKDOWN" } });
    expect(screen.queryByTestId("movement-card-mov-u1")).toBeNull();
    expect(screen.getByTestId("movement-card-mov-b1")).toBeTruthy();
  });

  it("filtro por currencyCode=USD agrupa correctamente", () => {
    renderView({
      initialData: makeListResponse([
        makeMovUnified({ id: "u-ars", currencyCode: "ARS" }),
        makeMovUnified({ id: "u-usd", currencyCode: "USD" }),
      ]),
    });
    fireEvent.change(screen.getByTestId("filter-currency"), { target: { value: "USD" } });
    expect(screen.queryByTestId("movement-card-u-ars")).toBeNull();
    expect(screen.getByTestId("movement-card-u-usd")).toBeTruthy();
  });

  it("filtro por metal=oro-fino oculta movimientos sin ese padre", () => {
    renderView({
      initialData: makeListResponse([
        makeMovBreakdown({ id: "b-oro" }), // tiene oro-fino + plata-925
        makeMovUnified({   id: "u-monetary" }), // sin metales
      ]),
    });
    fireEvent.change(screen.getByTestId("filter-metal"), { target: { value: "oro-fino" } });
    expect(screen.getByTestId("movement-card-b-oro")).toBeTruthy();
    expect(screen.queryByTestId("movement-card-u-monetary")).toBeNull();
  });

  it("botón 'Limpiar' resetea todos los filtros", () => {
    renderView({
      initialData: makeListResponse([
        makeMovUnified({ id: "u-d", kind: "DEBIT" }),
        makeMovUnified({ id: "u-c", kind: "CREDIT" }),
      ]),
    });
    fireEvent.change(screen.getByTestId("filter-kind"), { target: { value: "CREDIT" } });
    expect(screen.queryByTestId("movement-card-u-d")).toBeNull();
    fireEvent.click(screen.getByTestId("filter-clear"));
    expect(screen.getByTestId("movement-card-u-d")).toBeTruthy();
    expect(screen.getByTestId("movement-card-u-c")).toBeTruthy();
  });

  it("filtros activos NO cambian la cantidad de filtros mostrados (solo ocultan movimientos)", () => {
    renderView({ initialData: makeListResponse([makeMovUnified(), makeMovBreakdown()]) });
    fireEvent.change(screen.getByTestId("filter-kind"), { target: { value: "DEBIT" } });
    // La barra de filtros sigue ahí.
    expect(screen.getByTestId("balance-movements-filters")).toBeTruthy();
  });

  it("filtro que no matchea nada → empty state con mensaje 'cumple con los filtros'", () => {
    renderView({ initialData: makeListResponse([makeMovUnified({ kind: "DEBIT" })]) });
    fireEvent.change(screen.getByTestId("filter-kind"), { target: { value: "CREDIT" } });
    const empty = screen.getByTestId("balance-movements-empty");
    expect(empty.textContent).toMatch(/filtros/i);
  });

  it("resumen superior se recalcula con filtros aplicados", () => {
    renderView({
      initialData: makeListResponse([
        makeMovUnified({   id: "u-ars", currencyCode: "ARS", amountOriginal: 1000 }),
        makeMovUnified({   id: "u-usd", currencyCode: "USD", amountOriginal: 50   }),
      ]),
    });
    // Antes del filtro: ARS + USD en resumen.
    expect(screen.getByTestId("summary-money-row-ARS")).toBeTruthy();
    expect(screen.getByTestId("summary-money-row-USD")).toBeTruthy();
    // Filtro a USD.
    fireEvent.change(screen.getByTestId("filter-currency"), { target: { value: "USD" } });
    expect(screen.queryByTestId("summary-money-row-ARS")).toBeNull();
    expect(screen.getByTestId("summary-money-row-USD")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fase 4.4 — Modal Ver origen
// ─────────────────────────────────────────────────────────────────────────────

describe("EntityBalanceMovementsView — modal Ver origen (Fase 4.4)", () => {
  it("click en 'Ver origen' abre el modal con el origen del movimiento", () => {
    renderView({ initialData: makeListResponse([makeMovBreakdown()]) });
    expect(screen.queryByTestId("origin-modal-body")).toBeNull();
    fireEvent.click(screen.getByTestId("movement-view-origin-mov-b1"));
    expect(screen.getByTestId("origin-modal-body")).toBeTruthy();
  });

  it("modal muestra metadata del movimiento (tipo, fecha, modo)", () => {
    renderView({ initialData: makeListResponse([makeMovBreakdown()]) });
    fireEvent.click(screen.getByTestId("movement-view-origin-mov-b1"));
    const meta = screen.getByTestId("origin-modal-meta");
    expect(meta.textContent).toMatch(/Factura/);
    expect(meta.textContent).toMatch(/Desglosado/);
    expect(meta.textContent).toMatch(/Débito/);
  });

  it("modal BREAKDOWN muestra tabla de metales", () => {
    renderView({ initialData: makeListResponse([makeMovBreakdown()]) });
    fireEvent.click(screen.getByTestId("movement-view-origin-mov-b1"));
    expect(screen.getByTestId("origin-modal-metals")).toBeTruthy();
    expect(screen.getByTestId("origin-modal-metal-row-oro-fino")).toBeTruthy();
  });

  it("modal UNIFIED NO muestra tabla de metales (solo monetary)", () => {
    renderView({ initialData: makeListResponse([makeMovUnified()]) });
    fireEvent.click(screen.getByTestId("movement-view-origin-mov-u1"));
    expect(screen.queryByTestId("origin-modal-metals")).toBeNull();
    expect(screen.getByTestId("origin-modal-monetary")).toBeTruthy();
  });

  it("modal incluye botón 'Abrir documento' cuando hay sourceDocumentId", () => {
    renderView({ initialData: makeListResponse([makeMovUnified()]) });
    fireEvent.click(screen.getByTestId("movement-view-origin-mov-u1"));
    expect(screen.getByTestId("origin-modal-navigate")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fase 4.4 — Paginación "Cargar más"
// ─────────────────────────────────────────────────────────────────────────────

describe("EntityBalanceMovementsView — paginación (Fase 4.4)", () => {
  it("muestra 'Cargar más' cuando loaded < total", () => {
    const initial: BalanceMovementsListResponse = {
      data: [makeMovUnified({ id: "u-1" })],
      total: 5, skip: 0, take: 1,
    };
    renderView({ initialData: initial });
    expect(screen.getByTestId("balance-movements-load-more")).toBeTruthy();
    expect(screen.getByTestId("balance-movements-load-more").textContent).toMatch(/1\/5/);
  });

  it("NO muestra 'Cargar más' cuando loaded === total", () => {
    const initial: BalanceMovementsListResponse = {
      data: [makeMovUnified()],
      total: 1, skip: 0, take: 25,
    };
    renderView({ initialData: initial });
    expect(screen.queryByTestId("balance-movements-load-more")).toBeNull();
  });

  it("resumen marca 'Sobre movimientos cargados' cuando hay paginación pendiente", () => {
    const initial: BalanceMovementsListResponse = {
      data: [makeMovUnified()], total: 10, skip: 0, take: 1,
    };
    renderView({ initialData: initial });
    expect(screen.getByTestId("balance-movements-summary-truncated")).toBeTruthy();
  });

  it("click en 'Cargar más' invoca al fetcher con skip = loaded.length", async () => {
    const initial: BalanceMovementsListResponse = {
      data: [makeMovUnified({ id: "u-1" })],
      total: 3, skip: 0, take: 1,
    };
    const fetcher = vi.fn().mockResolvedValue({
      data: [makeMovUnified({ id: "u-2" })],
      total: 3, skip: 1, take: 1,
    } satisfies BalanceMovementsListResponse);
    renderView({ initialData: initial, fetcher: fetcher as any, pageSize: 1 });
    fireEvent.click(screen.getByTestId("balance-movements-load-more"));
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith("ent-1", expect.objectContaining({ skip: 1 }));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fase 4.4 — Print-friendly: clase no-print en controles
// ─────────────────────────────────────────────────────────────────────────────

describe("EntityBalanceMovementsView — print friendly (Fase 4.4)", () => {
  it("la barra de filtros tiene clase 'no-print'", () => {
    renderView({ initialData: makeListResponse([makeMovUnified()]) });
    const filters = screen.getByTestId("balance-movements-filters");
    expect(filters.className).toMatch(/no-print/);
  });

  it("el botón 'Ver origen' tiene clase 'no-print'", () => {
    renderView({ initialData: makeListResponse([makeMovUnified()]) });
    const btn = screen.getByTestId("movement-view-origin-mov-u1");
    expect(btn.className).toMatch(/no-print/);
  });

  it("'Cargar más' tiene clase 'no-print' (wrapper)", () => {
    const initial: BalanceMovementsListResponse = {
      data: [makeMovUnified()], total: 5, skip: 0, take: 1,
    };
    renderView({ initialData: initial });
    const btn = screen.getByTestId("balance-movements-load-more");
    expect(btn.closest(".no-print")).toBeTruthy();
  });

  it("las cards de movimiento NO tienen clase 'no-print' (deben imprimirse)", () => {
    renderView({ initialData: makeListResponse([makeMovUnified()]) });
    const card = screen.getByTestId("movement-card-mov-u1");
    expect(card.className).not.toMatch(/no-print/);
  });
});
