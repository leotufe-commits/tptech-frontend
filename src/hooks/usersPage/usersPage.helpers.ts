// tptech-frontend/src/hooks/usersPage/usersPage.helpers.ts

/**
 * Este archivo DEBE ser un módulo (tener exports),
 * porque en useUsersPage.ts se importa: import * as UserHelpers from "./usersPage/usersPage.helpers";
 */

export function stableJson(v: any): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

export function draftKey(f: File): string {
  // key estable para comparar adjuntos en draft
  return `${f.name}-${f.size}-${f.lastModified}`;
}

export function assertPin4Local(pin: string): string {
  const s = String(pin ?? "").trim();
  if (!/^\d{4}$/.test(s)) throw new Error("El PIN debe tener 4 dígitos.");
  return s;
}

// Si en el futuro querés agregar más helpers, hacelo acá.
export const __usersPageHelpers = true;