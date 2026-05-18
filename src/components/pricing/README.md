# `src/components/pricing/`

Bloques **read-only UI** del dominio comercial. Compartidos entre Simulador
(`PricingSimulator.tsx`), Factura (`VentasFacturas.tsx`) y Comparador
(`pages/dev/PricingCompare.tsx`).

## Regla de oro

> **El backend `pricing-engine` es la única fuente de verdad** para precios,
> costos, descuentos, impuestos, canal, cupón, pago, envío, redondeo y márgenes.
> Estos componentes **leen y formatean**, nunca calculan.

Esta carpeta es la **encarnación frontend** de POLICY R6 ("frontend lector
puro"). Ver `tptech-backend/src/lib/pricing-engine/POLICY.md`.

## Qué SÍ va acá

- Componentes presentacionales que renderizan datos ya normalizados.
- Sub-componentes de un bloque mayor (ej: `PricingStepRow` dentro de
  `PricingStepsBreakdown`).
- Variantes visuales del mismo bloque (`variant="full" | "compact"`).
- Tests de snapshot/render.

## Qué NO va acá

| Prohibido | Por qué | Dónde va |
|---|---|---|
| `import { apiFetch }` o `import { ...Api } from "../../services/..."` | Componentes deben recibir datos por props | El consumidor (página) hace el fetch |
| Multiplicaciones, divisiones o sumas que produzcan valores económicos | Es lógica del motor | `tptech-backend/src/lib/pricing-engine/` |
| Recálculo de márgenes, markups, totales, impuestos | Ya vienen del motor | Leer del response/snapshot |
| Hooks de estado mutable que se enviarán al backend | Read-only | El consumidor maneja estado |
| `useState` salvo para UI puro (collapse, hover, focus) | — | — |
| Lógica de negocio sin parientes en `pricing-engine` | Es bug arquitectónico | Implementar en backend primero |

## Adapters

Los **adapters** viven en `src/lib/pricing/adapters/`. Su única responsabilidad
es **mapear shapes** del backend al shape unificado (`NormalizedPricingResult` /
`NormalizedPricingLine` de `src/lib/pricing/contract.ts`).

```ts
// ✅ OK — adapter solo mapea
function saleSnapshotToCostComposition(snap: PricingLineSnapshot): CostCompositionInput {
  return {
    metals:   snap.composition?.metals   ?? [],
    hechuras: snap.composition?.hechuras ?? [],
    costSteps: snap.steps ?? [],
  };
}

// ❌ MAL — adapter recalcula
function saleSnapshotToCostComposition(snap: PricingLineSnapshot) {
  const totalCost = snap.metals.reduce((s, m) => s + m.grams * m.unitValue, 0); // BUG
  return { ..., totalCost };
}
```

Si un adapter necesita un valor que el snapshot no trae:
1. **Primero** verificar si lo trae el response del API en vivo (no snapshot).
2. **Si tampoco**, abrir un issue para sumarlo al motor backend.
3. **Nunca** calcularlo en el adapter "solo por ahora".

## Tipos compartidos

- Shape único: `NormalizedPricingResult` y `NormalizedPricingLine`
  (`src/lib/pricing/contract.ts`).
- Composición: `NormalizedComposition` (mismo archivo).
- Steps: `PricingStepResult` (`src/services/articles.ts`).

**Prohibido inventar variantes locales** del shape. Si un componente necesita
sub-conjuntos, definir un `Pick<NormalizedPricingLine, ...>` o un sub-tipo
exportado desde `contract.ts`.

## Compatibilidad pricing-preview ↔ pricingSnapshot v6

Los componentes deben funcionar igual con:
- Response en vivo de `GET /api/articles/:id/pricing-preview` (Simulador).
- Response en vivo de `POST /api/sales/preview` (Factura editando).
- `SaleLine.pricingSnapshot` v6 persistido en DB (Factura confirmada / lectura
  histórica).

Si un campo existe en uno y no en el otro:
- Si es **derivable** (markupPercent, gainAmount): el adapter lo deriva con
  identidad matemática trivial — no es lógica comercial nueva.
- Si es **commercial state** (descuentos aplicados, política): el componente
  degrada con `null` y muestra "—" o esconde la fila.
- **Nunca** se inventa un valor faltante.

## Convenciones visuales

- Reutilizar primitives de `src/components/ui/` (`TPCard`, `TPField`, etc.).
- Coherencia con `TPPriceCompositionKpis` y `TPBalanceBreakdownKpis`
  (paleta, spacing, tipografías).
- `variant="full"` para Simulador y Comparador (ancho completo).
- `variant="compact"` para integración por línea en Factura (modal estrecho).
- Sin emojis. Sin colores hardcodeados — usar tokens del design system.

## Estructura

```
src/components/pricing/
  index.ts                       Barrel — exporta lo público
  README.md                      Este archivo
  CostCompositionBlock/          Composición del costo del artículo
  PricingStepsBreakdown/         Flujo de construcción del precio
  TaxBreakdownTable/             (FASE 3) Impuestos agrupados
  CheckoutResultDisplay/         (FASE 3) Pago + envío + cuotas
  WhatIfPanel/                   (FASE 3) Simulación what-if (solo Simulador)
```

## Tests

- Co-locados en cada subcarpeta: `<Component>.test.tsx`.
- Stack: `vitest` + `@testing-library/react` + `jsdom` (ya configurado).
- Cubrir al menos: render con snapshot completo, render con campos faltantes
  (degradación), variant="compact" si aplica.
- Idealmente: golden master test que compare el output rendereado de Simulador
  vs Factura sobre el mismo input normalizado.
