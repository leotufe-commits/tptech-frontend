// src/lib/pricing/__tests__/visualTokens.test.ts
// ============================================================================
// Tests-doc del módulo de tokens. Sirven como:
//   - Guard contra typos (renombrar un token rompe acá)
//   - Documentación viva (los snapshots muestran el valor canónico)
//   - Pista para nuevos colaboradores sobre qué tokens existen
// ============================================================================

import { describe, it, expect } from "vitest";
import { vt, colors, text, row, card } from "../visualTokens";

describe("visualTokens — sanity", () => {
  it("expone barrel vt con 4 grupos", () => {
    expect(vt).toHaveProperty("colors");
    expect(vt).toHaveProperty("text");
    expect(vt).toHaveProperty("row");
    expect(vt).toHaveProperty("card");
  });

  it("expone exports nombrados además del barrel", () => {
    expect(colors).toBe(vt.colors);
    expect(text).toBe(vt.text);
    expect(row).toBe(vt.row);
    expect(card).toBe(vt.card);
  });

  it("color de descuento incluye soporte dark mode", () => {
    expect(vt.colors.discount).toContain("text-red-500");
    expect(vt.colors.discount).toContain("dark:text-red-400");
  });

  it("color de recargo es amber", () => {
    expect(vt.colors.surcharge).toContain("text-amber-600");
    expect(vt.colors.surcharge).toContain("dark:text-amber-400");
  });

  it("color de bonificación es emerald", () => {
    expect(vt.colors.bonus).toContain("text-emerald-600");
    expect(vt.colors.bonus).toContain("dark:text-emerald-400");
  });

  it("total grand usa font-extrabold (jerarquía máxima)", () => {
    expect(vt.text.totalGrand).toContain("font-extrabold");
    expect(vt.text.totalGrand).toContain("tabular-nums");
  });

  it("total intermedio usa text-[15px] font-bold (jerarquía media)", () => {
    expect(vt.text.total).toContain("text-[15px]");
    expect(vt.text.total).toContain("font-bold");
  });

  it("total de cierre usa text-sm font-bold (jerarquía card)", () => {
    expect(vt.text.totalCard).toContain("text-sm");
    expect(vt.text.totalCard).toContain("font-bold");
  });

  it("separator default es border-border/30 + pt-1.5 + mt-0.5", () => {
    expect(vt.row.separator).toContain("border-border/30");
    expect(vt.row.separator).toContain("pt-1.5");
    expect(vt.row.separator).toContain("mt-0.5");
  });

  it("card outer es el wrapper estándar (rounded-xl + border + bg-card)", () => {
    expect(vt.card.outer).toContain("rounded-xl");
    expect(vt.card.outer).toContain("border-border");
    expect(vt.card.outer).toContain("bg-card");
  });

  it("card inner es la variante de cards anidados (rounded-lg + bg-muted/15)", () => {
    expect(vt.card.inner).toContain("rounded-lg");
    expect(vt.card.inner).toContain("bg-muted/15");
  });

  it("card info es banner primary (bg-primary/5 + border-primary/25)", () => {
    expect(vt.card.info).toContain("border-primary/25");
    expect(vt.card.info).toContain("bg-primary/5");
  });

  it("card totalAccent es la fila destacada de Total a pagar", () => {
    expect(vt.card.totalAccent).toContain("bg-primary/5");
    expect(vt.card.totalAccent).toContain("border-primary/20");
  });
});
