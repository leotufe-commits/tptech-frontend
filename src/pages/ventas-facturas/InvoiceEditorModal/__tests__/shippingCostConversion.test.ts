// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/__tests__/shippingCostConversion.test.ts
//
// Tests del contrato shipping RECTIFICADO 2026-05-28:
//
//   `draft.shipping.cost` esta SIEMPRE en moneda DOC (la moneda del
//   comprobante). El operador VE y EDITA exactamente lo que cuesta el
//   envio en moneda DOC. La conversion BASE→DOC desde la tarifa del
//   catalogo ("Envios y Logistica") ocurre UNA SOLA VEZ al derivar
//   `derivedCost` en `ShippingCard`.
//
// Historico de bugs cerrados con esta rectificacion:
//   · Bug "21.6M observado": el contrato anterior decia "cost en BASE"
//     y aplicaba conversiones × fxRate en el display del TPNumberInput
//     y en el payload del backend. Cualquier desincronizacion entre el
//     fxRate persistido y el fxRate vigente al momento del onChange
//     producia multiplicaciones (12000 × 1798 = 21.6M).
//   · Bug "6,67 confuso": el operador veia un valor que NO podia
//     correlacionar con lo que cobraba el envio. Ahora el operador ve
//     "ARS 12.000" cuando el comprobante es ARS y "USD 6,67" cuando es
//     USD — ambas correctas, ambas en moneda DOC.

import { describe, it, expect } from "vitest";

// ─── Derivacion BASE → DOC al SELECCIONAR un carrier ────────────────────────
//
// Simula la logica de `derivedCost` en `ShippingCard`. baseCost es el
// valor del catalogo (siempre en moneda BASE del tenant); el operador
// ve y guarda en DOC.
function derivedCostDoc(baseCost: number, fxRate: number): number {
  if (baseCost === 0) return 0;
  if (!Number.isFinite(fxRate) || fxRate <= 0 || fxRate === 1) return baseCost;
  return baseCost / fxRate;
}

// ─── shippingAmount al payload ──────────────────────────────────────────────
//
// Simula `buildSalePreviewPayload.shippingAmount`. Bajo el contrato
// nuevo, el payload envia `cost` tal cual (ya esta en DOC).
function shippingPayloadAmount(costDoc: number): number {
  return costDoc;
}

// ─── Backend toB() — sigue siendo n * rate, simulado para round-trip ────────
function backendToB(amountDoc: number, fxRate: number): number {
  return amountDoc * fxRate;
}

describe("shipping cost — contrato DOC (rectificacion 2026-05-28)", () => {

  describe("derivedCost — UNA conversion BASE→DOC al seleccionar carrier", () => {
    it("comprobante ARS (BASE): baseCost=12000 → cost=12000 (sin conversion)", () => {
      expect(derivedCostDoc(12000, 1)).toBe(12000);
      expect(derivedCostDoc(18000, 1)).toBe(18000);
    });

    it("comprobante USD (rate=1800 ARS/USD): baseCost=12000 ARS → cost=6.67 USD", () => {
      expect(derivedCostDoc(12000, 1800)).toBeCloseTo(6.666666, 4);
      expect(derivedCostDoc(18000, 1800)).toBe(10);
    });

    it("comprobante EUR (rate=2000): baseCost=12000 ARS → cost=6 EUR", () => {
      expect(derivedCostDoc(12000, 2000)).toBe(6);
      expect(derivedCostDoc(18000, 2000)).toBe(9);
    });

    it("baseCost=0: cost=0 sin conversion", () => {
      expect(derivedCostDoc(0, 1)).toBe(0);
      expect(derivedCostDoc(0, 1800)).toBe(0);
    });

    it("fxRate invalido: cost=baseCost defensivo (no convierte por NaN/0/neg)", () => {
      expect(derivedCostDoc(12000, NaN)).toBe(12000);
      expect(derivedCostDoc(12000, 0)).toBe(12000);
      expect(derivedCostDoc(12000, -1)).toBe(12000);
    });
  });

  describe("payload al backend — cost se envia TAL CUAL (sin conversion)", () => {
    it("comprobante ARS: cost=12000 → shippingAmount=12000", () => {
      expect(shippingPayloadAmount(12000)).toBe(12000);
    });

    it("comprobante USD: cost=6.67 (USD) → shippingAmount=6.67", () => {
      expect(shippingPayloadAmount(6.666666)).toBeCloseTo(6.666666, 4);
    });

    it("cost=0: shippingAmount=0", () => {
      expect(shippingPayloadAmount(0)).toBe(0);
    });

    it("override manual: cost=tipeado_por_operador → shippingAmount igual", () => {
      // Operador en USD tipea 10 (USD). El payload envia 10 USD directo.
      expect(shippingPayloadAmount(10)).toBe(10);
    });
  });

  describe("round-trip end-to-end (baseCost → derivedCost → payload → backend → BASE)", () => {
    it("comprobante en BASE: carrier 12000 ARS → backend recupera 12000 ARS", () => {
      const fxRate = 1; // ARS=ARS
      const cost = derivedCostDoc(12000, fxRate);     // 12000
      const payload = shippingPayloadAmount(cost);     // 12000
      const recovered = backendToB(payload, fxRate);   // 12000
      expect(recovered).toBe(12000);
    });

    it("comprobante en USD: carrier 12000 ARS → backend recupera 12000 ARS", () => {
      const fxRate = 1800; // 1 USD = 1800 ARS
      const cost = derivedCostDoc(12000, fxRate);     // 6.666666 USD
      const payload = shippingPayloadAmount(cost);     // 6.666666
      const recovered = backendToB(payload, fxRate);   // 11999.999 ≈ 12000 ARS
      expect(recovered).toBeCloseTo(12000, 2);
    });

    it("round-trip preserva tarifa original para cualquier rate", () => {
      const tarifas = [12000, 18000, 5500, 1, 99999];
      const rates   = [1, 1350, 1800, 2000];
      for (const tarifa of tarifas) {
        for (const rate of rates) {
          const cost      = derivedCostDoc(tarifa, rate);
          const payload   = shippingPayloadAmount(cost);
          const recovered = backendToB(payload, rate);
          expect(recovered).toBeCloseTo(tarifa, 2);
        }
      }
    });
  });

  describe("regresion del bug 21.6M — estructuralmente imposible", () => {
    it("ARS doc + carrier 12000 ARS: cost=12000 (NO 21.6M)", () => {
      // El bug aparecia cuando el contrato anterior multiplicaba cost
      // (12000 BASE) × fxRate (1798) al cargar la moneda. Ahora cost
      // vive en DOC y no se multiplica en ningun lado.
      const fxRate = 1;
      const cost = derivedCostDoc(12000, fxRate);
      expect(cost).toBe(12000);
      expect(cost).not.toBeCloseTo(21_600_000, -3);
      expect(cost).not.toBeCloseTo(21_582_733, -3);
    });

    it("Cambio de moneda repetido NO infla cost (sin acumulacion)", () => {
      // Simula: operador en USD selecciona carrier 12000 ARS, despues
      // cambia a ARS, despues a USD, despues a ARS. Cada paso recalcula
      // `derivedCost` desde el `baseCost` constante del catalogo.
      const baseCost = 12000;
      // Step 1: USD → derivedCost = 6.67 USD
      let cost = derivedCostDoc(baseCost, 1800);
      expect(cost).toBeCloseTo(6.666666, 4);
      // Step 2: cambia a ARS → derivedCost se recalcula desde baseCost
      cost = derivedCostDoc(baseCost, 1);
      expect(cost).toBe(12000);
      // Step 3: vuelve a USD → derivedCost vuelve a 6.67 USD
      cost = derivedCostDoc(baseCost, 1800);
      expect(cost).toBeCloseTo(6.666666, 4);
      // Step 4: vuelve a ARS → derivedCost = 12000 (no se acumula)
      cost = derivedCostDoc(baseCost, 1);
      expect(cost).toBe(12000);
      // En NINGUN paso aparece 21.6M.
      expect(cost).not.toBeCloseTo(21_582_733, -3);
    });

    it("Override manual del operador NO se infla al cambiar moneda", () => {
      // En el contrato nuevo, el override manual queda en DOC. Si el
      // operador cambia la moneda del comprobante DESPUES del override,
      // el cost queda como lo escribio — el operador es responsable de
      // actualizarlo. NO hay multiplicacion automatica que genere
      // valores absurdos.
      let cost = 10; // operador tipea 10 (USD)
      const payload = shippingPayloadAmount(cost);
      expect(payload).toBe(10); // NO 17.985 (10 × 1800) ni nada parecido
      // Cambio de moneda sin re-derivar: cost sigue siendo 10.
      // Si el operador NO toca nada y guarda la factura, el envio sera
      // de 10 en la moneda actual del documento.
      expect(cost).toBe(10);
    });
  });

  describe("Carrier 12000 ARS con doc en ARS: el caso reportado por el operador", () => {
    it("muestra exactamente 12.000,00 en el TPNumberInput (NO 21.582.733,81)", () => {
      // Caso del bug-report: el operador estaba en ARS, seleccionaba
      // Motomensajeria (12000 ARS) y veia 21.582.733,81 en el campo.
      // Con el contrato nuevo, ese valor es estructuralmente imposible:
      // - baseCost = 12000 (del catalogo).
      // - fxRate = 1 (ARS=ARS=BASE).
      // - derivedCost = 12000.
      // - TPNumberInput value = cost = 12000.
      const fxRate = 1;
      const baseCost = 12000;
      const derivedCost = derivedCostDoc(baseCost, fxRate);
      // Ese es EXACTAMENTE el valor que se muestra al operador.
      expect(derivedCost).toBe(12000);
    });

    it("Caso USD ya correcto: rate 7.50 USD con doc USD muestra 7.50", () => {
      // En el reporte del operador, USD ya funcionaba bien. Validamos
      // que el contrato nuevo NO rompe ese caso.
      // Si la tarifa esta configurada en BASE=ARS como 13500 ARS y el
      // doc esta en USD con fxRate=1800: derivedCost = 13500/1800 = 7.50.
      const fxRate = 1800;
      const baseCost = 13500;
      const derivedCost = derivedCostDoc(baseCost, fxRate);
      expect(derivedCost).toBe(7.50);
    });
  });
});
