// src/pages/article-detail/__tests__/comboAdjustmentMapping.test.ts
// ============================================================================
// FIX de mapeo del control "Ajuste del combo" en ArticleModal.
//
// Bug: el control "Ajuste del combo" escribía en `manualAdjustment*` (ajuste de
// COSTO) y el payload hardcodeaba `comboAdjustment* = NONE`. Resultado: el motor
// recibía comboAdjustmentKind=NONE → el precio del combo no aplicaba el ajuste.
//
// Fix (solo display/mapeo, sin tocar pricing-engine):
//   · COMBO  → el ajuste del editor persiste en `comboAdjustment*`; `manualAdjustment*` queda vacío.
//   · NORMAL → el ajuste persiste en `manualAdjustment*` (costo); `comboAdjustment* = NONE` (sin cambios).
//
// Caso de aceptación: combo con "Ajuste del combo" 10% (Bonificación %) ⇒
//   payload.comboAdjustmentKind = "DISCOUNT_PERCENT", comboAdjustmentValue = 10.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  editorToComboAdjustmentKind,
  comboAdjustmentKindToEditor,
  buildAdjustmentEditorState,
  buildAdjustmentPayload,
} from "../ArticleModal";

describe("editorToComboAdjustmentKind — editor → enum del combo", () => {
  it("Bonificación % → DISCOUNT_PERCENT (caso de aceptación)", () => {
    expect(editorToComboAdjustmentKind("BONUS", "PERCENTAGE")).toBe("DISCOUNT_PERCENT");
  });
  it("Bonificación monto fijo → DISCOUNT_FIXED", () => {
    expect(editorToComboAdjustmentKind("BONUS", "FIXED_AMOUNT")).toBe("DISCOUNT_FIXED");
  });
  it("Recargo % → SURCHARGE_PERCENT", () => {
    expect(editorToComboAdjustmentKind("SURCHARGE", "PERCENTAGE")).toBe("SURCHARGE_PERCENT");
  });
  it("Sin ajuste → NONE", () => {
    expect(editorToComboAdjustmentKind("", "")).toBe("NONE");
    expect(editorToComboAdjustmentKind("", "PERCENTAGE")).toBe("NONE");
  });
});

describe("comboAdjustmentKindToEditor — enum del combo → editor", () => {
  it("DISCOUNT_PERCENT → Bonificación %", () => {
    expect(comboAdjustmentKindToEditor("DISCOUNT_PERCENT")).toEqual({ kind: "BONUS", type: "PERCENTAGE" });
  });
  it("SURCHARGE_PERCENT → Recargo %", () => {
    expect(comboAdjustmentKindToEditor("SURCHARGE_PERCENT")).toEqual({ kind: "SURCHARGE", type: "PERCENTAGE" });
  });
  it("NONE/desconocido → sin ajuste", () => {
    expect(comboAdjustmentKindToEditor("NONE")).toEqual({ kind: "", type: "" });
    expect(comboAdjustmentKindToEditor(null)).toEqual({ kind: "", type: "" });
  });
});

describe("buildAdjustmentPayload — guardado", () => {
  it("COMBO: el ajuste persiste en comboAdjustment*, manualAdjustment* queda vacío", () => {
    const out = buildAdjustmentPayload({
      commercialMode: "COMBO_COMMERCIAL",
      manualAdjustmentKind: "BONUS", manualAdjustmentType: "PERCENTAGE", manualAdjustmentValue: 10,
    } as any);
    expect(out.comboAdjustmentKind).toBe("DISCOUNT_PERCENT");
    expect(out.comboAdjustmentValue).toBe(10);
    expect(out.manualAdjustmentKind).toBe("");
    expect(out.manualAdjustmentType).toBe("");
    expect(out.manualAdjustmentValue).toBeNull();
  });

  it("NORMAL: el ajuste persiste en manualAdjustment*, comboAdjustment* = NONE (sin cambios)", () => {
    const out = buildAdjustmentPayload({
      commercialMode: "NORMAL",
      manualAdjustmentKind: "BONUS", manualAdjustmentType: "PERCENTAGE", manualAdjustmentValue: 10,
    } as any);
    expect(out.comboAdjustmentKind).toBe("NONE");
    expect(out.comboAdjustmentValue).toBeNull();
    expect(out.manualAdjustmentKind).toBe("BONUS");
    expect(out.manualAdjustmentType).toBe("PERCENTAGE");
    expect(out.manualAdjustmentValue).toBe(10);
  });

  it("COMBO sin ajuste → comboAdjustmentKind NONE, value null", () => {
    const out = buildAdjustmentPayload({
      commercialMode: "COMBO_COMMERCIAL",
      manualAdjustmentKind: "", manualAdjustmentType: "", manualAdjustmentValue: null,
    } as any);
    expect(out.comboAdjustmentKind).toBe("NONE");
    expect(out.comboAdjustmentValue).toBeNull();
  });
});

describe("buildAdjustmentEditorState — carga (display)", () => {
  it("COMBO con comboAdjustment* → el editor lo muestra", () => {
    const out = buildAdjustmentEditorState({
      commercialMode: "COMBO_COMMERCIAL",
      comboAdjustmentKind: "DISCOUNT_PERCENT", comboAdjustmentValue: "10",
      manualAdjustmentKind: "", manualAdjustmentType: "", manualAdjustmentValue: null,
    });
    expect(out).toEqual({ manualAdjustmentKind: "BONUS", manualAdjustmentType: "PERCENTAGE", manualAdjustmentValue: 10 });
  });

  it("COMBO legacy (comboAdjustment NONE, manualAdjustment 10) → muestra el legacy (no se oculta)", () => {
    const out = buildAdjustmentEditorState({
      commercialMode: "COMBO_COMMERCIAL",
      comboAdjustmentKind: "NONE", comboAdjustmentValue: null,
      manualAdjustmentKind: "BONUS", manualAdjustmentType: "PERCENTAGE", manualAdjustmentValue: "10",
    });
    expect(out).toEqual({ manualAdjustmentKind: "BONUS", manualAdjustmentType: "PERCENTAGE", manualAdjustmentValue: 10 });
  });

  it("NORMAL: muestra el manualAdjustment* de costo tal cual", () => {
    const out = buildAdjustmentEditorState({
      commercialMode: "NORMAL",
      manualAdjustmentKind: "SURCHARGE", manualAdjustmentType: "FIXED_AMOUNT", manualAdjustmentValue: "500",
    });
    expect(out).toEqual({ manualAdjustmentKind: "SURCHARGE", manualAdjustmentType: "FIXED_AMOUNT", manualAdjustmentValue: 500 });
  });
});

describe("Round-trip editor ↔ combo (casos representables)", () => {
  it("Bonificación % ↔ DISCOUNT_PERCENT", () => {
    const k = editorToComboAdjustmentKind("BONUS", "PERCENTAGE");
    expect(comboAdjustmentKindToEditor(k)).toEqual({ kind: "BONUS", type: "PERCENTAGE" });
  });
});
