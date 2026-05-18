// src/components/sales/__tests__/factura-format.guard.test.ts
// Guard estático — Factura de Ventas (línea + composición + totales) no debe
// reintroducir formateo numérico inline. Todo el display pasa por el motor
// central (lib/pricing/format → number-format). Fechas y CSS/keys marcados
// con `number-format:ignore` están permitidos.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");

const TARGET_FILES = [
  "components/ui/TPDocumentLineAdvancedEditor.tsx",
  "components/sales/SaleCompositionEditableGrid.tsx",
  "components/sales/SalePricingPanel.tsx",
  "components/sales/SaleLineCompositionPre.tsx",
  "components/sales/SaleLineCompositionDetail.tsx",
  "components/sales/PriceFlowCards.tsx",
  "components/ui/TPDocumentTotalsHero.tsx",
  "lib/pricing/display/saleCompositionDisplay.ts",
  "pages/ventas-facturas/InvoiceEditorModal/DiscountCard.tsx",
  "pages/ventas-facturas/InvoiceEditorModal/ShippingCard.tsx",
  "pages/ventas-facturas/InvoiceEditorModal/PaymentCard.tsx",
];

const FILES = TARGET_FILES.map((p) => join(ROOT, p)).filter(existsSync);

function linesWith(file: string, pred: (l: string) => boolean): string[] {
  const ls = readFileSync(file, "utf8").split("\n");
  const out: string[] = [];
  ls.forEach((l, i) => { if (pred(l)) out.push(`${file}:${i + 1}`); });
  return out;
}

describe("Factura — sin formateo numérico inline", () => {
  it("se encontraron los archivos objetivo", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(6);
  });
  it("ningún toLocaleString numérico (con opciones de fracción)", () => {
    const off = FILES.flatMap((f) =>
      linesWith(f, (l) => /\.toLocaleString\([^)]*Fraction/.test(l) && !l.includes("number-format:ignore")));
    expect(off, off.join("\n")).toEqual([]);
  });
  it("ningún Intl.NumberFormat", () => {
    const off = FILES.flatMap((f) =>
      linesWith(f, (l) => l.includes("Intl.NumberFormat") && !l.includes("number-format:ignore")));
    expect(off, off.join("\n")).toEqual([]);
  });
  it("ningún .toFixed( de display (salvo marcado number-format:ignore)", () => {
    const off = FILES.flatMap((f) =>
      linesWith(f, (l) => l.includes(".toFixed(") && !l.includes("number-format:ignore")));
    expect(off, off.join("\n")).toEqual([]);
  });
  it("no importan fmtMoney/fmtQty es-AR de document-helpers (deben usar el central)", () => {
    const off = FILES.flatMap((f) => {
      const src = readFileSync(f, "utf8");
      return /from ["'].*document-helpers["']/.test(src) &&
             /\bfmt(Money|Qty)\b/.test(src.split("\n").find((l) => l.includes("document-helpers")) ?? "")
        ? [f] : [];
    });
    expect(off, off.join("\n")).toEqual([]);
  });
});
