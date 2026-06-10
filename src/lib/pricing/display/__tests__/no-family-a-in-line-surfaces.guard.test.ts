// src/lib/pricing/display/__tests__/no-family-a-in-line-surfaces.guard.test.ts
// =============================================================================
// Guard estático — ETAPA 1 del Roadmap Maestro de Evolución TPTech.
//
// CONTRATO PROTEGIDO
// ------------------
// Ver `tptech-backend/src/lib/pricing-engine/CONTRATO-FUNCIONAL.md` y su
// companion `CONTRATO-FUNCIONAL-consumo.md`.
//
// La Familia C (`lineCommercialSummary` / `lineCommercialDisplaySummary`) es el
// contrato canónico de lectura per-línea. La Familia A es el reparto DOCUMENTAL
// del redondeo comercial: depende de las otras líneas (cambia al editar otra
// línea) → está PROHIBIDA en una superficie per-línea (Card / Resumen Comercial
// del Artículo). El Card ya la prohíbe por comentario; este guard lo convierte
// en garantía automática para que ningún desarrollo NUEVO la reintroduzca.
//
// QUÉ PROHÍBE (alcance angosto aprobado — Paso 3 Etapa 1)
// ------------------------------------------------------
// Lecturas-VALOR de los identificadores DOCUMENTALES de la Familia A:
//   · `metalRoundingMonetaryImpact`        (prorrateo documental del metal)
//   · `commercialRoundingContext.breakdown` (agregado documental del comprobante)
// en las superficies PER-LÍNEA / Card.
//
// QUÉ **NO** PROHÍBE (fallbacks legítimos hoy — NO tocar en Etapa 1)
// -----------------------------------------------------------------
//   · `hechuraRoundingMonetaryImpact`, `lineMonetarySaldoPostCommercialRounding`,
//     `lineTotalWithTaxPostCommercialRounding` → fallbacks legítimos del Card.
//   · Familia B (`lineOwn*`) → fallback legítimo del Card.
//   · Footer (`TotalDelComprobanteCard`) → usa A a nivel DOCUMENTO (reconciliación).
//   · Simulador, `applySalePreviewToDraft` (passthrough), definiciones de tipo.
//   · Comentarios y string-literals → removidos por el stripper (las propias
//     frases "❌ NUNCA metalRoundingMonetaryImpact" del Card NO cuentan).
//
// ALLOWLIST
// ---------
// VACÍA por diseño: al crear este guard se verificó que toda ocurrencia actual
// en las superficies vigiladas vive dentro de un comentario (stripeado abajo).
// Si en el futuro una superficie per-línea necesitara legítimamente leer A,
// se agrega su path acá con su justificación — NUNCA se relaja el stripper.
//
// CUÁNDO EVOLUCIONA / SE RETIRA
// -----------------------------
// La Etapa 2 unifica los consumos restantes hacia la Familia C; este guard
// puede endurecerse (más identificadores) o, cuando A deje de existir como
// campo expuesto (Etapa 4), eliminarse junto con ella.
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(process.cwd(), "src");

/** Superficies PER-LÍNEA / Card vigiladas (relativas a `src/`, separador POSIX).
 *  Pueden ser un archivo o un directorio (se recorre recursivo, sin tests). */
const WATCHED_SURFACES = [
  "components/ui/TPDocumentLineAdvancedEditor.tsx",
  "components/sales/SaleCompositionEditableGrid",
  "lib/pricing/display/saleCompositionDisplay.ts",
] as const;

/** Identificadores DOCUMENTALES de la Familia A prohibidos como lectura-valor.
 *  Case-sensitive a propósito: `metalRoundingMonetaryImpact` (Familia A) NO debe
 *  confundirse con `lineOwnMetalRoundingMonetaryImpact` (Familia B, capital M),
 *  que es fallback legítimo. */
const BANNED: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "metalRoundingMonetaryImpact", re: /\bmetalRoundingMonetaryImpact\b/ },
  { id: "commercialRoundingContext.breakdown", re: /commercialRoundingContext\s*\.\s*breakdown/ },
];

/** Paths (relativos a `src/`, POSIX) autorizados a contener un identificador
 *  prohibido como lectura-valor. VACÍA por diseño (ver cabecera). */
const ALLOWLIST: ReadonlyArray<string> = [];

/**
 * Elimina comentarios (`//`, `/* * /`, incl. `{/* * /}` de JSX) y el CONTENIDO
 * de los string-literals (`'`, `"`, `` ` ``), preservando saltos de línea. Es un
 * scanner char-a-char determinístico: suficientemente robusto para un guard
 * (no pretende ser un parser TS completo). Un identificador que sobreviva al
 * strip es, por definición, una lectura de código real.
 */
function stripCommentsAndStrings(src: string): string {
  let out = "";
  let mode: "code" | "line" | "block" | "sq" | "dq" | "tpl" = "code";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const c2 = i + 1 < src.length ? src[i + 1] : "";
    switch (mode) {
      case "code":
        if (c === "/" && c2 === "/") { mode = "line"; i++; }
        else if (c === "/" && c2 === "*") { mode = "block"; i++; }
        else if (c === "'") { mode = "sq"; }
        else if (c === '"') { mode = "dq"; }
        else if (c === "`") { mode = "tpl"; }
        else { out += c; }
        break;
      case "line":
        if (c === "\n") { mode = "code"; out += "\n"; }
        break;
      case "block":
        if (c === "*" && c2 === "/") { mode = "code"; i++; }
        else if (c === "\n") { out += "\n"; }
        break;
      case "sq":
        if (c === "\\") { i++; }
        else if (c === "'") { mode = "code"; }
        break;
      case "dq":
        if (c === "\\") { i++; }
        else if (c === '"') { mode = "code"; }
        break;
      case "tpl":
        if (c === "\\") { i++; }
        else if (c === "`") { mode = "code"; }
        else if (c === "\n") { out += "\n"; }
        break;
    }
  }
  return out;
}

/** Recorre un archivo o directorio y devuelve los `.ts/.tsx` (excluye tests). */
function collect(target: string, acc: string[] = []): string[] {
  if (!existsSync(target)) return acc;
  const st = statSync(target);
  if (st.isFile()) {
    if (/\.(ts|tsx)$/.test(target) && !target.includes(`${sep}__tests__${sep}`)) {
      acc.push(target);
    }
    return acc;
  }
  for (const entry of readdirSync(target)) {
    if (entry === "__tests__" || entry === "node_modules") continue;
    collect(join(target, entry), acc);
  }
  return acc;
}

describe("guard ETAPA 1 — Familia A documental NO se lee en superficies per-línea", () => {
  const files = WATCHED_SURFACES.flatMap((w) => collect(join(ROOT, ...w.split("/"))));

  it("vigila al menos las superficies per-línea declaradas", () => {
    // Si esto falla, las superficies se movieron/renombraron: actualizar
    // WATCHED_SURFACES (el guard quedó vigilando el vacío).
    expect(files.length).toBeGreaterThan(0);
  });

  it("no hay lecturas-valor de identificadores Familia A documental prohibidos", () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join("/");
      if (ALLOWLIST.includes(rel)) continue;
      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      for (const { id, re } of BANNED) {
        if (re.test(code)) violations.push(`${rel} → "${id}"`);
      }
    }
    expect(
      violations,
      `Familia A documental leída en superficie per-línea (usar Familia C):\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
