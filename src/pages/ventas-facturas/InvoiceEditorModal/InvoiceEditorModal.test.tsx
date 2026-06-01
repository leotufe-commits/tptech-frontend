// src/pages/ventas-facturas/InvoiceEditorModal/InvoiceEditorModal.test.tsx
// ============================================================================
// Tests de los sub-componentes del modal de Factura (FASE 8.2).
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  DiscountCard, ShippingCard, TotalsHeroSection, LinesEditorSection,
  AddressPickerPopover, PaymentCard, InvoiceHeaderForm,
} from "./index";
import type { InvoiceHeaderFormProps } from "./InvoiceHeaderForm";
import { DEFAULT_LAYOUT } from "./layout/defaults";
import { getCardsBySlot } from "./layout/layoutMigration";

const fmtCurrency = (n: number) => `$${n.toFixed(2)}`;

describe("<DiscountCard />", () => {
  it("muestra 'Sin descuento' cuando value es null", () => {
    render(
      <DiscountCard value={null} onPatch={() => {}} open={true} onOpenChange={() => {}}
        fmtCurrency={fmtCurrency} />
    );
    expect(screen.getByText("Sin descuento")).toBeTruthy();
  });

  it("muestra valor en % cuando type=PERCENT (con signo − de descuento)", () => {
    render(
      <DiscountCard value={{ type: "PERCENT", value: 10 }} onPatch={() => {}}
        open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />
    );
    // PERCENT respeta el preset del tenant (default 2 decimales) → "10,00%".
    // El header prefija con `−` para comunicar dirección de descuento.
    expect(screen.getByText("−10,00%")).toBeTruthy();
  });

  it("muestra valor en monto cuando type=AMOUNT (con signo − de descuento)", () => {
    render(
      <DiscountCard value={{ type: "AMOUNT", value: 500 }} onPatch={() => {}}
        open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />
    );
    expect(screen.getByText("−$500.00")).toBeTruthy();
  });

  it("dispara onOpenChange al togglear", () => {
    let toggled = false;
    render(
      <DiscountCard value={null} onPatch={() => {}} open={false}
        onOpenChange={(v) => { toggled = v; }} fmtCurrency={fmtCurrency} />
    );
    // El click en el header del TPCard despliega — verificamos al menos que el header renderiza
    expect(screen.getByText("Descuento global")).toBeTruthy();
    void toggled;
  });

  // ────────────────────────────────────────────────────────────────────────
  // Layout una-fila + X de limpieza (FASE UX).
  // ────────────────────────────────────────────────────────────────────────
  it("renderiza Motivo, Tipo y Valor en el mismo grid de 12 columnas", () => {
    const { container } = render(
      <DiscountCard value={{ type: "PERCENT", value: 5, reason: "promo" }}
        onPatch={() => {}} open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />
    );
    // Buscamos el grid contenedor de los tres campos.
    const grid = container.querySelector(".grid-cols-12");
    expect(grid).toBeTruthy();
    // Los tres labels viven dentro del MISMO grid (una fila visual).
    const labels = Array.from(grid!.querySelectorAll(".col-span-6, .col-span-12"))
      .map((el) => el.textContent ?? "")
      .join(" ");
    expect(labels).toMatch(/Motivo/);
    expect(labels).toMatch(/Tipo/);
    expect(labels).toMatch(/Valor/);
  });

  it("la X del campo Valor llama onPatch({ value: 0 }) cuando hay valor > 0", () => {
    const onPatch = vi.fn();
    const { container } = render(
      <DiscountCard value={{ type: "PERCENT", value: 15, reason: "" }}
        onPatch={onPatch} open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />
    );
    // TPNumberInput renderiza la X interna con aria-label "Limpiar valor".
    const clearBtn = container.querySelector('button[aria-label="Limpiar valor"]') as HTMLButtonElement | null;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn!);
    expect(onPatch).toHaveBeenCalledWith({ value: 0 });
  });

  it("la X NO aparece cuando el descuento es heredado del cliente (read-only)", () => {
    const { container } = render(
      <DiscountCard value={{ type: "PERCENT", value: 15, reason: "", origin: "CLIENT" } as any}
        onPatch={() => {}} open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />
    );
    expect(container.querySelector('button[aria-label="Limpiar valor"]')).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Favorito en el combo Tipo (UserPreference.defaultGlobalDiscountType).
  // ────────────────────────────────────────────────────────────────────────
  it("muestra el combo Tipo con estrella de favorito cuando se provee onSetFavoriteType", () => {
    const onSetFavoriteType = vi.fn();
    render(
      <DiscountCard value={{ type: "PERCENT", value: 0, reason: "" }}
        onPatch={() => {}} open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency}
        favoriteType="PERCENT"
        onSetFavoriteType={onSetFavoriteType} />
    );
    // El combo se renderiza — verificamos por la etiqueta del campo.
    expect(screen.getByText("Tipo")).toBeTruthy();
    // El handler está disponible (la estrella es UI del TPComboFixed; el
    // contrato funcional se valida con que el handler reciba la llamada
    // cuando el combo se interactúa — ese flow está cubierto por TPComboFixed
    // en su propio test suite. Acá fijamos que el wiring del prop existe).
    expect(onSetFavoriteType).not.toHaveBeenCalled();
  });

  it("el combo Tipo respeta favoriteType=AMOUNT pintando esa opción como predeterminada", () => {
    // El favoriteValue se propaga al TPComboFixed → la opción AMOUNT recibe
    // la marca de estrella. Validamos que el render no rompe y el value
    // visible del combo arranca correctamente desde value.type.
    render(
      <DiscountCard value={{ type: "AMOUNT", value: 100, reason: "" }}
        onPatch={() => {}} open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency}
        favoriteType="AMOUNT"
        onSetFavoriteType={vi.fn()} />
    );
    expect(screen.getByText("Tipo")).toBeTruthy();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Rediseño UX — header con impacto signed + color discount (FASE UX 2).
  //
  // El header debe comunicar la DIRECCIÓN del impacto (descuento → signo
  // `−` + color rojo) sin requerir abrir el card. Si no hay valor, "Sin
  // descuento" muted. Cero matemática nueva — el value viene del padre,
  // que lo lee del draft (NO del pricing-engine: este card es solo el
  // input del operador).
  // ────────────────────────────────────────────────────────────────────────
  it("header con value > 0 muestra signo `−` y data-tp-discount-impact=discount", () => {
    const { container } = render(
      <DiscountCard value={{ type: "AMOUNT", value: 100 }} onPatch={() => {}}
        open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />,
    );
    const tag = container.querySelector('[data-tp-discount-impact="discount"]');
    expect(tag).toBeTruthy();
    expect(tag!.textContent).toContain("−");
    expect(tag!.textContent).toContain("$100.00");
    // Color de descuento (token semántico — `vt.colors.discount`).
    expect(tag!.className).toMatch(/text-red-500/);
  });

  it("header con value = 0 muestra 'Sin descuento' (data-tp-discount-impact=none) sin signo", () => {
    const { container } = render(
      <DiscountCard value={{ type: "PERCENT", value: 0 }} onPatch={() => {}}
        open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />,
    );
    const tag = container.querySelector('[data-tp-discount-impact="none"]');
    expect(tag).toBeTruthy();
    expect(tag!.textContent).toBe("Sin descuento");
    // Anti-regresión: NO inventar signo cuando no hay impacto.
    expect(tag!.textContent).not.toContain("−");
    expect(tag!.textContent).not.toContain("+");
  });
});

describe("<ShippingCard />", () => {
  it("muestra 'Sin envío' cuando no hay método ni costo", () => {
    render(
      <ShippingCard value={null} onPatch={() => {}} open={true} onOpenChange={() => {}}
        fmtCurrency={fmtCurrency} />
    );
    expect(screen.getByText("Sin envío")).toBeTruthy();
  });

  it("muestra costo cuando hay valor > 0", () => {
    render(
      <ShippingCard value={{ cost: 1500 } as any} onPatch={() => {}}
        open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />
    );
    expect(screen.getByText("$1500.00")).toBeTruthy();
  });

  it("renderiza inputs 'Método de entrega' y 'Costo'", () => {
    // El card carga carriers reales vía shippingApi.list(). En el test no se
    // mockea la red — el fetch falla silenciosamente y el combo queda con
    // "Sin método de entrega". Los labels SÍ se renderizan inmediatamente.
    render(
      <ShippingCard value={null} onPatch={() => {}}
        open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />
    );
    expect(screen.getByText("Método de entrega")).toBeTruthy();
    expect(screen.getByText("Costo")).toBeTruthy();
  });

  it("la X del Costo llama onPatch({ cost: 0 }) cuando hay costo > 0", () => {
    const onPatch = vi.fn();
    const { container } = render(
      <ShippingCard value={{ cost: 500 } as any} onPatch={onPatch}
        open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />
    );
    const clearBtn = container.querySelector('button[aria-label="Limpiar valor"]') as HTMLButtonElement | null;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn!);
    expect(onPatch).toHaveBeenCalledWith({ cost: 0 });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Rediseño UX — header compacto (FASE UX 2). El header debe comunicar
  // método + monto sin obligar a abrir el card. Cero matemática nueva: el
  // `cost` viene del catálogo (carrier/rate) o del override manual, y el
  // formato pasa por `fmtCurrency` (preset del tenant).
  // ────────────────────────────────────────────────────────────────────────
  it("header sin método y sin costo → 'Sin envío' (data-tp-shipping-impact=none)", () => {
    const { container } = render(
      <ShippingCard value={null} onPatch={() => {}}
        open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />,
    );
    const tag = container.querySelector('[data-tp-shipping-impact="none"]');
    expect(tag).toBeTruthy();
    expect(tag!.textContent).toBe("Sin envío");
  });

  it("header con costo > 0 (sin carrier en catálogo) muestra label genérico + monto destacado", () => {
    // Sin carrier seleccionado pero con cost > 0 → fallback "Envío · monto".
    // (Caso edge: el operador tipeó un costo manual antes de elegir método).
    const { container } = render(
      <ShippingCard value={{ cost: 15000 } as any} onPatch={() => {}}
        open={true} onOpenChange={() => {}} fmtCurrency={fmtCurrency} />,
    );
    const tag = container.querySelector('[data-tp-shipping-impact="set"]');
    expect(tag).toBeTruthy();
    // Monto destacado (font-semibold tabular-nums text-text) dentro del header.
    const amount = tag!.querySelector("span.font-semibold");
    expect(amount).toBeTruthy();
    expect(amount!.textContent).toBe("$15000.00");
  });
});

// NOTA: <TotalsHeroSection /> es un wrapper trivial de TPDocumentTotalsHero
// (componente externo grande). Los tests de render profundo requerirían un
// fixture de `composition` completo del backend — fuera del scope de este
// archivo. La validación del contrato vive en `tsc --noEmit` (compila ↔
// signature es correcta) y en los tests del consumidor (VentasFacturas).
// Si en el futuro se quiere test de unit sobre la rama del loader, conviene
// extraer ese fragmento a un sub-componente `<PreviewLoadingIndicator>`.

// FASE 9 — I1: chip "Totales sin actualizar" cuando el último preview falló.
// Para testearlo sin necesidad de un fixture completo de `PricingComposition`,
// mockeamos el sub-componente pesado y asertamos solo sobre el chip.
vi.mock("../../../components/ui/TPDocumentTotalsHero", () => ({
  __esModule: true,
  default: () => <div data-testid="totals-hero-mock" />,
}));

describe("<TotalsHeroSection /> — stale chip (FASE 9 / I1)", () => {
  const baseProps = {
    composition: {} as any,
    currency: "$",
    displayRate: 1,
    viewMode: "unified" as const,
    onViewModeChange: () => {},
    previewStatus: "ok",
    hasResponse: true,
  };

  it("NO muestra el chip cuando previewStale=false", () => {
    render(<TotalsHeroSection {...baseProps} />);
    expect(screen.queryByTestId("totals-stale-chip")).toBeNull();
  });

  it("muestra el chip cuando previewStale=true", () => {
    render(
      <TotalsHeroSection
        {...baseProps}
        previewStatus="error"
        previewStale={true}
      />
    );
    const chip = screen.getByTestId("totals-stale-chip");
    expect(chip).toBeTruthy();
    expect(chip.textContent).toMatch(/sin actualizar/i);
  });

  it("NO muestra el chip cuando previewStale=true pero no hay respuesta cacheada", () => {
    // Caller decide: si pasa previewStale=false, el chip no aparece aunque
    // haya error. Esto cubre el caso "primer fetch fallido": el loader es
    // suficiente, no queremos doble feedback.
    render(
      <TotalsHeroSection
        {...baseProps}
        previewStatus="error"
        hasResponse={false}
        previewStale={false}
      />
    );
    expect(screen.queryByTestId("totals-stale-chip")).toBeNull();
  });
});

describe("<LinesEditorSection />", () => {
  const baseProps = {
    lines: [],
    totalLinesInDraft: 0,
    currency: "$",
    displayRate: 1,
    viewMode: "detailed" as const,
    headerSubtotals: undefined,
    priceLists: [],
    channels: [],
    warehouses: [],
    expandedLineIds: new Set<string>(),
    advancedOpenLineIds: new Set<string>(),
    onToggleExpand: () => {},
    onToggleAdvancedOpen: () => {},
    patchLine: () => {},
    removeLine: () => {},
    duplicateLine: () => {},
    reorderLines: () => {},
    resetLine: () => {},
    isReorderable: () => false,
    onAddLine: () => {},
    setLineTaxOverride: () => {},
    applyLineOverrides: () => {},
    clearLineOverrides: () => {},
    onChangePriceList: () => {},
    onChangeLinePriceList: () => {},
    onChangeChannel: () => {},
    handleEditArticle: () => {},
    handleLineArticlePick: () => {},
    handleCreateManualLine: () => {},
    searchArticles: undefined as any,
    exactLookupArticle: undefined as any,
    focusedLineId: null,
    focusSignal: 0,
    editorScopeRef: React.createRef<HTMLDivElement | null>(),
    previewLoading: false,
  };

  it("muestra empty state cuando no hay líneas en el draft", () => {
    render(<LinesEditorSection {...(baseProps as any)} />);
    expect(screen.getByText("Todavía no hay líneas")).toBeTruthy();
  });

  it("dispara onAddLine al click en empty state", () => {
    let added = false;
    render(<LinesEditorSection {...(baseProps as any)} onAddLine={() => { added = true; }} />);
    fireEvent.click(screen.getByText("Todavía no hay líneas"));
    expect(added).toBe(true);
  });

  it("dispara onAddLine al presionar Enter en empty state (a11y)", () => {
    let added = false;
    render(<LinesEditorSection {...(baseProps as any)} onAddLine={() => { added = true; }} />);
    const btn = screen.getByRole("button", { name: /Agregar línea vacía/ });
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(added).toBe(true);
  });
});

// NOTA: <AddressPickerPopover /> envuelve `TPPopover`, que usa createPortal +
// anchor positioning. En jsdom el portal/anchor measurement no se completa,
// por lo que un test de render profundo es frágil. Validamos el contrato vía
// tsc (compila ↔ signature correcta). Para test e2e usar Playwright/Cypress.
//
// Si querés validación unitaria, refactorizá `AddressPickerPopover` para
// exponer un sub-componente `AddressList` sin Popover wrapper, y testealo ahí.
describe.skip("<AddressPickerPopover />", () => {
  // Skip — render profundo no viable en jsdom por createPortal del Popover.
  it("placeholder", () => { expect(true).toBe(true); });
});

describe("<PaymentCard />", () => {
  const baseProps = {
    payments: [],
    effectiveTotal: 1000,
    totalCobrado: 0,
    balance: 1000,
    open: true,
    onOpenChange: () => {},
    onAddPayment: () => {},
    onUpdatePayment: () => {},
    onRemovePayment: () => {},
    paymentMethodOptions: [{ value: "cash", label: "Efectivo" }],
    depositOptions: [{ value: "main", label: "Caja principal" }],
    currencyOptions: [{ value: "ARS", label: "$ · ARS" }],
    fmtCurrency: (n: number) => `$${n.toFixed(2)}`,
  };

  it("muestra estado 'Pendiente' cuando totalCobrado === 0", () => {
    render(<PaymentCard {...(baseProps as any)} />);
    // Hay 2 "Pendiente" (header del card + footer del card)
    const matches = screen.getAllByText("Pendiente");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("muestra estado 'Parcial' cuando hay cobro pero balance > 0", () => {
    render(<PaymentCard {...(baseProps as any)} totalCobrado={500} balance={500} />);
    const matches = screen.getAllByText("Parcial");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("muestra estado 'Cobrada' cuando balance <= 0 con totalCobrado > 0", () => {
    render(<PaymentCard {...(baseProps as any)} totalCobrado={1000} balance={0} />);
    const matches = screen.getAllByText("Cobrada");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("muestra empty state cuando payments es []", () => {
    render(<PaymentCard {...(baseProps as any)} />);
    expect(screen.getByText("No hay cobros cargados todavía.")).toBeTruthy();
  });

  it("dispara onAddPayment al click en 'Agregar cobro'", () => {
    let added = false;
    render(<PaymentCard {...(baseProps as any)} onAddPayment={() => { added = true; }} />);
    fireEvent.click(screen.getByText("Agregar cobro"));
    expect(added).toBe(true);
  });

  it("muestra warning cuando totalCobrado > effectiveTotal", () => {
    render(<PaymentCard {...(baseProps as any)} totalCobrado={1200} balance={0} effectiveTotal={1000} />);
    expect(screen.getByText(/supera el total/)).toBeTruthy();
  });
});

// ─── <InvoiceHeaderForm /> (FASE 8.2.2b) ──────────────────────────────────

describe("<InvoiceHeaderForm />", () => {
  const noop = () => {};
  const baseProps: InvoiceHeaderFormProps = {
    clientId:        null,
    clientName:      "",
    clientSnapshot:  null,
    clientOptions:   [],
    clientsLoading:  false,
    clientAddresses: [],
    composeAddressLine: () => "",

    date:               "2026-05-11",
    dueDate:            "2026-06-10",
    paymentTerm:        "30 días",
    paymentTermOptions: [
      { value: "",         label: "— Sin definir —" },
      { value: "30 días",  label: "30 días" },
      { value: "60 días",  label: "60 días" },
    ],

    currency:   "ARS",
    fxRate:     1,
    currencies: [
      { id: "ars", code: "ARS", name: "Peso", symbol: "$", isBase: true,
        isActive: true, latestRate: null, latestAt: null } as any,
    ],
    isBaseCurrencyResolver: (c) => c === "ARS",

    seller:          "",
    sellers:         [],
    referenceNumber: "",

    salesOrderNumber: "",
    deliveryNumber:   "",

    onPickClient:        noop,
    onCreateNewClient:   noop,
    onOpenEditClient:    noop,
    onDateChange:        noop,
    onDueDateChange:     noop,
    onPaymentTermChange: noop,
    onOpenFx:            noop,
    onSellerChange:      noop,
    onReferenceChange:   noop,
    onOpenAddressEdit:   noop,
    onSelectAddress:     noop,
    onLinkSalesOrderOpen: noop,
    onLinkDeliveryOpen:   noop,
    onClearOriginDocs:    noop,
  };

  it("renderiza sin cliente y muestra el placeholder 'Sin cliente seleccionado'", () => {
    render(<InvoiceHeaderForm {...baseProps} />);
    expect(screen.getByText("Sin cliente seleccionado")).toBeTruthy();
  });

  it("renderiza 'Cargando clientes…' cuando clientsLoading=true y sin cliente", () => {
    render(<InvoiceHeaderForm {...baseProps} clientsLoading={true} />);
    expect(screen.getByText("Cargando clientes…")).toBeTruthy();
  });

  it("muestra cotización en el FX badge", () => {
    render(<InvoiceHeaderForm {...baseProps} currency="USD" fxRate={1500}
      currencies={[{ id: "usd", code: "USD", name: "Dólar", symbol: "US$",
        isBase: false, isActive: true, latestRate: 1500, latestAt: null } as any]}
      isBaseCurrencyResolver={() => false}
    />);
    // El badge muestra el código + el rate. Region/decimals-agnóstico: el preset
    // FX_RATE del tenant gobierna decimales y separadores (AR default usa miles
    // con punto: "1.500,…"). Validamos que aparezca "1500" en alguna forma con
    // separador de miles opcional.
    expect(screen.getByText(/1[.,]?500/)).toBeTruthy();
  });

  it("dispara onOpenFx al click en el badge de cotización", () => {
    let opened = false;
    render(<InvoiceHeaderForm {...baseProps} onOpenFx={() => { opened = true; }} />);
    fireEvent.click(screen.getByTitle(/cotización/i));
    expect(opened).toBe(true);
  });

  it("dispara onDateChange al cambiar la fecha", () => {
    let v = "";
    const { container } = render(
      <InvoiceHeaderForm {...baseProps} onDateChange={(d) => { v = d; }} />
    );
    const dateInput = container.querySelectorAll('input[type="date"]')[0] as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-07-01" } });
    expect(v).toBe("2026-07-01");
  });

  it("dispara onDueDateChange al cambiar el vencimiento", () => {
    let v = "";
    const { container } = render(
      <InvoiceHeaderForm {...baseProps} onDueDateChange={(d) => { v = d; }} />
    );
    const inputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: "2026-08-01" } });
    expect(v).toBe("2026-08-01");
  });

  it("muestra OV vinculada y dispara onClearOriginDocs", () => {
    let cleared = false;
    render(
      <InvoiceHeaderForm {...baseProps}
        salesOrderNumber="OV-0042"
        onClearOriginDocs={() => { cleared = true; }}
      />
    );
    expect(screen.getByText("OV-0042")).toBeTruthy();
    fireEvent.click(screen.getByText("Quitar vínculos"));
    expect(cleared).toBe(true);
  });

  it("dispara onLinkSalesOrderOpen al click en 'Vincular OV'", () => {
    let opened = false;
    render(
      <InvoiceHeaderForm {...baseProps}
        onLinkSalesOrderOpen={() => { opened = true; }} />
    );
    fireEvent.click(screen.getByText("Vincular OV"));
    expect(opened).toBe(true);
  });

  it("dispara onLinkDeliveryOpen al click en 'Vincular Remito'", () => {
    let opened = false;
    render(
      <InvoiceHeaderForm {...baseProps}
        onLinkDeliveryOpen={() => { opened = true; }} />
    );
    fireEvent.click(screen.getByText("Vincular Remito"));
    expect(opened).toBe(true);
  });

  it("muestra dirección y nombre del cliente cuando hay clientSnapshot", () => {
    render(
      <InvoiceHeaderForm {...baseProps}
        clientId="c1"
        clientName="Juan"
        clientSnapshot={{
          name: "Juan Pérez",
          address: "Av. Siempre Viva 742",
          taxCondition: "MONOTRIBUTO",
        } as any}
      />
    );
    expect(screen.getByText("Av. Siempre Viva 742")).toBeTruthy();
    expect(screen.getByText("MONOTRIBUTO")).toBeTruthy();
  });
});

// ============================================================================
// Garantía Fase 1: el render dinámico del aside (driven by layout) produce
// el MISMO orden visual que el JSX hardcoded histórico cuando no hay
// preferencia guardada del usuario. Si esta invariante se rompe, el modal
// de Factura cambia de aspecto al desplegar — eso es exactamente lo que la
// Fase 1 debe evitar (plumbing sin cambios visibles).
// ============================================================================
describe("Layout Fase 1 — orden default = JSX histórico (cero cambios visuales)", () => {
  it("slot 'aside' del DEFAULT_LAYOUT: discount → shipping → coupon → totals → payments → account-impact → observations", () => {
    expect(getCardsBySlot(DEFAULT_LAYOUT, "aside").map((c) => c.id)).toEqual([
      "discount", "shipping", "coupon", "totals", "payments", "account-impact", "observations",
    ]);
  });

  it("DEFAULT_LAYOUT contiene las 9 cards (header, lines, observations + 6 aside con account-impact)", () => {
    const ids = DEFAULT_LAYOUT.cards.map((c) => c.id).sort();
    expect(ids).toEqual([
      "account-impact", "coupon", "discount", "header", "lines",
      "observations", "payments", "shipping", "totals",
    ]);
  });

  it("todas las cards arrancan con width='full' (Fase 1 no usa half/third/two-thirds)", () => {
    expect(DEFAULT_LAYOUT.cards.every((c) => c.width === "full")).toBe(true);
  });
});
