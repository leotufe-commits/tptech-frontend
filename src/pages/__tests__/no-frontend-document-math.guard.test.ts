// src/pages/__tests__/no-frontend-document-math.guard.test.ts
// =============================================================================
// Guard estático ETAPA D1 — prohibir cálculo de totales de documento en frontend.
//
// CONTEXTO
// --------
// El motor de pricing del backend (`pricing-engine`) es la ÚNICA fuente de
// verdad para precios, descuentos, impuestos, redondeos y totales (POLICY R6).
// El frontend NO calcula esos valores: los recibe del preview backend vía el
// patrón `usePreviewFlow` + `buildSalePreviewPayload` + `applySalePreviewToDraft`
// (ver Factura como pantalla de referencia).
//
// EXCEPCIÓN POC TEMPORAL
// ----------------------
// 5 pantallas legacy son POCs sin endpoint backend preview todavía
// (`/quotes/preview`, `/sales-orders/preview`, `/credit-notes/preview`,
// `/purchases/preview`, etc. aún no existen). Eliminar el cálculo hoy
// dejaría la UI sin totales hasta que se implementen los endpoints, por
// eso se aceptan helpers locales SOLAMENTE en esos archivos. La deuda
// está documentada con TODO(D3-backend-preview) en sus cabeceras de
// "Helpers".
//
// QUÉ HACE ESTE GUARD
// -------------------
// Recorre `src/` y falla si los identificadores `calcLineSubtotal`,
// `calcLineTotal`, `computeGlobalDiscount` o `recomputeTotals` aparecen
// FUERA de la whitelist. Esto impide que la deuda se replique a una
// pantalla nueva por copy-paste accidental.
//
// CUÁNDO REMOVER ESTE GUARD
// -------------------------
// Cuando las 5 pantallas migren al patrón Factura (etapas D4 / D5 / D6
// del plan), los helpers desaparecen y este guard puede eliminarse junto
// con ellos. Cada vez que una pantalla se migre, su entry sale de la
// whitelist; cuando la whitelist quede vacía, el guard se borra.
// =============================================================================

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(process.cwd(), "src");

/**
 * Archivos donde está PERMITIDO definir/usar los helpers de cálculo. Cualquier
 * otro hit en `src/` (excluyendo tests) hace fallar el guard.
 *
 * Path relativo a `src/`, separadores POSIX.
 *
 * REGLA DE BAJA: cuando una pantalla migre al patrón Factura (preview
 * backend), sale de esta lista junto con la eliminación de sus helpers.
 */
const ALLOWED_FILES = [
  "pages/VentasPresupuestos.tsx",
  "pages/VentasOrdenes.tsx",
  "pages/VentasNotasCredito.tsx",
  "pages/ComprasFacturasProveedor.tsx",
  "pages/ComprasNotasCreditoProveedor.tsx",
] as const;

/** Identificadores prohibidos fuera de la whitelist. */
const FORBIDDEN_IDENTIFIERS = [
  "calcLineSubtotal",
  "calcLineTotal",
  "computeGlobalDiscount",
  "recomputeTotals",
] as const;

/** Recorre recursivamente `dir` y devuelve archivos .ts/.tsx — excluye
 *  directorios de tests, node_modules y los propios __tests__ (donde este
 *  guard lista los identificadores como literales). */
function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, acc);
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

/** Convierte un path absoluto a su forma POSIX relativa a `src/`. */
function relSrc(full: string): string {
  return relative(ROOT, full).split(sep).join("/");
}

/**
 * Elimina comentarios (single-line `//…` y block `/* … *​/`) y contenido de
 * literales string del código fuente para que el guard mire solo código
 * "vivo". Esto evita que una mención documental al helper (ej. "el subtotal
 * sigue siendo calculado por el parent en `calcLineSubtotal`") cuente como
 * uso real.
 *
 * No es un parser completo de JS — usa regex pragmáticos suficientes para
 * descartar comentarios y strings en TS/TSX bien formado del proyecto.
 */
function stripCommentsAndStrings(src: string): string {
  return src
    // Block comments /* ... */
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    // Line comments // ... (hasta fin de línea)
    .replace(/\/\/[^\n]*/g, " ")
    // String literals "..." y '...' con escapes
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    // Template literals `...` (simplificado: no maneja interpolación
    // anidada, suficiente para nuestro caso)
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

describe("Guard ETAPA D1 — sin cálculo de totales de documento en frontend", () => {
  const ALL_FILES = walk(ROOT);
  const ALLOWED_SET = new Set<string>(ALLOWED_FILES);

  it("se encontraron archivos para auditar", () => {
    expect(ALL_FILES.length).toBeGreaterThan(50);
  });

  it("la whitelist contiene exactamente los 5 archivos legacy permitidos", () => {
    expect(ALLOWED_FILES).toEqual([
      "pages/VentasPresupuestos.tsx",
      "pages/VentasOrdenes.tsx",
      "pages/VentasNotasCredito.tsx",
      "pages/ComprasFacturasProveedor.tsx",
      "pages/ComprasNotasCreditoProveedor.tsx",
    ]);
  });

  it("los archivos legacy permitidos existen", () => {
    for (const allowed of ALLOWED_FILES) {
      const abs = join(ROOT, allowed);
      expect(
        ALL_FILES.includes(abs),
        `Archivo legacy ${allowed} no encontrado — actualizar la whitelist si fue eliminado o migrado.`,
      ).toBe(true);
    }
  });

  for (const id of FORBIDDEN_IDENTIFIERS) {
    it(`${id} solo aparece (como código) en archivos permitidos (POC legacy)`, () => {
      const pattern = new RegExp(`\\b${id}\\b`);
      const offenders: string[] = [];
      for (const file of ALL_FILES) {
        const rel = relSrc(file);
        if (ALLOWED_SET.has(rel)) continue;
        const src = readFileSync(file, "utf8");
        const codeOnly = stripCommentsAndStrings(src);
        if (pattern.test(codeOnly)) {
          offenders.push(rel);
        }
      }
      expect(
        offenders,
        offenders.length > 0
          ? `\n  ❌ '${id}' apareció fuera de la whitelist en:\n     - ${offenders.join("\n     - ")}\n\n  Estos helpers calculan totales en frontend (viola POLICY R6).\n  Si una pantalla necesita totales, debe consumir el preview backend\n  vía 'usePreviewFlow' + 'buildSalePreviewPayload' + 'applySalePreviewToDraft'\n  (mismo patrón que Factura).`
          : "",
      ).toEqual([]);
    });
  }

  it("cada archivo legacy contiene al menos uno de los identificadores prohibidos (sanity check)", () => {
    // No todos los archivos legacy usan los 4 identificadores: NC Venta no
    // tiene calcLineSubtotal, Presupuestos/Órdenes no tienen calcLineTotal.
    // El sanity check verifica que la pantalla SIGUE necesitando la
    // excepción (al menos un helper presente). Si una pantalla pierde
    // TODOS los identificadores, la migración a backend preview se hizo y
    // su entry debe salir de la whitelist (y este test la atrapa).
    for (const allowed of ALLOWED_FILES) {
      const src = readFileSync(join(ROOT, allowed), "utf8");
      const codeOnly = stripCommentsAndStrings(src);
      const present = FORBIDDEN_IDENTIFIERS.filter((id) =>
        new RegExp(`\\b${id}\\b`).test(codeOnly),
      );
      expect(
        present.length,
        `${allowed} ya no contiene ninguno de los identificadores prohibidos\n` +
          `(considerando solo código, no comentarios).\n` +
          `Si la pantalla fue migrada al patrón Factura, sacarla de la whitelist\n` +
          `'ALLOWED_FILES' de este guard. Cuando la lista quede vacía, eliminar\n` +
          `el guard completo.`,
      ).toBeGreaterThan(0);
    }
  });
});
