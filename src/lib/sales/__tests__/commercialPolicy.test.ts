// src/lib/sales/__tests__/commercialPolicy.test.ts
// ============================================================================
// Tests del helper puro de política comercial (Fase A).
//
// Valida:
//   1. `deriveCommercialLevel` mapea correctamente cada combinación de
//      `alerts[]` + `policy` al nivel esperado (OK/WARNING/RISK/CRITICAL).
//   2. `aggregateDocumentStatus` cuenta correctamente las líneas por nivel
//      y reporta el peor caso (`worst`) del comprobante.
//   3. Defensivo: líneas null/undefined no rompen el agregador.
//   4. Defensivo: `policy.canConfirm = false` con `blockingAlerts: []`
//      cae a CRITICAL (payload inconsistente, pero el helper no asume).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  deriveCommercialLevel,
  deriveCommercialInfo,
  aggregateDocumentStatus,
  type CommercialPolicyLineLike,
  type CommercialInfoLineLike,
} from "../commercialPolicy";

const makeLine = (
  partial: Partial<CommercialPolicyLineLike> = {},
): CommercialPolicyLineLike => ({
  alerts: [],
  policy: { canConfirm: true, blockingAlerts: [] },
  ...partial,
});

describe("deriveCommercialLevel", () => {
  it("OK — sin alertas ni bloqueos", () => {
    expect(deriveCommercialLevel(makeLine())).toBe("OK");
  });

  it("OK — null/undefined cae a OK por defecto", () => {
    expect(deriveCommercialLevel(null)).toBe("OK");
    expect(deriveCommercialLevel(undefined)).toBe("OK");
  });

  it("CRITICAL — blockingAlerts no vacío", () => {
    expect(deriveCommercialLevel(makeLine({
      policy: { canConfirm: false, blockingAlerts: ["LOSS_SALE"] },
    }))).toBe("CRITICAL");
  });

  it("CRITICAL — canConfirm:false con blockingAlerts vacío (defensa) NO escala", () => {
    // UX simplificada: sin códigos bloqueantes reales (LOSS_SALE, etc.) no
    // hay razón visible para mostrar CRITICAL. Antes este caso defensivo
    // escalaba aunque no hubiera nada para mostrarle al operador.
    expect(deriveCommercialLevel(makeLine({
      policy: { canConfirm: false, blockingAlerts: [] },
    }))).toBe("OK");
  });

  it("WARNING — UX simplificada: LOW_MARGIN solo en blockingAlerts (legacy) NO escala a CRITICAL", () => {
    // El tenant tiene `pricingLowMarginBlockPercent` legacy cargado; el
    // motor pushea LOW_MARGIN a blocking. La pantalla nueva ya no expone
    // ese umbral, así que el frontend lo filtra.
    expect(deriveCommercialLevel(makeLine({
      alerts: [{ code: "LOW_MARGIN", level: "warning", message: "Margen bajo" }],
      policy: { canConfirm: false, blockingAlerts: ["LOW_MARGIN"] },
    }))).toBe("WARNING");
  });

  it("CRITICAL — LOW_MARGIN + LOSS_SALE en blockingAlerts: LOSS_SALE sí escala", () => {
    expect(deriveCommercialLevel(makeLine({
      alerts: [
        { code: "LOW_MARGIN", level: "warning", message: "Margen bajo" },
        { code: "LOSS_SALE",  level: "error",   message: "Pérdida" },
      ],
      policy: { canConfirm: false, blockingAlerts: ["LOW_MARGIN", "LOSS_SALE"] },
    }))).toBe("CRITICAL");
  });

  // Política comercial 2026: LOSS_SALE sin toggle activo cae a WARNING.
  // Antes esto era RISK pero absorbía el WARNING común y daba la sensación
  // "casi nunca WARNING puro". Si el operador quiere bloqueo, activa el
  // toggle `pricingBlockLossSale` → escala a CRITICAL.
  it("WARNING — LOSS_SALE no bloqueante (sin toggle) cae a WARNING", () => {
    expect(deriveCommercialLevel(makeLine({
      alerts: [{ code: "LOSS_SALE", level: "warning", message: "Venta a pérdida" }],
    }))).toBe("WARNING");
  });

  it("CRITICAL — LOSS_SALE con toggle activo (blocking) escala a CRITICAL", () => {
    expect(deriveCommercialLevel(makeLine({
      alerts: [{ code: "LOSS_SALE", level: "error", message: "Venta a pérdida" }],
      policy: { canConfirm: false, blockingAlerts: ["LOSS_SALE"] },
    }))).toBe("CRITICAL");
  });

  it("RISK — COST_UNRESOLVED no bloqueante", () => {
    expect(deriveCommercialLevel(makeLine({
      alerts: [{ code: "COST_UNRESOLVED", level: "warning", message: "Costo no resuelto" }],
    }))).toBe("RISK");
  });

  it("RISK — PARTIAL_DATA no bloqueante", () => {
    expect(deriveCommercialLevel(makeLine({
      alerts: [{ code: "PARTIAL_DATA", level: "info", message: "Cálculo parcial" }],
    }))).toBe("RISK");
  });

  it("RISK — ZERO_OR_NEGATIVE_PRICE no bloqueante", () => {
    expect(deriveCommercialLevel(makeLine({
      alerts: [{ code: "ZERO_OR_NEGATIVE_PRICE", level: "warning", message: "Precio cero" }],
    }))).toBe("RISK");
  });

  it("WARNING — solo LOW_MARGIN", () => {
    expect(deriveCommercialLevel(makeLine({
      alerts: [{ code: "LOW_MARGIN", level: "warning", message: "Margen bajo" }],
    }))).toBe("WARNING");
  });

  it("CRITICAL prevalece sobre RISK y WARNING", () => {
    expect(deriveCommercialLevel(makeLine({
      alerts: [
        { code: "LOW_MARGIN", level: "warning", message: "Margen bajo" },
        { code: "LOSS_SALE",  level: "warning", message: "Pérdida" },
      ],
      policy: { canConfirm: false, blockingAlerts: ["LOSS_SALE"] },
    }))).toBe("CRITICAL");
  });

  it("RISK prevalece sobre WARNING cuando coexisten alerts (COST_UNRESOLVED + LOW_MARGIN)", () => {
    // COST_UNRESOLVED y PARTIAL_DATA siguen escalando a RISK porque son
    // problemas reales de DATOS (el motor no pudo resolver costo). LOSS_SALE
    // ya no escala salvo bloqueante (ver test específico arriba).
    expect(deriveCommercialLevel(makeLine({
      alerts: [
        { code: "LOW_MARGIN",      level: "warning", message: "Margen bajo" },
        { code: "COST_UNRESOLVED", level: "warning", message: "Costo no resuelto" },
      ],
    }))).toBe("RISK");
  });
});

describe("aggregateDocumentStatus", () => {
  it("documento vacío → todo en 0 y worst=OK", () => {
    expect(aggregateDocumentStatus([])).toEqual({
      ok: 0, warning: 0, risk: 0, critical: 0, evaluated: 0, worst: "OK",
    });
  });

  it("ignora líneas null/undefined", () => {
    const out = aggregateDocumentStatus([null, undefined, makeLine()]);
    expect(out.evaluated).toBe(1);
    expect(out.ok).toBe(1);
    expect(out.worst).toBe("OK");
  });

  it("cuenta correctamente cada nivel y reporta worst", () => {
    // RISK ahora se logra con COST_UNRESOLVED/PARTIAL_DATA/ZERO (no LOSS_SALE).
    const out = aggregateDocumentStatus([
      makeLine(), // OK
      makeLine({ alerts: [{ code: "LOW_MARGIN",      level: "warning", message: "x" }] }), // WARNING
      makeLine({ alerts: [{ code: "COST_UNRESOLVED", level: "warning", message: "x" }] }), // RISK
      makeLine({
        alerts: [{ code: "LOSS_SALE", level: "error", message: "x" }],
        policy: { canConfirm: false, blockingAlerts: ["LOSS_SALE"] },
      }), // CRITICAL
      makeLine({ alerts: [{ code: "LOW_MARGIN",      level: "warning", message: "x" }] }), // WARNING
    ]);
    expect(out).toEqual({
      ok: 1, warning: 2, risk: 1, critical: 1, evaluated: 5, worst: "CRITICAL",
    });
  });

  it("worst sin críticas → RISK", () => {
    expect(aggregateDocumentStatus([
      makeLine(),
      makeLine({ alerts: [{ code: "COST_UNRESOLVED", level: "warning", message: "x" }] }),
    ]).worst).toBe("RISK");
  });

  it("worst sin críticas ni riesgos → WARNING", () => {
    expect(aggregateDocumentStatus([
      makeLine(),
      makeLine({ alerts: [{ code: "LOW_MARGIN", level: "warning", message: "x" }] }),
    ]).worst).toBe("WARNING");
  });

  it("UX simplificada: doc con solo LOW_MARGIN en blocking (legacy) → critical=0, warning>0", () => {
    // Tenant con `pricingLowMarginBlockPercent` legacy persistido: el motor
    // pushea LOW_MARGIN a blocking, pero el badge superior debe decir
    // "Advertencias de margen" (no "Venta con riesgo crítico").
    const out = aggregateDocumentStatus([
      makeLine({
        alerts: [{ code: "LOW_MARGIN", level: "warning", message: "Margen bajo" }],
        policy: { canConfirm: false, blockingAlerts: ["LOW_MARGIN"] },
      }),
      makeLine({
        alerts: [{ code: "LOW_MARGIN", level: "warning", message: "Margen bajo" }],
        policy: { canConfirm: false, blockingAlerts: ["LOW_MARGIN"] },
      }),
    ]);
    expect(out.critical).toBe(0);
    expect(out.warning).toBe(2);
    expect(out.worst).toBe("WARNING");
  });
});

describe("deriveCommercialInfo (refinamiento UX)", () => {
  const makeInfoLine = (
    partial: Partial<CommercialInfoLineLike> = {},
  ): CommercialInfoLineLike => ({
    alerts: [],
    policy: { canConfirm: true, blockingAlerts: [] },
    marginPercent: null,
    ...partial,
  });

  it("OK → todo null", () => {
    const info = deriveCommercialInfo(makeInfoLine({ marginPercent: 35 }));
    expect(info.level).toBe("OK");
    expect(info.primaryCode).toBeNull();
    expect(info.primaryMessage).toBeNull();
    expect(info.marginPercent).toBe(35);
  });

  it("WARNING (LOW_MARGIN) → expone margen y mensaje del motor", () => {
    const info = deriveCommercialInfo(makeInfoLine({
      marginPercent: 8,
      alerts: [{ code: "LOW_MARGIN", level: "warning", message: "Margen 8% < 15% recomendado" }],
    }));
    expect(info.level).toBe("WARNING");
    expect(info.primaryCode).toBe("LOW_MARGIN");
    expect(info.primaryMessage).toContain("Margen 8%");
    expect(info.marginPercent).toBe(8);
  });

  it("WARNING con LOSS_SALE no bloqueante elige LOSS_SALE como primary (severidad)", () => {
    // LOSS_SALE sin toggle activo ya no escala a RISK (cae a WARNING junto
    // con LOW_MARGIN), pero la severidad de pickPrimaryAlert sigue eligiendo
    // LOSS_SALE como el código dominante a mostrar en el tooltip.
    const info = deriveCommercialInfo(makeInfoLine({
      marginPercent: -5,
      alerts: [
        { code: "LOW_MARGIN", level: "warning", message: "Margen bajo" },
        { code: "LOSS_SALE",  level: "warning", message: "Precio menor al costo" },
      ],
    }));
    expect(info.level).toBe("WARNING");
    expect(info.primaryCode).toBe("LOSS_SALE");
    expect(info.alertCodes).toEqual(["LOW_MARGIN", "LOSS_SALE"]);
  });

  it("CRITICAL — primary = alerta cuyo código está en blockingAlerts", () => {
    const info = deriveCommercialInfo(makeInfoLine({
      alerts: [
        { code: "LOW_MARGIN", level: "warning", message: "Margen bajo" },
        { code: "LOSS_SALE",  level: "warning", message: "Pérdida" },
      ],
      policy: { canConfirm: false, blockingAlerts: ["LOSS_SALE"] },
    }));
    expect(info.level).toBe("CRITICAL");
    expect(info.primaryCode).toBe("LOSS_SALE");
    expect(info.primaryMessage).toContain("Pérdida");
  });

  it("CRITICAL sin alerta matching → fallback al primer blocking con label localizado", () => {
    const info = deriveCommercialInfo(makeInfoLine({
      alerts: [],
      policy: { canConfirm: false, blockingAlerts: ["ZERO_OR_NEGATIVE_PRICE"] },
    }));
    expect(info.level).toBe("CRITICAL");
    expect(info.primaryCode).toBe("ZERO_OR_NEGATIVE_PRICE");
    expect(info.primaryMessage).toBe("Precio cero o negativo");
  });

  it("línea null → estructura vacía", () => {
    const info = deriveCommercialInfo(null);
    expect(info.level).toBe("OK");
    expect(info.primaryCode).toBeNull();
    expect(info.marginPercent).toBeNull();
    expect(info.alertCodes).toEqual([]);
    expect(info.unitCost).toBeNull();
    expect(info.unitPrice).toBeNull();
    expect(info.recommendedMarginPercent).toBeNull();
  });

  it("expone unitCost / unitPrice del motor (passthrough)", () => {
    const info = deriveCommercialInfo(makeInfoLine({
      marginPercent: -82,
      unitCost: 381562.5,
      unitPrice: 26304.11,
      alerts: [{ code: "LOSS_SALE", level: "warning", message: "Precio menor al costo" }],
    }));
    expect(info.unitCost).toBe(381562.5);
    expect(info.unitPrice).toBe(26304.11);
    expect(info.marginPercent).toBe(-82);
  });

  it("recommendedMarginPercent se inyecta desde options (config del tenant)", () => {
    const info = deriveCommercialInfo(
      makeInfoLine({
        marginPercent: 8,
        alerts: [{ code: "LOW_MARGIN", level: "warning", message: "Margen bajo" }],
      }),
      { recommendedMarginPercent: 30 },
    );
    expect(info.recommendedMarginPercent).toBe(30);
    expect(info.marginPercent).toBe(8);
  });

  it("options vacías → recommendedMarginPercent queda null", () => {
    const info = deriveCommercialInfo(makeInfoLine());
    expect(info.recommendedMarginPercent).toBeNull();
  });

  it("recommendedMarginPercent: null explícito (tenant sin config) → queda null sin romper", () => {
    const info = deriveCommercialInfo(
      makeInfoLine({
        marginPercent: 8,
        alerts: [{ code: "LOW_MARGIN", level: "warning", message: "Margen bajo" }],
      }),
      { recommendedMarginPercent: null },
    );
    expect(info.recommendedMarginPercent).toBeNull();
    expect(info.marginPercent).toBe(8);
    expect(info.level).toBe("WARNING");
  });

  // UX simplificada: el umbral crítico legacy (`pricingLowMarginBlockPercent`)
  // se neutraliza en cada save desde la pantalla Configuración. Con todos los
  // toggles de "Considerar crítico..." apagados, una línea con margen bajo
  // debe quedar WARNING (chip amarillo) y NUNCA escalar a CRITICAL — el modal
  // de confirmación reforzada no debe aparecer.
  it("LOW_MARGIN sin blockingAlerts → WARNING, nunca CRITICAL (UX simplificada)", () => {
    const info = deriveCommercialInfo(
      makeInfoLine({
        marginPercent: 3,
        alerts: [{ code: "LOW_MARGIN", level: "warning", message: "Margen 3% < 15% recomendado" }],
        policy: { canConfirm: true, blockingAlerts: [] },
      }),
      { recommendedMarginPercent: 15 },
    );
    expect(info.level).toBe("WARNING");
    expect(info.primaryCode).toBe("LOW_MARGIN");
    expect(info.recommendedMarginPercent).toBe(15);
  });

  it("UX simplificada: LOW_MARGIN en blocking legacy → WARNING + primaryCode=LOW_MARGIN", () => {
    // El motor está pusheando LOW_MARGIN por `pricingLowMarginBlockPercent`
    // legacy en DB, pero el frontend lo trata como WARNING.
    const info = deriveCommercialInfo(
      makeInfoLine({
        marginPercent: 3,
        alerts: [{ code: "LOW_MARGIN", level: "warning", message: "Margen 3% < 15% recomendado" }],
        policy: { canConfirm: false, blockingAlerts: ["LOW_MARGIN"] },
      }),
    );
    expect(info.level).toBe("WARNING");
    expect(info.primaryCode).toBe("LOW_MARGIN");
  });

  it("CRITICAL con LOW_MARGIN + LOSS_SALE en blocking → primaryCode NO es LOW_MARGIN", () => {
    // Caso mixto: el motor blockingó ambas. La UX simplificada ignora la
    // bloqueante LOW_MARGIN para elegir el primary, así que el chip pinta
    // "Venta con pérdida" en lugar de "Margen crítico".
    const info = deriveCommercialInfo(
      makeInfoLine({
        alerts: [
          { code: "LOW_MARGIN", level: "warning", message: "Margen bajo" },
          { code: "LOSS_SALE",  level: "error",   message: "Pérdida" },
        ],
        policy: { canConfirm: false, blockingAlerts: ["LOW_MARGIN", "LOSS_SALE"] },
      }),
    );
    expect(info.level).toBe("CRITICAL");
    expect(info.primaryCode).toBe("LOSS_SALE");
  });
});
