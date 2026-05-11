// src/lib/sales/__tests__/matchPreviewLines.test.ts
// =============================================================================
// Tests del matcheo posicional draft ↔ preview.
//
// Bug histórico cubierto: en una factura con [Article 1, Article 2, Manual 3
// "probar", Article 4], el reader visual saltaba la línea manual SIN avanzar
// el índice del preview. Resultado: Article 4 leía `preview.lines[2]` (la del
// manual), incluido `lineTotalWithTax = 990`, y mostraba ese total en lugar
// del propio. La fix centraliza el predicado previewable en `isPreviewableLine`
// para que `buildSalePreviewPayload`, `applySalePreviewToDraft` y
// `linesForView` lo compartan.
// =============================================================================

import { describe, it, expect } from "vitest";
import { isPreviewableLine, matchPreviewLines } from "../matchPreviewLines";

describe("isPreviewableLine — predicado canónico", () => {
  it("ARTICLE con qty > 0 es previewable", () => {
    expect(isPreviewableLine({ articleId: "art-1", quantity: 1 })).toBe(true);
  });

  it("ARTICLE con qty 0 NO es previewable", () => {
    expect(isPreviewableLine({ articleId: "art-1", quantity: 0 })).toBe(false);
  });

  it("MANUAL con descripción y qty > 0 es previewable", () => {
    expect(isPreviewableLine({
      isManual: true, manualDescription: "probar", quantity: 1,
    })).toBe(true);
  });

  it("MANUAL sin descripción NO es previewable", () => {
    expect(isPreviewableLine({
      isManual: true, manualDescription: "", quantity: 1,
    })).toBe(false);
  });

  it("MANUAL con descripción de espacios NO es previewable", () => {
    expect(isPreviewableLine({
      isManual: true, manualDescription: "   ", quantity: 1,
    })).toBe(false);
  });

  it("línea vacía (sin articleId ni manual) NO es previewable", () => {
    expect(isPreviewableLine({ quantity: 1 })).toBe(false);
  });
});

describe("matchPreviewLines — invariante de orden con manuales intercalados", () => {
  it("regresión del bug del 990: el preview de una manual NUNCA se filtra al artículo siguiente", () => {
    // Reproduce el caso exacto reportado por el operador:
    //   [Article 1, Article 2, Manual 3 ("probar"), Article 4]
    //   buildSalePreviewPayload envía las 4 → backend devuelve 4 previews.
    //   Antes del fix: Article 4 leía preview[2] (la del manual, total 990).
    //   Con el fix: cada línea recibe su propio preview por orden estable.
    type L = { id: string; articleId?: string | null; isManual?: boolean; manualDescription?: string; quantity?: number };
    const draft: L[] = [
      { id: "L1", articleId: "art-1",  quantity: 1 },
      { id: "L2", articleId: "art-2",  quantity: 1 },
      { id: "L3", isManual: true, manualDescription: "probar", quantity: 1 },
      { id: "L4", articleId: "art-4",  quantity: 1 },
    ];
    type P = { id: string; lineTotalWithTax: number };
    const previews: P[] = [
      { id: "p1", lineTotalWithTax: 100   },  // Article 1
      { id: "p2", lineTotalWithTax: 200   },  // Article 2
      { id: "p3", lineTotalWithTax: 990   },  // Manual 3 (descripción="probar")
      { id: "p4", lineTotalWithTax: 99999 },  // Article 4 (precio alto)
    ];

    const matched = matchPreviewLines(draft, previews);

    expect(matched).toHaveLength(4);
    expect(matched[0]?.id).toBe("p1");
    expect(matched[1]?.id).toBe("p2");
    expect(matched[2]?.id).toBe("p3");          // manual recibe SU propio preview
    expect(matched[3]?.id).toBe("p4");          // ← antes era "p3" (bug del 990)
    expect(matched[3]?.lineTotalWithTax).toBe(99999);
  });

  it("manuales sin descripción NO consumen índice del preview", () => {
    type L = { id: string; articleId?: string | null; isManual?: boolean; manualDescription?: string; quantity?: number };
    // Manual sin descripción NO se envía al backend → preview no la incluye →
    // el matcheo NO debe avanzar el índice por ella, sino el siguiente artículo
    // leería un preview que no existe (o peor, el del manual previo).
    const draft: L[] = [
      { id: "L1", articleId: "art-1", quantity: 1 },
      { id: "L2", isManual: true, manualDescription: "", quantity: 1 },  // skip
      { id: "L3", articleId: "art-3", quantity: 1 },
    ];
    type P = { id: string };
    const previews: P[] = [{ id: "p1" }, { id: "p3" }];   // backend solo devuelve 2

    const matched = matchPreviewLines(draft, previews);

    expect(matched[0]?.id).toBe("p1");
    expect(matched[1]).toBeNull();              // manual sin descripción
    expect(matched[2]?.id).toBe("p3");          // sigue alineado
  });

  it("líneas con qty 0 / placeholders NO consumen índice", () => {
    type L = { id: string; articleId?: string | null; quantity?: number };
    const draft: L[] = [
      { id: "L1", articleId: "art-1", quantity: 1 },
      { id: "L2", articleId: "art-2", quantity: 0 },         // placeholder
      { id: "L3", quantity: 1 },                              // sin articleId ni manual
      { id: "L4", articleId: "art-4", quantity: 1 },
    ];
    type P = { id: string };
    const previews: P[] = [{ id: "p1" }, { id: "p4" }];

    const matched = matchPreviewLines(draft, previews);

    expect(matched[0]?.id).toBe("p1");
    expect(matched[1]).toBeNull();
    expect(matched[2]).toBeNull();
    expect(matched[3]?.id).toBe("p4");
  });

  it("preview vacío o null devuelve null para todas (no rompe)", () => {
    type L = { articleId: string; quantity: number };
    const draft: L[] = [
      { articleId: "a", quantity: 1 },
      { articleId: "b", quantity: 1 },
    ];

    expect(matchPreviewLines(draft, null)).toEqual([null, null]);
    expect(matchPreviewLines(draft, undefined)).toEqual([null, null]);
    expect(matchPreviewLines(draft, [])).toEqual([null, null]);
  });

  it("preserva el largo del draft (un slot por línea de draft)", () => {
    type L = { id: string; articleId?: string | null; isManual?: boolean; manualDescription?: string; quantity?: number };
    const draft: L[] = [
      { id: "1", articleId: "a", quantity: 1 },
      { id: "2", isManual: true, manualDescription: "x", quantity: 2 },
      { id: "3", quantity: 1 },
      { id: "4", articleId: "b", quantity: 0 },
      { id: "5", articleId: "c", quantity: 5 },
    ];
    const previews = [{ id: "pa" }, { id: "px" }, { id: "pc" }];

    const matched = matchPreviewLines(draft, previews);

    expect(matched).toHaveLength(draft.length);
  });
});
