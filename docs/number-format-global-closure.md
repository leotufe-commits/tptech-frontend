# Formato numérico global por tenant — implementado (closure)

Estado: **cerrado y consolidado**.

## Qué se implementó

Una única fuente de verdad para el formato numérico *visual*, configurable por
empresa desde **Configuración → Formato numérico**.

- **Soporte regional**: Argentina (`1.000,00`), USA (`1,000.00`) y
  **Personalizado** (separador de miles y decimal libres).
- **Presets por tipo de dato** (decimales configurables por el tenant):
  `MONEY`, `MONEY_EXTENDED`, `QUANTITY`, `METAL_GRAMS`, `MERMA_PERCENT`,
  `MERMA_GRAMS`, `AJUSTE_PERCENT`, `AJUSTE_AMOUNT`, `PERCENT`,
  `MARGIN_PERCENT`, `TAX_PERCENT`, `FX_RATE`, `PURITY`, `WEIGHT`,
  `DIMENSION`, `INTEGER`, `DECIMAL`.

## Arquitectura

- Backend: `Jewelry.numberFormat` (JSON; solo config, nunca strings
  formateados). Migración `20260518000000_add_number_format_to_jewelry`.
  Commit: `434d33d feat(config): add tenant number format configuration`.
- Frontend motor: `src/lib/number-format/` (`formatNumber`,
  `parseNumberInput`, `normalizeNumberInput`, `getNumberFormatConfig`,
  `formatFixedLocale`).
- `NumberFormatContext` (provider en `main.tsx`; `setActiveNumberFormatConfig`
  puentea la config a los helpers puros).
- Helpers centrales config-aware: `src/lib/pricing/format.ts`.
  **`formatByType(value, TYPE)`** es la vía canónica type-driven: los
  decimales/separadores los gobierna el preset del tenant, no el call-site.

## Cobertura

Factura de Ventas (línea, composición, cards inferiores, totales),
Simulador, Comparador, Divisas/Valuation, Artículos, Inventario, Compras,
Ventas (listados), Finanzas, Dashboard/KPIs, Informes, Print / Estado de
cuenta / etiquetas, y tablas base + cell renderers compartidos
(`TPBalanceCell`, `TPBalanceBreakdownKpis`).

## Reglas

- Inputs numéricos: aceptan coma **y** punto, devuelven `number` puro,
  formatean en blur, no pierden foco, usan `formatType`.
- Prohibido en componentes: `toFixed`/`toLocaleString`/`Intl.NumberFormat`
  para display, separadores/decimales/regiones hardcodeados.
- Excepción `number-format:ignore` (técnico, no display): keys de Map,
  hashes, sorting, comparaciones, payloads, layout CSS.
- Exports: PDF/print/labels/estado de cuenta → formato regional del tenant;
  CSV/XLSX **machine-readable → valores raw** (sin formateo).
- `pricing-engine` intacto: el frontend es read-only en pricing; ningún
  cálculo se alteró por formato visual.

## Guards anti-regresión

Tests estáticos que fallan ante formateo inline nuevo:

- `src/components/pricing/__tests__/no-inline-format.guard.test.ts`
- `src/components/valuation/__tests__/no-inline-format.guard.test.ts`
- `src/pages/__tests__/no-inline-format-4b.guard.test.ts`
- `src/pages/__tests__/no-inline-format-5.guard.test.ts`
- `src/components/sales/__tests__/factura-format.guard.test.ts`
- `src/components/ui/__tests__/base-tables-format.guard.test.ts`

Correrlos junto al typecheck tras cualquier cambio de display numérico.
Ver también la sección **"Formato numérico global"** en el `CLAUDE.md` raíz.
