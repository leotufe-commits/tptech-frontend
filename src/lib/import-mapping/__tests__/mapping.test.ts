// src/lib/import-mapping/__tests__/mapping.test.ts
// Tests unitarios para las funciones de mapeo de columnas.
// Requiere vitest: npx vitest run src/lib/import-mapping/__tests__/mapping.test.ts

import { describe, it, expect } from "vitest";
import { autoMatchColumns, normalizeKey } from "../autoMatch";
import { applyMapping, getMissingRequired, getDuplicateMappings } from "../applyMapping";
import { ARTICLE_FIELDS } from "../articleFields";
import { ENTITY_FIELDS } from "../entityFields";

describe("normalizeKey", () => {
  it("elimina tildes y pasa a minúsculas", () => {
    expect(normalizeKey("Código")).toBe("codigo");
    expect(normalizeKey("Categoría")).toBe("categoria");
    expect(normalizeKey("Número")).toBe("numero");
  });
  it("reemplaza underscores con espacios", () => {
    expect(normalizeKey("Precio_Venta")).toBe("precio venta");
  });
  it("quita asterisco final", () => {
    expect(normalizeKey("Nombre *")).toBe("nombre");
    expect(normalizeKey("Nombre*")).toBe("nombre");
  });
});

describe("autoMatchColumns - artículos", () => {
  it("match exacto por key", () => {
    const result = autoMatchColumns(["Nombre"], ARTICLE_FIELDS, { Nombre: "Anillo" });
    expect(result[0].mappedTo).toBe("Nombre");
    expect(result[0].example).toBe("Anillo");
  });
  it("match por alias 'codigo'", () => {
    const result = autoMatchColumns(["codigo"], ARTICLE_FIELDS);
    expect(result[0].mappedTo).toBe("Codigo");
  });
  it("match por alias 'precio venta' con mayúscula", () => {
    const result = autoMatchColumns(["Precio Venta"], ARTICLE_FIELDS);
    expect(result[0].mappedTo).toBe("Precio_Venta");
  });
  it("match por alias 'cod' para Codigo", () => {
    const result = autoMatchColumns(["Cod"], ARTICLE_FIELDS);
    expect(result[0].mappedTo).toBe("Codigo");
  });
  it("retorna null para columna desconocida", () => {
    const result = autoMatchColumns(["COLUMNA_RARA_XYZ"], ARTICLE_FIELDS);
    expect(result[0].mappedTo).toBeNull();
  });
  it("no mapea el mismo campo dos veces", () => {
    const result = autoMatchColumns(["Nombre", "name"], ARTICLE_FIELDS);
    const mapped = result.map(r => r.mappedTo);
    const nonNull = mapped.filter(Boolean);
    expect(new Set(nonNull).size).toBe(nonNull.length);
  });
});

describe("autoMatchColumns - entidades", () => {
  it("match de alias de email", () => {
    const result = autoMatchColumns(["correo", "mail"], ENTITY_FIELDS);
    expect(result[0].mappedTo).toBe("email");
    // El segundo alias de email ya fue tomado
    expect(result[1].mappedTo).toBeNull();
  });
  it("match 'DNI' a documentNumber", () => {
    const result = autoMatchColumns(["DNI"], ENTITY_FIELDS);
    expect(result[0].mappedTo).toBe("documentNumber");
  });
});

describe("applyMapping", () => {
  it("renombra columnas correctamente", () => {
    const mappings = [
      { fileHeader: "Cod", mappedTo: "Codigo", example: "A001" },
      { fileHeader: "Artículo", mappedTo: "Nombre", example: "Anillo" },
    ];
    const rows = [{ Cod: "A001", "Artículo": "Anillo", Precio: "1000" }];
    const result = applyMapping(rows, mappings);
    expect(result[0]).toEqual({ Codigo: "A001", Nombre: "Anillo" });
  });
  it("ignora columnas con mappedTo null", () => {
    const mappings = [
      { fileHeader: "Cod", mappedTo: "Codigo", example: "A001" },
      { fileHeader: "Precio", mappedTo: null, example: "1000" },
    ];
    const rows = [{ Cod: "A001", Precio: "1000" }];
    const result = applyMapping(rows, mappings);
    expect(result[0]).toEqual({ Codigo: "A001" });
    expect("Precio" in result[0]).toBe(false);
  });
});

describe("getMissingRequired", () => {
  it("reporta campo requerido no mapeado", () => {
    const mappings = [{ fileHeader: "SKU", mappedTo: "SKU", example: "" }];
    const missing = getMissingRequired(mappings, ["Nombre"], ARTICLE_FIELDS);
    expect(missing).toContain("Nombre del artículo");
  });
  it("retorna vacío cuando todos los requeridos están mapeados", () => {
    const mappings = [{ fileHeader: "Producto", mappedTo: "Nombre", example: "" }];
    const missing = getMissingRequired(mappings, ["Nombre"], ARTICLE_FIELDS);
    expect(missing).toHaveLength(0);
  });
});

describe("getDuplicateMappings", () => {
  it("detecta mapeo duplicado", () => {
    const mappings = [
      { fileHeader: "Nombre", mappedTo: "Nombre", example: "" },
      { fileHeader: "name", mappedTo: "Nombre", example: "" },
    ];
    const dupes = getDuplicateMappings(mappings);
    expect(dupes).toContain("Nombre");
  });
  it("retorna vacío cuando no hay duplicados", () => {
    const mappings = [
      { fileHeader: "A", mappedTo: "Nombre", example: "" },
      { fileHeader: "B", mappedTo: "Codigo", example: "" },
    ];
    expect(getDuplicateMappings(mappings)).toHaveLength(0);
  });
});
