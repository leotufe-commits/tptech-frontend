// tptech-frontend/src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LockScreen from "./LockScreen";

export default function ProtectedRoute() {
  const { user, loading, locked } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-6 text-sm text-muted">Cargando…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // ✅ Renderiza la app, y si está lockeado, pone LockScreen arriba de todo.
  return (
    <>
      <Outlet />
      {locked && <LockScreen />}
    </>
  );
}
