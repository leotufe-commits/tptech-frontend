// tptech-frontend/src/hooks/usePermissions.ts
import { useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Convenio recomendado:
 * permission string = "MODULE:ACTION" (ej: "USERS_ROLES:VIEW")
 */
export function usePermissions() {
  const { permissions, loading } = useAuth();

  const list = useMemo(() => (Array.isArray(permissions) ? permissions : []), [permissions]);

  // Lookup O(1)
  const set = useMemo(() => new Set(list), [list]);

  const can = useCallback(
    (permission: string) => {
      if (loading) return false;
      return set.has(permission);
    },
    [loading, set]
  );

  const canAny = useCallback(
    (perms: string[]) => {
      if (loading) return false;
      for (const p of perms) if (set.has(p)) return true;
      return false;
    },
    [loading, set]
  );

  const canAll = useCallback(
    (perms: string[]) => {
      if (loading) return false;
      for (const p of perms) if (!set.has(p)) return false;
      return true;
    },
    [loading, set]
  );

  /**
   * Helpers por módulo/acción para evitar concatenar strings por todos lados.
   * Ej: canMA("CLIENTS", "EDIT")
   */
  const canMA = useCallback(
    (module: string, action: string) => {
      if (loading) return false;
      return set.has(`${module}:${action}`);
    },
    [loading, set]
  );

  const canAnyMA = useCallback(
    (pairs: Array<[module: string, action: string]>) => {
      if (loading) return false;
      for (const [m, a] of pairs) if (set.has(`${m}:${a}`)) return true;
      return false;
    },
    [loading, set]
  );

  const canAllMA = useCallback(
    (pairs: Array<[module: string, action: string]>) => {
      if (loading) return false;
      for (const [m, a] of pairs) if (!set.has(`${m}:${a}`)) return false;
      return true;
    },
    [loading, set]
  );

  return {
    // API original
    can,
    canAny,
    canAll,

    // API extendida (más cómoda)
    canMA,
    canAnyMA,
    canAllMA,

    // expose
    permissions: list,
    permissionsSet: set,
    loading,
  };
}
