// src/pages/ventas-facturas/InvoiceEditorModal/InvoiceHeaderForm.tsx
// ============================================================================
// FASE 8.2.2b — Cabecera de Factura extraída del monolito VentasFacturas.tsx.
//
// Componente CONTROLADO + PRESENTACIONAL. Renderiza el `TPCard` "Datos de la
// factura" con:
//   · FXBadge          → cotización vigente del documento (top-right del card)
//   · ClientSection    → selector de cliente + chip fiscal + popover de
//                        direcciones (estado UI propio, no leakea al padre)
//   · DatesTermsSection → fecha · vencimiento · término de pago
//   · CommercialSection → vendedor · nro de referencia
//   · OriginDocsSection → OV · Remito · vincular / quitar
//
// REGLAS arquitectónicas:
//   • Cero lógica comercial: el componente NO calcula precios, descuentos,
//     impuestos, fechas-de-vencimiento ni canónica de términos. Solo emite
//     callbacks semánticos al padre (`onPaymentTermChange` recibe el label
//     elegido — el padre re-calcula `dueDate`).
//   • Cero acceso a APIs / fetch.
//   • Cero acoplamiento al draft completo: el padre desestructura y pasa
//     solo los campos relevantes. Si se necesita info nueva, se agrega prop.
//   • El popover de direcciones es interno (open state local) porque ningún
//     consumidor del padre lo lee. El `AddressEditModal` sí queda en el
//     padre (es un modal flotante con su propia vida).
//   • La FX badge es un sub-render local: la fuente de verdad de la
//     cotización vive en el padre (`draft.fxRate`, `currencies` catalog).
// ============================================================================

import React, { useRef } from "react";
import {
  Coins, AlertTriangle, Pencil, MapPin, Plus, FileText, Link2,
} from "lucide-react";

import { cn } from "../../../components/ui/tp";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPInput from "../../../components/ui/TPInput";
import TPSelect from "../../../components/ui/TPSelect";
import { TPIconButton } from "../../../components/ui/TPIconButton";
import {
  TPEntitySearchSelect,
  type TPEntityLite,
} from "../../../components/ui/TPEntitySearchSelect";

import { AddressPickerPopover, type AddressOption } from "./AddressPickerPopover";
import type { ClientSnapshot } from "../../../lib/sales/types";
import type { CurrencyRow } from "../../../services/valuation";
import type { SellerRow } from "../../../services/sellers";

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export type SelectOption = { value: string; label: string };

export type InvoiceHeaderFormProps = {
  // ── Identity / context ────────────────────────────────────────────────────
  clientId:        string | null | undefined;
  clientName:      string;                     // legacy `draft.client`
  clientSnapshot:  ClientSnapshot | null | undefined;
  clientOptions:   ReadonlyArray<TPEntityLite>;
  clientsLoading:  boolean;
  clientAddresses: ReadonlyArray<AddressOption>;
  composeAddressLine: (addr: AddressOption) => string;

  // ── Dates / term ──────────────────────────────────────────────────────────
  date:                string;
  dueDate:             string;
  paymentTerm:         string;
  paymentTermOptions:  ReadonlyArray<SelectOption>;

  // ── Currency / FX badge ───────────────────────────────────────────────────
  currency:    string;        // id o code del draft
  fxRate:      number;
  currencies:  ReadonlyArray<CurrencyRow>;
  /** Resolver de "¿esta moneda es la base?". Inyectable para no duplicar
   *  `isBaseCurrency` del módulo `document-types`. */
  isBaseCurrencyResolver: (idOrCode: string) => boolean;

  // ── Comercial ─────────────────────────────────────────────────────────────
  seller:           string;
  sellers:          ReadonlyArray<SellerRow>;
  referenceNumber:  string;

  // ── Origin docs ──────────────────────────────────────────────────────────
  salesOrderNumber: string;
  deliveryNumber:   string;

  // ── Callbacks semánticos ─────────────────────────────────────────────────
  onPickClient:        (entity: TPEntityLite | null) => void;
  onCreateNewClient:   () => void;
  onOpenEditClient:    () => void;

  onDateChange:        (newDate: string) => void;
  onDueDateChange:     (newDueDate: string) => void;
  onPaymentTermChange: (term: string) => void;

  onOpenFx:            () => void;

  /** Cambio de vendedor. El padre decide si recordar "seleccionó Sin asignar"
   *  para suprimir el seed por favorito (`sellerExplicitlyClearedRef`). */
  onSellerChange:      (sellerId: string) => void;
  onReferenceChange:   (val: string) => void;

  onOpenAddressEdit:   () => void;
  onSelectAddress:     (addressId: string) => void;

  onLinkSalesOrderOpen: () => void;
  onLinkDeliveryOpen:   () => void;
  onClearOriginDocs:    () => void;
  /** Acción "ver documento origen" — hoy placeholder (toast.info en el
   *  padre). Se invoca al click sobre el chip de OV/Remito ya vinculado. */
  onViewSalesOrder?:    () => void;
  onViewDelivery?:      () => void;
};

// ─── Sub-bloque: badge FX (top-right del card) ──────────────────────────────

type FXBadgeProps = {
  currency:               string;
  fxRate:                 number;
  currencies:             ReadonlyArray<CurrencyRow>;
  isBaseCurrencyResolver: (idOrCode: string) => boolean;
  onOpenFx:               () => void;
};

function FXBadge({
  currency, fxRate, currencies, isBaseCurrencyResolver, onOpenFx,
}: FXBadgeProps): React.ReactElement {
  const cur = currencies.find((c) => c.code === currency || c.id === currency);
  const isBase = cur?.isBase ?? isBaseCurrencyResolver(currency);
  const code   = cur?.code   ?? currency;
  const symbol = (cur?.symbol ?? "").trim();
  // Cotización ACTIVA del documento — preferimos `fxRate` (lo aplicado por el
  // operador vía "Actualizar cotización"). Antes este valor caía a
  // `cur.latestRate` (catálogo) y mostraba la del sistema, no la manual.
  const draftRate = Number(fxRate);
  const rate = isBase
    ? 1
    : (Number.isFinite(draftRate) && draftRate > 0
        ? draftRate
        : (cur?.latestRate ?? fxRate));
  const hasRate = isBase
    || (Number.isFinite(draftRate) && draftRate > 0)
    || cur?.latestRate != null;
  const display = symbol || code;
  return (
    <button
      type="button"
      data-tp-enter="ignore"
      onClick={onOpenFx}
      title={hasRate ? "Click para actualizar cotización" : "Sin cotización vigente — click para cargar"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-surface/50 px-2 py-1 text-left transition hover:bg-surface",
        hasRate ? "border-border" : "border-amber-500/50",
      )}
    >
      <Coins size={12} className={hasRate ? "text-muted" : "text-amber-500"} />
      <span className="text-[11px] font-bold tabular-nums text-text">
        {display} {hasRate ? Number(rate).toFixed(2) : "—"}
      </span>
      {!hasRate && <AlertTriangle size={10} className="text-amber-500" />}
    </button>
  );
}

// ─── Sub-bloque: ClientSection ─────────────────────────────────────────────

type ClientSectionProps = Pick<
  InvoiceHeaderFormProps,
  | "clientId" | "clientName" | "clientSnapshot" | "clientOptions"
  | "clientsLoading" | "clientAddresses" | "composeAddressLine"
  | "onPickClient" | "onCreateNewClient" | "onOpenEditClient"
  | "onOpenAddressEdit" | "onSelectAddress"
>;

function ClientSection(props: ClientSectionProps): React.ReactElement {
  const {
    clientId, clientName, clientSnapshot, clientOptions, clientsLoading,
    clientAddresses, composeAddressLine,
    onPickClient, onCreateNewClient, onOpenEditClient,
    onOpenAddressEdit, onSelectAddress,
  } = props;

  // Estado UI local — el popover de direcciones no tiene consumidores fuera
  // del header. Si en el futuro algún flujo externo lo necesita controlado,
  // se promueve a prop sin cambiar la API pública del resto.
  const [addressPopOpen, setAddressPopOpen] = React.useState(false);
  const addressBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="space-y-0.5">
      <TPField label="Cliente" required>
        <div className="flex items-stretch gap-1.5">
          <div className="min-w-0 flex-1">
            <TPEntitySearchSelect
              type="client"
              value={clientId
                ? { id: clientId, name: clientSnapshot?.name ?? clientName }
                : null}
              options={clientOptions as TPEntityLite[]}
              onChange={onPickClient}
              onCreateNew={onCreateNewClient}
              hideAddressLine
            />
          </div>
          {clientId && (
            <TPIconButton
              onClick={onOpenEditClient}
              title="Editar cliente"
              className="h-9 w-9"
            >
              <Pencil size={14} />
            </TPIconButton>
          )}
        </div>
      </TPField>

      {!clientId && !clientName && (
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span>{clientsLoading ? "Cargando clientes…" : "Sin cliente seleccionado"}</span>
        </div>
      )}

      {clientId && clientSnapshot && (() => {
        const snap = clientSnapshot;
        // Línea 1 — segmentos sin labels (solo valores limpios).
        const docSegment = (snap.documentType && snap.documentNumber)
          ? `${snap.documentType} ${snap.documentNumber}`
          : (snap.documentNumber || snap.documentType || null);
        const segments = [
          docSegment,
          snap.taxCondition || null,
          snap.phone || null,
        ].filter(Boolean) as string[];

        const handleAddressAction = () => {
          const hasAddrs = clientAddresses.length > 0;
          if (!hasAddrs) { onOpenAddressEdit(); return; }
          setAddressPopOpen((o) => !o);
        };

        const fiscalLine = segments.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted">
            {segments.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-border">•</span>}
                <span className="truncate text-text/80">{s}</span>
              </React.Fragment>
            ))}
          </div>
        ) : null;

        const cambiarBtn = (
          <button
            ref={addressBtnRef}
            type="button"
            data-tp-enter="ignore"
            onClick={handleAddressAction}
            className="inline-flex shrink-0 items-center gap-1 text-[12px] text-primary hover:underline"
          >
            <Pencil size={11} /> Cambiar dirección
          </button>
        );
        const agregarBtn = (
          <button
            ref={addressBtnRef}
            type="button"
            data-tp-enter="ignore"
            onClick={handleAddressAction}
            className="inline-flex shrink-0 items-center gap-1 text-[12px] text-primary hover:underline"
          >
            <Plus size={11} /> Agregar dirección
          </button>
        );

        // Padding derecho que iguala el offset del botón lápiz a la derecha
        // del combo: w-9 (36px) + gap-1.5 (6px) = 42px. Así el final del
        // botón se alinea con el borde derecho del input de cliente.
        const rowPadRight = "pr-[2.625rem]";

        const innerNode = snap.address ? (
          <div className="flex flex-col gap-1.5">
            <div className={cn("flex items-center justify-between gap-3", rowPadRight)}>
              <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
                <MapPin size={13} className="shrink-0 text-muted" />
                <span className="min-w-0 truncate text-text">{snap.address}</span>
              </div>
              {cambiarBtn}
            </div>
            {fiscalLine}
          </div>
        ) : (
          <div className={cn("flex items-center justify-between gap-3", rowPadRight)}>
            {fiscalLine ?? <span className="min-w-0 flex-1" />}
            {agregarBtn}
          </div>
        );

        return (
          <>
            {innerNode}
            <AddressPickerPopover
              open={addressPopOpen}
              onClose={() => setAddressPopOpen(false)}
              anchorRef={addressBtnRef}
              addresses={clientAddresses as AddressOption[]}
              selectedAddressId={snap.addressId ?? null}
              composeAddressLine={composeAddressLine}
              onSelectAddress={(id) => {
                onSelectAddress(id);
                setAddressPopOpen(false);
              }}
              onAddAddress={() => {
                setAddressPopOpen(false);
                onOpenAddressEdit();
              }}
            />
          </>
        );
      })()}
    </div>
  );
}

// ─── Sub-bloque: DatesTermsSection ─────────────────────────────────────────

type DatesTermsSectionProps = Pick<
  InvoiceHeaderFormProps,
  | "date" | "dueDate" | "paymentTerm" | "paymentTermOptions"
  | "onDateChange" | "onDueDateChange" | "onPaymentTermChange"
>;

function DatesTermsSection(props: DatesTermsSectionProps): React.ReactElement {
  const {
    date, dueDate, paymentTerm, paymentTermOptions,
    onDateChange, onDueDateChange, onPaymentTermChange,
  } = props;
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
      <TPField label="Fecha" required>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="tp-input w-full"
        />
      </TPField>
      <TPField label="Vencimiento">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => onDueDateChange(e.target.value)}
          className="tp-input w-full"
        />
      </TPField>
      <TPField label="Término de pago">
        <TPSelect
          value={paymentTerm}
          onChange={onPaymentTermChange}
          options={paymentTermOptions as SelectOption[]}
        />
      </TPField>
    </div>
  );
}

// ─── Sub-bloque: CommercialSection ─────────────────────────────────────────

type CommercialSectionProps = Pick<
  InvoiceHeaderFormProps,
  "seller" | "sellers" | "referenceNumber" | "onSellerChange" | "onReferenceChange"
>;

function CommercialSection(props: CommercialSectionProps): React.ReactElement {
  const { seller, sellers, referenceNumber, onSellerChange, onReferenceChange } = props;
  const sellerOptions: SelectOption[] = [
    { value: "", label: "— Sin asignar —" },
    ...sellers.map((s) => ({
      value: s.id,
      label: s.displayName
        || `${s.firstName} ${s.lastName}`.trim()
        || "(sin nombre)",
    })),
  ];
  // Ghost option si el draft.seller no está en la lista activa (ej. vendedor
  // desactivado / id legacy del cliente).
  if (seller && !sellerOptions.some((o) => o.value === seller)) {
    sellerOptions.push({
      value: seller,
      label: `${seller.slice(0, 8)}… (no listado)`,
    });
  }
  return (
    <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      <TPField label="Vendedor">
        <TPSelect
          value={seller}
          onChange={onSellerChange}
          options={sellerOptions}
        />
      </TPField>
      <TPField label="Nro. de referencia">
        <TPInput
          value={referenceNumber}
          onChange={onReferenceChange}
          placeholder="Referencia interna / externa"
        />
      </TPField>
    </div>
  );
}

// ─── Sub-bloque: OriginDocsSection ─────────────────────────────────────────

type OriginDocsSectionProps = Pick<
  InvoiceHeaderFormProps,
  | "salesOrderNumber" | "deliveryNumber"
  | "onLinkSalesOrderOpen" | "onLinkDeliveryOpen" | "onClearOriginDocs"
  | "onViewSalesOrder"    | "onViewDelivery"
>;

function OriginDocsSection(props: OriginDocsSectionProps): React.ReactElement {
  const {
    salesOrderNumber, deliveryNumber,
    onLinkSalesOrderOpen, onLinkDeliveryOpen, onClearOriginDocs,
    onViewSalesOrder, onViewDelivery,
  } = props;
  const hasAny = !!(salesOrderNumber || deliveryNumber);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        Documentos origen:
      </span>
      {salesOrderNumber ? (
        <button
          type="button"
          data-tp-enter="ignore"
          // El "ver" del doc origen sigue siendo placeholder; el callback
          // específico vive en el padre (toast.info). Por ahora la propia
          // sección no hace nada al click — esto preserva 100% el comportamiento
          // anterior (toast en el padre lo dispara el handler de la página).
          onClick={() => onViewSalesOrder?.()}
          className="inline-flex items-center gap-1 rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-mono text-info hover:bg-info/20"
          title="Ver documento origen"
        >
          <FileText size={11} />
          {salesOrderNumber}
        </button>
      ) : (
        <button
          type="button"
          data-tp-enter="ignore"
          onClick={onLinkSalesOrderOpen}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-surface/40 px-2 py-0.5 text-[11px] text-muted hover:bg-surface"
        >
          <Link2 size={11} /> Vincular OV
        </button>
      )}
      {deliveryNumber ? (
        <button
          type="button"
          data-tp-enter="ignore"
          onClick={() => onViewDelivery?.()}
          className="inline-flex items-center gap-1 rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-mono text-info hover:bg-info/20"
          title="Ver documento origen"
        >
          <FileText size={11} />
          {deliveryNumber}
        </button>
      ) : (
        <button
          type="button"
          data-tp-enter="ignore"
          onClick={onLinkDeliveryOpen}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-surface/40 px-2 py-0.5 text-[11px] text-muted hover:bg-surface"
        >
          <Link2 size={11} /> Vincular Remito
        </button>
      )}
      {hasAny && (
        <button
          type="button"
          data-tp-enter="ignore"
          onClick={onClearOriginDocs}
          className="ml-auto text-[11px] text-muted hover:text-text hover:underline"
        >
          Quitar vínculos
        </button>
      )}
    </div>
  );
}

// ─── InvoiceHeaderForm (orchestrator) ──────────────────────────────────────

export function InvoiceHeaderForm(props: InvoiceHeaderFormProps): React.ReactElement {
  return (
    <TPCard
      title="Datos de la factura"
      bodyClassName="!p-2.5 !pt-2"
      headerClassName="!py-1.5"
      right={
        <FXBadge
          currency={props.currency}
          fxRate={props.fxRate}
          currencies={props.currencies}
          isBaseCurrencyResolver={props.isBaseCurrencyResolver}
          onOpenFx={props.onOpenFx}
        />
      }
    >
      {/* ─── Bloque 1: Cliente (con dirección) | Fechas + Término ─── */}
      <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-[2fr_1fr]">
        <ClientSection
          clientId={props.clientId}
          clientName={props.clientName}
          clientSnapshot={props.clientSnapshot}
          clientOptions={props.clientOptions}
          clientsLoading={props.clientsLoading}
          clientAddresses={props.clientAddresses}
          composeAddressLine={props.composeAddressLine}
          onPickClient={props.onPickClient}
          onCreateNewClient={props.onCreateNewClient}
          onOpenEditClient={props.onOpenEditClient}
          onOpenAddressEdit={props.onOpenAddressEdit}
          onSelectAddress={props.onSelectAddress}
        />
        <DatesTermsSection
          date={props.date}
          dueDate={props.dueDate}
          paymentTerm={props.paymentTerm}
          paymentTermOptions={props.paymentTermOptions}
          onDateChange={props.onDateChange}
          onDueDateChange={props.onDueDateChange}
          onPaymentTermChange={props.onPaymentTermChange}
        />
      </div>

      <CommercialSection
        seller={props.seller}
        sellers={props.sellers}
        referenceNumber={props.referenceNumber}
        onSellerChange={props.onSellerChange}
        onReferenceChange={props.onReferenceChange}
      />

      <OriginDocsSection
        salesOrderNumber={props.salesOrderNumber}
        deliveryNumber={props.deliveryNumber}
        onLinkSalesOrderOpen={props.onLinkSalesOrderOpen}
        onLinkDeliveryOpen={props.onLinkDeliveryOpen}
        onClearOriginDocs={props.onClearOriginDocs}
        onViewSalesOrder={props.onViewSalesOrder}
        onViewDelivery={props.onViewDelivery}
      />
    </TPCard>
  );
}

export default InvoiceHeaderForm;
