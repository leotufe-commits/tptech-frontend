// src/components/ui/TPEntitySearchSelect.tsx
// ============================================================================
// TPEntitySearchSelect — selector de cliente / proveedor para comprobantes.
//
// Wrapper tipado sobre `TPSearchSelect` (primitivo genérico). Centraliza el
// estilo de fila para entidades comerciales: avatar/icono, nombre, sublabels
// (email · teléfono), badge mayorista/minorista, saldo de cuenta corriente.
// También expone los atajos "+ Crear nuevo" / "Ver ficha" como footer del
// dropdown.
//
// Mock data interno (Fase 7 inyecta `options` con datos reales).
//
// API externa pública:
//   · value     — selección parcial (id + name) para que el parent no necesite
//                 conocer el tipo completo.
//   · onChange  — recibe la entidad completa al seleccionar (o `null` al
//                 limpiar).
//   · type      — "client" | "supplier" (default "client") — controla mocks
//                 y placeholder.
//   · options   — override del mock interno.
//   · onCreateNew / onViewDetail — botones opcionales del footer.
// ============================================================================

import React from "react";
import { Plus, User, MapPin } from "lucide-react";

import { cn } from "./tp";
import { fmtMoney } from "../../lib/document-helpers";
import { TPSearchSelect } from "./TPSearchSelect";

export type TPEntityLite = {
  id: string;
  name: string;
  type?: "client" | "supplier";
  category?: "mayorista" | "minorista";
  email?: string;
  phone?: string;
  /** Saldo en cuenta corriente (positivo = nos debe, negativo = a favor). */
  balance?: number;
  currency?: string;
  /** Dirección principal del cliente/proveedor (mock; Fase 7 trae direcciones reales). */
  address?: string;
  // ── Datos personales / fiscales (display) ───────────────────────────────
  entityType?: "PERSON" | "COMPANY";
  firstName?: string;
  lastName?: string;
  companyName?: string;
  tradeName?: string;
  documentType?: string;
  documentNumber?: string;
  // ── Datos comerciales (autocompletan al seleccionar el cliente). ────────
  /** Lista de precios por defecto del cliente (id de PRICE_LIST_MOCK_OPTIONS). */
  priceListId?: string;
  /** Término de pago habitual (id de PAYMENT_TERM_MOCK_OPTIONS). */
  paymentTerm?: string;
  /** Condición fiscal (texto libre — usado por commercial-engine para % IVA). */
  ivaCondition?: string;
  /** Vendedor asignado (value de SELLER_MOCK_OPTIONS). */
  sellerId?: string;
};

const MOCK_CLIENTS: TPEntityLite[] = [
  { id: "c1", name: "Joyería Luz",            type: "client", category: "mayorista", email: "admin@joyerialuz.com", phone: "+54 11 5555-0101", balance:  120_000, currency: "ARS", address: "Libertad 326, CABA",
    priceListId: "wholesale", paymentTerm: "30d", ivaCondition: "Responsable inscripto", sellerId: "v1" },
  { id: "c2", name: "Boutique Ámbar",         type: "client", category: "minorista", email: "ventas@ambar.ar",      phone: "+54 11 4444-0202", balance:   -5_000, currency: "ARS", address: "Av. Santa Fe 1450, CABA",
    priceListId: "retail",    paymentTerm: "15d", ivaCondition: "Responsable inscripto", sellerId: "v2" },
  { id: "c3", name: "Oro & Plata Palermo",    type: "client", category: "mayorista", email: "compras@oroyplata.ar", phone: "+54 11 3333-0303", balance:        0, currency: "ARS", address: "Honduras 5450, CABA",
    priceListId: "wholesale", paymentTerm: "current", ivaCondition: "Responsable inscripto", sellerId: "v1" },
  { id: "c4", name: "Cliente Minorista Demo", type: "client", category: "minorista", email: "",                      phone: "",                  balance:        0, currency: "ARS",
    priceListId: "retail",    paymentTerm: "cash", ivaCondition: "Consumidor final",     sellerId: "v3" },
];

const MOCK_SUPPLIERS: TPEntityLite[] = [
  { id: "s1", name: "Refinería del Plata",    type: "supplier", category: "mayorista", email: "ventas@refineria.ar",  phone: "+54 11 2222-0404", balance: -230_000, currency: "ARS", address: "Av. del Libertador 5000, CABA" },
  { id: "s2", name: "Piedras Preciosas SA",   type: "supplier", category: "mayorista", email: "info@piedras.ar",      phone: "+54 11 1111-0505", balance:        0, currency: "USD", address: "Diagonal Norte 850, CABA" },
  { id: "s3", name: "Cadenería Milano",       type: "supplier", category: "minorista", email: "cadeneria@milano.ar",  phone: "+54 11 9999-0606", balance:  -15_000, currency: "ARS" },
];

export type TPEntitySelection = Pick<TPEntityLite, "id" | "name">;

export type TPEntitySearchSelectProps = {
  value?: TPEntitySelection | null;
  onChange: (entity: TPEntityLite | null) => void;
  type?: "client" | "supplier";
  placeholder?: string;
  /** Override del mock interno — Fase 7 inyecta la lista real. */
  options?: TPEntityLite[];
  /** Callback al presionar "+ Crear nuevo". Si se omite no se muestra el botón. */
  onCreateNew?: () => void;
  /**
   * @deprecated Se mantiene por compatibilidad. La acción "Ver ficha" fue
   *  eliminada del meta. Para mostrar acciones contextuales en la zona
   *  superior derecha, usar `selectedTopRightSlot`.
   */
  onViewDetail?: (entity: TPEntityLite) => void;
  /**
   * Slot personalizado para reemplazar la fila superior derecha del meta del
   * seleccionado (donde antes vivía "Ver ficha"). Si se pasa, se renderea
   * tal cual y se oculta cualquier acción default.
   */
  selectedTopRightSlot?: React.ReactNode;
  /**
   * Si se provee, las líneas de "Cambiar / Agregar dirección" del meta dejan
   * de renderearse — el parent las maneja externamente. Útil cuando ya hay
   * una UI dedicada de address picker fuera del combo.
   */
  hideAddressLine?: boolean;
  disabled?: boolean;
  className?: string;
};

export function TPEntitySearchSelect({
  value,
  onChange,
  type = "client",
  placeholder,
  options,
  onCreateNew,
  selectedTopRightSlot,
  hideAddressLine = false,
  disabled = false,
  className,
}: TPEntitySearchSelectProps) {
  const data = options ?? (type === "client" ? MOCK_CLIENTS : MOCK_SUPPLIERS);
  const defaultPlaceholder = type === "client" ? "Buscar cliente…" : "Buscar proveedor…";

  // El parent guarda solo id+name; resolvemos el objeto completo del catálogo
  // para que el primitivo TPSearchSelect renderice metadatos adicionales.
  // Si el lookup por id falla (ej. el parent guarda el name como id), probamos
  // por name; y si tampoco aparece, sintetizamos un entity con value mismo
  // para que el input siga mostrando el nombre seleccionado en lugar de vacío.
  const fullValue: TPEntityLite | null = value
    ? (data.find((d) => d.id === value.id)
       ?? data.find((d) => d.name === value.name)
       ?? { id: value.id, name: value.name })
    : null;

  return (
    <TPSearchSelect<TPEntityLite>
      className={className}
      value={fullValue}
      onChange={(e) => onChange(e)}
      options={data}
      disabled={disabled}
      placeholder={placeholder ?? defaultPlaceholder}
      getOptionLabel={(o) => o.name}
      getOptionValue={(o) => o.id}
      getOptionSearchableText={(o) => `${o.name} ${o.email ?? ""} ${o.phone ?? ""}`}
      renderOption={(o, { highlighted }) => (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm",
          highlighted ? "text-text" : "text-text/80"
        )}>
          <User size={13} className="shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{o.name}</div>
            <div className="truncate text-[11px] text-muted">
              {[o.email, o.phone].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
          {o.category && (
            <span className="shrink-0 rounded-full border border-border bg-surface2/60 px-1.5 py-0.5 text-[10px] text-muted">
              {o.category === "mayorista" ? "Mayor." : "Minor."}
            </span>
          )}
          {typeof o.balance === "number" && o.balance !== 0 && (
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                o.balance > 0 ? "text-amber-500" : "text-emerald-500"
              )}
            >
              {fmtMoney(Math.abs(o.balance), o.currency)}
            </span>
          )}
        </div>
      )}
      renderSelectedMeta={(o) => (
        <div className="space-y-1">
          {/* Línea 1: badges + saldo + slot derecho (acción de dirección, etc.) */}
          <div className="flex items-center gap-2 text-[11px] text-muted">
            {o.category && (
              <span className="inline-flex items-center rounded-full border border-border bg-surface2/60 px-2 py-0.5 font-medium">
                {o.category === "mayorista" ? "Mayorista" : "Minorista"}
              </span>
            )}
            {typeof o.balance === "number" && (
              <span
                className={cn(
                  "tabular-nums",
                  o.balance > 0 ? "text-amber-500" :
                  o.balance < 0 ? "text-emerald-500" : "text-muted"
                )}
              >
                Saldo: {fmtMoney(Math.abs(o.balance), o.currency)}
                {o.balance > 0 ? " (a cobrar)" : o.balance < 0 ? " (a favor)" : ""}
              </span>
            )}
            {selectedTopRightSlot && (
              <div className="ml-auto inline-flex items-center gap-1">
                {selectedTopRightSlot}
              </div>
            )}
          </div>

          {/* Línea 2: Dirección compacta — el parent puede ocultarla con `hideAddressLine`. */}
          {!hideAddressLine && (
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <MapPin size={11} className="shrink-0 text-muted" />
              {o.address ? (
                <span className="text-text/80 truncate">{o.address}</span>
              ) : (
                <span className="italic text-muted/70">Sin dirección cargada</span>
              )}
            </div>
          )}
        </div>
      )}
      renderDropdownFooter={
        onCreateNew
          ? () => (
              <div className="flex items-center gap-1 bg-surface2/40 px-2 py-1">
                {onCreateNew && (
                  <button
                    type="button"
                    onMouseDown={(ev) => { ev.preventDefault(); onCreateNew(); }}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                  >
                    <Plus size={12} /> Crear {type === "client" ? "cliente" : "proveedor"}
                  </button>
                )}
              </div>
            )
          : undefined
      }
    />
  );
}

export default TPEntitySearchSelect;
