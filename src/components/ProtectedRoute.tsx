// tptech-frontend/src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  // Evita flash / redirecciones mientras resolvemos /auth/me
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Cargando…
      </div>
    );
  }

  // ✅ Cookie-first:
  // Si no hay user, no hay sesión válida (o expiró cookie)
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
