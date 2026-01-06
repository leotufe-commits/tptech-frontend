// FRONTEND
// tptech-frontend/src/router.tsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
// import ResetPassword from "./pages/ResetPassword";

import Dashboard from "./pages/Dashboard";
import MainLayout from "./layouts/MainLayout";

import Divisas from "./pages/Divisas";
import InventarioArticulos from "./pages/InventarioArticulos";
import InventarioAlmacenes from "./pages/InventarioAlmacenes";
import InventarioMovimientos from "./pages/InventarioMovimientos";
import VentasClientes from "./pages/VentasClientes";
import ComprasProveedores from "./pages/ComprasProveedores";

import PerfilJoyeria from "./pages/PerfilJoyeria";
import Cuenta from "./pages/Cuenta";
import Placeholder from "./pages/Placeholder";

// ✅ IMPORT DEFAULT (porque ProtectedRoute exporta default)
import ProtectedRoute from "./components/ProtectedRoute";

/**
 * Si hay sesión => /dashboard
 * Si no hay sesión => /login
 * Esto permite que, si otra pestaña hace LOGIN, esta pestaña redirija sola.
 */
function IndexRedirect() {
  const { token, loading } = useAuth();
  if (loading) return null; // o un loader si querés
  return token ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

/**
 * Wrapper para rutas públicas:
 * - Si ya está logueado => lo manda al dashboard
 * - Si no => renderiza la página pública
 */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return null; // o un loader si querés
  if (token) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  // ✅ Redirección inicial dinámica (según sesión)
  { path: "/", element: <IndexRedirect /> },

  // ✅ Rutas públicas (si ya hay sesión, redirigen a /dashboard)
  { path: "/login", element: <PublicOnly><Login /></PublicOnly> },
  { path: "/register", element: <PublicOnly><Register /></PublicOnly> },
  { path: "/forgot-password", element: <PublicOnly><ForgotPassword /></PublicOnly> },
  // { path: "/reset-password", element: <PublicOnly><ResetPassword /></PublicOnly> },

  // Rutas protegidas
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          // ✅ si entran a "/" ya logueados, mandalos al dashboard
          { index: true, element: <Navigate to="/dashboard" replace /> },

          { path: "dashboard", element: <Dashboard /> },

          { path: "divisas", element: <Divisas /> },
          { path: "finanzas", element: <Placeholder title="Finanzas" /> },

          // Configuración
          { path: "configuracion/joyeria", element: <PerfilJoyeria /> },
          { path: "configuracion/cuenta", element: <Cuenta /> },
          { path: "configuracion", element: <Placeholder title="Configuración" /> },

          // Inventario
          { path: "inventario/articulos", element: <InventarioArticulos /> },
          { path: "inventario/almacenes", element: <InventarioAlmacenes /> },
          { path: "inventario/movimientos", element: <InventarioMovimientos /> },

          // Ventas
          { path: "ventas/clientes", element: <VentasClientes /> },
          { path: "ventas/ordenes", element: <Placeholder title="Órdenes de Venta" /> },

          // Compras
          { path: "compras/proveedores", element: <ComprasProveedores /> },
          { path: "compras/ordenes", element: <Placeholder title="Órdenes de Compra" /> },
        ],
      },
    ],
  },
]);

export default router;
