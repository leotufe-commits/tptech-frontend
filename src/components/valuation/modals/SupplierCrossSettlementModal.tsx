// src/components/valuation/modals/SupplierCrossSettlementModal.tsx
import React, { useState } from "react";

import { Modal } from "../../ui/Modal";
import { TPCard } from "../../ui/TPCard";
import { TPField } from "../../ui/TPField";
import TPInput from "../../ui/TPInput";
import TPNumberInput from "../../ui/TPNumberInput";
import TPSelect from "../../ui/TPSelect";
import { TPButton } from "../../ui/TPButton";
import { toast } from "../../../lib/toast";
import {
  crossSettlementsService,
  type CrossSettlementComponentType,
  type CrossSettlementFromInput,
} from "../../../services/cross-settlements";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  supplierId: string;
  onClose: () => void;
  onSuccess: () => void;
};

type ComponentState = {
  componentType: CrossSettlementComponentType;
  currency: string;
  amount: number | null;
  metalId: string;
  variantId: string;
  gramsOriginal: number | null;
  purity: number | null;
  gramsPure: number | null;
};

const emptyComponent = (): ComponentState => ({
  componentType: "MONEY",
  currency: "",
  amount: null,
  metalId: "",
  variantId: "",
  gramsOriginal: null,
  purity: null,
  gramsPure: null,
});

const COMPONENT_TYPE_OPTIONS = [
  { value: "MONEY", label: "Dinero" },
  { value: "METAL", label: "Metal" },
];

// ---------------------------------------------------------------------------
// Helper — build summary text
// ---------------------------------------------------------------------------

function buildSummary(
  from: ComponentState,
  to: ComponentState,
  fxRate: number | null,
  metalQuotePerGram: number | null,
  quoteCurrency: string
): string | null {
  const combo = `${from.componentType}-${to.componentType}`;

  if (combo === "MONEY-MONEY") {
    if (!from.currency || !from.amount || !to.currency || !to.amount) return null;
    return `Se entregan ${from.amount} ${from.currency} para cancelar ${to.amount} ${to.currency}${fxRate ? ` (tipo de cambio: ${fxRate})` : ""}`;
  }

  if (combo === "MONEY-METAL") {
    if (!from.currency || !from.amount || !to.metalId || !to.gramsPure) return null;
    return `Se entregan ${from.amount} ${from.currency} para cancelar ${to.gramsPure} g de metal ${to.metalId}${metalQuotePerGram ? ` (cotización: ${metalQuotePerGram} ${quoteCurrency}/g)` : ""}`;
  }

  if (combo === "METAL-MONEY") {
    if (!from.metalId || !from.gramsPure || !to.currency || !to.amount) return null;
    return `Se entregan ${from.gramsPure} g de metal ${from.metalId} para cancelar ${to.amount} ${to.currency}${metalQuotePerGram ? ` (cotización: ${metalQuotePerGram} ${quoteCurrency}/g)` : ""}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Sub-component: ComponentForm
// ---------------------------------------------------------------------------

function ComponentForm({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ComponentState;
  onChange: (v: ComponentState) => void;
}) {
  function set(partial: Partial<ComponentState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <TPCard className="p-4 space-y-3 flex-1">
      <div className="text-sm font-semibold text-muted uppercase tracking-wide">{label}</div>

      <TPField label="Tipo">
        <TPSelect
          value={value.componentType}
          onChange={(v) => set({ componentType: v as CrossSettlementComponentType })}
          options={COMPONENT_TYPE_OPTIONS}
        />
      </TPField>

      {value.componentType === "MONEY" && (
        <>
          <TPField label="Moneda">
            <TPInput
              value={value.currency}
              onChange={(v) => set({ currency: v.toUpperCase() })}
              placeholder="ARS / USD / EUR"
              maxLength={10}
            />
          </TPField>
          <TPField label="Importe">
            <TPNumberInput
              value={value.amount}
              onChange={(v) => set({ amount: v })}
              decimals={2}
              min={0}
              placeholder="0.00"
            />
          </TPField>
        </>
      )}

      {value.componentType === "METAL" && (
        <>
          <TPField label="Metal ID">
            <TPInput
              value={value.metalId}
              onChange={(v) => set({ metalId: v })}
              placeholder="Ej: oro, plata..."
            />
          </TPField>
          <TPField label="Variante ID" hint="Opcional">
            <TPInput
              value={value.variantId}
              onChange={(v) => set({ variantId: v })}
              placeholder="ID de variante"
            />
          </TPField>
          <TPField label="Gramos originales">
            <TPNumberInput
              value={value.gramsOriginal}
              onChange={(v) => set({ gramsOriginal: v })}
              decimals={4}
              min={0}
              placeholder="0.0000"
            />
          </TPField>
          <TPField label="Pureza (%)">
            <TPNumberInput
              value={value.purity}
              onChange={(v) => set({ purity: v })}
              decimals={2}
              min={0}
              max={100}
              placeholder="0 – 100"
            />
          </TPField>
          <TPField label="Gramos puros">
            <TPNumberInput
              value={value.gramsPure}
              onChange={(v) => set({ gramsPure: v })}
              decimals={4}
              min={0}
              placeholder="0.0000"
            />
          </TPField>
        </>
      )}
    </TPCard>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function SupplierCrossSettlementModal({ supplierId, onClose, onSuccess }: Props) {
  const [from, setFrom] = useState<ComponentState>(emptyComponent());
  const [to, setTo]     = useState<ComponentState>(emptyComponent());

  const [fxRate, setFxRate]                     = useState<number | null>(null);
  const [metalQuotePerGram, setMetalQuotePerGram] = useState<number | null>(null);
  const [quoteCurrency, setQuoteCurrency]         = useState("");
  const [notes, setNotes]                         = useState("");
  const [busy, setBusy]                           = useState(false);
  const [validationError, setValidationError]     = useState<string | null>(null);

  const combo = `${from.componentType}-${to.componentType}` as const;
  const showFxRate          = combo === "MONEY-MONEY";
  const showMetalConversion = combo === "MONEY-METAL" || combo === "METAL-MONEY";
  const isMetalToMetal      = combo === "METAL-METAL";

  const summary = buildSummary(from, to, fxRate, metalQuotePerGram, quoteCurrency);

  function validate(): string | null {
    if (isMetalToMetal) {
      return "No se permite liquidación cruzada de Metal a Metal.";
    }

    if (from.componentType === "MONEY") {
      if (!from.currency.trim()) return "Indicá la moneda de origen.";
      if (!from.amount || from.amount <= 0) return "El importe de origen debe ser mayor a 0.";
    } else {
      if (!from.metalId.trim()) return "Indicá el metal de origen.";
      if (!from.gramsPure || from.gramsPure <= 0) return "Los gramos puros de origen deben ser mayor a 0.";
    }

    if (to.componentType === "MONEY") {
      if (!to.currency.trim()) return "Indicá la moneda de destino.";
      if (!to.amount || to.amount <= 0) return "El importe de destino debe ser mayor a 0.";
    } else {
      if (!to.metalId.trim()) return "Indicá el metal de destino.";
      if (!to.gramsPure || to.gramsPure <= 0) return "Los gramos puros de destino deben ser mayor a 0.";
    }

    if (combo === "MONEY-MONEY" && from.currency === to.currency) {
      return "Advertencia: las dos monedas son iguales. Una liquidación cruzada en la misma moneda no tiene efecto.";
    }

    return null;
  }

  function buildFromInput(): CrossSettlementFromInput {
    if (from.componentType === "MONEY") {
      return {
        componentType: "MONEY",
        currency: from.currency,
        amount: from.amount ?? undefined,
      };
    }
    return {
      componentType: "METAL",
      metalId: from.metalId,
      variantId: from.variantId || undefined,
      gramsOriginal: from.gramsOriginal ?? undefined,
      purity: from.purity ?? undefined,
      gramsPure: from.gramsPure ?? undefined,
    };
  }

  function buildToInput(): CrossSettlementFromInput {
    if (to.componentType === "MONEY") {
      return {
        componentType: "MONEY",
        currency: to.currency,
        amount: to.amount ?? undefined,
      };
    }
    return {
      componentType: "METAL",
      metalId: to.metalId,
      variantId: to.variantId || undefined,
      gramsOriginal: to.gramsOriginal ?? undefined,
      purity: to.purity ?? undefined,
      gramsPure: to.gramsPure ?? undefined,
    };
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setBusy(true);
    try {
      await crossSettlementsService.create(supplierId, {
        from: buildFromInput(),
        to: buildToInput(),
        conversion: {
          fxRate: fxRate ?? undefined,
          metalQuotePerGram: metalQuotePerGram ?? undefined,
          quoteCurrency: quoteCurrency || undefined,
        },
        notes: notes || undefined,
      });
      toast.success("Liquidación cruzada registrada correctamente.");
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || "Error al registrar la liquidación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Liquidación cruzada" maxWidth="lg">
      <div className="space-y-4">

        {/* Two columns: FROM | TO */}
        <div className="flex flex-col md:flex-row gap-4">
          <ComponentForm label="Origen (lo que se entrega)" value={from} onChange={setFrom} />
          <ComponentForm label="Destino (lo que se cancela)" value={to} onChange={setTo} />
        </div>

        {/* Conversion section */}
        {!isMetalToMetal && (
          <TPCard className="p-4 space-y-3">
            <div className="text-sm font-semibold">Conversión</div>

            {showFxRate && (
              <TPField label="Tipo de cambio">
                <TPNumberInput
                  value={fxRate}
                  onChange={setFxRate}
                  decimals={6}
                  min={0}
                  placeholder="Ej: 1200.00"
                />
              </TPField>
            )}

            {showMetalConversion && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TPField label="Cotización por gramo">
                  <TPNumberInput
                    value={metalQuotePerGram}
                    onChange={setMetalQuotePerGram}
                    decimals={6}
                    min={0}
                    placeholder="Ej: 95.50"
                  />
                </TPField>
                <TPField label="Moneda de cotización">
                  <TPInput
                    value={quoteCurrency}
                    onChange={(v) => setQuoteCurrency(v.toUpperCase())}
                    placeholder="ARS / USD"
                    maxLength={10}
                  />
                </TPField>
              </div>
            )}
          </TPCard>
        )}

        {/* Summary */}
        {summary && (
          <TPCard className="p-3 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-800">{summary}</p>
          </TPCard>
        )}

        {/* Metal-to-metal error */}
        {isMetalToMetal && (
          <TPCard className="p-3 bg-red-50 border-red-200">
            <p className="text-sm text-red-700">No se permite liquidación cruzada de Metal a Metal.</p>
          </TPCard>
        )}

        {/* Notes */}
        <TPField label="Notas" hint="Opcional">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Observaciones sobre esta liquidación..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </TPField>

        {/* Validation error */}
        {validationError && (
          <p className="text-sm text-red-600 font-medium">{validationError}</p>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <TPButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </TPButton>
          <TPButton onClick={handleSubmit} disabled={busy || isMetalToMetal}>
            {busy ? "Registrando…" : "Confirmar liquidación"}
          </TPButton>
        </div>

      </div>
    </Modal>
  );
}
