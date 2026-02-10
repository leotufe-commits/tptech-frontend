// tptech-frontend/src/components/ProtectedRoute.tsx
import React, { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = { children?: React.ReactNode };

export default function ProtectedRoute({ children }: Props) {
  const { user, loading, refreshMe } = useAuth() as any;
  const location = useLocation();

  const triedRef = useRef(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;

    if (user) {
      setChecked(true);
      return;
    }

    if (triedRef.current) {
      setChecked(true);
      return;
    }

    triedRef.current = true;

    (async () => {
      try {
        await refreshMe({ force: true, silent: true });
      } catch {
        // ignore
      } finally {
        if (alive) setChecked(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, refreshMe]);

  if (loading || !checked) {
    return <div className="p-6 text-sm text-muted">Cargando…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children ?? <Outlet />}</>;
}
