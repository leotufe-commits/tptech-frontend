import { apiFetch } from "../lib/api";

export type Permission = {
  id: string;
  module: string;
  action: string;
};

export async function fetchPermissions(): Promise<{ permissions: Permission[] } | Permission[]> {
  return apiFetch("/permissions");
}
