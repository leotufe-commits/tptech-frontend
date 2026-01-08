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
  | { permissions: Permission[] }
  | Permission[];

/* =========================
   Helpers
========================= */
function normalizePermissions(resp: unknown): Permission[] {
  if (Array.isArray(resp)) return resp as Permission[];
  if (resp && typeof resp === "object" && Array.isArray((resp as any).permissions)) {
    return (resp as any).permissions as Permission[];
  }
  return [];
}

/* =========================
   API
========================= */
export async function fetchPermissions(): Promise<Permission[]> {
  const resp = await apiFetch<PermissionsResponse>("/permissions");
  return normalizePermissions(resp);
}
