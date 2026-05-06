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
