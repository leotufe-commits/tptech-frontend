// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  // Evita flash de contenido protegido
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Cargando…
      </div>
    );
  }

  // Sin sesión → login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
