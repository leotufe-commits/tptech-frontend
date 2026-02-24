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
  | { items: Permission[] }
  | { data: Permission[] };

/* =========================
   Helpers
========================= */
function isObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object";
}

function normalizePermissionRow(raw: any): Permission | null {
  if (!raw) return null;
  const id = String(raw.id ?? "").trim();
  const module = String(raw.module ?? "").trim();
  const action = String(raw.action ?? "").trim();
  if (!id || !module || !action) return null;
  return { id, module, action };
}

export function normalizePermissions(resp: unknown): Permission[] {
  let rows: any[] = [];

  if (Array.isArray(resp)) {
    rows = resp;
  } else if (isObject(resp)) {
    const anyResp = resp as any;
    if (Array.isArray(anyResp.permissions)) rows = anyResp.permissions;
    else if (Array.isArray(anyResp.items)) rows = anyResp.items; // ✅ backend actual
    else if (Array.isArray(anyResp.data)) rows = anyResp.data;
  }

  return rows.map(normalizePermissionRow).filter(Boolean) as Permission[];
}

/* =========================
   API
========================= */
export async function fetchPermissions(): Promise<Permission[]> {
  const resp = await apiFetch<PermissionsResponse>("/permissions", { method: "GET" });
  return normalizePermissions(resp);
}