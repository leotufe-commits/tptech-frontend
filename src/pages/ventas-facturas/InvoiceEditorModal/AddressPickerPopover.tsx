// src/pages/ventas-facturas/InvoiceEditorModal/AddressPickerPopover.tsx
// ============================================================================
// Popover con la lista de direcciones del cliente del comprobante.
//
// Extraído de VentasFacturas.tsx durante FASE 8.2.3. Componente PURO de
// presentación — recibe las direcciones y los callbacks como props, no
// conoce nada del draft ni del cliente actual.
// ============================================================================

import React from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "../../../components/ui/tp";
import { TPPopover } from "../../../components/ui/TPPopover";
import { ADDRESS_TYPE_LABELS } from "../../../services/commercial-entities";

/** Dirección del cliente — shape mínimo necesario para el render. Tomado
 *  de `EntityDetail.addresses[]` pero declarado acá para no acoplarnos
 *  al type completo (que tiene 20+ campos no usados acá). */
export type AddressOption = {
  id:        string;
  type:      string;
  label?:    string | null;
  attn?:     string | null;
  isDefault?: boolean;
  // Address line fields (passthrough a composeAddressLine via prop):
  street?:     string;
  streetNumber?: string;
  city?:       string;
  province?:   string;
  country?:    string;
  postalCode?: string;
};

export type AddressPickerPopoverProps = {
  open:           boolean;
  onClose:        () => void;
  anchorRef:      React.RefObject<HTMLElement | null>;
  addresses:      AddressOption[];
  selectedAddressId?: string | null;
  /** Compositor de línea legible — inyectado para no duplicar el helper. */
  composeAddressLine: (addr: AddressOption) => string;
  /** Callback al seleccionar una dirección. */
  onSelectAddress: (addressId: string) => void;
  /** Callback al click en "Agregar dirección". */
  onAddAddress:    () => void;
  /** Ancho del popover. Default 360. */
  width?: number;
};

export function AddressPickerPopover(props: AddressPickerPopoverProps): React.ReactElement {
  const {
    open, onClose, anchorRef,
    addresses, selectedAddressId, composeAddressLine,
    onSelectAddress, onAddAddress,
    width = 360,
  } = props;

  return (
    <TPPopover open={open} onClose={onClose} anchorRef={anchorRef} width={width}>
      <div className="py-1.5">
        <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Direcciones del cliente
        </div>
        {addresses.map((a) => {
          const line = composeAddressLine(a);
          const isSel = selectedAddressId === a.id;
          const typeLabel = (ADDRESS_TYPE_LABELS as Record<string, string>)[a.type] ?? a.type;
          const heading = (a.attn || a.label || typeLabel).trim() || typeLabel;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelectAddress(a.id)}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-surface2/60",
                isSel && "bg-primary/10",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-border bg-surface2/60 px-1.5 py-0 text-[9px] uppercase tracking-wide text-muted">
                    {typeLabel}
                  </span>
                  <span className={cn(
                    "text-[11px] font-semibold truncate",
                    isSel ? "text-primary" : "text-text",
                  )}>
                    {heading}
                  </span>
                  {a.isDefault && (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-medium text-emerald-500">
                      Predeterminada
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-muted">{line || "—"}</div>
              </div>
              {isSel && <Check size={12} className="mt-1 text-primary" />}
            </button>
          );
        })}
        {addresses.length === 0 && (
          <div className="px-3 py-3 text-center text-[11px] text-muted">
            Este cliente no tiene direcciones cargadas.
          </div>
        )}
        <div className="mt-1 border-t border-border/40 px-2 py-1">
          <button
            type="button"
            onClick={onAddAddress}
            className="inline-flex w-full items-center justify-start gap-1 rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
          >
            <Plus size={12} /> Agregar dirección
          </button>
        </div>
      </div>
    </TPPopover>
  );
}

export default AddressPickerPopover;
