// tptech-frontend/src/components/ProtectedRoute.tsx
import React, { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = { children?: React.ReactNode };

function LoadingGate() {
  return <div className="p-6 text-sm text-muted">Cargando…</div>;
}

export default function ProtectedRoute({ children }: Props) {
  const { user, loading, refreshMe, bootstrapped } = useAuth() as any;
  const location = useLocation();

  const triedRef = useRef(false);

  useEffect(() => {
    // ✅ Si ya intentamos validar sesión alguna vez, no repetir
    if (bootstrapped) return;
    if (triedRef.current) return;

    triedRef.current = true;

    // ✅ cookie httpOnly: validar sesión cuando entramos a rutas protegidas
    refreshMe({ force: true, silent: true }).catch(() => {
      // ignore: si falla, AuthContext quedará público (user null) y bootstrapped true
    });
  }, [bootstrapped, refreshMe]);

  // ✅ Mientras estamos validando (o aún no intentamos boot), NO redirigir a /login
  if (!bootstrapped || loading) return <LoadingGate />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children ?? <Outlet />}</>;
}
