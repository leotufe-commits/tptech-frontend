// src/pages/entity-detail/balance-movements-helpers.ts
// =============================================================================
// T62 (Fase 4.4) — Helpers puros para la vista canónica de cuenta corriente.
//
// Extraídos del componente para que sean testeables aislados y reutilizables
// por el modal "Ver origen" y los exports (print/PDF).
//
// READ-ONLY: estas funciones NO calculan precios ni convierten monedas.
//   · `aggregateMovements`: agrega gramos por metal padre + monetario por
//     currencyCode. CREDIT resta, DEBIT suma.
//   · `filterMovements`: aplica los filtros UX (tipo, documento, modo,
//     moneda, metal) sobre la lista cargada del backend.
//   · `sourceDocumentLabel` / `sourceTypeLabel`: labels legibles para UI.
// =============================================================================

import type { BalanceMovementDTO } from "../../services/commercial-entities";

// ─────────────────────────────────────────────────────────────────────────────
// Agregado de movimientos (resumen superior)
// ─────────────────────────────────────────────────────────────────────────────

export interface AggregatedMetal {
  metalParentId:      string | null;
  metalParentName:    string;
  totalGramsPure:     number;
  totalGramsOriginal: number;
}

export interface AggregatedMonetary {
  currencyCode: string;
  amount:       number;
}

export interface MovementsAggregate {
  metals:   AggregatedMetal[];
  monetary: AggregatedMonetary[];
}

/** Computa el resumen superior. CREDIT resta, DEBIT suma. */
export function aggregateMovements(
  movements: BalanceMovementDTO[],
): MovementsAggregate {
  const metalsMap = new Map<string, AggregatedMetal>();
  const moneyMap  = new Map<string, AggregatedMonetary>();

  for (const m of movements) {
    const sign = m.kind === "CREDIT" ? -1 : 1;
    for (const e of m.metalEntries) {
      const key = e.metalParentId ?? `__name__::${e.metalParentName}`;
      const existing = metalsMap.get(key);
      if (existing) {
        existing.totalGramsPure     += sign * e.gramsPure;
        existing.totalGramsOriginal += sign * e.gramsOriginal;
      } else {
        metalsMap.set(key, {
          metalParentId:      e.metalParentId,
          metalParentName:    e.metalParentName,
          totalGramsPure:     sign * e.gramsPure,
          totalGramsOriginal: sign * e.gramsOriginal,
        });
      }
    }
    const code = m.currencyCode || "BASE";
    const existingM = moneyMap.get(code);
    const delta = sign * m.amountOriginal;
    if (existingM) existingM.amount += delta;
    else moneyMap.set(code, { currencyCode: code, amount: delta });
  }

  return {
    metals: Array.from(metalsMap.values())
      .filter((m) => Math.abs(m.totalGramsPure) > 1e-9)
      .sort((a, b) => a.metalParentName.localeCompare(b.metalParentName, "es")),
    monetary: Array.from(moneyMap.values())
      .filter((m) => Math.abs(m.amount) > 0.005)
      .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode, "es")),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros UX
// ─────────────────────────────────────────────────────────────────────────────

export interface MovementsFilter {
  /** "ALL" | "DEBIT" | "CREDIT". */
  kind?: "ALL" | "DEBIT" | "CREDIT";
  /** "ALL" o un sourceDocumentType ("SALE" / "PURCHASE" / etc.). */
  documentType?: string;
  /** "ALL" | "UNIFIED" | "BREAKDOWN". */
  balanceMode?: "ALL" | "UNIFIED" | "BREAKDOWN";
  /** "ALL" o un currencyCode ("ARS" / "USD" / etc.). */
  currencyCode?: string;
  /** "ALL" o un metalParentId (o name fallback). */
  metalParentId?: string;
}

/** Aplica los filtros UX sobre la lista cargada. Devuelve una nueva lista. */
export function filterMovements(
  movements: BalanceMovementDTO[],
  filter: MovementsFilter,
): BalanceMovementDTO[] {
  return movements.filter((m) => {
    if (filter.kind && filter.kind !== "ALL" && m.kind !== filter.kind) return false;
    if (
      filter.documentType &&
      filter.documentType !== "ALL" &&
      (m.sourceDocumentType ?? "") !== filter.documentType
    ) {
      return false;
    }
    if (
      filter.balanceMode &&
      filter.balanceMode !== "ALL" &&
      m.balanceMode !== filter.balanceMode
    ) {
      return false;
    }
    if (
      filter.currencyCode &&
      filter.currencyCode !== "ALL" &&
      (m.currencyCode || "BASE") !== filter.currencyCode
    ) {
      return false;
    }
    if (filter.metalParentId && filter.metalParentId !== "ALL") {
      const has = m.metalEntries.some(
        (e) =>
          (e.metalParentId ?? `__name__::${e.metalParentName}`) ===
          filter.metalParentId,
      );
      if (!has) return false;
    }
    return true;
  });
}

/** Opciones únicas para los selects de filtro (derivadas de los movimientos
 *  cargados). Si el backend trae sólo ARS y USD, el select de moneda solo
 *  muestra esas dos opciones — no inventamos. */
export interface FilterOptions {
  documentTypes: { value: string; label: string }[];
  currencies:    { value: string; label: string }[];
  metals:        { value: string; label: string }[];
}

export function buildFilterOptions(movements: BalanceMovementDTO[]): FilterOptions {
  const docs = new Map<string, string>();
  const currs = new Set<string>();
  const metals = new Map<string, string>();
  for (const m of movements) {
    if (m.sourceDocumentType) {
      docs.set(m.sourceDocumentType, sourceDocumentLabel(m.sourceDocumentType));
    }
    if (m.currencyCode) currs.add(m.currencyCode);
    for (const e of m.metalEntries) {
      const key = e.metalParentId ?? `__name__::${e.metalParentName}`;
      metals.set(key, e.metalParentName);
    }
  }
  return {
    documentTypes: [
      { value: "ALL", label: "Todos los tipos" },
      ...Array.from(docs.entries())
        .sort((a, b) => a[1].localeCompare(b[1], "es"))
        .map(([value, label]) => ({ value, label })),
    ],
    currencies: [
      { value: "ALL", label: "Todas las monedas" },
      ...Array.from(currs).sort().map((c) => ({ value: c, label: c })),
    ],
    metals: [
      { value: "ALL", label: "Todos los metales" },
      ...Array.from(metals.entries())
        .sort((a, b) => a[1].localeCompare(b[1], "es"))
        .map(([value, label]) => ({ value, label })),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Labels legibles
// ─────────────────────────────────────────────────────────────────────────────

export function sourceDocumentLabel(kind: string | null | undefined): string {
  if (!kind) return "Origen";
  const map: Record<string, string> = {
    SALE:             "Factura",
    PURCHASE:         "Compra",
    RECEIPT:          "Recibo",
    ADJUSTMENT:       "Ajuste",
    CROSS_SETTLEMENT: "Liquidación cruzada",
  };
  return map[kind] ?? kind;
}

export function sourceTypeLabel(source: string): string {
  const map: Record<string, string> = {
    RECEIPT:            "Recibo",
    PAYMENT_ALLOCATION: "Asignación de pago",
    ADJUSTMENT:         "Ajuste",
    CROSS_SETTLEMENT:   "Liquidación cruzada",
  };
  return map[source] ?? source;
}

export function kindLabel(kind: BalanceMovementDTO["kind"]): string {
  if (kind === "CREDIT") return "Crédito";
  if (kind === "DEBIT")  return "Débito";
  return kind;
}

export function balanceModeLabel(mode: BalanceMovementDTO["balanceMode"]): string {
  return mode === "BREAKDOWN" ? "Desglosado" : "Unificado";
}

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
