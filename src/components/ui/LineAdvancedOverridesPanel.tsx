// src/components/ui/LineAdvancedOverridesPanel.tsx
// ============================================================================
// LineAdvancedOverridesPanel — composición del precio por BLOQUES verticales
// orientados al negocio de joyería:
//
//   METAL      → Variante · Pureza · Gramos · Merma
//   HECHURA    → Moneda · Valor · Bonificación
//   PRODUCTOS  → Descripción · Moneda · Valor · Bonificación   (cuando aplica)
//   SERVICIOS  → Descripción · Moneda · Valor · Bonificación   (cuando aplica)
//
// REGLA OBLIGATORIA: el frontend NO calcula precios. Cada cambio dispara
// `pricing-preview` con el override correspondiente; el motor recalcula y
// la UI muestra la respuesta.
//
// Notas de diseño:
//   · Cada bloque es vertical, label a la izquierda, valor/input a la derecha.
//   · NO se muestran campos que no aplican (pureza/merma en hechura, etc.).
//   · Metal NO tiene bonificación (la bonificación de metal vive en la celda
//     "Bonificación" de la línea con appliesTo="METAL").
//   · Pureza es read-only (viene de la variante; no se edita acá).
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import { RotateCcw, X as XIcon, ChevronDown, ChevronRight } from "lucide-react";

import TPNumberInput from "./TPNumberInput";
import { cn } from "./tp";
import { fmtMoney } from "../../lib/document-helpers";
import type { DocumentLine } from "../../lib/document-types";

export type AppliesTo = "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";

export type LineOverridePatch = {
  taxOverride?:           { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesTo } | null;
  manualPrice?:           number | null;
  manualDiscount?:        { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesTo } | null;
  gramsOverride?:         number | null;
  mermaPercentOverride?:  number | null;
  metalVariantIdOverride?: string | null;
  hechuraOverrideAmount?: number | null;
};

export type LineAdvancedOverridesPanelProps = {
  line:     DocumentLine;
  currency: string;
  onApply:  (patch: LineOverridePatch) => void;
  onClear?: () => void;
  onClose?: () => void;
  /**
   * Orientación del panel:
   *   · "cost" (default): foco en costos del artículo (Compras, vista
   *     legacy de documentos). El resumen muestra Costo total como
   *     valor principal junto a Precio de venta y Margen.
   *   · "sale": foco en composición del precio de venta (Factura). Cada
   *     bloque (Metal / Hechura) agrega la fila "Valor venta" leída de
   *     `pricingMeta.metalSale` / `pricingMeta.hechuraSale` (passthrough
   *     del motor — el frontend NO calcula). El resumen reorganiza:
   *     "Precio de venta" como principal, "Costo interno" y "Margen"
   *     como rentabilidad secundaria.
   * Default `cost` preserva el comportamiento de Presupuestos / Órdenes
   * / Compras que comparten este editor.
   */
  view?: "sale" | "cost";
};

const EPS = 1e-6;
function nearlyEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < EPS;
}

/**
 * Hook fino para manejar un campo numérico que se compara contra el "original"
 * del backend. Cuando el usuario edita y el valor difiere → override; si
 * vuelve al original → null (limpia). Debounce 400ms al backend.
 */
function useOverrideNumber(
  initialValue: number | null,
  originalValue: number | null,
  onCommit: (value: number | null) => void,
): {
  value:    number | null;
  setValue: (n: number | null) => void;
  manual:   boolean;
} {
  const [value, setValue] = useState<number | null>(
    initialValue != null ? initialValue : originalValue,
  );

  const lastSyncedRef = useRef<{ initial: number | null; original: number | null }>({
    initial:  initialValue,
    original: originalValue,
  });
  useEffect(() => {
    const last = lastSyncedRef.current;
    if (
      !nearlyEqual(last.initial, initialValue) ||
      !nearlyEqual(last.original, originalValue)
    ) {
      setValue(initialValue != null ? initialValue : originalValue);
      lastSyncedRef.current = { initial: initialValue, original: originalValue };
    }
  }, [initialValue, originalValue]);

  const commitRef = useRef<{ timer: number | null; lastSent: number | null | "INIT" }>({
    timer: null, lastSent: "INIT",
  });
  useEffect(() => {
    const c = commitRef.current;
    if (c.timer) window.clearTimeout(c.timer);
    c.timer = window.setTimeout(() => {
      const next = nearlyEqual(value, originalValue) ? null : value;
      if (c.lastSent === "INIT") { c.lastSent = next; return; }
      const same =
        (next == null && c.lastSent == null) ||
        (typeof next === "number" && typeof c.lastSent === "number" && nearlyEqual(next, c.lastSent));
      if (same) return;
      c.lastSent = next;
      onCommit(next);
    }, 400);
    return () => { if (c.timer) window.clearTimeout(c.timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, originalValue]);

  const manual = value != null && originalValue != null && !nearlyEqual(value, originalValue);
  return { value, setValue, manual };
}

// ── Componente principal ───────────────────────────────────────────────────

export function LineAdvancedOverridesPanel({
  line,
  currency,
  onApply,
  onClear,
  onClose,
  view = "cost",
}: LineAdvancedOverridesPanelProps) {
  const isSaleView = view === "sale";
  const meta = line.pricingMeta ?? {};
  const composition = meta.composition ?? null;

  // Originales del artículo.
  const origGrams    = composition?.metal?.originalGrams    ?? null;
  const origMermaPct = composition?.metal?.originalMermaPct ?? null;
  const origHechura  = composition?.hechura?.originalAmount ?? null;

  // Hooks de overrides numéricos (gramos / merma / hechura).
  const grams = useOverrideNumber(
    meta.gramsOverride ?? composition?.metal?.appliedGrams ?? null,
    origGrams,
    (next) => onApply({ gramsOverride: next }),
  );
  const merma = useOverrideNumber(
    meta.mermaPercentOverride ?? composition?.metal?.appliedMermaPct ?? null,
    origMermaPct,
    (next) => onApply({ mermaPercentOverride: next }),
  );
  const hechura = useOverrideNumber(
    meta.hechuraOverrideAmount ?? composition?.hechura?.appliedAmount ?? null,
    origHechura,
    (next) => onApply({ hechuraOverrideAmount: next }),
  );

  // ── Detección de overrides activos (chip / botón Restaurar) ──────────────
  const hasOverrides = !!(
    grams.manual ||
    merma.manual ||
    hechura.manual ||
    meta.metalVariantIdOverride
  );

  function handleClearAll() {
    grams.setValue(origGrams);
    merma.setValue(origMermaPct);
    hechura.setValue(origHechura);
    onClear?.();
  }

  // ── Datos derivados para Metal ───────────────────────────────────────────
  const metalVariantLabel =
    composition?.metal?.metalName ||
    composition?.metal?.purityLabel ||
    null;
  const purityValue = composition?.metal?.purity ?? null;

  const showAny = !!(composition?.metal || composition?.hechura);

  // ── Resumen Costo / Venta / Margen ───────────────────────────────────────
  // Datos ya calculados por el motor o presentes en la línea: NO recalculamos
  // precios complejos. Solo derivamos:
  //   · Costo total = preferimos `unitCost` (engine) × qty; si no, sumamos
  //     metalCost + hechuraCost × qty como fallback.
  //   · Precio de venta = `line.subtotal` (qty × unitPrice − descuento), que
  //     es el neto sin impuestos.
  //   · Margen %       = ((venta − costo) / venta) × 100   (frontend simple).
  const qtyLine        = Number.isFinite(line.quantity) ? line.quantity : 0;
  const metalCostUnit  = meta.metalCost   ?? null;
  const hechuraCostUnit = meta.hechuraCost ?? null;
  const unitCostEngine = meta.unitCost    ?? null;
  const costTotal: number | null =
    unitCostEngine != null
      ? unitCostEngine * qtyLine
      : (metalCostUnit != null || hechuraCostUnit != null)
        ? ((metalCostUnit ?? 0) + (hechuraCostUnit ?? 0)) * qtyLine
        : null;
  const salePrice: number | null =
    Number.isFinite(line.subtotal) ? line.subtotal : null;
  const margin: number | null =
    costTotal != null && salePrice != null && salePrice > 0
      ? ((salePrice - costTotal) / salePrice) * 100
      : null;
  // Tono del margen — solo visual, no afecta cálculos.
  const marginToneClass =
    margin == null
      ? "text-muted/60"
      : margin >= 40
        ? "text-emerald-500"
        : margin >= 15
          ? "text-text"
          : margin > 0
            ? "text-amber-500"
            : "text-red-500";
  // ── Ganancia $ (mismo nivel de derivación que margin %) ──────────────────
  // = salePrice (neto sin impuestos) − costTotal. Resta de 2 campos ya en
  // scope. Si costo o precio faltan → null. Si negativa → tono rojo.
  // POLICY: misma justificación que margin% (línea 197 — "frontend simple").
  const gananciaTotal: number | null =
    costTotal != null && salePrice != null
      ? salePrice - costTotal
      : null;
  const gananciaToneClass =
    gananciaTotal == null
      ? "text-muted/60"
      : gananciaTotal < 0
        ? "text-red-500"
        : "text-text";
  const showSummary = salePrice != null;
  // Margen oculto si precio = 0 (o sin precio).
  const showMargin = salePrice != null && salePrice > 0;

  // ── Bonificación de Hechura para el summary colapsado ────────────────────
  // El componente `BonifValue` mantiene su valor en state local (con debounce
  // al backend), pero el header del accordion necesita el valor actual
  // persistido en `pricingMeta.manualDiscount`. Replicamos exactamente la
  // misma lectura que hace `BonifValue` (line.pricingMeta.manualDiscount con
  // mode=PERCENT y appliesTo=HECHURA) para que el resumen muestre el % real
  // entre debounces. NO duplica lógica de cálculo — solo lee el override
  // ya resuelto por el motor. */
  const hechuraBonifMd  = meta.manualDiscount ?? null;
  const hechuraBonifPct = (
    hechuraBonifMd &&
    (hechuraBonifMd.appliesTo ?? "TOTAL") === "HECHURA" &&
    hechuraBonifMd.mode === "PERCENT"
  )
    ? hechuraBonifMd.value
    : 0;

  return (
    <div className="space-y-2">
      {/* ── Header secundario, sin protagonismo. ─────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted/80">
          {isSaleView ? "Composición del precio de venta" : "Composición del precio"}
          {!isSaleView && (
            <span className="ml-1 normal-case text-muted/60">— costos del artículo</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {hasOverrides && (
            <button
              type="button"
              onClick={handleClearAll}
              title="Restaurar valores originales del artículo"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted hover:bg-surface2 hover:text-text"
            >
              <RotateCcw size={10} />
              Restaurar
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Cerrar"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted/70 hover:bg-surface2 hover:text-text"
            >
              <XIcon size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Cuerpo de la composición ─────────────────────────────────────
          Dos vistas separadas:
            · isSaleView (Factura): stack vertical Metal → Hechura →
              Rentabilidad → Precio venta. Cada sección tiene una fila
              horizontal compacta con varios "label: value" (`InfoLineRow`)
              y, cuando aplica, una sub-grilla de inputs de 2 columnas.
              Densidad alta, sin grids anchos con espacio vacío.
            · cost (Presupuestos/Órdenes/Compras): bloques verticales
              tradicionales + summary de 3 cols. Sin cambios. */}
      {showAny ? (
        isSaleView ? (
          /* Separador entre secciones (Metal · Hechura · Rentabilidad ·
             Precio venta): cada hijo no-primero recibe `mt-2 pt-2 border-t`
             via selector de hermanos (`[&>*+*]:`). El divisor queda
             centrado entre las secciones con espacio simétrico arriba y
             abajo, sin afectar al primer hijo ni al último. */
          <div className="flex flex-col [&>*+*]:mt-2 [&>*+*]:border-t [&>*+*]:border-border/30 [&>*+*]:pt-2">
            {/* 1. METAL — summary read-only siempre visible; detail
                editable (Gramos / Merma) en accordion. */}
            {composition?.metal && (
              <SaleColumn
                title="Metal"
                manual={grams.manual || merma.manual || composition.metal.variantManual}
                summary={
                  <InfoLineRow>
                    {metalVariantLabel && (
                      <InfoItem label="Variante" value={metalVariantLabel} />
                    )}
                    {purityValue != null && (
                      <InfoItem label="Pureza" value={purityValue.toFixed(3)} />
                    )}
                    {grams.value != null && (
                      <InfoItem
                        label="Gramos"
                        value={`${grams.value.toFixed(3)} g`}
                      />
                    )}
                    {merma.value != null && (
                      <InfoItem
                        label="Merma"
                        value={`${merma.value.toFixed(2)}%`}
                      />
                    )}
                    {meta.metalSale != null && (
                      <InfoItem
                        label="Valor venta"
                        value={fmtMoney(meta.metalSale, currency)}
                        highlight
                      />
                    )}
                  </InfoLineRow>
                }
                detail={
                  <div className="grid grid-cols-[max-content_max-content] items-end gap-3">
                    <InlineNumberField
                      label="Gramos"
                      value={grams.value ?? 0}
                      onChange={(v) => grams.setValue(v ?? 0)}
                      decimals={3}
                      suffix="g"
                      step={0.05}
                    />
                    <InlineNumberField
                      label="Merma"
                      value={merma.value ?? 0}
                      onChange={(v) => merma.setValue(v ?? 0)}
                      decimals={2}
                      suffix="%"
                    />
                  </div>
                }
              />
            )}

            {/* 2. HECHURA — summary read-only (Moneda + Valor venta) +
                detail editable (Valor / Bonificación). Productos /
                Servicios — cuando el motor los exponga via
                `composition.product` / `composition.service` — caen acá
                según regla TPTech (todo lo no-metal viaja en Hechura). */}
            {composition?.hechura && (
              <SaleColumn
                title="Hechura"
                manual={hechura.manual}
                summary={
                  <InfoLineRow>
                    <InfoItem label="Moneda" value={currency || "—"} />
                    {hechura.value != null && (
                      <InfoItem
                        label="Valor"
                        value={fmtMoney(hechura.value, currency)}
                      />
                    )}
                    <InfoItem
                      label="Bonif."
                      value={`${hechuraBonifPct.toFixed(2)}%`}
                    />
                    {meta.hechuraSale != null && (
                      <InfoItem
                        label="Valor venta"
                        value={fmtMoney(meta.hechuraSale, currency)}
                        highlight
                      />
                    )}
                  </InfoLineRow>
                }
                detail={
                  <div className="grid grid-cols-[max-content_max-content] items-end gap-3">
                    <InlineNumberField
                      label="Valor"
                      value={hechura.value ?? 0}
                      onChange={(v) => hechura.setValue(v ?? 0)}
                      decimals={2}
                    />
                    <div className="shrink-0">
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/70">
                        Bonificación
                      </div>
                      <div className="mt-0.5">
                        <BonifValue line={line} appliesTo="HECHURA" onApply={onApply} compact />
                      </div>
                    </div>
                  </div>
                }
              />
            )}

            {/* 3. RENTABILIDAD — costo, ganancia y margen en una sola fila.
                Ganancia $ agregada como derivación trivial (misma justificación
                que margin %, ya aceptada en línea 197). Tono rojo si negativa. */}
            {showSummary && (costTotal != null || showMargin) && (
              <SaleColumn
                title="Rentabilidad"
                summary={
                  <InfoLineRow>
                    {costTotal != null && (
                      <InfoItem label="Costo" value={fmtMoney(costTotal, currency)} />
                    )}
                    {gananciaTotal != null && (
                      <InfoItem
                        label="Ganancia"
                        value={fmtMoney(gananciaTotal, currency)}
                        className={gananciaToneClass}
                      />
                    )}
                    {showMargin && (
                      <InfoItem
                        label="Margen"
                        value={margin != null ? `${margin.toFixed(1)}%` : "—"}
                        className={marginToneClass}
                      />
                    )}
                  </InfoLineRow>
                }
              />
            )}

            {/* 4. PRECIO VENTA — hero de la línea, neto sin impuestos.
                Sin detail editable: el precio sale del motor.

                Mini breakdown agregado (cuando hay descuento):
                  · Bruto      = line.subtotal + line.discountAmount
                                 (suma de 2 campos backend, cero multiplicación
                                 local; equivalente algebraico a qty × basePrice)
                  · Descuentos = line.discountAmount (= backend lineDiscount,
                                 G3.1 — agregado consolidado del motor)
                Solo se renderiza si lineDiscount > 0 — sin descuento el bloque
                queda limpio (decisión usuario punto 5).

                Anti double-count: solo mostramos el agregado, NO componentes
                per-tipo. El motor consolida promo/qty/customer/manual en
                lineDiscount; mostrar tipo individual requeriría G8 doc-level
                (decisión γ futura, fuera de scope hoy). */}
            {showSummary && (() => {
              const lineDisc = Number.isFinite(line.discountAmount)
                ? line.discountAmount
                : 0;
              const bruto = (salePrice ?? 0) + lineDisc;
              const hasDiscount = lineDisc > 0;
              return (
                <SaleColumn
                  title="Precio venta"
                  summary={
                    <>
                      <div className="text-base font-bold leading-tight tabular-nums text-text">
                        {fmtMoney(salePrice ?? 0, currency)}
                      </div>
                      <div className="mt-0.5 text-[9px] italic text-muted/70">
                        Neto, sin impuestos
                      </div>
                      {hasDiscount && (
                        <div className="mt-1.5 space-y-0.5 border-t border-border/40 pt-1">
                          <div className="flex items-baseline justify-between gap-2 text-[10px] text-muted">
                            <span>Bruto</span>
                            <span className="tabular-nums">{fmtMoney(bruto, currency)}</span>
                          </div>
                          <div
                            className="flex items-baseline justify-between gap-2 text-[10px] text-muted"
                            title="Total consolidado de promociones, bonificaciones y descuentos aplicados por el motor."
                          >
                            <span>Descuentos</span>
                            <span className="tabular-nums text-emerald-500">
                              −{fmtMoney(lineDisc, currency)}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  }
                />
              );
            })()}
          </div>
        ) : (
          // ── Vista cost (legado): bloques verticales tradicionales ─────
          <div className="flex flex-col gap-2">
            {/* 1. METAL */}
            {composition?.metal && (
              <Block
                title="Metal"
                manual={grams.manual || merma.manual || composition.metal.variantManual}
              >
                {metalVariantLabel && (
                  <FieldRow label="Variante">
                    <ReadOnlyValue>{metalVariantLabel}</ReadOnlyValue>
                  </FieldRow>
                )}
                {purityValue != null && (
                  <FieldRow label="Pureza">
                    <ReadOnlyValue>{purityValue.toFixed(3)}</ReadOnlyValue>
                  </FieldRow>
                )}
                <FieldRow label="Gramos">
                  <NumberValue
                    value={grams.value ?? 0}
                    onChange={(v) => grams.setValue(v ?? 0)}
                    decimals={3}
                    suffix="g"
                  />
                </FieldRow>
                <FieldRow label="Merma">
                  <NumberValue
                    value={merma.value ?? 0}
                    onChange={(v) => merma.setValue(v ?? 0)}
                    decimals={2}
                    suffix="%"
                  />
                </FieldRow>
              </Block>
            )}

            {/* 2. HECHURA */}
            {composition?.hechura && (
              <Block title="Hechura" manual={hechura.manual}>
                <FieldRow label="Moneda">
                  <ReadOnlyValue>{currency || "—"}</ReadOnlyValue>
                </FieldRow>
                <FieldRow label="Valor">
                  <NumberValue
                    value={hechura.value ?? 0}
                    onChange={(v) => hechura.setValue(v ?? 0)}
                    decimals={2}
                  />
                </FieldRow>
                <FieldRow label="Bonificación">
                  <BonifValue line={line} appliesTo="HECHURA" onApply={onApply} />
                </FieldRow>
              </Block>
            )}

            {/* 5. IMPUESTOS — solo en cost view (Presupuestos/Órdenes/Compras
                lo necesitan como única vista del IVA per-línea). En sale
                view se omite porque ya está el desglose compacto debajo de
                "TOTAL LÍNEA C/ IMP.". */}
            {composition?.taxes && composition.taxes.length > 0 && (
              <Block title="Impuestos" manual={composition.taxes.some((t) => t.manual)}>
                {composition.taxes.map((t) => {
                  const scopeLabel =
                    t.appliesTo === "METAL"   ? " (sobre metal)"
                    : t.appliesTo === "HECHURA" ? " (sobre hechura)"
                    : "";
                  const ratePart =
                    typeof t.rate === "number" ? ` ${t.rate}%` : "";
                  return (
                    <FieldRow key={t.id} label={`${t.name}${ratePart}${scopeLabel}`}>
                      <ReadOnlyValue>{fmtMoney(t.taxAmount, currency)}</ReadOnlyValue>
                    </FieldRow>
                  );
                })}
              </Block>
            )}
          </div>
        )
      ) : (
        <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-[11px] italic text-muted">
          Sin desglose de composición disponible.
        </div>
      )}

      {/* ── Resumen Costo · Venta · Margen — solo en vista cost (legado).
          En sale view, "Precio venta" y "Rentabilidad" ya viven como
          columnas del grid de arriba; no hace falta repetirlas abajo. */}
      {showSummary && !isSaleView && (
        <div className="mt-2 border-t border-border/50 pt-2">
          <div className="grid grid-cols-3 gap-2">
            <SummaryStat label="Costo total">
              {costTotal != null
                ? <span className="font-semibold tabular-nums text-text">{fmtMoney(costTotal, currency)}</span>
                : <span className="text-muted/50">—</span>}
            </SummaryStat>
            <SummaryStat label="Precio de venta" hint="Neto, sin impuestos">
              <span className="font-semibold tabular-nums text-text">
                {fmtMoney(salePrice ?? 0, currency)}
              </span>
            </SummaryStat>
            {showMargin && (
              <SummaryStat label="Margen">
                <span className={`font-semibold tabular-nums text-[11px] ${marginToneClass}`}>
                  {margin != null ? `${margin.toFixed(1)}%` : "—"}
                </span>
              </SummaryStat>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes de bloques verticales ─────────────────────────────────

/** Bloque vertical: header + body con espaciado uniforme entre filas. */
function Block({
  title,
  manual,
  children,
}: {
  title:    string;
  manual?:  boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border/50 bg-surface2/30 px-2.5 py-2">
      <header className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text/85">
          {title}
        </span>
        {manual && (
          <span className="rounded bg-surface2 px-1 py-0 text-[9px] uppercase tracking-wide text-muted/80">
            Manual
          </span>
        )}
      </header>
      <div className="space-y-1">
        {children}
      </div>
    </section>
  );
}

/** Fila label-izquierda · valor-derecha dentro de un Block. */
function FieldRow({
  label,
  children,
}: {
  label:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[11px] text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ─── Sub-componentes COMPACTOS para vista de venta (Factura) ───────────────
//
// La vista de venta apila secciones verticalmente (Metal → Hechura →
// Rentabilidad → Precio venta). Cada sección usa una fila horizontal
// compacta con varios `label: value` (`InfoLineRow` + `InfoItem`) y, cuando
// aplica, una sub-grilla 2 cols con la pareja de inputs (`InlineNumberField`).
// Sin cajas anidadas; solo header chico con divisor sutil entre secciones.
//
// Estos helpers se mantienen separados de `Block`/`FieldRow`/`NumberValue`
// para no degradar las pantallas legacy (Presupuestos/Órdenes/Compras) que
// siguen usando los originales.

/** Sección del stack vertical de "Composición del precio de venta".
 *
 *  Estructura:
 *    · header con título + chevron (cuando hay `detail`) + badge "Manual"
 *    · `summary` — siempre visible (ej. info-row con datos read-only).
 *    · `detail` — opcional, oculto por default; click en header lo abre.
 *
 *  Cuando NO hay `detail` (ej. Rentabilidad y Precio venta, que solo
 *  muestran info), no se renderiza chevron y la sección queda como un
 *  bloque simple sin accordion.
 *
 *  Por qué default colapsado: el operador ve el resumen completo de
 *  todas las secciones de un vistazo y solo expande Metal o Hechura
 *  cuando necesita editar gramos/merma/valor/bonificación. Reduce
 *  altura inicial del panel. */
function SaleColumn({
  title,
  manual,
  summary,
  detail,
  defaultExpanded = false,
}: {
  title:    string;
  manual?:  boolean;
  summary:  React.ReactNode;
  detail?:  React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isCollapsible = !!detail;

  // Header inline: chevron (si colapsable) + título + badge "Manual" +
  // resumen — TODO en la misma fila con `flex-wrap` para que en pantallas
  // angostas el resumen baje de manera elegante. Click en cualquier
  // parte del header toggles el accordion (cuando es colapsable).
  const headerContent = (
    <>
      {isCollapsible && (
        expanded
          ? <ChevronDown size={10} className="shrink-0 text-muted/60" />
          : <ChevronRight size={10} className="shrink-0 text-muted/60" />
      )}
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted/80">
        {title}
      </span>
      {manual && (
        <span className="shrink-0 rounded bg-surface2 px-1 text-[8px] uppercase tracking-wide text-muted/80">
          Manual
        </span>
      )}
      <div className="min-w-0 flex-1">
        {summary}
      </div>
    </>
  );

  return (
    <div className="min-w-0">
      {isCollapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? `Colapsar ${title}` : `Expandir ${title}`}
          className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-1 rounded text-left hover:bg-surface2/30"
        >
          {headerContent}
        </button>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {headerContent}
        </div>
      )}
      {isCollapsible && expanded && (
        <div className="mt-1 pl-3.5">
          {detail}
        </div>
      )}
    </div>
  );
}

/** Fila horizontal de "label: value" inline. Usada dentro de `SaleColumn`
 *  para mostrar 2-3 datos read-only en una sola línea, separados por gap.
 *  Hace `flex-wrap` en mobile cuando no entran. */
function InfoLineRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px]">
      {children}
    </div>
  );
}

/** Item de `InfoLineRow`: `label: value` en línea. Si `highlight`, el value
 *  se renderiza en font-semibold (para destacar "Valor venta"). El parámetro
 *  `className` permite tonalidad (ej. tonalidad del margen en Rentabilidad). */
function InfoItem({
  label,
  value,
  highlight,
  className,
}: {
  label:     string;
  value:     React.ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-muted">{label}:</span>
      <span
        className={cn(
          "tabular-nums",
          highlight ? "font-semibold text-text" : "text-text/90",
          className,
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Campo numérico stacked: label ARRIBA (text-[9px] uppercase), input
 *  compacto debajo, sufijo opcional a la derecha del input. Pensado
 *  para alinear varios inputs uno al lado del otro con poco gap dentro
 *  de cada `SaleColumn` (ej. Gramos · Merma, Valor · Bonificación).
 *
 *  Estructura:
 *    LABEL
 *    [ input ] suf
 *
 *  El input tiene un ancho fijo (`w-[126px]`) — coincide con el de
 *  `BonifValue compact` para que los 4 inputs del panel se vean del
 *  mismo tamaño. El componente entero es `inline-block` / `shrink-0`
 *  para que el contenedor padre pueda usar `flex gap-3` y los acerque
 *  sin separarlos con `justify-between`. */
function InlineNumberField({
  label,
  value,
  onChange,
  decimals,
  suffix,
  readOnly,
  step,
}: {
  label:     string;
  value:     number;
  onChange:  (v: number | null) => void;
  decimals?: number;
  suffix?:   string;
  readOnly?: boolean;
  /** Incremento que aplica al usar ↑/↓ o el spinner del input.
   *  Default `undefined` → TPNumberInput usa el step por default (típicamente 1).
   *  Pasar valores fraccionales (ej. 0.05) para granularidad fina. */
  step?:     number;
}) {
  return (
    <div className="shrink-0">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/70">
        {label}
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <div className="w-[126px] shrink-0">
          <TPNumberInput
            value={value}
            onChange={onChange}
            decimals={decimals}
            min={0}
            compact
            readOnly={readOnly}
            {...(step != null ? { step } : {})}
          />
        </div>
        {suffix && (
          <span className="w-3 shrink-0 text-[9px] text-muted/70">{suffix}</span>
        )}
      </div>
    </div>
  );
}

/** Valor read-only con estilo discreto (sin caja). */
function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] font-medium text-text/90">{children}</span>
  );
}

/** Valor numérico editable con sufijo opcional (g / %). */
function NumberValue({
  value,
  onChange,
  decimals,
  suffix,
  readOnly,
}: {
  value:     number;
  onChange:  (v: number | null) => void;
  decimals?: number;
  suffix?:   string;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-[140px] shrink-0">
        <TPNumberInput
          value={value}
          onChange={onChange}
          decimals={decimals}
          min={0}
          compact
          readOnly={readOnly}
        />
      </div>
      {suffix && (
        <span className="shrink-0 text-[10px] text-muted/70">{suffix}</span>
      )}
    </div>
  );
}

/** Stat del resumen — label arriba, contenido abajo, hint opcional. */
function SummaryStat({
  label,
  hint,
  children,
}: {
  label:    string;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/70">
        {label}
      </div>
      <div className="mt-0.5 text-[12px]">{children}</div>
      {hint && <div className="text-[9px] text-muted/60">{hint}</div>}
    </div>
  );
}

/**
 * Bonificación/recargo por componente para el bloque (Hechura / Producto /
 * Servicio). Lee `manualDiscount` con `appliesTo` igual al componente y al
 * editar manda el override con el `appliesTo` correspondiente. El frontend
 * NO calcula precios; solo expone overrides al motor.
 */
function BonifValue({
  line,
  appliesTo,
  onApply,
  compact,
}: {
  line:      DocumentLine;
  appliesTo: AppliesTo;
  onApply:   (patch: LineOverridePatch) => void;
  /** Si true, el TPNumberInput usa el ancho compacto (`w-[126px]`)
   *  para igualarse a los otros inputs del panel sale view (Gramos /
   *  Merma / Valor en `InlineNumberField`). Default false → mantiene
   *  el ancho original de 140px que usan las pantallas legacy. */
  compact?: boolean;
}) {
  const md = line.pricingMeta?.manualDiscount ?? null;
  const matches = md && (md.appliesTo ?? "TOTAL") === appliesTo;
  const current =
    matches && md
      ? (md.mode === "PERCENT" ? md.value : 0)
      : 0;

  const [local, setLocal] = useState<number>(current);
  useEffect(() => { setLocal(current); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [current, line.id]);

  const debouncedRef = useRef<number | null>(null);
  function commit(next: number) {
    setLocal(next);
    if (debouncedRef.current) window.clearTimeout(debouncedRef.current);
    debouncedRef.current = window.setTimeout(() => {
      onApply({
        manualDiscount: next > 0
          ? { mode: "PERCENT", value: next, appliesTo }
          : (matches ? null : (md ?? null)),
      });
    }, 400);
  }

  return (
    <div className="flex items-center gap-1">
      <div className={cn("shrink-0", compact ? "w-[126px]" : "w-[140px]")}>
        <TPNumberInput
          value={local}
          onChange={(v) => commit(Math.max(0, v ?? 0))}
          decimals={2}
          min={0}
          compact
        />
      </div>
      <span className="shrink-0 text-[10px] text-muted/70">%</span>
    </div>
  );
}

export default LineAdvancedOverridesPanel;
