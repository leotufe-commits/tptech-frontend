// tptech-frontend/src/hooks/useMe.ts
import { useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Hook unificado: usa AuthContext como única fuente de verdad.
 * - No hace fetch directo (evita duplicar /auth/me)
 * - refresh() delega en AuthContext.refreshMe()
 *
 * Devuelve un "me" compatible:
 * { user, jewelry, roles, permissions }
 */
export function useMe() {
  const auth = useAuth();

  const roles = Array.isArray(auth.roles) ? auth.roles : [];
  const permissions = Array.isArray(auth.permissions) ? auth.permissions : [];

  const me = useMemo(() => {
    if (!auth.token || !auth.user) return null;

    return {
      user: auth.user,
      jewelry: auth.jewelry ?? null,
      roles,
      permissions,
    };
  }, [auth.token, auth.user, auth.jewelry, roles, permissions]);

  const error = useMemo(() => {
    // AuthContext maneja errores internamente:
    // si /auth/me falla => limpia sesión.
    return null as string | null;
  }, []);

  const refresh = useCallback(async () => {
    await auth.refreshMe();
  }, [auth]);

  return {
    me,
    user: auth.user,
    jewelry: auth.jewelry,
    roles,
    permissions,
    loading: auth.loading,
    error,
    refresh,
  };
}
