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
import { vt } from "../../../lib/pricing/visualTokens";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import { TPButton } from "../../../components/ui/TPButton";
import TPInput from "../../../components/ui/TPInput";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import type { DocumentDiscountGlobal } from "../../../lib/document-types";

export type DiscountCardProps = {
  value:    DocumentDiscountGlobal | null | undefined;
  onPatch:  (patch: Partial<DocumentDiscountGlobal>) => void;
  open:     boolean;
  onOpenChange: (open: boolean) => void;
  /** Formatter de moneda — se inyecta desde el padre para respetar tasa de
   *  display y símbolo de moneda actuales del documento. */
  fmtCurrency: (amount: number) => string;
  /** Tipo marcado como favorito por el usuario (UserPreference). El combo
   *  Tipo pinta una estrella en esa opción. `null` = sin favorito. */
  favoriteType?: "PERCENT" | "AMOUNT" | null;
  /** Handler para fijar el tipo favorito. Cuando se provee, el combo
   *  muestra la acción de estrella en cada opción; cuando no, el combo
   *  funciona normal (sin favorito). El padre persiste vía
   *  `userPreferencesApi.update({ defaultGlobalDiscountType: value })`. */
  onSetFavoriteType?: (type: "PERCENT" | "AMOUNT") => void;
};

export function DiscountCard(props: DiscountCardProps): React.ReactElement {
  const { value, onPatch, open, onOpenChange, fmtCurrency, favoriteType, onSetFavoriteType } = props;

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
      // UX.7 — paddings más bajos para que el card se sienta "de
      // configuración" (menos altura, menos protagonismo) y NO compita
      // visualmente con el Total del comprobante de abajo.
      bodyClassName="!p-2.5"
      headerClassName="!py-1.5"
      collapsible
      open={open}
      onOpenChange={onOpenChange}
      right={
        (() => {
          // El shape actual de `DocumentDiscountGlobal` modela solo descuentos
          // (no recargos a nivel documento). Por eso siempre prefijo con `−`.
          // Si en el futuro se agrega `kind` (BONUS/SURCHARGE) al shape, el
          // signo debe pasar a derivarse del kind (`vt.colors.surcharge` para `+`).
          const v = value?.value ?? 0;
          if (!v) {
            return (
              <span
                data-tp-discount-impact="none"
                className="text-[11px] text-muted"
              >
                Sin descuento
              </span>
            );
          }
          const isPct = (value?.type ?? "PERCENT") === "PERCENT";
          const formatted = isPct
            ? `${formatByType(v, "PERCENT", { bare: true })}%`
            : fmtCurrency(v);
          return (
            <span
              data-tp-discount-impact="discount"
              className={`text-[11px] font-semibold tabular-nums ${vt.colors.discount}`}
            >
              {"−"}{formatted}
            </span>
          );
        })()
      }
    >
      {/* Layout en UNA fila — proporciones (Motivo 5 / Tipo 3 / Valor 4):
          el Valor numérico recibe la columna más ancha porque su contenido
          es tabular y necesita aire para que el stepper + la X + los dígitos
          no se aplasten. El Motivo cede 1 col al Valor (sigue cómodo para
          un placeholder corto tipo "Fidelidad, promo"). En mobile todo
          apila (col-span-12). Lógica intacta — solo grid. */}
      <div className="grid grid-cols-12 gap-2">
        <TPField label="Motivo" className="col-span-12 sm:col-span-5">
          <TPInput
            value={value?.reason ?? ""}
            onChange={(v: string) => onPatch({ reason: v })}
            placeholder="Fidelidad, promo, etc."
            disabled={isClientInherited}
          />
        </TPField>
        <TPField label="Tipo" className="col-span-6 sm:col-span-3">
          {/* TPComboFixed soporta `onSetFavorite` + `favoriteValue` para
              mostrar estrella en cada opción (mismo patrón que vendedores,
              listas, canales). Persiste la preferencia vía UserPreference. */}
          <TPComboFixed
            value={value?.type ?? "PERCENT"}
            onChange={(v) => onPatch({ type: (v as "PERCENT" | "AMOUNT") })}
            disabled={isClientInherited}
            options={[
              { value: "PERCENT", label: "Porcentaje (%)" },
              { value: "AMOUNT",  label: "Monto fijo ($)" },
            ]}
            favoriteValue={favoriteType ?? null}
            onSetFavorite={onSetFavoriteType
              ? (v) => onSetFavoriteType(v as "PERCENT" | "AMOUNT")
              : undefined
            }
          />
        </TPField>
        <TPField label="Valor" className="col-span-6 sm:col-span-4">
          {/* Ajustes locales del TPNumberInput (no se cambia el componente
              global): `wrapClassName` garantiza un ancho mínimo cómodo en
              breakpoints intermedios; `className` sube un punto el texto
              numérico para mejor legibilidad del valor. */}
          <TPNumberInput
            value={value?.value ?? 0}
            onChange={(v) => onPatch({ value: v ?? 0 })}
            formatType={(value?.type ?? "PERCENT") === "PERCENT" ? "PERCENT" : "MONEY"}
            decimals={2}
            min={0}
            max={value?.type === "PERCENT" ? 100 : undefined}
            disabled={isClientInherited}
            // R5 (UX) — spinner cleanup: el aside comercial no usa flechas
            // (operador trabaja por teclado). ArrowUp/ArrowDown siguen
            // funcionando en el input.
            showArrows={false}
            // `min-w-0 w-full`: el input se acomoda al ancho de la
            // celda grid (col-span-X) sin imponer un piso de 144 px
            // que provocaba overflow del card en aside angostos.
            wrapClassName="min-w-0 w-full"
            className="text-[15px] font-medium tabular-nums"
            // X interna — limpia el valor a 0 (NO toca `type` ni `reason`).
            // Coherente con la UX de las celdas de línea (Bonificación,
            // Impuestos). Solo aparece cuando hay valor > 0 y el campo está
            // editable (no heredado del cliente).
            onClear={
              !isClientInherited && (value?.value ?? 0) > 0
                ? () => onPatch({ value: 0 })
                : undefined
            }
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
