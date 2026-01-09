// FRONTEND
// tptech-frontend/src/router.tsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";

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

import Usuarios from "./pages/Users";
import Roles from "./pages/Roles"; // ✅ NUEVO

import ProtectedRoute from "./components/ProtectedRoute";

function IndexRedirect() {
  const { token, loading } = useAuth();
  if (loading) return null;
  return token ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return null;
  if (token) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: "/", element: <IndexRedirect /> },

  { path: "/login", element: <PublicOnly><Login /></PublicOnly> },
  { path: "/register", element: <PublicOnly><Register /></PublicOnly> },
  { path: "/forgot-password", element: <PublicOnly><ForgotPassword /></PublicOnly> },

  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },

          { path: "dashboard", element: <Dashboard /> },

          { path: "divisas", element: <Divisas /> },
          { path: "finanzas", element: <Placeholder title="Finanzas" /> },

          // Configuración
          { path: "configuracion/joyeria", element: <PerfilJoyeria /> },
          { path: "configuracion/cuenta", element: <Cuenta /> },
          { path: "configuracion/usuarios", element: <Usuarios /> },
          { path: "configuracion/roles", element: <Roles /> }, // ✅ NUEVO

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
