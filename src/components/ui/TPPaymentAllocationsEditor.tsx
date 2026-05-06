// src/components/ui/TPPaymentAllocationsEditor.tsx
// ============================================================================
// TPPaymentAllocationsEditor — grid editable de aplicación a facturas.
//
// Extracción del componente `AllocationsEditor` que hoy está duplicado
// literalmente en ComprasPagosProveedor y VentasCobros. Las dos versiones son
// idénticas salvo por el tipo local (PaymentAllocation vs ReceiptAllocation)
// y el placeholder del número de factura ("FP-0001" vs "FV-0001"). Ambos se
// unifican acá: tipo canónico `PaymentAllocation` y placeholder parametrizable.
//
// Alcance intencional:
//   · Renderiza SOLO el grid (encabezados + filas + aviso inline "Excede
//     pendiente").
//   · El empty state y los botones "Aplicar remanente" / "Agregar factura"
//     quedan en la `TPCard` del parent — moverlos adentro cambiaría la UI y
//     la consigna de Fase C es "UI idéntica".
// ============================================================================

import React from "react";
import { Trash2 } from "lucide-react";

import { TPIconButton } from "./TPIconButton";
import TPInput from "./TPInput";
import TPNumberInput from "./TPNumberInput";

import { type PaymentAllocation } from "../../lib/document-types";
import { fmtMoney } from "../../lib/document-helpers";

const ALLOCATIONS_GRID =
  "grid grid-cols-[1fr_130px_130px_130px_32px] gap-2 items-center";

export type TPPaymentAllocationsEditorProps = {
  allocations: PaymentAllocation[];
  /** Moneda del documento padre — se usa para formatear el aviso "Excede pendiente". */
  currency: string;
  /** Actualiza una aplicación por id. */
  updateAllocation: (id: string, patch: Partial<PaymentAllocation>) => void;
  /** Elimina una aplicación por id. */
  removeAllocation: (id: string) => void;
  /**
   * Placeholder del campo "Nº factura" — diferencia entre pantallas:
   *   · Pagos a proveedor → "FP-0001"
   *   · Cobros a cliente  → "FV-0001"
   */
  invoicePlaceholder?: string;
};

export function TPPaymentAllocationsEditor({
  allocations,
  currency,
  updateAllocation,
  removeAllocation,
  invoicePlaceholder = "FP-0001",
}: TPPaymentAllocationsEditorProps) {
  return (
    <div className="space-y-2">
      <div className={`${ALLOCATIONS_GRID} px-1 text-[11px] font-medium uppercase tracking-wide text-muted`}>
        <div>Nº factura</div>
        <div className="text-right">Total</div>
        <div className="text-right">Pendiente</div>
        <div className="text-right">Monto a aplicar</div>
        <div />
      </div>

      {allocations.map((a) => {
        const overMax = a.invoicePending > 0 && a.amountApplied > a.invoicePending;
        return (
          <div key={a.id} className="space-y-1">
            <div className={ALLOCATIONS_GRID}>
              <TPInput
                value={a.invoiceNumber}
                onChange={(v: string) => updateAllocation(a.id, { invoiceNumber: v.toUpperCase() })}
                placeholder={invoicePlaceholder}
              />
              <TPNumberInput
                value={a.invoiceTotal}
                onChange={(v) => updateAllocation(a.id, { invoiceTotal: v ?? 0 })}
                decimals={2}
                min={0}
              />
              <TPNumberInput
                value={a.invoicePending}
                onChange={(v) => updateAllocation(a.id, { invoicePending: v ?? 0 })}
                decimals={2}
                min={0}
              />
              <TPNumberInput
                value={a.amountApplied}
                onChange={(v) => updateAllocation(a.id, { amountApplied: v ?? 0 })}
                decimals={2}
                min={0}
              />
              <TPIconButton
                onClick={() => removeAllocation(a.id)}
                className="h-8 w-8 hover:text-red-400 hover:border-red-400/40"
                title="Eliminar aplicación"
              >
                <Trash2 size={14} />
              </TPIconButton>
            </div>
            {overMax && (
              <div className="pl-1 text-[10px] text-red-400">
                ⚠ Excede el pendiente ({fmtMoney(a.invoicePending, currency)})
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default TPPaymentAllocationsEditor;
