// src/lib/sales/__tests__/clientPickHelpers.test.ts
// ============================================================================
// Tests unitarios de los helpers de `handleClientPick` (FASE 8.2.5b).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  normalizeEntityCurrency,
  resolveClientFxRate,
  computeDueDateFromTerm,
} from "../clientPickHelpers";
import type { TPEntityLite } from "../../../components/ui/TPEntitySearchSelect";
import type { CurrencyRow } from "../../../services/valuation";

function makeEntity(o: Partial<TPEntityLite> = {}): TPEntityLite {
  return { id: "e1", name: "Acme S.A.", ...o } as TPEntityLite;
}
function makeCurrency(o: Partial<CurrencyRow>): CurrencyRow {
  return {
    id:         "c-id",
    code:       "ARS",
    name:       "Peso argentino",
    symbol:     "$",
    isBase:     true,
    isActive:   true,
    latestRate: null,
    latestAt:   null,
    ...o,
  } as CurrencyRow;
}

// ─── normalizeEntityCurrency ───────────────────────────────────────────────

describe("normalizeEntityCurrency", () => {
  const ars = makeCurrency({ id: "ars-id", code: "ARS", isBase: true });
  const usd = makeCurrency({ id: "usd-id", code: "USD", isBase: false });

  it("retorna copia mutable (no muta el original)", () => {
    const entity = makeEntity({ currency: "ARS" });
    const out = normalizeEntityCurrency(entity, [ars]);
    expect(out).not.toBe(entity);
    expect(out.currency).toBe("ARS");
  });

  it("mantiene el code cuando ya es uno conocido del catálogo", () => {
    const out = normalizeEntityCurrency(makeEntity({ currency: "USD" }), [ars, usd]);
    expect(out.currency).toBe("USD");
  });

  it("reemplaza id del catálogo por su code", () => {
    const out = normalizeEntityCurrency(makeEntity({ currency: "usd-id" }), [ars, usd]);
    expect(out.currency).toBe("USD");
  });

  it("borra currency cuando no coincide con nada", () => {
    const out = normalizeEntityCurrency(makeEntity({ currency: "EUR" }), [ars, usd]);
    expect(out.currency).toBeUndefined();
  });

  it("preserva entidad sin currency", () => {
    const out = normalizeEntityCurrency(makeEntity(), [ars, usd]);
    expect(out.currency).toBeUndefined();
  });
});

// ─── resolveClientFxRate ───────────────────────────────────────────────────

describe("resolveClientFxRate", () => {
  const ars = makeCurrency({ id: "ars-id", code: "ARS", isBase: true });
  const usd = makeCurrency({ id: "usd-id", code: "USD", isBase: false, latestRate: 1500 });
  const eur = makeCurrency({ id: "eur-id", code: "EUR", isBase: false, latestRate: null });

  it("retorna { warning: null } cuando no hay currency", () => {
    expect(resolveClientFxRate(undefined, [ars, usd, eur])).toEqual({ warning: null });
    expect(resolveClientFxRate(null,      [ars, usd, eur])).toEqual({ warning: null });
    expect(resolveClientFxRate("",        [ars, usd, eur])).toEqual({ warning: null });
  });

  it("retorna { warning: null } cuando la moneda no está en el catálogo", () => {
    expect(resolveClientFxRate("JPY", [ars, usd, eur])).toEqual({ warning: null });
  });

  it("fxRate=1 sin warning para moneda base", () => {
    expect(resolveClientFxRate("ARS", [ars, usd, eur])).toEqual({ fxRate: 1, warning: null });
  });

  it("fxRate=latestRate sin warning para moneda con cotización vigente", () => {
    expect(resolveClientFxRate("USD", [ars, usd, eur])).toEqual({ fxRate: 1500, warning: null });
  });

  it("fxRate=1 + warning para moneda válida sin cotización vigente", () => {
    const r = resolveClientFxRate("EUR", [ars, usd, eur]);
    expect(r.fxRate).toBe(1);
    expect(r.warning).toContain("EUR");
    expect(r.warning).toContain("cotización vigente");
  });

  it("acepta id en lugar de code", () => {
    expect(resolveClientFxRate("usd-id", [ars, usd, eur])).toEqual({ fxRate: 1500, warning: null });
  });
});

// ─── computeDueDateFromTerm ────────────────────────────────────────────────

describe("computeDueDateFromTerm", () => {
  const getTermDays = (term: string): number | null => {
    const map: Record<string, number> = { "Contado": 0, "30 días": 30, "60 días": 60 };
    return map[term] ?? null;
  };
  const addDaysISO = (iso: string, days: number): string => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  it("retorna '' cuando no hay término", () => {
    expect(computeDueDateFromTerm({
      canonicalTerm: "", draftDate: "2026-05-11", getTermDays, addDaysISO,
    })).toBe("");
  });

  it("retorna '' cuando no hay draftDate", () => {
    expect(computeDueDateFromTerm({
      canonicalTerm: "30 días", draftDate: "", getTermDays, addDaysISO,
    })).toBe("");
  });

  it("retorna '' cuando el término no tiene días asociables", () => {
    expect(computeDueDateFromTerm({
      canonicalTerm: "A definir", draftDate: "2026-05-11", getTermDays, addDaysISO,
    })).toBe("");
  });

  it("calcula la fecha futura para término con días", () => {
    expect(computeDueDateFromTerm({
      canonicalTerm: "30 días", draftDate: "2026-05-11", getTermDays, addDaysISO,
    })).toBe("2026-06-10");
  });

  it("respeta días=0 para 'Contado' (mismo día)", () => {
    expect(computeDueDateFromTerm({
      canonicalTerm: "Contado", draftDate: "2026-05-11", getTermDays, addDaysISO,
    })).toBe("2026-05-11");
  });
});
