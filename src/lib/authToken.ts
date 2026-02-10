// tptech-frontend/src/lib/authToken.ts
import { LS_TOKEN_KEY, SS_TOKEN_KEY } from "./api";

/**
 * Devuelve el token actual priorizando sessionStorage (login actual)
 * y luego localStorage (legacy / remember).
 */
export function getAccessToken(): string {
  try {
    const ss = sessionStorage.getItem(SS_TOKEN_KEY);
    if (ss && String(ss).trim()) return String(ss).trim();
  } catch {}

  try {
    const ls = localStorage.getItem(LS_TOKEN_KEY);
    if (ls && String(ls).trim()) return String(ls).trim();
  } catch {}

  return "";
}
