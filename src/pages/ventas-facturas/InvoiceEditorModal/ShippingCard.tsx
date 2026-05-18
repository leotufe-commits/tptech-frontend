// src/pages/ventas-facturas/InvoiceEditorModal/ShippingCard.tsx
// ============================================================================
// Card "Envío" del aside derecho del modal de Factura.
//
// Extraído de VentasFacturas.tsx durante FASE 8.2. Componente PURO de
// presentación + edición — no contiene lógica comercial; toda mutación se
// canaliza por `onPatch`.
// ============================================================================

import React from "react";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import TPSelect from "../../../components/ui/TPSelect";
import { SHIPPING_METHOD_MOCK_OPTIONS, type DocumentShipping } from "../../../lib/document-types";

export type ShippingCardProps = {
  value:    DocumentShipping | null | undefined;
  onPatch:  (patch: Partial<DocumentShipping>) => void;
  open:     boolean;
  onOpenChange: (open: boolean) => void;
  /** Formatter de moneda — inyectado del padre. */
  fmtCurrency: (amount: number) => string;
};

export function ShippingCard(props: ShippingCardProps): React.ReactElement {
  const { value, onPatch, open, onOpenChange, fmtCurrency } = props;

  return (
    <TPCard
      title="Envío"
      bodyClassName="!p-3"
      headerClassName="!py-2"
      collapsible
      open={open}
      onOpenChange={onOpenChange}
      right={
        (() => {
          const methodId = value?.methodId ?? "";
          const cost     = value?.cost ?? 0;
          const methodLabel = SHIPPING_METHOD_MOCK_OPTIONS.find((m) => m.id === methodId)?.label;
          if (!methodLabel && cost <= 0) {
            return <span className="text-[11px] text-muted">Sin envío</span>;
          }
          return (
            <span className="text-[11px] text-muted">
              {methodLabel ?? "Envío"}
              {cost > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold tabular-nums text-text">
                    {fmtCurrency(cost)}
                  </span>
                </>
              )}
            </span>
          );
        })()
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <TPField label="Método">
          <TPSelect
            value={value?.methodId ?? ""}
            onChange={(v) => onPatch({ methodId: v || undefined })}
            options={SHIPPING_METHOD_MOCK_OPTIONS.map((m) => ({ value: m.id, label: m.label }))}
          />
        </TPField>
        <TPField label="Costo">
          <TPNumberInput
            value={value?.cost ?? 0}
            onChange={(v) => onPatch({ cost: v ?? 0 })}
            formatType="MONEY"
            decimals={2}
            min={0}
          />
        </TPField>
      </div>
    </TPCard>
  );
}

export default ShippingCard;
