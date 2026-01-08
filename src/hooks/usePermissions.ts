// tptech-frontend/src/hooks/usePermissions.ts
import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

export function usePermissions() {
  const { permissions, loading } = useAuth();

  const perms = useMemo(() => {
    return Array.isArray(permissions) ? permissions : [];
  }, [permissions]);

  function can(permission: string) {
    if (loading) return false;
    return perms.includes(permission);
  }

  function canAny(list: string[]) {
    if (loading) return false;
    return list.some((p) => perms.includes(p));
  }

  function canAll(list: string[]) {
    if (loading) return false;
    return list.every((p) => perms.includes(p));
  }

  return {
    can,
    canAny,
    canAll,
    permissions: perms,
    loading,
  };
}
