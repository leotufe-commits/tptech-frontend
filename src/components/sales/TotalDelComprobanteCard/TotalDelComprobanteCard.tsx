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
import { useEffect, useMemo } from "react";
import { ChevronDown, Info } from "lucide-react";
import { vt } from "../../../lib/pricing/visualTokens";
import { formatByType } from "../../../lib/pricing/format";
import { CardHeader }              from "./parts/CardHeader";
import { BalanceModeInline }       from "./parts/BalanceModeInline";
import { MonetarySummary }         from "./parts/MonetarySummary";
import { MetalsSummary }           from "./parts/MetalsSummary";
import { ManualAdjustmentSection } from "./parts/ManualAdjustmentSection";
import { OriginTooltip }           from "./parts/OriginTooltip";
import { TraceTooltipBody }        from "./parts/TraceTooltipBody";
import type { ComponentTrace }     from "./traceability";
import { RoundingDiagnosticsSection } from "./parts/RoundingDiagnosticsSection";
import { useDesgloseOpen }   from "./hooks/useDesgloseOpen";
import {
  groupComponentsByGroup,
  resolveCardMetals,
  resolveMonetaryHeaderAmount,
  aggregateMetalFinalByParent,
} from "./helpers";
import type { MetalFinalRow } from "./helpers";
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
  priceListMixed,
  lineArticleNames,
  commercialMetalValueSum,
  commercialMetalValueByParent,
  metalSaleByParent,
  metalSalePreByParent,
  metalVisibleGramsByParent,
  commercialMonetarySaldoSum,
  commercialMonetaryRoundingImpactSum,
  commercialMetalRoundingImpactSum,
  commercialRoundingByParentFromLines,
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
  componentTraces,
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

  // ── SSOT card ↔ footer (2026-06) — GRAMO PRINCIPAL = el del card ─────────
  // El gramo protagonista de METALES debe ser EXACTAMENTE el que el card del
  // artículo decidió mostrar (Σ `visibleGrams` ?? `gramsEquivLine`,
  // `metalVisibleGramsByParent`), NO `saleEquivGr`/`displayGrams` (que diverge
  // cuando la lista aplica redondeo comercial PER_DOCUMENT — card mostraba el
  // físico redondeado y el footer el equivalente de venta). Override SOLO del
  // campo `displayGrams` por NOMBRE de padre; el físico `grams` queda intacto
  // (cuenta corriente metálica, sub-filas de redondeo físico, ajuste manual
  // BREAKDOWN). Passthrough puro — cero recálculo. Sin el prop (snapshot legacy
  // / sin líneas) se preserva `resolvedMetals` tal cual (back-compat). Esta
  // copia alimenta ÚNICAMENTE el render de `MetalsSummary`.
  const metalsForDisplay = useMemo(() => {
    if (!metalVisibleGramsByParent) return resolvedMetals;
    const byName = new Map<string, number>();
    for (const [name, g] of Object.entries(metalVisibleGramsByParent)) {
      if (typeof g === "number" && Number.isFinite(g)) {
        byName.set(name.trim().toLowerCase(), g);
      }
    }
    if (byName.size === 0) return resolvedMetals;
    return resolvedMetals.map((m) => {
      const v = byName.get((m.name ?? "").trim().toLowerCase());
      return typeof v === "number" && Number.isFinite(v)
        ? { ...m, displayGrams: v }
        : m;
    });
  }, [resolvedMetals, metalVisibleGramsByParent]);

  // ── Fase 1 (2026-06) — Metal a VALOR DE VENTA vía prop explícito ─────────
  // `metalSaleByParent` (venta, derivado de líneas por el caller) tiene
  // PRIORIDAD sobre `commercialMetalValueByParent` (COSTO). El gate es la
  // PRESENCIA del prop con valor finito > 0 — NO el ambiguo `m.monetaryAmount`
  // (que era venta o valuación física según el origen). Sin el prop (snapshot
  // legacy / balanceBreakdown / sin líneas) se degrada a COSTO, preservando
  // EXACTAMENTE el comportamiento previo.
  const metalSaleSum: number | null = metalSaleByParent
    ? Object.values(metalSaleByParent).reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0)
    : null;
  const hasMetalSale = metalSaleSum != null && Number.isFinite(metalSaleSum) && metalSaleSum > 0;
  // Σ resolvedMetals.monetaryAmount — fallback legacy SOLO para deducción del
  // saldo / valuationSum (NO para display). Preserva el comportamiento previo
  // cuando no hay `commercialMetalValueSum`.
  const metalMonetarySum = resolvedMetals.reduce(
    (acc, m) =>
      acc + (typeof m.monetaryAmount === "number" && Number.isFinite(m.monetaryAmount)
        ? m.monetaryAmount
        : 0),
    0,
  );
  // DISPLAY (header del bloque + sub-fila por metal): VENTA → COSTO. Sin
  // fallback a la valuación física (el display siempre fue costo-o-ausente).
  const metalDisplayByParent = hasMetalSale ? metalSaleByParent : commercialMetalValueByParent;
  const metalDisplaySum: number | null = hasMetalSale
    ? metalSaleSum
    : (typeof commercialMetalValueSum === "number" && Number.isFinite(commercialMetalValueSum)
        ? commercialMetalValueSum
        : null);
  // ── Opción 1 (2026-06) — REDISTRIBUCIÓN VISUAL del redondeo COMERCIAL del
  // metal: su delta (PER_DOCUMENT BREAKDOWN) deja de absorberse en MONETARIO y
  // pasa a vivir en METALES. Σ delta por padre === breakdown.metalMonetaryEquivalent
  // (conservación garantizada por el backend). Passthrough puro: el front
  // SELECCIONA el campo y lo COMPONE para display; no recalcula el redondeo.
  // En UNIFIED / sin snapshot el delta es 0 → comportamiento idéntico al previo.
  // Fuente: snapshot document-level (PER_DOCUMENT puro) tiene PRIORIDAD; si no
  // existe (MIXED → snapshot null), se cae al consolidado POR LÍNEAS que el
  // caller derivó de `lineCommercialSummary.metals.byParent[].roundingImpact`.
  // Así el header POST, la deducción del saldo y las filas per-metal quedan
  // consistentes también en MIXED. Passthrough puro — cero recálculo.
  const metalCommercialRoundingByParent: Readonly<Record<string, number>> | undefined =
    commercialDocumentRoundingSnapshot?.scope === "BREAKDOWN"
      ? Object.fromEntries(
          (commercialDocumentRoundingSnapshot.breakdown?.metals ?? [])
            .filter(
              (mm) =>
                typeof mm?.monetaryEquivalent === "number" &&
                Number.isFinite(mm.monetaryEquivalent),
            )
            .map((mm) => [mm.metalParentName, mm.monetaryEquivalent] as const),
        )
      : commercialRoundingByParentFromLines;
  // DEDUCCIÓN del saldo (fallback UNIFICADO / sin finalRows): VENTA → COSTO →
  // Σ monetaryAmount (legacy). En BREAKDOWN se reemplaza por `metalFinalTotal`
  // (Etapa 2C — ver más abajo, tras resolver `isBreakdown`).
  const metalDeductionForSaldoBasePre: number = hasMetalSale
    ? (metalSaleSum as number)
    : (typeof commercialMetalValueSum === "number" && Number.isFinite(commercialMetalValueSum)
        ? commercialMetalValueSum
        : metalMonetarySum);

  // ── Modo de saldo (SSOT 2026-06-03 — lector puro de `balanceMode`) ───────
  // El modo SIEMPRE proviene del backend (`resolveSaleBalanceMode`, jerarquía
  // R11.4): override del documento → cliente → lista → tenant → fallback
  // UNIFIED. El frontend NO lo deriva.
  //
  // CRÍTICO: mostrar metales NO cambia el modo. Un comprobante puede ser
  // `UNIFIED` y aun así mostrar Metales / Hechura / Valor comercial como
  // INFORMACIÓN VISUAL — la sección METALES se renderiza con
  // `isBreakdown || hasMetals`, así que sigue visible en UNIFIED.
  //
  // Antes esta línea forzaba `BREAKDOWN` cuando había metales visibles
  // (`hasMetals ? "BREAKDOWN" : balanceMode`). Eso creaba una SEGUNDA fuente
  // de verdad: el label decía "Desglosado" mientras el motor calculaba los
  // totales en `UNIFIED` (y `TPSaleAccountImpactCard` mostraba "Unificado").
  // Doble fuente eliminada — el card es lector puro del `balanceMode` del
  // preview, idéntico al que usan los totales, la confirmación y el card de
  // Impacto en cuenta corriente.
  const mode: BalanceMode = balanceMode ?? "UNIFIED";

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

  // ── Etapa 2C — Valor Final Metal real (solo DESGLOSADO) ──────────────────
  // Consolida por metal padre los CUATRO mecanismos (todos en moneda):
  //   finalMetalValue = valor comercial + redondeo comercial + redondeo
  //                     financiero (capa 16 PHYSICAL) + ajuste manual (gramos).
  // Agregación PURA: el frontend SOLO suma los `monetaryEquivalent` que el
  // backend ya emitió. NO multiplica gramos × cotización, NO aplica margen.
  // El ajuste manual de metal sigue siendo FÍSICO — su equivalente monetario
  // se suma al metal y NUNCA se vuelca a `breakdown.monetary.amount`.
  const metalFinalRows: MetalFinalRow[] = isBreakdown
    ? aggregateMetalFinalByParent({
        resolvedMetals,
        // Fix listas mixtas (2026-06) — BASE = "Valor de venta metal" PRE-redondeo
        // (`metalSalePreByParent` = Σ saleAmountLinePre del card). Antes usaba
        // `metalDisplayByParent` (POST = saleAmountLine, ya con el redondeo por
        // línea) y luego SUMABA el redondeo otra vez → doble conteo en MIXED.
        // Con la base PRE: `finalMetalValue = base(PRE) + redondeo = POST` (= el
        // "Valor final metal" del card). PER_DOCUMENT no cambia (ahí PRE = POST
        // porque el redondeo es documental, no por línea, y vive en el snapshot).
        // Fallback a metalDisplayByParent para callers/snapshots sin el prop.
        baseByParentName: (metalSalePreByParent
          ?? metalDisplayByParent
          ?? {}) as Readonly<Record<string, number>>,
        commercialByParentName: metalCommercialRoundingByParent,
        financialMetals:
          docRoundingResolved?.breakdown?.metalDomain === "PHYSICAL"
            ? docRoundingResolved?.breakdown?.metalPhysical?.metals ?? undefined
            : undefined,
        manualMetals:
          manualResolved?.scope === "BREAKDOWN"
            ? manualResolved?.breakdown?.metals ?? undefined
            : undefined,
      })
    : [];
  // Σ valor final por metal padre — header del bloque METALES en DESGLOSADO.
  const metalFinalTotal: number | null = isBreakdown
    ? Math.round(metalFinalRows.reduce((a, r) => a + r.finalMetalValue, 0) * 100) / 100
    : null;
  // Header del bloque METALES: en DESGLOSADO = Σ valor final real (incluye
  // financiero + ajuste manual). En UNIFICADO queda null (Etapa 1 lo suprime).
  const metalHeaderFinalSum: number | null = isBreakdown ? metalFinalTotal : null;
  // Deducción del saldo: en DESGLOSADO = Σ valor final (cierre estructural
  // METALES + MONETARIO = TOTAL). En UNIFICADO no se usa (saldo = total).
  const metalDeductionForSaldoBase: number = isBreakdown
    ? (metalFinalTotal ?? 0)
    : metalDeductionForSaldoBasePre;

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

  // ── "Monetario (saldo)" — SSOT del valor mostrado (anti doble-conteo) ─────
  // Regla de negocio: METALES + MONETARIO (saldo) = TOTAL del comprobante.
  // Esa identidad SOLO la garantiza `total − metal`. El header y el bloque de
  // "Redondeo comercial monetario" leen ESTE valor único (no recalculan).
  //
  // En BREAKDOWN, históricamente se usaba `commercialMonetarySaldoSum`
  // (Σ `lineCommercialSummary.monetary.amount`) para paridad línea↔footer. Pero
  // una línea UNIFIED aporta a `monetary.amount` su TOTAL COMPLETO (metal +
  // monetario) — en un documento mixto eso DUPLICA el metal (que también se
  // muestra en METALES). Guard: si `metal + Σmonetary` EXCEDE el total, hay
  // doble conteo → cerramos el invariante con `total − metal`. Si no excede
  // (desglosado homogéneo consistente), se respeta `commercialMonetarySaldoSum`
  // (back-compat). Display-only: resta de dos valores ya emitidos por el motor.
  const monetarioSaldoResolved: number | null = (() => {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const totalN =
      typeof totalDocument === "number" && Number.isFinite(totalDocument) ? totalDocument : null;
    if (!isBreakdown) {
      // UNIFICADO (Etapa 1) — el saldo monetario ES el TOTAL completo del
      // documento. Los metales son informativos (gramos) y NO se descuentan
      // del saldo. `monetaryHeaderAmount` solo actúa como fallback cuando
      // `totalDocument` no es finito (ahí también es null).
      return totalN ?? monetaryHeaderAmount;
    }
    // DESGLOSADO — SSOT del "Valor final monetario": RESIDUAL `total − Σ valor
    // final metal` (`metalDeductionForSaldoBase`). Es el ÚNICO valor que SIEMPRE
    // representa el saldo monetario desglosado y cierra el invariante por
    // construcción: METALES + MONETARIO = TOTAL (guard anti doble-conteo
    // intrínseco — el metal nunca se cuenta dos veces).
    //
    // ⚠️ NO usar `commercialMonetarySaldoSum` (Σ `lineCommercialSummary.monetary.amount`
    // / `lineOwnMonetarySaldoPostCommercialRounding`) como fuente del FINAL: en
    // listas DESGLOSADAS SIN redondeo ese campo trae el TOTAL DE LÍNEA (ej.
    // 814.680,14), no el saldo → inflaría el monetario y rompería el invariante.
    // El redondeo comercial monetario AUTÓNOMO por línea
    // (`commercialMonetaryRoundingImpactSum`, prioridad `lineOwn`) SÍ se muestra
    // como IMPACTO dentro del monetario (sub-fila) y deriva el "Valor comercial"
    // (= final − redondeo), pero NO redefine el final. Passthrough puro.
    return totalN != null ? r2(totalN - metalDeductionForSaldoBase) : null;
  })();

  // ── Impacto del REDONDEO FINANCIERO sobre el patrimonio MONETARIO ──────────
  // Etapa UX (2026-06) — el redondeo financiero (política del tenant) debe
  // reflejarse en AMBOS patrimonios cuando el saldo es DESGLOSADO. El metal ya
  // muestra su parte (sub-fila "Redondeo financiero" vía `MetalsSummary` cuando
  // el dominio es PHYSICAL). Acá extraemos la parte NO-metal (hechura/saldo)
  // del snapshot financiero del documento para mostrarla en el patrimonio
  // monetario. PASSTHROUGH puro — se LEE el valor que el backend ya calculó y
  // que ya está absorbido en `monetarioSaldoResolved` (post); no se recalcula
  // ningún redondeo ni se altera el total. Si el snapshot no trae el valor
  // (o es ~0), queda 0 → no se renderiza la fila (degradación segura, sin
  // regresión respecto al comportamiento previo).
  const financialMonetaryImpact: number = (() => {
    if (!isBreakdown) return 0;
    const fin = docRoundingResolved;
    if (!fin) return 0;
    const h = fin.breakdown?.hechura?.adjustment;
    if (typeof h === "number" && Number.isFinite(h)) return Math.round(h * 100) / 100;
    const u = fin.unified?.adjustment;
    if (typeof u === "number" && Number.isFinite(u)) return Math.round(u * 100) / 100;
    return 0;
  })();

  // ── Redondeo comercial MONETARIO del documento — FUENTE CANÓNICA ───────────
  // El "Redondeo comercial monetario" del footer DEBE leerse del MISMO espacio
  // documental que alimentó `Sale.total`: el snapshot
  // `commercialDocumentRoundingApplied.breakdown.hechura.deltaSaldoMonetario`
  // (prop `commercialDocumentRoundingSnapshot`). En MIXED ese snapshot = el
  // `commercialDocumentRoundingPrecomputed` (base REAL) que el motor sumó al
  // total → el redondeo mostrado RECONCILIA con el `monetarioSaldoResolved`
  // (residual). NO usar `commercialMonetaryRoundingImpactSum` (Σ `lineOwn*`,
  // DISPLAY-ONLY desde `previewMoneyByIdx`/base limpia, que NO alimenta el total
  // y diverge en MIXED). Fallback a la Σ per-línea SOLO cuando no hay snapshot
  // documental (snapshots legacy / sin contrato) → back-compat. Passthrough puro
  // — el FE no recalcula ningún redondeo.
  const commercialMonetaryRoundingDocImpact: number = (() => {
    const docDelta = commercialDocumentRoundingSnapshot?.breakdown?.hechura?.deltaSaldoMonetario;
    if (typeof docDelta === "number" && Number.isFinite(docDelta)) {
      return Math.round(docDelta * 100) / 100;
    }
    const lineSum = commercialMonetaryRoundingImpactSum;
    return typeof lineSum === "number" && Number.isFinite(lineSum) ? lineSum : 0;
  })();

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
        {/* Etapa 2D (Corrección A) — el bloque METALES solo se renderiza en
            DESGLOSADO. En UNIFICADO el comprobante es TOTAL = MONETARIO; los
            metales NO participan visualmente (se eliminó el bloque informativo
            de Etapa 1). Display-only: no afecta cálculo, cuenta corriente ni PDF. */}
        {isBreakdown && (
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
                {/* Etapa 1 (UNIFICADO) — en modo no-BREAKDOWN los metales son
                    INFORMATIVOS (solo gramos): label distintivo + sin valuación
                    monetaria. En BREAKDOWN conserva "Metales" (saldo real). */}
                {isBreakdown ? "Metales" : "Metales informativos"}
                {/* Etapa UX (2026-06) — el tooltip legacy del HEADER del bloque
                    METALES se ELIMINÓ. La trazabilidad ahora vive en un único
                    ⓘ por metal (estilo `TraceTooltipBody`), evitando dos
                    estilos de tooltip en el mismo bloque. */}
              </span>
              {/* Etapa 1 — el total monetario del bloque METALES solo se
                  muestra en BREAKDOWN. En UNIFICADO los metales son
                  informativos (gramos): sin total monetario agregado. */}
              {isBreakdown
                && typeof metalHeaderFinalSum === "number"
                && Number.isFinite(metalHeaderFinalSum)
                && metalHeaderFinalSum > 0
                && displayCurrency && (
                <span
                  className="tabular-nums text-[12px] font-medium text-muted/80"
                  data-testid="total-card-metals-header-total"
                >
                  {displayCurrency} {formatByType(metalHeaderFinalSum, "MONEY")}
                </span>
              )}
            </header>
            <MetalsSummary
              // SSOT card ↔ footer — gramo principal = el del card
              // (`metalsForDisplay` overridea `displayGrams` con el
              // `visibleGrams` consolidado). El físico `grams` queda intacto.
              metals={metalsForDisplay}
              currencyCode={displayCurrency}
              // I1 — Detalle del redondeo financiero PHYSICAL por metal padre.
              // Passthrough EXACTO del snapshot canónico top-level (capa 16).
              // Cuando la capa no actuó, queda `undefined` y MetalsSummary
              // no renderiza la sub-fila (degradación segura).
              physicalRoundedMetals={
                isBreakdown && docRoundingResolved?.breakdown?.metalDomain === "PHYSICAL"
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
              // Etapa 1 — en UNIFICADO los metales son informativos (solo
              // gramos): se suprime la valuación monetaria por metal.
              commercialMetalValueByParent={isBreakdown ? metalDisplayByParent : undefined}
              // Opción 1 (2026-06) — impacto $ del redondeo COMERCIAL por metal
              // padre. Habilita las sub-filas "Redondeo comercial" + "Valor
              // final metales" debajo de "Valor comercial". Σ === el delta que
              // se sumó al header. Sin snapshot / UNIFIED queda `undefined`.
              // Etapa 1 — además gateado por modo: en UNIFICADO nunca se
              // muestran redondeos comerciales separados por metal.
              commercialRoundingByParent={isBreakdown ? metalCommercialRoundingByParent : undefined}
              // Etapa 2C — composición FINAL por metal padre (valor comercial +
              // redondeo comercial + redondeo financiero + ajuste manual). Cuando
              // llega, MetalsSummary la usa como fuente canónica del "Valor final
              // metal" y de las sub-filas físicas. En UNIFICADO va vacío → la
              // sección queda informativa (solo gramos). Passthrough puro.
              finalRows={metalFinalRows}
              // Nombre real de la lista → "Origen" del tooltip de cada metal.
              priceListName={priceListName}
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
              // ── Etapa 2F-C — eliminación de la DUPLICACIÓN del saldo ────────
              // En UNIFICADO `Monetario (saldo)` == `Total del comprobante`
              // (mismo valor, ver Etapa 2D). Mostrar ambos duplica el monto y
              // hace parecer que existe una "cuenta de origen monetaria"
              // separada. Se oculta el header "Monetario (saldo)" — el TOTAL del
              // header maestro es el único valor visible. El detalle financiero
              // (toggle) se conserva. Display-only, sin tocar cálculo.
              if (!isBreakdown) return null;
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
              // Fase 1 — deducción del saldo alineada al MISMO valor que muestra
              // METALES (`metalDeductionForSaldoBase`: venta si hay
              // `metalSaleByParent`, si no costo, si no Σ monetaryAmount legacy).
              // En PER_LINE/MIXED el saldo = total − ese valor → por construcción
              // metalDisplay + saldo = total (sin doble margen). En PER_DOCUMENT
              // no se usa (gana el snapshot).
              // FASE 1 — Label visible "Monetario (saldo)" (ex "Hechura total").
              // Refleja el SALDO MONETARIO (total − metal, post-tax). Los testids
              // `data-tp-header-mode` siguen iguales (sin renombrar contratos).
              const headerLabel  = "Monetario (saldo)";
              // SSOT del valor — `monetarioSaldoResolved` (arriba). Garantiza
              // METALES + MONETARIO = TOTAL en ambos modos y aplica el guard
              // anti doble-conteo cuando una línea UNIFIED infló la Σ en mixto.
              const headerAmount = monetarioSaldoResolved;
              return (
                <div
                  className="flex items-baseline justify-between gap-3 py-1"
                  data-testid="total-card-hechura-row"
                  data-tp-header-mode={isBreakdown ? "saldo-monetario" : "total-hechura"}
                >
                  <span className="text-[15px] font-medium text-text inline-flex items-center">
                    {headerLabel}
                    {/* Tooltip de trazabilidad del MONETARIO — cuenta completa:
                        valor comercial (Antes) → valor final (Después) ·
                        redondeo comercial (Impacto). PASSTHROUGH puro. */}
                    {headerAmount != null && Number.isFinite(headerAmount) && displayCurrency && (() => {
                      // Redondeo comercial monetario = impacto DOCUMENTAL canónico
                      // (snapshot que alimentó Sale.total), NO Σ lineOwn display-only.
                      const commImpact = commercialMonetaryRoundingDocImpact;
                      // Redondeo total del saldo = comercial (lista) + financiero
                      // (tenant). Ambos ya están absorbidos en `post`.
                      const totalRedondeo = Math.round((commImpact + financialMonetaryImpact) * 100) / 100;
                      const post = headerAmount;
                      const pre  = Math.round((post - totalRedondeo) * 100) / 100;
                      const monTrace: ComponentTrace = {
                        kind:  "MONETARY",
                        title: "Monetario (saldo)",
                        origin: { sourceType: "PRICE_LIST", sourceName: "Saldo no-metal del comprobante" },
                        preValue:  pre,
                        postValue: post,
                        impact:    totalRedondeo,
                        completeness: "COMPLETE",
                      };
                      return (
                        <OriginTooltip
                          title="Monetario (saldo)"
                          body={<TraceTooltipBody trace={monTrace} currency={displayCurrency} />}
                        />
                      );
                    })()}
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

            {/* Redondeo comercial MONETARIO — desglose Valor comercial →
                Redondeo comercial → Valor redondeado, debajo del header
                "Monetario (saldo)" y con el MISMO patrón que el bloque de metal.
                Passthrough puro: el impacto es Σ de
                `lineCommercialSummary.monetary.roundingImpact` por línea
                (`sumLineCommercialMonetaryRoundingImpact`). El "Valor redondeado"
                es el MISMO saldo que muestra el header de arriba
                (`commercialMonetarySaldoSum`). Regla 3: si el impacto es 0/null
                NO se renderiza (en listas UNIFICADAS el contrato trae 0 porque el
                redondeo ya está embebido en el total). Cero recálculo —
                `pre = post − impacto` es derivación de display permitida (resta de
                dos valores ya emitidos por el backend). */}
            {(() => {
              // Etapa UX — MONETARIO AUTOCONTENIDO (2026-06). En DESGLOSADO el
              // patrimonio monetario muestra SIEMPRE su propia cuenta:
              //   Valor comercial → (Redondeo comercial) → Valor final monetario
              // — espejo estructural del bloque METALES. "Valor final monetario"
              // == saldo del header (`monetarioSaldoResolved`); el redondeo solo
              // aparece cuando es significativo (≠ 0). En UNIFICADO no aplica.
              // Cero recálculo: `pre = post − impacto` es derivación de display
              // (resta de dos valores ya emitidos por el backend).
              if (!isBreakdown) return null;
              const post = monetarioSaldoResolved;
              if (post == null || !Number.isFinite(post)) return null;
              // Redondeo comercial monetario = impacto DOCUMENTAL canónico
              // (`commercialDocumentRoundingSnapshot.breakdown.hechura.deltaSaldoMonetario`,
              // el que está en `Sale.total`), con fallback a la Σ per-línea solo sin
              // snapshot. Así `pre + commImpact + finImpact = post` reconcilia con el
              // residual también en MIXED (antes usaba Σ lineOwn display-only y divergía).
              const commImpact = commercialMonetaryRoundingDocImpact;
              const finImpact = financialMonetaryImpact;
              const showCommercial = Math.abs(commImpact) > 0.005;
              const showFinancial  = Math.abs(finImpact) > 0.005;
              // Valor comercial = saldo final − (redondeo comercial + financiero).
              // Derivación de display (resta de valores ya emitidos por el
              // backend): pre + comercial + financiero = post.
              const pre = Math.round((post - commImpact - finImpact) * 100) / 100;
              const SignedImpact = ({ amount, testId }: { amount: number; testId: string }) => (
                <span
                  className={`tabular-nums text-[11px] font-medium ${amount > 0 ? vt.colors.bonus : vt.colors.discount}`}
                  data-testid={testId}
                >
                  {amount > 0 ? "+" : "−"}{displayCurrency ? `${displayCurrency} ` : ""}{formatByType(Math.abs(amount), "MONEY")}
                </span>
              );
              return (
                <div
                  className="mt-0.5 mb-1 space-y-0.5 pl-3 border-l border-border/15"
                  data-testid="total-card-monetary-commercial-rounding"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] text-muted/70">Valor comercial</span>
                    <span
                      className="tabular-nums text-[11px] text-muted/80"
                      data-testid="total-card-monetary-commercial-pre"
                    >
                      {displayCurrency ? `${displayCurrency} ` : ""}{formatByType(pre, "MONEY")}
                    </span>
                  </div>
                  {showCommercial && (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[11px] italic text-muted/70">Redondeo comercial</span>
                      <SignedImpact amount={commImpact} testId="total-card-monetary-commercial-impact" />
                    </div>
                  )}
                  {/* Etapa UX (2026-06) — REDONDEO FINANCIERO del patrimonio
                      monetario: la parte no-metal del redondeo del comprobante
                      (política del tenant). Simétrico con la sub-fila "Redondeo
                      financiero" del bloque METALES. PASSTHROUGH — el valor ya
                      está absorbido en `post`; acá solo se expone la línea. */}
                  {showFinancial && (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[11px] italic text-muted/70">Redondeo financiero</span>
                      <SignedImpact amount={finImpact} testId="total-card-monetary-financial-impact" />
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] font-medium text-muted/80">Valor final monetario</span>
                    <span
                      className="tabular-nums text-[11px] font-semibold text-text"
                      data-testid="total-card-monetary-commercial-post"
                    >
                      {displayCurrency ? `${displayCurrency} ` : ""}{formatByType(post, "MONEY")}
                    </span>
                  </div>
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
                  // Fase 1 (2026-06) — alineado al MISMO valor que METALES
                  // (`metalDeductionForSaldoBase`: venta → costo → Σ monetaryAmount).
                  metalsValuationSum={isBreakdown ? metalDeductionForSaldoBase : null}
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
                  // Etapa 1 — en UNIFICADO no se muestra redondeo (comercial)
                  // físico separado del metal: se suprime el passthrough.
                  commercialPhysicalMetals={isBreakdown ? commercialPhysicalRoundedMetals : undefined}
                  // Etapa 2F — en UNIFICADO oculta la sección COMPOSICIÓN
                  // (Hechura/Productos): el detalle se enfoca en la cuenta monetaria.
                  isBreakdown={isBreakdown}
                  // Trazabilidad de auditoría por componente (tooltips con la
                  // cuenta completa). Passthrough puro desde el caller.
                  componentTraces={componentTraces}
                />
              </div>
            )}
          </section>
        )}

        {/* Aviso LISTAS MIXTAS (2026-06-03) — UI informativa pura. Cuando el
            comprobante usa múltiples listas de precios el backend entra en
            MIXED_LIST_FALLBACK: el redondeo comercial PER_DOCUMENT se desactiva
            y cada línea conserva su lógica comercial por lista. Esto explica el
            cambio visual (desaparece el desglose comercial del comprobante) que
            antes era confuso. NO altera ningún cálculo ni total — solo informa.
            El caller deriva `priceListMixed` de `appliedPriceListId === "MIXED"`. */}
        {priceListMixed && (
          <div
            role="note"
            data-testid="total-card-mixed-pricelist-notice"
            className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-2"
          >
            <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-[11px] leading-snug text-text/80">
              Este comprobante usa múltiples listas de precios. El redondeo
              comercial a nivel comprobante se desactiva y cada línea conserva su
              lógica comercial.
            </p>
          </div>
        )}

        {/* Etapa UX — SALDO DESGLOSADO AUTOCONTENIDO (Opción B, 2026-06):
            el bloque standalone "Redondeos comerciales" (Metal / Hechura /
            Total) fue ELIMINADO del render. Su información ya vive dentro de
            cada patrimonio:
              · Metal   → METALES (Valor comercial · Redondeo comercial ·
                          Valor final metal, por metal padre).
              · Hechura → "Monetario (saldo)" (Valor comercial · Redondeo
                          comercial · Valor final monetario).
            Cada patrimonio es autocontenido → cero duplicación, menos saltos
            visuales. NO se tocó ningún cálculo ni snapshot — solo el render. */}

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
