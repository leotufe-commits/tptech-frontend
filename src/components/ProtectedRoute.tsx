// FRONTEND
// tptech-frontend/src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { token, user, loading } = useAuth();

  // Evita flash / redirecciones mientras resolvemos /me
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Cargando…
      </div>
    );
  }

  // Sin token => no hay sesión
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Si hay token pero aún no tenemos user (caso multi-tab / primer load),
  // dejamos que el layout cargue o mostrás un loader si preferís.
  // Esto evita “rebotes” innecesarios.
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Cargando…
      </div>
    );
  }

  return <Outlet />;
}
