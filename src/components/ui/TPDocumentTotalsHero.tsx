// src/components/ui/TPDocumentTotalsHero.tsx
// ============================================================================
// TPDocumentTotalsHero — card "TOTAL A FACTURAR" con composición desglosada.
//
// Reemplaza el bloque inline de VentasFacturas y queda listo para reusarse en
// los comprobantes hermanos (Presupuestos, Órdenes, Entregas, Notas de
// crédito).
//
// El componente NO calcula nada: recibe `composition` (mapeada desde el
// pricing-engine vía `composeDocumentPricingDetail`) y la pinta. Cuando un
// concepto vale `null` se muestra en estado tenue como "No aplicado", para
// que el usuario sepa qué piezas del motor están disponibles.
// ============================================================================

import React from "react";
import { Info } from "lucide-react";

import { cn } from "./tp";
import { fmtMoney } from "../../lib/document-helpers";
import type { PricingComposition } from "../../lib/pricing-display-helpers";

export type TPDocumentTotalsHeroViewMode = "unified" | "detailed";

const ROUND_MODE_LABEL: Record<string, string> = {
  INTEGER:   "al entero",
  DECIMAL_1: "al décimo",
  DECIMAL_2: "al centésimo",
  TEN:       "a la decena",
  HUNDRED:   "a la centena",
  NONE:      "",
};
const ROUND_DIRECTION_LABEL: Record<string, string> = {
  UP:      "hacia arriba",
  DOWN:    "hacia abajo",
  NEAREST: "más cercano",
};
const ROUND_APPLY_ON_LABEL: Record<string, string> = {
  PRICE: "sobre precio de lista",
  NET:   "sobre precio neto",
  TOTAL: "sobre total con impuestos",
};

function describeRoundingConfig(info: {
  applyOn: string;
  mode:    string;
  direction: string;
}): string {
  const m = ROUND_MODE_LABEL[info.mode] || "";
  const d = ROUND_DIRECTION_LABEL[info.direction] || "";
  const a = ROUND_APPLY_ON_LABEL[info.applyOn] || "";
  return [a, [m, d].filter(Boolean).join(" ")].filter(Boolean).join(" — ");
}

export type TPDocumentTotalsHeroProps = {
  composition: PricingComposition;
  currency: string;
  /**
   * Factor visual de conversión a la moneda del documento (default 1 = base).
   * Mismo patrón que `PricingSimulator` — se multiplica antes de formatear.
   */
  displayRate?: number;
  viewMode: TPDocumentTotalsHeroViewMode;
  onViewModeChange: (v: TPDocumentTotalsHeroViewMode) => void;
  /** Override del label superior. Default: "Total a facturar". */
  totalLabel?: string;
};

type RowProps = {
  label: string;
  amount: number | null;
  /** Si true, dibuja el monto con signo negativo (descuentos). */
  asNegative?: boolean;
  hint?: string;
  tone?: "default" | "discount" | "surcharge" | "tax" | "muted";
  bold?: boolean;
  subline?: string | null;
};

/** Sub-header de bloque dentro de la composición desglosada (Fase 3A). */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted/60">
      {children}
    </div>
  );
}

function CompositionRow({
  label,
  amount,
  currency,
  displayRate = 1,
  asNegative = false,
  hint,
  tone = "default",
  bold = false,
  subline,
  sublineTitle,
  hideWhenInactive,
}: RowProps & { currency: string; displayRate?: number; sublineTitle?: string; hideWhenInactive?: boolean }) {
  const notApplied = amount == null;
  // Fase 3A: por defecto el Hero oculta los conceptos sin valor para no
  // saturar la composición con "No aplicado". El toggle lo controla el
  // padre — `hideWhenInactive=true` significa "no me muestres si no aplicó".
  if (notApplied && hideWhenInactive) return null;

  const valueText = notApplied
    ? "No aplicado"
    : (asNegative ? "−" : "") + fmtMoney(Math.abs(amount) / displayRate, currency);

  const valueClass = cn(
    "tabular-nums shrink-0",
    bold && "font-bold",
    !bold && "font-semibold",
    notApplied && "italic text-muted/60 font-normal",
    !notApplied && tone === "discount"  && "text-amber-500",
    !notApplied && tone === "surcharge" && "text-amber-500",
    !notApplied && tone === "tax"       && "text-amber-500",
    !notApplied && tone === "default"   && "text-text",
    !notApplied && tone === "muted"     && "text-muted",
  );

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 py-1",
        notApplied && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[11px] text-muted">
          <span className="truncate">{label}</span>
          {hint && (
            <span title={hint} className="inline-flex shrink-0 cursor-help text-muted/70">
              <Info size={10} />
            </span>
          )}
        </div>
        {subline && !notApplied && (
          <div
            className="text-[10px] italic text-muted/80 truncate"
            title={sublineTitle}
          >
            {subline}
          </div>
        )}
      </div>
      <div className={valueClass}>{valueText}</div>
    </div>
  );
}

export function TPDocumentTotalsHero({
  composition: c,
  currency,
  displayRate = 1,
  viewMode,
  onViewModeChange,
  totalLabel = "Total a facturar",
}: TPDocumentTotalsHeroProps) {
  const mFmt = (amount: number) => fmtMoney((amount ?? 0) / displayRate, currency);
  const hasRounding = Math.abs(c.rounding) >= 0.01;
  const hasShipping = (c.shipping ?? 0) > 0;
  const taxesTotalForRow = c.taxTotal > 0 ? c.taxTotal : null;
  const isChannelDiscount = (c.channelAdjustment ?? 0) < 0;

  // Fase 3A — toggle "Ver conceptos no aplicados". Default: ocultos para
  // que la composición sea más liviana y el operador foque en lo que SÍ se
  // aplicó al cálculo.
  const [showInactive, setShowInactive] = React.useState(false);
  const hideInactive = !showInactive;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      {/* Cabecera — total grande + selector de vista */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            {totalLabel}
          </div>
          <div className="mt-0.5 text-2xl font-bold tabular-nums text-primary">
            {mFmt(c.total)}
          </div>
          {!c.fromBackend && (
            <div className="mt-0.5 text-[10px] italic text-muted/70">
              Estimado local — el motor todavía no respondió.
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="inline-flex rounded-md border border-border bg-card p-0.5" role="tablist">
            <button
              type="button"
              data-tp-enter="ignore"
              role="tab"
              aria-selected={viewMode === "unified"}
              onClick={() => onViewModeChange("unified")}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-semibold transition",
                viewMode === "unified"
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:text-text",
              )}
            >
              Unificado
            </button>
            <button
              type="button"
              data-tp-enter="ignore"
              role="tab"
              aria-selected={viewMode === "detailed"}
              onClick={() => onViewModeChange("detailed")}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-semibold transition",
                viewMode === "detailed"
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:text-text",
              )}
            >
              Desglosado
            </button>
          </div>
        </div>
      </div>

      {/* Modo Unificado — resumen.
          Si la política doc del tenant aplicó redondeo (source=TENANT_POLICY)
          mostramos el desglose completo con "Total calculado", "Redondeo
          comprobante" y "TOTAL FINAL" — para que el operador vea exactamente
          cuánto agregó/restó el redondeo del comprobante.
          Si no hay redondeo doc, dejamos el resumen mínimo histórico. */}
      {viewMode === "unified" && (() => {
        const isDocRounding =
          c.roundingInfo?.source === "TENANT_POLICY" && hasRounding;

        if (isDocRounding) {
          // Suma de descuentos del documento (todos los conceptos negativos).
          const discountTotal =
            (c.customerDiscount ?? 0) +
            (c.quantityDiscount ?? 0) +
            (c.promotion ?? 0) +
            (c.coupon ?? 0) +
            (c.globalDiscount ?? 0) +
            // Canal: si es negativo, suma a descuentos.
            ((c.channelAdjustment ?? 0) < 0 ? -(c.channelAdjustment ?? 0) : 0);
          const totalCalculated = c.total - c.rounding;

          return (
            <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-[11px] text-muted">
              {c.subtotalGross != null && (
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-semibold text-text">
                    {mFmt(c.subtotalGross)}
                  </span>
                </div>
              )}
              {discountTotal > 0.005 && (
                <div className="flex justify-between">
                  <span>Descuentos</span>
                  <span className="tabular-nums font-semibold text-amber-500">
                    −{mFmt(discountTotal)}
                  </span>
                </div>
              )}
              {c.taxTotal > 0 && (
                <div className="flex justify-between">
                  <span>Impuestos</span>
                  <span className="tabular-nums font-semibold text-amber-500">
                    {mFmt(c.taxTotal)}
                  </span>
                </div>
              )}
              {hasShipping && (
                <div className="flex justify-between">
                  <span>Envío</span>
                  <span className="tabular-nums font-semibold text-text">
                    {mFmt(c.shipping ?? 0)}
                  </span>
                </div>
              )}
              {c.paymentAdjustment != null && Math.abs(c.paymentAdjustment) >= 0.01 && (
                <div className="flex justify-between">
                  <span>Forma de pago</span>
                  <span
                    className={cn(
                      "tabular-nums font-semibold",
                      c.paymentAdjustment < 0 ? "text-emerald-500" : "text-amber-500",
                    )}
                  >
                    {(c.paymentAdjustment < 0 ? "−" : "+") +
                      mFmt(Math.abs(c.paymentAdjustment))}
                  </span>
                </div>
              )}
              <div className="my-1 border-t border-border/40" />
              <div className="flex justify-between">
                <span>Total calculado</span>
                <span className="tabular-nums font-semibold text-text">
                  {mFmt(totalCalculated)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1">
                  Redondeo comprobante
                  <span
                    title="El redondeo por comprobante se aplica al final, después de descuentos, impuestos, envío y forma de pago."
                    className="inline-flex shrink-0 cursor-help text-muted/70"
                  >
                    <Info size={10} />
                  </span>
                </span>
                <span className="tabular-nums font-semibold text-amber-500">
                  {(c.rounding < 0 ? "−" : "+") + mFmt(Math.abs(c.rounding))}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text">
                  Total final
                </span>
                <span className="tabular-nums font-bold text-primary">
                  {mFmt(c.total)}
                </span>
              </div>
            </div>
          );
        }

        // Sin redondeo doc — comportamiento histórico (resumen mínimo).
        return (
          <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-[11px] text-muted">
            {c.subtotalNet != null && (
              <div className="flex justify-between">
                <span>Subtotal neto</span>
                <span className="tabular-nums font-semibold text-text">
                  {mFmt(c.subtotalNet)}
                </span>
              </div>
            )}
            {c.taxTotal > 0 && (
              <div className="flex justify-between">
                <span>Impuestos</span>
                <span className="tabular-nums font-semibold text-amber-500">
                  {mFmt(c.taxTotal)}
                </span>
              </div>
            )}
            {hasShipping && (
              <div className="flex justify-between">
                <span>Envío</span>
                <span className="tabular-nums font-semibold text-text">
                  {mFmt(c.shipping ?? 0)}
                </span>
              </div>
            )}
            {hasRounding && (
              <div className="flex justify-between">
                <span>Redondeo</span>
                <span className="tabular-nums font-semibold text-amber-500">
                  {(c.rounding < 0 ? "−" : "+") + mFmt(Math.abs(c.rounding))}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Modo Desglosado — composición completa paso a paso, agrupada en
          bloques visuales:
            · PRECIO BASE
            · AJUSTES Y DESCUENTOS
            · BASE IMPONIBLE
            · IMPUESTOS
            · REDONDEO
            · TOTAL FINAL
          Por defecto se ocultan los conceptos no aplicados; el operador
          puede activarlos con el toggle "Ver conceptos no aplicados". */}
      {viewMode === "detailed" && (
        <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
          {/* Header con toggle de visibilidad de inactivos */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted/80">
              Composición del total
            </div>
            <button
              type="button"
              data-tp-enter="ignore"
              onClick={() => setShowInactive((v) => !v)}
              className="text-[10px] italic text-primary/80 hover:text-primary hover:underline"
              title="Muestra u oculta los conceptos del cálculo que no se aplicaron a este documento."
            >
              {showInactive ? "Ocultar inactivos" : "Ver conceptos no aplicados"}
            </button>
          </div>

          {/* ── BLOQUE 1: PRECIO BASE ─────────────────────────────────── */}
          <div className="space-y-0">
            <SectionHeader>Precio base</SectionHeader>
            <CompositionRow
              currency={currency}
              displayRate={displayRate}
              label="Precio base (lista)"
              amount={c.subtotalGross}
              subline={c.priceListName ? `Lista: ${c.priceListName}` : null}
              sublineTitle={
                c.priceListName === "Mixta" && c.priceListNamesUnique.length > 0
                  ? `Listas aplicadas: ${c.priceListNamesUnique.join(" · ")}`
                  : undefined
              }
              hint="Suma de cantidad × precio de lista de cada línea, antes de cualquier descuento o ajuste."
            />
          </div>

          {/* ── BLOQUE 2: AJUSTES Y DESCUENTOS ────────────────────────── */}
          <div className="space-y-0">
            <SectionHeader>Ajustes y descuentos</SectionHeader>
            <CompositionRow
              currency={currency}
              displayRate={displayRate}
              label={
                c.customerDiscountPercent != null
                  ? `Descuento de cliente (${c.customerDiscountPercent}%)`
                  : "Descuento de cliente"
              }
              amount={c.customerDiscount}
              asNegative
              tone="discount"
              hideWhenInactive={hideInactive}
              subline={(() => {
                if (c.customerDiscount == null) return null;
                switch (c.customerDiscountApplyOn) {
                  case "METAL":   return "Aplica sobre: Metal";
                  case "HECHURA": return "Aplica sobre: Hechura";
                  case "MIXED":   return "Aplica sobre: Metal + Hechura";
                  case "TOTAL":   return "Aplica sobre: Precio ajustado (lista + canal + promociones)";
                  default:        return null;
                }
              })()}
              hint="Descuento que aplica la lista de precios o el rol del cliente sobre el precio bruto."
            />

            <CompositionRow
              currency={currency}
              displayRate={displayRate}
              label="Canal de venta"
              amount={c.channelAdjustment}
              asNegative={isChannelDiscount}
              tone={isChannelDiscount ? "discount" : "surcharge"}
              hideWhenInactive={hideInactive}
              subline={c.channelName}
              hint="Ajuste positivo (recargo) o negativo (descuento) configurado en el canal de venta del documento."
            />

            <CompositionRow
              currency={currency}
              displayRate={displayRate}
              label="Descuento por cantidad"
              amount={c.quantityDiscount}
              asNegative
              tone="discount"
              hideWhenInactive={hideInactive}
              hint="Descuento por escalas de cantidad aplicado por el motor a las líneas."
            />

            <CompositionRow
              currency={currency}
              displayRate={displayRate}
              label="Promoción"
              amount={c.promotion}
              asNegative
              tone="discount"
              hideWhenInactive={hideInactive}
              subline={c.promotionName ? `Promo: ${c.promotionName}` : null}
              hint="Descuento aplicado por una promoción activa para alguna de las líneas."
            />

            {/* Bonificación manual: solo aparece si al menos una línea tiene
                `manualDiscountOverride`. En esas líneas el motor reemplaza
                promo + desc. cantidad por el valor manual; lo separamos en
                una fila propia para que las filas "Promoción" y "Desc. por
                cantidad" no incluyan importes manuales. */}
            {c.manualDiscount != null && (
              <CompositionRow
                currency={currency}
                displayRate={displayRate}
                label="Bonificación manual"
                amount={c.manualDiscount}
                asNegative
                tone="discount"
                subline="Reemplaza promoción y desc. por cantidad en las líneas afectadas."
                hint="Total de los manualDiscountOverride aplicados en líneas individuales."
              />
            )}

            <CompositionRow
              currency={currency}
              displayRate={displayRate}
              label="Cupón de venta"
              amount={c.coupon}
              asNegative
              tone="discount"
              hideWhenInactive={hideInactive}
              subline={c.couponName ? `${c.couponName}${c.couponCode ? ` · ${c.couponCode}` : ""}` : null}
              hint="Descuento del cupón aplicado al documento. Lo valida el motor."
            />

            {c.globalDiscount != null && (
              <CompositionRow
                currency={currency}
                displayRate={displayRate}
                label="Descuento global"
                amount={c.globalDiscount}
                asNegative
                tone="discount"
                hint="Descuento manual cargado a nivel documento."
              />
            )}
          </div>

          {/* ── BLOQUE 3: BASE IMPONIBLE ──────────────────────────────── */}
          <div className="space-y-0">
            <SectionHeader>Base imponible</SectionHeader>
            <CompositionRow
              currency={currency}
              displayRate={displayRate}
              label="Subtotal neto antes de impuestos"
              amount={c.subtotalNet}
              tone="default"
              bold
              hint="Subtotal después de todos los descuentos y ajustes, sin impuestos ni envío. Sobre este monto el motor calcula los impuestos."
            />
          </div>

          {/* ── BLOQUE 4: IMPUESTOS ───────────────────────────────────── */}
          <div className="space-y-0">
            <SectionHeader>Impuestos</SectionHeader>
            {c.taxes.length > 0 ? (
              <>
                <CompositionRow
                  currency={currency}
                  displayRate={displayRate}
                  label="Total impuestos"
                  amount={taxesTotalForRow}
                  tone="tax"
                  hint="Suma de todos los impuestos aplicados al documento."
                />
                <div className="ml-3 mt-0 space-y-0">
                  {c.taxes.map((t) => (
                    <div
                      key={`${t.name}|${t.rate ?? ""}`}
                      className="flex items-center justify-between gap-3 py-0.5 text-[11px]"
                    >
                      <span className="truncate text-muted">
                        <span className="text-text">{t.name || "Impuesto"}</span>
                        {t.rate != null && (
                          <span className="ml-1 text-muted">{t.rate}%</span>
                        )}
                      </span>
                      <span className="tabular-nums font-semibold text-amber-500 shrink-0">
                        {mFmt(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <CompositionRow
                currency={currency}
                displayRate={displayRate}
                label="Impuestos"
                amount={null}
                tone="tax"
                hideWhenInactive={hideInactive}
                hint="Sin impuestos configurados o cliente exento."
              />
            )}
          </div>

          {/* Envío (si aplica) — bloque propio para no mezclar con
              impuestos ni con redondeo. Solo visible cuando hay monto. */}
          {(hasShipping || showInactive) && (
            <div className="space-y-0">
              <SectionHeader>Envío</SectionHeader>
              <CompositionRow
                currency={currency}
                displayRate={displayRate}
                label="Costo de envío"
                amount={hasShipping ? (c.shipping ?? 0) : null}
                tone="default"
                hideWhenInactive={hideInactive}
                hint="Costo del envío configurado en el documento."
              />
            </div>
          )}

          {/* ── BLOQUE 5: REDONDEO ─────────────────────────────────────
              Dos fuentes posibles:
                · TENANT_POLICY: política de redondeo a nivel comprobante de
                  la joyería. El delta SÍ afecta el `total`.
                · PRICE_LIST: la lista de precios redondeó. El motor ya lo
                  absorbió línea por línea; el delta es display-only.
              Si no hay redondeo activo y el toggle de inactivos está OFF,
              el bloque entero se omite. */}
          {(c.roundingInfo || showInactive) && (
            <div className="space-y-0">
              <SectionHeader>Redondeo</SectionHeader>
              {c.roundingInfo ? (
                <CompositionRow
                  currency={currency}
                  displayRate={displayRate}
                  label={
                    c.roundingInfo.source === "TENANT_POLICY"
                      ? "Redondeo por comprobante"
                      : `Redondeo por lista${
                          c.roundingInfo.priceListName ? `: ${c.roundingInfo.priceListName}` : ""
                        }`
                  }
                  amount={hasRounding ? c.rounding : 0}
                  asNegative={c.rounding < 0}
                  tone={c.rounding < 0 ? "discount" : "surcharge"}
                  subline={describeRoundingConfig(c.roundingInfo)}
                  hint={
                    c.roundingInfo.source === "TENANT_POLICY"
                      ? "Redondeo aplicado por la política del comprobante (configuración de la joyería). Se aplica al final, sobre el total con impuestos, pago y envío."
                      : "Redondeo aplicado por la configuración de la lista de precios. El motor lo absorbió en cada línea; el monto mostrado es el ajuste agregado a nivel documento."
                  }
                />
              ) : (
                <CompositionRow
                  currency={currency}
                  displayRate={displayRate}
                  label="Redondeo"
                  amount={null}
                  tone="muted"
                  hideWhenInactive={hideInactive}
                  subline="Sin redondeo configurado"
                  hint="Ni la lista de precios ni la política del comprobante tienen redondeo activo."
                />
              )}
            </div>
          )}

          {/* ── BLOQUE 6: TOTAL FINAL ─────────────────────────────────── */}
          <div className="space-y-0">
            <div className="my-1 border-t border-border/60" />
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text">
                Total final
              </span>
              <span className="text-base font-bold tabular-nums text-primary">
                {mFmt(c.total)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TPDocumentTotalsHero;
