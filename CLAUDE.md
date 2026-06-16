# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 1. Communication preferences

* Always respond in Spanish.
* The user is not a developer. Keep all explanations clear and simple.

---

# 🚨 PRINCIPIO GLOBAL (CRÍTICO)

👉 El frontend **NO calcula negocio**
👉 El frontend **solo muestra lo que viene del backend**

---

# 💰 PRICING / FACTURA / SIMULADOR (CRÍTICO ABSOLUTO)

## Fuente única de verdad

Toda la lógica de negocio de precios vive en:

👉 backend → `pricing-engine`

Incluye:

* precio unitario
* descuentos
* promociones
* canal de venta
* cupones
* impuestos
* redondeos
* total de línea
* total de documento
* márgenes
* snapshots

---

## ❌ PROHIBIDO EN FRONTEND

Está PROHIBIDO:

* calcular precios
* recalcular totales
* aplicar impuestos
* aplicar descuentos
* aplicar redondeos
* modificar valores devueltos por el backend

---

## 📊 Regla de totales

El frontend puede:

✔ mostrar totales
✔ formatear valores
✔ ordenar visualmente

Pero NUNCA:

❌ definir totales como verdad
❌ persistir totales como autoridad
❌ confiar en cálculos locales

---

## 📤 Requests al backend

El frontend debe enviar SOLO:

* cliente
* vendedor
* canal
* cupón
* almacén
* moneda
* líneas
* artículo / variante
* cantidad
* overrides permitidos (si existen)

---

## 🚫 NO enviar al backend

El frontend NO debe enviar:

* subtotal
* discountAmount
* taxAmount
* total
* lineTotal como valor de verdad

(Si existen por compatibilidad → el backend los ignora)

---

## 🔄 Simulador vs Factura

Reglas obligatorias:

* Simulador y Factura deben usar el mismo motor (backend)
* Si muestran valores distintos → es BUG
* No corregir en frontend → corregir en backend

---

## 🧾 Visualización de precios

Los helpers frontend pueden:

✔ formatear moneda
✔ agrupar breakdowns
✔ mostrar labels
✔ mostrar tooltips

Pero NO pueden alterar importes.

---

## 🧠 Principio clave

👉 “Si el frontend tiene que pensar un precio, el sistema está mal diseñado”

---

# 🏗️ ARQUITECTURA DE COMPONENTES PRICING (OBLIGATORIO)

Los componentes que muestran información comercial (Factura, Simulador, Comparador)
viven en `src/components/pricing/` y siguen el **mismo patrón arquitectónico**:

```
src/components/pricing/
  README.md                              ← contrato global: read-only, prohibido cálculos
  index.ts                               ← barrel unificado
  visualTokens.ts (en src/lib/pricing/)  ← gramática visual: vt.colors, vt.text, vt.row, vt.card
  CostCompositionBlock/                  ← Composición del costo del artículo
  PricingStepsBreakdown/                 ← Flujo de construcción del precio
  PriceCompositionCards/                 ← Cards de composición del precio (sale-side)
```

## 📐 Patrón arquitectónico de cada componente

Cada componente complejo se descompone EXACTAMENTE así:

```
ComponenteX/
  types.ts                         ← shapes de props + tipos internos. SIN lógica.
  helpers.ts                       ← selectores + agregaciones puras. SIN matemática comercial.
  ComponenteX.tsx                  ← orchestrator DELGADO (compone parts).
  ComponenteX.test.tsx             ← tests (degradación + fixtures + variants).
  index.ts                         ← barrel.
  parts/
    SubComponenteA.tsx             ← sub-bloque presentacional.
    SubComponenteB.tsx
    ...
```

**Reglas obligatorias del patrón**:

* ✔ Orchestrator es DELGADO — solo deriva via helpers y compone parts.
* ✔ Cada part es SUB-COMPONENTE presentacional (read-only).
* ✔ Helpers son PUROS — sin React, sin side effects.
* ✔ Types co-located — no inventar variantes ad-hoc en cada part.
* ✔ Tests SIEMPRE — fixture por escenario relevante.
* ❌ NO meter lógica comercial en componentes (POLICY R6).
* ❌ NO recrear agregaciones — viven en `helpers.ts` y se reutilizan.
* ❌ NO archivos monolíticos (>500 líneas) salvo casos justificados.

## 🎨 Tokens visuales — `src/lib/pricing/visualTokens.ts`

Toda gramática visual del dominio pricing pasa por tokens. Importar como:

```ts
import { vt } from "../../../lib/pricing/visualTokens";

<span className={vt.colors.discount}>−$100,00</span>
<div className={vt.row.separator}>...</div>
<div className={vt.card.outer}>...</div>
```

Tokens disponibles:

* `vt.colors` — discount, surcharge, bonus, label, formula, subtotal, text, primary, etc.
* `vt.text` — totalGrand, total, totalCard, subtotalRow, formula, formulaCompact, etc.
* `vt.row` — separator, separatorCierre, separatorStrong, flexBetween, flexCenter.
* `vt.card` — outer, inner, info, pill, totalAccent.

**Si necesitás un patrón nuevo → agregalo a `visualTokens.ts`, NO inline.**
Cualquier `className="text-red-500 dark:text-red-400"` o `"rounded-lg border border-border/40 bg-muted/15..."` inline ES BUG visual.

## 🔌 Adapters puros — `src/lib/pricing/adapters/`

Cuando un consumidor (Factura) usa un shape diferente al del componente, va por
un adapter:

```ts
// src/lib/pricing/adapters/saleSnapshotToNormalized.ts
export function saleSnapshotToNormalized(line: SalePreviewLine): {
  line: NormalizedPricingLine;
  steps: PricingStepResult[];
}
```

Reglas obligatorias de adapters:

* ✔ Mapeo de SHAPES — solo cambiar la forma del dato.
* ✔ Reconstrucciones legítimas (ej: `composition.metals[]` → `steps` sintéticos) si el motor no expone la otra forma, **passthrough puro**.
* ❌ NO calcular precios.
* ❌ NO sumar / multiplicar / aplicar % nuevo.
* ❌ NO inferir descuentos / impuestos / márgenes.

## 🧾 Integración en Factura — `<SaleLinePricingPanel>`

Para integrar pricing en la Factura, usar SIEMPRE:

👉 `src/components/sales/SaleLinePricingPanel.tsx`

Este panel renderiza, por línea de factura expandida:

* `<CostCompositionBlock variant="compact" detailMode="UNIFICADO" />`
* `<PricingStepsBreakdown variant="compact" />`
* `<PriceCompositionCards variant="compact" />`

**NO duplicar esta integración**. Si necesitás mostrar pricing en otro lugar
del modal, extendé `SaleLinePricingPanel` o agregá props específicas.

## 📦 Resumen de la regla

| Capa | Vive en | Puede |
|---|---|---|
| Lógica comercial | backend `pricing-engine` | calcular, decidir |
| Adapters | `src/lib/pricing/adapters/` | mapear shape (passthrough) |
| Helpers | `<Componente>/helpers.ts` | agregar, filtrar, formatear |
| Componentes | `src/components/pricing/<X>/` | renderizar, layout, expansion |
| Tokens visuales | `src/lib/pricing/visualTokens.ts` | className strings |
| Panel Factura | `src/components/sales/SaleLinePricingPanel.tsx` | orquestar lectura por línea |

👉 Si modificás cualquier capa, **respetar la inmediatamente superior**: nada
se "filtra hacia abajo" (componentes nunca calculan, adapters nunca renderean,
helpers nunca tienen JSX).

---

# 🧾 FACTURA DE VENTAS — PATRÓN MADRE (OBLIGATORIO)

`VentasFacturas.tsx` es la **pantalla madre** del sistema. Su patrón se va a
replicar a Presupuestos, Órdenes, Notas de Crédito y Compras cuando el
backend exponga los endpoints de preview correspondientes. Cualquier pantalla
hermana debe partir de este patrón — sin reinventarlo.

## 🎯 Regla central

* El `pricing-engine` del **backend** es la única fuente de verdad de
  precios, descuentos, impuestos, redondeos, totales, márgenes y composición.
* El frontend **renderiza, edita intención y consume el preview**. No
  calcula nada.

## 🔄 Flujo oficial (orden obligatorio)

```
draft (estado local)
   │
   │ cambio → cambia firma comercial
   ▼
usePreviewFlow                         (lib/sales/usePreviewFlow.ts)
   │  debounce + anti-stale + cache + status machine
   ▼
buildSalePreviewPayload                (lib/sales/buildSalePreviewPayload.ts)
   │  arma POST /sales/preview (no envía subtotal/total/discountAmount/taxAmount)
   ▼
backend pricing-engine                 (única fuente de verdad)
   │
   ▼
applySalePreviewToDraft                (lib/sales/applySalePreviewToDraft.ts)
   │  hidrata draft con response (passthrough puro, cero matemática)
   ▼
selectInvoiceLineView                  (lib/sales/selectInvoiceLineView.ts)
   │  adapter visual: mezcla draft (persistencia) + normalizado (display)
   │  anti-flicker, exención fiscal, override manual de tax
   ▼
TPDocumentLineAdvancedEditor           (components/ui/)
   │  hub editor de líneas (bifurca por compositionView)
   ▼
SaleCompositionEditableGrid            (components/sales/SaleCompositionEditableGrid/)
   │  grilla editable por costLineId (FACTURA, compositionView="sale")
   ▼
saleCompositionDisplay                 (lib/pricing/display/saleCompositionDisplay.ts)
   │  fuente única de helpers display (margen, gramos equivalentes, etc.)
```

Ver `src/components/sales/SaleCompositionEditableGrid/README.md` para el
detalle interno del grid.

## ❌ Prohibido en cualquier pantalla con preview backend

Calcular en frontend:

* subtotales / totales / margen
* impuestos (IVA, percepciones, multi-impuesto)
* descuentos (cliente, manual, cupón, canal, cantidad, promoción)
* redondeos comerciales
* composición de costo / venta (metales, hechuras, productos, servicios)
* conversión FX de valores comerciales

Si el operador edita un valor, va al payload como **override**; el motor
decide y el frontend muestra la respuesta. Sin excepciones.

## 🛡️ Guards activos contra regresión

Dos guards estáticos previenen reintroducir matemática o formato inline:

* `src/components/sales/__tests__/factura-format.guard.test.ts` — prohíbe
  `toFixed()` / `toLocaleString()` / `Intl.NumberFormat` en superficies de
  Factura (14 archivos cubiertos).
* `src/pages/__tests__/no-frontend-document-math.guard.test.ts` — prohíbe
  `calcLineSubtotal` / `calcLineTotal` / `computeGlobalDiscount` /
  `recomputeTotals` fuera de la whitelist.

Si una pantalla nueva necesita esos helpers, **el guard falla**. La solución
NO es agregarla a la whitelist sino conectarla al backend preview.

## 🟡 Whitelist POC (deuda conocida y temporal)

Estas 5 pantallas todavía calculan totales en frontend porque no tienen
endpoint backend preview:

* `pages/VentasPresupuestos.tsx`
* `pages/VentasOrdenes.tsx`
* `pages/VentasNotasCredito.tsx`
* `pages/ComprasFacturasProveedor.tsx`
* `pages/ComprasNotasCreditoProveedor.tsx`

Cada una tiene un bloque `⚠️ DEUDA TÉCNICA POC` en la cabecera de
"Helpers" + `TODO(D3-backend-preview)` señalando cuándo eliminar la
excepción. Cuando una pantalla migra al patrón Factura, sale de la
whitelist y los helpers se borran.

## ❌ Qué NO tocar para Factura

* **`LineAdvancedOverridesPanel`** — es el panel legacy de
  Compras/Presupuestos/Órdenes (`compositionView="cost"`). Factura usa el
  grid nuevo (`compositionView="sale"`). NO modificar este panel pensando
  en Factura.
* **`pricing-engine` del backend** — si Factura muestra algo "mal", el bug
  está en el frontend o en cómo se interpreta el preview, NO en el motor.
* **Helpers canónicos** — antes de crear un helper nuevo, buscar si ya
  existe en `lib/pricing/display/saleCompositionDisplay.ts`,
  `lib/pricing/format.ts`, `lib/sales/*`. Duplicar es bug arquitectónico.

## 📌 Resumen para pantallas hermanas

Para replicar el patrón a una pantalla hermana (cuando el endpoint backend
exista):

1. Crear `buildXxxPreviewPayload` + `applyXxxPreviewToDraft` (copia
   adaptada de los de Factura, distinto endpoint).
2. Usar `usePreviewFlow` tal cual (es genérico).
3. Usar `selectInvoiceLineView` (o un alias) — el nombre tiene "Invoice"
   pero la lógica es agnóstica.
4. Eliminar `recomputeTotals` local y sacar la pantalla de la whitelist
   del guard.
5. Conservar features propias (timeline, dual status, ciclo de vida) como
   módulos adicionales encima del patrón base.

---

# 🎛️ "Configuración de vista" vs "Plantilla: Factura" — distinción crítica

TPTech tiene DOS conceptos visuales que **NO deben confundirse**. Operar como
si fueran lo mismo introduce divergencias entre lo que el operador edita en
pantalla y lo que después sale en el PDF/mail.

## Configuración de vista (Layout V2)

**Qué es:** preferencia OPERATIVA del usuario para trabajar la pantalla de
Factura de Ventas.

**Qué controla:**

- Orden y tamaño de los cards del aside (Bonificación, Envío, Cupón, Total,
  Cobro, Impacto cuenta corriente, Observaciones).
- Cards visibles/ocultas (toggle por card en el modal de configuración).
- Densidad / sticky / collapsed por card.
- Preset base (CLASSIC, COMPACT, ONE_LINE) + presets nombrados ("Mis vistas").

**Dónde vive:** `userPreferences.invoiceLayoutConfig` (backend) ↔
`useInvoiceLayout` (frontend). Persistencia debounceada en localStorage +
backend.

**Qué NO controla:**

- ❌ El layout del PDF impreso.
- ❌ Las columnas que aparecen en el PDF.
- ❌ Los datos visibles en el comprobante enviado por mail.
- ❌ El logo / footer / términos del PDF.

## Plantilla: Factura (DocumentTemplate)

**Qué es:** configuración DOCUMENTAL del comprobante. Define cómo se imprime,
descarga y envía por mail.

**Qué controla:**

- Logo + tamaño + posición + datos visibles del emisor (CUIT, dirección,
  teléfono, email, website).
- Tamaño de página (A4, custom mm) + márgenes + orientación.
- Tipografía base + tamaño + color de acento + estilo de tabla.
- Columnas visibles en la grilla de líneas (descripción, cantidad, precio,
  subtotal, etc.) + ancho + alineación + orden.
- Decimales de moneda + flags (mostrar símbolo, mostrar cotización, etc.).
- Footer (texto, legal, datos bancarios, términos, paginación).
- Secciones que aparecen (subtotal, total, descuento, impuestos,
  observaciones, datos fiscales).
- Templates de mail (asunto + cuerpo) con variables `{{cliente}}`,
  `{{numero}}`, `{{joyeria}}`, `{{estado}}`, `{{fecha}}`.

**Dónde vive:** tabla `DocumentTemplate` (backend, kind=`"FACTURA"`).
Service: `getOrCreateTemplate(jewelryId, "FACTURA")`.

**Qué consume esta plantilla:**

- `saleInvoicePdfProvider.renderFromPersisted` para descargas + adjunto mail.
- `<SaleInvoicePrintable>` (shared) para `window.print()` del frontend.
- Frontend de "Configuración del sistema → Documentos → Plantilla: Factura"
  para editarla.

## Reglas obligatorias

✅ **OBLIGATORIO:**

- Cambios en "Configuración de vista" NO modifican `DocumentTemplate`.
- Cambios en "Plantilla: Factura" NO modifican `userPreferences.invoiceLayoutConfig`.
- Toda salida documental (PDF / print / mail) lee `DocumentTemplate` —
  nunca `userPreferences`.
- Toda lectura/edición visual operativa lee `userPreferences` — nunca
  `DocumentTemplate`.

❌ **PROHIBIDO:**

- Mezclar layout operativo con el shape de DocumentTemplate.
- Hacer que ocultar un card en el aside oculte la columna correspondiente
  en el PDF (es decisión documental, no operativa).
- Mover un card en el aside y esperar que el orden cambie en el PDF.
- Editar columnas del PDF desde el modal de "Configuración de vista".
- Crear UI duplicada del editor de plantilla en otra pantalla.

## Acceso a la plantilla activa desde Factura

Cuando el operador necesita ver/editar la plantilla activa de FACTURA,
hay UN solo lugar: **Configuración del sistema → Documentos → Plantilla:
Factura**. Desde la pantalla de Factura de Ventas se puede agregar un
enlace de acceso rápido — pero el editor de la plantilla NUNCA se inlinea
en el modal de Factura (cada uno tiene su propio scope de cambios).

Si una pantalla nueva muestra "qué plantilla está activa", debe leer
`DocumentTemplate.findFirst({ jewelryId, kind: "FACTURA", isActive: true })`
vía el endpoint canónico, NO desde un estado local.

---

# 🧱 LAYOUT V2 DE FACTURA — SSOT (OBLIGATORIO)

El layout del aside derecho de Factura (cards: Bonificación, Envío, Cupón,
Total del comprobante, Cobro, Impacto cuenta corriente, Observaciones) tiene
su propio sistema canónico. Cualquier pantalla hermana que necesite cards
reordenables/colapsables debe reutilizar este sistema.

Vive en `src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/`:

| Archivo | Rol |
|---|---|
| `LayoutGridContext.tsx` | Adapter sobre `react-grid-layout`. Modo lectura (sin handles) vs edición (drag/resize). Maneja el ResizeObserver + RAF throttle del auto-grow/shrink. |
| `cardConstraints.ts` | **SSOT de `minW`/`minH` por card**. `minH` = floor del SHRINK (estado colapsado, ~48 px). `totals.minH=6` es la única excepción (hero, no colapsa pero permite shrink natural si el contenido es chico). |
| `presetLayouts.ts` | Geometría de los 3 presets (`CLASSIC`, `COMPACT`, `ONE_LINE`). Cada preset emite cards usando `sizeFor(id, h, presetMinW)` que **delega `minH` al SSOT** — cero duplicación. |
| `reflowLayout.ts` | Algoritmo SSOT del reacomodo: `compactVerticallyByRegion`, `recalculateCardHeight`, `reflowLayoutAfterCardChange`, `decideStabilityCommit`. |
| `spacing.ts` | Constantes globales: `GRID_ROW_HEIGHT_PX=20`, `CARD_GAP_Y_PX=6` (+ Tailwind clase `space-y-1.5`). |
| `../reconcileLayout.ts` | Hidrata layouts persistidos en localStorage contra el preset actual. **Re-clampa `minH`/`minW` contra el SSOT** al cargar — layouts viejos guardados con minH heredados de ROW=32 se recalibran solos. |

## Parámetros canónicos del grid

- `ROW_HEIGHT_PX = 20` (granularidad fina del resize vertical).
- `MARGIN = [6, 6]` (gap visual uniforme entre cards).
- `cardHeight(h) = h * 20 + (h - 1) * 6` px.

## Comportamiento del reflow (debe seguir comportándose así)

- **Cascade real**: cuando un card cambia altura, `compactVerticallyByRegion` reposiciona TODOS los cards de la región en el MISMO reflow pass. Sin estados intermedios, sin overlap visual.
- **RAF throttle**: el ResizeObserver programa **un único `requestAnimationFrame`** por frame (no `setTimeout` debounce). Resultado: durante la animación de TPCard (~220 ms) se generan ~14 commits sucesivos → la animación del aside es continua y sincronizada con la del card que se expande.
- **Stability gate con `STABILITY_REQUIRED=1`**: la primera observación commitea inmediato. La fn pura `decideStabilityCommit({ newH, tracker, stabilityRequired })` vive en `reflowLayout.ts` y es testeable en aislamiento.
- **Sin cooldown manual**: el RAF throttle es el único anti-storm. No hay `COOLDOWN_MS` ni `lastCommitAtRef` global.
- **`manuallyResized=true` solo bloquea SHRINK**, nunca GROW (protección anti-corte de contenido).

## Bugs históricos resueltos (NO reintroducir)

| Bug | Causa | Fix vigente |
|---|---|---|
| Huecos verticales entre cards colapsados | `payments.minH=8`, `discount.minH=6`, etc. — actuaban como piso de shrink. Card colapsado a 28 px se quedaba con slot de 128-184 px. | `cardConstraints.ts` con `minH=2` (~48 px) para todos los colapsables. |
| Layouts persistidos con minH heredados de ROW=32 | `reconcileLayout.clampCard` preservaba el `minH` persistido. | `clampCard` ahora toma `minW`/`minH` SIEMPRE del SSOT (`CARD_CONSTRAINTS`), nunca del valor persistido. |
| Reflow tardío "necesita doble interacción" | Stability gate del legacy requería 2 observaciones del mismo `h`. Post-animación TPCard solo había una → commit colgado. | `decideStabilityCommit` con semántica correcta: `STABILITY_REQUIRED=1` ⇒ commit en 1ª observación. |
| Overlap visual durante la animación expand | `setTimeout(80ms)` debounce reseteaba en cada evento RO → commit recién post-animación + 80 ms. Animación del aside arrancaba 300 ms después que la del TPCard. | RAF throttle: la animación del aside arranca **en el mismo frame** que la del TPCard expandido. |
| Total con factura vacía → hueco gigante hacia Cobro | `totals.minH=13` (~332 px) forzaba el slot a 332 px aunque el contenido midiera 180. ~150 px de aire INTERNO al card. | `totals.minH=6` (~132 px). Auto-grow trae a la altura natural cuando hay contenido. Jerarquía hero preservada via `TOTAL_H=17` default. |

## Personalización del operador

Modo edición (`LayoutEditModeToolbar`): habilita drag/resize de los cards. Persistencia en localStorage via `useInvoiceLayout`. Al volver a modo lectura, los cards quedan donde el operador los dejó.

`manuallyResized=true` lo setea el `onResizeStop` de react-grid-layout cuando el operador suelta el handle. El auto-shrink lo respeta; el auto-grow lo IGNORA (siempre crece si el contenido se desborda).

---

# 🧪 GUARDS Y TESTS DE HARDENING (FACTURA)

Lista canónica de tests que protegen los SSOTs. Si algo cambia y rompen, hay regresión arquitectónica (no es un test que "se ajusta" — es un fix de código).

## Frontend — guards estáticos (lectura de archivos)

| Test | Qué protege |
|---|---|
| `src/components/sales/__tests__/factura-format.guard.test.ts` | Prohíbe `toFixed`, `toLocaleString`, `Intl.NumberFormat`, regiones hardcodeadas en 14 archivos de Factura. |
| `src/pages/__tests__/no-frontend-document-math.guard.test.ts` | Prohíbe `calcLineSubtotal` / `calcLineTotal` / `computeGlobalDiscount` / `recomputeTotals` fuera del whitelist POC. Si una pantalla nueva necesita esos helpers, **el guard falla** — la solución NO es agregar al whitelist sino conectar al backend preview. |
| `src/**/__tests__/*no-inline-format*.guard.test.ts` | Más guards de formato numérico inline (Simulador, Comparador, valuation, Inventario, Compras, Dashboard, etc.). |

## Frontend — Layout V2 (tests dinámicos)

| Test | Qué protege |
|---|---|
| `src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/__tests__/reflow-dynamics.test.ts` | **33 tests** — cascade reflow real, decideStabilityCommit, GAP=6, spacing colapsado, layouts legacy re-clamped, totals shrink cuando factura vacía. |
| `src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/reconcileLayout.test.ts` | Reconcile contra preset, respect de minW/minH del SSOT, layouts legacy migrados, descarte de cards desconocidas. |
| `src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/presetLayouts.test.ts` | Invariantes geométricos de los 3 presets. |
| `src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/compactLayout.test.ts` | Helper de compactación básica. |

⚠️ Existen tests stash-legacy del incidente OneDrive 2026-05-25 que fallan contra una arquitectura V2 alternativa anterior (`LayoutV2Config` con `grid.columns`). **NO** intentar parchearlos — requieren reescritura completa contra la arquitectura vigente. Ver root CLAUDE.md sección "Deuda residual conocida".

## Frontend — Modal de mail

`src/components/sales/__tests__/SendInvoiceEmailModal.test.tsx` (~30 tests). Pre-carga de email del cliente, validación, plantillas persistidas, interpolación, "Guardar como predeterminado".

## Backend — referencia rápida (detalle en `tptech-backend/CLAUDE.md`)

- `src/lib/__tests__/tenantMailContext.test.ts` — composición From + fallback Reply-To.
- `src/lib/__tests__/saleInvoicePdfProvider.test.ts` — provider PDF (Etapa 2).
- `src/modules/sales/__tests__/pdf-parity.test.ts` — paridad descarga / mail / draft / draft mail (Etapa 3).
- `src/modules/sales/__tests__/preview-confirm-parity.test.ts` — preview ↔ confirm idénticos.
- `src/modules/sales/__tests__/renderInvoicePdf*.no-math.guard.test.ts` — bloquean cálculos comerciales en los renderers PDF.
- `src/lib/pricing-engine/__tests__/*` — motor de precios (30+ tests).

## Cuándo correr qué

- **Cambio en display numérico** (cualquier archivo): typecheck + todos los `*no-inline-format*.guard.test.ts` + `factura-format.guard.test.ts`.
- **Cambio en Layout V2**: typecheck + `reflow-dynamics.test.ts` + `reconcileLayout.test.ts` + `presetLayouts.test.ts` + `compactLayout.test.ts`.
- **Cambio en flujo mail (sender / Reply-To / DocumentEmailLog)**: tests backend de mail (ver backend CLAUDE.md).
- **Cambio en PDF (provider / renderers)**: tests backend de PDF + `pdf-parity.test.ts`.
- **Cambio en preview/confirm de Factura**: `preview-confirm-parity.test.ts` backend + `preview-confirm-parity-e2e.test.ts` frontend.

---

## 2. Mobile-first design (OBLIGATORIO)

La app debe funcionar en dispositivos móviles pequeños (mínimo 375px, como iPhone SE).

* Diseñar mobile-first
* Evitar tablas horizontales
* Botones mínimo 44×44px
* Inputs `w-full`
* Sidebars tipo drawer
* Texto mínimo `text-sm`

---

## 3. Deployment

* Hosting: Render (Static Site)
* Backend separado (Render Web Service)
* `VITE_API_URL` configurado en producción

---

## 4. Commands

```bash
npm run dev                 # Vite (proxy /api → localhost:3001)
npm run build               # tsc -b && vite build
npm run lint                # eslint .
npm run preview             # sirve el build de dist/

# Tests (Vitest)
npm test                    # vitest run (toda la suite, una pasada)
npm run test:watch          # vitest en modo watch
npm run test:coverage       # vitest run --coverage
npx vitest run <archivo>    # un único archivo de test
npx vitest run -t "<patron>"# tests que matcheen un nombre

# TypeScript
npx tsc --noEmit            # chequeo completo de tipos (NO usar -b al diagnosticar)
npm run typecheck:test      # type-check de los archivos de test
```

---

## 5. Environment

```
VITE_API_URL=http://localhost:3001/api
```

---

## 6. Architecture

* `main.tsx` → providers → router
* `AuthProvider` → sesión + PIN
* `ThemeProvider` → tema

---

## 7. Componentes reutilizables (OBLIGATORIO)

Todo UI en:

👉 `src/components/ui/`

Nunca crear UI inline si puede ser reutilizable.

---

## 8. UI component library

Todos los componentes usan prefijo `TP`.

Nunca usar HTML directo si existe TP equivalente.

---

## 9. Permisos

Formato: `"MODULE:ACTION"`

Usar:

* `usePermissions`
* `<RequirePermission>`

---

## 10. Servicios y hooks

* `services/` → API
* `hooks/` → lógica de UI

---

## 11. Formato de valores numéricos (OBLIGATORIO)

Fuente única de verdad: el preset numérico del tenant (ver sección *"Formato
numérico global"* en el `CLAUDE.md` de la raíz). El formato lo gobierna la
config del tenant, **nunca el call-site**.

* Todo display numérico usa los helpers config-aware de
  `src/lib/pricing/format.ts` — preferentemente `formatByType(value, TYPE)` con
  el `NumberFormatType` correcto (`MONEY`, `PURITY`, `METAL_GRAMS`, etc.).
* Todo input numérico usa `TPNumberInput`/`TPAmountInput`/`TPQuantityField` con
  su `formatType`: acepta coma y punto, devuelve `number` puro, formatea en blur.
* ❌ **PROHIBIDO** en componentes: `toFixed()`, `toLocaleString()`,
  `Intl.NumberFormat`, o regiones hardcodeadas (`es-AR`/`en-US`) para display.
  Solo permitido con comentario `number-format:ignore` cuando es técnico (keys
  de Map, hashes, sorting, payloads raw, exports machine-readable).
* Guards anti-regresión: `src/**/__tests__/*no-inline-format*.guard.test.ts` y
  `factura-format.guard.test.ts` — correrlos tras cualquier cambio de display
  numérico, junto con el typecheck.

---

## 12. Enter para guardar (OBLIGATORIO)

Enter guarda en modales simples.

---

## 13. Campos obligatorios

Usar `<TPField required>` con validación estándar.

---

## 14. Eventos globales

Eventos como:

* `tptech:user_avatar_changed`
* `tptech:valuation-changed`

---

## 15. Tailwind opacity rules

Usar `opacity-*` en vez de `/alpha` en colores no compatibles.

---

## 16. Comillas tipográficas

Nunca usar comillas curvas.

---

## 17. Valuation module

Hook obligatorio: `useValuation`

Fórmula:

```
finalSalePrice = referenceValue × purity × saleFactor
```

---

## 18. Tablas (OBLIGATORIO)

Siempre usar:

👉 `TPTableKit`

Nunca HTML table directo.

---

## 19. CRUD estándar (OBLIGATORIO)

* Tabla + buscador
* Sort
* Modal view/edit
* Soft delete
* Favorito (si aplica)
* Refetch automático

---

## 20. Soft delete

Siempre soft delete + confirmación.

---

## 21. Focus automático

Primer campo con foco.

---

## 22. Orden de formularios

1. Identificadores
2. Clasificación
3. Contacto
4. Números
5. Notas

---

## 23. Estándares UI TPTech

Usar siempre:

* TPInput
* TPNumberInput
* TPCombo*
* TPButton
* TPCard
* TPField

---

## 24. UI System Rules (OBLIGATORIO)

Nunca usar HTML nativo si existe componente TP.

❌ `<input>`
❌ `<button>`
❌ `<table>`
❌ modales custom

✔ usar TP UI system

---

## 25. UserPreference — preferencias personales (OBLIGATORIO)

`UserPreference` (preferencia **personal por usuario**) ≠ `isFavorite`
(favorito **global de la joyería**). **No se mezclan.**

- Motor frontend: `src/services/user-preferences.ts`
  (`userPreferencesApi.get/update`, `resolveDefaultId`,
  `resolveDefaultCurrencyCode`, `resolveCurrencyRate`,
  `resolveDefaultWarehouseId`). Backend: `GET`/`PUT /api/user-preferences/me`.
- Pantalla: **Configuración → Mis preferencias** (`MisPreferencias.tsx`,
  ruta `/configuracion/mis-preferencias`). Sin permiso especial.
- **Scope actual:** `SALES_INVOICE`. **Campos que edita esta pantalla:**
  `defaultWarehouseId`, `defaultSellerId`, `defaultPriceListId`,
  `defaultChannelId`, `defaultCurrencyId`, `defaultBalanceMode`. Otros campos
  del modelo (`defaultGlobalDiscountType`, `invoiceLayoutConfig`,
  `preferredInvoiceViewPreset`, `invoiceUiPreferences`) los editan otras
  pantallas de Factura, no "Mis preferencias".
  - **Gap conocido:** `invoiceLayoutPresets` ("Mis vistas") se envía desde el
    frontend (`useInvoiceLayout`) pero el backend no lo persiste; hoy sobrevive
    solo por `localStorage`. Requiere sprint propio (migración Prisma).
- Solo precargan defaults al **crear una Factura de ventas nueva**
  (`VentasFacturas.openNew()`, que trae la preferencia **fresca** vía
  `userPreferencesApi.get()`).

Prioridad de defaults (orden obligatorio):

1. Default comercial del cliente/proveedor (si aplica)
2. `UserPreference` del usuario
3. Favorito de la joyería (`isFavorite`)
4. Primer activo disponible

Reglas:

- Almacenes = preferencia **personal**. Listas/canales/vendedores/pagos/envíos
  = favoritos **globales** (`isFavorite`).
- Moneda: `UserPreference` guarda `currencyId` → mapear a `currencyCode` →
  resolver `latestRate` vigente del catálogo (mismo flujo que el cambio manual
  del modal de FX). La factura usa el **code**.
- El frontend **no recalcula precios**: `UserPreference` solo precarga UI; el
  `pricing-engine` (backend) sigue siendo única fuente de verdad de pricing.

### ❌ No hacer

- ❌ Mezclar favoritos globales con `UserPreference`.
- ❌ Guardar preferencias de UI dentro del usuario / `User.favoriteWarehouseId`
  (legacy, solo fallback de lectura transitorio).
- ❌ Hardcodear `ARS` ni `fxRate = 1` salvo que la moneda sea la base real.
- ❌ Duplicar la resolución de defaults: usar los helpers de
  `services/user-preferences.ts`, no reimplementar inline ni crear flujos
  paralelos de favoritos.

---

# 🎯 RENDERIZADO DE REDONDEOS Y AJUSTES (OBLIGATORIO)

> Contrato canónico de los 3 mecanismos en el `CLAUDE.md` raíz + backend. Esta sección define únicamente cómo el frontend los **muestra**.

## Los 3 mecanismos que el backend puede informar

1. **Redondeo Comercial** (por línea) — viene en el preview por línea, parte del breakdown de precio de lista.
2. **Redondeo Financiero** (por comprobante) — viene en `documentRoundingSnapshot` con detalle UNIFIED / BREAKDOWN (incl. capa 16 PHYSICAL si está activa).
3. **Ajuste Manual** (por comprobante) — viene en `manualAdjustmentSnapshot` con `scope: "UNIFIED" | "BREAKDOWN"`, incluye `metals[]` y/o `monetary.amount`.

## El frontend solo puede

✔ **renderizar** lo que vino del backend, exactamente con el signo y la magnitud entregados.
✔ **formatear** vía los helpers config-aware (`formatByType`, `formatMoneyDoc`, `formatGrams`, etc.).
✔ **explicar** qué representa cada componente (labels, tooltips, agrupaciones visuales).
✔ **mostrar** el desglose por dominio (metal padre físico vs. hechura/saldo monetario) cuando el modo es BREAKDOWN.

## El frontend NUNCA puede

❌ recalcular un redondeo o ajuste.
❌ "corregir" un valor que se ve raro (el fix va en el backend o en el contrato visual, jamás inline).
❌ inferir un componente faltante (si el backend no lo manda, no existe en pantalla).
❌ ocultar un valor por su signo: positivo, negativo o cero **se muestran igual**.
❌ aplicar `Math.max(0, value)` sobre montos del pricing-engine (regresión del contrato — ver "saldos negativos" abajo).

## Renderizado del modo DESGLOSADO

Cuando el snapshot trae `scope="BREAKDOWN"` (financiero o manual) hay **dos dominios paralelos** que se renderizan por separado y NUNCA se mezclan visualmente:

- **Dominio metal** (por metal padre): `preGrams → postGrams`, `deltaGrams`, `metalPricePerGram`, `monetaryEquivalent`. Mostrar gramos físicos como protagonistas; el equivalente monetario va como sub-línea informativa.
- **Dominio hechura / saldo monetario**: `monetary.amount` con signo. Etiqueta única "Hechura/Saldo" (sin sub-categorías; las sub-categorías viven en capas previas del pipeline).

La consolidación financiera (`totalMonetaryAdjustment`) puede mostrarse como total único, pero NUNCA como ingrediente para recalcular nada.

---

# ➖ SALDOS NEGATIVOS Y COMPONENTES NEGATIVOS

> Auditado 2026-05-29 contra `pricing-engine.sale.ts` + `document-balance-breakdown.test.ts §T58`. El backend **permite y emite** valores negativos en los siguientes casos:

## Permitidos y deben preservarse en pantalla

- ✅ **`breakdown.monetary.amount` negativo** (saldo de hechura/monetario negativo) — válido en BREAKDOWN cuando un descuento dirigido o un ajuste manual supera el subtotal de hechura.
- ✅ **Componentes de línea negativos** (hechura, metal, productos) — válidos cuando un descuento sobre un componente supera su subtotal.
- ✅ **`deltaGrams` y `monetaryEquivalent` negativos** — válidos en redondeo PHYSICAL hacia abajo o ajuste manual con `targetGrams < preGrams`.

## Reglas obligatorias de display

- ✔ Mostrar el valor con su signo. Si es negativo, formato `−$100,00` (signo menos tipográfico, no guión ASCII).
- ✔ Color de discriminación visual (`vt.colors.discount` para negativos comerciales) — solo color, NUNCA clamp.
- ✔ Tooltip explicativo cuando el origen no es obvio (ej.: "el descuento manual sobre hechura supera su subtotal").
- ❌ `Math.max(0, value)` sobre montos del pricing-engine = **regresión arquitectónica**. Si aparece, el guard de no-math debe atraparlo; si no lo atrapa, agregar caso al guard.
- ❌ Redistribuir el excedente del descuento a otros componentes para "limpiar" un negativo — rompe la auditoría de totales (snapshot ≠ display).

## Única excepción del backend (que el frontend NO replica)

`Sale.total` final está clampado a ≥0 por el backend (`Math.max(0, engineTotal + totalMonetaryAdjustment)`). El frontend muestra ese total ya clampado tal como viene — no aplica el clamp por su cuenta y no muestra el "total preliminar negativo" como dato visible.

---

# 🎯 OBJETIVO ACTUAL DEL PROYECTO

> Documentado en `tptech-backend/CLAUDE.md` con el detalle backend. Esta sección refleja el impacto en frontend.

Cierre de **Factura de Ventas** como pantalla madre antes de avanzar masivamente sobre:

- Tabla de Facturas (filtros, sort, columnas)
- Ver Factura (modal de lectura)
- Editar Factura (re-emisión limitada)
- Presupuestos
- Órdenes de venta
- Notas de Crédito
- Compras (factura proveedor, NC proveedor)

## Implicancia operativa para el frontend

1. Cualquier feature nueva sobre módulos hermanos pasa por la pregunta: *"¿está cubierto el caso análogo en Factura de Ventas?"*. Si no, primero Factura.
2. Las 5 pantallas en el whitelist POC de `no-frontend-document-math.guard.test.ts` **salen del whitelist** a medida que el backend exponga su endpoint de preview correspondiente. Hasta entonces, no agregar features ni copiar el patrón viejo a pantallas nuevas — usar el patrón madre.
3. Toda mejora cross-cutting de UI (Layout V2, helpers de `saleCompositionDisplay`, `usePreviewFlow`, `selectInvoiceLineView`) se valida primero en Factura y después se reutiliza tal cual en las hermanas.

---

# 🧭 REGLA FINAL

👉 Si el frontend modifica un precio → está mal
👉 Si el frontend corrige un cálculo → está mal
👉 Si el frontend no coincide con backend → el problema NO se arregla en frontend
👉 Si el frontend clampa un negativo del motor → está mal

---
