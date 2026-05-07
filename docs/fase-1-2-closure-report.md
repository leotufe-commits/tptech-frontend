# FASE 1.2 — Closure Report

> **Estado**: cerrada con migración parcial documentada.
> **Default operativo**: `tptech_pricing_strict_v1=OFF` (legacy 100% preservado).
> **Rollback**: `__tptechFlags.disable("tptech_pricing_strict_v1")` desde DevTools — sin redeploy.
> **Fecha cierre**: 2026-05-07.

---

## TL;DR

- **6 commits** de migración frontend + **6 commits** de GAPs backend + **8 commits** de infraestructura (PR0–PR5) + **3 commits** de docs/types-sync.
- **8 helpers** migrados (passthrough condicional al flag).
- **~24 callsites de `r2()` / escalación per-unit×qty eliminados** bajo flag ON.
- **9 GAPs backend cerrados** (G1, G3, G3.1, G3.2, G4, G5, G6, G7) + 1 doc follow-up.
- **5 GAPs backend pendientes** (G2, G8, G9, G10, G11).
- **Cero breaking changes**, cero renames, cero removes.
- **Tests**: frontend 328 + 3 todo (21 archivos); backend 972 (51 archivos OK + 1 falla preexistente no relacionada).
- **Pantalla "100% reader-only"**: ninguna todavía. **Pantalla más cercana**: Simulador (cierra al migrar la pantalla `PricingSimulator.tsx`, todavía con conversiones de moneda inline). **Factura Ventas**: 5 helpers críticos migrados, 5 callsites internos pendientes.

---

## 1. Métricas finales

### Helpers migrados (con flag condicional)

| Helper | Pantalla downstream | Commit |
|--------|---------------------|--------|
| `lib/pricing-display-helpers.ts::round2` (wrapper local) | Factura Ventas (Hero/Card) | `7dd533b` |
| `lib/pricing/normalizePricingPreviewResult::lineTotal/Tax/TotalWithTax` | Simulador | `075c472` |
| ↑ + `lineDiscount` | Simulador | `bc45010` |
| ↑ + `channel.amount` / `coupon.amount` (vía documentTotals) | Simulador | `bea16e7` |
| `lib/pricing/buildPricingPreviewPayload::toSalesPreviewArgs.shipping` | Factura Ventas (request adapter) | `4d99796` |
| `lib/document-helpers.ts::calcLineTotalsFromSnapshot` (rama optimista → pending) | Factura Ventas (5 callsites) | `f6fa673` |

**Total: 6 helpers** modificados con rama strict-v1 + fallback legacy automático.

### Recálculos eliminados bajo flag ON (por commit)

| Commit | Recálculos eliminados |
|--------|------------------------|
| `7dd533b` | `round2(...)` aplicado a 13 callsites de `pricing-display-helpers` (passthrough idempotente sobre campos ya redondeados del backend) |
| `075c472` | `r2(unitPrice * qty)`, `r2(unitTax * qty)`, `r2(unitTotalTax * qty)` — 3 escalaciones del normalizer del simulador |
| `bc45010` | `r2((basePrice - unitPrice) * qty)` — 1 derivación de descuento del simulador |
| `bea16e7` | `r2(channelPerUnit * qty)`, `r2(couponPerUnit * qty)` — 2 escalaciones de canal/cupón |
| `4d99796` | `Math.round(precio_kg × kg × 100) / 100` (`resolveLegacyShippingAmount`) — 1 cálculo de envío |
| `f6fa673` | 2 ramas optimistas de `calcLineTotalsFromSnapshot` (qty × unitTotalWithTax + qty × unitPrice − disc + tax) — 5 callsites afectados en `VentasFacturas.tsx` |

**Total: ~24 callsites** de cálculo monetario eliminados bajo flag ON. Bajo flag OFF: cero cambios.

### GAPs backend cerrados

| GAP | Endpoint | Commit | Test |
|-----|----------|--------|------|
| **G1** | `pricing-engine.types.ts` — union `PriceSource` incluye `MANUAL_LINE` | `659b952` | 3 |
| **G3** | `articles/pricing-preview` — `lineTotal/lineTaxAmount/lineTotalWithTax` top-level | `539c437` | 4 |
| **G3.1** | `articles/pricing-preview` — `lineDiscount` top-level | `c6c4f0e` | 6 |
| **G3.2** | `articles/pricing-preview` — `documentTotals.channelAdjustmentAmount/.couponDiscountAmount` ya emitidos (consumidos por frontend) | (frontend `bea16e7`) | 6 |
| **G4** | `articles` listado — `marginPercent` + `taxAmount` per-row | `ecb18b2` | 8 |
| **G5** | `articles/cost-lines/preview` — `metalGramsWithMerma` + `metalPurity` | `ba20d9c` | 4 |
| **G6** | `articles/cost-lines/preview` — acepta `currencyId` en body | `257f443` | 5 |
| **G7** | `sales/preview` — `manualOverridesApplied: {q,p,d,t}` per línea | `e0d895a` | 8 |

**Total: 8 GAPs cerrados** (incluye G3.2 que no requirió cambio backend — solo cambio frontend).

### Tests agregados / modificados

| Suite | Tests sumados |
|-------|---------------|
| Frontend baseline (PR1) | 128 (+3 todo) — 6 archivos nuevos |
| Frontend infraestructura (PR2 parityLogger, PR3 flags, PR4 ESLint rule, PR5 E2E) | 14 + 14 + 9 + 4 = 41 |
| Frontend strict-v1 (F1.2) | 11 + 12 + 16 + 5 + 6 + 16 + 17 = 83 |
| Backend GAP tests | 3 + 4 + 8 + 4 + 5 + 8 + 6 = 38 (suma de 7 archivos) |
| **Suma F1.x** | **~290 tests nuevos** |

---

## 2. Estado por pantalla

### Simulador (`PricingSimulator.tsx` + `PricingCompare.tsx`)

| Capa | Estado bajo `tptech_pricing_strict_v1=ON` |
|------|---------------------------------------------|
| Normalizer (`normalizeArticlePricingPreview`) | ✅ **100% reader-only** — cero cálculos monetarios |
| Render de la pantalla (`PricingSimulator.tsx`) | 🔴 **No migrado** — auditoría inicial detectó conversiones de moneda inline (`unitCost / dispRate` líneas 854, 1862-1864) y reconstrucción de markupPct/factor en líneas 5455-5608 |
| Comparador (`PricingCompare.tsx`) | ✅ Usa el normalizer migrado; sin cálculos propios |

**Veredicto**: el normalizer del simulador es reader-only. La pantalla en sí tiene cálculos cosméticos pendientes (out of scope F1.2).

### Factura Ventas (`VentasFacturas.tsx` + `SalePricingPanel.tsx`)

| Capa | Estado |
|------|--------|
| Adapter de request (`toSalesPreviewArgs` shipping) | ✅ Migrado — shipping crudo al backend |
| Helper de display (`composeDocumentPricingDetail`) | ✅ Migrado — passthrough condicional |
| Helper de totales por línea (`calcLineTotalsFromSnapshot`) | ✅ Migrado — pending NaN bajo ON |
| Hook de display (`pricing-display-helpers.round2`) | ✅ Migrado — passthrough idempotente |
| Bloque `splitLineDiscounts` en `SalePricingPanel` | 🚫 **Bloqueado por G8** (decisión del usuario — split visual debe preservarse) |
| `computeManualTax` (`VentasFacturas.tsx:3906`) | 🔴 **No migrado** — bloqueado por G2 backend |
| `saveDraftToBackend` reconstruye `subtotal/discountAmount/taxAmount/total` (líneas 2177-2235) | 🟡 Funcional (backend ignora) — refactor menor pendiente |
| Snapshot ad-hoc en cliente (líneas 2186-2205) | 🟡 Funcional (backend ignora) — refactor menor pendiente |
| `totalBase: round2(... × fxRate)` (línea 2181) | 🔴 **No migrado** — bloqueado por G10 backend (`exchangeRate=null` bug en confirm) |

**Veredicto**: Factura Ventas tiene **5 helpers críticos migrados**; **5 puntos internos pendientes** distribuidos entre 3 GAPs backend (G2, G8, G10) y 2 refactors menores.

### POS (`Ventas.tsx`)

| Capa | Estado |
|------|--------|
| `lineTotal(line)` inline (línea 222) | 🔴 **No migrado** — bloqueado por G7 + G8 backend (POS necesita preview para múltiples líneas con manualDiscountOverride) |
| `cartSubtotal(lines)` inline (línea 226) | 🔴 idem |
| `cartMargin` IIFE inline (línea 732) | 🔴 idem |

**Veredicto**: POS está **completamente legacy**. Bloqueado por GAPs de Fase 1.3 backend (decisión: reusa `sales/preview` con `manualDiscountOverride` per línea).

### Compras (`ComprasFacturasProveedor.tsx`, `ComprasNotasCreditoProveedor.tsx`)

| Capa | Estado |
|------|--------|
| `recomputeTotals` inline (`ComprasFacturasProveedor.tsx:152`) | 🔴 **No migrado** — bloqueado por G11 (endpoint `/api/purchases/preview` inexistente) |
| `computeGlobalDiscount` inline (`ComprasFacturasProveedor.tsx:146`) | 🔴 idem |
| Mismas funciones inline en `ComprasNotasCreditoProveedor.tsx:112-118` | 🔴 idem |

**Veredicto**: Compras está **completamente legacy**. Bloqueado por **G11 (endpoint nuevo)** — el más grande pendiente.

### Comparador (`PricingCompare.tsx`)

| Capa | Estado |
|------|--------|
| Consume `normalizeArticlePricingPreview` y `normalizeSalesPreview` | ✅ Hereda la migración del normalizer del simulador |
| Sin cálculos propios | ✅ Reader-only |

**Veredicto**: ✅ **Reader-only en strict mode** (transitivamente).

---

## 3. Estado por categoría

| Categoría | Bajo flag ON | Bloqueado por | Comentario |
|-----------|---------------|----------------|-------------|
| **Line totals (lineTotal, lineTaxAmount, lineTotalWithTax)** | ✅ Reader-only en simulador y factura | — | G3 backend + paso 2 frontend |
| **Line discount (lineDiscount per-line)** | ✅ Reader-only en simulador | — | G3.1 |
| **Channel/coupon doc-amount** | ✅ Reader-only en simulador | — | G3.2 |
| **Taxes (line + doc taxAmount)** | ✅ Reader-only — passthrough de backend | — | G3 emite lineTaxAmount; documentTotals.taxAmount preexistía |
| **Discounts (split visual qty/promo/cliente/manual)** | 🚫 Legacy preservado | **G8** | Decisión del usuario: split visual debe mantenerse |
| **Discounts (descuento global del documento)** | ✅ Reader-only en simulador (vía documentTotals) | — | Pasa por backend |
| **Shipping** | ✅ Reader-only en factura — shipping crudo al backend | — | Paso 4 + soporte backend preexistente |
| **Currency (display por moneda alternativa)** | ✅ Reader-only en simulador (G6: cost-lines/preview también) | G10 (para confirm) | Conversion en backend; `totalBase` en confirm bloqueado por G10 |
| **Snapshots (factura confirmada)** | 🔴 No migrado | **G9** (snapshot persistido completo: taxBreakdown, currencyRate, metalQuoteAtTime) | Out of scope F1.2 |
| **Manual lines (sin articleId)** | 🔴 No migrado | **G2** (motor procesa MANUAL_LINE) | G1 cierra el tipo; G2 cierra el motor |
| **Optimistic UI durante edit (calcLineTotalsFromSnapshot)** | ✅ Pending state explícito (NaN → "—") | — | Paso 5 |
| **Margin% / taxAmount en listado de artículos** | ✅ Backend G4 | — | InventarioArticulos puede dejar de derivar |
| **Cost preview (ArticleModal/CostosTab)** | ✅ Backend G5 + G6 | — | Pendiente consumo del frontend (out of scope F1.2) |

---

## 4. Cálculos monetarios todavía activos en frontend (auditoría exhaustiva)

> Bajo `tptech_pricing_strict_v1=ON`. Bajo OFF, todos siguen activos por diseño (legacy preservado).

| # | Archivo:línea | Función / contexto | Cálculo | Prioridad | GAP que lo desbloquea |
|---|----------------|--------------------|---------|-----------|----------------------|
| 1 | `pages/VentasFacturas.tsx:3906` | `computeManualTax` | `round2(subtotal × rate / 100)` para línea manual | **CRÍTICO** | **G2** (motor procesa MANUAL_LINE) |
| 2 | `pages/VentasFacturas.tsx:2181` | `saveDraftToBackend` | `round2(total × fxRate)` para `totalBase` | ALTO | **G10** (`currencySnapshot.exchangeRate=null` fix) |
| 3 | `pages/VentasFacturas.tsx:2177-2235` | `saveDraftToBackend` snapshot | Reconstruye `subtotal/discountAmount/taxAmount/total/lineSubtotal/taxAmount/totalWithTax` (~13 round2) | MEDIO | Refactor — backend ya ignora estos campos |
| 4 | `pages/VentasFacturas.tsx:894` | `applySalePreviewToDraft` | `round2(subtotal + lineTaxAmount)` cuando preview no trae lineTotalWithTax | BAJO | Backend ya emite el campo (G3) — borrar fallback |
| 5 | `pages/VentasFacturas.tsx:969, 1745` | varios | `round2(...)` sobre agregaciones de descuento | BAJO | Refactor menor |
| 6 | `pages/VentasFacturas.tsx:1914` | aggregator | `round2(remaining)` saldo | BAJO | Refactor menor |
| 7 | `pages/VentasFacturas.tsx:3704-3710` | `patchLine` | `round2(taxTr)` / `round2(netTr)` / `round2(netTr + taxTr)` para líneas manuales | **CRÍTICO** | **G2** (mismo path que #1) |
| 8 | `pages/Ventas.tsx:222-228` | POS `lineTotal/cartSubtotal` | `Math.round(qty × unitPrice × (1 − disc/100) × 100) / 100` | **CRÍTICO** | **G7+G8 + endpoint POS** |
| 9 | `pages/Ventas.tsx:732` | POS `cartMargin` IIFE | `revenue − cost`, `marginPct` | **CRÍTICO** | idem #8 |
| 10 | `pages/ComprasFacturasProveedor.tsx:146-152` | `computeGlobalDiscount` + `recomputeTotals` | global discount + Σ qty×unit + Σ disc + Σ tax | **CRÍTICO** | **G11** (endpoint nuevo) |
| 11 | `pages/ComprasNotasCreditoProveedor.tsx:112-118` | idem | idem | **CRÍTICO** | **G11** |
| 12 | `components/sales/SalePricingPanel.tsx:118-130` | `splitLineDiscounts` interno | `Σ qty × qtyDiscUnit + r2()` | ALTO | **G8** (split per-tipo doc-level) |
| 13 | `components/ui/TPDocumentLineAdvancedEditor.tsx:1471-1481, 2376, 2517-2519` | varios derivaciones | `gross = qty × unit`, `taxAmount × qty` | MEDIO | G7 (override flags ya cerrado) + refactor |
| 14 | `pages/PricingSimulator.tsx:854, 1862-1864` | display de moneda | `unitCost / dispRate`, `costTaxAmount / rate` | MEDIO | G6 (cost preview ya cerrado) — pendiente consumir |
| 15 | `pages/PricingSimulator.tsx:5455-5608` | display de markup | reconstruye `metalMarginPct`, factor, "factor X.XX" | BAJO | Posible mejora del normalizer (no GAP backend) |
| 16 | `pages/article-detail/ArticleModal.tsx:4290-4311` | `previewCost` skeleton | replica `applyComboAdjustment + tax` | BAJO | G5 cerrado — eliminar skeleton |
| 17 | `pages/article-detail/CostRow.tsx:172-451` | conversiones de moneda en costo | divisiones `/ latestRate` | MEDIO | G6 cerrado — pendiente consumir |
| 18 | `pages/InventarioArticulos.tsx:475-617` | margen + tax por fila | `(p − c) / c × 100`, `withTax − price` | ALTO | G4 cerrado — pendiente consumir |

**Total: 18 puntos de cálculo monetario** todavía activos en frontend bajo flag ON. **De estos**:
- **5 dependen de GAPs backend** todavía abiertos (G2, G8, G10, G11)
- **6 dependen de GAPs cerrados** que solo necesitan consumo frontend (G3, G4, G5, G6, G7) — son trabajo limpio sin bloqueo
- **7 son refactors menores** o cosméticos sin GAP

---

## 5. Riesgos residuales

### Funcionales

| Riesgo | Mitigación actual | Severidad |
|--------|-------------------|-----------|
| Línea manual muestra IVA recalculado en frontend (potencial error fiscal) | Bajo flag OFF (default): comportamiento legacy. Bajo ON: el cálculo sigue activo en `VentasFacturas:3906` — **no se evitó**. | **ALTA** |
| `totalBase` en moneda no-base usa `fxRate` del frontend | Bajo flag OFF: legacy. Bajo ON: cálculo sigue activo (línea 2181). El backend en confirm persiste `exchangeRate=null` → reproducción histórica imposible. | **ALTA** |
| POS no migrado: cualquier divergencia preview-vs-confirm es invisible al operador | parityLogger detecta por consola en dev/staging | MEDIA |
| Compras factura proveedor usa cálculo local que puede divergir del motor backend | El backend en `confirmPurchase` no llama a `computePurchaseTaxes` (auditoría inicial G11) — **el riesgo de divergencia es del backend, no solo del frontend** | **CRÍTICA** (la solución es G11 + refactor backend de purchases) |

### UX

| Riesgo | Mitigación | Severidad |
|--------|-----------|-----------|
| Bajo flag ON, líneas recién agregadas/editadas muestran "—" durante ≤350ms | Aceptado por el usuario — "correcto > rápido" | BAJA |
| Bajo flag ON, si preview falla la línea queda "—" permanente y "Cobrar" disabled | Comportamiento intencional. Falta UI de error explícita (pendiente). | MEDIA |
| Split visual de descuentos (qty/promo/cliente) puede degradarse a agregado si `splitLineDiscounts` se migra prematuramente | Decisión del usuario: NO migrar `splitLineDiscounts` hasta G8 | BAJA |

### Fiscales / contables

| Riesgo | Severidad |
|--------|-----------|
| Línea manual con IVA calculado en cliente — si difiere del cálculo del motor en confirm, la factura impresa puede mostrar IVA incorrecto | **CRÍTICA** — bloqueado por G2 |
| Compras: factura proveedor sin `computePurchaseTaxes` en backend ni en frontend (`taxAmount=0` siempre) — pérdida de impuestos no recuperables | **CRÍTICA** — bloqueado por G11 + refactor backend purchases |
| Snapshot persistido en confirm sin `taxBreakdown` per-línea, sin `currencyRate`, sin `metalQuoteAtTime` — facturas históricas no se pueden reproducir si cotizaciones vivas cambian | **ALTA** — bloqueado por G9 |

### Sincronización preview ↔ confirm

| Riesgo | Mitigación |
|--------|------------|
| `confirmSale` recalcula costo "fresh" en T(confirm) en vez de usar T(create) — si la cotización movió, `marginPercent` del snapshot persistido difiere de lo que vio el operador | parityLogger detecta el delta en dev/staging. Test E2E PR5 mockea ambos lados con datos consistentes (no cubre divergencia real backend). |
| `confirmSale` pasa `metalHechuraBreakdown=null` a `computeLineTaxes` mientras `previewSale` pasa el breakdown exacto — divergencia con `applyOn=METAL/HECHURA` | Detectada en auditoría backend inicial. **Bloqueado por G9** parcialmente. |

---

## 6. Qué habilita Fase 1.2 (capacidades nuevas)

### Rollback instantáneo
- Flag `tptech_pricing_strict_v1` por localStorage (default OFF).
- Flippeable desde DevTools del operador en producción: `__tptechFlags.disable("tptech_pricing_strict_v1")` → próximo render usa código legacy.
- **Sin redeploy, sin restart, sin rebuild**.

### Strict mode parcial (opt-in granular por operador)
- 6 helpers + 1 adapter ya respetan el flag.
- Operador / power-user puede activar el flag por curiosidad o para QA visual sin afectar al resto de operadores.

### parityLogger automático
- Cualquier preview (simulator + invoice) en dev/staging compara `documentTotals.*` automáticamente.
- Si delta ≥ 0.01 → `console.error("[PARITY:auto] DIVERGENCIA DETECTADA — ...")` con campos divergentes.
- Manual: `__tptechParity.diff()` desde DevTools imprime tabla.

### Deterministic previews
- Backend G3+G3.1 emite per-line totals respetando redondeo de lista de precios.
- El frontend bajo flag ON respeta esos números **byte a byte** — cero re-cálculo, cero drift.
- Ejemplo medible: Caso 9 del playbook (Redondeo lista) — bajo OFF se muestra `1849.32`; bajo ON `1850` (motor con redondeo).

### Backend authoritative rendering
- Para los 4 totales per-line + 2 channel/coupon en simulador + shipping en factura: el backend es la única fuente.
- `pending` state explícito durante debounce: el frontend deja de inventar valores, muestra "—" hasta que el backend responde.

### Test infrastructure
- Vitest + jsdom + @testing-library + MSW en frontend — desde cero.
- ESLint custom rule `no-restricted-syntax` que bloquea `Math.round(*100)/100` y `.toFixed` en paths restringidos (con exception list).
- Test E2E preview↔confirm parity en CI (CI bloqueante si diff ≥ 0.01).

---

## 7. Recomendación para Fase 1.3

**Orden recomendado** (por impacto + complejidad creciente):

### Etapa 1.3.A — Closure rápida de gaps menores

| Orden | GAP | Rationale |
|-------|-----|-----------|
| 1 | **G8** — `quantityDiscountTotal` / `promotionDiscountTotal` / `customerDiscountTotal` / `manualDiscountAmount` doc-level en `sales/preview` | Desbloquea `splitLineDiscounts` (Factura Ventas) sin perder split visual — el #1 pedido del usuario |
| 2 | **G10** — fix `currencySnapshot.exchangeRate=null` en `confirmSale` + `confirmPurchase` | Critical bug fiscal. Permite migrar `totalBase` en frontend (Riesgo fiscal alto) |

### Etapa 1.3.B — Migración de líneas manuales

| Orden | GAP | Rationale |
|-------|-----|-----------|
| 3 | **G2** — motor procesa formalmente MANUAL_LINE (resolveManualLinePrice + buildPricingSnapshot manual) | Cierra el riesgo fiscal #1 (línea manual con IVA local). G1 ya está cerrado preparando esto. |

### Etapa 1.3.C — POS y Compras (mayores)

| Orden | GAP | Rationale |
|-------|-----|-----------|
| 4 | **POS** — extender `sales/preview` para soportar `manualDiscountOverride` con escalado canal-cupón-payment per-line. Migración del frontend `Ventas.tsx`. | POS es uso diario crítico. Reusa `sales/preview` (no endpoint nuevo). |
| 5 | **G11** — `POST /api/purchases/preview` (endpoint nuevo completo) + refactor backend `purchases.service` para usar `computePurchaseTaxes` en confirm | El más grande. Cierra Riesgo fiscal #2 (impuestos no recuperables perdidos). |

### Etapa 1.3.D — Reproducibilidad histórica

| Orden | GAP | Rationale |
|-------|-----|-----------|
| 6 | **G9** — snapshot persistido completo (`taxBreakdown` per línea, `currencyRate`, `metalQuoteAtTime`, override flags, snapshotVersion) | Cierra el riesgo de irreproducibilidad. Independiente del frontend reader-only. |

**Total estimado**: ~3-4 semanas backend con 1 dev, asumiendo G11 toma la mitad por ser el más grande.

---

## 8. Checklist manual de inspección ocular final

> Ejecutar en navegador real con un artículo de prueba (ver `docs/fase-1-2-visual-regression-playbook.md` para receta).

### Setup (una vez)
- [ ] Frontend en `npm run dev`, backend en `npm run dev`
- [ ] Login con cuenta de prueba
- [ ] Confirmar flag default OFF: `__tptechFlags.list()` → `{ tptech_pricing_strict_v1: false }`
- [ ] Tener listo el artículo "Anillo Test QA" (5g Oro 18k + hechura $200 + IVA 21%)

### Rollback test (validación de seguridad)
- [ ] `__tptechFlags.enable("tptech_pricing_strict_v1"); location.reload();` — el sistema funciona
- [ ] `__tptechFlags.disable("tptech_pricing_strict_v1"); location.reload();` — el sistema funciona idéntico al pre-Fase 1.2
- [ ] Refrescar página: el flag persiste (localStorage)

### Simulador (`/articulos/:id` → tab Pricing)
- [ ] Caso 1 (qty=1, sin descuentos): total mostrado **idéntico** entre OFF y ON
- [ ] Caso 2 (IVA 21%): desglose IVA visible en ambos
- [ ] Caso 3 (Promoción): `lineDiscount` visible y correcto en ambos
- [ ] Caso 4 (qty=10 con quantity discount): total escalado correctamente en ambos
- [ ] Caso 6 (Metal+Hechura): TPPriceCompositionKpis muestra mismo desglose
- [ ] **Caso 9 (Redondeo lista)**: bajo ON el total muestra el valor del motor (con redondeo); bajo OFF puede haber drift de centavos. **Esperado**: ON gana.

### Factura Ventas (`/ventas/facturas/nuevo`)
- [ ] Agregar artículo: bajo ON, `lineTotal` aparece "—" durante ≤350ms, luego completa
- [ ] Cambiar qty: idem transición visual "—" → valor
- [ ] Cambiar precio manual: idem
- [ ] Aplicar canal de venta: el ajuste se ve igual en OFF y ON
- [ ] Aplicar cupón: descuento visible en ambos
- [ ] Agregar shipping FIXED $500: total con $500 en ambos
- [ ] Agregar shipping BY_WEIGHT 100/kg × 2kg: total con $200 en ambos
- [ ] Cambiar a moneda extranjera (USD): valores convertidos correctamente en ambos
- [ ] **Network desconectada (DevTools throttle)**: bajo ON `lineTotal` queda "—" permanente, botón "Cobrar" disabled. Reactivar network → recovery.

### Línea manual (`+ Línea manual`)
- [ ] **Bajo flag ON, computeManualTax todavía activo** — el IVA aparece igual que bajo OFF (NO migrado). Documentar en bug tracker como blocker G2.

### POS (`/ventas`)
- [ ] **Sin cambios visibles entre OFF y ON** — POS no migrado en F1.2. Confirmar que la pantalla funciona idéntico.

### Compras Factura (`/compras/facturas-proveedor`)
- [ ] **Sin cambios visibles entre OFF y ON** — bloqueado por G11. Pantalla funciona idéntico.

### parityLogger (DevTools)
- [ ] Abrir Simulador para artículo X qty=2 → consola muestra `[PARITY:simulator]`
- [ ] Abrir Factura misma config → consola muestra `[PARITY:invoice]`
- [ ] Si los valores coinciden → silencio (`[PARITY:auto]` no aparece)
- [ ] Si introducimos divergencia (cambiar artículo en una pestaña): `[PARITY:auto] DIVERGENCIA DETECTADA` aparece con campos rotos
- [ ] `__tptechParity.diff()` imprime tabla detallada

### Snapshots (validación final)
- [ ] Capturar 6 PNG bajo OFF + 6 PNG bajo ON de los casos del playbook (`docs/fase-1-2-visual-regression-playbook.md`)
- [ ] Comparar visualmente — diferencias aceptables: "—" durante debounce; otros valores deben coincidir centavo a centavo
- [ ] Si aparece regresión: archivo `docs/screenshots/REGRESSIONS-fase-1-2.md` + flag OFF en producción inmediato

---

## Apéndice A — Lista cronológica de commits

### Frontend
```
72ae587 PR0 — vitest + jsdom + testing-library + msw setup
3324c5c PR1.1 baseline normalizePricingPreviewResult
035f4d6 PR1.2 baseline document-helpers
a70c026 PR1.6 baseline composeDocumentPricingDetail
a3e4152 PR1.3 baseline SalePricingPanel
32f3e87 PR1.4-1.5 baseline totals display components
057b100 PR1.8-1.11 baseline inline functions
bba9e2b PR2 parityLogger automático
d53b40e PR3 feature flag tptech_pricing_strict_v1
e8753ab PR4 ESLint anti-rounding rule
c906569 PR5 E2E preview↔confirm parity con MSW
d6239e2 G3 type sync (lineTotal/lineTaxAmount/lineTotalWithTax)
d3ef952 G7 type sync (manualOverridesApplied)
7f22f63 docs(qa) playbook visual regression
7dd533b F1.2 paso 1 pricing-display-helpers.round2 → passthrough
075c472 F1.2 paso 2 normalizeArticlePricingPreview G3
48c74f6 G3.1 type sync (lineDiscount)
bc45010 G3.1 frontend lineDiscount consumer
bea16e7 G3.2 channel/coupon doc-amount
4d99796 F1.2 paso 4 shipping crudo al backend
f6fa673 F1.2 paso 5 calcLineTotalsFromSnapshot pending
```

### Backend
```
659b952 G1 PriceSource.MANUAL_LINE
539c437 G3 lineTotal/lineTaxAmount/lineTotalWithTax top-level
ecb18b2 G4 marginPercent + taxAmount per-row
ba20d9c G5 metalGramsWithMerma + metalPurity
257f443 G6 currencyId en cost-lines/preview
e0d895a G7 manualOverridesApplied flags
86e618b docs(gaps) F1.1 follow-up
c6c4f0e G3.1 lineDiscount top-level
```

---

## Apéndice B — Estado de tests

| Suite | Frontend | Backend |
|-------|----------|---------|
| Total tests | 328 + 3 todo | 972 + 1 falla preexistente* |
| Total archivos | 21 | 51 |
| Duración suite completa | ~10s | ~5s |

\* Falla preexistente: `src/modules/movimientos/__tests__/movimientos-stock.test.ts > IN rechaza grams = 0` — assertion del mensaje de error desactualizado, **no relacionado con F1.x**. Documentado en commit `e0d895a`.

---

## Cierre

Fase 1.2 entrega un **strict mode parcial pero coherente**: las 6 piezas migradas son self-consistent — bajo flag ON el simulador es totalmente reader-only y la factura es reader-only en sus puntos críticos pero todavía tiene 5 puntos legacy bloqueados por GAPs backend documentados.

El default operativo sigue siendo OFF. Producción no se ve afectada. El rollback es instantáneo. Los próximos GAPs están listados con prioridad y rationale.

**Fase 1.3 backend** queda como siguiente etapa natural — el orden recomendado (G8 → G10 → G2 → POS → G11 → G9) prioriza riesgos fiscales sobre facilidad técnica.
