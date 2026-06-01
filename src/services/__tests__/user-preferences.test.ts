// src/services/__tests__/user-preferences.test.ts
//
// Cadena de fallback del almacén por defecto en la Factura de ventas (Fase 1):
//   UserPreference → primer almacén activo → "".
import { describe, it, expect } from "vitest";
import {
  resolveDefaultWarehouseId,
  resolveDefaultId,
  resolveDefaultChannelId,
  resolveDefaultCurrencyCode,
  resolveCurrencyRate,
  resolveDefaultGlobalDiscountType,
} from "../user-preferences";

const WHS = [
  { id: "wh-1", isActive: true },
  { id: "wh-2", isActive: true },
  { id: "wh-inactivo", isActive: false },
];

describe("resolveDefaultWarehouseId", () => {
  it("usa la preferencia del usuario si el almacén existe y está activo", () => {
    expect(resolveDefaultWarehouseId("wh-2", WHS)).toBe("wh-2");
  });

  it("ignora la preferencia si el almacén está inactivo y cae al primer activo", () => {
    expect(resolveDefaultWarehouseId("wh-inactivo", WHS)).toBe("wh-1");
  });

  it("ignora la preferencia si el almacén ya no existe y cae al primer activo", () => {
    expect(resolveDefaultWarehouseId("wh-borrado", WHS)).toBe("wh-1");
  });

  it("sin preferencia → primer almacén activo", () => {
    expect(resolveDefaultWarehouseId(null, WHS)).toBe("wh-1");
  });

  it("sin almacenes → cadena vacía (no rompe el form)", () => {
    expect(resolveDefaultWarehouseId("wh-1", [])).toBe("");
  });
});

// Fase 2.3 — cadena genérica (vendedor / lista / canal):
//   UserPreference → favorito de la joyería → primer activo → "".
describe("resolveDefaultId", () => {
  const LIST = [
    { id: "a", isActive: true },
    { id: "fav", isActive: true },
    { id: "pref", isActive: true },
    { id: "off", isActive: false },
    { id: "del", isActive: true, deletedAt: "2026-01-01" },
  ];

  it("prioriza la preferencia del usuario", () => {
    expect(resolveDefaultId("pref", "fav", LIST)).toBe("pref");
  });

  it("si la preferencia no es válida, usa el favorito de la joyería", () => {
    expect(resolveDefaultId("del", "fav", LIST)).toBe("fav");
    expect(resolveDefaultId("inexistente", "fav", LIST)).toBe("fav");
  });

  it("sin preferencia ni favorito válidos → primer activo no borrado", () => {
    expect(resolveDefaultId(null, "off", LIST)).toBe("a");
  });

  it("lista vacía → cadena vacía", () => {
    expect(resolveDefaultId("x", "y", [])).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Canal de venta — fallback CORTADO en favorito (no cae a "primer activo")
//
// El canal aplica recargos/descuentos sobre el total del comprobante. Por
// eso la jerarquía SOLO usa preferencia y favorito; sin ninguno → "Sin canal".
// El cliente, si tiene canal default propio, lo resuelve el caller en otra
// capa (paso 1 de la jerarquía).
// ─────────────────────────────────────────────────────────────────────────────
describe("resolveDefaultChannelId — no cae a 'primer activo'", () => {
  const CHANNELS = [
    { id: "ml",   isActive: true },  // simula "Mercadolibre"
    { id: "web",  isActive: true },  // simula "Web"
    { id: "fav",  isActive: true },  // favorito de la joyería
    { id: "pref", isActive: true },  // preferencia del usuario
    { id: "off",  isActive: false },
  ];

  it("usa preferencia del usuario cuando está activa", () => {
    expect(resolveDefaultChannelId("pref", "fav", CHANNELS)).toBe("pref");
  });

  it("usa favorito de la joyería cuando no hay preferencia válida", () => {
    expect(resolveDefaultChannelId(null, "fav", CHANNELS)).toBe("fav");
    expect(resolveDefaultChannelId("inexistente", "fav", CHANNELS)).toBe("fav");
    expect(resolveDefaultChannelId("off", "fav", CHANNELS)).toBe("fav");
  });

  it("SIN preferencia ni favorito → cadena vacía (Sin canal), NO el primer activo", () => {
    // El primer activo de la lista sería "ml" (Mercadolibre). El helper
    // NO debe devolverlo. Este es el bug que se está corrigiendo.
    expect(resolveDefaultChannelId(null, null, CHANNELS)).toBe("");
    expect(resolveDefaultChannelId(undefined, undefined, CHANNELS)).toBe("");
    expect(resolveDefaultChannelId("", "", CHANNELS)).toBe("");
  });

  it("preferencia/favorito borrado o inactivo → '' (no cae a primer activo)", () => {
    expect(resolveDefaultChannelId("borrado", "tambien-borrado", CHANNELS)).toBe("");
    expect(resolveDefaultChannelId("off",     "off",             CHANNELS)).toBe("");
  });

  it("lista vacía → cadena vacía", () => {
    expect(resolveDefaultChannelId("x", "y", [])).toBe("");
  });

  it("escenario del bug reportado: el operador borra Mercadolibre → Web ya NO se elige solo", () => {
    // Catálogo con "Web" como único canal activo, sin favorito, sin preferencia.
    const onlyWeb = [{ id: "web", isActive: true }];
    expect(resolveDefaultChannelId(null, null, onlyWeb)).toBe("");
  });

  it("paridad con resolveDefaultId: la única diferencia es el último paso", () => {
    const CASE = [{ id: "x", isActive: true }];
    // resolveDefaultId (vendedor/lista) cae a primer activo:
    expect(resolveDefaultId(null, null, CASE)).toBe("x");
    // resolveDefaultChannelId NO cae:
    expect(resolveDefaultChannelId(null, null, CASE)).toBe("");
  });
});

// Fase 2.3 — moneda como CÓDIGO: UserPreference(id) → base → fallback.
describe("resolveDefaultCurrencyCode", () => {
  const CURS = [
    { id: "u", code: "USD", isActive: true },
    { id: "a", code: "ARS", isBase: true, isActive: true },
    { id: "e", code: "EUR", isActive: false },
  ];

  it("mapea el id de preferencia a su código", () => {
    expect(resolveDefaultCurrencyCode("u", CURS)).toBe("USD");
  });

  it("si la preferencia es inválida/inactiva, usa la moneda base", () => {
    expect(resolveDefaultCurrencyCode("e", CURS)).toBe("ARS");
    expect(resolveDefaultCurrencyCode(null, CURS)).toBe("ARS");
  });

  it("sin base → fallback explícito", () => {
    expect(resolveDefaultCurrencyCode(null, [{ id: "u", code: "USD", isActive: true }], "ARS")).toBe("ARS");
  });
});

// Fase 2.3 — cotización vigente al precargar moneda (mismo flujo que el
// cambio manual en el modal de FX): base→1, no-base→latestRate.
describe("resolveCurrencyRate", () => {
  const CURS = [
    { code: "ARS", isBase: true, latestRate: null },
    { code: "USD", isBase: false, latestRate: 1350 },
    { code: "EUR", isBase: false, latestRate: null },
  ];

  it("moneda base → 1", () => {
    expect(resolveCurrencyRate("ARS", CURS)).toBe(1);
  });

  it("no base con cotización vigente → latestRate", () => {
    expect(resolveCurrencyRate("USD", CURS)).toBe(1350);
  });

  it("no base sin cotización vigente → 1 (igual que el flujo manual)", () => {
    expect(resolveCurrencyRate("EUR", CURS)).toBe(1);
  });

  it("moneda desconocida o vacía → 1", () => {
    expect(resolveCurrencyRate("XXX", CURS)).toBe(1);
    expect(resolveCurrencyRate(null, CURS)).toBe(1);
  });

  // ── Defensa contra DB corrupta (regresión bug "21.582.733" 2026-05-29) ────
  describe("isBase fuerza 1 incluso si latestRate está populated por error", () => {
    it("moneda base con latestRate=1798.561 (corrupto) → 1", () => {
      // Si la DB del tenant tiene ARS marcada como base PERO también con
      // latestRate populated (corrupción de catálogo), forzamos 1 para
      // evitar que ese valor se propague a draft.fxRate y reviente cálculos
      // downstream (envío, totales, etc.).
      const CURS_CORRUPT = [
        { code: "ARS", isBase: true, latestRate: 1798.561 }, // ⚠️ corrupto
        { code: "USD", isBase: false, latestRate: 1800 },
      ];
      expect(resolveCurrencyRate("ARS", CURS_CORRUPT)).toBe(1);
    });

    it("moneda base con latestRate=0.000556 (rate inverso corrupto) → 1", () => {
      // Este es el valor EXACTO que producía el bug 21.582.733: si por error
      // se guardó el rate inverso (1/1798.561) en la moneda base, sin
      // defensa el shipping calcularía 12000 / 0.000556 = 21.582.733.
      const CURS_INVERSE = [
        { code: "ARS", isBase: true, latestRate: 0.000556 }, // ⚠️ inverso
        { code: "USD", isBase: false, latestRate: 1800 },
      ];
      expect(resolveCurrencyRate("ARS", CURS_INVERSE)).toBe(1);
    });

    it("moneda base con rate (legacy) populated por error → 1", () => {
      const CURS_LEGACY = [
        { code: "ARS", isBase: true, latestRate: null, rate: 1500 }, // ⚠️
      ];
      expect(resolveCurrencyRate("ARS", CURS_LEGACY)).toBe(1);
    });

    it("moneda no-base con latestRate corrupto NEGATIVO → fallback a 1", () => {
      // Defensa adicional: la lógica existente ya filtraba r > 0 para no-base.
      const CURS = [
        { code: "ARS", isBase: true, latestRate: null },
        { code: "USD", isBase: false, latestRate: -1800 }, // ⚠️ negativo
      ];
      expect(resolveCurrencyRate("USD", CURS)).toBe(1);
    });
  });
});

// Tipo predeterminado del Descuento global (UserPreference) — PERCENT por
// default; AMOUNT si el operador marcó la estrella en el combo Tipo.
describe("resolveDefaultGlobalDiscountType", () => {
  it("sin preferencia → fallback 'PERCENT'", () => {
    expect(resolveDefaultGlobalDiscountType(null)).toBe("PERCENT");
    expect(resolveDefaultGlobalDiscountType(undefined)).toBe("PERCENT");
  });
  it("preferencia 'PERCENT' → 'PERCENT'", () => {
    expect(resolveDefaultGlobalDiscountType("PERCENT")).toBe("PERCENT");
  });
  it("preferencia 'AMOUNT' → 'AMOUNT'", () => {
    expect(resolveDefaultGlobalDiscountType("AMOUNT")).toBe("AMOUNT");
  });
  it("valor desconocido → fallback 'PERCENT' (defensiva)", () => {
    expect(resolveDefaultGlobalDiscountType("BOGUS" as any)).toBe("PERCENT");
  });
});
