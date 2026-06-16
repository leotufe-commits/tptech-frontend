# SaleCompositionEditableGrid

Grilla editable de "Composición del precio de venta" para la **línea expandida
de Factura de Ventas**. Es el único integrador editable de composición en
TPTech hoy.

## Propósito

Una fila por `costLineId` del preview backend (Metales / Hechuras /
Productos / Servicios), agrupadas por tipo, con:

- Cantidad, valor unitario, merma (METAL) o bonificación/recargo
  (HECHURA/PRODUCT/SERVICE) **editables**.
- Costo total, margen y venta total **read-only** (passthrough del motor).
- Sub-líneas de display: gramos totales, fórmula `qty × unitario`,
  equivalente en moneda del documento, ajuste global de línea.

El grid **no calcula precios**. Cada edición dispara un override que viaja al
motor backend vía `applyCostLinePatch` y el preview siguiente trae los valores
hidratados.

## Contrato de columnas independientes (CRÍTICO — no romper)

La tabla **NO** debe cerrar aritméticamente
`Costo total + Margen = Venta total`. **El no-cierre es correcto y deliberado**
(auditoría visual confirmada con el operador). Cada columna comunica un
concepto distinto:

| Columna | Qué muestra | Contra qué se calcula |
|---|---|---|
| **Costo total** | costo **POST** ajuste global del artículo (+ subdetalle `±$ GLOBAL`) | costo base ± ajuste global (display de composición) |
| **Margen** | margen **real de lista/composición** (`commercialCells.margenPctText`) | costo **BASE** (`saleValueValue`) y venta de lista — **nunca** el costo POST-global ni el `finalPrice` |
| **Venta total** | venta final/comercial (combo: `finalPrice`; resto: venta de composición) | passthrough del motor |
| **AJUSTE GLOBAL** (bloque inferior) | resumen consolidado (Costo antes → ajuste → Costo total) | passthrough |

Por eso, con ajuste global (o en combos), `Costo + Margen ≠ Venta`:
- el **Costo total** muestra el POST mientras el **Margen** resta la BASE → la
  diferencia es el **impacto del ajuste global**;
- en **combos**, además, la Venta es `finalPrice` (con descuento de precio) y el
  Margen usa la venta de composición.

❌ **Prohibido** "arreglar" el margen recalculándolo contra el costo POST-global
o el `finalPrice` para forzar el cierre — rompe el margen comercial real.

- **Margen monetario contra BASE**: `parts/EditableRow.tsx` (celda Margen,
  comentario ⚠️ CONTRATO).
- **Combo de un componente**: el margen usa `marginSaleValueOverride` (venta de
  composición) aunque la Venta total muestre `finalPrice`.
- **Guard**: `__tests__/SaleCompositionEditableGrid.test.tsx` →
  `describe("Contrato de columnas independientes — Costo + Margen ≠ Venta")`
  blinda que el margen sea **invariante** al ajuste global.

## Estructura

```
SaleCompositionEditableGrid/
├── index.tsx                      ← orchestrator (~1.500 líneas)
├── README.md                      ← este archivo
├── types.ts                       ← tipos públicos + privados
├── constants.ts                   ← TABLE_COLS_CLS, RESIZABLE_COLS, GROUP_HEADER_BG, EPS…
├── helpers.ts                     ← puros: nearlyEqual, sumGroupLineCost, sumGroupQuantity, sumGroupLineSaleDisplay…
├── context.ts                     ← TableLayoutContext (grid-template-columns compartido)
├── hooks/
│   ├── useOverrideNumber.ts       ← debounce 250ms para inputs editables
│   └── useFlashOnChange.ts        ← highlight sutil al cambiar valor
└── parts/
    ├── CellNumberInput.tsx        ← input numérico compacto alineado a la derecha
    ├── PrefixedField.tsx          ← wrap inline-flex con prefix/suffix
    ├── ColumnResizeHandle.tsx     ← handle de resize entre columnas (F23)
    ├── TableHeader.tsx            ← header sticky con resize handles
    ├── TypeGroupHeader.tsx        ← header por grupo (Metales / Hechuras / etc.)
    ├── TypeGroupFooter.tsx        ← fila "Total <grupo>" al cierre
    ├── MermaLabelEditor.tsx       ← editor inline de merma % (METAL)
    ├── AdjustmentLabelEditor.tsx  ← editor inline de Bonif/Recargo (HECHURA/PRODUCT/SERVICE)
    ├── EditableRow.tsx            ← Row (memo) + RowImpl
    ├── EmptyState.tsx             ← placeholder "Sin componentes para editar"
    ├── CostAdjustmentDetailSection.tsx
    ├── GlobalAdjustmentsBlock.tsx ← ajuste global de la línea + helper fmtSignedAmount
    └── _deprecated/               ← bloques sin caller actual, mantenidos por compat
        ├── SaleImpactBlock.tsx
        ├── CostAdjustmentBlock.tsx
        └── RentabilidadBlock.tsx
```

## Props críticas

Todas son passthrough del padre (`TPDocumentLineAdvancedEditor`). El grid no
deriva ni mantiene estado de negocio.

| Prop | Origen | Para qué |
|---|---|---|
| `line: DocumentLine` | draft hidratado por preview | datos de la línea + `pricingMeta.composition` |
| `currency: string` | `draft.currency` | code del documento (ej. "USD") |
| `onApply: (patch) => void` | padre | callback con `costLineOverrides[]` reconstruido |
| `onClear?: () => void` | padre | reset completo de overrides (botón "Restaurar todo") |
| `unitNameByCode?: Map` | catálogo del tenant | nombre amigable de unidades ("Gramos", "Unidad") |
| `currencyById?: Map` | catálogo del tenant | resolver code/symbol cuando un cost line está en moneda distinta |
| `globalAdjustments?: SaleGlobalAdjustments` | preview backend | bonif/recargo de línea con `appliesTo=TOTAL` |
| `previewLoading?: boolean` | `usePreviewFlow.status === "loading"` | spinner inline en header (display-only) |
| `documentFxRate?: number` | `draft.fxRate` | rate "unidades base por 1 unidad de la moneda doc". Default 1. |

## Cómo fluye `documentFxRate`

Resuelve el bug de la **sub-línea equivalente** ("≈ X / unidad") en facturas
en moneda no-base:

```
VentasFacturas.tsx
   │  documentFxRate={draft.fxRate}
   ▼
LinesEditorSection
   │  documentFxRate
   ▼
TPDocumentLineAdvancedEditor
   │  documentFxRate (passthrough)
   ▼
SaleCompositionEditableGrid (default 1)
   │  pasa a resolveItemCurrencyDisplay
   ▼
saleCompositionDisplay.resolveItemCurrencyDisplay
   │  divide unitValueBase (en moneda BASE) por documentFxRate
   ▼
"≈ <valor en moneda del documento>"
```

`unitValueBase` SIEMPRE viene en moneda base del tenant desde el motor.
Cuando la factura está en moneda no-base, hay que dividir por
`documentFxRate` para mostrar en moneda doc. Cuando la factura es en base,
`documentFxRate=1` y la división es no-op.

## Cómo se evita stale UI

El grid hereda **3 mecanismos anti-stale** del flujo de Factura:

1. **`selectInvoiceLineView`** (en `lib/sales/`) — adapter que mezcla
   `draftLine` (persistencia) con `normalizedLine` (display). Anti-flicker:
   si la firma del preview no coincide pero hay un cache válido del mismo
   artículo, ancla los importes al cache anterior; solo `quantity` toma el
   valor del operador.

2. **`activeOverridesRef`** (en `index.tsx`) — ref con el array más reciente
   de `costLineOverrides[]`. Los callbacks `applyCostLinePatch` y
   `resetCostLine` mergean SIEMPRE contra el ref (no contra el snapshot del
   render), evitando que un commit debounceado de un input pise overrides de
   otras filas editadas en el medio.

3. **Limpieza de cache visual al limpiar override** — el editor padre
   (`TPDocumentLineAdvancedEditor`) purga `lastTaxRateByLine` al hacer X en
   tax, y el grid respeta `taxZeroed` para ocultar el card "Detalle"
   (evita label fantasma multi-impuesto, P1 #5 fixeado).

## Cómo funciona React.memo en EditableRow

`Row = React.memo(RowImpl, comparator)` con comparator custom que compara
las primitivas que afectan el render:

- Compara: `componentType`, `manual`, `canResetRow`, `saleValueValue`,
  `totalValue`, `saleValueText`, `totalText`, `totalTooltip`,
  `unitValueCurrencyOverride`, `unitValueSubLine`, `commercialView`,
  `precioUnitVentaText`, `margenPctText`, `margenTone`, `margenTooltip`,
  `ventaLineaText`, `participacionText`, `formulaQuantity`,
  `formulaCostUnit`, `formulaSaleUnit`, `quantityUnitLabel`,
  `currencyLabel`, `marginSaleValueOverride`, `globalCost`.
- NO compara: `Icon`, `onResetRow` (closures; el caller los recrea cada
  render pero su salida visual depende de los primitivos listados).
- NO compara: `primary`, `secondary`, `quantityCell`, `unitValueCell`,
  `mermaOrAdjustmentCell` (ReactNode derivados de los primitivos del
  caller — pure-derivation asumida).

Si agregás una prop primitiva nueva que afecte el render, **agregala al
comparator** o la fila quedará stale.

## ❌ Qué NO hacer en el grid

* **No meter cálculos de negocio.** Cero suma/resta/multiplicación de
  precios, descuentos o impuestos. Si necesitás un valor derivado, pedilo
  al motor (override → preview → respuesta) o leelo de `pricingMeta`.
* **No usar `toFixed()` / `toLocaleString()` / `Intl.NumberFormat`** para
  display. Todo formato pasa por `formatByType(value, TYPE)` u otros helpers
  de `lib/pricing/format.ts` (config-aware del tenant).
* **No tocar `pricing-engine` desde el grid.** Es backend, autoritativo.
* **No reintroducir lógica legacy** (`view="sale"` de
  `LineAdvancedOverridesPanel` está muerta — no la uses, no la copies).
* **No duplicar helpers.** Antes de crear uno, buscar en `helpers.ts`,
  `lib/pricing/display/saleCompositionDisplay.ts`, `lib/pricing/format.ts`,
  `lib/pricing/grouping.ts`, `lib/pricing/cost-line-overrides.ts`.
* **No bypass-ear el `formatType` de `TPNumberInput`.** Los inputs reciben
  `formatType="METAL_GRAMS"` / `"PERCENT"` / `"MONEY"` / etc. El preset del
  tenant decide los decimales y separadores.

## Cómo agregar una columna o label sin romper guards

1. **Determinar el tipo de dato.** ¿Es texto, monto, %, gramos, cantidad?
2. **Elegir el formato correcto** con `formatByType(value, TYPE)` o
   `formatMoneyDoc(value, currency)`. NO usar `toFixed`/`toLocaleString`
   (el guard `factura-format.guard.test.ts` lo prohíbe).
3. **Leer el dato del motor.** Si el dato no existe en el preview, NO
   inventarlo en frontend. Pedir al backend que lo emita en `pricingMeta`.
4. **Si la columna depende de una prop nueva** primitiva, agregar la
   comparación al comparator de `EditableRow.tsx` (sino, el render queda
   stale).
5. **Agregar test** en `src/components/sales/__tests__/SaleCompositionEditableGrid.test.tsx`
   con un fixture que cubra el caso.
6. **Correr** `factura-format.guard.test.ts` + el test del grid +
   `tsc --noEmit`.

## Tests asociados

* `src/components/sales/__tests__/SaleCompositionEditableGrid.test.tsx`
  (~340 tests del grid + helpers display).
* `src/components/sales/SaleCompositionEditableGrid/parts/__tests__/EditableRow.memo.test.tsx`
  (regresión del comparator del memo).
* `src/components/sales/__tests__/factura-format.guard.test.ts` (guard
  estático de formato).
* `src/pages/__tests__/no-frontend-document-math.guard.test.ts` (guard
  contra reintroducción de matemática frontend).

## Referencias

* Sección "Factura de Ventas — patrón madre" en `tptech-frontend/CLAUDE.md`.
* `POLICY.md` del backend en `tptech-backend/src/lib/pricing-engine/POLICY.md`.
* Adapter passthrough: `src/lib/pricing/adapters/saleSnapshotToNormalized.ts`.
* Helpers display canónicos: `src/lib/pricing/display/saleCompositionDisplay.ts`.
