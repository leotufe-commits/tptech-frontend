// src/pages/configuracion-sistema/__tests__/ConfiguracionSistema.hub.test.tsx
// =============================================================================
// Guard del hub Configuración → "Documentos y comprobantes".
//
// Asegura que después de Fase A (drop de la tab "Vista previa"):
//   · NO existe shortcut `?tab=preview` en el card del hub.
//   · NO existe un link con label "Vista previa (PDF renderizado)".
//   · Si existen shortcuts a documentos-comprobantes, son ≤ 2
//     (plantillas + numeracion; NUNCA 3 incluyendo preview).
//
// El guard es ESTÁTICO sobre el source del archivo (`readFileSync`).
// Tolera que el hub esté en proceso de reorganización: SOLO veta la
// reintroducción accidental del shortcut. NO asume el formato exacto
// de los otros 2 shortcuts (Plantillas / Numeración) porque pueden
// variar entre versiones de la reorganización UX en curso.
//
// Cuando el operador commitee la reorganización completa del hub con
// los 2 shortcuts esperados, los matchers positivos se pueden añadir
// acá sin temor a falsos negativos.
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname  = dirname(fileURLToPath(import.meta.url));
const HUB_PATH   = resolve(__dirname, "../ConfiguracionSistema.tsx");
const HUB_SOURCE = readFileSync(HUB_PATH, "utf-8");

describe("Hub Configuración — guard anti-shortcut Vista previa (Fase A)", () => {
  it("NO contiene shortcut `?tab=preview`", () => {
    expect(HUB_SOURCE).not.toMatch(/documentos-comprobantes\?tab=preview/);
  });

  it("NO contiene un link con label `Vista previa (PDF renderizado)`", () => {
    expect(HUB_SOURCE).not.toMatch(/Vista previa\s*\(PDF\s+renderizado\)/i);
  });

  it("si hay shortcuts a documentos-comprobantes, son ≤ 2 (sin preview)", () => {
    const matches = HUB_SOURCE.match(/documentos-comprobantes\?tab=/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(2);
  });
});
