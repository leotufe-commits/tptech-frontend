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
import Roles from "./pages/Roles";

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

  {
    path: "/login",
    element: (
      <PublicOnly>
        <Login />
      </PublicOnly>
    ),
  },
  {
    path: "/register",
    element: (
      <PublicOnly>
        <Register />
      </PublicOnly>
    ),
  },
  {
    path: "/forgot-password",
    element: (
      <PublicOnly>
        <ForgotPassword />
      </PublicOnly>
    ),
  },

  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },

          // ===== PRINCIPAL =====
          { path: "dashboard", element: <Dashboard /> },
          { path: "divisas", element: <Divisas /> },

          // ===== ARTÍCULOS (nuevo grupo de menú) =====
          // Reutilizamos tu página actual de InventarioArticulos
          { path: "articulos/articulos", element: <InventarioArticulos /> },
          { path: "articulos/compuestos", element: <Placeholder title="Artículos compuestos" /> },
          { path: "articulos/grupos", element: <Placeholder title="Grupos de artículos" /> },

          // ===== INVENTARIO (lo que ya tenías) =====
          { path: "inventario/articulos", element: <InventarioArticulos /> },
          { path: "inventario/almacenes", element: <InventarioAlmacenes /> },
          { path: "inventario/movimientos", element: <InventarioMovimientos /> },

          // ===== VENTAS (menú completo) =====
          { path: "ventas/clientes", element: <VentasClientes /> },
          { path: "ventas/ordenes-venta", element: <Placeholder title="Órdenes de venta" /> },
          { path: "ventas/facturas-clientes", element: <Placeholder title="Facturas de clientes" /> },
          { path: "ventas/paquetes", element: <Placeholder title="Paquetes" /> },
          { path: "ventas/remitos", element: <Placeholder title="Remitos" /> },
          { path: "ventas/pagos-recibidos", element: <Placeholder title="Pagos recibidos" /> },
          { path: "ventas/devoluciones", element: <Placeholder title="Devoluciones de venta" /> },
          { path: "ventas/notas-credito", element: <Placeholder title="Notas de crédito" /> },

          // (compatibilidad con tu ruta vieja actual)
          { path: "ventas/ordenes", element: <Navigate to="/ventas/ordenes-venta" replace /> },

          // ===== COMPRAS (menú completo) =====
          { path: "compras/proveedores", element: <ComprasProveedores /> },
          { path: "compras/ordenes-compra", element: <Placeholder title="Órdenes de compra" /> },
          { path: "compras/facturas-proveedor", element: <Placeholder title="Facturas de proveedor" /> },
          { path: "compras/recepciones", element: <Placeholder title="Recepción de compras" /> },
          { path: "compras/pagos-realizados", element: <Placeholder title="Pagos realizados" /> },
          { path: "compras/devoluciones", element: <Placeholder title="Devolución" /> },
          { path: "compras/creditos-proveedor", element: <Placeholder title="Créditos del proveedor" /> },

          // (compatibilidad con tu ruta vieja actual)
          { path: "compras/ordenes", element: <Navigate to="/compras/ordenes-compra" replace /> },

          // ===== FINANZAS =====
          // Si después querés separar Finanzas de Configuración, lo armamos.
          { path: "finanzas", element: <Placeholder title="Finanzas" /> },

          // ===== CONFIGURACIÓN =====
          { path: "configuracion/joyeria", element: <PerfilJoyeria /> },
          { path: "configuracion/cuenta", element: <Cuenta /> },
          { path: "configuracion/usuarios", element: <Usuarios /> },
          { path: "configuracion/roles", element: <Roles /> },

          // ruta genérica
          { path: "configuracion", element: <Placeholder title="Configuración" /> },
        ],
      },
    ],
  },
]);

export default router;
