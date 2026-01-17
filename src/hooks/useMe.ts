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
 *
 * ✅ Importante: NO depende de auth.token, porque en PROD la sesión
 * real es por cookie httpOnly y puede no existir token en storage.
 */
export function useMe() {
  const auth = useAuth();

  const roles = Array.isArray(auth.roles) ? auth.roles : [];
  const permissions = Array.isArray(auth.permissions) ? auth.permissions : [];

  const me = useMemo(() => {
    // ✅ cookie-first: si hay usuario, hay "me"
    if (!auth.user) return null;

    return {
      user: auth.user,
      jewelry: auth.jewelry ?? null,
      roles,
      permissions,
    };
  }, [auth.user, auth.jewelry, roles, permissions]);

  const error = useMemo(() => {
    // AuthContext maneja errores internamente.
    // Si /auth/me devuelve 401, apiFetch hace forceLogout() y se limpia sesión.
    // Para errores de red/5xx, AuthContext mantiene sesión.
    return null as string | null;
  }, []);

  /**
   * refresh(): fuerza /auth/me para traer datos actuales (empresa/logo/permisos)
   * ✅ silent: true evita que se prenda el loading global y la pantalla parpadee
   */
  const refresh = useCallback(async () => {
    await auth.refreshMe({ force: true, silent: true });
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
