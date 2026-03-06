// src/lib/format.ts

function toFiniteNumber(n: any): number | null {
  // soporta "15.000,25" y "15000.25"
  if (typeof n === "string") {
    const s = n.trim();
    if (!s) return null;
    const normalized = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const v = Number(normalized);
    return Number.isFinite(v) ? v : null;
  }

  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

export function fmtNumber2(n: any): string {
  const v = toFiniteNumber(n);
  if (v === null) return "—";
  return v.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** ✅ Alias explícito para “1,00” (2 decimales fijos) */
export function fmtFixed2(n: any): string {
  return fmtNumber2(n);
}

export function fmtMoney2(symbol: string, n: any): string {
  const v = toFiniteNumber(n);
  if (v === null) return "—";
  const s = String(symbol || "").trim();
  const num = v.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return s ? `${s} ${num}` : num;
}

// ✅ Tipo de cambio inteligente:
// - si >= 1 → 0,00
// - si < 1 → mostrar decimales reales (sin rellenar), hasta 10 decimales
export function fmtRateSmart(n: any): string {
  const v = toFiniteNumber(n);
  if (v === null) return "—";

  if (v >= 1) {
    return v.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return v.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
  });
}

// ✅ Dinero inteligente (para precios de variantes, quotes, etc.)
// - si >= 1 → 0,00
// - si < 1 → decimales reales (sin rellenar), hasta 10 decimales
export function fmtMoneySmart(symbol: string, n: any): string {
  const v = toFiniteNumber(n);
  if (v === null) return "—";
  const s = String(symbol || "").trim();

  const num =
    v >= 1
      ? v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : v.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 10 });

  return s ? `${s} ${num}` : num;
}

// ✅ Número “smart” genérico (sin símbolo)
// - >= 1 → 2 decimales
// - < 1 → hasta 10 decimales (sin rellenar)
export function fmtNumberSmart(n: any): string {
  const v = toFiniteNumber(n);
  if (v === null) return "—";

  return v >= 1
    ? v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 10 });
}

// ✅ Pureza / Ley: SIEMPRE 0,000 (3 decimales fijos)
export function fmtPurity3(purity: any): string {
  const v = toFiniteNumber(purity);
  if (v === null) return "—";

  const p = 10 ** 3;
  const r = Math.round((v + Number.EPSILON) * p) / p;

  return r.toFixed(3).replace(".", ",");
}

// ✅ Pureza / Ley: SIEMPRE 0,0000 (4 decimales fijos) — útil para 0.7500, 0.5850
export function fmtPurity2(purity: any): string {
  const v = toFiniteNumber(purity);
  if (v === null) return "—";

  const p = 10 ** 4;
  const r = Math.round((v + Number.EPSILON) * p) / p;

  return r.toFixed(4).replace(".", ",");
}

// Si necesitás ordenar por pureza usando el mismo redondeo:
export function purityKey3(purity: any): number {
  const v = toFiniteNumber(purity);
  if (v === null) return -Infinity;
  const p = 10 ** 3;
  return Math.round((v + Number.EPSILON) * p) / p;
}

// ✅ Key estable para ordenar por pureza (4 decimales)
export function purityKey2(purity: any): number {
  const v = toFiniteNumber(purity);
  if (v === null) return -Infinity;
  const p = 10 ** 4;
  return Math.round((v + Number.EPSILON) * p) / p;
}