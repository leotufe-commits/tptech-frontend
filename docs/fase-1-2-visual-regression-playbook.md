# Fase 1.2 — Playbook de Visual Regression

> **Objetivo**: detectar a ojo cualquier cambio visual o numérico que la
> migración a "frontend reader-only" introduzca, antes de mergear cada paso.
>
> **Quién lo corre**: el operador (humano). No automatizable hoy.
>
> **Cuándo**: una vez al **inicio** de Fase 1.2 (baseline) + después de
> **cada paso** de migración (si tocó la pantalla).

---

## 1. Setup inicial (una sola vez)

### 1.1 Levantar entorno
```bash
# Terminal 1 — backend
cd tptech-backend
npm run dev

# Terminal 2 — frontend
cd tptech-frontend
npm run dev
# ↑ abre http://localhost:5173
```

### 1.2 Login
Usar la cuenta habitual del operador (cualquier joyería de prueba sirve).

### 1.3 Confirmar feature flag (default OFF)
1. Abrir la consola del navegador (F12).
2. Ejecutar:
   ```js
   __tptechFlags.list()
   // → { tptech_pricing_strict_v1: false }
   ```
3. Si está en `true`, ejecutar:
   ```js
   __tptechFlags.disable("tptech_pricing_strict_v1")
   ```

### 1.4 Crear directorio de screenshots
```bash
mkdir tptech-frontend/docs/screenshots
```
Dentro creá las subcarpetas a medida que avances:
- `baseline-flag-off/`        ← captura inicial
- `step-1-splitLineDiscounts/` ← post-migración paso 1
- `step-2-round2-passthrough/`
- `step-3-r2-article-path/`
- `step-4-shipping-legacy/`
- `step-5-calcLineTotals/`

---

## 2. Datos de prueba (un solo artículo, 9 escenarios)

Para minimizar variabilidad, **usar siempre el mismo artículo** en todos los
casos. Si no existe, creá uno con esta receta — UNA SOLA VEZ:

### Artículo de referencia: "Anillo Test QA"

Configuración mínima:
- **Nombre**: `Anillo Test QA`
- **Tipo**: PRODUCT
- **Composición de costo**:
  - 1 línea METAL: 5 g del metal "Oro 18k" a $200/g (cost = $1000)
  - 1 línea HECHURA: 1 unidad × $200 (cost = $200)
- **Costo total**: $1200
- **Lista de precios aplicada**: METAL_HECHURA con margen 30% metal, 50% hechura
- **Impuestos manuales**: IVA 21% (creado en Configuración / Impuestos)

### Si ya tenés otro artículo
Usá el que tengas. Lo que importa es **mantener el MISMO artículo** entre
captures: la regresión se ve en el delta entre OFF/ON con el mismo input.

---

## 3. Los 9 casos de captura

Cada caso = una combinación de inputs distinta sobre el mismo artículo.

| # | Caso | Pantallas a capturar | Inputs específicos |
|---|------|----------------------|---------------------|
| 1 | Producto simple | Simulador + Factura | qty=1, sin descuento, sin canal, sin cupón |
| 2 | IVA 21% | Simulador + Factura | qty=1, verificar que aparezca el desglose IVA |
| 3 | Promoción | Simulador + Factura | aplicar promo activa (ej: "Descuento 10%") |
| 4 | Quantity discount | Simulador + Factura | qty=10 con descuento por cantidad configurado |
| 5 | Override manual | Factura (POS) | overridear precio manual = $999 |
| 6 | Metal + hechura | Simulador + Factura | verificar TPPriceCompositionKpis con desglose |
| 7 | Moneda extranjera | Simulador + Factura + ArticleModal/Costos | seleccionar USD en el dropdown de moneda |
| 8 | Shipping | Factura | agregar shipping con `mode=BY_WEIGHT, weight=2kg` |
| 9 | Redondeo lista | Simulador | usar lista con redondeo a 50 o 100 |

### Pantallas que importan (foco visual)

Para cada caso, capturar **solo** los componentes críticos:

- **Simulador** (`/articulos/:id` → tab "Pricing Simulator"):
  - Bloque "Composición Metal/Hechura"
  - Bloque "Totales del documento"
  - Bloque "Impuestos"
- **Factura ventas** (`/ventas/facturas/nuevo`):
  - Card "Totales" superior (TPDocumentTotalsCard)
  - Hero de composición (TPDocumentTotalsHero) con las 4 filas
    Lista / Descuento / Impuestos / Total
  - Panel SalePricingPanel si visible
- **ArticleModal/Costos** (solo Caso 7 con USD): la card de costos del artículo

Capturar SOLO el área del card, no toda la pantalla — facilita el diff visual.

---

## 4. Cronograma de captures

### 📸 BASELINE (antes del primer commit de Fase 1.2)

**Flag OFF** — captura completa de los 9 casos × 2 pantallas = 18 screenshots.

Naming:
```
docs/screenshots/baseline-flag-off/
  caso-01-producto-simple_simulador.png
  caso-01-producto-simple_factura.png
  caso-02-iva21_simulador.png
  caso-02-iva21_factura.png
  ...
  caso-09-redondeo-lista_simulador.png
```

Esto es el "antes" inmutable. Si una migración futura cambia algo, lo
detectamos comparando contra esta carpeta.

### 📸 Post-migración (después de cada paso de Fase 1.2)

**Re-capturar SOLO las pantallas que el paso tocó** en ambos flags:

| Paso F1.2 | Pantalla afectada | Capturar |
|-----------|-------------------|----------|
| 1. splitLineDiscounts → passthrough | SalePricingPanel (Factura) | factura, en flag OFF y ON |
| 2. round2 → passthrough | TPDocumentTotalsHero (Factura) | factura, en flag OFF y ON |
| 3. r2 simulador → eliminar | Simulador | simulador, en flag OFF y ON |
| 4. resolveLegacyShipping → eliminar | Factura con shipping | caso 8, en flag OFF y ON |
| 5. calcLineTotalsFromSnapshot → "—" | Factura durante edit | factura caso 1, en flag OFF y ON |

Naming:
```
docs/screenshots/step-1-splitLineDiscounts/
  caso-01-producto-simple_factura_OFF.png
  caso-01-producto-simple_factura_ON.png
  caso-02-iva21_factura_OFF.png
  caso-02-iva21_factura_ON.png
  ...
```

### 📸 Final (cierre de Fase 1.2)

Re-capturar **los 9 casos × 2 pantallas con flag ON** una última vez.
Comparar contra baseline OFF. Si todo es idéntico (excepto skeleton "—"
durante debounce), Fase 1.2 cierra.

---

## 5. Cómo flippear el flag durante captures

```js
// Activar (estado MIGRADO)
__tptechFlags.enable("tptech_pricing_strict_v1")
location.reload()  // refrescar para que la pantalla re-monte

// Desactivar (estado LEGACY)
__tptechFlags.disable("tptech_pricing_strict_v1")
location.reload()
```

---

## 6. Cómo capturar (Windows)

- **Snipping Tool** (Win+Shift+S) → seleccionar área → pegar en Paint y
  guardar como PNG.
- O usar la extensión "GoFullPage" / "FireShot" del navegador para
  captures más fieles.
- Resolución del navegador: **mantener constante** entre captures
  (recomendado: 1280×800, devtools cerrado).

---

## 7. Cómo comparar (qué buscar)

### ✅ Lo que DEBE mantenerse igual entre OFF y ON

- Todos los **importes** (mismo número, mismo formato `1.234,56`)
- Todos los **labels** (Subtotal, Total, Impuestos, etc.)
- Todos los **breakdown** (composición metal/hechura per-componente)
- El **orden** de las filas
- Los **colores** y tonos (success, warning, danger)

### 🔄 Lo que PUEDE cambiar (esperable)

- Aparición transitoria de "—" durante el debounce (≤350ms) — es OK
- Mensajes "No aplicado" → "—" en filas vacías (mejora visual aceptable)

### 🚨 Lo que es REGRESIÓN (no mergear)

- Importes que difieren ≥ 0.01 entre OFF y ON
- Importes que difieren entre Simulador y Factura para el mismo input
- Filas que desaparecen o cambian de label
- Colores tone que cambian (ej: success → danger en saldo)
- Cards que se rompen visualmente (overflow, layout shift)

---

## 8. Cómo reportar regresión

Si encontrás una regresión:

1. Capturar el caso en OFF y ON (mismo nombre + sufijo `OFF`/`ON`).
2. Crear archivo `docs/screenshots/REGRESSIONS-step-N.md` con:
   ```
   ## Caso X — <nombre>
   - **Pantalla**: Factura / Simulador
   - **Regresión observada**: <qué número/visual cambió>
   - **Esperado**: <captura OFF>
   - **Actual**: <captura ON>
   - **Causa probable**: <hipótesis>
   ```
3. Flippear el flag a OFF en producción inmediatamente
   (`__tptechFlags.disable(...)` desde DevTools).
4. Reportar al canal de pricing.

El paso de migración correspondiente NO se mergea hasta que se cierre la
regresión.

---

## 9. Tiempos esperados

| Actividad | Tiempo |
|-----------|--------|
| Setup inicial (1.1 a 1.4) | 5 min |
| Crear artículo de referencia (3) | 10 min |
| Captura BASELINE completa (18 fotos) | 30-45 min |
| Captura post-migración (5 fotos × 2 flags) | 10 min por paso |
| Comparación visual por paso | 5 min |
| **Total Fase 1.2 visual** | **~2 hs** |

---

## 10. Checklist resumen

- [ ] Setup entorno (1.1 a 1.4) hecho
- [ ] Artículo de referencia listo
- [ ] Carpeta `docs/screenshots/baseline-flag-off/` creada con 18 PNG
- [ ] Paso 1 migrado: `step-1-splitLineDiscounts/` con 2 PNG (OFF + ON), comparación OK
- [ ] Paso 2 migrado: `step-2-round2-passthrough/` con captures, comparación OK
- [ ] Paso 3 migrado: `step-3-r2-article-path/` con captures, comparación OK
- [ ] Paso 4 migrado: `step-4-shipping-legacy/` con captures, comparación OK
- [ ] Paso 5 migrado: `step-5-calcLineTotals/` con captures, comparación OK
- [ ] Captura final con flag ON de los 9 casos
- [ ] Comparación final ON vs baseline OFF: cero regresiones
