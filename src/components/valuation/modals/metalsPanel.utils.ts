// tptech-frontend/src/components/valuation/modals/metalsPanel.utils.ts
import { useEffect, useRef } from "react";

/* =========================
   Sort types
========================= */
export type VarSortKey = "name" | "purity" | "suggested" | "sell" | "status";
export type VarSortDir = "asc" | "desc";

export type RefSortKey = "edited" | "user" | "value" | "created";
export type RefSortDir = "asc" | "desc";

export type DateRange = { from: Date | null; to: Date | null };

/* =========================
   Utils
========================= */
export function toNum(v: any, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function fmtDateTime(v?: string) {
  if (!v) return "\u2014";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("es-AR");
}

export function userLabel(u: any) {
  if (!u) return "\u2014";
  const name = String(u?.name || "").trim();
  const email = String(u?.email || "").trim();
  return name || email || "\u2014";
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function useLatest<T>(value: T) {
  const r = useRef(value);
  useEffect(() => {
    r.current = value;
  }, [value]);
  return r;
}
