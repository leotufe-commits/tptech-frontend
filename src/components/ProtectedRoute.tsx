import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = { children?: React.ReactNode };

export default function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // ⏳ Mientras AuthProvider valida la sesión
  if (loading) {
    return <div className="p-6 text-sm text-muted">Cargando…</div>;
  }

  // 🚪 Sin usuario → login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // ✅ Usuario válido
  return <>{children ?? <Outlet />}</>;
}
