// src/lib/sales/__tests__/interpolateEmailTemplate.test.ts
// =============================================================================
// Tests del interpolador de plantillas de email. Funcion pura, sin React.
// =============================================================================

import { describe, it, expect } from "vitest";
import { interpolateEmailTemplate, SUPPORTED_EMAIL_VARS } from "../interpolateEmailTemplate";

describe("interpolateEmailTemplate", () => {
  it("reemplaza las 5 variables soportadas", () => {
    const tpl  = "Hola {{cliente}}, te enviamos {{estado}} {{numero}} de {{joyeria}} con fecha {{fecha}}.";
    const out  = interpolateEmailTemplate(tpl, {
      cliente: "Acme SA",
      numero:  "A-0001-00000001",
      joyeria: "Joyería Test",
      estado:  "Factura",
      fecha:   "26/05/2026",
    });
    expect(out).toBe("Hola Acme SA, te enviamos Factura A-0001-00000001 de Joyería Test con fecha 26/05/2026.");
  });

  it("variable repetida → reemplaza todas las apariciones", () => {
    const tpl = "{{cliente}}, querido {{cliente}}, ya pagaste {{numero}}? {{numero}} esta vencida.";
    const out = interpolateEmailTemplate(tpl, { cliente: "Pepe", numero: "FA-1" });
    expect(out).toBe("Pepe, querido Pepe, ya pagaste FA-1? FA-1 esta vencida.");
  });

  it("variable sin valor (null/undefined) → reemplaza por '' (no rompe)", () => {
    expect(interpolateEmailTemplate("Hola {{cliente}}", {}))                     .toBe("Hola ");
    expect(interpolateEmailTemplate("Hola {{cliente}}", { cliente: null }))      .toBe("Hola ");
    expect(interpolateEmailTemplate("Hola {{cliente}}", { cliente: undefined })) .toBe("Hola ");
  });

  it("variable con valor vacio '' → reemplaza por '' (deja el hueco)", () => {
    expect(interpolateEmailTemplate("[{{cliente}}]", { cliente: "" })).toBe("[]");
  });

  it("template vacio o null → devuelve ''", () => {
    expect(interpolateEmailTemplate("",         {})).toBe("");
    expect(interpolateEmailTemplate(null,       {})).toBe("");
    expect(interpolateEmailTemplate(undefined,  {})).toBe("");
  });

  it("variable case-sensitive: {{Cliente}} no coincide con {{cliente}}", () => {
    const out = interpolateEmailTemplate("{{Cliente}} vs {{cliente}}", { cliente: "Pepe" });
    expect(out).toBe("{{Cliente}} vs Pepe");
  });

  it("variable desconocida no se toca (deja el placeholder)", () => {
    const out = interpolateEmailTemplate("Hola {{cliente}}, total {{total}}", { cliente: "Ana" });
    expect(out).toBe("Hola Ana, total {{total}}");
  });

  it("preserva saltos de linea y espacios", () => {
    const tpl = "Hola {{cliente}},\n\nTe envio {{numero}}.\n\nGracias.\n{{joyeria}}";
    const out = interpolateEmailTemplate(tpl, { cliente: "X", numero: "Y", joyeria: "Z" });
    expect(out).toBe("Hola X,\n\nTe envio Y.\n\nGracias.\nZ");
  });

  it("idempotente: aplicar 2 veces devuelve lo mismo", () => {
    const tpl   = "Hola {{cliente}} - {{numero}}";
    const vars  = { cliente: "Ana", numero: "FA-1" };
    const once  = interpolateEmailTemplate(tpl, vars);
    const twice = interpolateEmailTemplate(once, vars);
    expect(twice).toBe(once);
  });

  it("convierte valores no-string a string", () => {
    // Defensivo: si el caller pasa por accidente un number/Date, no rompe.
    const out = interpolateEmailTemplate("{{numero}}", { numero: 42 as unknown as string });
    expect(out).toBe("42");
  });

  it("SUPPORTED_EMAIL_VARS lista las 5 variables canonicas", () => {
    expect(SUPPORTED_EMAIL_VARS).toEqual([
      "{{cliente}}",
      "{{numero}}",
      "{{joyeria}}",
      "{{estado}}",
      "{{fecha}}",
    ]);
  });
});
