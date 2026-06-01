// src/components/sales/TotalDelComprobanteCard/TotalDelComprobanteCard.tsx
// =============================================================================
// Etapa B — Card maestro "Total del comprobante".
//
// Fusiona en un único card jerárquico:
//   - TotalsHeroSection      → Total grande + (interno) desglose monetario.
//   - TPBalanceModeSelector  → selector inline integrado en el header.
//   - TPSaleBalanceSummary   → bloque metales (BREAKDOWN) + components.
//
// READ-ONLY. Cero matemática nueva: todo es passthrough de:
//   · `totalDocument`               → `backendPreview.result.total`
//   · `balanceMode` / `Source`      → `backendPreview.result.balance*`
//   · `balanceBreakdown.metals[]`   → `balanceBreakdown.metals` del backend
//   · `balanceBreakdown.monetaryBalance.components[]` → del backend
//
// El orchestrator es DELGADO: deriva el modo, agrupa via helper puro y
// compone los `parts/`. La fila "Total" queda SOLO en el header — el
// `MonetarySummary` no la repite (regla: no duplicar el Total maestro).
//
// Estructura:
//
//   ┌─ Card ────────────────────────────────────────┐
//   │ TOTAL DEL COMPROBANTE        [ Saldo ▾ ]      │
//   │ ARS 1.210,00                                  │
//   │ Modo: Desglosado · Tienda Online · Lista A    │
//   │ ────────────────────────────────────────────  │
//   │ METALES                                       │  ← solo BREAKDOWN
//   │   Oro Fino           4,200 gr                 │
//   │   Plata              2,640 gr                 │
//   │ ────────────────────────────────────────────  │
//   │ ▾ Desglose                                    │  ← collapsible
//   │   Hechura                                     │
//   │     Hechura          ARS 1.000,00             │
//   │   Impuestos                                   │
//   │     IVA              ARS 210,00               │
//   │   ...                                         │
//   └───────────────────────────────────────────────┘
// =============================================================================

import type { ReactElement } from "react";
import { useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { vt } from "../../../lib/pricing/visualTokens";
import { formatByType } from "../../../lib/pricing/format";
import { CardHeader }              from "./parts/CardHeader";
import { BalanceModeInline }       from "./parts/BalanceModeInline";
import { MonetarySummary }         from "./parts/MonetarySummary";
import { MetalsSummary }           from "./parts/MetalsSummary";
import { ManualAdjustmentSection } from "./parts/ManualAdjustmentSection";
import { OriginTooltip }           from "./parts/OriginTooltip";
import { RoundingDiagnosticsSection } from "./parts/RoundingDiagnosticsSection";
import { useDesgloseOpen }   from "./hooks/useDesgloseOpen";
import {
  groupComponentsByGroup,
  resolveCardMetals,
  resolveMonetaryHeaderAmount,
} from "./helpers";
import type {
  TotalDelComprobanteCardProps,
  BalanceMode,
} from "./types";

export function TotalDelComprobanteCard({
  totalDocument,
  currencyCode,
  balanceMode,
  balanceModeSource,
  balanceBreakdown,
  balanceModeOverride,
  onBalanceModeOverrideChange,
  overrideDisabled,
  channelName,
  priceListName,
  lineArticleNames,
  commercialMetalValueSum,
  commercialMetalValueByParent,
  documentMetals,
  hechuraLines,
  subtotalCommercial,
  taxableBase,
  documentRoundingApplied,
  engineTotal,
  manualAdjustment,
  manualAdjustmentDraft,
  onManualAdjustmentChange,
  manualAdjustmentDisabled,
  // Etapa 3A — campos canónicos top-level (paridad con backend Etapa 1+2).
  // El orchestrator los prefiere sobre los aliases deprecated; si el caller
  // todavía pasa los legacy, hace fallback transparente.
  documentRoundingSnapshot,
  manualAdjustmentSnapshot,
  // Etapa D' — Snapshot del REDONDEO COMERCIAL PER_DOCUMENT (capa nueva
  // post-tax, pre-shipping/payment del motor). PURA LECTURA — el card
  // lo propaga a la sección de diagnóstico que lo renderiza tal cual.
  commercialDocumentRoundingSnapshot,
  // F1 — Detalle del redondeo COMERCIAL PHYSICAL aplanado por línea.
  // El caller (`VentasFacturas`) hace flatMap puro y nos pasa el array.
  commercialPhysicalRoundedMetals,
  className,
  commercialStatus,
}: TotalDelComprobanteCardProps): ReactElement {
  // ── Etapa 3A — resolución de fuentes canónicas ──────────────────────────
  // Reference aliasing del backend (Etapa 1.1/1.2): los snapshots top-level
  // apuntan al MISMO objeto que los paths viejos. Si VentasFacturas todavía
  // pasa solo los legacy, caemos al alias deprecated — observable en los logs
  // DEV (línea siguiente). Cuando el caller pase los top-level, los logs
  // mostrarán los DOS coincidiendo.
  const docRoundingResolved =
    documentRoundingSnapshot ?? documentRoundingApplied ?? null;
  const manualResolved =
    manualAdjustmentSnapshot ?? manualAdjustment ?? null;

  // ── Etapa 3A — logs DEV de observabilidad ────────────────────────────────
  // Loguean los 4 campos canónicos cada vez que cambian. Permiten verificar
  // que el frontend recibe los snapshots persistidos por backend. Gateados
  // por DEV — en producción no se ejecutan.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // eslint-disable-next-line no-console
    console.groupCollapsed("[FACT-DIAG] TotalDelComprobanteCard — snapshots backend");
    // eslint-disable-next-line no-console
    console.log("engineTotal:               ", engineTotal);
    // eslint-disable-next-line no-console
    console.log("totalDocument (=finalTotal):", totalDocument);
    // eslint-disable-next-line no-console
    console.log("manualAdjustmentSnapshot:  ", manualAdjustmentSnapshot ?? "(top-level no llegó, usando alias)");
    // eslint-disable-next-line no-console
    console.log("manualAdjustment (legacy): ", manualAdjustment);
    // eslint-disable-next-line no-console
    console.log("documentRoundingSnapshot:  ", documentRoundingSnapshot ?? "(top-level no llegó, usando alias)");
    // eslint-disable-next-line no-console
    console.log("documentRoundingApplied:   ", documentRoundingApplied);
    // eslint-disable-next-line no-console
    console.log("balanceMode:               ", balanceMode);
    // eslint-disable-next-line no-console
    console.log("aliasMatch (manual):       ", manualAdjustmentSnapshot === manualAdjustment ? "✅ misma ref" : "⚠️ distinta o ausente");
    // eslint-disable-next-line no-console
    console.log("aliasMatch (rounding):     ", documentRoundingSnapshot === documentRoundingApplied ? "✅ misma ref" : "⚠️ distinta o ausente");
    // eslint-disable-next-line no-console
    console.groupEnd();
  }, [
    engineTotal,
    totalDocument,
    manualAdjustmentSnapshot,
    manualAdjustment,
    documentRoundingSnapshot,
    documentRoundingApplied,
    balanceMode,
  ]);
  // ── Metales del comprobante (normalizados) ──────────────────────────────
  // Prioridad de fuentes (ver `resolveCardMetals`):
  //   1. Redondeo físico ACTIVO (Etapa D, capa 16) → SIEMPRE
  //      `balanceBreakdown.metals[]` (autoridad backend con `gramsPure` ya
  //      redondeado por `applyDocumentPhysicalRounding`). `documentMetals`
  //      vendría con los gramos crudos derivados de las líneas — la capa 16
  //      NO los toca, por eso ese camino mostraría `1,044 g` cuando el
  //      backend persistió `1,000 g`.
  //   2. Sin redondeo físico → `documentMetals` derivado de líneas (paridad
  //      EXACTA con el mini-desglose por línea).
  //   3. Fallback → `balanceBreakdown.metals[]` (snapshot sin `lines`).
  // Sirve también al editor de Ajuste Manual BREAKDOWN: `breakdownMetals`
  // se mapea desde `resolvedMetals` (ver más abajo), así el `preGrams` del
  // editor también arranca desde el postGrams cuando aplica.
  const resolvedMetals = resolveCardMetals(
    balanceBreakdown,
    documentMetals,
    docRoundingResolved,
    // Opción C — passthrough del snapshot COMERCIAL PHYSICAL para que el
    // helper overridee `gramsPure` por `postGrams` cuando el redondeo
    // comercial por línea actuó. Sin esto, el Patrimonio Metálico seguiría
    // mostrando `metalGramsSale` (lado venta) en vez de gramos físicos.
    commercialPhysicalRoundedMetals,
    // Etapa D' (cierre conceptual) — FUENTE ÚNICA DE VERDAD para los gramos
    // del Patrimonio Metálico cuando existe Redondeo Comercial PER_DOCUMENT
    // BREAKDOWN. Si llega, el helper override `grams` por `postGrams`
    // agrupado por `metalParentName` (legible, post-fix backend). Passthrough
    // puro — cero matemática FE.
    commercialDocumentRoundingSnapshot,
  );
  const hasMetals      = resolvedMetals.length > 0;

  // ── Modo efectivo (Etapa C/D3 — corrección de bug visual) ────────────────
  // Regla canónica: el "modo" del card refleja LO QUE SE ESTÁ MOSTRANDO al
  // operador, no el `balanceMode` crudo del backend.
  //
  // Si hay metales visibles (`hasMetals` derivado de
  // `balanceBreakdown.metals[]` o de `documentMetals` por línea), el
  // comprobante OPERA visualmente en BREAKDOWN — el editor de ajuste manual,
  // el label del selector inline y el desglose deben alinearse con eso.
  //
  // Antes el código leía `balanceMode ?? (metals.length > 0 ? BREAKDOWN :
  // UNIFIED)` y por eso, cuando el backend devolvía `balanceMode="UNIFIED"`
  // (caso típico cuando el tenant no configuró el Balance Mode), el card
  // mostraba "Patrimonio metálico" pero el editor de ajuste manual quedaba
  // en UNIFIED y el label decía "Unificado" — desalineación visual con la
  // realidad operativa.
  //
  // Si no hay metales visibles, fallback al `balanceMode` del backend
  // (UNIFIED por default) — comportamiento sin metales no se altera.
  const mode: BalanceMode = hasMetals
    ? "BREAKDOWN"
    : (balanceMode ?? "UNIFIED");

  // ── Moneda de display ────────────────────────────────────────────────────
  const displayCurrency =
    currencyCode
      ?? balanceBreakdown?.monetaryBalance?.currencyCode
      ?? "";

  // ── Estado del collapse "Desglose" (default según modo) ─────────────────
  const desglose = useDesgloseOpen(mode);

  // ── Agrupación de components (puro) ──────────────────────────────────────
  const groupedComponents = groupComponentsByGroup(
    balanceBreakdown?.monetaryBalance?.components,
  );

  const isBreakdown = mode === "BREAKDOWN";
  const hasMonetaryGroups = groupedComponents.length > 0;

  // ── Importe del header "Saldo monetario" ────────────────────────────────
  // El valor representa SIEMPRE el bucket "no metal" del comprobante:
  //   · BREAKDOWN → passthrough de `monetaryBalance.amount` (el motor ya
  //     restó la valuación metal en `pricing-engine.balance`).
  //   · UNIFIED  → resta visual `total − Σ documentMetals[*].monetaryAmount`,
  //     porque en UNIFIED el motor emite `monetary.amount === documentTotal`
  //     (no resta metales). Usar ese campo directamente duplicaría el Total
  //     del comprobante ya mostrado en el header maestro.
  // Cero matemática comercial: resta de dos valores ya normalizados
  // (`totalDocument` del motor + Σ monto venta consolidado por padre vía
  // `buildMetalParentSaleLines`).
  const monetaryHeaderAmount = resolveMonetaryHeaderAmount(
    mode,
    totalDocument,
    balanceBreakdown,
    resolvedMetals,
    hechuraLines,
  );

  return (
    <section
      className={`${vt.card.outer} ${className ?? ""}`}
      data-testid="total-del-comprobante-card"
    >
      {/* Etapa UX-premium — espaciado vertical aumentado entre bloques
          principales (Hero · Patrimonio · Total hechura · Estado comercial)
          para look financiero premium. Padding lateral `p-2.5` se mantiene
          alineado con la densidad de los otros cards del aside. */}
      <div className="space-y-4 p-2.5">
        {/* HEADER — title + total grande + subheader + selector inline. */}
        <CardHeader
          totalDocument={totalDocument}
          currencyCode={displayCurrency}
          mode={mode}
          channelName={channelName}
          priceListName={priceListName}
          modeSelector={
            <BalanceModeInline
              effectiveMode={mode}
              source={balanceModeSource}
              override={balanceModeOverride}
              disabled={overrideDisabled}
              onChange={onBalanceModeOverrideChange}
            />
          }
        />

        {/* PATRIMONIO METÁLICO — orden visual nuevo (Etapa UX-Tax v2):
            En joyería el metal es el componente PRINCIPAL del valor de la
            pieza. Por eso el bloque se renderiza ARRIBA de la composición
            monetaria (antes iba al pie). Las clases mantienen la jerarquía
            "hermana" con "Total hechura" (mismo `text-xs font-bold`).
            · BREAKDOWN: SIEMPRE se renderiza (aun vacía → mensaje).
            · UNIFIED:  se renderiza SÓLO cuando existen metales; la
              caption aclara que son informativos. */}
        {(isBreakdown || hasMetals) && (
          <section
            className="border-t border-border/20 pt-3 space-y-2"
            data-testid="total-card-metals-section"
            data-mode={mode}
          >
            {/* Header del bloque — mismo nivel jerárquico que "Total hechura".
                Etapa UX-premium: las captions técnicas
                ("Saldo separado · gramos" / "Informativo · gramos") se
                eliminaron — el sufijo "gr" en cada fila + el icon de la
                propia sección (metal por nombre) ya transmiten "patrimonio
                físico". El modo (BREAKDOWN vs UNIFIED) ya tiene su propio
                selector en el header del card; repetirlo acá era ruido. */}
            {/* Etapa UX.32 (2026-05-30) — header del bloque METALES con
                total comercial agregado a la derecha. Antes el total vivía
                como fila al pie del bloque ("Valor comercial del metal");
                ahora se condensa en el header para reducir ruido.
                El valor agregado SOLO se muestra cuando `commercialMetalValueSum`
                viene no-null (rama UX-Comercial §R-Rounding-16). */}
            <header className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-text inline-flex items-center">
                Metales
                {/* UX.33-final — tooltip estilo calculadora: gramos por
                    padre + valor comercial total. Sin texto narrativo. */}
                {typeof commercialMetalValueSum === "number"
                  && Number.isFinite(commercialMetalValueSum)
                  && commercialMetalValueSum > 0
                  && displayCurrency && (
                  <OriginTooltip
                    title="Metales"
                    body={
                      <>
                        {resolvedMetals.map((m) => (
                          <div key={`mtt-g-${m.id}`} className="flex items-baseline justify-between gap-3">
                            <span className="text-muted/80">{m.name}</span>
                            <span className="tabular-nums text-text">
                              {formatByType(m.grams, "METAL_GRAMS")} g
                            </span>
                          </div>
                        ))}
                        <div className="my-1 border-t border-border/30" />
                        <div className="flex items-baseline justify-between gap-3 font-semibold">
                          <span className="text-muted/80">Valor comercial</span>
                          <span className="tabular-nums text-text">
                            {displayCurrency} {formatByType(commercialMetalValueSum, "MONEY")}
                          </span>
                        </div>
                      </>
                    }
                  />
                )}
              </span>
              {typeof commercialMetalValueSum === "number"
                && Number.isFinite(commercialMetalValueSum)
                && commercialMetalValueSum > 0
                && displayCurrency && (
                <span
                  className="tabular-nums text-[12px] font-medium text-muted/80"
                  data-testid="total-card-metals-header-total"
                >
                  {displayCurrency} {formatByType(commercialMetalValueSum, "MONEY")}
                </span>
              )}
            </header>
            <MetalsSummary
              metals={resolvedMetals}
              currencyCode={displayCurrency}
              // I1 — Detalle del redondeo financiero PHYSICAL por metal padre.
              // Passthrough EXACTO del snapshot canónico top-level (capa 16).
              // Cuando la capa no actuó, queda `undefined` y MetalsSummary
              // no renderiza la sub-fila (degradación segura).
              physicalRoundedMetals={
                docRoundingResolved?.breakdown?.metalDomain === "PHYSICAL"
                  ? docRoundingResolved?.breakdown?.metalPhysical?.metals ?? undefined
                  : undefined
              }
              // Etapa UX-Saldo — habilita la sub-fila "Origen" en cada metal
              // padre. Map `lineId → articleName` que el caller arma desde
              // el preview. Si falta, MetalsSummary omite el origen.
              lineArticleNames={lineArticleNames}
              // Etapa UX.32 (2026-05-30) — valor comercial POR PADRE. Cuando
              // se provee, cada metal muestra una sub-fila terciaria "Valor
              // comercial: ARS X". El total agregado vive ahora en el header
              // del bloque (arriba), NO al pie. Si falta, sin sub-fila.
              commercialMetalValueByParent={commercialMetalValueByParent}
            />
          </section>
        )}

        {/* TOTAL HECHURA — collapsible. Por defecto: cerrado en UNIFIED,
            abierto en BREAKDOWN.
            Etapa UX-Tax v2: renombrado de "Saldo en moneda" → "Total hechura"
            con jerarquía visual EQUIVALENTE a "Patrimonio metálico"
            (`text-xs font-bold uppercase tracking-[0.16em]`) para que el
            operador lea las dos secciones como hermanas: gramos (patrimonio)
            arriba, hechura (moneda) abajo. Adentro: subtotal comercial,
            ajustes a la base, impuestos, adicionales post-tax. */}
        {hasMonetaryGroups && (
          <section
            className="border-t border-border/20 pt-3 space-y-2"
            data-testid="total-card-composicion-section"
          >
            {/* Etapa UX-premium v3 — separación clara entre:
                  · FILA PREMIUM SIEMPRE VISIBLE — "Total hechura · ARS xxx"
                    (vista rápida, peso visual hermano de los metales).
                  · SUB-TOGGLE SECUNDARIO — "Ver detalle financiero ▾" que
                    expande el desglose técnico (descuentos, canal, base
                    imponible, IVA, envío, redondeo) sin invadir la vista
                    rápida del card.
                Razón: el detalle financiero pesaba demasiado y competía con
                el Total / Patrimonio metálico. Ahora la lectura rápida es
                limpia y el detalle queda accesible bajo demanda. */}
            {(() => {
              // ── Etapa UX-Comercial (2026-05-30 — POLICY §R-Rounding-16) ────
              // En BREAKDOWN el Saldo Monetario se calcula como
              // `totalDocument − commercialMetalValueSum` (Patrimonio comercial),
              // si el caller pasa `commercialMetalValueSum` (= Σ `metalCost`
              // del documento). Sin él, fallback canónico POLICY §R-Rounding-14
              // (Patrimonio físico via `valuationMonetary`).
              //
              // Garantía matemática: en cualquiera de los dos modos,
              //   Patrimonio + Saldo = Total
              // sin doble contabilización. METAL_MARGIN queda absorbido en el
              // Patrimonio cuando se usa el modo comercial; en modo canónico,
              // METAL_MARGIN aparece como component del detalle.
              //
              // En UNIFIED el header mantiene la fuente histórica
              // (`monetaryHeaderAmount` ya hace la resta total − Σ metales).
              const useCommercial =
                typeof commercialMetalValueSum === "number"
                && Number.isFinite(commercialMetalValueSum);
              const metalDeductionForSaldo: number = useCommercial
                ? (commercialMetalValueSum as number)
                : resolvedMetals.reduce(
                    (acc, m) =>
                      acc + (typeof m.monetaryAmount === "number" && Number.isFinite(m.monetaryAmount)
                        ? m.monetaryAmount
                        : 0),
                    0,
                  );
              // Etapa D' (cierre conceptual) — FUENTE ÚNICA DE VERDAD.
              // Cuando existe `commercialDocumentRoundingSnapshot` con scope
              // BREAKDOWN, el saldo monetario visible es `postRoundingSaldoMonetario`
              // (passthrough del snapshot canónico backend). Reemplaza el
              // cálculo histórico `totalDocument − metalDeductionForSaldo` que
              // reconstruía el saldo en frontend (violación de REGLA DE ORO).
              //
              // Prohibido reconstruir cuando el snapshot existe. Fallback al
              // cálculo legacy SOLO cuando la lista opera en PER_LINE_LEGACY o
              // mixed-list (no hay snapshot doc), para preservar back-compat.
              const snapshotHechuraPost =
                commercialDocumentRoundingSnapshot?.scope === "BREAKDOWN"
                && commercialDocumentRoundingSnapshot?.breakdown?.hechura?.postRoundingSaldoMonetario;
              const saldoMonetarioBreakdown: number | null =
                isBreakdown
                  ? (typeof snapshotHechuraPost === "number" && Number.isFinite(snapshotHechuraPost)
                      ? snapshotHechuraPost
                      : (typeof totalDocument === "number" && Number.isFinite(totalDocument)
                          ? totalDocument - metalDeductionForSaldo
                          : null))
                  : null;
              // Etapa UX.33 (2026-05-30) — Label visible "Hechura total" en
              // ambos modos. La variable interna `saldoMonetarioBreakdown` y
              // los testids `data-tp-header-mode` siguen iguales (cambio
              // UX-only, sin renombrar contratos).
              const headerLabel  = "Hechura total";
              const headerAmount = isBreakdown ? saldoMonetarioBreakdown : monetaryHeaderAmount;
              return (
                <div
                  className="flex items-baseline justify-between gap-3 py-1"
                  data-testid="total-card-hechura-row"
                  data-tp-header-mode={isBreakdown ? "saldo-monetario" : "total-hechura"}
                >
                  <span className="text-[15px] font-medium text-text inline-flex items-center">
                    {headerLabel}
                    {/* UX.33-final — tooltip estilo calculadora: SOLO el monto. */}
                    {headerAmount != null && Number.isFinite(headerAmount) && displayCurrency && (
                      <OriginTooltip
                        title="Hechura total"
                        body={
                          <div className="flex items-baseline justify-between gap-3 font-semibold">
                            <span className="text-muted/80">Total</span>
                            <span className={`tabular-nums ${headerAmount < 0 ? "text-red-500" : "text-text"}`}>
                              {headerAmount < 0 ? "−" : ""}{displayCurrency} {formatByType(Math.abs(headerAmount), "MONEY")}
                            </span>
                          </div>
                        }
                      />
                    )}
                  </span>
                  {headerAmount != null && Number.isFinite(headerAmount) && (
                    <span
                      className={`tabular-nums text-[15px] font-semibold ${
                        headerAmount < 0
                          ? vt.colors.discount
                          : "text-text"
                      }`}
                      data-testid="total-card-monetary-header-amount"
                    >
                      {displayCurrency ? `${displayCurrency} ` : ""}
                      {formatByType(headerAmount, "MONEY")}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Sub-toggle secundario — abre el detalle financiero (descuentos,
                canal, base imponible, IVA, envío, redondeo). Estilo "link
                discreto": no compite con la fila premium. */}
            <button
              type="button"
              onClick={desglose.toggle}
              aria-expanded={desglose.open}
              aria-controls="total-card-composicion-body"
              data-testid="total-card-composicion-toggle"
              className="flex items-center gap-1 text-[11px] text-muted/70 hover:text-text transition-colors"
            >
              <ChevronDown
                size={12}
                aria-hidden="true"
                className={`transition-transform shrink-0 ${desglose.open ? "rotate-180" : ""}`}
              />
              <span>
                {desglose.open ? "Ocultar detalle financiero" : "Ver detalle financiero"}
              </span>
            </button>

            {desglose.open && (
              <div
                id="total-card-composicion-body"
                className="mt-2 rounded-md bg-surface2/30 px-2.5 py-2"
                data-testid="total-card-composicion-body"
              >
                <MonetarySummary
                  groups={groupedComponents}
                  displayCurrency={displayCurrency}
                  // Etapa UX-Tax — filas síntesis: passthrough EXACTO de
                  // `documentTotals.subtotalAfterLineDiscounts` y
                  // `documentTotals.taxableBase`. Si el caller no los pasa,
                  // el `MonetarySummary` los omite (degradación segura).
                  subtotalCommercial={subtotalCommercial}
                  taxableBase={taxableBase}
                  // POLICY §R-Rounding-3 — discrimina rounding lista
                  // (ya incluido en subtotal) vs comprobante (modifica el
                  // total). Passthrough EXACTO del backend, cero matemática.
                  documentRoundingApplied={docRoundingResolved}
                  // Etapa D' (cierre conceptual) — "Resultado monetario":
                  // FUENTE ÚNICA DE VERDAD = snapshot canónico del Redondeo
                  // Comercial PER_DOCUMENT cuando existe.
                  //   · BREAKDOWN con snapshot D' → leer
                  //     `commercialDocumentRoundingSnapshot.breakdown.hechura.postRoundingSaldoMonetario`.
                  //   · BREAKDOWN sin snapshot D' (PER_LINE_LEGACY / mixed-list)
                  //     → fallback al `monetaryBalance.amount` (autoridad
                  //     legacy backend).
                  //   · UNIFIED → null (la fila duplicaría el Total maestro).
                  //
                  // Prohibido reconstruir desde balanceBreakdown / monetaryBalance
                  // cuando el snapshot D' existe — passthrough puro.
                  monetaryResult={
                    isBreakdown
                      ? (commercialDocumentRoundingSnapshot?.scope === "BREAKDOWN"
                          && commercialDocumentRoundingSnapshot?.breakdown?.hechura?.postRoundingSaldoMonetario != null
                          ? commercialDocumentRoundingSnapshot.breakdown.hechura.postRoundingSaldoMonetario
                          : balanceBreakdown?.monetaryBalance?.amount ?? null)
                      : null
                  }
                  // Etapa UX-Comercial (2026-05-30) — Σ "valor del metal a
                  // deducir del total" para que la fila "TOTAL A COBRAR EN $"
                  // del cuerpo expandido cuadre con el "Saldo Monetario" del
                  // header. Si el caller pasa `commercialMetalValueSum`
                  // (Patrimonio comercial), usa ese; sino fallback a Σ
                  // `valuationMonetary` (Patrimonio físico canónico).
                  // En UNIFIED queda null para preservar back-compat.
                  metalsValuationSum={
                    isBreakdown
                      ? (typeof commercialMetalValueSum === "number" && Number.isFinite(commercialMetalValueSum)
                          ? commercialMetalValueSum
                          : resolvedMetals.reduce(
                              (acc, m) =>
                                acc + (typeof m.monetaryAmount === "number" && Number.isFinite(m.monetaryAmount)
                                  ? m.monetaryAmount
                                  : 0),
                              0,
                            ))
                      : null
                  }
                  // Fila de cierre "Total final" — passthrough exacto del
                  // `totalDocument`. El header del card también lo muestra
                  // (grande); aquí va al pie del desglose para que al
                  // expandirlo el operador no pierda el cierre del cálculo.
                  totalDocument={totalDocument}
                  // F1 — Detalle del redondeo COMERCIAL PHYSICAL (por línea).
                  // Passthrough del array aplanado que el caller construye
                  // con flatMap puro desde `preview.lines[i].appliedRounding.physical.metals`.
                  // Si está vacío/undefined, MonetarySummary no renderiza el
                  // bloque (degradación segura).
                  commercialPhysicalMetals={commercialPhysicalRoundedMetals}
                />
              </div>
            )}
          </section>
        )}

        {/* Manual Adjustment Etapa A (POLICY §R-Rounding-1 capa 17) —
            Override comercial humano final. Editor + display de snapshot.
            Si `onManualAdjustmentChange` no se provee → modo read-only y
            la sección solo se renderiza cuando hay snapshot. Si está
            provisto, siempre se muestra (colapsable cuando no hay ajuste).
            Distinguido visualmente del rounding (automático) con
            border-l-2 + caption "Intervención humana".

            Cero matemática local: el editor solo emite la INTENCIÓN; el
            backend re-corre `buildManualAdjustmentSnapshot` y devuelve los
            valores que el card pinta. */}
        <ManualAdjustmentSection
          mode={mode}
          draft={manualAdjustmentDraft}
          snapshot={manualResolved}
          engineTotal={engineTotal}
          displayCurrency={displayCurrency}
          // En BREAKDOWN derivamos la lista de metales del documento desde
          // los `resolvedMetals` ya consolidados (Σ gramsPure × purity por
          // metal padre). Si no hay metales (UNIFIED sin metales o BREAKDOWN
          // sin datos), pasamos lista vacía y el editor solo muestra la fila
          // de Hechura. Cero matemática nueva: passthrough.
          breakdownMetals={
            mode === "BREAKDOWN"
              ? resolvedMetals.map((m) => ({
                  metalParentId:   m.id ?? null,
                  metalParentName: m.name,
                  preGrams:        m.grams,
                }))
              : []
          }
          onChange={onManualAdjustmentChange}
          disabled={manualAdjustmentDisabled}
        />

        {/* Etapa 3A — Diagnóstico DEV-only de redondeos y ajustes.
            Sección paralela que muestra los 3 mecanismos (Comercial /
            Financiero / Manual) lado a lado para verificar que el frontend
            recibe los snapshots persistidos por backend byte-a-byte. Solo
            visible en desarrollo (`import.meta.env.DEV`). */}
        <RoundingDiagnosticsSection
          financialSnapshot={docRoundingResolved}
          manualSnapshot={manualResolved}
          commercialDocSnapshot={commercialDocumentRoundingSnapshot ?? null}
          engineTotal={engineTotal}
          finalTotal={totalDocument}
          displayCurrency={displayCurrency}
        />

        {/* Etapa UX.33-final (2026-05-30) — Bloque "Estado comercial"
            ELIMINADO. La info de riesgo / margen bajo / crítico ya viene
            cubierta por:
              · warning per-línea (TPDocumentLineAdvancedEditor)
              · warning del card de composición
              · warning superior de política comercial
            La fila redundante acá saturaba el aside sin aportar.
            El prop `commercialStatus` se mantiene en el API por back-compat
            con callers que lo siguen pasando — passthrough sin render. */}
      </div>
    </section>
  );
}

export default TotalDelComprobanteCard;
