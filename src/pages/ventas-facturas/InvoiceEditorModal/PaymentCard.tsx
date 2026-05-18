// src/pages/ventas-facturas/InvoiceEditorModal/PaymentCard.tsx
// ============================================================================
// Card "Cobro" del aside derecho del modal de Factura.
//
// Extraído de VentasFacturas.tsx durante FASE 8.2.3. Componente PURO de
// presentación: state machine de `payments[]` (add/update/remove + sync a
// draft.paidAmount) PERMANECE en el caller — esta card es solo render +
// passthrough de eventos. Preserva paridad de comportamiento al 100%.
//
// Bloques:
//   - Header con badge (Cobrada / Parcial / Pendiente) y saldo restante.
//   - Lista de pagos (cada uno con medio, depósito, monto, moneda + remove).
//   - Botón "Agregar cobro".
//   - Resumen (Total a facturar / Cobrado / Saldo).
//   - Banner de warning si `totalCobrado > total`.
//   - Estado final (Cobrada / Parcial / Pendiente).
// ============================================================================

import React from "react";
import { Trash2, Plus, AlertTriangle } from "lucide-react";
import { cn } from "../../../components/ui/tp";
import { TPCard } from "../../../components/ui/TPCard";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import TPSelect from "../../../components/ui/TPSelect";

/** Una línea de cobro. Mismo shape que `PaymentEntry` en VentasFacturas.tsx
 *  — declarado acá para evitar imports cruzados. Si en el futuro el tipo
 *  se externaliza (a `src/lib/sales/types.ts`), reemplazar este alias. */
export type PaymentRow = {
  id:         string;
  methodId:   string;
  depositId:  string;
  amount:     number;
  currency:   string;
};

export type PaymentCardProps = {
  /** Lista actual de cobros. */
  payments:        PaymentRow[];
  /** Total a facturar del documento (post pricing). */
  effectiveTotal:  number;
  /** Total cobrado (suma de `payments[].amount`). El caller lo memoiza para
   *  evitar recompute en cada render. */
  totalCobrado:    number;
  /** Saldo = max(0, effectiveTotal - paidAmount). El caller lo memoiza. */
  balance:         number;

  /** Estado open/close del card colapsable. */
  open:            boolean;
  onOpenChange:    (open: boolean) => void;

  /** Callbacks de mutación. */
  onAddPayment:    () => void;
  onUpdatePayment: (id: string, patch: Partial<PaymentRow>) => void;
  onRemovePayment: (id: string) => void;

  /** Catálogos de display. Inyectados para que el componente NO importe
   *  catálogos de negocio (los mocks pueden variar entre pantallas). */
  paymentMethodOptions: ReadonlyArray<{ value: string; label: string }>;
  depositOptions:       ReadonlyArray<{ value: string; label: string }>;
  currencyOptions:      ReadonlyArray<{ value: string; label: string }>;

  /** Formatter de moneda — inyectado del caller. */
  fmtCurrency:     (amount: number) => string;
};

export function PaymentCard(props: PaymentCardProps): React.ReactElement {
  const {
    payments, effectiveTotal, totalCobrado, balance,
    open, onOpenChange,
    onAddPayment, onUpdatePayment, onRemovePayment,
    paymentMethodOptions, depositOptions, currencyOptions,
    fmtCurrency,
  } = props;

  const statusLabel = balance <= 0 && totalCobrado > 0
    ? "Cobrada"
    : totalCobrado > 0 ? "Parcial" : "Pendiente";
  const statusColor = balance <= 0 && totalCobrado > 0
    ? "text-emerald-500"
    : "text-amber-500";

  return (
    <TPCard
      title="Cobro"
      bodyClassName="!p-3"
      headerClassName="!py-2"
      collapsible
      open={open}
      onOpenChange={onOpenChange}
      right={
        <span className="text-[11px]">
          <span className={cn("font-semibold", statusColor)}>{statusLabel}</span>
          {(totalCobrado > 0 || balance > 0) && (
            <>
              <span className="mx-1.5 text-border">·</span>
              <span className="text-muted">Saldo </span>
              <span className="font-semibold tabular-nums text-text">
                {fmtCurrency(balance)}
              </span>
            </>
          )}
        </span>
      }
    >
      <div className="space-y-2">
        {payments.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-surface2/30 px-3 py-3 text-center text-[11px] text-muted">
            No hay cobros cargados todavía.
          </div>
        )}

        {payments.map((p, idx) => {
          const depositMissing = !p.depositId;
          const depositLabel = depositOptions.find((d) => d.value === p.depositId)?.label;
          return (
            <div
              key={p.id}
              className={cn(
                "space-y-1.5 rounded-md border bg-surface2/30 p-2",
                depositMissing ? "border-red-500/60" : "border-border",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Cobro {idx + 1}
                </span>
                {!depositMissing && depositLabel && (
                  <span className="text-[10px] text-muted truncate">· {depositLabel}</span>
                )}
                <button
                  type="button"
                  data-tp-enter="ignore"
                  onClick={() => onRemovePayment(p.id)}
                  title="Eliminar cobro"
                  aria-label="Eliminar cobro"
                  className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-muted transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* 1. Cómo paga → Medio de pago */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Medio de pago</div>
                <TPSelect
                  value={p.methodId}
                  onChange={(v) => onUpdatePayment(p.id, { methodId: v })}
                  options={paymentMethodOptions.map((m) => ({ value: m.value, label: m.label }))}
                />
              </div>

              {/* 2. Dónde impacta → Depósito (full width, mismo ancho que Medio) */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Depósito / Caja destino <span className="text-red-500">*</span>
                </div>
                <TPSelect
                  value={p.depositId}
                  onChange={(v) => onUpdatePayment(p.id, { depositId: v })}
                  options={[
                    { value: "", label: "— Seleccionar —" },
                    ...depositOptions.map((d) => ({ value: d.value, label: d.label })),
                  ]}
                  className={cn(depositMissing && "!border-red-500/60")}
                />
                {depositMissing && (
                  <div className="mt-1 text-[10px] text-red-500">
                    Seleccioná un depósito o caja destino para registrar el cobro.
                  </div>
                )}
              </div>

              {/* 3. Cuánto → Monto + Moneda */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Monto</div>
                  <TPNumberInput
                    value={p.amount}
                    onChange={(v) => onUpdatePayment(p.id, { amount: v ?? 0 })}
                    decimals={2}
                    min={0}
                  />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Moneda</div>
                  <TPSelect
                    value={p.currency}
                    onChange={(v) => onUpdatePayment(p.id, { currency: v })}
                    options={currencyOptions.map((c) => ({ value: c.value, label: c.label }))}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          data-tp-enter="ignore"
          onClick={onAddPayment}
          className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border bg-surface2/30 px-3 py-2 text-[11px] font-semibold text-primary transition hover:bg-surface2/60"
        >
          <Plus size={12} /> Agregar cobro
        </button>

        {/* Resumen */}
        <div className="space-y-1 rounded-md border border-border/60 bg-surface2/30 p-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted">Total a facturar</span>
            <span className="tabular-nums font-semibold text-text">{fmtCurrency(effectiveTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Cobrado</span>
            <span className="tabular-nums font-semibold text-emerald-500">
              {totalCobrado > 0 ? fmtCurrency(totalCobrado) : "—"}
            </span>
          </div>
          <div className="flex justify-between border-t border-border/60 pt-1">
            <span className="font-semibold text-text">Saldo</span>
            <span className={cn(
              "tabular-nums font-bold",
              balance > 0 ? "text-amber-500" : "text-emerald-500"
            )}>
              {fmtCurrency(balance)}
            </span>
          </div>
        </div>

        {totalCobrado > effectiveTotal + 0.001 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-500">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              El total cobrado <strong className="tabular-nums">{fmtCurrency(totalCobrado)}</strong> supera el total a facturar.
            </span>
          </div>
        )}

        <div className="rounded bg-surface2/40 px-2 py-1 text-center text-[10px] uppercase tracking-wide">
          <span className={cn("font-semibold", statusColor)}>{statusLabel}</span>
        </div>
      </div>
    </TPCard>
  );
}

export default PaymentCard;
