// src/pages/ventas-facturas/InvoiceEditorModal/DiscountCard.tsx
// ============================================================================
// Card "Descuento global" del aside derecho del modal de Factura.
//
// Extraído de VentasFacturas.tsx durante FASE 8.2. Componente PURO de
// presentación + edición — no contiene lógica comercial; toda mutación se
// canaliza por `onPatch`.
// ============================================================================

import React from "react";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPInput from "../../../components/ui/TPInput";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import TPSelect from "../../../components/ui/TPSelect";
import type { DocumentDiscountGlobal } from "../../../lib/document-types";

export type DiscountCardProps = {
  value:    DocumentDiscountGlobal | null | undefined;
  onPatch:  (patch: Partial<DocumentDiscountGlobal>) => void;
  open:     boolean;
  onOpenChange: (open: boolean) => void;
  /** Formatter de moneda — se inyecta desde el padre para respetar tasa de
   *  display y símbolo de moneda actuales del documento. */
  fmtCurrency: (amount: number) => string;
};

export function DiscountCard(props: DiscountCardProps): React.ReactElement {
  const { value, onPatch, open, onOpenChange, fmtCurrency } = props;

  return (
    <TPCard
      title="Descuento global"
      bodyClassName="!p-3"
      headerClassName="!py-2"
      collapsible
      open={open}
      onOpenChange={onOpenChange}
      right={
        (() => {
          const v = value?.value ?? 0;
          if (!v) return <span className="text-[11px] text-muted">Sin descuento</span>;
          const isPct = (value?.type ?? "PERCENT") === "PERCENT";
          return (
            <span className="text-[11px] font-semibold tabular-nums text-amber-500">
              {isPct ? `${v}%` : fmtCurrency(v)}
            </span>
          );
        })()
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <TPField label="Tipo">
          <TPSelect
            value={value?.type ?? "PERCENT"}
            onChange={(v) => onPatch({ type: (v as "PERCENT" | "AMOUNT") })}
            options={[
              { value: "PERCENT", label: "%" },
              { value: "AMOUNT",  label: "$" },
            ]}
          />
        </TPField>
        <TPField label="Valor">
          <TPNumberInput
            value={value?.value ?? 0}
            onChange={(v) => onPatch({ value: v ?? 0 })}
            decimals={2}
            min={0}
            max={value?.type === "PERCENT" ? 100 : undefined}
          />
        </TPField>
        <TPField label="Motivo" className="col-span-2">
          <TPInput
            value={value?.reason ?? ""}
            onChange={(v: string) => onPatch({ reason: v })}
            placeholder="Fidelidad, promo, etc."
          />
        </TPField>
      </div>
    </TPCard>
  );
}

export default DiscountCard;
