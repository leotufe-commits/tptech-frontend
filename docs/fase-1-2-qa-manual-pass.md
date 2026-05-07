# Fase 1.2 — QA Manual Pass Harness

> **Quién lo corre**: el operador (humano). No automatizable.
>
> **Cuándo**: antes de abrir Fase 1.3 backend.
>
> **Objetivo**: verificar que `tptech_pricing_strict_v1=ON` se siente
> **estable, sin flicker problemático, sin confusión visual** y que los
> workflows reales no se rompen.
>
> **Tiempo estimado**: ~2 hs (21 casos × 5 min promedio).

---

## Cómo usar este documento

1. Mantenelo abierto en una segunda pantalla (o impreso).
2. Para cada caso: seguí los pasos, **completá la tabla de resultados**.
3. Marcá cada criterio:
   - ✅ acceptable
   - ⚠️ aceptable con observación
   - 🚨 regresión — bloquea merge
4. Al final, completá la tabla resumen + sign-off.
5. Si algún caso da 🚨 → `__tptechFlags.disable("tptech_pricing_strict_v1")` inmediato y reportá.

**Regla**: una sola 🚨 fiscal o de pérdida de datos = NO mergear. Visuales menores = ⚠️ aceptable con TODO.

---

## Setup (una vez, ~5 min)

### Entorno
```bash
# Terminal 1 — backend
cd tptech-backend && npm run dev

# Terminal 2 — frontend
cd tptech-frontend && npm run dev
# → http://localhost:5173
```

### Cuenta + datos de prueba
- Login con cuenta habitual de QA
- Artículo: usá el "Anillo Test QA" del playbook
  (`docs/fase-1-2-visual-regression-playbook.md` §2)
  o un artículo real conocido.
- Cliente: uno con saldo limpio para no contaminar tests.

### DevTools (F12)
- Pestaña **Console** abierta — vamos a ver mensajes `[PARITY:auto]` ahí.
- Pestaña **Network** lista para usar (throttle, block, offline).

### Flag inicial
```js
__tptechFlags.list()
// Esperado: { tptech_pricing_strict_v1: false }
```

---

## Comandos de toggle del flag

```js
// ⬆ ACTIVAR strict mode
__tptechFlags.enable("tptech_pricing_strict_v1");
location.reload();

// ⬇ DESACTIVAR (rollback)
__tptechFlags.disable("tptech_pricing_strict_v1");
location.reload();

// VER estado actual
__tptechFlags.list();

// VER snapshots de paridad
__tptechParity.simulator;
__tptechParity.invoice;
__tptechParity.diff();   // tabla comparativa
```

---

## Cómo simular escenarios de error (DevTools → Network)

| Escenario | Cómo simular |
|-----------|--------------|
| **Preview lento** | Network → Throttle → "Slow 3G" |
| **Preview falla** | Network → Right-click `/api/sales/preview` → "Block request URL" |
| **Offline** | Network → Throttle dropdown → "Offline" |
| **Race conditions** | Tipear muy rápido en qty (>10 caracteres/seg) — debouncer 350ms |

Reset: Throttle → "No throttling", click derecho en URL bloqueada → "Unblock".

---

# A. FACTURA VENTAS (11 casos)

> Pantalla: `/ventas/facturas/nuevo`
> Componentes a observar: TPDocumentTotalsCard, TPDocumentTotalsHero, SalePricingPanel.

## A1 — Agregar línea

**Pre-condición**: Factura nueva vacía.

**Pasos**:
1. Click "+ Línea".
2. Seleccionar artículo "Anillo Test QA" qty=1.
3. Observar el campo `lineTotal` y el `Total` del documento.

**Bajo flag OFF (esperado)**:
- Aparece valor optimista ($1.210,00 inmediatamente o tras debounce ≤350ms).

**Bajo flag ON (esperado)**:
- `lineTotal` muestra "—" durante ≤350ms.
- Luego completa con el valor del backend.
- Total del documento sigue el mismo patrón.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| `lineTotal` valor final | | | |
| Total documento valor final | | | |
| Tiempo percibido pending | n/a | __ ms | |
| Flicker visible | | | |
| Comprensión usuario | | | |
| **Veredicto** | | | ✅ / ⚠️ / 🚨 |

Notas / screenshots:

---

## A2 — Editar qty

**Pre-condición**: Factura con 1 línea ya hidratada.

**Pasos**:
1. Click en el campo qty.
2. Cambiar de 1 a 5.
3. Tab para confirmar.

**Bajo OFF**: el lineTotal se actualiza optimista (qty × unitPrice).
**Bajo ON**: lineTotal va a "—" durante ≤350ms y luego completa.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Transición visual | | | |
| Tiempo pending | n/a | __ ms | |
| Backend match | | | |
| **Veredicto** | | | |

Notas:

---

## A3 — Editar precio (override manual)

**Pasos**:
1. En la línea existente, override del unitPrice de $1000 a $999.
2. Tab.

**Esperado bajo ON**: lineTotal y total documento → "—" → valor.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Indicador "manual override" visible | | | |
| Transición pending | n/a | | |
| Total final | | | |
| **Veredicto** | | | |

Notas:

---

## A4 — Cambiar cliente

**Pasos**:
1. Cambiar el cliente seleccionado (preferentemente uno con regla comercial activa, ej: "Cliente VIP" con 10% off).
2. Esperar refresh del preview.

**Esperado bajo ON**: TODOS los líneas pasan por "—" hasta nuevo preview.
**Crítico**: `customerDiscount` debe aparecer correctamente luego.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Líneas en pending | n/a | | |
| customerDiscount visible post-preview | | | |
| Total documento correcto | | | |
| **Veredicto** | | | |

Notas:

---

## A5 — Cambiar lista de precios

**Pasos**:
1. Override de lista a una lista distinta (ej: "Mayorista" o "Lista Especial").
2. Observar la transición.

**Esperado**: similar a A4 — todas las líneas pasan por pending y luego completan con nuevos precios.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Lista visible en panel | | | |
| Precios actualizados | | | |
| Transición fluida | | | |
| **Veredicto** | | | |

Notas:

---

## A6 — Cambiar moneda (USD si está disponible)

**Pasos**:
1. Cambiar el dropdown de moneda a USD.
2. Observar todos los importes.

**⚠️ Atención especial**:
- `total` y `taxAmount` se convierten en backend.
- `totalBase` se calcula en frontend con `fxRate` (línea 2181) — NO migrado.
- Bajo ON, este `totalBase` debería mostrar valor pero el comportamiento depende de si el draft persiste el cálculo local.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Importes en USD | | | |
| Símbolo $ correcto | | | |
| `totalBase` (en moneda base) | | | |
| **Veredicto** | | | |

Notas:

> **Si `totalBase` difiere entre OFF y ON → es esperado** (G10 backend pendiente; documentar pero no bloquear merge).

---

## A7 — Aplicar shipping

**Pasos**:
1. Agregar shipping FIXED $500.
2. Observar total.
3. Cambiar a BY_WEIGHT con value=100, weight=2.
4. Total debe sumar 200 al subtotal+tax.

**Bajo ON**:
- El payload manda `shipping: { mode, value, weight }` crudo.
- El backend resuelve el monto.
- Visualmente debería ser idéntico a OFF.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Shipping FIXED $500 | | | |
| Shipping BY_WEIGHT 100×2 | | | |
| Total con shipping | | | |
| **Veredicto** | | | |

Notas:

---

## A8 — Aplicar promoción

**Pre-condición**: tener una promoción activa para el artículo (ej: "Black Friday" 10% off).

**Pasos**:
1. Verificar que la promo se aplica automáticamente al artículo.
2. Observar `promotionDiscountAmount` por línea y "Promoción" en el Hero.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Promo visible en línea | | | |
| Monto promo en Hero | | | |
| Total con descuento | | | |
| **Veredicto** | | | |

Notas:

---

## A9 — Aplicar quantity discount

**Pre-condición**: tener un quantity discount configurado para el artículo (ej: 5% off cuando qty ≥ 5).

**Pasos**:
1. Cambiar qty a 5.
2. Observar `quantityDiscountAmount` y la fila "Desc. cantidad" en el Hero.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Discount visible en línea | | | |
| Monto en Hero | | | |
| Split correcto vs promoción | | | |
| **Veredicto** | | | |

Notas:

---

## A10 — Aplicar cupón

**Pre-condición**: cupón válido configurado (ej: "DESC10" — 10% off documento).

**Pasos**:
1. Ingresar el código del cupón.
2. Observar reducción en el total + indicador "Cupón: DESC10".
3. Probar con cupón inválido — debería rechazarse y NO aplicar.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Cupón válido aplicado | | | |
| Monto cupón en Hero | | | |
| Cupón inválido rechazado | | | |
| **Veredicto** | | | |

Notas:

---

## A11 — Cambiar canal de venta

**Pasos**:
1. Cambiar el canal de venta (ej: "Mostrador" → "Web").
2. Observar el ajuste por canal en el Hero.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Canal seleccionado visible | | | |
| Ajuste de canal en Hero | | | |
| Total ajustado | | | |
| **Veredicto** | | | |

Notas:

---

# B. SIMULADOR (5 casos)

> Pantalla: `/articulos/:id` → tab "Pricing Simulator".
> Componentes: bloque Composición Metal/Hechura, Totales del Documento, Impuestos.

## B1 — Redondeo lista (caso destacado)

**Pre-condición**: artículo con lista de precios que tenga redondeo activo (ej: redondeo a 50 o 100).

**Pasos**:
1. Abrir simulador con qty=1.
2. Observar el `lineTotal` o `total`.
3. Cambiar qty a 10.

**Esperado bajo ON**: el valor del backend respeta el redondeo (ej: $1.850).
**Esperado bajo OFF**: el valor escalado en frontend puede diferir por centavos (ej: $1.849,32).

**Crítico**: bajo ON, el valor mostrado debería ser el del motor (más correcto).

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Total qty=1 | | | |
| Total qty=10 | | | |
| Diferencia centavos | | | |
| **Veredicto** | | | |

Notas (capturar especialmente si ON es MÁS correcto que OFF):

---

## B2 — Metal + hechura

**Pasos**:
1. Verificar el bloque "Composición Metal/Hechura".
2. Confirmar que `metalSale` + `hechuraSale` aparecen con sus márgenes.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Bloque visible | | | |
| Metal sale value | | | |
| Hechura sale value | | | |
| Margen metal % | | | |
| **Veredicto** | | | |

Notas:

---

## B3 — Moneda extranjera

**Pasos**:
1. Cambiar el dropdown de moneda a USD.
2. Verificar que TODOS los importes se convierten.

**Crítico**: bajo ON, `lineTotal` viene del backend en USD (ya convertido).
Bajo OFF, el frontend hace la conversión local (`unitCost / dispRate` etc.).

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Símbolo USD visible | | | |
| Importes convertidos | | | |
| Coherencia entre líneas | | | |
| **Veredicto** | | | |

Notas:

---

## B4 — Promociones (en simulador)

**Pasos**:
1. Si el artículo tiene promo activa, debería aplicarse automáticamente.
2. Verificar `promotionDiscountAmount` y el desglose.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Promo aplicada | | | |
| `lineDiscount` correcto | | | |
| Total con descuento | | | |
| **Veredicto** | | | |

Notas:

---

## B5 — Quantity discount (en simulador)

**Pasos**:
1. Cambiar qty a un valor que dispare quantity discount.
2. Verificar el desglose.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| QD aplicado | | | |
| `quantityDiscountAmount` visible | | | |
| Total correcto | | | |
| **Veredicto** | | | |

Notas:

---

# C. COMPARADOR (1 caso)

> Pantalla: `/dev/pricing-compare` (si está accesible) — comparador dev de Simulador vs Factura.

## C1 — Paridad visual Simulador vs Factura

**Pasos**:
1. Abrir comparador con un artículo + qty + canal + cupón.
2. Verificar que las dos columnas (Simulador / Factura) muestran el mismo total.
3. Hacer click `__tptechParity.diff()` en consola — la tabla debería estar toda en `✓`.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Mismo total ambas columnas | | | |
| `diff()` todo verde | | | |
| Sin warnings `[PARITY:auto]` | | | |
| **Veredicto** | | | |

Notas:

> **Si `[PARITY:auto] DIVERGENCIA DETECTADA` aparece** → capturar el mensaje y los valores.

---

# D. CASOS DE ERROR (4 casos)

## D1 — Preview lento (Slow 3G)

**Setup**: DevTools → Network → Throttle → Slow 3G.

**Pasos**:
1. Crear una factura nueva.
2. Agregar un artículo.
3. Cronometrar cuánto tarda el preview.

**Esperado bajo ON**:
- "—" durante varios segundos (Slow 3G ~2-5s).
- Eventualmente completa.
- NO debe haber valores intermedios incorrectos.

**Esperado bajo OFF**:
- Valor optimista visible inmediatamente.
- Se actualiza cuando llega el preview real.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Tiempo hasta valor real | __ s | __ s | |
| Mientras tanto: visible? | | | |
| Confusión usuario | | | |
| **Veredicto** | | | |

Notas:

> **Pregunta clave**: ¿El operador entiende que "—" significa "esperando" o piensa que algo se rompió?

**Reset**: Throttle → No throttling.

---

## D2 — Preview falla (URL bloqueada)

**Setup**: DevTools → Network → click derecho `/api/sales/preview` → "Block request URL".

**Pasos**:
1. Crear factura con artículo.
2. Observar.
3. Intentar click "Cobrar".

**Esperado bajo ON**:
- "—" permanente.
- Botón "Cobrar" disabled (porque `total > 0` falla con NaN).
- ⚠️ Idealmente: indicador visual de error, pero **probablemente NO existe hoy** — anotalo.

**Esperado bajo OFF**:
- Valores optimistas visibles.
- "Cobrar" enabled (RIESGO: confirma con valores no validados por backend).

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Visualmente | | | |
| Cobrar disabled | | | |
| Indicador de error | | | |
| **Veredicto** | | | |

Notas (CRÍTICO si OFF deja confirmar con datos no validados):

**Reset**: Unblock URL.

---

## D3 — Offline

**Setup**: DevTools → Network → Throttle → Offline.

**Pasos**:
1. Crear factura con artículo.
2. Esperar.
3. Reactivar conexión.

**Esperado**: similar a D2 mientras está offline. Al reactivar, debería recuperarse.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Comportamiento offline | | | |
| Recovery al reconectar | | | |
| Indicador offline visible | | | |
| **Veredicto** | | | |

Notas:

**Reset**: Throttle → No throttling.

---

## D4 — Race conditions (typing rápido en qty)

**Pasos**:
1. Crear factura con artículo.
2. En el campo qty, tipear muy rápido: "1" → "12" → "123" → "1234" → "12345" en menos de 350ms.
3. Esperar.

**Esperado**:
- Solo se dispara UN preview al final (debouncer 350ms).
- No hay valores intermedios bloqueando el render.
- El total final es para qty=12345.

**Resultados**:

| Aspecto | OFF | ON | Acceptable? |
|---------|-----|----|-|
| Solo 1 preview disparado | | | |
| Valor final correcto | | | |
| Sin flicker de valores intermedios | | | |
| **Veredicto** | | | |

Notas (verificar en Network tab cuántas requests `/api/sales/preview` salieron):

---

# Tabla resumen

| ID | Caso | OFF | ON | Veredicto | Bug ID |
|----|------|-----|----|-|--------|
| A1 | Agregar línea | ✅ / ⚠️ / 🚨 | | | |
| A2 | Editar qty | | | | |
| A3 | Editar precio | | | | |
| A4 | Cambiar cliente | | | | |
| A5 | Cambiar lista | | | | |
| A6 | Cambiar moneda | | | | |
| A7 | Shipping | | | | |
| A8 | Promo | | | | |
| A9 | Quantity discount | | | | |
| A10 | Cupón | | | | |
| A11 | Canal | | | | |
| B1 | Redondeo lista | | | | |
| B2 | Metal + hechura | | | | |
| B3 | Moneda extranjera | | | | |
| B4 | Promociones simul | | | | |
| B5 | Quantity discount simul | | | | |
| C1 | Paridad comparador | | | | |
| D1 | Preview lento | | | | |
| D2 | Preview falla | | | | |
| D3 | Offline | | | | |
| D4 | Race conditions | | | | |

---

# Sign-off

| Campo | Valor |
|-------|-------|
| Tester | __________ |
| Fecha | __________ |
| Browser + versión | __________ |
| Casos verdes ✅ | __ / 21 |
| Casos amarillos ⚠️ | __ / 21 |
| Casos rojos 🚨 | __ / 21 |
| **Veredicto global** | aprobar F1.2 / bloquear / rollback |

---

# Criterios de aceptación

## Para aprobar Fase 1.2 en producción con flag ON

- ✅ Mínimo **18/21 casos en verde** (≥85%).
- ✅ **Cero 🚨 fiscales o de pérdida de datos**.
- ⚠️ Casos amarillos documentados con bug ID o TODO con fase.
- ✅ Tests automatizados todos verdes (ya validado: 328 + 3 todo).

## Si NO se cumple

- 🚨 fiscal/datos → `__tptechFlags.disable("tptech_pricing_strict_v1")` inmediato.
- 🚨 UX bloqueante → revertir paso específico (los commits son aislados).
- < 85% verdes → continuar QA otro día, NO mergear.

---

# Después del QA

## Si todo OK

1. Crear archivo `docs/screenshots/qa-pass-fase-1-2-results.md` con la tabla resumen completada y screenshots adjuntos.
2. Anunciar en el canal: "Fase 1.2 QA pass: PASSED. Flag default sigue OFF; flippeable individualmente desde DevTools."
3. Abrir Fase 1.3 backend con el orden recomendado del closure report.

## Si hay regresión

1. Crear `docs/screenshots/qa-pass-fase-1-2-regressions.md`.
2. Por cada 🚨 / ⚠️ documentar:
   - Caso ID
   - Captura OFF vs ON
   - Comportamiento observado vs esperado
   - Causa probable
   - Bug ID (si se crea)
3. Proponer plan de fix antes de F1.3.

---

## Apéndice — referencias rápidas

- Closure report: `docs/fase-1-2-closure-report.md`
- Playbook visual: `docs/fase-1-2-visual-regression-playbook.md`
- Lista de cálculos pendientes en frontend: closure report §4
- Riesgos documentados: closure report §5
