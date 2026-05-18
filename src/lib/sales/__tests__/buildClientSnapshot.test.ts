// src/lib/sales/__tests__/buildClientSnapshot.test.ts
// ============================================================================
// Tests del helper extraído en FASE 5.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildClientSnapshot } from "../buildClientSnapshot";
import type { TPEntityLite } from "../../../components/ui/TPEntitySearchSelect";
import type { EntityDetail } from "../../../services/commercial-entities";

function makeLite(o: Partial<TPEntityLite> = {}): TPEntityLite {
  return {
    id:           "e1",
    name:         "Juan Perez",
    entityType:   "PERSON",
    firstName:    "Juan",
    lastName:     "Perez",
    ...o,
  } as TPEntityLite;
}

describe("buildClientSnapshot", () => {
  it("usa lite cuando no hay detail", () => {
    const snap = buildClientSnapshot(makeLite());
    expect(snap.name).toBe("Juan Perez");
    expect(snap.firstName).toBe("Juan");
    expect(snap.entityType).toBe("PERSON");
  });

  it("prefiere detail.displayName sobre lite.name cuando existe", () => {
    const detail = { displayName: "Juan P." } as EntityDetail;
    const snap = buildClientSnapshot(makeLite(), detail);
    expect(snap.displayName).toBe("Juan P.");
  });

  it("compone displayName desde companyName/tradeName para COMPANY", () => {
    const detail = {
      entityType: "COMPANY", tradeName: "ACME SRL", companyName: "Acme Corp",
    } as EntityDetail;
    const snap = buildClientSnapshot(makeLite({ entityType: "COMPANY" }), detail);
    expect(snap.displayName).toBe("ACME SRL");
  });

  it("compone displayName desde firstName+lastName para PERSON sin displayName", () => {
    const detail = {
      entityType: "PERSON", firstName: "Maria", lastName: "Lopez",
    } as EntityDetail;
    const snap = buildClientSnapshot(makeLite(), detail);
    expect(snap.displayName).toBe("Maria Lopez");
  });

  it("mapea detail fields prioritarios sobre lite", () => {
    const detail = {
      entityType:     "PERSON",
      documentType:   "DNI",
      documentNumber: "12345678",
      email:          "j@p.com",
      ivaCondition:   "RI",
    } as EntityDetail;
    const snap = buildClientSnapshot(makeLite(), detail);
    expect(snap.documentType).toBe("DNI");
    expect(snap.documentNumber).toBe("12345678");
    expect(snap.email).toBe("j@p.com");
    expect(snap.taxCondition).toBe("RI");
  });
});
