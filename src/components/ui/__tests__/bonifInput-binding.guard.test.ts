// src/components/ui/__tests__/bonifInput-binding.guard.test.ts
// ============================================================================
// Guard estático para el binding del TPNumber de Bonificación en
// `TPDocumentLineAdvancedEditor.tsx`.
//
// Contrato actual del `displayValue`:
//
//   El TPNumber debe REFLEJAR el descuento EFECTIVO real de la línea —
//   sea manual, cliente, promo, descuento por cantidad, o combinaciones.
//   Mostrar `0,00` cuando el motor ya aplicó descuentos confunde al
//   operador (ve el card "Ajustes aplicados: −$X" pero el input dice 0,00,
//   contradicción visual).
//
//   El único caso en que el TPNumber muestra 0 es cuando `source === "NONE"`
//   (no hay ningún descuento aplicado a la línea).
//
//   Si el operador edita el TPNumber, `commitBonifChange` lo convierte a
//   override manual igual que antes. El chip "Promo: <nombre>" /
//   "Desc. cantidad" debajo del input indica el origen del valor actual,
//   para que el operador sepa si está editando un automático o un manual.
//
// Patrones prohibidos:
//   · `const displayValue = discIsPct ? pctEff : unitEff;` SIN guard por
//     `source === "NONE"` (mostraría valores cuando no hay descuentos).
//   · Cualquier asignación que fuerce `displayValue = 0` cuando `source`
//     es un origen distinto a "NONE" (reintroduce el bug "0,00 con
//     descuentos visibles en el card").
//
// POLICY R6 — no inducir interpretación errónea por display.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const editorPath = resolve(
  __dirname,
  "..",
  "TPDocumentLineAdvancedEditor.tsx",
);
const src = readFileSync(editorPath, "utf-8");

describe("TPDocumentLineAdvancedEditor — sublabel conceptual del TPNumber Bonificación", () => {
  it("El TPNumber tiene un sublabel data-tp-bonif-effective-label", () => {
    // El sublabel aclara que el % mostrado es el "efectivo acumulado"
    // del pipeline, no la suma de reglas. Existe data-attr para que el
    // QA visual y los tests de integración lo localicen sin depender
    // del texto exacto.
    expect(src).toMatch(/data-tp-bonif-effective-label="true"/);
  });

  it("Sublabel distingue MANUAL (pill), CLIENT y agregado automático con label dinámico bonif/recargo", () => {
    // T9 — el sublabel MANUAL ya NO es texto "Override manual" sino el
    // pill TPBadge "Manual" (component, no string). Las otras ramas
    // (cliente / pipeline acumulado) siguen siendo strings.
    expect(src).not.toMatch(/"Override manual"/);
    expect(src).toMatch(/<TPBadge tone="warning" size="sm">Manual<\/TPBadge>/);
    // Cliente: dinámico por kind.
    expect(src).toMatch(/"Recargo del cliente"/);
    expect(src).toMatch(/"Bonificación del cliente"/);
    // Pipeline acumulado: dinámico por kind.
    expect(src).toMatch(/"Recargo acumulado"/);
    expect(src).toMatch(/"Bonificación acumulada"/);
    // El label genérico "Efectivo acumulado" ya no se usa (legacy ambiguo).
    expect(src).not.toMatch(/"Efectivo acumulado"/);
  });

  it("El tooltip del sublabel explica que el motor aplica en cascada (no suma %)", () => {
    // Garantía conceptual: el tooltip debe dejar claro que el % no es
    // suma de reglas — el motor las aplica secuencialmente.
    expect(src).toMatch(/no suma porcentajes/);
    expect(src).toMatch(/cascada/);
  });
});

describe("TPDocumentLineAdvancedEditor — binding TPNumber Bonificación", () => {
  it("displayValue solo es 0 cuando `source === 'NONE'`", () => {
    // Buscamos la asignación a `displayValue` que rige el TPNumber.
    // Debe condicionar por `source === "NONE"` (única rama que devuelve 0).
    const match = src.match(/const\s+displayValue\s*=[^;]+;/s);
    expect(match).not.toBeNull();
    const decl = match![0];
    expect(decl).toMatch(/source\s*===\s*"NONE"/);
    // La rama "no NONE" debe leer el efectivo (`pctEff` / `unitEff`).
    expect(decl).toMatch(/pctEff/);
    expect(decl).toMatch(/unitEff/);
  });

  it("NO existe una guarda que excluya automáticos del TPNumber (anti-regresión)", () => {
    // Patrón histórico problemático: cuando había automáticos pero no
    // manual, se forzaba `displayValue = 0`. Eso contradice el card
    // "Ajustes aplicados". Lo prohibimos: ninguna rama del ternario debe
    // devolver `0` para los orígenes automáticos como MANUAL/CLIENT-only
    // sin incluir el resto.
    const decl = src.match(/const\s+displayValue\s*=[^;]+;/s)![0];
    // No debe existir la guarda específica "MANUAL || CLIENT" con else 0.
    // Forma exacta del bug previo (anti-regresión literal).
    expect(decl).not.toMatch(/source\s*===\s*"MANUAL"\s*\|\|\s*source\s*===\s*"CLIENT"[^?]*\?[^:]+:\s*0\s*;/);
  });

  it("NO existe la asignación cruda `displayValue = discIsPct ? pctEff : unitEff;` sin guarda alguna", () => {
    // Sin ninguna guarda, líneas sin descuentos mostrarían valores del
    // último cache → confusión. Debe haber AL MENOS la guarda
    // `source === "NONE"` que devuelve 0.
    const bugPattern = /const\s+displayValue\s*=\s*discIsPct\s*\?\s*pctEff\s*:\s*unitEff\s*;/;
    expect(bugPattern.test(src)).toBe(false);
  });
});
