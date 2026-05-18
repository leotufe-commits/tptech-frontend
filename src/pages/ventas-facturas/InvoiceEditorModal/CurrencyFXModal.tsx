// src/pages/ventas-facturas/InvoiceEditorModal/CurrencyFXModal.tsx
// ============================================================================
// Modal "Actualizar cotización" del comprobante.
//
// Extraído de VentasFacturas.tsx durante FASE 8.2.3. Componente PURO de
// presentación + edición — toda la lógica de side-effects (actualizar
// catálogo de monedas vía POST /currencies/:id/rates) queda en el caller
// vía `onApply`.
//
// IMPORTANTE: este componente NO valida ni calcula tasas. El caller decide
// si el valor `fxRate` ingresado es válido y cómo persistirlo (al draft + al
// catálogo según el flag `updateSystem`).
// ============================================================================

import React from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { TPButton } from "../../../components/ui/TPButton";
import { TPField } from "../../../components/ui/TPField";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import TPSelect from "../../../components/ui/TPSelect";
import { TPCheckbox } from "../../../components/ui/TPCheckbox";
import { CURRENCY_MOCK_OPTIONS, isBaseCurrency } from "../../../lib/document-types";
import { fmtDate } from "../../../lib/document-helpers";
import type { CurrencyRow } from "../../../services/valuation";

export type FxDraftValue = {
  currency: string;
  fxRate:   number;
};

export type CurrencyFXModalProps = {
  open:    boolean;
  onClose: () => void;
  /** Catálogo de monedas. Si está vacío, cae al `CURRENCY_MOCK_OPTIONS`. */
  currencies: CurrencyRow[];
  /** Valor del modal (currency + fxRate editables). */
  value:   FxDraftValue;
  /** Setter del valor. Permite que el caller actualice ambos campos en
   *  simultáneo o uno a la vez. */
  onValueChange: (next: FxDraftValue | ((prev: FxDraftValue) => FxDraftValue)) => void;
  /** Flag "Actualizar también el catálogo de monedas". */
  updateSystem: boolean;
  onUpdateSystemChange: (next: boolean) => void;
  /** Callback al click en "Aplicar" o Enter. Caller decide qué hacer
   *  (mutar draft, side-effects con POST /currencies, cerrar modal). */
  onApply: () => void;
};

/** Busca una moneda por code o id. Helper local — exportado por si el
 *  caller quiere reusarlo (ej: VentasFacturas tiene su propia versión). */
function findCurrency(currencies: CurrencyRow[], idOrCode?: string): CurrencyRow | undefined {
  if (!idOrCode) return undefined;
  return currencies.find((c) => c.code === idOrCode || c.id === idOrCode);
}

export function CurrencyFXModal(props: CurrencyFXModalProps): React.ReactElement {
  const {
    open, onClose, currencies, value, onValueChange,
    updateSystem, onUpdateSystemChange, onApply,
  } = props;

  /** True si la moneda actual del modal es la base del tenant. */
  function isBaseReal(idOrCode?: string): boolean {
    const cur = findCurrency(currencies, idOrCode);
    if (cur) return cur.isBase;
    return isBaseCurrency(idOrCode);
  }

  /** Cambio de moneda: autorrellena la cotización con la última vigente. */
  function handleCurrencyChange(code: string) {
    const cur = findCurrency(currencies, code);
    if (cur?.isBase) {
      onValueChange({ currency: code, fxRate: 1 });
      return;
    }
    const next = cur?.latestRate ?? value.fxRate;
    onValueChange({ currency: code, fxRate: next ?? 1 });
  }

  const fxCurrency = findCurrency(currencies, value.currency);
  const fxIsBase   = fxCurrency?.isBase ?? isBaseCurrency(value.currency);
  const baseCur    = currencies.find((c) => c.isBase);

  const options = currencies.length > 0
    ? currencies.map((c) => {
        const sym = (c.symbol ?? "").trim() || c.code;
        return {
          value: c.code,
          label: `${sym} · ${c.name}${c.isBase ? "  ·  Base" : ""}`,
        };
      })
    : CURRENCY_MOCK_OPTIONS.map((c) => ({ value: c.id, label: c.label }));

  const ratePreviewText = fxIsBase
    ? "Moneda base"
    : fxCurrency?.latestRate != null
      ? `Última cotización del sistema: ${Number(fxCurrency.latestRate).toFixed(2)}${fxCurrency.latestAt ? ` · ${fmtDate(fxCurrency.latestAt)}` : ""}`
      : "Sin cotización vigente — cargá una a mano para esta factura.";

  const fxSymbol = (fxCurrency?.symbol ?? "").trim() || fxCurrency?.code || "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Actualizar cotización"
      maxWidth="sm"
      onEnter={onApply}
      footer={
        <div className="flex justify-end gap-2">
          <TPButton variant="secondary" onClick={onClose} iconLeft={<X size={14} />}>
            Cancelar
          </TPButton>
          <TPButton variant="primary" onClick={onApply} iconLeft={<CheckCircle2 size={14} />}>
            Aplicar
          </TPButton>
        </div>
      }
    >
      <div className="space-y-3">
        <TPField label="Moneda" required>
          <TPSelect
            value={value.currency || baseCur?.code || ""}
            onChange={handleCurrencyChange}
            options={options}
          />
          {fxIsBase && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-border bg-surface2/40 px-2 py-0.5 text-[10px] text-muted">
              Moneda base del tenant
            </div>
          )}
        </TPField>
        <TPField
          label="Cotización a moneda base"
          hint={ratePreviewText}
        >
          <TPNumberInput
            value={fxIsBase ? 1 : value.fxRate}
            onChange={(v) => onValueChange((s) => ({ ...s, fxRate: v ?? 1 }))}
            decimals={2}
            disabled={fxIsBase}
            // FASE 9 — C1: TPNumberInput admite el literal `0`. La validación
            // dura ("> 0") vive en el caller (`applyFx`) y bloquea el apply
            // con un toast. Acá dejamos `min` ligeramente positivo para que
            // el spinner no llegue a cero por click.
            min={0.01}
          />
        </TPField>
        {!fxIsBase && (!Number.isFinite(value.fxRate) || value.fxRate <= 0) && (
          <div className="-mt-2 flex items-start gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>La cotización debe ser mayor a cero.</span>
          </div>
        )}
        {/* Preview del valor formateado */}
        <div className="rounded-md border border-border/60 bg-surface2/30 px-3 py-2 text-[11px]">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Vista previa
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-text">
            {fxSymbol} {(fxIsBase ? 1 : value.fxRate).toFixed(2)}
          </div>
        </div>
        {!fxIsBase && fxCurrency && fxCurrency.latestRate == null && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-500">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Esta moneda no tiene una cotización cargada en Divisas. Lo que
              ingreses acá vale solo para esta factura.
            </span>
          </div>
        )}
        {!fxIsBase && (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px] hover:bg-amber-500/10">
            <TPCheckbox
              checked={updateSystem}
              onChange={onUpdateSystemChange}
            />
            <span className="text-text">
              <span className="font-semibold">
                Actualizar también en monedas y aplicar al sistema
              </span>
              <span className="mt-0.5 block text-muted">
                Impacta a futuros documentos. Los comprobantes confirmados
                no se modifican.
              </span>
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
}

export default CurrencyFXModal;
