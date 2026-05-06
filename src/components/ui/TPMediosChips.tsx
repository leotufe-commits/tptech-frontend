// src/components/ui/TPMediosChips.tsx
// ============================================================================
// TPMediosChips — lista compacta de medios de pago/cobro.
//
// Átomo visual para columnas "Medios" en tablas de Cobros y Pagos a
// proveedor. Toma un array de `PaymentComponent` (tipo canónico de
// `document-types.ts`) y lo renderiza como chips pequeños con ícono +
// etiqueta corta.
//
// Reglas:
//   · Deduplica por `type` — si el documento tiene dos aportes en efectivo
//     se muestra un solo chip "Efectivo" (la suma por tipo no interesa acá,
//     es una señal visual).
//   · Si la lista está vacía o es nula → "—".
//   · Si la cantidad de tipos únicos excede `maxVisible` (default 3), los
//     extras se colapsan en un chip "+N".
//
// Iconos elegidos de lucide-react para cada tipo (coinciden con la
// iconografía usada en el resto del sistema):
//   · CASH     → Banknote
//   · TRANSFER → ArrowRightLeft
//   · CARD     → CreditCard
//   · USD      → DollarSign
//   · ARS      → Coins
//   · METAL    → Scale
//   · OTHER    → CircleDashed
//
// El componente es 100% presentacional — no maneja montos ni moneda (esa
// información vive en el detalle expandido o en el modal del documento).
// ============================================================================

import React from "react";
import {
  Banknote,
  ArrowRightLeft,
  CreditCard,
  DollarSign,
  Coins,
  Scale,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";

import { cn } from "./tp";
import {
  type PaymentComponent,
  type PaymentComponentType,
  PAYMENT_COMPONENT_LABEL,
} from "../../lib/document-types";

const TYPE_ICON: Record<PaymentComponentType, LucideIcon> = {
  CASH:     Banknote,
  TRANSFER: ArrowRightLeft,
  CARD:     CreditCard,
  USD:      DollarSign,
  ARS:      Coins,
  METAL:    Scale,
  OTHER:    CircleDashed,
};

/** Labels abreviados para los chips (caben mejor en una celda de tabla). */
const TYPE_SHORT_LABEL: Record<PaymentComponentType, string> = {
  CASH:     "Efectivo",
  TRANSFER: "Transf.",
  CARD:     "Tarjeta",
  USD:      "USD",
  ARS:      "ARS",
  METAL:    "Metal",
  OTHER:    "Otro",
};

export type TPMediosChipsProps = {
  /** Lista de componentes de pago/cobro. Null o vacío → "—". */
  components?: PaymentComponent[] | null;
  /** Cantidad máxima de chips visibles antes de colapsar en "+N". Default 3. */
  maxVisible?: number;
  className?: string;
};

export function TPMediosChips({
  components,
  maxVisible = 3,
  className,
}: TPMediosChipsProps) {
  if (!components || components.length === 0) {
    return <span className={cn("text-muted", className)}>—</span>;
  }

  // Deduplicar preservando orden de aparición.
  const uniqueTypes: PaymentComponentType[] = [];
  const seen = new Set<string>();
  for (const c of components) {
    if (!seen.has(c.type)) {
      seen.add(c.type);
      uniqueTypes.push(c.type);
    }
  }

  const visible = uniqueTypes.slice(0, maxVisible);
  const overflow = uniqueTypes.length - visible.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((t) => {
        const Icon = TYPE_ICON[t];
        return (
          <span
            key={t}
            title={PAYMENT_COMPONENT_LABEL[t]}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface2/80 px-2 py-0.5 text-[11px] font-medium text-text/80"
          >
            <Icon size={11} className="text-muted" />
            {TYPE_SHORT_LABEL[t]}
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          title={`${overflow} medio${overflow === 1 ? "" : "s"} más`}
          className="inline-flex items-center rounded-full border border-border bg-surface2/80 px-2 py-0.5 text-[11px] font-semibold text-muted"
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export default TPMediosChips;
