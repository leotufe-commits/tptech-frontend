// src/components/ui/TPBalanceBreakdownKpis.tsx
// ============================================================================
// TPBalanceBreakdownKpis — KPIs visuales de saldo del cliente.
//
// Componente PRESENTACIONAL puro. NO calcula nada — solo recibe data ya
// resuelta (closingBalance del account-statement + composition opcional para
// enriquecer nombres/purezas de metales) y la formatea en cards al estilo
// del Simulador.
//
// Reutilizable en:
//   - PricingCompare (integrado)
//   - VentasFacturas (Fase 3 — futura)
//   - PricingSimulator (futuro, si hace falta mostrar saldo del cliente)
//
// Reglas:
//   1. Cero aritmética monetaria. Solo `toLocaleString` y agregaciones de
//      display (suma de gramos del mismo metal, etc.).
//   2. NO mezcla gramos con dinero — los muestra siempre en bloques
//      separados aunque el cliente sea UNIFIED.
//   3. Si falta data, render minimal con "Sin movimientos" — nunca lanza.
//   4. No depende de páginas concretas — props limpias.
// ============================================================================

import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

/** Closing balance del account-statement: metal por metalId, hechura por
 *  código de moneda. Estructura idéntica a la del backend. */
export type TPClosingBalance = {
  metal:   Record<string, number>;
  hechura: Record<string, number>;
};

/** Composición opcional para enriquecer la card METAL con nombre + pureza
 *  cuando el caller tiene esa info (típicamente sale de
 *  `composition.metal` del response del preview). */
export type TPMetalCompositionForBalance = {
  metalName?:        string | null;
  purityLabel?:      string | null;
  purity?:           number | null;
  appliedGrams?:     number | null;
  originalGrams?:    number | null;
  appliedMermaPct?:  number | null;
  originalMermaPct?: number | null;
} | null | undefined;

/** Composición opcional de hechura — para mostrar el monto aplicado de la
 *  línea actual además del saldo. */
export type TPHechuraCompositionForBalance = {
  appliedAmount?:  number | null;
  originalAmount?: number | null;
  appliesTo?:      string | null;
} | null | undefined;

/** Catálogo opcional metalId → {nombre, símbolo}. Cuando el caller lo
 *  provee, la card METALES muestra el nombre legible en vez del id. */
export type TPMetalCatalog = Record<string, { name: string; symbol?: string }>;

export type TPBalanceBreakdownKpisProps = {
  /** Modo a renderizar. El caller decide cómo se resuelve cuando es
   *  "según cliente" (debe pasar el modo efectivo ya elegido). */
  balanceType?: "UNIFIED" | "BREAKDOWN" | string | null;

  /** Saldo de cierre del cliente — del endpoint /account-statement. */
  closingBalance?: TPClosingBalance | null;

  /** Composición de la línea (opcional, para enriquecer la card METAL). */
  metalComposition?:   TPMetalCompositionForBalance;
  hechuraComposition?: TPHechuraCompositionForBalance;

  /** Catálogo opcional para resolver metalId → nombre legible. */
  metalCatalog?: TPMetalCatalog;

  /** Símbolo monetario default (para formatear hechura sin código de moneda
   *  específico). El componente igual antepone el código de moneda real
   *  cuando viene en `closingBalance.hechura` (clave = código). */
  currencySymbol?: string;

  /** Hint de layout. */
  mode?: "compare" | "invoice" | "simulator";

  /** Etiqueta opcional del bloque entero (default: "Saldo"). */
  title?: string;

  /** Texto secundario cuando no hay nada útil. */
  emptyText?: string;

  /** Información opcional de contexto: balanceType REAL del cliente. Cuando
   *  difiere de `balanceType` (porque el operador forzó la vista), se
   *  muestra una nota ámbar aclarando. */
  clientBalanceTypeRaw?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Formato (puro)
// ─────────────────────────────────────────────────────────────────────────────

function fmtMoneyLocal(v: number | null | undefined, sym?: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const formatted = v.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return sym ? `${sym} ${formatted}` : formatted;
}

function fmtGrams(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("es-AR", { maximumFractionDigits: 4 })} g`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}

/** Merma siempre 3 decimales (regla 0.000), alineado con el Simulador. */
function fmtMermaPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes (no exportados)
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  heading,
  children,
}: { heading: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-3 text-xs">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {heading}
      </div>
      {children}
    </div>
  );
}

function KpiRow({
  label, value, sub,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <div className="text-muted">{label}</div>
      <div className="tabular-nums">
        {value}
        {sub && <span className="ml-1 text-[10px] text-muted/60">{sub}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function TPBalanceBreakdownKpis(props: TPBalanceBreakdownKpisProps) {
  const {
    balanceType,
    closingBalance,
    metalComposition,
    hechuraComposition,
    metalCatalog,
    currencySymbol,
    mode = "simulator",
    title = "Saldo",
    emptyText = "Sin movimientos.",
    clientBalanceTypeRaw,
  } = props;

  const isBreakdown = balanceType === "BREAKDOWN";
  // Cualquier otro valor (UNIFIED, null, "", etc.) cae a vista unificada.
  const sym = currencySymbol ?? "";

  const metalEntries   = Object.entries(closingBalance?.metal   ?? {});
  const hechuraEntries = Object.entries(closingBalance?.hechura ?? {});
  const totalGrams     = metalEntries.reduce(
    (s, [, g]) => s + (Number.isFinite(Number(g)) ? Number(g) : 0),
    0,
  );

  const hasAnyMovement = metalEntries.length > 0 || hechuraEntries.length > 0;

  // Hint visual: cuando se fuerza un modo distinto al real del cliente,
  // mostramos nota ámbar para QA.
  const forcedDifferent =
    !!clientBalanceTypeRaw
    && !!balanceType
    && clientBalanceTypeRaw !== balanceType;

  // Layout: compare = 1 columna apilada, otros = 2 columnas md+.
  const gridCls = mode === "compare"
    ? "grid grid-cols-1 gap-2"
    : "grid grid-cols-1 gap-2 md:grid-cols-2";

  return (
    <div>
      {(title || forcedDifferent) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {title && (
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {title}
            </div>
          )}
          {balanceType && (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
              {balanceType}
            </span>
          )}
          {forcedDifferent && (
            <span
              className="text-[10px] italic text-amber-500"
              title="Vista forzada; el cliente está configurado distinto"
            >
              (cliente real: {clientBalanceTypeRaw})
            </span>
          )}
        </div>
      )}

      {!hasAnyMovement && (
        <div className="rounded-md border border-dashed border-border/60 bg-card/40 p-3 text-xs italic text-muted/70">
          {emptyText}
        </div>
      )}

      {hasAnyMovement && isBreakdown && (
        <div className={gridCls}>
          {/* ── Card METALES ─────────────────────────────────────────────── */}
          <KpiCard heading="Metales">
            {metalEntries.length === 0 ? (
              <div className="italic text-muted/70">Sin movimientos en metal.</div>
            ) : (
              <>
                {/* Encabezado del componente metal cuando viene composition.
                    Solo aplica al primer metal — composition es de UNA línea
                    en el Simulador / Comparador. Para Factura con N líneas,
                    el caller puede pasar metalComposition=null. */}
                {(metalComposition?.metalName || metalComposition?.purityLabel) && (
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <div className="font-semibold text-text">
                      {metalComposition.metalName ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted">
                      {metalComposition.purityLabel ?? ""}
                      {metalComposition.purity != null && (
                        <span className="ml-1 text-muted/60">({metalComposition.purity})</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Lista por metalId del closingBalance. */}
                <ul className="space-y-0.5">
                  {metalEntries.map(([metalId, grams]) => {
                    const meta = metalCatalog?.[metalId];
                    const label = meta?.name
                      ? `${meta.name}${meta.symbol ? ` (${meta.symbol})` : ""}`
                      : metalId;
                    return (
                      <li key={metalId}>
                        <KpiRow
                          label={<span className="text-muted">{label}</span>}
                          value={fmtGrams(Number(grams))}
                          sub="puros"
                        />
                      </li>
                    );
                  })}
                  {metalEntries.length > 1 && (
                    <li className="border-t border-border/40 pt-0.5">
                      <KpiRow
                        label={<span className="font-semibold text-text">Total gramos</span>}
                        value={<span className="font-semibold">{fmtGrams(totalGrams)}</span>}
                      />
                    </li>
                  )}
                </ul>

                {/* Detalle de la línea actual (si vino composition). */}
                {(metalComposition?.appliedGrams != null || metalComposition?.appliedMermaPct != null) && (
                  <div className="mt-2 border-t border-border pt-1 space-y-0.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted">Línea actual</div>
                    {metalComposition.appliedGrams != null && (
                      <KpiRow
                        label="Gramos aplicados"
                        value={fmtGrams(metalComposition.appliedGrams)}
                        sub={metalComposition.originalGrams != null
                          && metalComposition.originalGrams !== metalComposition.appliedGrams
                          ? `orig ${fmtGrams(metalComposition.originalGrams)}`
                          : undefined}
                      />
                    )}
                    {metalComposition.appliedMermaPct != null && (
                      <KpiRow
                        label="Merma aplicada"
                        value={fmtMermaPct(metalComposition.appliedMermaPct)}
                        sub={metalComposition.originalMermaPct != null
                          && metalComposition.originalMermaPct !== metalComposition.appliedMermaPct
                          ? `orig ${fmtMermaPct(metalComposition.originalMermaPct)}`
                          : undefined}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </KpiCard>

          {/* ── Card HECHURA / RESTO ─────────────────────────────────────── */}
          <KpiCard heading="Hechura / Resto">
            {hechuraEntries.length === 0 ? (
              <div className="italic text-muted/70">Sin movimientos en hechura.</div>
            ) : (
              <ul className="space-y-0.5">
                {hechuraEntries.map(([currency, amount]) => (
                  <li key={currency}>
                    <KpiRow
                      label={<span className="text-muted">{currency}</span>}
                      value={fmtMoneyLocal(Number(amount), currency || sym)}
                    />
                  </li>
                ))}
              </ul>
            )}

            {/* Detalle de hechura de la línea actual (si vino composition). */}
            {(hechuraComposition?.appliedAmount != null
              || hechuraComposition?.originalAmount != null
              || hechuraComposition?.appliesTo) && (
              <div className="mt-2 border-t border-border pt-1 space-y-0.5">
                <div className="text-[10px] uppercase tracking-wide text-muted">Línea actual</div>
                {hechuraComposition?.appliesTo && (
                  <KpiRow label="Aplica a" value={hechuraComposition.appliesTo} />
                )}
                {hechuraComposition?.appliedAmount != null && (
                  <KpiRow
                    label="Importe hechura"
                    value={fmtMoneyLocal(hechuraComposition.appliedAmount, sym)}
                    sub={hechuraComposition.originalAmount != null
                      && hechuraComposition.originalAmount !== hechuraComposition.appliedAmount
                      ? `orig ${fmtMoneyLocal(hechuraComposition.originalAmount, sym)}`
                      : undefined}
                  />
                )}
              </div>
            )}
          </KpiCard>
        </div>
      )}

      {hasAnyMovement && !isBreakdown && (
        <KpiCard heading="Saldo unificado">
          {hechuraEntries.length === 0 && metalEntries.length === 0 ? (
            <div className="italic text-muted/70">{emptyText}</div>
          ) : (
            <>
              <ul className="space-y-0.5 tabular-nums">
                {hechuraEntries.map(([currency, amount]) => (
                  <li key={`uni-${currency}`}>
                    <KpiRow
                      label={<span className="text-muted">Total {currency}</span>}
                      value={fmtMoneyLocal(Number(amount), currency || sym)}
                    />
                  </li>
                ))}
              </ul>

              {/* Gramos agregados — SEPARADOS del bloque monetario, con nota
                  explicando que NO se mezclan con el total. */}
              {metalEntries.length > 0 && (
                <div className="mt-2 border-t border-border pt-1 space-y-0.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted">Metal (referencia, no se suma con dinero)</div>
                  <KpiRow
                    label="Gramos puros (todos los metales)"
                    value={fmtGrams(totalGrams)}
                  />
                </div>
              )}

              <div className="mt-1 text-[10px] italic text-muted/70">
                Vista unificada: amounts sumados por moneda; gramos como referencia separada.
              </div>
            </>
          )}
        </KpiCard>
      )}
    </div>
  );
}
