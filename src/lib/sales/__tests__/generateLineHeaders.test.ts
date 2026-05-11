// src/lib/sales/__tests__/generateLineHeaders.test.ts
// =============================================================================
// Tests del helper que genera cabeceras automáticas en Factura de Ventas.
//
// Contrato de orden (post-fix):
//   · Las cabeceras se ordenan ALFABÉTICAMENTE por label visible.
//   · Comparación con `localeCompare("es", { sensitivity: "base", numeric: true })`:
//     - sin diferencia por mayúsculas/acentos
//     - "Oro 9K" < "Oro 18K" (numeric natural)
//   · Las etiquetas de fallback ("Sin metal", "Sin marca", "Sin categoría",
//     etc.) siempre van AL FINAL para no mezclarse con grupos con dato real.
//   · Dentro de un grupo, las líneas conservan el orden de inserción.
//   · Cabeceras editadas por el operador (`headerEditedByUser=true`)
//     mantienen su título tras la regeneración, pero el grupo se reordena
//     según el `sourceValue` (no según el título editado).
// =============================================================================

import { describe, it, expect } from "vitest";
import { generateHeadersByCriterion } from "../generateLineHeaders";
import type { DocumentLine } from "../../document-types";

// ── Helpers ─────────────────────────────────────────────────────────────────

let nextId = 0;
function uid(): string { nextId += 1; return `L${nextId}`; }

/** Construye una línea de artículo con `headerSnapshot` (CATEGORY/BRAND/...).
 *  Solo poblamos los campos que el helper lee. */
function articleLine(opts: {
  category?: string | null;
  brand?: string | null;
  group?: string | null;
  manufacturer?: string | null;
  metalName?: string | null;
  purityLabel?: string | null;
  marker?: string;
}): DocumentLine {
  return {
    id:        uid(),
    type:      "ARTICLE",
    article:   opts.marker ?? "Artículo",
    variant:   "",
    articleId: `art-${uid()}`,
    quantity:  1,
    unitPrice: 100,
    discountAmount: 0,
    subtotal:  100,
    lineTotal: 100,
    headerSnapshot: {
      categoryName: opts.category    ?? null,
      brand:        opts.brand       ?? null,
      groupName:    opts.group       ?? null,
      manufacturer: opts.manufacturer ?? null,
    },
    pricingMeta: opts.metalName != null || opts.purityLabel != null
      ? {
          composition: {
            metal: {
              metalName:   opts.metalName  ?? null,
              purityLabel: opts.purityLabel ?? null,
            },
          },
        } as any
      : undefined,
  } as DocumentLine;
}

/** Devuelve los títulos visibles de los HEADERs en orden, junto con los
 *  marcadores ("article" string) de las líneas de cada grupo. */
function readShape(out: DocumentLine[]): Array<
  { kind: "header"; title: string } | { kind: "line"; marker: string }
> {
  return out.map((l) =>
    l.type === "HEADER"
      ? { kind: "header" as const, title: l.title ?? "" }
      : { kind: "line" as const, marker: (l.article as string) ?? "" },
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("generateHeadersByCriterion — orden alfabético por label", () => {
  it("CATEGORY: ordena cabeceras alfabéticamente, 'Sin categoría' al final", () => {
    const lines: DocumentLine[] = [
      articleLine({ category: "Relojes",    marker: "rel-1" }),
      articleLine({ category: "Anillos",    marker: "ani-1" }),
      articleLine({ category: null,         marker: "sin-1" }),
      articleLine({ category: "Pulseras",   marker: "pul-1" }),
      articleLine({ category: "Anillos",    marker: "ani-2" }),
    ];
    const out = generateHeadersByCriterion(lines, "CATEGORY");
    const shape = readShape(out);

    // Esperado: Anillos · Pulseras · Relojes · Sin categoría
    expect(shape).toEqual([
      { kind: "header", title: "Anillos"        },
      { kind: "line",   marker: "ani-1"         },
      { kind: "line",   marker: "ani-2"         },
      { kind: "header", title: "Pulseras"       },
      { kind: "line",   marker: "pul-1"         },
      { kind: "header", title: "Relojes"        },
      { kind: "line",   marker: "rel-1"         },
      { kind: "header", title: "Sin categoría"  },
      { kind: "line",   marker: "sin-1"         },
    ]);
  });

  it("BRAND: comparación case-insensitive y agnóstica a acentos al ordenar", () => {
    // El helper agrupa por valor exacto del label, así que "Acme" y "ácme"
    // son DOS grupos distintos. El sort entre grupos sí es case/acento
    // insensitive, así que ambos quedan al principio (juntos, en cualquier
    // orden interno — `localeCompare` con sensitivity:"base" los considera
    // iguales y el sort de Array es estable, así que conservan el orden
    // de inserción entre sí).
    const lines: DocumentLine[] = [
      articleLine({ brand: "ácme",    marker: "a" }),
      articleLine({ brand: "BMW",     marker: "b" }),
      articleLine({ brand: "Acme",    marker: "a2" }),
      articleLine({ brand: "Cartier", marker: "c" }),
    ];
    const out = generateHeadersByCriterion(lines, "BRAND");
    const titles = out.filter((l) => l.type === "HEADER").map((l) => l.title ?? "");

    // 4 grupos. Los dos primeros normalizan a "a" → ambos antes de "B" / "C".
    expect(titles).toHaveLength(4);
    expect(["Acme", "ácme"]).toContain(titles[0]);
    expect(["Acme", "ácme"]).toContain(titles[1]);
    expect(titles[2]).toBe("BMW");
    expect(titles[3]).toBe("Cartier");
  });

  it("METAL: orden numeric natural — 'Oro 9K' antes que 'Oro 18K'", () => {
    const lines: DocumentLine[] = [
      articleLine({ metalName: "Oro",   purityLabel: "18K", marker: "oro18-1" }),
      articleLine({ metalName: "Oro",   purityLabel: "9K",  marker: "oro9-1"  }),
      articleLine({ metalName: "Plata", purityLabel: "925", marker: "plata-1" }),
      articleLine({ metalName: "Oro",   purityLabel: "24K", marker: "oro24-1" }),
      articleLine({                                          marker: "sin-1"  }),
    ];
    const out = generateHeadersByCriterion(lines, "METAL");
    const titles = out.filter((l) => l.type === "HEADER").map((l) => l.title ?? "");

    // Esperado: Oro 9K · Oro 18K · Oro 24K · Plata 925 · Sin metal
    expect(titles).toEqual([
      "Oro 9K",
      "Oro 18K",
      "Oro 24K",
      "Plata 925",
      "Sin metal",
    ]);
  });

  it("preserva el orden de inserción de las líneas DENTRO de cada grupo", () => {
    const lines: DocumentLine[] = [
      articleLine({ category: "B-grupo", marker: "b-1" }),
      articleLine({ category: "A-grupo", marker: "a-1" }),
      articleLine({ category: "B-grupo", marker: "b-2" }),
      articleLine({ category: "A-grupo", marker: "a-2" }),
      articleLine({ category: "B-grupo", marker: "b-3" }),
    ];
    const out = generateHeadersByCriterion(lines, "CATEGORY");
    const markers = out
      .filter((l) => l.type !== "HEADER")
      .map((l) => l.article as string);

    // Grupo "A-grupo" primero (alfabético), líneas en orden de inserción.
    // Luego "B-grupo" con sus 3 líneas también en orden de inserción.
    expect(markers).toEqual(["a-1", "a-2", "b-1", "b-2", "b-3"]);
  });

  it("preserva el título de cabeceras editadas por el operador y reordena por sourceValue", () => {
    const editedHeader: DocumentLine = {
      id:                 "hdr-edited",
      type:               "HEADER",
      title:              "Mi título personalizado",
      headerGroupBy:      "CATEGORY",
      headerSourceValue:  "Anillos",
      headerEditedByUser: true,
      article:            "",
      variant:            "",
      quantity:           0,
      unitPrice:          0,
      discountAmount:     0,
      subtotal:           0,
      lineTotal:          0,
    } as DocumentLine;

    const lines: DocumentLine[] = [
      articleLine({ category: "Relojes", marker: "rel-1" }),
      editedHeader,
      articleLine({ category: "Anillos", marker: "ani-1" }),
    ];
    const out = generateHeadersByCriterion(lines, "CATEGORY");
    const headers = out.filter((l) => l.type === "HEADER");

    // El header editado de "Anillos" se preserva con su título personalizado,
    // pero el ORDEN entre grupos sigue siendo alfabético por sourceValue:
    // Anillos (editado) → Relojes
    expect(headers).toHaveLength(2);
    expect(headers[0]!.title).toBe("Mi título personalizado");
    expect(headers[0]!.headerSourceValue).toBe("Anillos");
    expect(headers[0]!.id).toBe("hdr-edited"); // identidad preservada
    expect(headers[1]!.title).toBe("Relojes");
  });

  it("regeneración estable: dos pasadas seguidas dan el mismo orden de cabeceras", () => {
    const lines: DocumentLine[] = [
      articleLine({ category: "Cartier", marker: "c" }),
      articleLine({ category: "Aretes",  marker: "a" }),
      articleLine({ category: "Bolsos",  marker: "b" }),
    ];
    const pass1 = generateHeadersByCriterion(lines, "CATEGORY");
    const pass2 = generateHeadersByCriterion(pass1, "CATEGORY");

    const titles1 = pass1.filter((l) => l.type === "HEADER").map((l) => l.title ?? "");
    const titles2 = pass2.filter((l) => l.type === "HEADER").map((l) => l.title ?? "");

    expect(titles1).toEqual(["Aretes", "Bolsos", "Cartier"]);
    expect(titles2).toEqual(titles1);
  });
});
