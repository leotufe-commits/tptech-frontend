// src/pages/ventas-facturas/InvoiceEditorModal/ShippingCard.tsx
// ============================================================================
// Card "Envío" del aside derecho del modal de Factura.
//
// FASE UX 1: alineación funcional con el Simulador de precios.
//
// Antes: usaba el mock estático `SHIPPING_METHOD_MOCK_OPTIONS` (3 opciones
// genéricas: Retiro / Estándar / Exprés) y el operador tipeaba el costo a
// mano. Sin paridad con Simulador.
//
// Ahora: carga los carriers REALES de `shippingApi.list()` (mismo flujo que
// `PricingSimulator.tsx`). Al elegir un carrier:
//   · PICKUP            → costo 0 automático.
//   · DELIVERY/FIXED    → costo = tarifa fija configurada.
//   · DELIVERY/BY_WEIGHT→ costo = pricePerKg × 1 kg (fallback; el motor de
//                          sales recibe `shippingAmount` plano y no aplica
//                          peso por línea de factura).
//   · Si hay >1 tarifa activa, segundo combo para elegirla.
// El operador puede pisar el costo derivado tipeando manualmente (override).
//
// El payload al motor sigue siendo `shippingAmount: cost` (contrato de
// `buildSalePreviewPayload` intacto). NO se cambia el pricing-engine: el
// catálogo de carriers se lee del backend y solo se DERIVA el `cost` como
// passthrough — el motor de sales lo recibe como número.
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import { shippingApi, type ShippingCarrierRow } from "../../../services/shipping";
import type { DocumentShipping } from "../../../lib/document-types";
import { formatByType } from "../../../lib/pricing/format";
// SSOT — única función autorizada para derivar el cost del envío en
// moneda DOC desde la tarifa BASE del catálogo. Tiene defensa en
// profundidad contra rates corruptos cuando las monedas coinciden.
import { deriveShippingCostInDocumentCurrency } from "../../../lib/sales/deriveShippingCost";

export type ShippingCardProps = {
  value:    DocumentShipping | null | undefined;
  onPatch:  (patch: Partial<DocumentShipping>) => void;
  open:     boolean;
  onOpenChange: (open: boolean) => void;
  /** Formatter de moneda — inyectado del padre. */
  fmtCurrency: (amount: number) => string;
  /**
   * Tasa BASE→DOC del comprobante. Las tarifas de carriers (`fixedPrice`,
   * `pricePerKg`) se persisten en la moneda BASE del tenant. Cuando el
   * comprobante esta en otra moneda (USD, EUR…), el costo derivado del
   * carrier hay que multiplicarlo por `documentFxRate` para entregar al
   * `draft.shipping.cost` (y al motor) un valor expresado en moneda DOC.
   *
   * Sin esto, el backend hace `toB(shippingAmount)` esperando un valor
   * DOC y obtiene un BASE ya convertido a base por error — el motor
   * computa con un shipping mal escalado y la factura queda con un
   * impacto financiero incorrecto.
   *
   * Default `1` (moneda DOC === BASE, sin conversion).
   */
  documentFxRate?: number;
  /**
   * Codigo de moneda del comprobante (DOC) — ej. "ARS", "USD", "EUR".
   * Se usa para formatear el monto del header con la moneda correcta,
   * SIN doble conversion: el `cost` del draft ya esta en moneda DOC
   * (lo convirtio `derivedCost` arriba), entonces el prefijo de moneda
   * debe ser la del DOC y el numero no se debe reconvertir.
   *
   * Si no se pasa, el header cae a `fmtCurrency` (legacy, puede generar
   * doble conversion si `fmtCurrency` divide por displayRate).
   */
  documentCurrencyCode?: string;
  /**
   * Codigo de la moneda BASE del tenant (ej. "ARS"). Si se pasa y la
   * moneda DOC del comprobante difiere de BASE (hay conversion FX),
   * el header del card muestra un helper discreto con la tarifa
   * original en moneda BASE: "Tarifa: ARS 12.000,00".
   *
   * Opcional. Si no se pasa, no se muestra el helper.
   */
  baseCurrencyCode?: string;
};

export function ShippingCard(props: ShippingCardProps): React.ReactElement {
  const { value, onPatch, open, onOpenChange, fmtCurrency, documentCurrencyCode, baseCurrencyCode } = props;

  /**
   * Formatter para valores ya expresados en moneda DOC (no requieren
   * re-conversion). Usado para el `cost` del header — que viene de
   * `derivedCost` y ya esta en moneda DOC. Evita la doble conversion
   * que ocurre cuando `fmtCurrency` (= `mFmt` del padre) divide por
   * `displayRate` un valor que ya esta en la moneda final.
   *
   * Si no hay `documentCurrencyCode` (back-compat), cae a `fmtCurrency`.
   */
  const fmtAlreadyInDoc = (amount: number): string => {
    if (!documentCurrencyCode) return fmtCurrency(amount);
    return `${documentCurrencyCode} ${formatByType(amount, "MONEY")}`;
  };
  const documentFxRate =
    typeof props.documentFxRate === "number"
      && Number.isFinite(props.documentFxRate)
      && props.documentFxRate > 0
      ? props.documentFxRate
      : 1;

  // Catálogo de carriers reales — mismo fetch que el Simulador.
  const [carriers, setCarriers] = useState<ShippingCarrierRow[]>([]);
  useEffect(() => {
    shippingApi.list()
      .then((list) => setCarriers(list.filter((c) => c.isActive && !c.deletedAt)))
      .catch(() => {});
  }, []);

  const carrierId  = value?.methodId ?? "";
  const rateId     = (value as DocumentShipping & { rateId?: string } | undefined)?.rateId ?? "";

  // Carrier seleccionado.
  const carrier = useMemo(
    () => carriers.find((c) => c.id === carrierId) ?? null,
    [carriers, carrierId],
  );
  const activeRates = useMemo(
    () => (carrier?.rates ?? []).filter((r) => r.isActive),
    [carrier],
  );
  const showRateSelector = carrier?.type === "DELIVERY" && activeRates.length > 1;

  // CONTRATO (rectificado 2026-05-28 — fix del bug "21.6M"):
  //
  //   `draft.shipping.cost` esta SIEMPRE en la MONEDA DEL DOCUMENTO
  //   (DOC) — exactamente el valor que el operador ve y edita en el
  //   TPNumberInput. La conversion BASE→DOC desde la tarifa del
  //   catalogo ocurre UNA SOLA VEZ aca, al derivar `derivedCost`.
  //
  //   Reglas:
  //   - El operador VE en DOC el valor del envio (ARS 12000 si comprobante
  //     ARS, USD 6.67 si comprobante USD con rate 1800).
  //   - El operador TIPEA en DOC. Lo que escribe es lo que se guarda.
  //   - El payload al backend envia `cost` tal cual (DOC). El motor recibe
  //     un monto en moneda DOC consistente con el resto del documento.
  //   - El helper "(Tarifa: BASE 12.000,00)" sigue dando trazabilidad
  //     del valor original del catalogo.
  //
  //   Historico del bug "21.6M": el contrato anterior decia que cost
  //   estaba en BASE y aplicaba conversiones × fxRate en el display y
  //   en el payload. Cualquier desincronizacion entre el fxRate
  //   persistido y el fxRate vigente al momento del onChange producia
  //   multiplicaciones acumuladas (12000 × 1798 = 21.6M). El nuevo
  //   contrato elimina las multiplicaciones estructuralmente: cost
  //   siempre vive en DOC, payload tambien.
  //
  //   Migracion segura: layouts persistidos pre-fix con cost en BASE
  //   se auto-corrigen via el useEffect [derivedCost] cuando se
  //   selecciona un carrier (overwrite a la derivacion correcta).
  //   Si el operador tenia un override `costSource: "MANUAL"` con un
  //   valor inflado por el bug viejo, debera limpiar el campo y
  //   re-tipearlo (o seleccionar otro carrier y volver al actual).
  const baseCostInBaseCurrency: number = useMemo(() => {
    if (!carrier) return 0;
    if (carrier.type === "PICKUP") return 0;
    const rate = (rateId
      ? activeRates.find((r) => (r.id ?? "") === rateId)
      : activeRates[0]) ?? null;
    if (!rate) return 0;
    return rate.calculationMode === "FIXED"
      ? (rate.fixedPrice != null ? parseFloat(rate.fixedPrice) : 0)
      : rate.calculationMode === "BY_WEIGHT"
        // Fallback 1 kg en factura (no hay peso del comprobante).
        ? (rate.pricePerKg != null ? parseFloat(rate.pricePerKg) : 0)
        : 0; // BY_ZONE: no aplicable sin destino concreto.
  }, [carrier, rateId, activeRates]);

  // derivedCost — UNA SOLA conversion BASE→DOC, delegada al helper puro
  // SSOT (`deriveShippingCostInDocumentCurrency`) en `lib/sales/`.
  //
  // Reglas críticas (defensa en profundidad contra el bug "21.582.733"):
  //   - Si `baseCurrencyCode === documentCurrencyCode` (misma moneda),
  //     retorna `baseCost` sin importar `fxRate`. Esto blinda contra
  //     rates corruptos para la moneda base (caso observado 2026-05-29:
  //     latestRate=0.000556 para ARS produce 12000/0.000556 = 21.6M).
  //   - Si las monedas difieren y fxRate es positivo finito, retorna
  //     `baseCost / fxRate` (ARS→USD: 12000/1800 = 6.67).
  //   - Si fxRate es inválido o 1, retorna `baseCost` (sin conversión).
  //
  // El helper está testeado en aislamiento — ver
  // `lib/sales/__tests__/deriveShippingCost.test.ts`.
  const derivedCost: number = useMemo(() => {
    return deriveShippingCostInDocumentCurrency({
      baseCost:             baseCostInBaseCurrency,
      documentFxRate,
      baseCurrencyCode:     props.baseCurrencyCode,
      documentCurrencyCode: documentCurrencyCode,
    });
  }, [baseCostInBaseCurrency, documentFxRate, props.baseCurrencyCode, documentCurrencyCode]);

  // Hidratación automática: cuando cambia carrier/rate, el costo
  // derivado toma precedencia. ESTO RESETEA `costSource` a "CARRIER":
  // si el operador tenia un override manual y cambia de carrier, la
  // intencion es claramente arrancar con el costo del nuevo carrier.
  //
  // PROTECCION al MOUNT inicial: si el draft persistido trae
  // `costSource: "MANUAL"`, NO pisamos el cost del operador con el
  // derivado del catalogo. El primer useEffect solo aplica al cambio
  // REAL de carrier/rate, no a la hidratacion inicial.
  const mountedRef = React.useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      // Mount inicial: respetar el costSource persistido. Solo
      // aplicar el derivado si el flag dice CARRIER (o no esta seteado).
      if (value?.costSource === "MANUAL") return;
    }
    onPatch({ cost: derivedCost, costSource: "CARRIER" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrierId, rateId]);

  // Re-hidratacion cuando cambia `documentFxRate` (cambio de moneda del
  // comprobante). El `derivedCost` ya se recalculo con la nueva tasa.
  // Solo aplicamos si `costSource !== "MANUAL"` — el flag explicito es
  // la fuente de verdad (no usamos heuristica de "comparar contra el
  // previo" que daba falsos positivos si dos derivados consecutivos
  // coincidian por casualidad).
  useEffect(() => {
    if (value?.costSource === "MANUAL") return; // override real, no tocar
    onPatch({ cost: derivedCost });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedCost]);

  // Detalle informativo del carrier (mismo wording que Simulador).
  const detail: string | null = useMemo(() => {
    if (!carrier) return null;
    if (carrier.type === "PICKUP") {
      return carrier.warehouse?.name ? `Retiro en ${carrier.warehouse.name}` : "Retiro en sucursal";
    }
    const rate = (rateId
      ? activeRates.find((r) => (r.id ?? "") === rateId)
      : activeRates[0]) ?? null;
    if (!rate) return "Sin tarifa configurada";
    const zoneDesc = [rate.zones?.[0], rate.province].filter(Boolean).join(" · ");
    const left = zoneDesc ? `${rate.name} — ${zoneDesc}` : rate.name;
    return left;
  }, [carrier, rateId, activeRates]);

  return (
    <TPCard
      title="Envío"
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
          // Header compacto: label del método + monto destacado (a la derecha,
          // tabular-nums, color principal). Si no hay método ni costo, "Sin
          // envío" muted. Cero matemática — `cost` viene del catálogo o del
          // override manual del operador; passthrough puro.
          const cost = value?.cost ?? 0;
          const label = carrier
            ? (carrier.type === "PICKUP" ? `${carrier.name} (Retiro)` : carrier.name)
            : null;
          if (!label && cost <= 0) {
            return (
              <span
                data-tp-shipping-impact="none"
                className="text-[11px] text-muted"
              >
                Sin envío
              </span>
            );
          }
          return (
            <span
              data-tp-shipping-impact="set"
              className="text-[11px] text-muted"
            >
              {label ?? "Envío"}
              {cost > 0 && (
                <>
                  {" · "}
                  {/* Header muestra cost en moneda DOC TAL CUAL. El cost
                      del draft YA esta en DOC (rectificacion 2026-05-28),
                      asi que NO hay que convertir. Cuando comprobante=ARS,
                      cost=12000 → muestra "ARS 12.000". Cuando comprobante=
                      USD con rate 1800, cost=6.67 → muestra "USD 6,67". */}
                  <span className="font-semibold tabular-nums text-text">
                    {documentCurrencyCode
                      ? `${documentCurrencyCode} ${formatByType(cost, "MONEY")}`
                      : fmtCurrency(cost)}
                  </span>
                  {/* Helper "(Tarifa: ARS 12.000,00)" cuando comprobante
                      esta en otra moneda — da trazabilidad del valor
                      original del catalogo "Envios y Logistica". Se
                      muestra `baseCostInBaseCurrency` (no `cost`) porque
                      `cost` ya esta convertido a DOC. */}
                  {baseCurrencyCode
                    && documentCurrencyCode
                    && baseCurrencyCode !== documentCurrencyCode
                    && documentFxRate > 0
                    && documentFxRate !== 1
                    && baseCostInBaseCurrency > 0
                    && (
                    <span
                      className="ml-1.5 text-[10px] text-muted/80"
                      title={`Tarifa configurada en moneda base (${baseCurrencyCode})`}
                    >
                      (Tarifa: {baseCurrencyCode} {formatByType(baseCostInBaseCurrency, "MONEY")})
                    </span>
                  )}
                </>
              )}
            </span>
          );
        })()
      }
    >
      {/* Layout en una sola fila — proporciones adaptativas balanceadas
          para que el Costo tenga aire suficiente (legibilidad > compactación
          extrema; el monto necesita espacio para dígitos + stepper + X):
          · Sin selector de tarifa: Método (7) + Costo (5).
          · Con selector de tarifa: Método (4) + Tarifa (4) + Costo (4).
         En mobile (col-span-12) todos apilan. La línea secundaria
         "carrier · zona" vive bajo el Método (texto muted, sin matemática). */}
      <div className="grid grid-cols-12 gap-2">
        <TPField
          label="Método de entrega"
          className={showRateSelector
            ? "col-span-12 sm:col-span-4"
            : "col-span-12 sm:col-span-7"}
        >
          <TPComboFixed
            value={carrierId}
            onChange={(v) => {
              // Limpiar `rateId` cuando cambia el carrier (la rate del
              // carrier anterior puede no existir en el nuevo). El costo
              // se rehidrata en el useEffect.
              onPatch({
                methodId: v || undefined,
                ...({ rateId: undefined } as Partial<DocumentShipping>),
              });
            }}
            options={[
              { value: "", label: "Sin método de entrega" },
              ...carriers.map((c) => ({
                value: c.id,
                label: c.type === "PICKUP" ? `${c.name} (Retiro)` : c.name,
              })),
            ]}
          />
          {detail && (
            <p
              data-tp-shipping-detail
              className="mt-1 truncate text-[10px] leading-tight text-muted/70"
              title={detail}
            >
              {detail}
            </p>
          )}
        </TPField>
        {/* Selector de tarifa cuando el carrier es DELIVERY con >1 activa
            (mismo criterio que el Simulador). Inline dentro del MISMO grid
            para evitar el bloque vertical extra que daba sensación de card
            "duplicado". */}
        {showRateSelector && (
          <TPField label="Tarifa" className="col-span-12 sm:col-span-4">
            <TPComboFixed
              value={rateId}
              onChange={(v) => onPatch({ ...({ rateId: v || undefined } as Partial<DocumentShipping>) })}
              options={activeRates.map((r, i) => {
                const zone = [r.zones?.[0], r.province].filter(Boolean).join(" · ");
                const left = zone ? `${r.name} — ${zone}` : r.name;
                const right = r.calculationMode === "FIXED" && r.fixedPrice != null
                  ? fmtCurrency(parseFloat(r.fixedPrice))
                  : r.calculationMode === "BY_WEIGHT" && r.pricePerKg != null
                    ? `${fmtCurrency(parseFloat(r.pricePerKg))}/kg`
                    : "—";
                return { value: r.id ?? String(i), label: `${left} — ${right}` };
              })}
            />
          </TPField>
        )}
        <TPField
          label="Costo"
          className={showRateSelector
            ? "col-span-12 sm:col-span-4"
            : "col-span-12 sm:col-span-5"}
        >
          {/* Ajustes locales del TPNumberInput (no se cambia el componente
              global): `wrapClassName` garantiza un ancho mínimo cómodo en
              breakpoints intermedios; `className` sube un punto el texto
              numérico para mejor legibilidad del monto. */}
          {/* TPNumber muestra y guarda `cost` TAL CUAL — el contrato
              dice que cost vive en moneda DOC. Lo que el operador VE
              es lo que se persiste, lo que se envia al backend y lo
              que se ve en la factura. Cero conversiones aca → cero
              bugs de doble multiplicacion. */}
          <TPNumberInput
            value={value?.cost ?? 0}
            onChange={(v) => onPatch({
              cost: v ?? 0,
              costSource: "MANUAL",
            })}
            formatType="MONEY"
            decimals={2}
            min={0}
            showArrows={false}
            wrapClassName="min-w-0 w-full"
            className="text-[15px] font-medium tabular-nums"
            onClear={(value?.cost ?? 0) > 0 ? () => onPatch({ cost: 0 }) : undefined}
          />
        </TPField>
      </div>
    </TPCard>
  );
}

export default ShippingCard;
