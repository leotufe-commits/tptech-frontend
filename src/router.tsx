import { createBrowserRouter, Navigate } from "react-router-dom";

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
import Placeholder from "./pages/Placeholder";

// ✅ IMPORT DEFAULT (porque ProtectedRoute exporta default)
import ProtectedRoute from "./components/ProtectedRoute";

const router = createBrowserRouter([
  // Redirección inicial
  { path: "/", element: <Navigate to="/login" replace /> },

  // Rutas públicas
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  // { path: "/reset-password", element: <ResetPassword /> },

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
