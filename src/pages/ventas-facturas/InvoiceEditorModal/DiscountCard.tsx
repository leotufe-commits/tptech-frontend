// src/pages/ventas-facturas/InvoiceEditorModal/DiscountCard.tsx
// ============================================================================
// Card "Descuento global" del aside derecho del modal de Factura.
//
// Extraído de VentasFacturas.tsx durante FASE 8.2. Componente PURO de
// presentación + edición — no contiene lógica comercial; toda mutación se
// canaliza por `onPatch`.
// ============================================================================

import React from "react";
import { formatByType } from "../../../lib/pricing/format";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import { TPButton } from "../../../components/ui/TPButton";
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

  // Opción A — bonificación heredada del cliente (`origin==="CLIENT"`):
  // el `pricing-engine` ya la aplica por `clientId`. NO se edita directo
  // (evita stacking accidental: 10% cliente + 5% manual = 15%). El operador
  // debe REEMPLAZARLA explícitamente: eso la pasa a MANUAL desde 0.
  const isClientInherited = value?.origin === "CLIENT";

  function handleReplaceClientDiscount() {
    // `patchDiscountGlobal` (padre) fuerza `origin:"MANUAL"`. Reiniciamos en
    // 0 para que el operador ingrese el descuento manual del comprobante
    // (la bonificación del cliente la sigue aplicando el motor por clientId).
    onPatch({ value: 0, reason: "" });
  }

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
              {isPct ? `${formatByType(v, "PERCENT", { bare: true })}%` : fmtCurrency(v)}
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
            disabled={isClientInherited}
          />
        </TPField>
        <TPField label="Valor">
          <TPNumberInput
            value={value?.value ?? 0}
            onChange={(v) => onPatch({ value: v ?? 0 })}
            formatType={(value?.type ?? "PERCENT") === "PERCENT" ? "PERCENT" : "MONEY"}
            decimals={2}
            min={0}
            max={value?.type === "PERCENT" ? 100 : undefined}
            disabled={isClientInherited}
          />
        </TPField>
        <TPField label="Motivo" className="col-span-2">
          <TPInput
            value={value?.reason ?? ""}
            onChange={(v: string) => onPatch({ reason: v })}
            placeholder="Fidelidad, promo, etc."
            disabled={isClientInherited}
          />
        </TPField>
      </div>

      {isClientInherited && (
        <div className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-surface2/30 p-2">
          <div className="flex items-start gap-1.5 text-[11px] font-medium text-muted">
            <span className="shrink-0 rounded-full border border-border bg-card px-1.5 py-0.5 text-[10px]">
              Heredado del cliente
            </span>
            <span>
              La bonificación del cliente ya se aplica automáticamente. Este
              descuento se sumará como ajuste manual del comprobante.
            </span>
          </div>
          <TPButton
            variant="secondary"
            className="h-8 self-start text-xs"
            onClick={handleReplaceClientDiscount}
          >
            Agregar descuento manual adicional
          </TPButton>
        </div>
      )}
    </TPCard>
  );
}

export default DiscountCard;
