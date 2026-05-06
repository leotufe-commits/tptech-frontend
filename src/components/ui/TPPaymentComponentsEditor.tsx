// src/components/ui/TPPaymentComponentsEditor.tsx
// ============================================================================
// TPPaymentComponentsEditor — grid editable de medios de pago/cobro.
//
// Extracción del componente `ComponentsEditor` que hoy está duplicado literalmente
// en ComprasPagosProveedor y VentasCobros. Las dos versiones son idénticas salvo
// por el nombre del tipo (PaymentComponent vs ReceiptComponent), que ahora se
// unifica en `PaymentComponent` de `src/lib/document-types.ts`.
//
// Alcance intencional:
//   · El componente renderiza SOLO el grid (encabezados + filas).
//   · El empty state, la banda de "monedas mixtas" y el botón "Agregar medio"
//     quedan en la `TPCard` del parent — moverlos adentro cambiaría la UI y la
//     consigna de Fase C es "UI idéntica".
//   · La lista de opciones del select se arma desde `PAYMENT_COMPONENT_LABEL`
//     del módulo canónico. Los labels coinciden con los que tenían las dos
//     pantallas originalmente.
// ============================================================================

import React from "react";
import { Trash2 } from "lucide-react";

import { TPIconButton } from "./TPIconButton";
import TPInput from "./TPInput";
import TPNumberInput from "./TPNumberInput";
import TPSelect from "./TPSelect";

import {
  type PaymentComponent,
  type PaymentComponentType,
  PAYMENT_COMPONENT_LABEL,
} from "../../lib/document-types";

const COMPONENT_TYPE_OPTIONS = (Object.keys(PAYMENT_COMPONENT_LABEL) as PaymentComponentType[]).map(
  (t) => ({ value: t, label: PAYMENT_COMPONENT_LABEL[t] }),
);

const COMPONENTS_GRID =
  "grid grid-cols-[160px_110px_100px_1fr_32px] gap-2 items-center";

export type TPPaymentComponentsEditorProps = {
  components: PaymentComponent[];
  /** Actualiza un componente por id. */
  updateComponent: (id: string, patch: Partial<PaymentComponent>) => void;
  /** Elimina un componente por id. */
  removeComponent: (id: string) => void;
  /**
   * Moneda sugerida cuando el tipo no impone moneda propia (CASH, TRANSFER,
   * CARD, OTHER). Si el componente ya tiene moneda se respeta la existente.
   */
  currencyDefault?: string;
};

export function TPPaymentComponentsEditor({
  components,
  updateComponent,
  removeComponent,
  currencyDefault,
}: TPPaymentComponentsEditorProps) {
  return (
    <div className="space-y-2">
      <div className={`${COMPONENTS_GRID} px-1 text-[11px] font-medium uppercase tracking-wide text-muted`}>
        <div>Tipo</div>
        <div className="text-right">Monto</div>
        <div>Moneda</div>
        <div>Referencia</div>
        <div />
      </div>

      {components.map((c) => (
        <div key={c.id} className={COMPONENTS_GRID}>
          <TPSelect
            value={c.type}
            onChange={(v) => {
              const next = v as PaymentComponentType;
              const suggestedCurrency =
                next === "USD"   ? "USD"
                : next === "ARS" ? "ARS"
                : next === "METAL" ? "g"
                : (c.currency || currencyDefault || "");
              updateComponent(c.id, { type: next, currency: suggestedCurrency });
            }}
            options={COMPONENT_TYPE_OPTIONS}
          />
          <TPNumberInput
            value={c.amount}
            onChange={(v) => updateComponent(c.id, { amount: v ?? 0 })}
            decimals={c.type === "METAL" ? 3 : 2}
            min={0}
          />
          <TPInput
            value={c.currency}
            onChange={(v: string) => updateComponent(c.id, { currency: v.toUpperCase() })}
            placeholder="ARS"
          />
          <TPInput
            value={c.reference}
            onChange={(v: string) => updateComponent(c.id, { reference: v })}
            placeholder={
              c.type === "TRANSFER" ? "Nº de transferencia / banco"
              : c.type === "CARD"   ? "Últ. 4 dígitos / autorización"
              : "Referencia (opc.)"
            }
          />
          <TPIconButton
            onClick={() => removeComponent(c.id)}
            className="h-8 w-8 hover:text-red-400 hover:border-red-400/40"
            title="Eliminar medio"
          >
            <Trash2 size={14} />
          </TPIconButton>
        </div>
      ))}
    </div>
  );
}

export default TPPaymentComponentsEditor;
