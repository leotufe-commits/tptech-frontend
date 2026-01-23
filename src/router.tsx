// tptech-frontend/src/router.tsx
import React from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

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

import ConfiguracionSistema from "./pages/ConfiguracionSistema";
import SystemPinSettings from "./pages/SystemPinSettings";
import SystemThemeSettings from "./pages/SystemThemeSettings";

import ProtectedRoute from "./components/ProtectedRoute";

function LoadingGate() {
  return <div className="p-6 text-sm text-muted">Cargando…</div>;
}

function IndexRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingGate />;
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingGate />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/**
 * ✅ Wrapper para usar ProtectedRoute correctamente con Router v6:
 * ProtectedRoute espera children → le pasamos <Outlet />.
 */
function ProtectedOutlet() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <IndexRedirect /> },

  /* =====================
     PUBLIC
  ===================== */
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

  /* =====================
     PRIVATE
  ===================== */
  {
    element: <ProtectedOutlet />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },

          // ===== PRINCIPAL =====
          { path: "dashboard", element: <Dashboard /> },
          { path: "divisas", element: <Divisas /> },

          // ===== ARTÍCULOS =====
          { path: "articulos/articulos", element: <InventarioArticulos /> },
          { path: "articulos/compuestos", element: <Placeholder title="Artículos compuestos" /> },
          { path: "articulos/grupos", element: <Placeholder title="Grupos de artículos" /> },

          // ===== INVENTARIO =====
          { path: "inventario/articulos", element: <InventarioArticulos /> },
          { path: "inventario/almacenes", element: <InventarioAlmacenes /> },
          { path: "inventario/movimientos", element: <InventarioMovimientos /> },

          // ===== VENTAS =====
          { path: "ventas/clientes", element: <VentasClientes /> },
          { path: "ventas/ordenes-venta", element: <Placeholder title="Órdenes de venta" /> },
          { path: "ventas/facturas-clientes", element: <Placeholder title="Facturas de clientes" /> },
          { path: "ventas/paquetes", element: <Placeholder title="Paquetes" /> },
          { path: "ventas/remitos", element: <Placeholder title="Remitos" /> },
          { path: "ventas/pagos-recibidos", element: <Placeholder title="Pagos recibidos" /> },
          { path: "ventas/devoluciones", element: <Placeholder title="Devoluciones de venta" /> },
          { path: "ventas/notas-credito", element: <Placeholder title="Notas de crédito" /> },

          // compat rutas viejas
          { path: "ventas/ordenes", element: <Navigate to="/ventas/ordenes-venta" replace /> },

          // ===== COMPRAS =====
          { path: "compras/proveedores", element: <ComprasProveedores /> },
          { path: "compras/ordenes-compra", element: <Placeholder title="Órdenes de compra" /> },
          { path: "compras/facturas-proveedor", element: <Placeholder title="Facturas de proveedor" /> },
          { path: "compras/recepciones", element: <Placeholder title="Recepción de compras" /> },
          { path: "compras/pagos-realizados", element: <Placeholder title="Pagos realizados" /> },
          { path: "compras/devoluciones", element: <Placeholder title="Devolución" /> },
          { path: "compras/creditos-proveedor", element: <Placeholder title="Créditos del proveedor" /> },

          // compat rutas viejas
          { path: "compras/ordenes", element: <Navigate to="/compras/ordenes-compra" replace /> },

          // ===== FINANZAS =====
          { path: "finanzas", element: <Placeholder title="Finanzas" /> },

          // ===== CONFIGURACIÓN (pantallas existentes) =====
          { path: "configuracion/joyeria", element: <PerfilJoyeria /> },
          { path: "configuracion/cuenta", element: <Cuenta /> },
          { path: "configuracion/usuarios", element: <Usuarios /> },
          { path: "configuracion/roles", element: <Roles /> },

          // ✅ HUB (Configuración del Sistema)
          { path: "configuracion-sistema", element: <ConfiguracionSistema /> },
          { path: "configuracion-sistema/pin", element: <SystemPinSettings /> },
          { path: "configuracion-sistema/tema", element: <SystemThemeSettings /> },

          /* =====================
             COMPAT: RUTAS VIEJAS
          ===================== */
          { path: "configuracion/sistema", element: <Navigate to="/configuracion-sistema" replace /> },
          {
            path: "configuracion/sistema/pin",
            element: <Navigate to="/configuracion-sistema/pin" replace />,
          },
          {
            path: "configuracion/sistema/tema",
            element: <Navigate to="/configuracion-sistema/tema" replace />,
          },
          { path: "configuracion", element: <Navigate to="/configuracion-sistema" replace /> },

          // ✅ COMPAT: aliases que usaste antes
          { path: "usuarios", element: <Navigate to="/configuracion/usuarios" replace /> },
          { path: "roles", element: <Navigate to="/configuracion/roles" replace /> },
          { path: "perfil-joyeria", element: <Navigate to="/configuracion/joyeria" replace /> },

          // ✅ fallback: si llega cualquier cosa rara
          { path: "*", element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
]);

export default router;
