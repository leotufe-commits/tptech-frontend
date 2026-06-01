// src/lib/sales/commercialPolicy.ts
// ============================================================================
// Política comercial — capa de INTERPRETACIÓN del resultado del pricing-engine.
//
// FILOSOFÍA (ver propuesta arquitectónica Fase A):
//   · El pricing-engine es la única fuente de verdad de números (costo,
//     margen, descuentos, impuestos, FX). Este módulo NO recalcula nada.
//   · Toma la metadata que el motor ya emite por línea — `alerts[]` y
//     `policy.blockingAlerts[]` — y la traduce a un `CommercialLevel`
//     simple ("OK" / "WARNING" / "RISK" / "CRITICAL") para que la UI
//     pueda pintar bordes/chips y armar resúmenes de comprobante.
//   · Cero matemática. Cero llamadas asíncronas. Funciones puras.
//
// NIVELES — mapeo de códigos del motor:
//   · CRITICAL — la línea tiene alertas BLOQUEANTES según la política del
//                tenant (`policy.blockingAlerts[].length > 0` o
//                `policy.canConfirm === false`). Visual: rojo. NO bloquea
//                automáticamente; al confirmar la venta se exige un modal
//                de confirmación reforzada.
//   · RISK     — la línea tiene alertas serias no-bloqueantes:
//                `LOSS_SALE`, `COST_UNRESOLVED`, `PARTIAL_DATA`,
//                `ZERO_OR_NEGATIVE_PRICE`. Visual: naranja.
//   · WARNING  — la línea solo tiene `LOW_MARGIN` (margen bajo del umbral
//                recomendado pero no bloqueante). Visual: amarillo.
//   · OK       — sin alertas, todo en orden. Visual: verde / sin badge.
//
// El motor NO emite hoy un campo `commercialLevel`; lo derivamos en el
// front. Si en el futuro el motor lo expone nativo (Fase B), reemplazar
// `deriveCommercialLevel` por una lectura directa del campo y conservar
// `aggregateDocumentStatus` como helper visual.
// ============================================================================

/** Códigos de alerta que emite el pricing-engine. Subconjunto reflejado
 *  en `NormalizedPricingLine.alerts[].code`. Mantener sincronizado con
 *  `pricing-engine.sale.ts` (backend). */
export type CommercialAlertCode =
  | "LOSS_SALE"
  | "LOW_MARGIN"
  | "ZERO_OR_NEGATIVE_PRICE"
  | "COST_UNRESOLVED"
  | "PARTIAL_DATA"
  | (string & {});

/** Nivel comercial de una línea — proyección simplificada de
 *  `alerts[]` + `policy` que la UI consume directamente. */
export type CommercialLevel = "OK" | "WARNING" | "RISK" | "CRITICAL";

/** Shape mínimo de una alerta que el helper necesita.
 *  Coincide con `NormalizedPricingLine.alerts[i]`. */
export type CommercialAlertLike = {
  code: string;
  level: "info" | "warning" | "error";
  message: string;
};

/** Shape mínimo de la política que el helper necesita.
 *  Coincide con `NormalizedPricingLine.policy`. */
export type CommercialPolicyLike = {
  canConfirm: boolean;
  blockingAlerts: string[];
};

/** Subconjunto de una línea que el helper necesita. Cualquier shape con
 *  estos campos sirve — no hay acoplamiento al `NormalizedPricingLine`
 *  exacto, para que el helper sea reutilizable.
 *
 *  La index signature `[k: string]: unknown` evita el "all-optional
 *  safety check" de TypeScript que rechazaría pasar un objeto con
 *  muchos campos extra (ej. `NormalizedPricingLine`) a una firma cuyos
 *  campos son todos opcionales. */
export type CommercialPolicyLineLike = {
  alerts?: CommercialAlertLike[];
  policy?: CommercialPolicyLike;
  [key: string]: unknown;
};

/** Códigos que escalan automáticamente a `RISK` (naranja, no-bloqueante)
 *  cuando aparecen en `alerts[]` sin estar en `policy.blockingAlerts`.
 *
 *  Antes incluía `LOSS_SALE`, lo que volvía RISK cualquier venta marginal
 *  apenas el operador no tuviera el toggle "Considerar crítica la venta con
 *  pérdida" activo — absorbía el rango WARNING del operador y resultaba en
 *  "casi nunca aparece WARNING puro". La decisión actual: si el operador
 *  no activó el toggle, la venta a pérdida no es lo suficientemente seria
 *  como para escalar a RISK; cae a WARNING junto con LOW_MARGIN. El toggle
 *  sigue funcionando para escalar a CRITICAL cuando el tenant quiere
 *  bloquear ventas con pérdida.
 *
 *  COST_UNRESOLVED y PARTIAL_DATA se mantienen porque son problemas REALES
 *  de datos (el motor no pudo resolver costo/precio) y siguen siendo
 *  útiles como señal naranja. ZERO_OR_NEGATIVE_PRICE también se mantiene
 *  como RISK porque un precio cero/negativo sin toggle activo es una
 *  situación que merece destacarse del WARNING común. */
const RISK_CODES = new Set<string>([
  "COST_UNRESOLVED",
  "PARTIAL_DATA",
  "ZERO_OR_NEGATIVE_PRICE",
]);

/** Traduce una línea normalizada del preview a su nivel comercial.
 *  Lee `policy.blockingAlerts` primero (CRITICAL si hay alguna), luego
 *  busca códigos de riesgo en `alerts[]`, luego `LOW_MARGIN` solo, y
 *  cae a OK si no hay ninguna alerta.
 *
 *  UX simplificada (2026): la pantalla de Política comercial ya no expone
 *  un umbral crítico de margen — solo el "Margen mínimo recomendado"
 *  (warning) y los 3 toggles "Considerar crítico..." (LOSS_SALE,
 *  ZERO_OR_NEGATIVE_PRICE, PARTIAL_DATA). Cuando un tenant tiene un valor
 *  legacy persistido en `pricingLowMarginBlockPercent`, el motor sigue
 *  pusheando `LOW_MARGIN` a `policy.blockingAlerts`; lo filtramos acá para
 *  que el frontend no muestre CRITICAL por solo margen bajo. Si la línea
 *  tiene otros códigos bloqueantes reales (LOSS_SALE, etc.), siguen
 *  escalando. El campo en DB queda como capacidad dormida para una eventual
 *  UI avanzada futura. */
export function deriveCommercialLevel(line: CommercialPolicyLineLike | null | undefined): CommercialLevel {
  if (!line) return "OK";

  const policy = line.policy;
  const rawBlocking = policy?.blockingAlerts ?? [];
  const blocking = rawBlocking.filter((code) => code !== "LOW_MARGIN");
  if (blocking.length > 0) return "CRITICAL";
  // `canConfirm === false` también señala una situación bloqueante aunque
  // `blockingAlerts` venga vacío (defensa contra payloads inconsistentes).
  // Pero si el único bloqueo era LOW_MARGIN, lo ignoramos también — la UX
  // simplificada no escala por margen bajo solo.
  if (
    policy &&
    policy.canConfirm === false &&
    rawBlocking.some((code) => code !== "LOW_MARGIN")
  ) {
    return "CRITICAL";
  }

  const alerts = line.alerts ?? [];
  if (alerts.some((a) => RISK_CODES.has(a.code))) return "RISK";
  // WARNING: LOW_MARGIN siempre y LOSS_SALE no bloqueante (cuando el
  // operador no activó "Considerar crítica venta con pérdida"). Antes
  // LOSS_SALE caía a RISK, lo que absorbía visualmente cualquier línea
  // marginal y hacía que WARNING "puro" no apareciera nunca.
  if (alerts.some((a) => a.code === "LOW_MARGIN" || a.code === "LOSS_SALE")) return "WARNING";
  return "OK";
}

/** Conteo por nivel a nivel comprobante. La UI lo usa para el badge del
 *  header del modal Factura y para decidir si abrir el modal de
 *  confirmación reforzada (cuando `critical > 0`). */
export type DocumentCommercialStatus = {
  ok: number;
  warning: number;
  risk: number;
  critical: number;
  /** Cantidad total de líneas evaluadas (excluye nulls). */
  evaluated: number;
  /** Nivel "peor" del comprobante — útil para decidir el color del
   *  badge global (matchea con el peor case por línea). */
  worst: CommercialLevel;
};

const LEVEL_ORDER: Record<CommercialLevel, number> = {
  OK: 0,
  WARNING: 1,
  RISK: 2,
  CRITICAL: 3,
};

/** Agrega los niveles de varias líneas en un resumen para el documento.
 *  Líneas null/undefined (slots no previewables) se ignoran. */
export function aggregateDocumentStatus(
  lines: ReadonlyArray<CommercialPolicyLineLike | null | undefined>,
): DocumentCommercialStatus {
  let ok = 0, warning = 0, risk = 0, critical = 0, evaluated = 0;
  let worst: CommercialLevel = "OK";
  for (const line of lines) {
    if (!line) continue;
    evaluated++;
    const level = deriveCommercialLevel(line);
    if (level === "OK") ok++;
    else if (level === "WARNING") warning++;
    else if (level === "RISK") risk++;
    else if (level === "CRITICAL") critical++;
    if (LEVEL_ORDER[level] > LEVEL_ORDER[worst]) worst = level;
  }
  return { ok, warning, risk, critical, evaluated, worst };
}

/** Labels en español por código de alerta — útil para tooltips/listas. */
export const COMMERCIAL_ALERT_LABELS: Record<string, string> = {
  LOSS_SALE:              "Venta a pérdida",
  LOW_MARGIN:             "Margen bajo",
  ZERO_OR_NEGATIVE_PRICE: "Precio cero o negativo",
  COST_UNRESOLVED:        "Costo no resuelto",
  PARTIAL_DATA:           "Cálculo parcial",
};

export function labelForAlertCode(code: string): string {
  return COMMERCIAL_ALERT_LABELS[code] ?? code;
}

/** Label corto del nivel — para chips y badges. */
export const COMMERCIAL_LEVEL_LABELS: Record<CommercialLevel, string> = {
  OK:       "OK",
  WARNING:  "Margen bajo",
  RISK:     "Riesgo",
  CRITICAL: "Crítico",
};

/** Info comercial enriquecida de una línea — pensada para alimentar el
 *  chip de la fila y el tooltip. Cero matemática: solo recolecta y
 *  reordena los campos que ya emite el motor.
 *
 *  Permite que componentes "tontos" (presentacionales) muestren motivo
 *  + métricas relevantes (margen %, costo, precio) sin tener que
 *  importar los tipos de pricing/contract — el caller (Factura) provee
 *  el shape mínimo. */
export type CommercialInfo = {
  level: CommercialLevel;
  /** Margen porcentual de la línea (passthrough de `marginPercent`). */
  marginPercent: number | null;
  /** Costo unitario calculado por el motor (passthrough de `unitCost`).
   *  Para tooltip detallado: "Costo: $ 381.562,50". */
  unitCost: number | null;
  /** Precio unitario final calculado por el motor (passthrough de
   *  `unitPrice`). Para tooltip: "Precio final: $ 26.304,11". */
  unitPrice: number | null;
  /** Margen recomendado del tenant (umbral de advertencia). Opcional —
   *  cuando se provee, el chip puede mostrar "Margen 8% (recomendado 30%)". */
  recommendedMarginPercent: number | null;
  /** Código de la alerta dominante (la más severa). null si no hay. */
  primaryCode: CommercialAlertCode | null;
  /** Mensaje legible de la alerta dominante (texto del motor). */
  primaryMessage: string | null;
  /** Lista completa de códigos de alertas detectadas (para tooltip). */
  alertCodes: string[];
};

/** Subconjunto extendido de una línea — agrega los campos numéricos
 *  que el chip surfacea (margen, costo, precio). Cero asunción sobre
 *  el shape exacto del consumidor — todos opcionales. */
export type CommercialInfoLineLike = CommercialPolicyLineLike & {
  marginPercent?: number | null;
  unitCost?:      number | null;
  unitPrice?:     number | null;
};

/** Opciones para `deriveCommercialInfo`. El recommended viene de la
 *  configuración del tenant (`pricingLowMarginWarningPercent`) y lo
 *  inyecta el caller — es config, no cálculo. */
export type DeriveCommercialInfoOptions = {
  /** Margen recomendado del tenant. Se muestra en el chip cuando hay
   *  un margen real para comparar. */
  recommendedMarginPercent?: number | null;
};

/** Prioridad para elegir la alerta "dominante" (mostrar primero en chip).
 *  Las alertas blocking ganan siempre — si la línea es CRITICAL, mostramos
 *  la primer alerta bloqueante. Si no, la más severa de `alerts[]`. */
const ALERT_SEVERITY_ORDER: Record<string, number> = {
  LOSS_SALE:              4,
  ZERO_OR_NEGATIVE_PRICE: 4,
  COST_UNRESOLVED:        3,
  PARTIAL_DATA:           3,
  LOW_MARGIN:             2,
};

function pickPrimaryAlert(
  level: CommercialLevel,
  alerts: CommercialAlertLike[],
  blockingCodes: string[],
): { code: string; message: string } | null {
  // CRITICAL → la primer alerta cuyo código esté en blockingAlerts.
  if (level === "CRITICAL" && blockingCodes.length > 0) {
    const blockingSet = new Set(blockingCodes);
    const blockingHit = alerts.find((a) => blockingSet.has(a.code));
    if (blockingHit) return { code: blockingHit.code, message: blockingHit.message };
    // Fallback: usar el código bloqueante directo si no apareció en alerts[].
    const code = blockingCodes[0];
    return { code, message: COMMERCIAL_ALERT_LABELS[code] ?? code };
  }
  if (alerts.length === 0) return null;
  // RISK/WARNING/OK → la alerta más severa por `ALERT_SEVERITY_ORDER`.
  const sorted = [...alerts].sort(
    (a, b) => (ALERT_SEVERITY_ORDER[b.code] ?? 0) - (ALERT_SEVERITY_ORDER[a.code] ?? 0),
  );
  const top = sorted[0];
  return { code: top.code, message: top.message };
}

/** Construye el `CommercialInfo` completo a partir de una línea
 *  normalizada del preview. Cero matemática — solo extracción y
 *  ordenamiento.
 *
 *  El `recommendedMarginPercent` se inyecta desde config del tenant
 *  (`Jewelry.pricingLowMarginWarningPercent`) — el caller lo provee. */
export function deriveCommercialInfo(
  line: CommercialInfoLineLike | null | undefined,
  options: DeriveCommercialInfoOptions = {},
): CommercialInfo {
  const level = deriveCommercialLevel(line);
  const recommendedMarginPercent =
    typeof options.recommendedMarginPercent === "number"
      ? options.recommendedMarginPercent
      : null;
  if (!line) {
    return {
      level,
      marginPercent: null,
      unitCost:      null,
      unitPrice:     null,
      recommendedMarginPercent,
      primaryCode:    null,
      primaryMessage: null,
      alertCodes:     [],
    };
  }
  const alerts = line.alerts ?? [];
  // Coherente con `deriveCommercialLevel`: la UX simplificada ignora
  // `LOW_MARGIN` como bloqueante. Si quedó algún otro código blocking real,
  // ese es el que pinta el chip (no "Margen crítico").
  const blockingCodes = (line.policy?.blockingAlerts ?? []).filter(
    (code) => code !== "LOW_MARGIN",
  );
  const primary = pickPrimaryAlert(level, alerts, blockingCodes);
  return {
    level,
    marginPercent: typeof line.marginPercent === "number" ? line.marginPercent : null,
    unitCost:      typeof line.unitCost      === "number" ? line.unitCost      : null,
    unitPrice:     typeof line.unitPrice     === "number" ? line.unitPrice     : null,
    recommendedMarginPercent,
    primaryCode:    primary?.code ?? null,
    primaryMessage: primary?.message ?? null,
    alertCodes:     alerts.map((a) => a.code),
  };
}
