// tptech-frontend/src/hooks/usePermissions.ts
import { useMe } from "./useMe";

export function usePermissions() {
  const { me, loading } = useMe();

  // ✅ permisos vienen del /auth/me
  const permissions: string[] = (me as any)?.permissions ?? [];

  function can(permission: string) {
    if (loading) return false;
    return permissions.includes(permission);
  }

  function canAny(perms: string[]) {
    if (loading) return false;
    return perms.some((p) => permissions.includes(p));
  }

  function canAll(perms: string[]) {
    if (loading) return false;
    return perms.every((p) => permissions.includes(p));
  }

  return {
    can,
    canAny,
    canAll,
    permissions,
    loading,
  };
}
