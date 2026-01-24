// tptech-frontend/src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LockScreen from "./LockScreen";

type Props = { children?: React.ReactNode };

export default function ProtectedRoute({ children }: Props) {
  const { user, loading, locked } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-6 text-sm text-muted">Cargando…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <>
      {children ?? <Outlet />}
      {locked && <LockScreen />}
    </>
  );
}
