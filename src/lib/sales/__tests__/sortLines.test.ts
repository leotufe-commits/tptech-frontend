// src/lib/sales/__tests__/sortLines.test.ts
// =============================================================================
// Tests del helper `sortLinesPreservingHeaders` usado por el botón "Ordenar
// líneas" en Factura de Ventas.
//
// Contrato:
//   1. Comparador es-AR con `sensitivity:"base"` y `numeric:true`.
//   2. HEADERs no se mueven; sort por segmento entre cabeceras.
//   3. Placeholders (sin articleId ni manualDescription con texto) al final.
//   4. Líneas con clave undefined o "" al final de su segmento.
//   5. Sort estable: empates preservan orden de inserción.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  sortLinesPreservingHeaders,
  articleNameSortKey,
  articleSkuSortKey,
} from "../sortLines";
import type { DocumentLine } from "../../document-types";

// ── Tests de la cascada de articleSkuSortKey (modo "Ordenar por SKU") ───────

describe("articleSkuSortKey — cascada SKU-first", () => {
  it("usa `sku` cuando está poblado (caso típico, catálogo)", () => {
    const l = { sku: "ANI-001", article: "Anillo solitario" } as DocumentLine;
    expect(articleSkuSortKey(l)).toBe("ANI-001");
  });

  it("cae a `article` cuando `sku` está vacío", () => {
    const l = { sku: "", article: "Anillo" } as DocumentLine;
    expect(articleSkuSortKey(l)).toBe("Anillo");
  });

  it("cae a `manualDescription` para líneas manuales sin SKU", () => {
    const l = {
      sku: "", article: "", isManual: true,
      manualDescription: "Servicio ajuste",
    } as DocumentLine;
    expect(articleSkuSortKey(l)).toBe("Servicio ajuste");
  });

  it("devuelve undefined si nada tiene texto", () => {
    const l = { sku: "", article: "", variant: "" } as DocumentLine;
    expect(articleSkuSortKey(l)).toBeUndefined();
  });

  it("trim de espacios", () => {
    const l = { sku: "  ANI-001  " } as DocumentLine;
    expect(articleSkuSortKey(l)).toBe("ANI-001");
  });
});

describe("sortLinesPreservingHeaders + articleSkuSortKey — orden por SKU", () => {
  it("orden numérico natural: ANI-002 antes que ANI-010 (caso del operador)", () => {
    const lines: DocumentLine[] = [
      { id: "1", sku: "ANI-010", article: "Anillo X", articleId: "x" } as DocumentLine,
      { id: "2", sku: "CAD-001", article: "Cadena Y", articleId: "y" } as DocumentLine,
      { id: "3", sku: "ANI-001", article: "Anillo A", articleId: "a" } as DocumentLine,
      { id: "4", sku: "ANI-002", article: "Anillo B", articleId: "b" } as DocumentLine,
    ];
    const out = sortLinesPreservingHeaders(lines, articleSkuSortKey);
    expect(out.map((l) => l.sku)).toEqual([
      "ANI-001",
      "ANI-002",
      "ANI-010",
      "CAD-001",
    ]);
  });

  it("manuales con descripción se intercalan según texto; vacías al final del segmento", () => {
    const lines: DocumentLine[] = [
      { id: "1", sku: "ANI-001", article: "Anillo", articleId: "a" } as DocumentLine,
      { id: "2", sku: "", article: "", isManual: true, manualDescription: "Servicio ajuste" } as DocumentLine,
      { id: "3", sku: "ZZZ-999", article: "Reloj",  articleId: "r" } as DocumentLine,
      { id: "4", sku: "", article: "", isManual: true, manualDescription: "" } as DocumentLine,  // vacía
    ];
    const out = sortLinesPreservingHeaders(lines, articleSkuSortKey);

    // Esperado:
    //   ANI-001       (sku)
    //   Servicio ajuste (manual con descripción → ordena por "Servicio ajuste")
    //   ZZZ-999       (sku)
    //   manual vacía  (sin sortKey → al final)
    expect(out[0]!.id).toBe("1");
    expect(out[1]!.id).toBe("2");
    expect(out[2]!.id).toBe("3");
    expect(out[3]!.id).toBe("4");
  });

  it("cabeceras se mantienen; sort por segmento", () => {
    const headerAnillos = {
      id: "h1", type: "HEADER", title: "Anillos",
      headerGroupBy: "CATEGORY", headerSourceValue: "Anillos",
      article: "", variant: "", quantity: 0, unitPrice: 0,
      discountAmount: 0, subtotal: 0, lineTotal: 0,
    } as DocumentLine;
    const headerCadenas = {
      id: "h2", type: "HEADER", title: "Cadenas",
      headerGroupBy: "CATEGORY", headerSourceValue: "Cadenas",
      article: "", variant: "", quantity: 0, unitPrice: 0,
      discountAmount: 0, subtotal: 0, lineTotal: 0,
    } as DocumentLine;
    const lines: DocumentLine[] = [
      headerAnillos,
      { id: "a3", sku: "ANI-010", articleId: "x" } as DocumentLine,
      { id: "a1", sku: "ANI-001", articleId: "a" } as DocumentLine,
      { id: "a2", sku: "ANI-002", articleId: "b" } as DocumentLine,
      headerCadenas,
      { id: "c2", sku: "CAD-002", articleId: "c2" } as DocumentLine,
      { id: "c1", sku: "CAD-001", articleId: "c1" } as DocumentLine,
    ];
    const out = sortLinesPreservingHeaders(lines, articleSkuSortKey);
    expect(out.map((l) => l.id)).toEqual([
      "h1",     // header Anillos preservado en posición
      "a1",     // ANI-001
      "a2",     // ANI-002
      "a3",     // ANI-010 (numeric: 10 > 2)
      "h2",     // header Cadenas preservado
      "c1",     // CAD-001
      "c2",     // CAD-002
    ]);
  });

  it("líneas legacy sin sku caen al fallback `article` y siguen ordenándose", () => {
    const lines: DocumentLine[] = [
      { id: "1", sku: "", article: "Reloj",   articleId: "r" } as DocumentLine,
      { id: "2", sku: "ANI-001", article: "Anillo", articleId: "a" } as DocumentLine,
      { id: "3", sku: "", article: "Pulsera", articleId: "p" } as DocumentLine,
    ];
    const out = sortLinesPreservingHeaders(lines, articleSkuSortKey);
    // Los SKUs en mayúsculas comparan con sensitivity:base contra
    // los nombres en minúsculas. Orden esperado por localeCompare:
    //   "ANI-001" < "Pulsera" < "Reloj"  (A < P < R, case-insensitive)
    expect(out.map((l) => l.id)).toEqual(["2", "3", "1"]);
  });
});

// ── Tests de la cascada de articleNameSortKey ───────────────────────────────

describe("articleNameSortKey — cascada robusta", () => {
  it("usa `article` cuando está poblado (caso típico, catálogo)", () => {
    const l = { article: "Reloj", variant: "" } as DocumentLine;
    expect(articleNameSortKey(l)).toBe("Reloj");
  });

  it("usa `variant` cuando `article` está vacío", () => {
    const l = { article: "", variant: "Negro mate" } as DocumentLine;
    expect(articleNameSortKey(l)).toBe("Negro mate");
  });

  it("usa `description` cuando article y variant están vacíos (legacy)", () => {
    const l = { article: "", variant: "", description: "Reloj antiguo" } as DocumentLine;
    expect(articleNameSortKey(l)).toBe("Reloj antiguo");
  });

  it("usa `manualDescription` cuando solo es manual", () => {
    const l = {
      article: "", variant: "", isManual: true,
      manualDescription: "Servicio ajuste",
    } as DocumentLine;
    expect(articleNameSortKey(l)).toBe("Servicio ajuste");
  });

  it("usa `sku` como último fallback", () => {
    const l = { article: "", variant: "", sku: "SKU-123" } as DocumentLine;
    expect(articleNameSortKey(l)).toBe("SKU-123");
  });

  it("trimea espacios y trata strings vacíos como undefined", () => {
    const l = { article: "   ", variant: "  Anillo  " } as DocumentLine;
    expect(articleNameSortKey(l)).toBe("Anillo");
  });

  it("devuelve undefined cuando ningún campo tiene texto", () => {
    const l = { article: "", variant: "" } as DocumentLine;
    expect(articleNameSortKey(l)).toBeUndefined();
  });

  it("regresión: líneas con shape legacy (sin `article`) ordenan por description", () => {
    // Caso del bug reportado: una factura cargada desde un draft viejo
    // donde las líneas tenían `description` en lugar de `article`. Antes
    // del fix, todas devolvían undefined → sort no las movía.
    const lines: DocumentLine[] = [
      { id: "1", article: "", variant: "", description: "Reloj",   articleId: "r" } as DocumentLine,
      { id: "2", article: "", variant: "", description: "Anillo",  articleId: "a" } as DocumentLine,
      { id: "3", article: "", variant: "", description: "Pulsera", articleId: "p" } as DocumentLine,
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);
    expect(out.map((l) => l.description)).toEqual(["Anillo", "Pulsera", "Reloj"]);
  });
});

let nextId = 0;
function uid(): string { nextId += 1; return `L${nextId}`; }

function articleLine(name: string, opts: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id:        uid(),
    type:      "ARTICLE",
    article:   name,
    variant:   "",
    articleId: `art-${uid()}`,
    quantity:  1,
    unitPrice: 100,
    discountAmount: 0,
    subtotal:  100,
    lineTotal: 100,
    ...opts,
  } as DocumentLine;
}

function manualLine(description: string): DocumentLine {
  return {
    id:        uid(),
    type:      "ARTICLE",
    article:   "",
    variant:   "",
    isManual:  true,
    manualDescription: description,
    quantity:  1,
    unitPrice: 0,
    discountAmount: 0,
    subtotal:  0,
    lineTotal: 0,
  } as DocumentLine;
}

function emptyLine(): DocumentLine {
  return {
    id:        uid(),
    type:      "ARTICLE",
    article:   "",
    variant:   "",
    quantity:  0,
    unitPrice: 0,
    discountAmount: 0,
    subtotal:  0,
    lineTotal: 0,
  } as DocumentLine;
}

function header(title: string): DocumentLine {
  return {
    id:                uid(),
    type:              "HEADER",
    title,
    headerGroupBy:     "CATEGORY",
    headerSourceValue: title,
    headerEditedByUser: false,
    article:           "",
    variant:           "",
    quantity:          0,
    unitPrice:         0,
    discountAmount:    0,
    subtotal:          0,
    lineTotal:         0,
  } as DocumentLine;
}

function names(out: DocumentLine[]): string[] {
  return out.map((l) =>
    l.type === "HEADER"
      ? `[H:${l.title}]`
      : (l.article as string) || `[M:${l.manualDescription ?? ""}]` || "[empty]",
  );
}

describe("sortLinesPreservingHeaders — orden alfabético con cabeceras", () => {
  it("solo artículos: ordena alfabéticamente por nombre", () => {
    const lines = [
      articleLine("Reloj"),
      articleLine("Anillo"),
      articleLine("Pulsera"),
      articleLine("Cadena"),
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);
    expect(names(out)).toEqual(["Anillo", "Cadena", "Pulsera", "Reloj"]);
  });

  it("'Oro 9K' antes de 'Oro 18K' por orden numérico natural", () => {
    const lines = [
      articleLine("Oro 18K"),
      articleLine("Oro 24K"),
      articleLine("Oro 9K"),
      articleLine("Plata 925"),
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);
    expect(names(out)).toEqual(["Oro 9K", "Oro 18K", "Oro 24K", "Plata 925"]);
  });

  it("comparación insensible a mayúsculas y acentos", () => {
    const lines = [
      articleLine("ánfora"),
      articleLine("Bolso"),
      articleLine("Anillo"),
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);
    // "ánfora" y "Anillo" comparan como "a..." y se ordenan entre sí por
    // localeCompare; ambos van antes de "Bolso".
    expect(names(out).slice(0, 2)).toEqual(
      expect.arrayContaining(["Anillo", "ánfora"]),
    );
    expect(names(out)[2]).toBe("Bolso");
  });

  it("línea manual con descripción se ordena por su texto", () => {
    const lines = [
      articleLine("Pulsera"),
      manualLine("Brazalete antiguo"),
      articleLine("Anillo"),
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);
    // Esperado: Anillo, Brazalete antiguo (manual), Pulsera
    expect((out[0] as DocumentLine).article).toBe("Anillo");
    expect((out[1] as DocumentLine).manualDescription).toBe("Brazalete antiguo");
    expect((out[2] as DocumentLine).article).toBe("Pulsera");
  });

  it("línea manual sin descripción va al final del segmento", () => {
    const lines = [
      articleLine("Reloj"),
      manualLine(""),                       // sin texto
      articleLine("Anillo"),
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);
    expect((out[0] as DocumentLine).article).toBe("Anillo");
    expect((out[1] as DocumentLine).article).toBe("Reloj");
    // La manual sin descripción queda al final.
    expect((out[2] as DocumentLine).isManual).toBe(true);
  });

  it("placeholders (sin articleId ni manualDescription) van al FINAL del array", () => {
    const lines = [
      articleLine("Reloj"),
      emptyLine(),
      articleLine("Anillo"),
      emptyLine(),
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);
    // Primero los reales ordenados, luego los placeholders.
    expect((out[0] as DocumentLine).article).toBe("Anillo");
    expect((out[1] as DocumentLine).article).toBe("Reloj");
    expect((out[2] as DocumentLine).article).toBe("");
    expect((out[3] as DocumentLine).article).toBe("");
  });

  it("preserva HEADERs y ordena DENTRO de cada segmento", () => {
    const lines = [
      header("Anillos"),
      articleLine("Solitario"),
      articleLine("Alianza"),
      articleLine("Eternity"),
      header("Pulseras"),
      articleLine("Tennis"),
      articleLine("Cubana"),
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);

    // Segmento 1 (bajo "Anillos"): Alianza · Eternity · Solitario
    // Segmento 2 (bajo "Pulseras"): Cubana · Tennis
    expect(names(out)).toEqual([
      "[H:Anillos]",
      "Alianza",
      "Eternity",
      "Solitario",
      "[H:Pulseras]",
      "Cubana",
      "Tennis",
    ]);
  });

  it("cabeceras NUNCA se mezclan con artículos por nombre", () => {
    // Caso del bug: con sort plano, "Anillos" (header) terminaba intercalado
    // entre artículos por orden alfabético, separando líneas de su grupo.
    const lines = [
      header("Pulseras"),  // viene primero pero "P" > "A" / "B" / "C"
      articleLine("Anillo"),
      articleLine("Brazalete"),
      articleLine("Cadena"),
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);
    // Header de "Pulseras" sigue al inicio porque es la primera cabecera;
    // los 3 artículos pertenecen a su segmento y se ordenan dentro.
    expect((out[0] as DocumentLine).type).toBe("HEADER");
    expect(out[0]!.title).toBe("Pulseras");
    expect((out[1] as DocumentLine).article).toBe("Anillo");
    expect((out[2] as DocumentLine).article).toBe("Brazalete");
    expect((out[3] as DocumentLine).article).toBe("Cadena");
  });

  it("segmento 'raíz' (líneas antes de la primera cabecera) se ordena", () => {
    const lines = [
      articleLine("Reloj"),
      articleLine("Anillo"),
      header("Pulseras"),
      articleLine("Tennis"),
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);
    expect(names(out)).toEqual([
      "Anillo",
      "Reloj",
      "[H:Pulseras]",
      "Tennis",
    ]);
  });

  it("sort estable: artículos con la misma clave preservan orden de inserción", () => {
    const lines = [
      articleLine("Anillo", { id: "first"  } as Partial<DocumentLine>),
      articleLine("Anillo", { id: "second" } as Partial<DocumentLine>),
      articleLine("Anillo", { id: "third"  } as Partial<DocumentLine>),
    ];
    const out = sortLinesPreservingHeaders(lines, articleNameSortKey);
    expect(out.map((l) => l.id)).toEqual(["first", "second", "third"]);
  });

  it("modo 'article' es idempotente: dos pasadas dan el mismo resultado", () => {
    const lines = [
      articleLine("Cadena"),
      articleLine("Anillo"),
      articleLine("Pulsera"),
    ];
    const pass1 = sortLinesPreservingHeaders(lines, articleNameSortKey);
    const pass2 = sortLinesPreservingHeaders(pass1, articleNameSortKey);
    expect(names(pass2)).toEqual(names(pass1));
  });

  it("no muta el array original", () => {
    const lines = [
      articleLine("B"),
      articleLine("A"),
    ];
    const snapshot = lines.map((l) => l.article);
    sortLinesPreservingHeaders(lines, articleNameSortKey);
    expect(lines.map((l) => l.article)).toEqual(snapshot);
  });
});
