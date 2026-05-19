// src/lib/sales/__tests__/resolveClientInheritedDiscount.test.ts
import { describe, it, expect } from "vitest";
import {
  resolveClientInheritedDiscount,
  CLIENT_INHERITED_DISCOUNT_REASON,
} from "../resolveClientInheritedDiscount";

describe("resolveClientInheritedDiscount", () => {
  it("DISCOUNT + TOTAL + PERCENTAGE → PERCENT con origin CLIENT", () => {
    const r = resolveClientInheritedDiscount({
      commercialRuleType: "DISCOUNT",
      commercialValueType: "PERCENTAGE",
      commercialValue: "10",
      commercialApplyOn: "TOTAL",
    });
    expect(r).toEqual({
      type: "PERCENT",
      value: 10,
      reason: CLIENT_INHERITED_DISCOUNT_REASON,
      origin: "CLIENT",
    });
  });

  it("DISCOUNT + TOTAL + FIXED_AMOUNT → AMOUNT con origin CLIENT", () => {
    const r = resolveClientInheritedDiscount({
      commercialRuleType: "DISCOUNT",
      commercialValueType: "FIXED_AMOUNT",
      commercialValue: 1500,
      commercialApplyOn: "TOTAL",
    });
    expect(r).toEqual({
      type: "AMOUNT",
      value: 1500,
      reason: CLIENT_INHERITED_DISCOUNT_REASON,
      origin: "CLIENT",
    });
  });

  it("applyOn=METAL → null (no representable en Fase A)", () => {
    expect(
      resolveClientInheritedDiscount({
        commercialRuleType: "DISCOUNT",
        commercialValueType: "PERCENTAGE",
        commercialValue: "10",
        commercialApplyOn: "METAL",
      })
    ).toBeNull();
  });

  it("ruleType=SURCHARGE → null", () => {
    expect(
      resolveClientInheritedDiscount({
        commercialRuleType: "SURCHARGE",
        commercialValueType: "PERCENTAGE",
        commercialValue: "10",
        commercialApplyOn: "TOTAL",
      })
    ).toBeNull();
  });

  it("ruleType=BONUS → null", () => {
    expect(
      resolveClientInheritedDiscount({
        commercialRuleType: "BONUS",
        commercialValueType: "FIXED_AMOUNT",
        commercialValue: "500",
        commercialApplyOn: "TOTAL",
      })
    ).toBeNull();
  });

  it("value 0 / negativo / no numérico → null", () => {
    const base = {
      commercialRuleType: "DISCOUNT",
      commercialValueType: "PERCENTAGE",
      commercialApplyOn: "TOTAL",
    } as const;
    expect(resolveClientInheritedDiscount({ ...base, commercialValue: "0" })).toBeNull();
    expect(resolveClientInheritedDiscount({ ...base, commercialValue: -5 })).toBeNull();
    expect(resolveClientInheritedDiscount({ ...base, commercialValue: "abc" })).toBeNull();
    expect(resolveClientInheritedDiscount({ ...base, commercialValue: null })).toBeNull();
  });

  it("cliente null / sin regla → null", () => {
    expect(resolveClientInheritedDiscount(null)).toBeNull();
    expect(resolveClientInheritedDiscount(undefined)).toBeNull();
    expect(
      resolveClientInheritedDiscount({
        commercialRuleType: null,
        commercialValueType: null,
        commercialValue: null,
        commercialApplyOn: null,
      })
    ).toBeNull();
  });
});
