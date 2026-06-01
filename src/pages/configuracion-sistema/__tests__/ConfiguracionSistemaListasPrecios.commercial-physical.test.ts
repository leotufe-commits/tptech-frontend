// src/pages/configuracion-sistema/__tests__/ConfiguracionSistemaListasPrecios.commercial-physical.test.ts
// =============================================================================
// Etapa C-comercial / C9 (POLICY §R-Rounding-14) — Tests del mapper
// `draftToPayload` de la pantalla de Listas de Precios.
//
// Regla canónica que el mapper debe respetar:
//   DESGLOSADO (mode=METAL_HECHURA + roundingTarget=METAL + rounding≠NONE)
//     ⇒ commercialRoundingMetalDomain = "PHYSICAL"
//        commercialPhysicalRoundingConfig = {
//          byMetalParentId: {},
//          fallback: { mode: <elegido>, direction: <elegida> }
//        }
//   Resto (UNIFICADA / sin rounding / draft.roundingTarget="NONE") ⇒
//     commercialRoundingMetalDomain = "MONETARY"
//     commercialPhysicalRoundingConfig = null
//
// Los tests ejercen el mapper puro — no renderizan la pantalla.
// =============================================================================

import { describe, it, expect } from "vitest";
import { draftToPayload, type Draft } from "../ConfiguracionSistemaListasPrecios";

function makeDraft(over: Partial<Draft> = {}): Draft {
  return {
    name:                     "Lista test",
    mode:                     "METAL_HECHURA",
    marginTotal:              null,
    marginMetal:              100,
    marginHechura:            50,
    costPerGram:              null,
    surcharge:                null,
    roundingTarget:           "METAL",
    roundingMode:             "INTEGER",
    roundingDirection:        "NEAREST",
    roundingApplyOn:          "PRICE",
    roundingModeHechura:      "HUNDRED",
    roundingDirectionHechura: "NEAREST",
    vigenciaActiva:           false,
    validityRange:            { from: null, to: null } as any,
    notes:                    "",
    isFavorite:               false,
    // C10 — default canónico para DESGLOSADO. Los tests pueden overridear.
    commercialRoundingMetalDomain: "PHYSICAL",
    ...over,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// (1) DESGLOSADO + rounding activo → PHYSICAL + config canónica
// ──────────────────────────────────────────────────────────────────────────

describe("draftToPayload — C9: DESGLOSADO activa PHYSICAL", () => {
  it("METAL_HECHURA + roundingTarget=METAL + INTEGER NEAREST → PHYSICAL con fallback", () => {
    const p = draftToPayload(makeDraft());
    expect(p.commercialRoundingMetalDomain).toBe("PHYSICAL");
    expect(p.commercialPhysicalRoundingConfig).toEqual({
      byMetalParentId: {},
      fallback: { mode: "INTEGER", direction: "NEAREST" },
    });
  });

  it("propaga el modo y dirección que el operador eligió (HUNDRED + DOWN)", () => {
    const p = draftToPayload(makeDraft({
      roundingMode:      "HUNDRED",
      roundingDirection: "DOWN",
    }));
    expect(p.commercialRoundingMetalDomain).toBe("PHYSICAL");
    expect(p.commercialPhysicalRoundingConfig).toEqual({
      byMetalParentId: {},
      fallback: { mode: "HUNDRED", direction: "DOWN" },
    });
  });

  it("propaga DECIMAL_2 + UP", () => {
    const p = draftToPayload(makeDraft({
      roundingMode:      "DECIMAL_2",
      roundingDirection: "UP",
    }));
    expect(p.commercialPhysicalRoundingConfig).toMatchObject({
      fallback: { mode: "DECIMAL_2", direction: "UP" },
    });
  });

  it("mantiene roundingTarget=METAL en el payload (legacy compat)", () => {
    const p = draftToPayload(makeDraft());
    expect(p.roundingTarget).toBe("METAL");
    expect(p.roundingMode).toBe("INTEGER");
    expect(p.roundingDirection).toBe("NEAREST");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (2) DESGLOSADO sin rounding → MONETARY (legacy)
// ──────────────────────────────────────────────────────────────────────────

describe("draftToPayload — C9: DESGLOSADO sin rounding cae a MONETARY", () => {
  it("METAL_HECHURA + roundingTarget=NONE → MONETARY + null", () => {
    const p = draftToPayload(makeDraft({ roundingTarget: "NONE" }));
    expect(p.commercialRoundingMetalDomain).toBe("MONETARY");
    expect(p.commercialPhysicalRoundingConfig).toBeNull();
  });

  it("METAL_HECHURA + roundingMode=NONE → MONETARY + null (motor inerte)", () => {
    // Caso patológico: target=METAL pero modo=NONE. El motor no redondea
    // nada. Activar PHYSICAL sería ruido. El mapper baja a MONETARY.
    const p = draftToPayload(makeDraft({
      roundingTarget: "METAL",
      roundingMode:   "NONE",
    }));
    expect(p.commercialRoundingMetalDomain).toBe("MONETARY");
    expect(p.commercialPhysicalRoundingConfig).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (3) UNIFICADO → MONETARY (legacy)
// ──────────────────────────────────────────────────────────────────────────

describe("draftToPayload — C9: UNIFICADO siempre MONETARY", () => {
  it("MARGIN_TOTAL con rounding activo → MONETARY (NO físico)", () => {
    // Una lista unificada con FINAL_PRICE no debe convertirse a PHYSICAL:
    // PHYSICAL es exclusivamente del modo desglosado.
    const p = draftToPayload(makeDraft({
      mode:             "MARGIN_TOTAL",
      marginTotal:      100,
      marginMetal:      null,
      marginHechura:    null,
      roundingTarget:   "FINAL_PRICE" as any,
      roundingMode:     "INTEGER",
      roundingDirection:"NEAREST",
    }));
    expect(p.commercialRoundingMetalDomain).toBe("MONETARY");
    expect(p.commercialPhysicalRoundingConfig).toBeNull();
  });

  it("MARGIN_TOTAL sin rounding → MONETARY + null", () => {
    const p = draftToPayload(makeDraft({
      mode:           "MARGIN_TOTAL",
      marginTotal:    100,
      marginMetal:    null,
      marginHechura:  null,
      roundingTarget: "NONE",
    }));
    expect(p.commercialRoundingMetalDomain).toBe("MONETARY");
    expect(p.commercialPhysicalRoundingConfig).toBeNull();
  });

  it("COST_PER_GRAM → MONETARY + null", () => {
    const p = draftToPayload(makeDraft({
      mode:           "COST_PER_GRAM",
      marginMetal:    null,
      marginHechura:  null,
      costPerGram:    50000,
      roundingTarget: "NONE",
    }));
    expect(p.commercialRoundingMetalDomain).toBe("MONETARY");
    expect(p.commercialPhysicalRoundingConfig).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (4) Shape canónico — solo los 2 campos canónicos (no inventa keys)
// ──────────────────────────────────────────────────────────────────────────

describe("draftToPayload — C9: shape canónico del config", () => {
  it("PHYSICAL → config tiene exactamente { byMetalParentId, fallback }", () => {
    const p = draftToPayload(makeDraft());
    const cfg = p.commercialPhysicalRoundingConfig!;
    const keys = Object.keys(cfg).sort();
    expect(keys).toEqual(["byMetalParentId", "fallback"]);
  });

  it("byMetalParentId queda vacío (UX actual: un rounding común)", () => {
    const p = draftToPayload(makeDraft());
    expect(p.commercialPhysicalRoundingConfig!.byMetalParentId).toEqual({});
  });

  it("fallback tiene exactamente { mode, direction }", () => {
    const p = draftToPayload(makeDraft());
    const fb = (p.commercialPhysicalRoundingConfig!.fallback as Record<string, unknown>);
    const fbKeys = Object.keys(fb).sort();
    expect(fbKeys).toEqual(["direction", "mode"]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (5) Coherencia: el payload PHYSICAL coincide con el que el backend
//     C3 espera para entrar al path PHYSICAL del motor.
// ──────────────────────────────────────────────────────────────────────────

describe("draftToPayload — C9: alineación con el motor backend", () => {
  it("PHYSICAL payload encadena con `resolveCommercialPhysicalRoundingConfig`", () => {
    // El backend parsea con `resolvePhysicalRoundingConfig(domain, json)`.
    // Verificamos que nuestro payload cumple las precondiciones:
    //   · domain === "PHYSICAL"
    //   · json es objeto, con `byMetalParentId` objeto y `fallback`
    //     con `mode` válido + `direction` válido.
    const p = draftToPayload(makeDraft());
    expect(p.commercialRoundingMetalDomain).toBe("PHYSICAL");
    const cfg = p.commercialPhysicalRoundingConfig!;
    expect(typeof cfg).toBe("object");
    expect(typeof cfg.byMetalParentId).toBe("object");
    expect(Array.isArray(cfg.byMetalParentId)).toBe(false);
    const fb = cfg.fallback as { mode: string; direction: string };
    expect(["NONE", "INTEGER", "DECIMAL_1", "DECIMAL_2", "TEN", "HUNDRED"]).toContain(fb.mode);
    expect(["NEAREST", "UP", "DOWN"]).toContain(fb.direction);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (6) C10 — el operador puede elegir explícitamente MONETARY en DESGLOSADO
//     (compat hacia atrás para listas legacy).
// ──────────────────────────────────────────────────────────────────────────

describe("draftToPayload — C10: toggle explícito en DESGLOSADO", () => {
  it("DESGLOSADO + operador elige MONETARY → respeta MONETARY (no fuerza PHYSICAL)", () => {
    const p = draftToPayload(makeDraft({
      commercialRoundingMetalDomain: "MONETARY",
    }));
    expect(p.commercialRoundingMetalDomain).toBe("MONETARY");
    expect(p.commercialPhysicalRoundingConfig).toBeNull();
  });

  it("DESGLOSADO + operador elige PHYSICAL → PHYSICAL + config con su modo/dirección", () => {
    const p = draftToPayload(makeDraft({
      commercialRoundingMetalDomain: "PHYSICAL",
      roundingMode:                  "DECIMAL_2",
      roundingDirection:             "UP",
    }));
    expect(p.commercialRoundingMetalDomain).toBe("PHYSICAL");
    expect(p.commercialPhysicalRoundingConfig).toEqual({
      byMetalParentId: {},
      fallback: { mode: "DECIMAL_2", direction: "UP" },
    });
  });

  it("UNIFICADO + draft.commercialRoundingMetalDomain=PHYSICAL → se fuerza MONETARY (dominio inerte)", () => {
    // El toggle no se muestra en UNIFICADO. Aunque el draft tuviera "PHYSICAL"
    // por residual, el motor solo bifurca en METAL_HECHURA — el mapper baja
    // a MONETARY para no persistir un dominio sin efecto.
    const p = draftToPayload(makeDraft({
      mode:                          "MARGIN_TOTAL",
      marginTotal:                   100,
      marginMetal:                   null,
      marginHechura:                 null,
      commercialRoundingMetalDomain: "PHYSICAL",
    }));
    expect(p.commercialRoundingMetalDomain).toBe("MONETARY");
    expect(p.commercialPhysicalRoundingConfig).toBeNull();
  });

  it("DESGLOSADO sin rounding (roundingTarget=NONE) + draft.commercialRoundingMetalDomain=PHYSICAL → MONETARY", () => {
    const p = draftToPayload(makeDraft({
      roundingTarget:                "NONE",
      commercialRoundingMetalDomain: "PHYSICAL",
    }));
    expect(p.commercialRoundingMetalDomain).toBe("MONETARY");
    expect(p.commercialPhysicalRoundingConfig).toBeNull();
  });
});
