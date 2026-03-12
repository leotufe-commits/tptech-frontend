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
  const { user, jewelry, roles, permissions, loading, refreshMe } = useAuth();

  const me = useMemo(() => {
    if (!user) return null;
    return { user, jewelry, roles, permissions };
  }, [user, jewelry, roles, permissions]);

  const refresh = useCallback(
    (opts?: { force?: boolean; silent?: boolean }) => refreshMe(opts),
    [refreshMe]
  );

  return { me, loading, error: null as string | null, refresh };
}
