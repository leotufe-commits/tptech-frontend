// tptech-frontend/src/hooks/usePermissions.ts
import { useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Convenio recomendado:
 * permission string = "MODULE:ACTION" (ej: "USERS_ROLES:VIEW")
 *
 * ✅ Soporta permisos como:
 * - string[]  -> ["A:B", "C:D"]
 * - object[]  -> [{ code: "A:B" }, { name: "C:D" }]
 * - nested    -> [{ permission: { code: "A:B" } }]
 */
export function usePermissions() {
  const { permissions, loading } = useAuth();

  const list = useMemo(() => {
    const raw: any[] = Array.isArray(permissions) ? (permissions as any[]) : [];

    const normalized = raw
      .map((p) => {
        if (!p) return null;

        // string directo
        if (typeof p === "string") return p.trim();

        // formatos comunes en APIs
        if (typeof p?.code === "string") return p.code.trim();
        if (typeof p?.name === "string") return p.name.trim();
        if (typeof p?.permission === "string") return p.permission.trim();

        // nested: { permission: { code: "MODULE:ACTION" } }
        if (typeof p?.permission?.code === "string") return p.permission.code.trim();
        if (typeof p?.permission?.name === "string") return p.permission.name.trim();

        return null;
      })
      .filter(Boolean) as string[];

    // dedupe
    return Array.from(new Set(normalized));
  }, [permissions]);

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
    can,
    canAny,
    canAll,
    canMA,
    canAnyMA,
    canAllMA,
    permissions: list,
    permissionsSet: set,
    loading,
  };
}
