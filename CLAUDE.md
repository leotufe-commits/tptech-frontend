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

```bash id="b2d7n1"
npm run dev
npm run build
npm run lint
npm run preview
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

* Moneda: `1,00`
* Pureza: `0,000`
* Usar `toLocaleString("es-AR")`

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

# 🧭 REGLA FINAL

👉 Si el frontend modifica un precio → está mal
👉 Si el frontend corrige un cálculo → está mal
👉 Si el frontend no coincide con backend → el problema NO se arregla en frontend

---
