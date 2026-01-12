// tptech-frontend/src/services/permissions.ts
import { apiFetch } from "../lib/api";

/* =========================
   Types
========================= */
export type Permission = {
  id: string;
  module: string;
  action: string;
};

export type PermissionsResponse =
  | Permission[]
  | { permissions: Permission[] }
  | { data: Permission[] };

/* =========================
   Helpers
========================= */
export function normalizePermissions(resp: unknown): Permission[] {
  if (Array.isArray(resp)) return resp as Permission[];

  if (resp && typeof resp === "object") {
    const anyResp = resp as any;
    if (Array.isArray(anyResp.permissions)) return anyResp.permissions as Permission[];
    if (Array.isArray(anyResp.data)) return anyResp.data as Permission[];
  }

  return [];
}

/* =========================
   API
========================= */
export async function fetchPermissions(): Promise<Permission[]> {
  const resp = await apiFetch<PermissionsResponse>("/permissions", { method: "GET" });
  return normalizePermissions(resp);
}
